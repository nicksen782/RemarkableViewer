const { spawn }       = require('child_process');
const fs              = require('fs');
const path            = require('path');
const PDFImage          = require("pdf-image").PDFImage;
const async_mapLimit  = require('promise-async').mapLimit;
const { performance } = require('perf_hooks');
const { optimize, loadConfig  }    = require('svgo');
let svgo_config;

const timeIt = require('./timeIt.js');
// const webApi = require('./webApi.js').webApi; // Circular reference? 
const funcs  = require('./funcs.js').funcs;
const config = require('./config.js').config;

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
			console.log(`SSE NOT ACTIVE: ${data}`.trim());
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

// Shared function to handle rejections. 
const rejectionFunction  = function(title, e, rejectFunction){
	let msg = `ERROR in ${title}: ${e}`;
	console.log(msg); 
	sse.write(JSON.stringify(msg));
	
	//
	msg = `FAILED: updateFromDevice\n`;
	console.log(msg); 
	sse.write(msg);
	
	// END THE SSE STREAM.
	sse.end();

	// REJECT AND RETURN.
	rejectFunction(JSON.stringify(e)); 
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
				rmChanges.forEach(function(d){
					let ext;
					let docId;
					let destFile;
					let destFile2;
					let rec = {};
					let pageFile;
					let changeType;
					
					// Determine the changeType.
					if(d.indexOf("deleting ") == 0){
						// console.log(`DELETED: ${d}`);
						srcFile   = d.split("deleted ")[1];
						changeType = "deleted";
					}
					else{
						changeType = "updated";
					}

					if(d.lastIndexOf(".pdf") != -1){ 
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
						// console.log("Skipping epub", d);
						return; 
					}
					else if(d.lastIndexOf(".epubindex") != -1) { 
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

		let changesRm      = changes.filter(function(d){ return d.changeType == "updated" && d.ext == "rm"; }).length * 2;
		let changesPdf     = changes.filter(function(d){ return d.changeType == "updated" && d.ext == "pdf"; }).length;
		let changesDeletes = changes.filter(function(d){ return d.changeType == "deleted"; }).length;
		let totalChanges   = changesRm + changesPdf + changesDeletes;
		let currentPage    = 1;

		// Display changes message.
		let msg = `convertAndOptimize: ` + 
		`\n  Changes to .rm files  : ${changesRm}` +
		`\n  Changes to .pdf files : ${changesPdf}` +
		`\n  Changes of deletion   : ${changesDeletes}` +
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
						if(which == "createPdfImages"){
							changeRec.index = currentPage;
							await createPdfImages(changeRec, fileRec, totalChanges).catch(function(e) { throw e; }); 
							currentPage += 1;
							continue;
						}
					}
					else if(changeRec.ext == "epub"){
						// Create pdf images if there are any. 
						if(which == "createPdfImages"){
							changeRec.index = currentPage;
							// await createPdfImages(changeRec, fileRec, totalChanges).catch(function(e) { throw e; }); 
							currentPage += 1;
							continue;
						}
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
						await fileDeleted(changeRec, fileRec, totalChanges).catch(function(e) { throw e; });
						currentPage += 1;
					}
				}
			}
		};

		// Do deletion handling.
		try{ await convert("deleted").catch(function(e) { throw e; }); } 
		catch(e){ rejectionFunction("convertAndOptimize/fileDeleted", e, reject_convertAndOptimize); return; }

		// Do rmToSvg conversion.
		try{ await convert("rmToSvg").catch(function(e) { throw e; }); } 
		catch(e){ rejectionFunction("convertAndOptimize/rmToSvg", e, reject_convertAndOptimize); return; } 

		// Do createPdfImages conversion.
		try{ await convert("createPdfImages").catch(function(e) { throw e; }); } 
		catch(e){ rejectionFunction("convertAndOptimize/createPdfImages", e, reject_convertAndOptimize); return; } 

		// Do optimizeSvg.
		try{ await convert("optimizeSvg").catch(function(e) { throw e; }); } 
		catch(e){ rejectionFunction("convertAndOptimize/optimizeSvg", e, reject_convertAndOptimize); return; } 

		resolve_convertAndOptimize();
	});
};

// Creates png/svg pages from a pdf. 
const createPdfImages    = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_createPdfImages, rej_createPdfImages){
		// In case sse is not activated.
		// if(!sse.isActive){ 
		// 	let sse = {
		// 		write: function(data){ return; console.log(data, "***");},
		// 	}
		// 	sse.write("createPdfImages: Using fake sse.write.");
		// }

		let pdfToPngs = function(){
			return new Promise(async function(res_pdfToPngs, rej_pdfToPngs){
				let documentId = changeRec.docId;
				let destDir      = config.imagesPath + documentId + "/";
				let destDirPages = config.imagesPath + documentId + "/pages/";
				let msg;
		
				// Make sure that the directories exist. 
				if( !fs.existsSync(destDir) ){ 
					fs.mkdirSync(destDir); 
				}
				if( !fs.existsSync(destDirPages) ){ 
					fs.mkdirSync(destDirPages); 
				}

				let getPdfDimensions = function(fullFilePath){
					return new Promise(async function(res_getPdfDimensions, rej_getPdfDimensions){
						// https://unix.stackexchange.com/a/495956
						let cmd = `pdfinfo "${fullFilePath}" | grep "Page size"`;
						let results;
						try{ 
							results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
							results = results.stdOutHist
								.replace(/Page size:/g, "")
								.replace(/ /g, "")
								.replace(/pts/g, "")
								.trim()
								.split("x");
						} 
						catch(e){ 
							console.log("Command failed:", e); 
							rej_getPdfDimensions(e); 
							return; 
						}

						let width  = Math.ceil( results[0] );
						let height = Math.ceil( results[1] );
						let isLandscape = false; 
						if(width > height){ isLandscape = true; }

						res_getPdfDimensions({
							width       : width       , 
							height      : height      , 
							isLandscape : isLandscape , 
						});
					});
				};
				let getPngDimensions = function(fullFilePath){
					return new Promise(async function(res_getPngDimensions, rej_getPngDimensions){
						// https://unix.stackexchange.com/a/495956
						// let cmd = `pdfinfo ${fullFilePath} | grep "Page size"`;
						let cmd = `identify -precision 15 "${fullFilePath}"`;

						let type;
						let dims;
						let dims2;
						let bits;
						let colorspace;

						let results;
						try{ 
							results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
							// console.log(`  results: ${results.stdOutHist}`);
							results = results.stdOutHist
								// 'DEVICE_DATA_IMAGES/54ee7bf5-ad7e-43b0-ab28-3a69da9f1acf/pages/Black Bass-23.png PNG 404x525 404x525+0+0 8-bit sRGB 8c 25238B 0.000u 0:00.000\n',
								.split(fullFilePath)[1]
								//  PNG 404x525 404x525+0+0 8-bit sRGB 8c 25238B 0.000u 0:00.000\n',
								.trim()
								// PNG 410x525 410x525+0+0 8-bit sRGB 8c 31740B 0.000u 0:00.000
								.split(" ")
								// Now an array of values. 
							;
							
							type       = results[0];
							dims       = results[1];
							dims2      = results[2];
							bits       = results[3];
							colorspace = results[4];
							colorCount = results[5];
							bytes      = results[6];

						} 
						catch(e){ 
							console.log("Command failed:", e); 
							rej_getPngDimensions(e); 
							return; 
						}

						let width  = Math.ceil( dims.split("x")[0] );
						let height = Math.ceil( dims.split("x")[1] );
						let isLandscape = false; 
						if(width > height){ isLandscape = true; }

						res_getPngDimensions({
							type       : type       ,
							dims       : dims       ,
							dims2      : dims2      ,
							bits       : bits       ,
							colorspace : colorspace ,
							colorCount : colorCount ,
							bytes      : bytes      ,

							width      : width      ,
							height     : height     ,
							isLandscape: isLandscape,
						});
					});
				};
				let rotatePng = function(fullFilePath, newAngle){
					return new Promise(async function(res_rotatePng, rej_rotatePng){
						let cmd = `convert -precision 15 "${fullFilePath}" -rotate ${newAngle}\! "${fullFilePath}"`;
						let results;
						try{
							results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
						}
						catch(e){ 
							console.log("Command failed:", e); 
							rej_rotatePng(e); 
							return; 
						}
						res_rotatePng(); 
					});
				};
				let resizePng = function(fullFilePath, newWidth, newHeight){
					return new Promise(async function(res_resizePng, rej_resizePng){
						let cmd = `convert "${fullFilePath}" -precision 15 -resize ${newWidth}x${newHeight}` +'! ' + `"${fullFilePath}"`;
						// console.log(`  ${cmd}`);
						let results;
						try{
							results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
						}
						catch(e){ 
							console.log("Command failed:", e); 
							rej_resizePng(e); 
							return; 
						}
						res_resizePng(); 
					});
				};

				let dims;
				try { dims = await getPdfDimensions( changeRec.srcFile ).catch(function(e) { throw e; }); }
				catch(e){
					console.log("Command failed:", e); 
					rej_pdfToPngs(e);
				}
				let isLandscape = dims.isLandscape; 
		
				// 'convert -alpha remove -antialias  -colors 128 -depth 8 -flatten  -strip  "./DEVICE_DATA/xochitl/029d4e39-5bd5-47d0-96dd-1808d5fb5b77.pdf[0]" "DEVICE_DATA_IMAGES/029d4e39-5bd5-47d0-96dd-1808d5fb5b77/pages/KOLBE1.pdf-0.png"'
				let pdfImage = new PDFImage(
					changeRec.srcFile, {
						pdfFileBaseName: fileRec.metadata.visibleName, // string | undefined;
						outputDirectory: destDirPages,                 // string | undefined;
		
						combinedImage: false, 
						convertOptions: {
							"-strip"    : "",
							"-depth"    : "8" ,
							"-alpha"    : "remove",
							"-colors"   : "128",
							"-flatten"  : "",
							"-antialias": "",
						}
					}
				);
				
				// UTILITY: Takes 2 numbers and returns the ratio of those numbers.
				let reduce = function(numerator, denominator) {
					// let countDecimals = function (value) { 
					// 	if ((value % 1) != 0) 
					// 		return value.toString().split(".")[1].length;  
					// 	return 0;
					// };
					// let decimalPlacesInNumerator   = countDecimals(numerator);
					// let decimalPlacesInDenominator = countDecimals(denominator);

					// console.log(
					// 	decimalPlacesInNumerator,
					// 	decimalPlacesInDenominator
					// )

					let a = numerator;
					let b = denominator;
					let c;
					while (b) {
						c = a % b; 
						a = b; 
						b = c;
					}
					// return [numerator / a, denominator / a];
					return `${""+(numerator / a)}:${"" + (denominator / a)}`;
				};

				try{
					let proms = [];
					let pages = fileRec.content.pages;
					let currentCount = 0; 
					for(let index=0; index<pages.length; index+=1){
						proms.push(
							await new Promise(async function(res_prom, rej_prom){
								let pngFile = await pdfImage.convertPage(index).catch(function(e) { throw e; });
								let pngDims = await getPngDimensions(pngFile).catch(function(e){ throw e; });

								// Rotate the png?
								if(pngDims.isLandscape){
									// console.log("isLandscape");
									await rotatePng(pngFile, -90).catch(function(e){ throw e; });
									pngDims = await getPngDimensions(pngFile).catch(function(e){ throw e; });
								}

								// Resize the image to fit a 3:4 aspect ratio.
								let newHeight;
								(function(){
									// let w = parseFloat(pngDims.width);
									// let h = parseFloat(pngDims.height);
									let w = pngDims.width;
									let h = pngDims.height;
									newHeight = w / (3/4);
									// console.log("  newHeight = w / (3/4) :::: ", `${newHeight} = ${w} / (3/4)`);
								})();
								let oldRatio = reduce(pngDims.width, pngDims.height);
								// console.log("  OLD: ", pngDims.width, pngDims.height, oldRatio, oldRatio == "3:4" ? "*****************************************" : "---");

								await resizePng(pngFile, pngDims.width, newHeight).catch(function(e){ throw e; });
								
								pngDims = await getPngDimensions(pngFile).catch(function(e){ throw e; });
								let newRatio = reduce(pngDims.width, pngDims.height);
								// console.log("  NEW: ", pngDims.width, pngDims.height, newRatio, newRatio == "3:4" ? "*****************************************" : "---");

								let width        = pngDims.width;
								let height       = pngDims.height;
								let isLandscape  = pngDims.isLandscape;
								
								// transform="rotate(100)"
								let msg;
								let pageId = fileRec.content.pages[index];
								
								// let h = 1872;
								// let w = h * (3/4);
								// w = dims.width;
								   
								// Get the file and encode to base64.
								base64 = fs.readFileSync( pngFile, 'base64');
								base64 = 'data:image/jpg;base64,' + base64;

								let svgFile = `` +
								`<svg xmlns="http://www.w3.org/2000/svg" height="1872" width="1404">\n`+
								`	<g style="display:inline;">\n` +
								`		<image height="${1872}" x="0" y="0" href="${base64}" />\n`+
								`	</g>\n` +
								`</svg>\n`
								;

								let svgFileTEST = `` +
								`<svg xmlns="http://www.w3.org/2000/svg" height="1872" width="1404">\n`+
								`	<g>\n` +
								`		<image transform="" width="${pngDims.width}" height="${pngDims.height}" x="0" y="0" href="${base64}" />\n`+
								`	</g>\n` +
								`</svg>\n`
								;
								// `		<image width="${dims.width}" height="${dims.height}" x="0" y="0" href="${base64}" />\n`+
								// `		<image height="${h}" x="0" y="0" href="${base64}" />\n`+
								// `		<image height="${h}" width="${w}" x="0" y="0" href="${base64}" />\n`+

								// Write the .svg file.
								let filenameSvg = destDirPages + pageId + ".svg";
								let filenameSvgTEST = destDirPages + "TEST_" + pageId + ".svg";
								fs.writeFileSync(filenameSvg, svgFile);
								fs.writeFileSync(filenameSvgTEST, svgFileTEST);
								
								// Rename the .png file.
								// DEVICE_DATA_IMAGES/54ee7bf5-ad7e-43b0-ab28-3a69da9f1acf/pages/Black Bass-0.png
								let baseName = path.basename(pngFile).split(".");
								let filenamePng2 = destDirPages + pageId + "." + baseName[1];
								// msg = `  Renaming .png: ${pngFile} :: ${filenamePng2}`;
								// sse.write(msg);
								// console.log(msg);
								fs.renameSync(pngFile, filenamePng2);
								fs.copyFileSync(filenamePng2, pngFile);
								
								// Remove the .png file. 
								// msg = `  Removing .png: ${pngFile}`;
								// sse.write(msg);
								// console.log(msg);
								// fs.unlinkSync( pngFile );

								currentCount += 1;
								msg = `  ` + 
								`[PAGE ${index} ${(currentCount).toString().padStart(4, " ")} of ${pages.length.toString().padStart(4, " ")}] has been processed for: ` +
								`${fileRec.metadata.visibleName}: ` +
								``;
								sse.write(msg);
								console.log(msg);
								// console.log("");

								res_prom(pngFile);
							}).catch(function(e) { throw e; })
						);
					}

					Promise.all(proms).then(
						function(results){
							res_pdfToPngs(); 
							return;
						},
						function(error){
							console.log("ERROR:, error");
							rej_pdfToPngs(error);
						}
					);
				}
				catch(e){
					console.log("broken???");
				}
			});
		};

		// Run the command. 
		let response;
		let msg;
		try { 
			msg = `[${changeRec.index.toString().padStart(4, " ")}/${totalCount.toString().padStart(4, " ")}] ` +
			`convertAndOptimize/createPdfImages: ` + 
			`\n  LOADING FILE: "${fileRec.path + fileRec.metadata.visibleName}"` +
			`(${fileRec.content.pages.length.toString().padStart(4, " ")} pages)`;

			console.log(msg);
			sse.write(msg);
			
			response = await pdfToPngs(changeRec).catch(function(e) { throw e; });

			msg = `COMPLETE`;

			console.log(msg);
			sse.write(msg);

			res_createPdfImages();
		} 
		catch(e){ 
			msg = `convertAndOptimize/createPdfImages: ` + 
			`FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"` +
			``;
			console.log(msg, e);
			sse.write(msg);

			rejectionFunction("createPdfImages", e, rej_createPdfImages)
			return; 
		} 
		
	});
};

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
			rejectionFunction("existsSync", e, rej_rmToSvg)
			return; 
		} 
		
		// Create the destination directory if it does not exist. 
		if( !dir_existsSync ){
			let dir_mkdirSync;
			try { 
				dir_mkdirSync = fs.mkdirSync(destDir); 
			} 
			catch(e){ 
				rejectionFunction("mkdirSync", e, rej_rmToSvg)
				return; 
			} 
		}

		// Make sure that the specified srcFile exists. 
		if( !fs.existsSync(srcFile) ){ 
			rejectionFunction("existsSync: srcFile NOT found.", null, rej_rmToSvg)
			return; 
		}
		
		// Run the command. 
		let response;

		try { 
			response = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; });

			// Handle the response.
			if(response.stdOutHist.trim().length) { console.log("stdOutHist:", response.stdOutHist); }
			if(response.stdErrHist.trim().length) { console.log("stdErrHist:", response.stdErrHist); }
			let msg = `[${changeRec.index.toString().padStart(4, " ")}/${totalCount.toString().padStart(4, " ")}] ` +
			`convertAndOptimize/rmToSvg     : ` + 
			`DONE: ` +
			`[PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, " ")}]` +
			` of file: ` +
			`"${fileRec.path + fileRec.metadata.visibleName}"` +
			``;
	
			sse.write(msg);
			console.log(msg);
	
			res_rmToSvg();
		} 
		catch(e){ 
			rejectionFunction("rM2svg.py", e, rej_rmToSvg)
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
			`[PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, " ")}]` +
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
			rejectionFunction("svgo", e, rej_optimizeSvg)
			return; 
		} 

		// Handle the response.
		if(response.stdOutHist.trim().length) { 
			let msg;
			let respLines = response.stdOutHist.split("\n");
			try{
				msg = `[${changeRec.index.toString().padStart(4, " ")}/${totalCount.toString().padStart(4, " ")}] ` +
				`convertAndOptimize/svgo        : ` + 
				`DONE: ` +
				`[PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, " ")}]` +
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
				`[${changeRec.index.toString().padStart(4, " ")}/${totalCount.toString().padStart(4, " ")}] `
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
		msg = `[${changeRec.index.toString().padStart(4, " ")}/${totalCount.toString().padStart(4, " ")}] ` +
		`convertAndOptimize/fileDeleted : ` + 
			" ".repeat(22) + `file: ` +
			// `"${fileRec.path + fileRec.metadata.visibleName}"` +
			`"${fileRec.metadata.visibleName}" :: ` +
			`"${changeRec.srcFile}"` +
			``
		;
		sse.write(msg);
		console.log(msg);

		res_fileDeleted();
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
				rejectionFunction("rsyncDown", e, rej_top);
				return; 
			}
			sse.write("== END RSYNC ==\n");

			sse.write("== START CONVERSIONS / OPTIMIZATIONS ==");
			try{ 
				await convertAndOptimize(changes).catch(function(e) { throw e; }); 
			} 
			catch(e){ 
				rejectionFunction("convertAndOptimize", e, rej_top);
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
				rejectionFunction("createJsonFsData", e, rej_top);
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
	updateFromDevice: updateFromDevice , // Expected use by webApi.js
	optimizeSvg     : optimizeSvg      , // Expected use by webApi.js
	createPdfImages : createPdfImages  , // Expected use by _backend.js (DEBUG)
	_version  : function(){ return "Version 2021-09-23"; }
};