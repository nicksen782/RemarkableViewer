const { spawn }       = require('child_process');
const fs              = require('fs');
const path            = require('path');
var PDFImage          = require("pdf-image").PDFImage;
const async_mapLimit  = require('promise-async').mapLimit;
const { performance } = require('perf_hooks');
const { optimize, loadConfig  }    = require('svgo');
let svgo_config;

const timeIt = require('./timeIt.js');
// const webApi = require('./webApi.js').webApi; // Circular reference? 
const funcs  = require('./funcs.js').funcs;
const config = require('./config.js').config;

// var log = console.log;
// console.log = function() {
//     log.apply(console, arguments);
//     // Print the stack trace
//     console.trace();
// };

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

// Shared function to handle rejections. 
const rejectionFunction = function(title, e, rejectFunction){
	let msg = `ERROR in ${title}: ${e}`;
	console.log(msg); 
	sse.write(msg);
	
	// Send the rejection error.
	sse.write(e);
	
	//
	msg = `FAILED: updateFromDevice\n`;
	console.log(msg); 
	sse.write(msg);
	
	// END THE SSE STREAM.
	sse.end();

	// REJECT AND RETURN.
	rejectFunction(e); 
};

const sleep = function(ms){
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};

const rsyncDown = function(interface){
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
						runCmd_res([msg, rmChanges]); 
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
			resp = await runCmd(cmd, false, 0); 
			let rmChanges = resp[1];
			let changes = [];
			
			// Generate new files.json data (don't save yet.)
			new_filesjson = await funcs.createJsonFsData(false); 

			rmChanges.forEach(function(d){
				let docId   ;
				let fileType;
				try{
					let lines      = d.split("/");
					let filename;
					let name;
					let pageFile;
					
					if     (d.indexOf(".pdf") != -1){ 
						docId      = lines[1].replace(/.pdf/g, "");
						filename   = lines[1];
						fileType = "pdf"; 
						pageFile   = filename.replace(/.pdf/g, "");
						// console.log("docId   :", docId);
						// console.log("filename:", filename);
						// console.log("fileType:", fileType);
						// console.log("pageFile:", pageFile);
					}
					else if(d.indexOf(".rm")  != -1){ 
						docId      = lines[1];
						filename   = lines[2];
						fileType = "notebook"; 
						pageFile   = filename.replace(/.rm/g, "");
					}

					name       = new_filesjson.DocumentType[docId].metadata.visibleName;
					
					let changeType = d.indexOf("deleting ") != -1 ? "deleted" : "updated";
					
					// console.log("rmChanges:", "fileType:", fileType, ", name:", name, ", docId:", docId, ", rmFile:", rmFile, ", path:", d);
					
					changes.push({
						docId     : docId     ,
						name      : name      ,
						pageFile  : pageFile  ,
						fileType  : fileType  ,
						srcFile   : d.replace(/xochitl\//g, config.dataPath),
						changeType: changeType,
					});
				}
				catch(e){
					console.log("ERROR: The file was not found in new_filesjson. Was it actually synced?", docId, fileType);
				}
			});

			// Resolve.
			resolve_sync({
				changes      : changes, 
				new_filesjson: new_filesjson, 
			});
		} 
		catch(e){ 
			// console.log("ERROR:sync:", e); 
			reject_sync(e); 
			return;
		}

	});
};

const convertAndOptimize = function(changes, new_filesjson){
	return new Promise(async function(resolve_convertAndOptimize, reject_convertAndOptimize){
		// Remove some of the changes if their srcFile does not exist. (needed for PDF and for recreateAll.)
		// PDFs have .content.pages populated but the actual file only exists if that page has been written on.
		let tmp_changes = [];
		for(let index = changes.length-1; index>=0; index-=1){
			let changeRec = changes[index];

			if( fs.existsSync(changeRec.srcFile) ){ 
				tmp_changes.push(changeRec);
			}

		}
		changes = tmp_changes.reverse();

		let convert = async function(which){
			for(let index = 0; index<changes.length; index+=1){
				let changeRec = changes[index];
				changeRec.index = index + 1;
				let fileRec = new_filesjson.DocumentType[changeRec.docId];
				
				if(changeRec.changeType == "updated"){
					if(changeRec.fileType == "notebook"){
						// Run rM2svg.py.
						if(which == "rmToSvg"){
							await rmToSvg(changeRec, fileRec, changes.length);
						}
						
						// Run svgo.
						if(which == "optimizeSvg"){
							await optimizeSvg(changeRec, fileRec, changes.length);
						}
					}
					
					else if(changeRec.fileType == "pdf"){
						// Create pdf images if there are any. 
						// try{ await createPdfImages(cmdList); } catch(e){ console.log("failure: createPdfImages", e); }

						// Run rM2svg.py.
						if(which == "rmToSvg"){
							await rmToSvg(changeRec, fileRec, changes.length);
						}
						
						// Run svgo.
						if(which == "optimizeSvg"){
							await optimizeSvg(changeRec, fileRec, changes.length);
						}
					}
				}
				else if(changeRec.changeType == "deleted"){
					console.log("changeType of deleted is not supported yet.");
				}
			}
		};

		// Do rmToSvg conversion first.
		try{ 
			await convert("rmToSvg");
		} 
		catch(e){ 
			rejectionFunction("convertAndOptimize/rmToSvg", e, reject_convertAndOptimize)
			return; 
		} 

		// Do optimizeSvg next.
		try{ 
			await convert("optimizeSvg");
		} 
		catch(e){ 
			rejectionFunction("convertAndOptimize/optimizeSvg", e, reject_convertAndOptimize)
			return; 
		} 

		resolve_convertAndOptimize();
	});
};
const createPdfImages = function(cmdList){
	return new Promise(function(res_createPdfImages, rej_createPdfImages){
		let pdfToPngs = function(documentId){
			return new Promise(async function(res_pdfToPngs, rej_pdfToPngs){
				// Get the files.json file. 
				let files;
				try{ 
					console.log("webApi:", webApi);
					files = await require('./webApi.js').webApi.getFilesJson(); 
					console.log("got getFilesJson");
				} 
				catch(e){ 
					console.log("ERROR:", e); 
					res.send(JSON.stringify(e)); 
					return; 
				}
		
				let data = files.DocumentType[documentId];
				let fileDir = config.dataPath + documentId + "/";
				let destDir = config.imagesPath + documentId + "/";
				let destDirAnnotations = config.imagesPath + documentId + "/annotations/";
				let destDirPages = config.imagesPath + documentId + "/pages/";
				let file         = config.dataPath + documentId + ".pdf";

				if( !fs.existsSync(destDirAnnotations) ){ 
					fs.mkdirSync(destDirAnnotations); 
				}

				if( !fs.existsSync(destDirPages) ){ 
					fs.mkdirSync(destDirPages); 
				}
		
				let getPdfDimensions = function(fullFilePath){
					return new Promise(async function(res_getPdfDimensions, rej_getPdfDimensions){
						// https://unix.stackexchange.com/a/495956
						let cmd = `pdfinfo ${fullFilePath} | grep "Page size" | grep -Eo '[-+]?[0-9]*\.?[0-9]+' | awk -v x=0.3528 '{print $1*x}'`;
						let results;
						
						try{ 
							results = await funcs.runCommand_exec_progress(cmd, 0, false); 
						} 
						catch(e){ 
							console.log("Command failed:", e); 
							rej_getPdfDimensions("fail"); 
							return; 
						}
		
						results = results.stdOutHist;
						results = results.trim().split("\n");
						
						res_getPdfDimensions({
							width : parseInt( results[0] ), // Not interested in the decimal part of the value. 
							height: parseInt( results[1] ), // Not interested in the decimal part of the value. 
						});
					});
				};
				let dims;
				try { dims = await getPdfDimensions( file ); console.log("Got getPdfDimensions"); }
				catch(e){
					console.log("Command failed:", e); 
					rej_pdfToPngs();
				}
				let isLandscape = false; 
				if(dims.width > dims.height){ isLandscape = true; }
		
				console.log("Getting new PDFImage...");
				var pdfImage = new PDFImage(file,
					{
						pdfFileBaseName: data.metadata.visibleName, // string | undefined;
						// convertOptions: {},      // ConvertOptions | undefined;
						// convertExtension: "",    // convertExtension?: string | undefined;
						// graphicsMagick: false,   // graphicsMagick?:   boolean | undefined;
						// outputDirectory: ".",       // string | undefined;
						outputDirectory: destDir,       // string | undefined;
						outputDirectory: destDirPages,       // string | undefined;
		
						combinedImage: false, 
						convertOptions: {
							// "-resize": "1404x1872\!",
							"-rotate": isLandscape ? "270" : "0",
							// "-quality": "5",
						}
					}
				);
		
				pdfImage.convertFile().then(function (imagePaths) {
					imagePaths.forEach(function(d, i){
						// console.log(pdfImage.getOutputImagePathForPage(i));
						let h = 1872;
						let w = h * (3/4);
						// w = dims.width;
						
						// Get the file and encode to base64.
						// destDirPages
						base64 = fs.readFileSync( d, 'base64');
						base64 = 'data:image/jpg;base64,' + base64;

						let svgFile = `` +
						`<svg height="1872" width="1404" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg">\n`+
						` <image height="${h}" x="0" y="0" href="${base64}" />\n`+
						`</svg>\n`
						;
						
						let filename = destDir + (d.split(destDirPages)[1].split(".png")[0] + ".svg");
						console.log("Creating svg for ", d);
						console.log("Creating svg for ", filename);
						// console.log("Creating svg for ", destDir+filename);
						fs.writeFileSync(filename, svgFile);
						// console.log(svgFile);
					});
					res_pdfToPngs();
				});
			});
		};

		let uniqueIds = [];
		cmdList.forEach(function(d){
			if(d.fileType == "pdf"){
				if(uniqueIds.indexOf(d.key) == -1){
					uniqueIds.push(d.key);
					// uniqueIds_data.push(d);
				}
			}
		});

		let proms = [];
		uniqueIds.forEach( function(d){
			proms.push(
				new Promise(async function(resolve, reject){
					try{
						console.log("id:", d);
						await pdfToPngs(d);
						resolve(uniqueIds);
					} 
					catch(e){
						console.log("Failure in pdfToPngs with:", d);
						reject(uniqueIds);
					}
				})
			);
		});

		Promise.all(proms).then(
			function(data){ 
				console.log("SUCCESS:", data); 
				res_createPdfImages(data);
			},
			function(data){ 
				console.log("ERROR:", data); 
				rej_createPdfImages(data);
			}
		);

	});
};
const rmToSvg = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_rmToSvg, rej_rmToSvg){
		// Create the command. 
		let srcFile  = changeRec.srcFile; 
		let destDir  = `${config.imagesPath + changeRec.docId}`;
		let destFile = `${config.imagesPath + changeRec.docId + "/" + changeRec.pageFile}.svg`;
		let cmd      = `python3 scripts/rM2svg.py -i ${srcFile} -o ${destFile}` ;
		
		// Make sure the destination directory exists.
		let dir_existsSync;
		try{ 
			dir_existsSync = fs.existsSync(destDir); 
		} 
		catch(e){ 
			rejectionFunction("existsSync", e, rej_rmToSvg)
			return; 
		} 
		
		// Make sure that the specified srcFile exists. 
		if( !fs.existsSync(srcFile) ){ 
			rejectionFunction("existsSync: srcFile NOT found.", null, rej_rmToSvg)
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
		
		// Run the command. 
		let response;

		try { 
			response = await funcs.runCommand_exec_progress(cmd, 0, false);
		} 
		catch(e){ 
			rejectionFunction("rM2svg.py", e, rej_rmToSvg)
			return; 
		} 
		// Handle the response.
		if(response.stdOutHist.trim().length) { console.log("stdOutHist:", response.stdOutHist); }
		if(response.stdErrHist.trim().length) { console.log("stdErrHist:", response.stdErrHist); }
		let msg = `convertAndOptimize/rmToSvg: ` + 
		`${changeRec.index.toString().padStart(4, " ")}/${totalCount.toString().padStart(4, " ")} ` +
		`DONE: ` +
		`PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(3, " ")}` +
		` of file: ` +
		`"${fileRec.path + changeRec.name}"` +
		``;

		sse.write(msg);
		console.log(msg);

		res_rmToSvg();
	});
};
const optimizeSvg = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_optimizeSvg, rej_optimizeSvg){
		let srcFile  = `${config.imagesPath + changeRec.docId + "/" + changeRec.pageFile}.svg`;
		let destFile = `${config.imagesPath + changeRec.docId + "/" + changeRec.pageFile}.min.svg`;
		let cmd1 = `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" -i ${srcFile} -o ${destFile} `;
		// let cmd2 = `rm ${srcFile}`;
		// let cmd = `${cmd1} && ${cmd2}`
		let cmd = `${cmd1}`

		if( !fs.existsSync(srcFile) ){ 
			let msg = `WARNING: Skipping this missing file: ` +
			`PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(3, " ")}` +
			` of file: ` +
			`${changeRec.name} ` +
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
			response = await funcs.runCommand_exec_progress(cmd, 0, false);
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
				msg = `convertAndOptimize/svgo   : ` + 
				`${changeRec.index.toString().padStart(4, " ")}/${totalCount.toString().padStart(4, " ")} ` +
				`DONE: ` +
				`PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(3, " ")}` +
				` of file: ` +
				`"${fileRec.path + changeRec.name}" ` +
				`(${respLines[3].split(" - ")[1].split("%")[0]}% reduction)` +
				``;

				sse.write(msg);
				console.log(msg);
			}
			catch(e){
				msg = `convertAndOptimize/svgo   : ` +
				`${changeRec.index.toString().padStart(3, " ")}/${totalCount.toString().padStart(3, " ")} `
				``;
				sse.write(msg);
				// console.log(msg);
			}	
		}
		if(response.stdErrHist.trim().length) { console.log("stdErrHist:", response.stdErrHist); }

		// https://ourcodeworld.com/articles/read/659/how-to-decrease-shrink-svg-file-size-with-svgo-in-nodejs
		// svgo_config = await loadConfig("scripts/svgo.config.json", process.cwd());
		// let svg = Promise.resolve(content);
		// if (svgoConfig !== false) {
		//   svg = new SVGO(svgoConfig)
		// 	.optimize(content, { path: svgoPath })
		// 	.then((result) => result.data);
		// }

		res_optimizeSvg();
	});
};

const updateFromDevice = function(obj){
	return new Promise(async function(res_top, rej_top){
		try{
			// Break out the properties of the object into variables. 
			// let { req, res } = obj;
			let { interface, recreateAll } = obj.options;

			// START SSE.
			sse.start(obj);

			sse.write("== START SSE ==\n");
			
			let changes = [];
			let new_filesjson ;

			// Rsync.
			sse.write("== START RSYNC ==");
			let resp;
			try{ 
				// Rsync.
				resp = await rsyncDown( interface ); 
				changes = resp.changes;
				new_filesjson = resp.new_filesjson;
			} 
			catch(e){ 
				rejectionFunction("rsyncDown", e, rej_top);
				return; 
			}
			sse.write("== END RSYNC ==\n");

			// If this flag is set then all existing documents (not any new ones) will have their svgs/pdfs/pngs recreated.
			if(recreateAll){
				let existingFilesJson;
				try{ 
					existingFilesJson = await funcs.getExistingJsonFsData(true); 
					existingFilesJson = existingFilesJson.files;
				} 
				catch(e){ 
					rejectionFunction("recreateAll", e, rej_top);
					return; 
				}
				changes = [];
				for(let key in existingFilesJson.DocumentType){
					let rec = existingFilesJson.DocumentType[key];
					if(rec.content.fileType == "epub"    ) { continue; }
					// if(rec.content.fileType == "notebook") { continue; }
					// if(rec.content.fileType == "pdf"     ) { continue; }

					rec.content.pages.forEach(function(d){
						let obj = {
							docId      : key, // docId: 'af6beacb-ddea-4ada-91da-bb63bcb38ef3',
							name       : rec.metadata.visibleName, // name: 'To do',
							pageFile   : d, // pageFile: ffe8551c-c0c9-4c4c-bd42-0a8a0817c691
							fileType   : rec.content.fileType, // fileType: 'notebook',
							srcFile    : config.dataPath + key + "/" + d +".rm", // path: 'xochitl/af6beacb-ddea-4ada-91da-bb63bcb38ef3/ffe8551c-c0c9-4c4c-bd42-0a8a0817c691.rm',
							changeType : "updated", // changeType: 'updated'
						};
						changes.push(obj);
					});
				}
			}

			sse.write("== START CONVERSIONS / OPTIMIZATIONS ==");
			try{ 
				await convertAndOptimize(changes, new_filesjson); 
			} 
			catch(e){ 
				rejectionFunction("convertAndOptimize", e, rej_top);
				return; 
			}
			sse.write("==END CONVERSIONS / OPTIMIZATIONS ==\n");


			sse.write("== START CREATEJSONFSDATA ==\n");
			try{ 
				// await funcs.createJsonFsData(true); 
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
	updateFromDevice: updateFromDevice,
	optimizeSvg: optimizeSvg,
	_version  : function(){ return "Version 2021-09-23"; }
};