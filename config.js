const fs              = require('fs');

var config = JSON.parse(fs.readFileSync('configFile.json', 'utf8'));
// const port        = config.port;
// const host        = config.host;
// const scriptsPath = config.scriptsPath;
// const dataPath    = config.dataPath;
// const imagesPath  = config.imagesPath;
// const htmlPath    = config.htmlPath;

module.exports = {
	config     :config,

	// port       :port,
	// host       :host,
	// scriptsPath:scriptsPath,
	// dataPath   :dataPath,
	// imagesPath :imagesPath,
	// htmlPath   :htmlPath,

	_version          : function(){ return "Version 2021-09-23"; }
};