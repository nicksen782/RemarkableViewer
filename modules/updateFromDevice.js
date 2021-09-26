const { spawn }       = require('child_process');
const fs              = require('fs');
const path            = require('path');
var PDFImage          = require("pdf-image").PDFImage;
const async_mapLimit  = require('promise-async').mapLimit;
const { performance } = require('perf_hooks');

const timeIt = require('./timeIt.js');
const webApi = require('./webApi.js').webApi; // Circular reference? 
const funcs  = require('./funcs.js').funcs;
const config = require('./config.js').config;

const sleep = function(ms){
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

const rsyncDown                      = function(interface){
	return new Promise(async function(resolve_sync, reject_sync){
		// Runs a command with support for SSE updates.
		const runCmd = function(cmd, progress=true, expectedExitCode=0){
			return new Promise(function(runCmd_res, runCmd_rej){
				// Create the child process.
				const child = spawn(cmd, { shell: true });
		
				// Set both stdout and stderr to use utf8 encoding (required for SSE.)
				child.stdout.setEncoding('utf8');
				child.stderr.setEncoding('utf8');
		
				// Event listener for updates on stdout. 
				child.stdout.on('data', (data) => {
					// Trim the data.
					data = data.toString().trim();

					// If progress is specified then output the progress.
					if(progress && data != ""){ console.log(`O: ${ data }`); }

					// Output SSE.
					sse.write(data);
				});
				
				// Event listener for updates on stderr. 
				child.stderr.on('data', (data) => {
					// Trim the data. 
					data = data.toString().trim();

					// If progress is specified then output the progress.
					if(progress && data != ""){ console.log(`E: ${ data }`); }
					
					// Output SSE.
					sse.write(data);
				});
		
				// Event listener for the completed command. 
				child.on('exit', (code) => {
					// Exited as expected?
					if(code == expectedExitCode){ 
						// Generate the message. 
						let msg = "runCmd: COMPLETE " + code;
						
						// If progress is specified then output the progress.
						if(progress){ 
							console.log(msg); 
						}
		
						// Output SSE.
						sse.write(msg);
						
						// Resolve.
						runCmd_res(msg); 
					}

					// Exited with unexpected exit code.
					else{
						// Generate the message. 
						let msg = `runCmd: ERROR: Child process was expected to exit with code ${expectedExitCode} but exited with code: ${code} instead.`;
						
						// If progress is specified then output the progress.
						if(progress){ 
							console.log(msg); 
						}

						// Output SSE.
						sse.write(msg);
		
						// Reject.
						runCmd_rej(msg);
					}
				});
		
			});
		};

		// Make sure the interface is correct.
		if( ["wifi", "usb"].indexOf(interface) == -1 ) {
			let msg = "ERROR: Invalid 'interface'";
			reject_sync( msg );
			return;
		}

		// Send the command. 
		let cmd = `cd ${path.join(path.resolve("./"), "scripts")} && ./syncRunner.sh tolocal ${interface}`;
		let resp;
		try{ 
			resp = await runCmd(cmd, true, 0); 
		} 
		catch(e){ 
			// console.log("ERROR:sync:", e); 
			reject_sync(e); 
			return;
		}

		// Resolve.
		resolve_sync(resp);
	});
};

const sse = {
	// References to the req and res of the connection. 
	req: {},
	res: {},
	
	// START SSE.
	start: async function(obj){
		
		// Break out the properties of the object into variables. 
		let { req, res } = obj;
		sse.req = req;
		sse.res = res;
		
		// START THE SSE STREAM.
		res.writeHead(200, { 
			"Content-Type": "text/event-stream",
			// 'Connection': 'keep-alive',
			"Cache-control": "no-cache" 
		});

		sse.write("START SSE");
	},
	
	// WRITE SSE.
	write: function(data){
		// JSON stringify the recieved data.
		data = JSON.stringify(data);

		// Send this message right now. 
		sse.res.write(`data: ${data}\n\n`);
		// console.log(`data: ${data}\n\n`.trim());
	},
	
	// END SSE.
	end: function(data=null){
		// END THE SSE STREAM.
		let endString = "==--ENDOFDATA--==";
		
		// Was there a final message? If so, send it.
		if(data){
			sse.write(data);
		}

		// Send the message.
		sse.write(endString);

		// End the stream.
		sse.res.end();
	},
};

const updateFromDevice = function(obj){
	return new Promise(async function(res_top, rej_top){
		// Break out the properties of the object into variables. 
		let { req, res } = obj;
		let { interface, doSync, doConversions, doOptimization } = obj.options;

		// Shared function to handle rejections. 
		const rejectionFunction = function(title, e){
			console.log(`ERROR in ${title}: ${e}`); 
				
			// Return the rejection error.
			sse.write(e);

			// END THE SSE STREAM.
			sse.end();

			// REJECT AND RETURN.
			rej_top(e); 
		};

		// START SSE.
		sse.start(obj);
		
		// Rsync.
		if(doSync){
			sse.write("START RSYNC");
			try{ 
				await rsyncDown( interface ); 
			} 
			catch(e){ 
				rejectionFunction("RSYNC", e);
				return; 
			}
			sse.write("END RSYNC");
		}

		// .rm to .svg and .pdf to .png.
		if(doConversions){
			sse.write("START CONVERSIONS");
			try{ 
				// await sync( obj ); 
			} 
			catch(e){ 
				rejectionFunction("CONVERSIONS", e);
				return; 
			}
			sse.write("END CONVERSIONS");
		}

		// .svg optimize.
		if(doOptimization){
			sse.write("START OPTIMIZATION");
			try{ 
				// await sync( obj ); 
				// throw "ERROR: Missing optimization function.";
			} 
			catch(e){ 
				rejectionFunction("OPTIMIZATION", e);
				return; 
			}
			sse.write("END OPTIMIZATION");
		}

		let msg = "COMPLETE: run: " + `interface: ${interface}, doSync: ${doSync}, doConversions: ${doConversions}, doOptimization: ${doOptimization}`;
		sse.end( msg );
		console.log(msg);
	});
};

module.exports = {
	updateFromDevice: updateFromDevice,
	_version  : function(){ return "Version 2021-09-23"; }
};