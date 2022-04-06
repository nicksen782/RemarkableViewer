/*jshint esversion: 6 */
// Libraries/frameworks from NPM.
const express         = require('express'); // npm install express
const app             = express();
const path            = require('path');
const fs              = require('fs');

// Personal libraries/frameworks.
const _APP            = require('./backend/modules/M_main.js')(app, express);

// ????
app.get('/fullSSE'       , async (req, res) => {
	console.log("\nroute: fullSSE:", req.query);
	
	// FOR DEBUG.
	// fs.unlinkSync( _APP.m_config.config.filesjson );

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

// START THE SERVER.
(async function startServer() {
	// Init the modules.
	await _APP.module_inits(); 
			
	// 
	let config      = _APP.m_config.config;
	let configExtra = _APP.m_config.configExtra;

	app.listen(
		{
			port       : _APP.m_config.config.port, // port <number>
			host       : _APP.m_config.config.host, // host <string>
			// path       : ""   , // path        <string>      Will be ignored if port is specified. See Identifying paths for IPC connections.
			// backlog    : 0    , // backlog     <number>      Common parameter of server.listen() functions.
			// exclusive  : false, // exclusive   <boolean>     Default: false
			// readableAll: false, // readableAll <boolean>     For IPC servers makes the pipe readable for all users. Default: false.
			// writableAll: false, // writableAll <boolean>     For IPC servers makes the pipe writable for all users. Default: false.
			// ipv6Only   : false, // ipv6Only    <boolean>     For TCP servers, setting ipv6Only to true will disable dual-stack support, i.e., binding to host :: won't make 0.0.0.0 be bound. Default: false.
			// signal     : null , // signal      <AbortSignal> An AbortSignal that may be used to close a listening server.	
		}, 
		async function() {
			// Set process name.
			process.title = "RMViewer";

			// Set virtual paths.
			app.use('/'                  , express.static(_APP.m_config.config.htmlPath));
			app.use('/_debug_'           , express.static(_APP.m_config.config.debugPath));
			app.use('/node_modules'      , express.static( path.join(__dirname, 'node_modules') ));
			app.use('/DEVICE_DATA'       , express.static( path.join(__dirname, 'DEVICE_DATA') ));
			app.use('/DEVICE_DATA_IMAGES', express.static( path.join(__dirname, 'DEVICE_DATA_IMAGES') ));
	
			// process.once('SIGUSR2', function () {
			// 	console.log("SIGUSR2");
			// 	// console.log(`Removing process ${process.pid} due to SIGUSR2 (restart) signal from nodemon.`);
			// 	// process.kill(process.pid, 'SIGUSR2');
			// });
			
			// process.once('SIGINT', function () {
			// 	console.log("SIGINT");
			// 	// this is only called on ctrl+c, not restart
			// 	// console.log(`Removing process ${process.pid} due to SIGINT signal... (EX: CTRL+C)`);
			// 	// process.kill(process.pid, 'SIGINT');
			// });

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
				for(let key in configExtra){ if(key.length > maxLength) { maxLength = key.length; } }
				

				// Display the keys/values in config (skip 'extra'.)
				outputText += `CONFIGURATION:\n`;
				for(let key in config){
					if(key == "extra"){ continue; }
					outputText += `  ${key.padEnd(maxLength, " ")} : ${config[key]}\n` ;
				}
	
				// Display the keys/values in configExtra.
				outputText += "\n";
				outputText += "SERVER:\n";
				let i=0;
				let extraKeysLength = Object.keys(configExtra).length; 
				for(let key in configExtra){
					outputText += `  ${key.padEnd(maxLength, " ")} : ${configExtra[key]}`;
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