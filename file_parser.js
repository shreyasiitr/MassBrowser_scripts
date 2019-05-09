var fs = require('fs');

try {
    var data = fs.readFileSync('eg-blocked-news.csv', 'utf8').split(/\r?\n/);
    for(let i = 1; i < data.length; i++){
    	var url = data[i].split(",")[1];
		fs.appendFile('eg_banned_candidates.csv', url+'\n', function (err) {
          if (err) throw err;
          console.log('Saved!');
        });
    }
} catch(e) {
    console.log('Error:', e.stack);
}