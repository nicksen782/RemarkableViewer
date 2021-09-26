const fs = require('fs');
const path = require('path');

const config = JSON.parse(fs.readFileSync('configFile.json', 'utf8'));

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