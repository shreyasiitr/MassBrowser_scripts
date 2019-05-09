var net = require('net'),
  socks = require('./socks.js')

// New code
// ############
var fs = require('fs')

import { connectionManager } from './connectionManager'
import { cacheManager } from '@/cachebrowser'
import { policyManager } from '@/services'

import { debug, info, warn, error } from '@utils/log'
import * as errors from '@utils/errors'
import config from '@utils/config'
import { torService, telegramService } from '@common/services'

var requestArray = [];
var responseArray = [];

export function startClientSocks (mhost, mport) {
  var HOST = mhost,
    PORT = mport
  if (typeof mhost === 'undefined') {
    HOST = '127.0.0.1'
  }
  if (typeof mport === 'undefined') {
    PORT = '7080'
  }

  function onConnection (socket, port, address, proxyReady) {
    // Handle torService and telegramService via yalerProxy
    if (net.isIP(address)) {    // net.isIP() will return 0 or 4 or 6
      if (torService.isTorIP(address)  || telegramService.isTelegramIP(address))
      {
        return yalerProxy(socket,address,port,proxyReady)
      }
      return sendToNoHostHandler(socket, address, port, proxyReady)
    }

    // Check if the request is to the Web Panel by checking domain
    // name or IP:port
    if (address === config.web.domain ||
        ((address === '127.0.0.1' || address === 'localhost') && port == config.web.port)) {
      return sendToWebPanel(socket, address, port, proxyReady)
    }

    //
    policyManager.getDomainPolicy(address, port)
    .then((proxyType) => {
      debug(`New socks connection to ${address}:${port} using policy '${proxyType}'`)

      // Notice that every connection to use a yalerProxy or
      // cachebrowser has to be included by the policyManager already,
      // otherwiser, the connection will be send to the so-called
      // regualrProxy which is actually direct connection. So far, the
      // developers have been manually uploading all the policies
      // online, but there are still two questions remain:

      // first, shall we set a mechanism to let report those domians
      // that are redirected to the regularPorxy so that we know what
      // domain should be added by the developer to the policy
      // manaager?
      // A: Yes. This can be a nice feature. But be careful with privacy
      // and UX issue.

      // second, users may not be aware that their connections to
      // potentially sensitive websites are sent directly, without any
      // further protection. While it is better for usability because
      // an unknown domain does not have to be censored (so it may be
      // accessible through direct connection), will it be better to
      // have an option for user that says " I want all my traffic
      // goes through either a proxy or an encryptionh HTTPS channel
      // but never direct connection"?
      // A: This is not very good for usability.
      if (proxyType === policyManager.POLICY_YALER_PROXY) {
        return yalerProxy(socket, address, port, proxyReady)
      } else if (proxyType === policyManager.POLICY_CACHEBROWSE) {
        return cachebrowse(socket, address, port, proxyReady)
      } else if (proxyType === policyManager.POLICY_VANILLA_PROXY) {
        return regularProxy(socket, address, port, proxyReady)
      } else {
        return regularProxy(socket, address, port, proxyReady)
      }
    })
    .catch(err => {
      if (err instanceof errors.InvalidHostError) {
        error(err.message)
      } else if (err instanceof errors.NoRelayAvailableError) {
        warn('No relay was found for new session, terminating connection')
        socket.end()
      } else {
        warn("Connection failed")
        error(err)
      }
      /* TODO at least report errors which are not smart to sentry
       * (errors which are we are sure aren't handled) */
    })
  }

  return new Promise((resolve, reject) => {
    var userPass// process.argv[3] && process.argv[4] && {username: process.argv[3], password: process.argv[4]}
    var server = socks.createServer(onConnection, userPass, server => {
      resolve(server)
    })

    server.on('error', function (e) {
      console.error('SERVER ERROR: %j', e)
      if (e.code === 'EADDRINUSE') {
        console.log('Address in use, retrying in 10 seconds...')
        setTimeout(function () {
          console.log('Reconnecting to %s:%s', HOST, PORT)
          server.close()
          server.listen(PORT, HOST)
        }, 10000)
      }
    })

    server.listen(PORT, HOST)
  })
}

// yalerProxy is the connection to Mass buddies. The name origins from
// the reverse of relay :)
function yalerProxy(socket, address, port, proxyReady) {
  return connectionManager.newClientConnection(socket, address, port, proxyReady)
}

// cachebrowse does not need the help of Mass buddies
function cachebrowse(socket, address, port, proxyReady) {
  return cacheManager.newCacheConnection(socket, address, port, proxyReady)
  .catch(err => {
    if (err instanceof errors.NotCacheBrowsableError) {
      warn(`Attempted to cachebrowse ${address}:${port} but it is not cachebrowsable, falling back to relay proxy`)
      return yalerProxy(socket, address, port, proxyReady)
    } else {
      throw err
    }
  })
}

// regularProxy is actually a direct connection attempt to the desired
// dst. It is called a proxy because it is a local proxy.
function regularProxy (socket, address, port, proxyReady) {
  var proxy = net.createConnection({port: port, host: address}, proxyReady)
  // proxy.setEncoding('utf8')
  var localAddress, localPort
  proxy.on('connect', () => {
    localPort = proxy.localPort
  })
  proxy.on('data', (d) => {
    try {
    	//############
    	// info("Shreyas 1")
        //info(d.toString())
        // info("IP : "+ address.toString())
        var strResponse = d.toString()
        if(strResponse.search("HTTP/1.1")!=-1){
        	responseArray.push(strResponse);
        }
        //info(responseArray)
        //############
      if (!socket.write(d)) {
        proxy.pause()
        socket.on('drain', function () {
          proxy.resume()
        })
        setTimeout(function () {
          proxy.resume()
        }, 100)
      }
    } catch (err) {
    }
  })
  socket.on('data', function (d) {
  	// ############
  	// info("Shreyas 2")
  	// info(d.toString())
  	// ############
    // If the application tries to send data before the proxy is ready, then that is it's own problem.
    try {
      info(socket)
      var strRequest = d.toString();
   	  if(strRequest.search("HTTP/1.1")!=-1){
        requestArray.push(strRequest);
      }
      // info(requestArray)
      // console.log('sending ' + d.length + ' bytes to proxy')
      if (!proxy.write(d)) {
        // when failed to write data received by the socket to the
        // proxy, we need to throttle back the traffic from socket for
        // now.
        socket.pause()
        // listen on 'drain' event to resume socket
        proxy.on('drain', function () { socket.resume() })
        // resume socket later
        setTimeout(function () { socket.resume() }, 100)
      }
    } catch (err) {
    }
  })

  // listen to 'error' for further debugging
  proxy.on('error', function (err) {
    // console.log('Ignore proxy error');
  })
  socket.on('error', (err) => {

  })

  proxy.on('close', function (had_error) {
    try {
      for(let j=0; j<requestArray.length; j++){
      	var response = "";
      	if(j<responseArray.length){
      		response = responseArray[j];
      	}
      	var request = requestArray[j];
      	var obj = {};
      	obj[request] = response;
      	writeObj(JSON.stringify(obj));
      	//socketContents(socket);
      }
      if (had_error) {
        error(`socks connection close unexpectedly ${address} ${port}`)
      }
      socket.close()
    } catch (err) {
    }
  })
}

function socketContents(socket){
	fs.appendFile('ArrayContents.log', JSON.stringify(socket)+'\n', function (writeError) {
      if (writeError){
      	throw writeError;
      	console.log(writeError);
      };
    });
}

function writeObj(obj){
	fs.appendFile('MassBrowserLogs.log', obj+'\n', function (writeError) {
      if (writeError) throw writeError;
    });
}

function binaryToString(bytes){
	var result = "";
	for(var i = 0; i < bytes.length; ++i){
		result+= (String.fromCharCode(bytes[i]));
	}
	return JSON.parse(result);
}

function sendToWebPanel(socket, address, port, proxyReady) {
  if (port === 443) {
    debug(`Forwarding webpanel cachebrowser request ${address}:${port}`)
    return cachebrowse(socket, 'yaler.co', port, proxyReady)
  } else {
    debug("Forwarding request to webpanel")
    return regularProxy(socket, '127.0.0.1', config.web.port, proxyReady)
  }
}

function sendToNoHostHandler(socket, address, port, proxyReady) {
  return regularProxy(socket, '127.0.0.1', config.noHostHandlerPort, proxyReady)
}
