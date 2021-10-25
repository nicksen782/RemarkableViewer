/*jshint esversion: 6 */
// Libraries/frameworks from NPM.
const express         = require('express'); // npm install express
const app             = express();
const path            = require('path');
const fs              = require('fs');
const fkill           = require('fkill');
// const { performance } = require('perf_hooks');

// Personal libraries/frameworks.
const webApi           = require('./modules/webApi.js').webApi;
const config           = require('./modules/config.js').config;
const funcs            = require('./modules/funcs.js').funcs;
const updateFromDevice = require('./modules/updateFromDevice.js');
const pdfConversions   = require('./modules/pdfConversions.js');
const sse              = require('./modules/sse.js').sse;

// WEB UI - FULL SSE.

// fullSSE
app.get('/fullSSE'       , async (req, res) => {
	console.log("\nroute: fullSSE:", req.query);
	
	// FOR DEBUG.
	// fs.unlinkSync( config.filesjson );

	let returnValue;
	try{ 
		// Call with false so that we do not get the full version of files.json.
		sse.start({req:req, res:res});

		let counter = 0; 
		let intervalId = setInterval(function(){
			if(sse.isActive){
				if(counter < 25){
					console.log("Sending message!", counter);
					sse.write("Current value is: " + counter);
					counter+=1;
				}
				else{
					console.log("Done!");
					sse.end();
					clearInterval(intervalId);
				}
			}
			else{
				console.log("CONNECTION WAS CLOSED EARLY.");
				// sse.end();
				clearInterval(intervalId);
			}
		}, 500);
	} 
	catch(e){ 
		console.trace("ERROR: /fullSSE:", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}
	
});	

// WEB UI - ROUTES
app.get('/getFilesJson'       , async (req, res) => {
	// console.log("\nroute: getFilesJson:", req.query);
	
	// FOR DEBUG.
	// fs.unlinkSync( config.filesjson );

	let returnValue;
	try{ 
		// Call with false so that we do not get the full version of files.json.
		returnValue = await funcs.getExistingJsonFsData(false).catch(function(e) { throw e; });
	} 
	catch(e){ 
		console.trace("ERROR: /getFilesJson:", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}
	
	// Should be JSON already.
	res.send(returnValue);
});

app.get('/getGlobalUsageStats', async (req, res) => {
	// console.log("\nroute: getGlobalUsageStats:", req.query);
	
	let returnValue;
	try{ 
		returnValue = await webApi.getGlobalUsageStats().catch(function(e) { throw e; }); 
	}
	catch(e){ 
		console.trace("ERROR: /getGlobalUsageStats:", e); 
		res.send(JSON.stringify(e));
		return; 
	}

	// Should be JSON already.
	res.send(returnValue);
});

app.get('/getSvgs'            , async (req, res) => {
	let returnValue;
	let arg1 = req.query.documentId;

	try{ 
		returnValue = await webApi.getSvgs(arg1).catch(function(e) { throw e; }); 
	} 
	catch(e){ 
		console.trace("ERROR: /getSvgs:", e); 
		res.send(JSON.stringify(e));
		return; 
	}

	// Should be JSON already.
	res.send(returnValue);
});

app.get('/getThumbnails'      , async (req, res) => {
	let returnValue;
	try{ 
		returnValue = await webApi.getThumbnails(req.query.parentId).catch(function(e) { throw e; }); 
	} 
	catch(e){ 
		console.trace("ERROR: /getThumbnails:", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}

	// Should be JSON already.
	res.send(returnValue);
});

app.get('/getSettings'        , async (req, res) => {
	// Get the file.
	let settings;

	// Get the local version settings.
	if(config.environment == "local"){ 
		try{ 
			settings = fs.readFileSync(config.local_clientSettings); 
		} 
		catch(e){ 
			console.trace("ERROR: /getSettings:", e); 
			res.send(JSON.stringify(e)); 
			return; 
		}
	}
	// Get the demo version settings.
	else{
		try{ 
			settings = fs.readFileSync(config.demo_clientSettings); 
		} 
		catch(e){ 
			console.trace("ERROR: /getSettings:", e); 
			res.send(JSON.stringify(e)); 
			return; 
		}
	}
	
	// Add the environment value. 
	settings = JSON.parse(settings);
	settings.environment = config.environment;
	// settings.environment = "local";
	// settings.environment = "demo";
	settings = JSON.stringify(settings, null, 1);

	// Should be JSON already.
	res.send(settings);
});

app.post('/updateSettings'    ,express.json(), async (req, res) => {
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version.",null,0)); 
		return; 
	}

	// Write the new file. 
	try{
		fs.writeFileSync(config.local_clientSettings, JSON.stringify(req.body,null,1) );
	}
	catch(e){ 
		console.trace("ERROR: /updateSettings:", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}

	// Return the response.
	// console.log("Settings have been updated.");
	res.json("Settings have been updated.");
});

// WEB UI - ROUTES (local only)
app.get('/updateFromDevice'         , async (req, res) => {
	console.log("\nroute: updateFromDevice:", req.query);
	
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version.",null,0)); 
		return; 
	}

	let options = {
		interface : req.query.interface , 
	};
	
	try{ 
		returnValue = await webApi.updateFromDevice( { req: req, res: res, options } ).catch(function(e) { throw e; }); 
	} 
	catch(e){
		console.trace("ERROR: /updateFromDevice:", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}

	// Return the response.
	res.json("Templates have been updated");
});

app.get('/updateFromDeviceTemplates', async (req, res) => {
	// console.log("\nroute: updateFromDeviceTemplates:", req.query);
	
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version.",null,0)); 
		return; 
	}

	try{ 
		returnValue = await webApi.updateFromDeviceTemplates(req.query.interface).catch(function(e) { throw e; }); 
		// returnValue = await webApi.updateFromDeviceTemplates().catch(e => {throw e;} ); 
	} 
	catch(e){
		console.trace("ERROR: /updateFromDeviceTemplates:", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}
	
	// No return response here. It is handled by webApi.updateFromDevice instead. 
	res.send(JSON.stringify(returnValue)); 
});

app.get('/debug/rebuildDeviceImages', async (req, res) => {
	// console.log("\nroute: rebuildServerStorage2:", req.query);
	
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version.",null,0)); 
		return; 
	}

	// Fix the query string values to be boolean.
	req.query.pdf            = req.query.pdf            == "true" ? true : false;
	req.query.pdfAnnotations = req.query.pdfAnnotations == "true" ? true : false;
	req.query.rmtosvg        = req.query.rmtosvg        == "true" ? true : false;
	req.query.optimizesvg    = req.query.optimizesvg    == "true" ? true : false;
	req.query.fromList       = req.query.fromList                 ? true : false;

	// If fromList is set then make sure that listItems exists, even if empty.
	if(req.query.fromList && !req.query.listItems){ req.query.listItems = []; }

	// console.log("\nroute: rebuildServerStorage2:\nreq.query:\n" + JSON.stringify(req.query,null,1));

	// Make sure at least one of the required arguments are true.
	if(!req.query.pdf && !req.query.pdfAnnotations && !req.query.rmtosvg &&!req.query.optimizesvg){
		let msg = "ERROR: Invalid arguments: debug/rebuildServerStorage:\nreq.query:" + JSON.stringify(req.query,null,1);
		console.log(msg);
		res.send(msg);
		return; 
	}

	webApi.rebuildDeviceImages({
		pdf           : req.query.pdf,
		pdfAnnotations: req.query.pdfAnnotations,
		rmtosvg       : req.query.rmtosvg,
		optimizesvg   : req.query.optimizesvg,
		fromList      : req.query.fromList,
		listItems     : req.query.listItems,
	});

	// console.log( JSON.stringify(req.query,null,1), req.query.listItems.length );
	res.send("DONE");
	return; 

	res.send("***** DONE *****");
	
	// 	try{ 
	// 		// console.log("Working on:", changeRec.rec.metadata.visibleName);
	// 		if( fs.existsSync(dirPath + "pages/") ){
	// 			// console.log("Removing:", dirPath + "pages/");
	// 			fs.rmdirSync(dirPath + "pages/", { recursive: true }); 
	// 			// console.log("Removed :", dirPath + "pages/");
	// 		}
	// 	} 
	// 	catch(e){
	// 		console.trace("ERROR: /rebuildServerStorage2:", e); 
	// 		res.send(JSON.stringify(e)); 
	// 		return; 
	// 	}
	// }

	// No return response here. It is handled by webApi.updateFromDevice instead. 
});

app.get('/debug/updateRemoteDemo'   , async (req, res) => {
	console.log("/debug/updateRemoteDemo");
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version.",null,0)); 
		return; 
	}
	
	// First, get the data.
	let returnValue;
	try{ 
		returnValue = await funcs.updateRemoteDemo().catch(function(e) { throw e; });
	} 
	catch(e){ 
		console.trace("ERROR: /debug/updateRemoteDemo: ", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}

	res.send(returnValue);
});

app.get('/debug/metadata_unsync'    , async (req, res) => {
	console.log("/debug/metadata_unsync");
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version.",null,0)); 
		return; 
	}
	
	// First, get the data.
	let returnValue;
	try{ 
		returnValue = await funcs.metadata_unsync().catch(function(e) { throw e; });
	} 
	catch(e){ 
		console.trace("ERROR: /debug/metadata_unsync: ", e); 
		res.send(JSON.stringify(e)); 
		console.log("error!", JSON.stringify(e));
		return; 
	}

	res.send(returnValue);
	console.log("DONE!");
});

app.get('/debug/getSite_config'     , async (req, res) => {
	// Get the file.
	let site_config;

	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version.",null,0)); 
		return; 
	}

	// Get the local version settings.
	try{ 
		site_config = fs.readFileSync("configFile.json"); 
	} 
	catch(e){ 
		console.trace("ERROR: /debug/getSite_config:", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}
	
	// Should be JSON already.
	res.send(site_config);
});

app.post('/debug/updateSite_config' ,express.json(), async (req, res) => {
	if(config.environment != "local"){ 
		console.log("Function is not available in the demo version."); 
		res.send(JSON.stringify("Function is not available in the demo version.",null,0)); 
		return; 
	}

	// Accepts JSON object, returns formatted JSON string. 
	const jsonFormatter = function(inputJsonObj){
		// Get max key length.
		let keys = Object.keys(inputJsonObj);
		let maxLen = 0;
		keys.forEach(function(key){
			if(key.length > maxLen) { maxLen = key.length; }
		});

		// Create the jsonString. 
		let jsonString = "";
		jsonString += "{\n";
		keys.forEach(function(key, key_i){
			let thisKey = `"${key}"${" ".repeat(maxLen-key.length)}`;
			
			// Determine the dataType of the value. 
			let thisValue;
			if(typeof inputJsonObj[key] == "boolean") { thisValue = `${inputJsonObj[key]}`; }
			else if(typeof inputJsonObj[key] == "number")  { thisValue = `${inputJsonObj[key]}`; }
			else{
				// Assume it is a string.
				thisValue = `"${inputJsonObj[key]}"`;
			}
			
			// Create the line. 
			jsonString += "\t" + `${thisKey} : ${thisValue}`;

			// Add a "," unless this is the last line. 
			if(key_i+1 != keys.length){ jsonString += ","; }

			// Move to the next line. 
			jsonString += "\n";
		});
		jsonString += "}\n";

		return jsonString;
	};

	// Format the JSON into a jsonString.
	let jsonString = jsonFormatter( req.body );

	// Write the new file. 
	try{
		fs.writeFileSync("configFile.json", jsonString );
	}
	catch(e){ 
		console.trace("ERROR: /debug/updateSite_config:", e); 
		res.send(JSON.stringify(e)); 
		return; 
	}

	// Return a response.
	// console.log(jsonString);
	res.json("Settings have been updated.");
});

// START THE SERVER.
(async function startServer() {
	// Make sure the process on the server port is removed before trying to listen on that port. 
	try { 
		// Remove process that is using the config.port. 
		await fkill(`:${config.port}`).catch(function(e) { throw e; }); 

		// Output message.
		let msg = `Process using tcp port ${config.port} has been REMOVED`;
		console.log("-".repeat(msg.length));
		console.log(msg); 
		console.log("-".repeat(msg.length));

		// Wait 2 seconds. 
		const sleep = function(ms){
			return new Promise((resolve) => {
				setTimeout(resolve, ms);
			});
		};
		await sleep(2000).catch(function(e) { throw e; }); 

		// Done.
		// console.log("done");
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
			app.use('/_debug_'           , express.static(config.debugPath));
			app.use('/node_modules'      , express.static( path.join(__dirname, 'node_modules') ));
			app.use('/DEVICE_DATA'       , express.static( path.join(__dirname, 'DEVICE_DATA') ));
			app.use('/DEVICE_DATA_IMAGES', express.static( path.join(__dirname, 'DEVICE_DATA_IMAGES') ));
	
			process.once('SIGUSR2', function () {
				console.log(`Removing process ${process.pid} due to SIGUSR2 (restart) signal from nodemon.`);
				process.kill(process.pid, 'SIGUSR2');
			});

			process.once('SIGINT', function () {
				// this is only called on ctrl+c, not restart
				console.log(`Removing process ${process.pid} due to SIGINT signal... (EX: CTRL+C)`);
				process.kill(process.pid, 'SIGINT');
			});

			let errors = function(type, error){
				console.log("");
				console.log("***************************");
				console.log(type, error);
				console.trace("BACKTRACE:");
				console.log("***************************");
				console.log("");
			};

			process.on('uncaughtException' , function(e){ errors("uncaughtException", e); });
			process.on('unhandledRejection', function(e){ errors("unhandledRejection", e); });
	
			// Display the server start message
			(function serverStartMessage(){
				// Format and display config/server data.
				let outputText = "";
				
				// Determine the max key length.
				let maxLength = 0; 
				for(let key in config)      { if(key == "extra"){ continue; } if(key.length > maxLength) { maxLength = key.length; } }
				for(let key in config.extra){ if(key.length > maxLength) { maxLength = key.length; } }
				

				// Display the keys/values in config (skip 'extra'.)
				outputText += `CONFIGURATION:\n`;
				for(let key in config){
					if(key == "extra"){ continue; }
					outputText += `  ${key.padEnd(maxLength, " ")} : ${config[key]}\n` ;
				}
	
				// Display the keys/values in config.extra.
				outputText += "\n";
				outputText += "SERVER:\n";
				let i=0;
				let extraKeysLength = Object.keys(config.extra).length; 
				for(let key in config.extra){
					outputText += `  ${key.padEnd(maxLength, " ")} : ${config.extra[key]}`;
					i += 1;
					if(i != extraKeysLength){ outputText += "\n"; }
				}
	
				// Find the longest line. 
				let longestLine = 0;
				outputText.split("\n").forEach(function(d){
					if(d.length > longestLine) { longestLine = d.length; }
				});
	
				// Create the separator.
				let heading   = "SERVER START";
				let starLen   =  (longestLine - heading.length - ((longestLine - heading.length) % 2) )/2;
				let separator = `${"*".repeat(starLen)} ${heading} ${"*".repeat(starLen)}`;
				
				// OUTPUT:
				console.log("\n");
				console.log(separator);
				console.log(outputText);
				console.log(separator);
				console.log("\n");
			})();

		}
	);
})();