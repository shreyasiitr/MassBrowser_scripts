var fs = require('fs');
var request = require('request');
var strSearch_1 = 'Your requested URL has been blocked as per the directions received from Department of Telecommunications, Government of India';

var strSearch_part_1 = 'The page you have requested has been blocked,';
var strSearch_part_2 = 'because the URL is banned as per the Government Rules';

var urlSearch = 'src="http://www.airtel.in/dot"';

try {
    var data = fs.readFileSync('url_banned_Indian_music.csv', 'utf8').split(/\r?\n/);
    var uncensoredList = [];
    var censoredList = [];
    var possiblyCensoredList = [];
    var errorMap = {};
    for(let i = 0; i < data.length; i++){
    	var url = data[i].split(" ")[0];
		url = "http://www." + url;
		console.log(url);
		fetchPage(url, uncensoredList, censoredList, possiblyCensoredList, errorMap);
    }
} catch(e) {
    console.log('Error:', e.stack);
}

function fetchPage(url, uncensoredList, censoredList, possiblyCensoredList, errorMap){
	request(url, { json: true }, (err, res, body) => {
	  if (err) {
	  	errorMap[url] = err;
	  	console.log(err); 
	  }
	  else{
		var statusCode = res.request.responseContent.statusCode;
		var censored = isCensored(statusCode, body);
		console.log(censored);
		if(censored == -1){
			uncensoredList.push(url);
			//console.log("Uncensored");
		}
		else if(censored == 2){
			possiblyCensoredList.push(url);
			//console.log("Possibly censored");
		}
		else{
			console.log(censored);
			censoredList.push(url);
			//console.log("Censored : " + url);
		}
	  }
	});
}
function isCensored(statusCode, body){
	console.log(body.toString());
	if( body.search(strSearch_1)!=-1 ){
		console.log("1.1");
		return 1.1;
	}
	if(body.search(strSearch_part_1)!=-1 && body.search(strSearch_part_2)!=-1){
		console.log("1.2");
		return 1.2;
	}
	if(body.search(urlSearch)!=-1 ){
		console.log("1.3");
		return 1.3;
	}
	if(statusCode >= 200 && statusCode < 300){
		return -1;
	}
	if(!body || body == undefined){
		return 2;
	}
	if( statusCode >=400 ){
		return 2;
	}
	console.log("-1");
	return -1;
}