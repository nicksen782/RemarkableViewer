const { spawn }                 = require('child_process');
const fs                        = require('fs');
const path                      = require('path');
const PDFImage                  = require("pdf-image").PDFImage;
const async_mapLimit            = require('promise-async').mapLimit;
const { performance }           = require('perf_hooks');
const { optimize, loadConfig  } = require('svgo');
// let svgo_config;

const timeIt = require('./timeIt.js');
// const webApi = require('./webApi.js').webApi; // Circular reference? 
const funcs  = require('./funcs.js').funcs;
const config = require('./config.js').config;
const pdfConvert = require('./pdfConversions.js').pdfConvert;

// Server-Sent-Events.
const sse                = {
	// References to the req and res of the connection. 
	req: {},
	res: {},
	isActive: false,
	
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

		sse.isActive = true; 
	},
	
	// WRITE SSE.
	write: function(data){
		// JSON stringify the recieved data.
		data = JSON.stringify(data);

		// Send this message right now. 
		if(sse.isActive){
			sse.res.write(`data: ${data}\n\n`);
		}
		else{
			// console.log(`SSE NOT ACTIVE: ${data}`.trim());
			// console.log(`${data}`.trim());
		}
	},
	
	// END SSE.
	end: function(data=null){
		if(sse.isActive){
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

			//
			sse.isActive = false;
		}
		else{
			console.trace("SSE stream has already ended.");
			sse.write(data);
		}
	},
};

const parseChanges = async function(rmChanges){
	return new Promise(async function(res_parseChanges, rej_parseChanges){
		let changes = [];
		
		// Generate new files.json data (don't save yet.)
		new_filesjson = await funcs.createJsonFsData(false).catch(function(e) { throw e; }); 
		
		// Get epub ids. (Any file related to an epub file id.)
		let epubIds = [];
		rmChanges.forEach(function(d){
			if(d.lastIndexOf(".epubindex") != -1 || d.lastIndexOf(".epub") != -1) {
				// Found an epub file. Get the file id.
				let splits = d.split("/");
				let file = splits[1];
				let id = file.split(".")[0];

				// Add the epubindex file id to epubIds if it isn't already there. 
				if(epubIds.indexOf(id) == -1){ epubIds.push(id); }
			}
		});

		// Filter out all epub related files by using the epubIds list.
		let temp_rmChanges = [];
		rmChanges.forEach(function(d){
			// Skip any file that contains ".epubindex" or ".epub".
			if(d.lastIndexOf(".epubindex") != -1 || d.lastIndexOf(".epub") != -1) {
				// console.log("Skipping epub/epubindex", d);
				return; 
			}

			// pdf file.
			else if(d.lastIndexOf(".pdf") != -1){
				let splits = d.split("/");
				docId   = splits[1].replace(/.pdf/, "");
				
				// Make sure this file id is not within epubIds.
				if(epubIds.indexOf(docId) == -1){ 
					// console.log("pdf: Adding record: ", d);
					temp_rmChanges.push(d); 
				}
				else{
					// Skip record (don't add it.)
					// console.log("pdf: Skipping record: ", d);
				}
			}

			// rm file. 
			else if(d.lastIndexOf(".rm") != -1){
				let splits = d.split("/");
				docId   = splits[1];

				// Make sure this file id is not within epubIds.
				if(epubIds.indexOf(docId) == -1){ 
					// console.log("rm: Adding record: ", d);
					temp_rmChanges.push(d); 
				}
				else{
					// Skip record (don't add it.)
					// console.log("rm: Skipping record: ", d);
				}
			}
		});

		// Update rmChanges with our new filtered list. 
		rmChanges = temp_rmChanges;

		// Create the changes array of objects.
		rmChanges.forEach(function(d,i){
			// if(i<5){ console.log(d); }
			let ext;
			let docId;
			let destFile;
			let destFile2;
			let rec = {};
			let pageFile;
			let changeType;
			
			if(d.lastIndexOf(".pdf") != -1){ 
				// Determine the changeType.
				if(d.indexOf("deleting ") == 0){ d = d.split("deleted ")[1]; changeType = "deleted"; }
				else{ changeType = "updated"; }

				ext = "pdf";
				let splits = d.split("/");
				docId     = splits[1].replace(/.pdf/, "");
				srcFile   = config.dataPath + splits[1];
				rec       = new_filesjson["DocumentType"][docId];
				destFile  = "";
				destFile2 = "";
				pageFile  = "";

			}
			else if(d.lastIndexOf(".rm") != -1) { 
				// Determine the changeType.
				if(d.indexOf("deleting ") == 0){ d = d.split("deleting ")[1]; changeType = "deleted"; }
				else{ changeType = "updated"; }

				ext = "rm";
				let splits = d.split("/");
				docId    = splits[1];
				srcFile  = config.dataPath + splits[1] + "/" + splits[2];
				rec      = new_filesjson["DocumentType"][docId];
				destFile = config.imagesPath + splits[1] + "/" + splits[2].split(".")[0] + ".svg";
				destFile2= config.imagesPath + splits[1] + "/" + splits[2].split(".")[0] + ".min.svg";
				pageFile = splits[2].split(".")[0];
			}
			else if(d.lastIndexOf(".epub") != -1) { 
				// Determine the changeType.
				// if(d.indexOf("deleting ") == 0){ d = d.split("deleted ")[1]; changeType = "deleted"; }
				// else{ changeType = "updated"; }

				// console.log("Skipping epub", d);
				return; 
			}
			else if(d.lastIndexOf(".epubindex") != -1) {
				// Determine the changeType.
				// if(d.indexOf("deleting ") == 0){ d = d.split("deleted ")[1]; changeType = "deleted"; }
				// else{ changeType = "updated"; }
				 
				// console.log("Skipping epubindex", d);
				return; 
			}

			// Add the object to the changes array.
			changes.push({
				ext       : ext       ,
				docId     : docId     ,
				srcFile   : srcFile   ,
				rec       : rec       ,
				destFile  : destFile  ,
				destFile2 : destFile2 ,
				pageFile  : pageFile  ,
				changeType: changeType, 
			});

		});

		// Resolve and return data.
		res_parseChanges(
			{
				changes      : changes, 
				new_filesjson: new_filesjson, 
			}
		);

	});
};

// Sync from device and determine changes. 
const rsyncDown          = function(interface){
	return new Promise(async function(resolve_sync, reject_sync){
		// Runs a command with support for SSE updates.
		const runCmd = function(cmd, progress=true, expectedExitCode=0){
			return new Promise(function(runCmd_res, runCmd_rej){
				// Create the child process.
				const child = spawn(cmd, { shell: true });
		
				// Set both stdout and stderr to use utf8 encoding (required for SSE.)
				child.stdout.setEncoding('utf8');
				child.stderr.setEncoding('utf8');

				let rmChanges = [];
				let diskFree_mmcblk2p1 = "";
				let diskFree_mmcblk2p4 = "";
				let diskFree_devroot = "";
		
				// Event listener for updates on stdout. 
				child.stdout.on('data', (data) => {
					// Trim the data.
					data = data.toString().trim();
					
					// Looking for lines containing ".rm"
					if(data.indexOf(".rm") != -1){
						let split = data.split("\n");
						split.forEach(function(d){
							if(d.indexOf(".rm") != -1){
								rmChanges.push(d);
							}
						});
					}

					// Looking for lines containing ".pdf"
					if(data.indexOf(".pdf") != -1){
						let split = data.split("\n");
						split.forEach(function(d){
							if(d.indexOf(".pdf") != -1){
								rmChanges.push(d);
							}
						});
					}

					// Looking for lines containing ".epub"
					if(data.indexOf(".epub") != -1){
						let split = data.split("\n");
						split.forEach(function(d){
							if(d.indexOf(".epub") != -1){
								rmChanges.push(d);
							}
						});
					}

					// Looking for lines containing "/dev/mmcblk2p1"
					if(data.indexOf("/dev/mmcblk2p1") != -1){
						diskFree_mmcblk2p1 = data;
					}

					// Looking for lines containing "/dev/mmcblk2p4"
					if(data.indexOf("/dev/mmcblk2p4") != -1){
						diskFree_mmcblk2p4 = data;
					}

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
						runCmd_res([
							msg, rmChanges, diskFree_mmcblk2p1, diskFree_mmcblk2p4, diskFree_devroot
						]); 
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
		if( ["WIFI", "USB"].indexOf(interface) == -1 ) {
			let msg = "ERROR: Invalid 'interface'";
			reject_sync( msg );
			return;
		}

		// Send the command. 
		let cmd = `cd ${path.join(path.resolve("./"), `${config.scriptsPath}`)} && ./syncRunner.sh tolocal ${interface}`;
		let resp;
		let diskFree;
		let diskFree_mmcblk2p1;
		let diskFree_mmcblk2p4;

		try{ 
			let rmChanges;

			// This file will exist if the program failed to finish.
			// If it exists then use it for changes and skip the rsync.
			if(fs.existsSync(config.rmChanges)){
				rmChanges = fs.readFileSync(config.rmChanges);
				rmChanges = JSON.parse(rmChanges);
			}

			// File didn't exist. Do a rsync.
			else{
				// run the sync command. 
				resp = await runCmd(cmd, false, 0).catch(function(e) { throw e; }); 

				// Get the changes. 
				rmChanges = resp[1];
				
				try{
					// Get the diskFree. 
					diskFree_mmcblk2p1 = resp[2];
					diskFree_mmcblk2p4 = resp[3];
					diskFree_mmcblk2p1 = diskFree_mmcblk2p1.replace(/\s+/g, " ").split(" ");
					diskFree_mmcblk2p4 = diskFree_mmcblk2p4.replace(/\s+/g, " ").split(" ");

					diskFree = {
						"diskFree_mmcblk2p1" : {
							"Filesystem" : diskFree_mmcblk2p1[0],
							"1K-blocks"  : parseFloat(diskFree_mmcblk2p1[1]),
							"Used"       : parseFloat(diskFree_mmcblk2p1[2]),
							"Available"  : parseFloat(diskFree_mmcblk2p1[3]),
							"Use%"       : parseFloat(diskFree_mmcblk2p1[4].replace("%", "")),
							"Mounted on" : diskFree_mmcblk2p1[5],
						},
						"diskFree_mmcblk2p4" : {
							"Filesystem" : diskFree_mmcblk2p4[0],
							"1K-blocks"  : parseFloat(diskFree_mmcblk2p4[1]),
							"Used"       : parseFloat(diskFree_mmcblk2p4[2]),
							"Available"  : parseFloat(diskFree_mmcblk2p4[3]),
							"Use%"       : parseFloat(diskFree_mmcblk2p4[4].replace(/%/g, "")),
							"Mounted on" : diskFree_mmcblk2p4[5],
						},
						"total": {
						}
					};
					diskFree.total = {
						"Filesystem" : 
							diskFree.diskFree_mmcblk2p1['Filesystem'] 
							+ ", " + diskFree.diskFree_mmcblk2p4['Filesystem'] ,
						"1K-blocks"  : 
							diskFree.diskFree_mmcblk2p1['1K-blocks']  
							+ diskFree.diskFree_mmcblk2p4['1K-blocks']  ,
						"Used"       : 
							diskFree.diskFree_mmcblk2p1['Used']
							+ diskFree.diskFree_mmcblk2p4['Used'],
						"Available"  : 
							diskFree.diskFree_mmcblk2p1['Available']
							+ diskFree.diskFree_mmcblk2p4['Available'],
						"Use%"       : 
							diskFree.diskFree_mmcblk2p1['Use%'] 
							+ diskFree.diskFree_mmcblk2p4['Use%'] ,
						"Mounted on" : 
							diskFree.diskFree_mmcblk2p1['Mounted on']
							+ ", " + diskFree.diskFree_mmcblk2p4['Mounted on'],
						// "Mounted on" : 
						// obj.diskFree['Available%'] = (100 - parseFloat(obj.diskFree['Use%'])) + "%";
					};
				}
				catch(e){
					console.trace("ERROR with diskFree:", e);
				}
				
				// Write the rmChanges.
				fs.writeFileSync( config.rmChanges, JSON.stringify(rmChanges, null, 1) );

				// Write diskFree.
				try{ fs.writeFileSync(config.diskFree, JSON.stringify(diskFree,null,1)); }
				catch(e){ console.log("ERROR: diskFree.json", e); rej_top(e); }
			}

			let { changes, new_filesjson } = await parseChanges(rmChanges).catch(function(e) { throw e; });

			// Resolve.
			resolve_sync({
				changes      : changes, 
				new_filesjson: new_filesjson, 
				diskFree     : diskFree, 
			});
		} 
		catch(e){ 
			// console.log("ERROR:sync:", e); 
			reject_sync(e); 
			return;
		}

	});
};

// Reads the change list and performs actions. 
const convertAndOptimize = function(changes){
	return new Promise(async function(resolve_convertAndOptimize, reject_convertAndOptimize){
		// @TODO Confirm that ALL srcFile within changes exist. Filter them out if they do not exist. 
		//

		// 1 for each pdf page.
		// 1 for each existing pdf annotation page.
		// 1 for each rm file.
		// 1 for each svg to .min.svg file.

		let changesRm      = changes.filter(function(d){ return d.changeType == "updated" && d.ext == "rm"; }).length * 2;
		let changesPdf     = changes.filter(function(d){ return d.changeType == "updated" && d.ext == "pdf"; }).length;
		let changesDeletes = changes.filter(function(d){ return d.changeType == "deleted"; }).length;
		let totalChanges   = changesRm + changesPdf + changesDeletes;
		let currentPage    = 1;
		
		// console.log("changes.length:", changes.length);
		// console.log("****");
		// console.log("changes 5 :", changes.slice(0, 5));
		// resolve_convertAndOptimize(); return; 

		// Display changes message.
		let msg = `convertAndOptimize: ` + 
		`\n  Changes to .rm files  : ${changesRm}` +
		`\n  Changes to .pdf files : ${changesPdf}` +
		`\n  Changes of deletion   : ${changesDeletes}` +
		`\n  Total changes         : ${totalChanges}` +
		`\n`;
		
		sse.write(msg);
		console.log(msg);

		let convert = async function(which){
			for(let index = 0; index<changes.length; index+=1){
				let changeRec = changes[index];
				let fileRec = changeRec.rec;
				
				if(changeRec.changeType == "updated"){
					if(changeRec.ext == "pdf"){
						// Create pdf images if there are any. 
						if(which == "pdfConvert"){
							changeRec.index = currentPage;
							await pdfConvert(changeRec, fileRec, totalChanges).catch(function(e) { throw e; }); 
							currentPage += 1;
							continue;
						}
					}
					else if(changeRec.ext == "epub"){
						currentPage += 1;
					}
					else if(changeRec.ext == "rm"){
						// Run rM2svg.py.
						if(which == "rmToSvg"){
							changeRec.index = currentPage;
							await rmToSvg(changeRec, fileRec, totalChanges).catch(function(e) { throw e; });
							currentPage += 1;
							continue;
						}
						
						// Run svgo.
						if(which == "optimizeSvg"){
							changeRec.index = currentPage;
							await optimizeSvg(changeRec, fileRec, totalChanges).catch(function(e) { throw e; });
							currentPage += 1;
							continue;
						}
					}
					else{
						console.log("unknown file type", changeRec.srcFile);
						continue;
					}
					
				}
				else if(which == "deleted"){
					if(changeRec.changeType == "deleted"){
						// This file was deleted. Rsync already took care of the deletion of the local file.
						changeRec.index = currentPage;
						// {
						// 	"ext": "rm",
						// 	"docId": "fe08af6e-65ea-40ae-8696-c29c7cdde8e4",
						// 	"srcFile": "./DEVICE_DATA/xochitl/fe08af6e-65ea-40ae-8696-c29c7cdde8e4/e8297cad-0fab-438a-8d66-03df63f27b61.rm",
						// 	"destFile": "./DEVICE_DATA_IMAGES/fe08af6e-65ea-40ae-8696-c29c7cdde8e4/e8297cad-0fab-438a-8d66-03df63f27b61.svg",
						// 	"destFile2": "./DEVICE_DATA_IMAGES/fe08af6e-65ea-40ae-8696-c29c7cdde8e4/e8297cad-0fab-438a-8d66-03df63f27b61.min.svg",
						// 	"pageFile": "e8297cad-0fab-438a-8d66-03df63f27b61",
						// 	"changeType": "deleted",
						// 	"index": 1
						// }
						await fileDeleted(changeRec, fileRec, totalChanges).catch(function(e) { throw e; });
						currentPage += 1;
					}
				}
			}
		};

		// Do deletion handling. (Files reported as deleted.)
		try{ await convert("deleted").catch(function(e) { throw e; }); } 
		catch(e){ funcs.rejectionFunction("convertAndOptimize/fileDeleted", e, reject_convertAndOptimize, sse); return; }

		// Do rmToSvg conversion.
		try{ await convert("rmToSvg").catch(function(e) { throw e; }); } 
		catch(e){ funcs.rejectionFunction("convertAndOptimize/rmToSvg", e, reject_convertAndOptimize, sse); return; } 

		// Do pdfConvert conversion.
		try{ 
			await convert("pdfConvert").catch(function(e) { throw e; }); 
		} 
		catch(e){ funcs.rejectionFunction("convertAndOptimize/pdfConvert", e, reject_convertAndOptimize, sse); return; } 

		// Do optimizeSvg.
		try{ await convert("optimizeSvg").catch(function(e) { throw e; }); } 
		catch(e){ funcs.rejectionFunction("convertAndOptimize/optimizeSvg", e, reject_convertAndOptimize, sse); return; } 

		// DONE
		resolve_convertAndOptimize();
	});
};

// Creates png/svg pages from a pdf. 
// pdfConvert

// Converts a .rm file to .svg.
const rmToSvg            = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_rmToSvg, rej_rmToSvg){
		// In case sse is not activated.
		// if(!sse.isActive){ 
		// 	let sse = {
		// 		write: function(data){ return; console.log(data, "***");},
		// 	}
		// 	sse.write("rmToSvg: Using fake sse.write.");
		// }

		// Create the command. 
		let srcFile  = changeRec.srcFile; 
		let destDir  = `${config.imagesPath + changeRec.docId}`;
		let destFile = changeRec.destFile;
		let cmd      = `python3 ${config.scriptsPath}/rM2svg.py -i ${srcFile} -o ${destFile}` ;
		
		// Make sure the destination directory exists.
		let dir_existsSync;
		try{ 
			dir_existsSync = fs.existsSync(destDir); 
		} 
		catch(e){ 
			funcs.rejectionFunction("existsSync", e, rej_rmToSvg, sse)
			return; 
		} 
		
		// Create the destination directory if it does not exist. 
		if( !dir_existsSync ){
			let dir_mkdirSync;
			try { 
				dir_mkdirSync = fs.mkdirSync(destDir); 
			} 
			catch(e){ 
				funcs.rejectionFunction("mkdirSync", e, rej_rmToSvg, sse)
				return; 
			} 
		}

		// Make sure that the specified srcFile exists. 
		if( !fs.existsSync(srcFile) ){ 
			funcs.rejectionFunction("existsSync: srcFile NOT found.", null, rej_rmToSvg, sse)
			return; 
		}
		
		// Run the command. 
		let response;

		try { 
			response = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; });

			// Handle the response.
			if(response.stdOutHist.trim().length) { console.log("stdOutHist:", response.stdOutHist); }
			if(response.stdErrHist.trim().length) { console.log("stdErrHist:", response.stdErrHist); }
			let msg = `[${changeRec.index.toString().padStart(4, "0")}/${totalCount.toString().padStart(4, "0")}] ` +
			`convertAndOptimize/rmToSvg     : ` + 
			`DONE: ` +
			`[PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, "0")}]` +
			` of file: ` +
			`"${fileRec.path + fileRec.metadata.visibleName}"` +
			``;
	
			sse.write(msg);
			console.log(msg);
	
			res_rmToSvg();
		} 
		catch(e){ 
			funcs.rejectionFunction("rM2svg.py", e, rej_rmToSvg, sse)
			return; 
		} 
	});
};

// Optimizes an .svg to .min.svg.
const optimizeSvg        = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_optimizeSvg, rej_optimizeSvg){
		// In case sse is not activated.
		// if(!sse.isActive){ 
		// 	let sse = {
		// 		write: function(data){ return; console.log(data, "***");},
		// 	}
		// 	sse.write("optimizeSvg: Using fake sse.write.");
		// }

		let srcFile  = changeRec.destFile;  // `${config.imagesPath + changeRec.docId + "/" + changeRec.pageFile}.svg`;
		let destFile = changeRec.destFile2; // `${config.imagesPath + changeRec.docId + "/" + changeRec.pageFile}.min.svg`;
		let cmd1 = `node_modules/svgo/bin/svgo --config="${config.scriptsPath}/svgo.config.json" -i ${srcFile} -o ${destFile} `;
		// let cmd2 = `rm ${srcFile}`;
		// let cmd = `${cmd1} && ${cmd2}`
		let cmd = `${cmd1}`

		if( !fs.existsSync(srcFile) ){ 
			let msg = `WARNING: Skipping this missing file: ` +
			`[PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, "0")}]` +
			` of file: ` +
			`${fileRec.metadata.visibleName} ` +
			`(${srcFile}).` +
			``;
			sse.write(msg);
			console.log(msg);
			res_optimizeSvg();
			return; 
		}

		// Run the command. 
		let response;
		try { 
			response = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; });
		} 
		catch(e){ 
			funcs.rejectionFunction("svgo", e, rej_optimizeSvg, sse);
			return; 
		} 

		// Handle the response.
		if(response.stdOutHist.trim().length) { 
			let msg;
			let respLines = response.stdOutHist.split("\n");
			try{
				msg = `[${changeRec.index.toString().padStart(4, "0")}/${totalCount.toString().padStart(4, "0")}] ` +
				`convertAndOptimize/svgo        : ` + 
				`DONE: ` +
				`[PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, "0")}]` +
				` of file: ` +
				`"${fileRec.path + fileRec.metadata.visibleName}" ` +
				`(${respLines[3].split(" - ")[1].split("%")[0]}% reduction)` +
				``;

				sse.write(msg);
				console.log(msg);

				res_optimizeSvg();
			}
			catch(e){
				msg = `convertAndOptimize/svgo   : ` +
				`[${changeRec.index.toString().padStart(4, "0")}/${totalCount.toString().padStart(4, "0")}] `
				`ERROR`;
				sse.write(msg);
				console.log(msg);
				console.log(e);
				
				rej_optimizeSvg();
			}	
		}
		if(response.stdErrHist.trim().length) { console.log("stdErrHist:", response.stdErrHist); }

		// https://ourcodeworld.com/articles/read/659/how-to-decrease-shrink-svg-file-size-with-svgo-in-nodejs
		// svgo_config = await loadConfig(`${config.scriptsPath}` + "/svgo.config.json", process.cwd()).catch(function(e) { throw e; });
		// let svg = Promise.resolve(content);
		// if (svgoConfig !== false) {
		//   svg = new SVGO(svgoConfig)
		// 	.optimize(content, { path: svgoPath })
		// 	.then((result) => result.data);
		// }
		
	});
};

// Notifies about a deleted file. 
const fileDeleted        = function(changeRec, fileRec, totalCount){
	// It appears that deleting a page from a notebook is a true file deletion.
	// Deleting a notebook itself just sets the deleted flag and parent flag.

	return new Promise(async function(res_fileDeleted, rej_fileDeleted){
		try{


			msg = `[${changeRec.index.toString().padStart(4, "0")}/${totalCount.toString().padStart(4, "0")}] ` +
			`convertAndOptimize/fileDeleted : ` + 
				" ".repeat(22) + `from document: ` +
				`"${fileRec.path + fileRec.metadata.visibleName}"` +
				` :: ` +
				`"${changeRec.srcFile}"` +
				``
			;
			sse.write(msg);
			console.log(msg);
			res_fileDeleted();
		}
		catch(e){
			msg = `` + 
			`------------------------\n`+
			`changeRec : ${changeRec}\n`+
			`fileRec   : ${fileRec}\n`+
			`totalCount: ${totalCount}\n`;
			`e         : ${JSON.stringify(e,null,1)}\n`+
			`------------------------\n`+
			rej_fileDeleted(e);
		}

	});
};

// MAIN: Runs the sync/convert/optimize processes.
const updateFromDevice = function(obj){
	return new Promise(async function(res_top, rej_top){
		try{
			// Break out the properties of the object into variables. 
			// let { req, res } = obj;
			let { interface, recreateAll } = obj.options;

			// START SSE.
			sse.start(obj);

			sse.write("== START SSE ==\n");
			
			let changes ;
			let diskFree ;
			let new_filesjson ;

			// Rsync.
			sse.write("== START RSYNC ==");
			let resp;
			try{ 
				// Rsync.
				resp = await rsyncDown( interface ).catch(function(e) { throw e; }); 
				changes = resp.changes;
				diskFree = resp.diskFree;
				new_filesjson = resp.new_filesjson;
			} 
			catch(e){ 
				funcs.rejectionFunction("rsyncDown", e, rej_top, sse);
				return; 
			}
			sse.write("== END RSYNC ==\n");

			sse.write("== START CONVERSIONS / OPTIMIZATIONS ==");
			try{ 
				await convertAndOptimize(changes).catch(function(e) { throw e; }); 
			} 
			catch(e){ 
				funcs.rejectionFunction("convertAndOptimize", e, rej_top, sse);
				return; 
			}
			sse.write("==END CONVERSIONS / OPTIMIZATIONS ==\n");


			sse.write("== START CREATEJSONFSDATA ==\n");
			try{ 
				// Create the new files.json to save it.
				// await funcs.createJsonFsData(true).catch(function(e) { throw e; }); 

				// Write new_filesjson instead of just regenerating it again.
				try{ fs.writeFileSync(config.filesjson, JSON.stringify(new_filesjson,null,0)); }
				catch(e){ console.log("ERROR: files.json", e); rej_top(e); }
				
				// Remove the rmChanges_.json file.
				fs.unlinkSync( config.rmChanges );
			} 
			catch(e){ 
				funcs.rejectionFunction("createJsonFsData", e, rej_top, sse);
				return; 
			}
			sse.write("== END CREATEJSONFSDATA ==\n");

			// sse.write(`changes: ${JSON.stringify(changes,null,1)}\n`);

			sse.write("== END SSE ==\n");
			let msg = "COMPLETE: updateFromDevice (args: " + `interface: ${interface})\n`;
			sse.end( msg );
			console.log(msg);
		}
		catch(e){
			rej_top(e);
			return;
		}
	});
};

module.exports = {
	updateFromDevice   : updateFromDevice   , // Expected use by webApi.js
	parseChanges       : parseChanges       , // Expected use by _backend.js (DEBUG)
	convertAndOptimize : convertAndOptimize , // Expected use by _backend.js (DEBUG)

	_version  : function(){ return "Version 2021-09-23"; }
};