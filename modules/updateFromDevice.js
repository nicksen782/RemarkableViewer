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

					// Looking for lines containing ".epub"
					if(data.indexOf(".epub") != -1){
						let split = data.split("\n");
						split.forEach(function(d){
							if(d.indexOf(".epub") != -1){
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
		const parseChanges = async function(rmChanges){
			return new Promise(async function(res_parseChanges, rej_parseChanges){
				let changes = [];
				
				// Generate new files.json data (don't save yet.)
				new_filesjson = await funcs.createJsonFsData(false).catch(function(e) { throw e; }); 

				// let debug_basefilename     = "./rmChanges_" + new Date().getTime() + "";
				let debug_basefilename     = "./rmChanges_" + "_DEBUG_" + "";
				let debug_filename1        = debug_basefilename + "_A.json";
				let debug_filename2        = debug_basefilename + "_B.json";
				let debug_filename3        = debug_basefilename + "_C.json";
				let debug_basefilename_nfs = debug_basefilename + "_nfj.json";
				
				// Write new_filesjson to debug_basefilename_nfs.
				// fs.writeFileSync( debug_basefilename_nfs, JSON.stringify(new_filesjson.DocumentType, null, 1) );

				// Write the starting rmChanges to debug_filename1.
				// fs.writeFileSync( debug_filename1, JSON.stringify(rmChanges, null, 1) );
				
				// Get epub ids. (Any file related to an epub file id.)
				let epubIds = [];
				rmChanges.forEach(function(d){
					if(d.lastIndexOf(".epubindex") != -1) {
						// Found an epubindex file. Get the file id.
						let splits = d.split("/");
						let file = splits[1];
						let id = file.split(".")[0];

						// Add the epub file id to epubIds if it isn't already there. 
						if(epubIds.indexOf(id) == -1){ epubIds.push(id); }
					}
					else if(d.lastIndexOf(".epub") != -1) {
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

				// Write the filtered rmChanges file to debug_filename2.
				// fs.writeFileSync( debug_filename2, JSON.stringify(rmChanges, null, 1) );

				// Create the changes array of objects.
				rmChanges.forEach(function(d){
					let ext;
					let docId;
					let destFile;
					let destFile2;
					let rec = {};
					let pageFile;
					
					if     (d.lastIndexOf(".pdf") != -1){ 
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
						changeType: "updated" , // @TODO Need to check for updated vs deleted.
					});
				});

				// Write the completed changes file to debug_filename3.
				// fs.writeFileSync( debug_filename3, JSON.stringify(changes, null, 1) );

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
		if( ["wifi", "usb"].indexOf(interface) == -1 ) {
			let msg = "ERROR: Invalid 'interface'";
			reject_sync( msg );
			return;
		}

		// Send the command. 
		let cmd = `cd ${path.join(path.resolve("./"), "scripts")} && ./syncRunner.sh tolocal ${interface}`;
		let resp;
		try{ 
			let rmChanges;

			// This file will exist if the program failed to finish.
			// If it exists then use it for changes and skip the rsync.
			if(fs.existsSync("./rmChanges_.json")){
				rmChanges = fs.readFileSync("");
				rmChanges = JSON.parse(rmChanges);
			}

			// File didn't exist. Do a rsync.
			else{
				// run the sync command. 
				resp = await runCmd(cmd, false, 0).catch(function(e) { throw e; }); 

				// Get the changes. 
				rmChanges = resp[1];

				// Write the rmChanges.
				fs.writeFileSync( "./rmChanges_.json", JSON.stringify(rmChanges, null, 1) );
			}

			let { changes, new_filesjson } = await parseChanges(rmChanges).catch(function(e) { throw e; });

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

const convertAndOptimize = function(changes){
	return new Promise(async function(resolve_convertAndOptimize, reject_convertAndOptimize){
		// @TODO Confirm that ALL srcFile within changes exist. Filter them out if they do not exist. 
		//

		let changesRm  = changes.filter(function(d){ return d.ext == "rm"; }).length;
		let changesPdf = changes.filter(function(d){ return d.ext == "pdf"; }).length;
		let totalChanges = (changesRm * 2) + changesPdf;
		let currentPage = 1;

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
						}
					}
					else if(changeRec.ext == "rm"){
						// Run rM2svg.py.
						if(which == "rmToSvg"){
							changeRec.index = currentPage;
							await rmToSvg(changeRec, fileRec, totalChanges).catch(function(e) { throw e; });
							currentPage += 1;
						}
						
						// Run svgo.
						if(which == "optimizeSvg"){
							changeRec.index = currentPage;
							await optimizeSvg(changeRec, fileRec, totalChanges).catch(function(e) { throw e; });
							currentPage += 1;
						}
					}

				}
				else if(changeRec.changeType == "deleted"){
					console.log("changeType of deleted is not supported yet.");
				}
			}
		};

		// Do rmToSvg conversion.
		try{ 
			await convert("rmToSvg").catch(function(e) { throw e; });
		} 
		catch(e){ 
			rejectionFunction("convertAndOptimize/rmToSvg", e, reject_convertAndOptimize)
			return; 
		} 

		// Do createPdfImages conversion.
		try{ 
			await convert("createPdfImages").catch(function(e) { throw e; });
		} 
		catch(e){ 
			rejectionFunction("convertAndOptimize/createPdfImages", e, reject_convertAndOptimize)
			return; 
		} 

		// Do optimizeSvg.
		try{ 
			await convert("optimizeSvg").catch(function(e) { throw e; });
		} 
		catch(e){ 
			rejectionFunction("convertAndOptimize/optimizeSvg", e, reject_convertAndOptimize)
			return; 
		} 

		resolve_convertAndOptimize();
	});
};
const createPdfImages = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_createPdfImages, rej_createPdfImages){
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
						let cmd = `pdfinfo ${fullFilePath} | grep "Page size"`;
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
							rej_getPdfDimensions("fail"); 
							return; 
						}
		
						// results = results.stdOutHist;
						// results = results.trim().split("\n");
						
						res_getPdfDimensions({
							width : Math.ceil( results[0] ), // 
							height: Math.ceil( results[1] ), // 
						});
					});
				};
				let OLDgetPdfDimensions = function(fullFilePath){
					return new Promise(async function(res_getPdfDimensions, rej_getPdfDimensions){
						// https://unix.stackexchange.com/a/495956
						let cmd = `pdfinfo ${fullFilePath} | grep "Page size" | grep -Eo '[-+]?[0-9]*\.?[0-9]+' | awk -v x=0.3528 '{print $1*x}'`;
						let results;
						try{ 
							results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
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
				try { dims = await getPdfDimensions( changeRec.srcFile ).catch(function(e) { throw e; }); }
				catch(e){
					console.log("Command failed:", e); 
					rej_pdfToPngs();
				}
				let isLandscape = false; 
				if(dims.width > dims.height){ isLandscape = true; }
		
				// DEVICE_DATA/xochitl/54ee7bf5-ad7e-43b0-ab28-3a69da9f1acf.pdf 
				// pdfinfo DEVICE_DATA/xochitl/54ee7bf5-ad7e-43b0-ab28-3a69da9f1acf.pdf | grep "Page size" | grep -Eo '[-+]?[0-9]*.?[0-9]+' | awk -v x=0.3528 '{print $1*x}'

				// image_dims="{
				// 	"w1": 185,
				// 	"h1": 144,
				// }"
				// 185 and 247

				// To get the width based on the height:
				//  w = h * (3/4).
				//  h = h
				// :: 144 * (3/4) = 
				
				// To get the height bsed on the width:
				//  h = w / (3/4)
				//  w = w
				// :: 185 / (3/4)

				// Note: the transform entry stores the transformations to the viewport subsequent to a crop action while reading the document. m11 stores the scaling factor of the height / vertical axis, and m22 stores the scaling factor of the width / horizontal axis. All the other values are unused. Values smaller than 1 lead to a zoom out, with white space around the image. Negative values are not accepted / lead to no display whatsoever.

				var pdfImage = new PDFImage(changeRec.srcFile, {
						pdfFileBaseName: fileRec.metadata.visibleName, // string | undefined;
						// convertOptions: {},      // ConvertOptions | undefined;
						// convertExtension: "",    // convertExtension?: string | undefined;
						// graphicsMagick: false,   // graphicsMagick?:   boolean | undefined;
						// outputDirectory: ".",       // string | undefined;
						outputDirectory: destDirPages,       // string | undefined;
		
						combinedImage: false, 
						convertOptions: {
							// "-resize": "x1872\!",
							"-rotate": isLandscape ? "270" : "0",
							// "-resize": "1872x\!",
							// "-resize": "525x700\!",
							// "-resize": "700x525\!",
							// "-resize": "x1872^",
							// "-adaptive-resize": "x1872",
							// "-resize": "x1872",
							// "-geometry": "x1872",
							// "-rotate": isLandscape ? "-90" : "0",

							// "-define": "png:compression-filter=2",
							// "-define": "png:compression-level=9",
							// "-define": "png:compression-strategy=1",
							
							// "-define": "png:compression-level=0",  
							// "-define": "png:compression-filter=5",  
							// "-define": "png:compression-strategy=2", 
							
							// "-define": "png:compression-level=9",
							// "-define": "png:format=8",
							// "-define": "png:color-type=0",
							// "-define": "png:bit-depth=8",
							
							// "-quality": "100" ,
							"-strip": "",
							"-depth": "8" ,
							"-alpha": "remove",
							// "-colors" : "255",
							"-colors" : "8",
							"-flatten" : "",
							// "-colorize": "0%",
							"-normalize": "",
							// "-compress": "BZip",
							// "-colorspace": "Gray",
							// "+antialias":"",
							"-antialias":"",
							
							// "-define": "png:color-type=3",
							// "-define": "png:color-type=3",
							// "+dither" : "",
							// "type": "Palette", // crashes
						}
					}
				);
				
				try{
					let proms = [];
					let pages = fileRec.content.pages;
					let currentCount = 0; 
					for(let index=0; index<pages.length; index+=1){
						proms.push(
							new Promise(async function(res_prom, rej_prom){
								let pngFile = await pdfImage.convertPage(index).catch(function(e) { throw e; });

								let msg;
								let pageId = fileRec.content.pages[index];
								
								let h = 1872;
								let w = h * (3/4);
								// w = dims.width;
								let testDims = {
									w1 :dims.width,
									h1 :dims.height,
									w2: dims.height * (3/4),
									h2: dims.height,
								};
								   
								// Get the file and encode to base64.
								base64 = fs.readFileSync( pngFile, 'base64');
								base64 = 'data:image/jpg;base64,' + base64;

								let svgFile = `` +
								`<svg xmlns="http://www.w3.org/2000/svg" height="1872" width="1404">\n`+
								` <!-- image_dims="${JSON.stringify(testDims,null,1)}" -->\n` +
								` <!-- h=${h} w=${w} -->\n` +
								` <!-- isLandscape="${isLandscape}"-->\n` +
								`	<g style="display:inline;">\n` +
								`		<image height="${h}" x="0" y="0" href="${base64}" />\n`+
								`	</g>\n` +
								`</svg>\n`
								;

								let svgFileTEST = `` +
								`<svg xmlns="http://www.w3.org/2000/svg" height="1872" width="1404">\n`+
								`	<defs>\n` +
								`		<style>\n`+
								`			<![CDATA[ \n` +
								`				\n` +
								`				.test{ background-image:url('${base64}'); }\n` +
								`				\n` +
								`				/* .g_cont { display: none; } */\n` +
								`				/* .g_cont:target { display: inline; border:1px solid green; }\n */` +
								`			]]> \n` +
								`		</style>\n`+
								`	</defs>\n` +
								`	<g class="test">\n` +
								`		<!-- <image class="test" height="${h}" x="0" y="0" href="" /> -->\n`+
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
								`PAGE ${(currentCount).toString().padStart(4, "_")} of ${pages.length.toString().padStart(4, "_")} has been processed for: ` +
								`${fileRec.metadata.visibleName}: ` +
								``;
								sse.write(msg);
								console.log(msg);

								res_prom(pngFile);
							})
						);
					}

					Promise.all(proms).then(
						function(results){
							res_pdfToPngs(); 
							return;
						},
						function(error){
							console.log("ERROR:, error");
							rej_pdfToPngs();
						}
					);
				}
				catch(e){
					console.log("broken???");
				}
			});
		};

		// In case sse is not activated.
		if(!sse || !sse.write){ 
			var sse = {
				write: function(data){ return; console.log(data, "***");},
			}
			sse.write("*** createPdfImages: Using fake sse.write.");
		}

		// Run the command. 
		let response;
		let msg;
		try { 
			msg = `convertAndOptimize/createPdfImages: ` + 
			`${changeRec.index.toString().padStart(4, "_")}/${totalCount.toString().padStart(4, "_")} ` +
			`\n  LOADING FILE: "${fileRec.path + fileRec.metadata.visibleName}"` +
			`(${fileRec.content.pages.length.toString().padStart(4, "_")} pages)`;

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

			rejectionFunction("svgo", e, rej_createPdfImages)
			return; 
		} 
		
	});
};
const rmToSvg = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_rmToSvg, rej_rmToSvg){
		// In case sse is not activated.
		if(!sse || !sse.write){ 
			var sse = {
				write: function(data){ return; console.log(data, "***");},
			}
			sse.write("*** createPdfImages: Using fake sse.write.");
		}

		// Create the command. 
		let srcFile  = changeRec.srcFile; 
		let destDir  = `${config.imagesPath + changeRec.docId}`;
		let destFile = changeRec.destFile;
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
			let msg = `convertAndOptimize/rmToSvg: ` + 
			`${changeRec.index.toString().padStart(4, "_")}/${totalCount.toString().padStart(4, "_")} ` +
			`DONE: ` +
			`PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, "_")}` +
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
const optimizeSvg = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_optimizeSvg, rej_optimizeSvg){
		// In case sse is not activated.
		if(!sse || !sse.write){ 
			var sse = {
				write: function(data){ return; console.log(data, "***");},
			}
			sse.write("*** createPdfImages: Using fake sse.write.");
		}

		let srcFile  = changeRec.destFile;  // `${config.imagesPath + changeRec.docId + "/" + changeRec.pageFile}.svg`;
		let destFile = changeRec.destFile2; // `${config.imagesPath + changeRec.docId + "/" + changeRec.pageFile}.min.svg`;
		let cmd1 = `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" -i ${srcFile} -o ${destFile} `;
		// let cmd2 = `rm ${srcFile}`;
		// let cmd = `${cmd1} && ${cmd2}`
		let cmd = `${cmd1}`

		if( !fs.existsSync(srcFile) ){ 
			let msg = `WARNING: Skipping this missing file: ` +
			`PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, "_")}` +
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
				msg = `convertAndOptimize/svgo   : ` + 
				`${changeRec.index.toString().padStart(4, "_")}/${totalCount.toString().padStart(4, "_")} ` +
				`DONE: ` +
				`PAGE: ${(fileRec.content.pages.indexOf(changeRec.pageFile)+1).toString().padStart(4, "_")}` +
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
				`${changeRec.index.toString().padStart(4, "_")}/${totalCount.toString().padStart(4, "_")} `
				``;
				sse.write(msg);
				// console.log(msg);
				
				rej_optimizeSvg();
			}	
		}
		if(response.stdErrHist.trim().length) { console.log("stdErrHist:", response.stdErrHist); }

		// https://ourcodeworld.com/articles/read/659/how-to-decrease-shrink-svg-file-size-with-svgo-in-nodejs
		// svgo_config = await loadConfig("scripts/svgo.config.json", process.cwd()).catch(function(e) { throw e; });
		// let svg = Promise.resolve(content);
		// if (svgoConfig !== false) {
		//   svg = new SVGO(svgoConfig)
		// 	.optimize(content, { path: svgoPath })
		// 	.then((result) => result.data);
		// }
		
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
				resp = await rsyncDown( interface ).catch(function(e) { throw e; }); 
				changes = resp.changes;
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
				await funcs.createJsonFsData(true).catch(function(e) { throw e; }); 

				// Remove the rmChanges_.json file.
				fs.unlinkSync( "./rmChanges_.json" );
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