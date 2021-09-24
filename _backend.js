/*jshint esversion: 6 */
// Libraries/frameworks from NPM.
const express         = require('express'); // npm install express
const app             = express();
const path            = require('path');
const fs              = require('fs');
const fkill           = require('fkill');

// Personal libraries/frameworks.
const timeIt = require('./timeIt.js');
const webApi = require('./webApi.js').webApi;
const config = require('./config.js').config;
const funcs  = require('./funcs.js').funcs;

// WEB UI - ROUTES
app.get('/getFilesJson'       , async (req, res) => {
	// console.log("\nroute: getFilesJson:", req.query);
	
	let returnValue;
	try{ returnValue = await webApi.getFilesJson(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }

	// The web UI does not need the "pages" within .content so remove them. 
	for(let key in returnValue.DocumentType){
		let rec = returnValue.DocumentType[key];

		// Save the only the first page. 
		if(!rec.extra._firstPageId){
			console.log("Adding missing rec.extra._firstPageId");
			rec.extra._firstPageId = rec.content.pages[0];
		}
		else{
			// console.log("Already exists: rec.extra._firstPageId");
		}

		// Delete the pages key. (~35% decrease in file size. The pages key will continue to be part of files.json but they won't be sent.)
		delete rec.content.pages;
	}

	// Should be JSON already.
	res.send(returnValue);
});
app.get('/getGlobalUsageStats', async (req, res) => {
	// console.log("\nroute: getGlobalUsageStats:", req.query);
	
	// let stamp = timeIt.stamp("route: getGlobalUsageStats", null);
	let returnValue;
	try{ returnValue = await webApi.getGlobalUsageStats(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }

	// Should be JSON already.
	res.send(returnValue);
});
app.get('/getSvgs'            , async (req, res) => {
	let returnValue;
	let arg1 = req.query.notebookId;
	let arg2 = req.query.notebookTemplatesAs;
	let arg3 = req.query.notebookPagesAs;

	try{ returnValue = await webApi.getSvgs(arg1, arg2, arg3); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }

	// Should be JSON already.
	res.send(returnValue);
});
app.get('/getSvgs2'           , async (req, res) => {
	let returnValue;
	let arg1 = req.query.notebookId;
	let arg2 = req.query.notebookTemplatesAs;
	let arg3 = req.query.notebookPagesAs;

	try{ returnValue = await webApi.getSvgs2(arg1, arg2, arg3); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }

	// Should be JSON already.
	res.send(returnValue);
});
app.get('/getThumbnails'      , async (req, res) => {
	let returnValue;
	try{ returnValue = await webApi.getThumbnails(req.query.parentId, req.query.thumbnailPagesAs); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }

	// Should be JSON already.
	res.send(returnValue);
});
app.get('/getSettings'        , async (req, res) => {
	// Get the file.
	let settings;

	if(config.environment != "local"){ 
		try{ settings = fs.readFileSync(config.htmlPath + "/settingsDEMO.json"); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	}
	else{
		try{ settings = fs.readFileSync(config.htmlPath + "/settings.json"); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	}
	
	// Add the environment value. 
	settings = JSON.parse(settings);
	settings.environment = config.environment;
	settings = JSON.stringify(settings, null, 1);

	// Should be JSON already.
	res.send(settings);
});
app.post('/updateSettings'    ,express.json(), async (req, res) => {
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version."),null,0); 
		return; 
	}

	// Write the new file. 
	fs.writeFileSync(config.htmlPath + "/settings.json", JSON.stringify(req.body,null,1) );

	// Return the response.
	res.json("updated");
});

// WEB UI - ROUTES (local only)
app.get('/updateAll2'             , async (req, res) => {
	console.log("\nroute: updateAll2:", req.query);
	
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version."),null,0); 
		return; 
	}

	try{ 
		returnValue = await webApi.updateAll2( { req: req, res: res, interface: req.query.interface } ); 
		// returnValue = await updateAll2.updateAll2( { req: req, res: res, interface: req.query.interface } ); 
	} 
	catch(e){
		// ?
	}

	// No return response here. It is handled by webApi.updateAll2 instead. 
});
app.get('/debug/updateRemoteDemo' , async (req, res) => {
	console.log("/debug/updateRemoteDemo");
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version."),null,0); 
		return; 
	}
	
	// First, get the data.
	let timeItIndex = timeIt.stamp("route: updateRemoteDemo", null);
	let returnValue;
	try{ returnValue = await funcs.updateRemoteDemo(); } catch(e){ console.log("ERROR: funcs.updateRemoteDemo: ", e); res.send(JSON.stringify(e)); return; }
	returnValue = returnValue;
	timeIt.stamp("route: updateRemoteDemo", timeItIndex);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	res.send(returnValue);
});

// START THE SERVER.
(async () => {
	// Make sure the process on the server port is removed before trying to listen on that port. 
	try { 
		await fkill(`:${config.port}`); 
		console.log(`Process using tcp port ${config.port} REMOVED`); 
	} 
	catch(e){ 
		// console.log(`Process using tcp port ${config.port} does not exist.`); 
	} 

	app.listen(
		{
			port       : config.port, // port <number>
			host       : config.host, // host <string>
			// path       : ""   , // path        <string>      Will be ignored if port is specified. See Identifying paths for IPC connections.
			// backlog    : 0    , // backlog     <number>      Common parameter of server.listen() functions.
			// exclusive  : false, // exclusive   <boolean>     Default: false
			// readableAll: false, // readableAll <boolean>     For IPC servers makes the pipe readable for all users. Default: false.
			// writableAll: false, // writableAll <boolean>     For IPC servers makes the pipe writable for all users. Default: false.
			// ipv6Only   : false, // ipv6Only    <boolean>     For TCP servers, setting ipv6Only to true will disable dual-stack support, i.e., binding to host :: won't make 0.0.0.0 be bound. Default: false.
			// signal     : null , // signal      <AbortSignal> An AbortSignal that may be used to close a listening server.	
		}, 
		function() {
			// Set virtual paths.
			app.use('/'                  , express.static(config.htmlPath));
			app.use('/node_modules'      , express.static( path.join(__dirname, 'node_modules') ));
			app.use('/DEVICE_DATA'       , express.static(path.join(__dirname, 'DEVICE_DATA')));
			app.use('/DEVICE_DATA_IMAGES', express.static(path.join(__dirname, 'DEVICE_DATA_IMAGES')));
	
			// app.use(express.json());
			// app.use(express.urlencoded({ extended: true }));
	
			process.once('SIGUSR2', function () {
				console.log("====== SIGUSR2 ======", process.pid);
				process.kill(process.pid, 'SIGUSR2');
			});
			
			process.once('SIGINT', function () {
				// this is only called on ctrl+c, not restart
				console.log("====== SIGINT ======", process.pid);
				process.kill(process.pid, 'SIGINT');
			});
	
			//
			console.log("");
			console.log("*************** APP INFO ***************");
			console.log(`CONFIGURATION: ${JSON.stringify(config,null,1)}`);
			console.log(`App listening at http://${config.host}:${config.port}`);
			console.log("SERVER STARTED:", `${new Date().toString().split(" GMT")[0]} `) ;
			console.log("*************** APP INFO ***************");
			console.log("");
		}
	);
})();
