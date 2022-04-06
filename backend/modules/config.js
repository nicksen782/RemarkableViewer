const fs = require('fs');
// const path = require('path');

let _APP = null;

let _MOD = {
	// Internal config
	configFilename: "configFile.json",
	config: {},
	configExtra: {},
	
	// Init this module.
	module_init: async function(parent){
		// Save reference to ledger.
		_APP = parent;
		
		// Add routes.
		_MOD.addRoutes(_APP.app, _APP.express);
		
		// Get the config file. 
		await _MOD.getFromFile();

		// Add extra.
		_MOD.configExtra["serverFilePath"] = process.cwd() 
		_MOD.configExtra["webServer"]      = `${_MOD.config.https ? "https" : "http"}://${_MOD.config.host}:${_MOD.config.port}`; // http://0.0.0.0:3100 ;
		_MOD.configExtra["process.ppid"]   = process.ppid ;
		_MOD.configExtra["process.pid" ]   = process.pid;
		_MOD.configExtra["serverStarted"]  = `${new Date().toString().split(" GMT")[0]} `; // Thu Sep 30 2021 17:04:35
	},

	// Adds routes for this module.
	addRoutes: function(app, express){
		// 
		_APP.addToRouteList({ path: "/getSettings", method: "get", args: [], file: __filename, desc: "Outputs a list of manually registered routes." });
		app.get('/getSettings'    ,express.json(), async (req, res) => {
			let settings; 
			let envCheck = _APP.m_funcs.environmentCheck1();

			if(!envCheck.allowed){ 
				settings = JSON.parse( fs.readFileSync(_APP.m_config.config.demo_clientSettings) ); 
			}
			else{
				settings = fs.readFileSync(_APP.m_config.config.local_clientSettings); 
			}
			settings = JSON.parse(settings);
			settings.environment = _APP.m_config.config.environment;
			res.json(settings);
		});
		
		// 
		_APP.addToRouteList({ path: "/updateSettings", method: "post", args: [], file: __filename, desc: "Outputs a list of manually registered routes." });
		app.post('/updateSettings'    ,express.json(), async (req, res) => {
			let envCheck = _APP.m_funcs.environmentCheck1();
			if(!envCheck.allowed){ res.send(JSON.stringify(envCheck.msg,null,0)); return; }

			fs.writeFileSync(_APP.m_config.config.local_clientSettings, JSON.stringify(req.body,null,1) );
			fs.existsSync(_APP.m_config.config.local_clientSettings);
			res.json(`Client settings have been updated.`);
		});
	},

	// 
	getFromFile : function(){
		return new Promise(function(resolve,reject){
			// Get it. 
			let config = JSON.parse( fs.readFileSync(_MOD.configFilename, 'utf8'));
			
			// Update ram copy.
			_MOD.updateRam(config);
		
			// 
			resolve();
		});
	},

	// 
	getFromRam : async function(){
		// Return ram copy.
		return _MOD.config;
	},

	// 
	updateRam : async function(json){
		// Update ram copy.
		_MOD.config = json;
	},

	// 
	updateFile : async function(newJson=_MOD.config){
		// Use ram-copy or provided json to update the file.

		// Update the file. 
		fs.writeFileSync(_MOD.configFilename, JSON.stringify(newJson, null,1));
	},

};

module.exports = _MOD;
