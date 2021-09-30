const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('configFile.json', 'utf8'));
config.extra = {
	serverFilePath : process.cwd(), // /home/nicksen782/node_sites/remarkable-viewer/SERVER
	webServer      : `${config.https ? "https" : "http"}://${config.host}:${config.port}`, // http://0.0.0.0:3100
	"process.pid"  : process.pid, // 72073
	serverStarted  : `${new Date().toString().split(" GMT")[0]} `, // Thu Sep 30 2021 17:04:35
};

// Methods to display directory
// console.log("0000000000000000000000000000000000000000");
// console.log("__dirname:    ", __dirname);
// console.log("process.cwd() : ", process.cwd());
// console.log("./ : ", path.resolve("./"));
// console.log("filename: ", __filename);
// console.log("0000000000000000000000000000000000000000");

// Change the relative paths in the configFile to be absolute paths. 
// config.htmlPath    = `${path.join(path.resolve("./"), config.htmlPath)}`    ;
// config.dataPath    = `${path.join(path.resolve("./"), config.dataPath)}`    ;
// config.imagesPath  = `${path.join(path.resolve("./"), config.imagesPath)}`  ;
// config.scriptsPath = `${path.join(path.resolve("./"), config.scriptsPath)}` ;

module.exports = {
	config     :config,

	_version          : function(){ return "Version 2021-09-24"; }
};