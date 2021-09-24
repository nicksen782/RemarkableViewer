const { spawn }       = require('child_process');
const fs              = require('fs');
const path            = require('path');
var PDFImage          = require("pdf-image").PDFImage;
const async_mapLimit  = require('promise-async').mapLimit;

const timeIt = require('./timeIt.js');
const webApi = require('./webApi.js').webApi;
const funcs  = require('./funcs.js').funcs;
const config = require('./config.js').config;

const sync                      = function(obj){
	return new Promise(async function(resolve_sync, reject_sync){
		// Break out the properties of the object into variables. 
		let { req, res, interface } = obj;

		const runCmd                    = function(cmd, progress=true, expectedExitCode=0){
			return new Promise(function(runCmd_res, runCmd_rej){
				// Create the child process.
				const child = spawn(cmd, { shell: true });
		
				// Set both stdout and stderr to use utf8 encoding (required for SSE.)
				child.stdout.setEncoding('utf8');
				child.stderr.setEncoding('utf8');
		
				// Event listener for updates on stdout. 
				child.stdout.on('data', (data) => {
					data = data.toString().trim();
					if(progress && data != ""){ console.log(`O: ${ data }`); }
					res.write(`data: ${JSON.stringify(data)}\n\n`);
				});
		
				// Event listener for updates on stderr. 
				child.stderr.on('data', (data) => {
					data = data.toString().trim();
					if(progress && data != ""){ console.log(`E: ${ data }`); }
					res.write(`data: ${JSON.stringify(data)}\n\n`);
				});
		
				// Event listener for the completed command. 
				child.on('exit', (code) => {
					// Exited as expected?
					if(code == expectedExitCode){ 
						let msg = "runCmd: COMPLETE " + code;
						if(progress){ 
							console.log(msg); 
						}
		
						// res.write(`data: ${JSON.stringify(msg)}\n\n`);
						runCmd_res(msg); 
					}
					// Exited with unexpected exit code.
					else{
						let msg = `runCmd: ERROR: Child process was expected to exit with code ${expectedExitCode} but exited with code: ${code} instead.`;
						if(progress){ 
							console.log(msg); 
						}
		
						// res.write(`data: ${JSON.stringify(msg)}\n\n`);
						runCmd_rej(msg);
					}
				});
		
			});
		};

		// Make sure the interface is correct.
		if( ["wifi", "usb"].indexOf(interface) == -1 ) {
			let msg = "ERROR: Invalid 'interface'";
			res.write(`data:  ${JSON.stringify(msg)}\n\n`);
			reject_sync( msg );
			return;
		}

		// Send the command. 
		let cmd = `cd scripts && ./syncRunner.sh tolocal ${interface}`;
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
const createNotebookPageImages2 = async function(recreateall, messages, obj){
	return new Promise(async function(resolve_top,reject_top){
		// Break out the properties of the object into variables. 
		let { req, res, interface } = obj;

		// Holds changed/new files data. 
		let fileIdsWithChanges = [];

		// Holds the list of commands;
		let cmdList = [];

		// Get the files.json file (or create it if it doesn't exist.)
		let existingFilesJson;
		let returnValue;
		try{ returnValue = await funcs.getExistingJsonFsData(false); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
		existingFilesJson = returnValue.files;
		
		// funcs.getExistingJsonFsData can return a new value for the recreateall flag.
		if(!recreateall){
			recreateall = returnValue.recreateall;
		}

		recreateall=true;

		// Generate data against the synced data on the server. 
		let NewFilesJson;
		try{ NewFilesJson = await funcs.createJsonFsData(false); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }

		// Compare existing and new to detect changes. (new needs to win all conflicts.)

		// Check to see if the files are equal.
		let existingJson = JSON.stringify(existingFilesJson["DocumentType"]).trim();
		let newJson      = JSON.stringify(NewFilesJson["DocumentType"]).trim();

		// Does writeFileSync actually have a callback?? I don't think so. Check.
		fs.writeFileSync(config.htmlPath + "/testExisting.json", existingJson);
		// fs.writeFileSync(config.htmlPath + "/testExisting.json", existingJson), function(err){
		// 	if (err) { console.log("ERROR: ", err); reject(err); }
		// };

		// Does writeFileSync actually have a callback?? I don't think so. Check.
		fs.writeFileSync(config.htmlPath + "/testNew.json", newJson);
		// fs.writeFileSync(config.htmlPath + "/testNew.json", newJson), function(err){
		// 	if (err) { console.log("ERROR: ", err); reject(err); }
		// };

		if(!recreateall && existingJson == newJson ){
			messages.push("createNotebookPageImages: previous and new json are identical. NO changes have been detected.");
			console.log(funcs.getLastValueOfArray(messages));
			res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
			resolve_top( { messages: messages, fileIdsWithChanges: fileIdsWithChanges } );
			return; 
		}
		// They are different. Determine what has changed and only update what has changed.
		else{
			messages.push("createNotebookPageImages: Checking for file changes...");
			console.log(funcs.getLastValueOfArray(messages));
			res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);

			// Get file_id keys for the DocumentType(s) of the existing and new json.
			let keys_existing = Object.keys( existingFilesJson["DocumentType"]);
			let keys_new      = Object.keys( NewFilesJson["DocumentType"] );

			// Loop through each key...
			keys_new.forEach(function(key){
				// Can a handle to each record. 
				let file_existing = existingFilesJson["DocumentType"][key];
				let file_new      = NewFilesJson["DocumentType"][key];

				let file_existing_lastModified ;
				let file_new_lastModified      ;
				let file_existing_visibleName  ;
				let file_new_visibleName       ;
				let file_dir_visibleName       ;

				try{ file_existing_lastModified= file_existing.metadata.lastModified;     } catch(e){ file_existing_lastModified= undefined; }
				try{ file_new_lastModified     = file_new.metadata.lastModified;          } catch(e){ file_new_lastModified     = undefined; }
				try{ file_existing_visibleName = file_existing.metadata.visibleName;      } catch(e){ file_existing_visibleName = undefined; }
				try{ file_new_visibleName      = file_new.metadata.visibleName;           } catch(e){ file_new_visibleName      = undefined; }

				try{ file_existing_lastOpened  = file_existing.metadata.lastOpened;       } catch(e){ file_existing_lastOpened  = undefined; }
				try{ file_new_lastOpened       = file_new.metadata.lastOpened;            } catch(e){ file_new_lastOpened       = undefined; }
				
				try{ file_dir_visibleName      = funcs.getParentDirName(file_new, NewFilesJson);} catch(e){ file_dir_visibleName      = undefined; }

				// if(key == "1ad4e8de-c66c-45e3-b31a-8c301f7bd7e8"){
				// 	console.log("******************** override");
				// 	file_existing = undefined;	
				// }

				// recreateall override?
				if(recreateall){
					console.log("recreateall:", recreateall);

					// messages.push("createNotebookPageImages: recreateall");
					// console.log(funcs.getLastValueOfArray(messages));
					// res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
					fileIdsWithChanges.push({
						"key": key, 
						"change": "newfile",
						"oldFile":file_existing,
						"newFile":file_new,
						"DEBUG": {
							"existing_visibleName" : file_existing_visibleName,
							"new_visibleName"      : file_new_visibleName,
							"dir_visibleName"      : file_dir_visibleName,
						}
					});
				}
				// NEW FILE: Does the file exist in new but not in existing?
				else if(file_existing == undefined && file_new != undefined){
					// File will need to have it's images created.
					messages.push("createNotebookPageImages: New file: FILE: " + file_new_visibleName + " (PARENT: " + file_dir_visibleName + ")");
					console.log(funcs.getLastValueOfArray(messages));
					res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
					fileIdsWithChanges.push({
						"key": key, 
						"change": "newfile",
						"oldFile":file_existing,
						"newFile":file_new,
						"DEBUG": {
							"existing_visibleName" : file_existing_visibleName,
							"new_visibleName"      : file_new_visibleName,
							"dir_visibleName"      : file_dir_visibleName,
						}
					});
				}
				// DELETED FILE: Does the file exist in existing but not in new?
				else if(file_existing != undefined && file_new == undefined){
					// File will need to have it's images deleted.
					messages.push("createNotebookPageImages: Delete: FILE: " + file_new_visibleName + " (PARENT: " + file_dir_visibleName + ")");
					console.log(funcs.getLastValueOfArray(messages));
					res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
					fileIdsWithChanges.push({
						"key": key, 
						"change": "delete",
						"oldFile":file_existing,
						"newFile":file_new,
						"DEBUG": {
							"existing_visibleName" : file_existing_visibleName,
							"new_visibleName"      : file_new_visibleName,
							"dir_visibleName"      : file_dir_visibleName,
						}
					});
				}
				// BOTH EXIST: Does the file exist in both existing AND new?
				else if(file_existing != undefined && file_new != undefined){
					// File exists on both sides.
					
					// Check if the lastModified date is newer and if the name changed.
					let isModified = file_existing_lastModified < file_new_lastModified;
					let isRenamed  = file_existing_visibleName  != file_new_visibleName;

					// Modified file? 
					if(isModified || isRenamed){
						messages.push("createNotebookPageImages: Update: FILE: " + file_new_visibleName + " (PARENT: " + file_dir_visibleName + ")");
						console.log(funcs.getLastValueOfArray(messages));
						res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
						fileIdsWithChanges.push({
							"key": key, 
							"change": "updated",
							"oldFile":file_existing,
							"newFile":file_new,
							"DEBUG": {
								"existing_visibleName" : file_existing_visibleName,
								"new_visibleName"      : file_new_visibleName,
								"dir_visibleName"      : file_dir_visibleName,
							}
						});
					}
					// Recently opened file?
					else if(file_existing_lastOpened  != file_new_lastOpened){
						messages.push("createNotebookPageImages: Update: (lastOpened), FILE: " + file_new_visibleName + " (PARENT: " + file_dir_visibleName + ")");
						console.log(funcs.getLastValueOfArray(messages));
						res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
					}
				}
				// This should never happen.
				else{
					messages.push("createNotebookPageImages: (NO MATCH): FILE: " + file_new_visibleName + " (PARENT: " + file_dir_visibleName + ")");
					console.log(funcs.getLastValueOfArray(messages));
					res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
				}
			});

			//
			for(let i=0; i<fileIdsWithChanges.length; i+=1){
				let obj = fileIdsWithChanges[i];
				let regenerateAllPages=false;

				if(recreateall){
					// messages.push("createNotebookPageImages:   recreateall.");
					// console.log(funcs.getLastValueOfArray(messages)); 
					// res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);

					// Just regenerate all the pages. 
					regenerateAllPages = true; 
				}
				else if(obj.change=="updated"){
					// Have the number of pages changed?
					if( obj.oldFile.content.pages.length != obj.newFile.content.pages.length ){
						messages.push("createNotebookPageImages:   Page count change. (" + obj.newFile.metadata.visibleName + ") : " +obj.oldFile.content.pages.length + " vs " + obj.newFile.content.pages.length );
						console.log(funcs.getLastValueOfArray(messages));
						res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);

						// If there are less pages now then the page numbers on the files will be wrong.
						//

						// If there are more pages now then the new pages will need to be processed (rm to svg to png.
						// obj.oldFile.content.pages 
						// obj.newFile.content.pages 
						// obj.newFile.content.pages.unshift(obj.newFile.content.pages.pop());
						// // https://stackoverflow.com/a/33034768/2731377
						// let difference = obj.oldFile.content.pages
						// 					.filter(x => !obj.newFile.content.pages.includes(x))
						// 					.concat(obj.newFile.content.pages.filter(x => !obj.oldFile.content.pages.includes(x)));
						// console.log("difference:", difference);

						// Just regenerate all the pages. 
						regenerateAllPages = true; 
					}
					// Has the order of the pages changed?
					else if( obj.oldFile.content.pages.toString() != obj.newFile.content.pages.toString() ){
						messages.push("createNotebookPageImages:   Page order change. (" + obj.newFile.metadata.visibleName + ")" );
						console.log(funcs.getLastValueOfArray(messages)); 
						res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);

						// Just regenerate all the pages. 
						regenerateAllPages = true; 
					}
					// Just a data change on the file.
					else{
						messages.push("createNotebookPageImages:   Page data change. (" + obj.newFile.metadata.visibleName +")");
						console.log(funcs.getLastValueOfArray(messages)); 
						res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
	
						// Regenerate THIS page.
						//

						// Just regenerate all the pages. 
						regenerateAllPages = true; 
					}
				}
				else if(obj.change=="newfile"){
					messages.push("createNotebookPageImages:   New file. (" + obj.newFile.metadata.visibleName + ")" );
					console.log(funcs.getLastValueOfArray(messages)); 
					res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);

					// resolve_top( { messages: messages, cmdList: cmdList } );
					regenerateAllPages=true;
				}
				else if(obj.change=="delete"){
					// resolve_top( { messages: messages, cmdList: cmdList } );
					messages.push("createNotebookPageImages:   Deleted file. (" + obj.newFile.metadata.visibleName + ")" );
					console.log(funcs.getLastValueOfArray(messages)); 
					res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
					regenerateAllPages=true;
				}
				else{
					// Unknown change type. 
					messages.push("createNotebookPageImages:   UNKNOWN CHANGE TYPE. (" + obj.newFile.metadata.visibleName + ")" );
					console.log(funcs.getLastValueOfArray(messages)); 
					res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
					reject_top("UNKNOWN CHANGE TYPE");
				}
				
				if(regenerateAllPages){
					// Get a list of the source .rm files.
					let srcRmFiles ;
					try{ srcRmFiles = await funcs.getItemsInDir(config.dataPath + obj.key, "files"); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }
					srcRmFiles = srcRmFiles
						.filter(function(d){ if(d.filepath.indexOf(".rm") != -1){ return true; } })
						.map( function(d){ return d.filepath; }) 
					;

					// Get a list of page ids from .context.
					let pages = obj.newFile.content.pages;

					// For each .rm file, in order by pages...
					pages.forEach(function(page, page_i){
						let fileType        = obj.newFile.content.fileType;
						let baseFileName;
						let baseFileName2;
						let pageNum;
						let fullOutputName;
						let fullOutputName2;
						let fullOutputName_page;
						let fullOutputName2_page;

						let srcFile         = config.dataPath + obj.key + "/" + page + ".rm";
						let cmd  ;
						let cmd2 ;
						let cmd3 ;
						let cmd4 ;
						let cmd5 ;

						let dest_fullName;
						if(fileType == "notebook"){
							baseFileName    = obj.newFile.metadata.visibleName.replace(/[^A-Z0-9]+/ig, "_");
							dest_fullName   = config.imagesPath + obj.key + "/" + baseFileName ;
							pageNum         = page_i.toString().padStart(3, "0");
							fullOutputName  = `${dest_fullName}_PAGE_${pageNum}.svg`;
							fullOutputName2 = `${dest_fullName}_PAGE_${pageNum}.min.svg`;
							cmd             = `python3 scripts/rM2svg.py -i ${srcFile} -o ${fullOutputName}`;
							cmd2            = `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" -i ${fullOutputName} -o ${fullOutputName2} `;
							cmd3            = `rm ${fullOutputName}`;
						}
						else if(fileType == "pdf"){
							baseFileName    = page;
							dest_fullName   = config.imagesPath + obj.key + "/" + "annotations/" + baseFileName ;
							pageNum         = page_i.toString().padStart(3, "0");
							fullOutputName  = `${dest_fullName}.svg`;
							fullOutputName2 = `${dest_fullName}.min.svg`;
							cmd             = `python3 scripts/rM2svg.py -i ${srcFile} -o ${fullOutputName}`;
							cmd2            = `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" -i ${fullOutputName} -o ${fullOutputName2} `;
							cmd3            = `rm ${fullOutputName}`;
							
							baseFileName2    = obj.newFile.metadata.visibleName.replace(/[^A-Z0-9]+/ig, "_") + "-" + page_i;
							fullOutputName_page  = config.imagesPath + obj.key + "/" + "" + baseFileName2 + ".svg";
							fullOutputName2_page = config.imagesPath + obj.key + "/" + "" + baseFileName2 + ".min.svg";
							cmd4            = `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" -i ${fullOutputName_page} -o ${fullOutputName2_page} `;
							cmd5            = `rm ${fullOutputName_page}`;
						}

						// Check here that the file exists.
						if( fs.existsSync(srcFile) ){
							// Add the full command and info.
							cmdList.push({
								cmd                 : cmd, 
								cmd2                : cmd2, 
								cmd3                : cmd3, 
								cmd4                : cmd4, 
								cmd5                : cmd5, 
								key                 : obj.key,
								page_i              : page_i,
								numPages            : pages.length,
								clearFirst          : true,
								srcFile             : srcFile,
								srcRmDir            : config.dataPath + obj.key,
								destDir             : config.imagesPath + obj.key,
								fullOutputName      : fullOutputName,
								fullOutputName2     : fullOutputName2,
								baseFileName        : baseFileName + "_PAGE_" + pageNum,
								baseFileName2       : baseFileName2,
								fileType            : fileType,
								page                : page,
								fullOutputName_page : fullOutputName_page,
								fullOutputName2_page: fullOutputName2_page,
							});
						}
						else{
							// console.log("File doesn't exist! Skipping.");
						}

					});
				}
			}
			
			// Is there something to do?
			if(cmdList.length){
				messages.push("createNotebookPageImages: There are " + cmdList.length + " changes");
				console.log(funcs.getLastValueOfArray(messages));
				res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);

				try{ await optimizeImages2(cmdList, messages, {res:res, req:req}); } catch(e){ console.log("failure: optimizeImages", e); reject_top(); return; }
				
				resolve_top( { messages: messages } );
				return; 
			}
			else{
				messages.push("1 createNotebookPageImages: No changes to notebooks have been made.");
				console.log( funcs.getLastValueOfArray(messages) );
				res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
				
				// ****************
				stamp = timeIt.stamp("optimizeImages.funcs.createJsonFsData", null);
				res.write(`data: ${JSON.stringify( "STARTING FILES.JSON" )}\n\n`);
				try{ await funcs.createJsonFsData(true); console.log("createNotebookPageImages: Wrote json data."); } catch(e){ console.log("failure: funcs.createJsonFsData", e); reject_top(); return; }
				res.write(`data: ${JSON.stringify( "FINISHED FILES.JSON" )}\n\n`);
				timeIt.stamp("optimizeImages.funcs.createJsonFsData", stamp);
				// ****************
				
				console.log(funcs.getLastValueOfArray(messages));
				console.log( funcs.getLastValueOfArray(messages) );
				console.log("No commands to run.", "cmdList.length:", cmdList.length);
				res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
				resolve_top( { messages: messages } );
				return;
			}

		}
	});
};
const optimizeImages2           = async function(cmdList, messages, obj){
	return new Promise(async function(resolve_top,reject_top){
		// Break out the properties of the object into variables. 
		let { req, res, interface } = obj;

		// Remove the specified dirs.
		const removeDirs = function(cmdList){
			return new Promise(async function(resolve_removeDirs, reject_removeDirs){
				// Get directories used by each notebook and remove duplicate directories.
				let dirs = [];
				cmdList.forEach(function(d){
					if(dirs.indexOf(d.destDir) == -1) { dirs.push(d.destDir); }
				});

				let proms = [];
				for(let i=0; i<dirs.length; i+=1){
					let func = function(dirPath){
						return new Promise(function(res, rej){
							// Check if the dir exists. 
							let dir_existsSync;
							try{ dir_existsSync = fs.existsSync(dirPath); } catch(e){ console.log("ERROR in existsSync.", dirPath, e); rej(); return; } 
							
							// Remove the directory recursively if it exists.
							if( dir_existsSync ){
								let dir_rmdirSync;
								try { dir_rmdirSync = fs.rmdirSync(dirPath, { recursive: true }); } catch(e){ console.log("ERROR in rmdirSync.", dirPath, e); rej(); return; } 
							}
							
							// Create the directory.
							let dir_mkdirSync;
							try { dir_mkdirSync = fs.mkdirSync(dirPath); } catch(e){ console.log("ERROR in mkdirSync.", dirPath, e); rej(); return; } 
							
							// Resolve.
							res(dirPath);
						});
					};
					proms.push(func(dirs[i]));
				}

				Promise.all(proms).then(
					function(data){ 
						console.log("Total dirs:", data.length); 
						resolve_removeDirs(dirs); 
					},
					function(err){ console.log(err); reject_removeDirs(dirs); process.exit(1); }
				);
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

		// Remove the relevant directories. 
		let dirs ;
		try{ dirs = await removeDirs(cmdList); } catch(e){ console.log("failure: removeDirs", e); }

		// Create pdf images if there are any. 
		try{ await createPdfImages(cmdList); } catch(e){ console.log("failure: createPdfImages", e); }

		// const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
		// await delay(30000); /// waiting 1 second.
		
		// First, run all cmd1 to convert the .rm files to an unoptizized .svg.
		// Next, run each cmd2 immediately followed by cmd3.
		// Result: only the optimized .svg remains although the unoptimized .svg is available while optimizing.

		console.log("-----------");
		cmdList.forEach(function(d){
			console.log(d.baseFileName, " -- ", d.srcFile);
		});
		console.log("-----------");

		let currentCmd = 0;
		let totalCmds  = cmdList.length;
		let stamp;
		stamp = timeIt.stamp("optimizeImages.rM2svg.py", null);
		let prom_cmd1 = async_mapLimit(cmdList, 2, async function(rec, callback){
			// Create the directory.if it doesn't exist.
			// if( !fs.existsSync(rec.destDir) ){ fs.mkdirSync(rec.destDir); }
			
			console.log("===========");
				console.log("PAGE:", rec.page);

			// rec.pages.forEach(function(d){
			// 	console.log("PAGE:", d);
			// });
			console.log("===========");

			// Convert .rm file to .svg.
			let cmd = rec.cmd;
			let response;
			
			try{ 
				// if( !fs.existsSync(rec.srcFile) ){ 
				if( !fs.existsSync(rec.page) ){ 
					response = await funcs.runCommand_exec_progress(cmd, 0, false); 
				}
				else{
					console.log("  file was missing:", rec.page, rec.srcFile);
					callback(null, rec);
					return;
				}
			} 
			catch(e){ 
				console.log("failure: optimizeImages: rM2svg.py:", e, cmd.length, "of", 32000); 
				throw rec.cmd; 
				// content.fileType
			}
			currentCmd += 1;
			if(response){
				if(response.stdOutHist) { console.log("stdOutHist:", response.stdOutHist); }
				if(response.stdErrHist) { console.log("stdErrHist:", response.stdErrHist); }
			}
			
			messages.push(`  optimizeImages: ${currentCmd}/${totalCmds} rM2svg.py: DONE: ${rec.fullOutputName}`);
			console.log(funcs.getLastValueOfArray(messages));
			res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
			
			callback(null, rec);
			
		})
		.then(
			function(data){ 
				timeIt.stamp("optimizeImages.rM2svg.py", stamp);

				stamp = timeIt.stamp("optimizeImages.svgo rm", null);

				let currentCmd = 0;
				let totalCmds  = cmdList.length;
				let prom_cmd1and2 = async_mapLimit(cmdList, 2, async function(rec, callback){
					let cmd;
					let response;
					
					cmd = rec.cmd2;
					try{ response = await funcs.runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: svgo", e, cmd.length, "of", 32000); throw rec.cmd2; }
					currentCmd += 1;
					let respLines = response.stdOutHist.split("\n");
					if(response.stdOutHist) { 
						let msg;
						try{
							msg = `  optimizeImages: ${currentCmd}/${totalCmds} svgo     : DONE: ${rec.fullOutputName2} (${respLines[3].split(" - ")[1].split("%")[0]}% reduction)`;
						}
						catch(e){
							msg = `  optimizeImages: ${currentCmd}/${totalCmds} svgo     : DoNE: ${rec.fullOutputName2}`;
						}
						messages.push(msg);
						console.log(funcs.getLastValueOfArray(messages));
						res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
						// console.log("stdOutHist:", "svgo:   ", response.stdOutHist.replace(/\n/g, " ").trim()); 
					}

					if(response.stdErrHist) { 
						console.log("stdErrHist:", response.stdErrHist); 
					}

					cmd = rec.cmd3;
					try{ response = await funcs.runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: rm", e, cmd.length, "of", 32000); throw rec.cmd3;}
					if(response.stdOutHist) { console.log("stdOutHist:", response.stdOutHist); }
					if(response.stdErrHist) { console.log("stdErrHist:", response.stdErrHist); }
					
					if(rec.fileType == "pdf"){
						console.log("***** PDF-SPECIFIC COMMANDS *****");
						console.log(rec.cmd4);
						console.log(rec.cmd5);

						cmd = rec.cmd4;
						try{ response = await funcs.runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: svgo", e, cmd.length, "of", 32000); throw rec.cmd4; }
						currentCmd += 1;
						let respLines = response.stdOutHist.split("\n");
						if(response.stdOutHist) { 
							let msg;
							try{
								msg = `  optimizeImages: ${currentCmd}/${totalCmds} svgo     : DONE: ${rec.fullOutputName2_page} (${respLines[3].split(" - ")[1].split("%")[0]}% reduction)`;
							}
							catch(e){
								msg = `  optimizeImages: ${currentCmd}/${totalCmds} svgo     : DoNE: ${rec.fullOutputName2_page}`;
							}
							messages.push(msg);
							console.log(funcs.getLastValueOfArray(messages));
							res.write(`data: ${JSON.stringify( funcs.getLastValueOfArray(messages) )}\n\n`);
							// console.log("stdOutHist:", "svgo:   ", response.stdOutHist.replace(/\n/g, " ").trim()); 
						}

						cmd = rec.cmd5;
						try{ response = await funcs.runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: rm", e, cmd.length, "of", 32000); throw rec.cmd4;}
						if(response.stdOutHist) { console.log("stdOutHist:", response.stdOutHist); }
						if(response.stdErrHist) { console.log("stdErrHist:", response.stdErrHist); }
					}

					callback(null, rec);
				})
				.then(
					async function(){ 
						timeIt.stamp("optimizeImages.svgo rm", stamp);

						// ****************
						stamp = timeIt.stamp("optimizeImages.funcs.createJsonFsData", null);
						res.write(`data: ${JSON.stringify( "STARTING FILES.JSON" )}\n\n`);
						try{ await funcs.createJsonFsData(true); console.log("optimizeImages: Wrote json data."); } catch(e){ console.log("failure: funcs.createJsonFsData", e); }
						res.write(`data: ${JSON.stringify( "FINSIHED FILES.JSON" )}\n\n`);
						timeIt.stamp("optimizeImages.funcs.createJsonFsData", stamp);
						// ****************

						resolve_top(messages);
					},
					function(err){ console.log("err:", err); }
				);
			},
			function(err){ console.log("err:", err); },
		);
	});
}; 

const updateAll2 = function(obj){
	return new Promise(async function(res_top, rej_top){
		// Break out the properties of the object into variables. 
		let { req, res, interface } = obj;
		
		// START THE SSE STREAM.
		res.writeHead(200, { 
			"Content-Type": "text/event-stream",
			// 'Connection': 'keep-alive',
			"Cache-control": "no-cache" 
		});

		// DO SYNC.
		res.write(`data: ${JSON.stringify("STARTING SYNC.")}\n\n`);
		try{ await sync({res:res, req:req, interface:interface}); } 
		catch(e){ 
			console.log("ERROR: SYNC", e); 
			
			// Return the rejection error.
			res.write(`data:  ${JSON.stringify(e)}\n\n`);

			// END THE SSE STREAM.
			let endString = "==--ENDOFDATA--==";
			res.write(`data:  ${JSON.stringify(endString)}\n\n`);
			res.end();

			// REJECT AND RETURN.
			rej_top(e); 
			return; 
		}
		res.write(`data: ${JSON.stringify("FINISHED SYNC.")}\n\n`);

		// DO IMAGES.
		let messages = [];
		res.write(`data: ${JSON.stringify("STARTING IMAGES.")}\n\n`);
		try{ await createNotebookPageImages2(false, messages, {res:res, req:req}); } 
		catch(e){ 
			console.log("ERROR: IMAGES", e); 
			
			// END THE SSE STREAM.
			let endString = "==--ENDOFDATA--==";
			res.write(`data:  ${JSON.stringify(endString)}\n\n`);
			res.end();

			// REJECT AND RETURN.
			rej_top(e); 
			return; 
		}
		res.write(`data: ${JSON.stringify("FINISHED IMAGES.")}\n\n`);
		
		res.write(`data: ${JSON.stringify("")}\n\n`);
		res.write(`data: ${JSON.stringify("SYNC/IMAGES FINISHED SUCCESSFULLY!")}\n\n`);
		console.log("DONE");

		// FINISH THE SSE STREAM.
		let endString = "==--ENDOFDATA--==";
		res.write(`data:  ${JSON.stringify(endString)}\n\n`);
		res.end();

		// RESOLVE.
		res_top();
	});

};

module.exports = {
	updateAll2: updateAll2,
	_version  : function(){ return "Version 2021-09-23"; }
};