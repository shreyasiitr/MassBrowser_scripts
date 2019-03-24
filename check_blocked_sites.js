var fs = require('fs');
var request = require('request');

try {
    var data = fs.readFileSync('blocked_Russia.csv', 'utf8').split(/\r?\n/);
    var uncensoredList = [];
    var censoredList = [];
    var possiblyCensoredList = [];
    var errorMap = {};
    for(let i = 0; i < data.length; i++){
    	var url = data[i].split(" ")[0];
		url = "http://" + url;
		fetchPage(url, uncensoredList, censoredList, possiblyCensoredList, errorMap);
    }
} catch(e) {
    console.log('Error:', e.stack);
}

function fetchPage(url, uncensoredList, censoredList, possiblyCensoredList, errorMap){
	request(url, { json: true }, (err, res, body) => {
	  if (err) {
	  	errorMap[url] = err;
	  	//console.log(err); 
	  }
	  else{
		var statusCode = res.request.responseContent.statusCode;
		var censored = isCensored(statusCode, body);
		if(censored == -1){
			console.log("-1 "+url);
			uncensoredList.push(url);
			//console.log("Uncensored");
		}
		else if(censored == 1){
			console.log("1 "+url);
			censoredList.push(url);
			//console.log("Censored : " + url);
		}
		else if(censored == 2){
			console.log("2 "+url);
			possiblyCensoredList.push(url);
			//console.log("Possibly censored");
		}
	  }
	});
}
function isCensored(statusCode, body){
	if(statusCode >= 200 && statusCode < 300){
		return -1;
	}
	if(!body || body == undefined){
		return 2;
	}
	if( body.search('src="http://block.msm.ru/block.html"')!=-1){
		return 1;
	}
	if( statusCode >=400 ){
		return 2;
	}
	return -1;
}