const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('configFile.json', 'utf8'));
config.extra = {
	serverFilePath : process.cwd(), // /home/nicksen782/node_sites/remarkable-viewer/SERVER
	webServer      : `${config.https ? "https" : "http"}://${config.host}:${config.port}`, // http://0.0.0.0:3100
	"process.pid"  : process.pid, // 72073
	serverStarted  : `${new Date().toString().split(" GMT")[0]} `, // Thu Sep 30 2021 17:04:35
};

// for(let key in config){
// 	if(key == "extra") { continue; }
// 	let stats;
// 	let absolutePath = "" ;
// 	if(fs.existsSync(config[key])){ 
// 		absolutePath = path.resolve(config[key]); //+ "///////" + stats.isFile ? "" : "/";
// 		stats = fs.statSync( absolutePath );
		
// 		config[key] = path.relative(process.cwd(), absolutePath);

// 		if( !stats.isFile() && stats.isDirectory() ){
// 			config[key] += "/";
// 		}

// 		console.log(key.padEnd(20, " "), "F:", stats.isFile() ? "1" : "0", "D:", stats.isDirectory() ? "1" : "0", process.cwd()+"/");
// 	}
// }

module.exports = {
	config     :config,
	_version          : function(){ return "Version 2021-09-24"; }
};