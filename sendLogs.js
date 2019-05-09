var sendmail = require('sendmail')({silent: true});
var iplocation = require("iplocation").default;
var ip = require('ip');


module.exports = function sendMassLogs(){
  iplocation(ip.address().toString(),[],(error, res)=>{
    sendmail({
        from: 'shreyasiitr@gmail.com',
        to: 'shreyasiitr@gmail.com',
        subject: 'MassBrowser logs',
        html: 'Please find attached the latest logs for the IP : ' + '\n' + JSON.stringify(res),
        attachments: [
          {   // filename and content type is derived from path
                  path: 'MassBrowserLogs.log'
          },
        ]
      }, function (err, reply) {
      });
  });
}

//sendMassLogs();