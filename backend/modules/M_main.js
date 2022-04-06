const path            = require('path');
const fs              = require('fs');

// /home/pi/http/node_sites/RemarkableViewer

const m_webApi           = require('./webApi.js');
const m_config           = require('./config.js');
const m_funcs            = require('./funcs.js');
const m_updateFromDevice = require('./updateFromDevice.js');
const m_debug            = require('./debug.js');
const m_pdfConversions   = require('./pdfConversions.js');

let _APP = {
	// Express variables.
	app    : null,
	express: null,

	// Manual route list. (Emulates something like route annotations.)
	routeList: {}, 

	// MODULES (_APP will have access to all the modules.)
	m_config           : m_config ,
	m_webApi           : m_webApi ,
	m_funcs            : m_funcs ,
	m_updateFromDevice : m_updateFromDevice ,
	m_pdfConversions   : m_pdfConversions ,
	m_debug            : m_debug ,
	
	// Init this module.
	module_init: function(parent){
		// Save reference to _APP.
		// _APP = parent;
	
		// Add routes.
		_APP.addRoutes(_APP.app, _APP.express);
	},

	// Adds routes for this module.
	addRoutes: function(app, express){
		// Outputs a list of registered routes.
		_APP.addToRouteList({ path: "/getRoutePaths", method: "get", args: ['type'], file: __filename, desc: "Outputs a list of manually registered routes." });
		app.get('/getRoutePaths'    ,express.json(), async (req, res) => {
			let envCheck = _APP.m_funcs.environmentCheck1();
			if(!envCheck.allowed){ res.send(JSON.stringify(envCheck.msg,null,0)); return; }
			
			let resp = _APP.getRoutePaths(req.query.type, app); 
			res.json(resp);
		});
	},
	
	// Add the _APP object to each required object.
	module_inits: async function(){
		return new Promise(async function(resolve,reject){
			await _APP                   .module_init(_APP);
			await _APP.m_config          .module_init(_APP);
			await _APP.m_webApi          .module_init(_APP);
			await _APP.m_funcs           .module_init(_APP);
			await _APP.m_updateFromDevice.module_init(_APP);
			await _APP.m_pdfConversions  .module_init(_APP);
			await _APP.m_debug           .module_init(_APP);
			resolve();
		});
	},

	// ROUTED: Outputs a list of registered routes.
	getRoutePaths : function(type="manual", app){
		let routes = app._router.stack.filter(r => r.route).map(r => r.route).map(function(r){
			let methods = [];
			for(let m in r.methods){
				methods.push(m);
			}
			return {
				method: methods.join(" "),
				path: r.path,
			};
		});

		switch(type){
			case "manual" : 
				return {
					manual: _APP.routeList,
				};
				break; 

			case "express": 
				return {
					express: routes,
				};
				break; 

			case "both"   : 
				// TODO: unmatched
				return {
					manual   : _APP.routeList,
					express : routes,
					unmatched: [],
				};
				break; 

			default: break; 
		}

		if(type=="manual"){
		}
	},

	// Adds a manual route entry to the routeList.
	addToRouteList : function(obj){
		let file = path.basename(obj.file);
		if(!_APP.routeList[file]){ _APP.routeList[file] = []; }
		_APP.routeList[file].push({
			path  : obj.path, 
			method: obj.method, 
			args  : obj.args,
			desc  : obj.desc,
		});
	},

};

// Save app and express to _APP and then return _APP.
module.exports = function(app, express){
	_APP.app     = app;
	_APP.express = express;
	return _APP;
};