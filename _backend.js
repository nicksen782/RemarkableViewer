/*jshint esversion: 6 */
// Libraries/frameworks from NPM.
const express         = require('express'); // npm install express
// const compression     = require('compression');
const app             = express();
const path            = require('path');
const { spawn }       = require('child_process');
const fs              = require('fs');
const async_mapLimit  = require('promise-async').mapLimit;
const fkill           = require('fkill');

// Personal libraries/frameworks.
const timeIt = require('./timeIt.js');

// CONFIGS 
var config = JSON.parse(fs.readFileSync('configFile.json', 'utf8'));
const port        = config.port;
const host        = config.host;
const scriptsPath = config.scriptsPath;
const dataPath    = config.dataPath;
const imagesPath  = config.imagesPath;
const htmlPath    = config.htmlPath;

// UTILITY FUNCTIONS - SHARED.
const getLastValueOfArray      = function(arr){
	return arr[arr.length-1];
};
const getItemsInDir            = async function(targetPath, type, ext=""){
	if(["files", "dirs"].indexOf(type) == -1){
		let msg = "";
		console.log(msg);
		throw msg;
		return ;
	}

	const files = await fs.promises.readdir(targetPath);
	const fetchedFiles = [];

	for (let file of files) {
		try {
			const filepath = path.join(targetPath, file);
			const stats = await fs.promises.lstat(filepath);
	
			if(type=="files"){
				if (stats.isFile() && file.lastIndexOf(ext) != -1) {
					fetchedFiles.push({ filepath });
				}
			}
			
			else if(type=="dirs"){
				if (stats.isDirectory() && file.lastIndexOf(ext) != -1) {
					fetchedFiles.push({ filepath });
				}
			}
		} 
		catch (err) {
			console.error(err);
			throw err;
			return;
		}
	}
  
	return fetchedFiles;
};
// Get the visibleName of the file found within files. 
const getParentDirName         = function(file, files, returnNameAndId=false){
	// Cosmetic. "" is shown as "My files"
	if(file.metadata.parent == ""){
		return "My files";
	}
	else if(file.metadata.parent == "trash"){
		return "trash";
	}
	else{
		try{
			if(!returnNameAndId){
				return files["CollectionType"][file.metadata.parent].metadata.visibleName;
			}
			else{
				return {
					"nextId"    : files["CollectionType"][file.metadata.parent].metadata.parent,
					"parentId"  : file.metadata.parent,
					"parentName": files["CollectionType"][file.metadata.parent].metadata.visibleName,
				}
			}
		}
		catch(e){
			// console.log("****", file.metadata.parent, "****", e);
			// console.log("****", file.metadata.parent, "****", file);
			return "ERROR" + file.metadata.parent;
		}
	}
};
const getParentPath            = function(id, type, files){
	let fullPath = [];

	let file = files[type][id];
	// console.log(files[type][id]); return "";

	let currId = file.metadata.parent;
	let isAtRoot = false;
	let isAtTrash = false;
	for(let i=0; i<20; i+=1){
		// Reached root?
		if(currId == "" || file.metadata.parent == ""){ isAtRoot=true; break; }
		
		let obj = getParentDirName({ metadata: { parent: currId } }, files, true) ;
		if(obj == "trash" || file.metadata.parent == "trash"){ isAtTrash=true; break; }

		currId = obj.nextId;
		fullPath.push(obj.parentName);
	}

	if(isAtRoot){
		fullPath.push("/My files");
	}
	else if(isAtTrash){
		fullPath.push("/trash");
	}

	fullPath.reverse();

	fullPath = fullPath.join("/") + "/";
	return fullPath;
};
// Runs a specified command (with promise, and progress)
const runCommand_exec_progress = async function(cmd, expectedExitCode=0, progress=true){
	return new Promise(function(cmd_res, cmd_rej){
		const proc = spawn(cmd, { shell: true });

		let stdOutHist = "";
		let stdErrHist = "";

		proc.stdout.on('data', (data) => {
			if(progress){
				// console.log(`  stdout: ${data}`);
				console.log(`  ${data}`);
			}
			stdOutHist += data;
		});

		proc.stderr.on('data', (data) => {
			if(progress){
				console.error(`  ${data}`);
				// console.error(`  stderr: ${data}`);
			}
			stdErrHist += data;
		});

		proc.on('close', (code) => {
			if(code == expectedExitCode){ 
				cmd_res({
					"stdOutHist": stdOutHist,
					"stdErrHist": stdErrHist,
				}); 
			}
			else{
				console.log(`  child process exited with code ${code}`);
				cmd_rej({
					"stdOutHist": stdOutHist,
					"stdErrHist": stdErrHist,
				});
			}
		});

	});

};
const runCommand_exec_progressStream = async function(cmd, useSse=false, expectedExitCode=0, progress=true){
	return new Promise(function(cmd_res, cmd_rej){
		const child = spawn(cmd, { shell: true });
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');

		let stdOutHist = "";
		let stdErrHist = "";

		child.stdout.on('data', (data) => {
			if(progress){
				// console.log(`  stdout: ${data}`);
				console.log(`  ${data}`);
			}
			if(useSse){
				sse.send( data.trim() );
			}
			stdOutHist += data;
		});

		child.stderr.on('data', (data) => {
			if(progress){
				console.error(`  ${data}`);
				// console.error(`  stderr: ${data}`);
			}
			if(useSse){
				sse.send( data.trim() );
			}
			stdErrHist += data;
		});

		child.on('close', (code) => {
			if(code == expectedExitCode){ 
				cmd_res({
					"stdOutHist": stdOutHist,
					"stdErrHist": stdErrHist,
					"useSse"    : useSse,
				}); 
			}
			else{
				console.log(`  child process exited with code ${code}`);
				cmd_rej({
					"stdOutHist": stdOutHist,
					"stdErrHist": stdErrHist,
					"useSse"    : useSse,
				});
			}
		});

	});
};

// FUNCTIONS - SHARED.
const createJsonFsData         = async function(writeFile){
	return new Promise(async function(resolve, reject){
		const getAllJson = function(fileList, basePath){
			return new Promise(function(res, rej){
				let json = {
					"CollectionType": [],
					"DocumentType": [],
				};
				let proms = [];
				fileList.forEach(function(file){
					proms.push(
						new Promise(function(res1, rej1){
							let metadata_filename = path.join(basePath, file);
							fs.readFile(metadata_filename, function (err, file_buffer) {
								if (err) {
									console.log("ERROR READING FILE 1", metadata_filename, err); 
									rej1([metadata_filename, err]); 
									return;
								}
								
								// Start creating the new json entry.
								let newObj = {};
		
								// Create metadata.
								newObj.metadata = JSON.parse(file_buffer);
		
								// DEBUG: Remove keys
								if(newObj.metadata.type == "CollectionType"){
									delete newObj.metadata.deleted;
									// delete newObj.metadata.modified;
									// delete newObj.metadata.pinned;
									// delete newObj.metadata.synced;
									delete newObj.metadata.metadatamodified;

									// delete newObj.metadata.lastModified;
									// delete newObj.metadata.version;
								}
								else if(newObj.metadata.type == "DocumentType"){
									delete newObj.metadata.deleted;
									// delete newObj.metadata.modified;
									// delete newObj.metadata.pinned;
									// delete newObj.metadata.synced;
									delete newObj.metadata.metadatamodified;
									// delete newObj.metadata.lastOpened;     
									// delete newObj.metadata.lastOpenedPage; 

									// delete newObj.metadata.lastModified;
									// delete newObj.metadata.version;
								}
		
								// Create extra.
								newObj.extra = {};
								newObj.extra["_thisFileId"] = file.replace(".metadata", "");

								// newObj.extra["_thisFileId"] = file.replace(".metadata", "");
		
								
								// Get the .content file too.
								let content_filename = path.join(basePath, file.replace(".metadata", ".content") );
								fs.readFile(content_filename, function (err, file_buffer2) {
									if (err) {
										console.log("ERROR READING FILE 2", content_filename, err); 
										rej1([content_filename, err]); 
										return;
									}
		
									// Create content.
									newObj.content = JSON.parse(file_buffer2);
		
									// ********** NEW PRE-FILTERING **********
									let check0 = newObj.metadata.type         == "CollectionType";
									let check1 = newObj.content.fileType      != "notebook" && newObj.content.fileType != "pdf";
									let check2 = newObj.content.dummyDocument != false;
									let check3 = newObj.metadata.parent       == "trash";

									// Remove the remaining unneeded keys.
									delete newObj.content.coverPageNumber;
									delete newObj.content.documentMetadata;
									delete newObj.content.extraMetadata;
									delete newObj.content.fontName;
									delete newObj.content.lineHeight;
									delete newObj.content.transform;
									
									// Allow all CollectionType.
									if(check0){
										json[newObj.metadata.type].push(newObj);

										res1(); return; // Resolve.
									}
									// Only compare notebooks. 
									else if(check1){
										// console.log("Skipping non-notebook.");
										res1(); return; // Resolve.
									}
									// Ignore dummyDocument true.
									else if(check2){
										// console.log("Skipping dummyDocument.");
										res1(); return; // Resolve.
									}
									// Ignore trash.
									else if(check3){
										// console.log("Skipping trash.");
										res1(); return; // Resolve.
									}
									// Add the completed record.
									else {
										// Get the .pagedata file too if it exists.
										let pagedata_filename = path.join(basePath, file.replace(".metadata", ".pagedata") );
										if( fs.existsSync(pagedata_filename) ) {
											fs.readFile(pagedata_filename, function (err, file_buffer3) {
												if (err) {
													console.log("ERROR READING FILE 3", pagedata_filename, err); 
													rej1([pagedata_filename, err]); 
													return;
												}
												newObj.pagedata = file_buffer3.toString().trim().split("\n");
												newObj.extra["_firstPageId"] = newObj.content.pages[0]; // Save the first page. 
												json[newObj.metadata.type].push(newObj);
												res1(); return; // Resolve.
											});
										}
										else{
											newObj.pagedata = "";
											newObj.extra["_firstPageId"] = newObj.content.pages[0]; // Save the first page. 
											json[newObj.metadata.type].push(newObj);
											res1(); return; // Resolve.
										}

									}
									
								});
		
							});
						})
					);
				});
		
				Promise.all(proms).then(
					function(success){
						// console.log("SUCCESS: createJsonFsData: ", success.length, "files.");
						res(json);
					},
					function(error){
						console.log("ERROR:", error);
						rej();
					}
				);
			});
		};
		const createDirectoryStructure = function(fileList){
			return new Promise(function(res, rej){
				let dirs = {};
				let files = {};
		
				// Creates "dirs"
				// console.log(fileList.CollectionType["546a43d3-59ae-4a23-95ac-ba8218866e64"]);
				// console.log(fileList.DocumentType["546a43d3-59ae-4a23-95ac-ba8218866e64"]);
				// console.log(fileList.CollectionType);
				// console.log(fileList.DocumentType);

				fileList["CollectionType"].forEach(function(d){
					// Skip trash.
					if(d.metadata.parent == "trash"){ return; }

					// Create the object if it doesn't exist.
					if(!dirs[d.metadata.parent]){
						dirs[d.extra._thisFileId] = {};
					}
		
					// Add to the object
					dirs[d.extra._thisFileId] = {
						metadata: d.metadata,
						content: d.content,
						extra: d.extra,
						
						// DEBUG
						path: [],
						name: d.metadata.visibleName
					};

				});
		
				// Creates "files"
				fileList["DocumentType"].forEach(function(d){
					// Skip trash.
					if(d.metadata.parent == "trash"){ return; }

					// Create the object if it doesn't exist.
					if(!files[d.metadata.parent]){
						// Save the the id of this file.. 
						files[d.extra._thisFileId] = {};
					}
		
					// Add to the object
					files[d.extra._thisFileId] = {
						metadata: d.metadata,
						content: d.content,
						extra: d.extra,
						pagedata: d.pagedata,
						
						// DEBUG
						path: [],
						name: d.metadata.visibleName
					};
				});
		
				let fin = {
					"CollectionType":dirs,
					"DocumentType":files,
				};
		
				// Update the path value for CollectionType.
				for(let key in fin.CollectionType){
					let rec = fin.CollectionType[key];
					rec.path = getParentPath(rec.extra._thisFileId, "CollectionType", fin);
				}
				// Update the path value for DocumentType.
				for(let key in fin.DocumentType){
					let rec = fin.DocumentType[key];
					rec.path = getParentPath(rec.extra._thisFileId, "DocumentType", fin);
				}

				res(fin);
			});
		};

		let files = await getItemsInDir(dataPath, "files");
		files = files.filter(function(d){
			if(d.filepath.indexOf(".metadata") != -1){ return true; }
		})
		.map(
			function(d){
				let base = d.filepath.replace(dataPath, "");
				return base;
			})
		;

		files = await getAllJson(files, dataPath);

		files = await createDirectoryStructure(files);
		
		if(writeFile){
			fs.writeFileSync(htmlPath + "/files.json", JSON.stringify(files,null,0), function(err){
				if (err) { console.log("ERROR: ", err); reject(err); }
			});
		}

		resolve(files);
	});
};
const getExistingJsonFsData    = async function(recreateIfMissing = true){
	return new Promise(async function(resolve,reject){
		let files;
		let recreateall = false;
		if( !fs.existsSync(htmlPath + "/files.json") ){
			// if(recreateIfMissing){
				// console.log("getExistingJsonFsData: no existing data. Creating it now.");
				try{ files = await createJsonFsData(true); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
			// }
			// else{
				// console.log("getExistingJsonFsData: no existing data. recreateIfMissing was set to false. Not creating data.");
			// }
			recreateall = true;
		}
		else{
			// console.log("getExistingJsonFsData: Data exists, retrieving it.");
			files = fs.readFileSync(htmlPath + "/files.json");
			files = JSON.parse(files);
		}

		resolve({recreateall:recreateall, files:files});
	});
};
const updateRemoteDemo         = async function(){
	return new Promise(async function(resolve,reject){
		/**
		 * Get the files.json
		 * Look for directories that match dirIds.
		 * Look for files that are within the directories specified by dirIds.
		 * Change the first directory in dirIds to have a parent of "". (should be the lowest parent of the other folders in dirIds.)
		 * Change the "Getting Started" notebook to have a parent of "". (should be the lowest parent of the other folders in dirIds.)
		 * Write the json results to scripts/demo_files.json.
		 * Create the rsync --include-from filter file and write it to scripts/updateRemoteDemo.filter.
		 * Run the scripts/updateRemoteDemo.sh file for each section, passing in the correct 'part' argument.
		 * Write the combined command responses to scripts/updateRemoteDemo.resps.json in case debugging is needed.
		 * Resolve with the combined command responses.
		 */

		let files;
		try{ files = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
		files = files.files;

		// Get a list of all files and directories within "Remarkable Page Turner"
		let newFilesJson = {
			"CollectionType": {}, 
			"DocumentType"  : {}, 
		};
		// Dirs of the parent "Remarkable Page Turner" directory..
		let dirIds = [
			"4f668058-bfd5-402f-a4dd-e7a3e83f1578", // "Remarkable Page Turner" directory (parent)
			"4d763cad-5f31-4afd-bcd8-e7e77dd9ee60", // "Old notes" directory
			"05593124-305f-478d-b603-1a62993f0c20", // "Drawings
		];
		// Get the directories for the "Remarkable Page Turner/Old notes" directory.
		for(let key in files.CollectionType){
			let rec = files.CollectionType[key];
			if(dirIds.indexOf(rec.extra._thisFileId) != -1){
				newFilesJson.CollectionType[rec.extra._thisFileId] = rec;
			}
		}
		// Get the files for the "Remarkable Page Turner" directory.
		for(let key in files.DocumentType){
			let rec = files.DocumentType[key];
			if(dirIds.indexOf(rec.metadata.parent) != -1){
				newFilesJson.DocumentType[rec.extra._thisFileId] = rec;
			}
		}
		
		// Modify the "Remarkable Page Turner" (first dirId) directory to change it's parent to "".
		newFilesJson.CollectionType[dirIds[0]].metadata.parent = "";
		// Change the "Getting Started" notebook to have a parent of "". (should be the lowest parent of the other folders in dirIds.)
		newFilesJson.DocumentType["78f004b5-c3ec-44f6-b624-0f47d1eacb0c"].metadata.parent = "";
		
		// Create a demo_files.json with only that data.
		fs.writeFileSync(scriptsPath + "/demo_files.json", JSON.stringify(newFilesJson,null,1), function(err){
			if (err) { console.log("ERROR: ", err); reject(err); }
		});

		// Create the include/filter file.
		let filterText = [];
		filterText.push("+ /./");
		filterText.push("");
		for(let key in newFilesJson.DocumentType){
			let rec = newFilesJson.DocumentType[key];
			filterText.push("+ " + key + "*");
		}
		filterText.push("");
		filterText.push("- /*");
		// Write the include/filter file.
		fs.writeFileSync(scriptsPath + "/updateRemoteDemo.filter", filterText.join("\n"), function(err){
			if (err) { console.log("ERROR: ", err); reject(err); }
		});
		
		// Break up the script into parts (easier to debug.)
		let cmd;
		cmd = `cd scripts && ./updateRemoteDemo.sh `;
		let resp1, resp2, resp3, resp4, resp5, resp6;
		try{ console.log("(SERVER)             - part1: "); resp1 = await runCommand_exec_progress(cmd + " part1", 0, false); } catch(e){ console.log("Error in updateRemoteDemo: part1", e); reject(); }
		try{ console.log("(configFile.json)    - part2: "); resp2 = await runCommand_exec_progress(cmd + " part2", 0, false); } catch(e){ console.log("Error in updateRemoteDemo: part2", e); reject(); }
		try{ console.log("(Html)               - part3: "); resp3 = await runCommand_exec_progress(cmd + " part3", 0, false); } catch(e){ console.log("Error in updateRemoteDemo: part3", e); reject(); }
		try{ console.log("(files.json)         - part4: "); resp4 = await runCommand_exec_progress(cmd + " part4", 0, false); } catch(e){ console.log("Error in updateRemoteDemo: part4", e); reject(); }
		try{ console.log("(DEVICE_DATA)        - part5: "); resp5 = await runCommand_exec_progress(cmd + " part5", 0, false); } catch(e){ console.log("Error in updateRemoteDemo: part5", e); reject(); }
		try{ console.log("(DEVICE_DATA_IMAGES) - part6: "); resp6 = await runCommand_exec_progress(cmd + " part6", 0, false); } catch(e){ console.log("Error in updateRemoteDemo: part6", e); reject(); }

		let retObj = {
			"part1": resp1 ,
			"part2": resp2 ,
			"part3": resp3 ,
			"part4": resp4 ,
			"part5": resp5 ,
			"part6": resp6 ,
		};

		// Write the file with the resps in it.
		fs.writeFileSync(scriptsPath + "/updateRemoteDemo.resps.json", JSON.stringify(retObj,null,1), function(err){
			if (err) { console.log("ERROR: ", err); reject(err); }
		});

		resolve(retObj);
	});
};
// WEB UI - FUNCTIONS.
const webApi = {
	updateAll2          : function(obj){
		// res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
		return new Promise(async function(res_top, rej_top){
			// Break out the properties of the object into variables. 
			let { req, res, interface } = obj;
			
			// FUNCTIONS.
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
			const sync                      = function(){
				return new Promise(async function(resolve_sync, reject_sync){
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
			const createNotebookPageImages2 = async function(recreateall, messages=[]){
				return new Promise(async function(resolve_top,reject_top){
					// Holds changed/new files data. 
					let fileIdsWithChanges = [];
			
					// Holds the list of commands;
					let cmdList = [];
			
					// Get the files.json file (or create it if it doesn't exist.)
					let existingFilesJson;
					let returnValue;
					try{ returnValue = await getExistingJsonFsData(false); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
					existingFilesJson = returnValue.files;
					
					// getExistingJsonFsData can return a new value for the recreateall flag.
					if(!recreateall){
						recreateall = returnValue.recreateall;
					}
			
					// Generate data against the synced data on the server. 
					let NewFilesJson;
					try{ NewFilesJson = await createJsonFsData(false); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
			
					// Compare existing and new to detect changes. (new needs to win all conflicts.)
			
					// Check to see if the files are equal.
					let existingJson = JSON.stringify(existingFilesJson["DocumentType"]).trim();
					let newJson      = JSON.stringify(NewFilesJson["DocumentType"]).trim();
			
					// Does writeFileSync actually have a callback?? I don't think so. Check.
					fs.writeFileSync(htmlPath + "/testExisting.json", existingJson), function(err){
						if (err) { console.log("ERROR: ", err); reject(err); }
					};
					// Does writeFileSync actually have a callback?? I don't think so. Check.
					fs.writeFileSync(htmlPath + "/testNew.json", newJson), function(err){
						if (err) { console.log("ERROR: ", err); reject(err); }
					};
			
					if(!recreateall && existingJson == newJson ){
						messages.push("createNotebookPageImages: previous and new json are identical. NO changes have been detected.");
						console.log(getLastValueOfArray(messages));
						res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
						resolve_top( { messages: messages, fileIdsWithChanges: fileIdsWithChanges } );
						return; 
					}
					// They are different. Determine what has changed and only update what has changed.
					else{
						messages.push("createNotebookPageImages: Checking for file changes...");
						console.log(getLastValueOfArray(messages));
						res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
			
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
							
							try{ file_dir_visibleName      = getParentDirName(file_new, NewFilesJson);} catch(e){ file_dir_visibleName      = undefined; }
			
							// recreateall override?
							if(recreateall){
								// messages.push("createNotebookPageImages: recreateall");
								// console.log(getLastValueOfArray(messages));
								// res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
								fileIdsWithChanges.push({
									"key": key, 
									"change": "recreateall",
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
								console.log(getLastValueOfArray(messages));
								res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
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
								console.log(getLastValueOfArray(messages));
								res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
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
									console.log(getLastValueOfArray(messages));
									res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
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
									console.log(getLastValueOfArray(messages));
									res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
								}
							}
							// This should never happen.
							else{
								messages.push("createNotebookPageImages: (NO MATCH): FILE: " + file_new_visibleName + " (PARENT: " + file_dir_visibleName + ")");
								console.log(getLastValueOfArray(messages));
								res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
							}
						});
			
						//
						for(let i=0; i<fileIdsWithChanges.length; i+=1){
							let obj = fileIdsWithChanges[i];
							let regenerateAllPages=false;
			
							if(recreateall){
								// messages.push("createNotebookPageImages:   recreateall.");
								// console.log(getLastValueOfArray(messages)); 
								// res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
			
								// Just regenerate all the pages. 
								regenerateAllPages = true; 
							}
							else if(obj.change=="updated"){
								// Have the number of pages changed?
								if( obj.oldFile.content.pages.length != obj.newFile.content.pages.length ){
									messages.push("createNotebookPageImages:   Page count change. (" + obj.newFile.metadata.visibleName + ") : " +obj.oldFile.content.pages.length + " vs " + obj.newFile.content.pages.length );
									console.log(getLastValueOfArray(messages));
									res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
			
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
									console.log(getLastValueOfArray(messages)); 
									res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
			
									// Just regenerate all the pages. 
									regenerateAllPages = true; 
								}
								// Just a data change on the file.
								else{
									messages.push("createNotebookPageImages:   Page data change. (" + obj.newFile.metadata.visibleName +")");
									console.log(getLastValueOfArray(messages)); 
									res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
				
									// Regenerate THIS page.
									//
			
									// Just regenerate all the pages. 
									regenerateAllPages = true; 
								}
							}
							else if(obj.change=="newfile"){
								messages.push("createNotebookPageImages:   New file. (" + obj.newFile.metadata.visibleName + ")" );
								console.log(getLastValueOfArray(messages)); 
								res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
			
								// resolve_top( { messages: messages, cmdList: cmdList } );
								regenerateAllPages=true;
							}
							else if(obj.change=="delete"){
								// resolve_top( { messages: messages, cmdList: cmdList } );
								messages.push("createNotebookPageImages:   Deleted file. (" + obj.newFile.metadata.visibleName + ")" );
								console.log(getLastValueOfArray(messages)); 
								res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
								regenerateAllPages=true;
							}
							else{
								// Unknown change type. 
								messages.push("createNotebookPageImages:   UNKNOWN CHANGE TYPE. (" + obj.newFile.metadata.visibleName + ")" );
								console.log(getLastValueOfArray(messages)); 
								res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
								reject_top("UNKNOWN CHANGE TYPE");
							}
			
							if(regenerateAllPages){
								// Get a list of the source .rm files.
								let srcRmFiles ;
								try{ srcRmFiles = await getItemsInDir(dataPath + obj.key, "files"); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }
								srcRmFiles = srcRmFiles
									.filter(function(d){ if(d.filepath.indexOf(".rm") != -1){ return true; } })
									.map( function(d){ return d.filepath; }) 
								;
			
								// Get a list of page ids from .context.
								let pages = obj.newFile.content.pages;
			
								// For each .rm file, in order by pages...
								pages.forEach(function(page, page_i){
									let fileType        = obj.newFile.content.fileType;
									let baseFileName    = obj.newFile.metadata.visibleName.replace(/[^A-Z0-9]+/ig, "_");
									let dest_fullName   = imagesPath + obj.key + "/" + baseFileName ;
									let srcFile ;
									let pageNum         = page_i.toString().padStart(3, "0");
									let fullOutputName  = `${dest_fullName}_PAGE_${pageNum}.svg`;
									let fullOutputName2 = `${dest_fullName}_PAGE_${pageNum}.min.svg`;
									let cmd  ;
									let cmd2 ;
									let cmd3 ;
									
									if(fileType == "notebook"){
										srcFile         = dataPath + obj.key + "/" + page + ".rm";
										
										cmd             = `python3 scripts/rM2svg.py -i ${srcFile} -o ${fullOutputName}`;

										cmd2            = `echo ""`;
										// cmd2            = `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" -i ${fullOutputName} -o ${fullOutputName2} `;
										
										cmd3            = `echo ""`;
										// cmd3            = `rm ${fullOutputName}`;
									}
									else if(fileType == "pdf"){
										return;
										srcFile         = ``; // dataPath + obj.key + "/" + page + ".rm";
										cmd             = `echo ""`; // `python3 scripts/rM2svg.py -i ${srcFile} -o ${fullOutputName}`;
										cmd2            = `echo ""`; // `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" -i ${fullOutputName} -o ${fullOutputName2} `;
										cmd3            = `echo ""`; // `rm ${fullOutputName}`;
									}
									
									// Add the full command and info.
									cmdList.push({
										cmd             : cmd, 
										cmd2            : cmd2, 
										cmd3            : cmd3, 
										key             : obj.key,
										page_i          : page_i,
										numPages        : pages.length,
										clearFirst      : true,
										srcRmDir        : dataPath + obj.key,
										destDir         : imagesPath + obj.key,
										fullOutputName  : fullOutputName,
										fullOutputName2 : fullOutputName2,
										baseFileName    : baseFileName + "_PAGE_" + pageNum,
										fileType        : fileType,
									});
								});
							}
						}
						
						// Is there something to do?
						if(cmdList.length){
							messages.push("createNotebookPageImages: There are " + cmdList.length + " changes");
							console.log(getLastValueOfArray(messages));
							res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
			
							try{ await optimizeImages2(cmdList, messages); } catch(e){ console.log("failure: optimizeImages", e); reject_top(); return; }
							
							resolve_top( { messages: messages } );
							return; 
						}
						else{
							messages.push("createNotebookPageImages: No changes to notebooks have been made.");
							console.log( getLastValueOfArray(messages) );
							res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
							
							// ****************
							stamp = timeIt.stamp("optimizeImages.createJsonFsData", null);
							res.write(`data: ${JSON.stringify( "STARTING FILES.JSON" )}\n\n`);
							try{ await createJsonFsData(true); console.log("createNotebookPageImages: Wrote json data."); } catch(e){ console.log("failure: createJsonFsData", e); reject_top(); return; }
							res.write(`data: ${JSON.stringify( "FINISHED FILES.JSON" )}\n\n`);
							timeIt.stamp("optimizeImages.createJsonFsData", stamp);
							// ****************
							
							console.log(getLastValueOfArray(messages));
							console.log( getLastValueOfArray(messages) );
							console.log("No commands to run.", "cmdList.length:", cmdList.length);
							res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
							resolve_top( { messages: messages } );
							return;
						}
			
					}
				});
			};
			const optimizeImages2           = async function(cmdList, messages){
				return new Promise(async function(resolve_top,reject_top){
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
			
					
					// Remove the relevant directories. 
					let dirs ;
					try{ dirs = await removeDirs(cmdList); } catch(e){ console.log("failure: removeDirs", e); }
			
					// const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
					// await delay(30000); /// waiting 1 second.
					
					// First, run all cmd1 to convert the .rm files to an unoptizized .svg.
					// Next, run each cmd2 immediately followed by cmd3.
					// Result: only the optimized .svg remains although the unoptimized .svg is available while optimizing.
			
					let currentCmd = 0;
					let totalCmds  = cmdList.length;
					let stamp;
					stamp = timeIt.stamp("optimizeImages.rM2svg.py", null);
					let prom_cmd1 = async_mapLimit(cmdList, 2, async function(rec, callback){
						// Create the directory.if it doesn't exist.
						// if( !fs.existsSync(rec.destDir) ){ fs.mkdirSync(rec.destDir); }
						
						let cmd = rec.cmd;
						let response;

						try{ 
							response = await runCommand_exec_progress(cmd, 0, false); 
						} 
						catch(e){ 
							console.log("failure: optimizeImages: rM2svg.py:", e, cmd.length, "of", 32000); 
							throw rec.cmd; 
							// content.fileType
						}
						currentCmd += 1;
						if(response.stdOutHist) { console.log("stdOutHist:", response.stdOutHist); }
						if(response.stdErrHist) { console.log("stdErrHist:", response.stdErrHist); }
						
						messages.push(`  optimizeImages: ${currentCmd}/${totalCmds} rM2svg.py: DONE: ${rec.fullOutputName}`);
						console.log(getLastValueOfArray(messages));
						res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
						
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
								try{ response = await runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: svgo", e, cmd.length, "of", 32000); throw rec.cmd2; }
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
									console.log(getLastValueOfArray(messages));
									res.write(`data: ${JSON.stringify( getLastValueOfArray(messages) )}\n\n`);
									// console.log("stdOutHist:", "svgo:   ", response.stdOutHist.replace(/\n/g, " ").trim()); 
								}
			
								if(response.stdErrHist) { 
									console.log("stdErrHist:", response.stdErrHist); 
								}
			
								cmd = rec.cmd3;
								try{ response = await runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: rm", e, cmd.length, "of", 32000); throw rec.cmd3;}
								if(response.stdOutHist) { console.log("stdOutHist:", response.stdOutHist); }
								if(response.stdErrHist) { console.log("stdErrHist:", response.stdErrHist); }
								
								callback(null, rec);
							})
							.then(
								async function(){ 
									timeIt.stamp("optimizeImages.svgo rm", stamp);
			
									// ****************
									stamp = timeIt.stamp("optimizeImages.createJsonFsData", null);
									res.write(`data: ${JSON.stringify( "STARTING FILES.JSON" )}\n\n`);
									try{ await createJsonFsData(true); console.log("optimizeImages: Wrote json data."); } catch(e){ console.log("failure: createJsonFsData", e); }
									res.write(`data: ${JSON.stringify( "FINSIHED FILES.JSON" )}\n\n`);
									timeIt.stamp("optimizeImages.createJsonFsData", stamp);
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

			// START THE SSE STREAM.
			res.writeHead(200, { 
				"Content-Type": "text/event-stream",
				// 'Connection': 'keep-alive',
				"Cache-control": "no-cache" 
			});

			// DO SYNC.
			res.write(`data: ${JSON.stringify("STARTING SYNC.")}\n\n`);
			try{ await sync(); } 
			catch(e){ 
				// console.log("ERROR: SYNC", e); 
				
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
			try{ await createNotebookPageImages2(false, messages); } 
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
	},
	getFilesJson        : function(){
		return new Promise(async function(resolve_top,reject_top){
			let existingFilesJson;
			try{ existingFilesJson = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }
			resolve_top(existingFilesJson.files);
		});
	},
	getSvgs             : function(notebookId, notebookTemplatesAs, notebookPagesAs){
		return new Promise(async function(resolve_top,reject_top){
			// Need to check that the directory exists.
			// Need to check if there are already svg files in the directory.
			// Retrieve what is in that directory.
			// let dirExists = fs.existsSync(targetPath);
			// let dirFiles = await getItemsInDir(targetPath, "files"); // fs.promises.readdir(targetPath);

			// Get files.json.
			let files ;
			try{ files = await webApi.getFilesJson(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
			
			// Get the template files. 
			let proms = [];
			let templateFiles = {};
			files.DocumentType[notebookId].pagedata.forEach(function(d){
				let filename = `DEVICE_DATA/templates/${d}.svg`
				let baseFilename = filename.split("/")[2];
				let keyName = baseFilename.split(".")[0];

				if(templateFiles[d] == undefined){
					if(notebookTemplatesAs == "base64"){
						templateFiles[keyName] = "";
						proms.push(
							new Promise(function(res1, rej1){
								fs.readFile(filename, function (err, file_buffer) {
									if (err) {
										console.log("ERROR READING FILE 1", filename, err); 
										rej1([filename, err]); 
										return;
									}
									if(filename.indexOf(".png") != -1){
										templateFiles[keyName] = 'data:image/png;base64,' + file_buffer.toString('base64').trim();
										res1();
									}
									else if(filename.indexOf(".svg") != -1){
										templateFiles[keyName] = 'data:image/svg+xml;base64,' + file_buffer.toString('base64').trim();
										res1();
									}
									else{ 
										console.log("no match???");
										rej1(); 
									}
								})
							})
						);
					}
					else if(notebookTemplatesAs == "filename"){
						templateFiles[keyName] = filename;
					}
				}
			});
				
			// Get the notebook page files. 
			let targetPath = imagesPath + "" + notebookId;
			let dirFiles = await getItemsInDir(targetPath, "files"); // fs.promises.readdir(targetPath);
			let pageFiles = {};
			dirFiles.forEach(function(file){
				// console.log("notebook page file:", file);
				proms.push(
					new Promise(function(res1, rej1){
						let filename = file.filepath;
						let baseFilename = filename.split("/")[2];
						pageFiles[baseFilename] = "";

						if(notebookPagesAs == "base64"){
							fs.readFile(filename, function (err, file_buffer) {
								if (err) {
									console.log("ERROR READING FILE 1", file, err); 
									rej1([file, err]); 
									return;
								}
								// 
								if(filename.indexOf(".png") != -1){
									pageFiles[baseFilename] = 'data:image/png;base64,' + file_buffer.toString('base64').trim();
									res1( pageFiles[baseFilename] );
								}
								else if(filename.indexOf(".svg") != -1){
									pageFiles[baseFilename] = 'data:image/svg+xml;base64,' + file_buffer.toString('base64').trim();
									res1( pageFiles[baseFilename] );
								}
								// else if(filename.indexOf(".rm") != -1){
									// pageFiles[baseFilename] = 'application/octet-stream;base64,' + file_buffer.toString('base64').trim();
									// res1( pageFiles[baseFilename] );
								// }
								else{
									console.log("invalid file type.");
									rej();
								}
							})
						}
						else if(notebookPagesAs == "filename"){
							pageFiles[baseFilename] = filename; 
							res1(file);
						}
					})
				);
			});

			Promise.all(proms).then(
				function(results){
					resolve_top(
						JSON.stringify(
							{
								// "notebookId": notebookId,
								// "dirFiles": dirFiles,
								// "ARGS": [notebookId, notebookTemplatesAs, notebookPagesAs],
								
								// DATA
								"templateFiles": templateFiles,
								"pageFiles"    : pageFiles,
								"pagedata"     : files.DocumentType[notebookId].pagedata,
								"notebookTitle": files.DocumentType[notebookId].metadata.visibleName,
		
							}, 
						null, 0)
					);

				},

				function(error){ console.log("ERROR:", error); reject_top(JSON.stringify([],null,0)); }
			);
		});
	},
	getGlobalUsageStats : function(){
		return new Promise(async function(resolve_top,reject_top){
			let files;
			try{ files = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
			files = files.files;

			// Filter and sort.
			const filterAndSort = function(sortKey, type, filterKey, maxRecords){
				const formatDate = function(date) {
					let d = new Date(date);
					if(d == "Invalid Date"){ return d; }
					let month   = (d.getMonth() + 1);
					let day     = d.getDate();
					let year    = d.getFullYear();
					let hours   = d.getHours();
					let minutes = d.getMinutes();
					let seconds = d.getSeconds();
					let ampm    = hours < 12 ? "AM" : "PM";

					if(month  <= 10) { month   = month  .toString().padStart(2, "0"); }
					if(day    <= 10) { day     = day    .toString().padStart(2, "0"); }
					if(hours  >= 13) { hours   -= 12; }
					if(hours   < 10) { hours   = hours  .toString().padStart(2, "0"); }
					if(minutes < 10) { minutes = minutes.toString().padStart(2, "0"); }
					if(seconds < 10) { seconds = seconds.toString().padStart(2, "0"); }
				
					let dateString = [year, month, day].join('-');
					dateString += ` ${hours}:${minutes}:${seconds} ${ampm}`;

					return dateString;
				}

				// Sort the filelist by the 'sortKey'. (returns ids.)
				let dataset = Object.keys(files[type]).sort(
					function(id1, id2){
						return files[type][id2].metadata[sortKey] - files[type][id1].metadata[sortKey];
					}
				);

				// Sort the filelist with the 'filterKey'.
				if(filterKey !== false){
					dataset = dataset.filter(function(id){
						return files[type][id].metadata["pinned"] == true;
					});
				}

				// Take only the first 'maxRecords' records. 
				if(maxRecords !== true){
					dataset = dataset.slice(0, maxRecords);
				}

				// Create the data.
				let results = [];
				dataset.forEach(function(id){
					let rec = files[type][id];
					let obj = {
						type         : type,
						// lastModified : rec.metadata.lastModified,
						lastOpened   : rec.metadata.lastOpened,
						id           : rec.extra._thisFileId,
						name         : rec.metadata.visibleName,
						parentId     : rec.metadata.parent,
						date_modified: formatDate(Number(rec.metadata.lastModified)),
						date_opened  : formatDate(Number(rec.metadata.lastOpened)),
						fullpath     : getParentPath(rec.extra._thisFileId, type, files),
					};
					results.push(obj);
				});

				// Return the data.
				return results;
			};

			let byLastOpened_results   = filterAndSort("lastOpened"  , "DocumentType"  , false   , 20);
			let byLastModified_results = filterAndSort("lastModified", "DocumentType"  , false   , 20);
			let favorites_results_file = filterAndSort("name"        , "DocumentType"  , "pinned", 20);
			let favorites_results_dir  = filterAndSort("name"        , "CollectionType", "pinned", 20);

			resolve_top(JSON.stringify({
				byLastOpened  : byLastOpened_results  ,
				byLastModified: byLastModified_results,
				favorites     : {
					files: favorites_results_file ,
					dirs : favorites_results_dir  ,
				},
			}, null, 1));

			return; 
			const lastOpened   = function(sortKey, type){
				
			};
			const lastModified = function(){
			};
			const favorites    = function(){
			};

			

			let sortKey2 = "lastOpened";
			let sorted2 = Object.keys(files.DocumentType).sort(
				function(a,b){
					return files.DocumentType[b].metadata[sortKey2] - files.DocumentType[a].metadata[sortKey2];
				}
			);
			sorted2 = sorted2.slice(0, 20);
			let results2 = [];
			sorted2.forEach(function(d){
				let type = "DocumentType";
				let rec = files.DocumentType[d];
				let obj = {
					type         : type,
					lastModified : rec.metadata.lastModified,
					lastOpened   : rec.metadata.lastOpened,
					id           : rec.extra._thisFileId,
					name         : rec.metadata.visibleName,
					// parentName   : getParentDirName(rec, files),
					parentId     : rec.metadata.parent,
					date_modified: new Date(parseInt(rec.metadata.lastModified)).toString().split(" GMT")[0],
					date_opened  : new Date(parseInt(rec.metadata.lastOpened)).toString().split(" GMT")[0],
					fullpath     : getParentPath(rec.extra._thisFileId, type, files),
				};
				results2.push(obj);
			});

			let results3 = [];
			let sorted3_files = Object.keys(files.DocumentType).filter(function(d){
				return files.DocumentType[d].metadata["pinned"];
			});
			let sortKey3 = "lastModified";
			sorted3_files = sorted3_files.sort(
				function(a,b){
					return files.DocumentType[b].metadata[sortKey3] - files.DocumentType[a].metadata[sortKey3];
				}
			);
			let sorted3_dirs = Object.keys(files.CollectionType).filter(function(d){
				return files.CollectionType[d].metadata["pinned"];
			});
			sorted3_dirs = Object.keys(sorted3_dirs).sort(
				function(a,b){
					return files.CollectionType[b].metadata[sortKey3] - files.CollectionType[a].metadata[sortKey3];
				}
			);

			sorted3_files.forEach(function(d){
				let type = "DocumentType";
				let rec = files[type][d];
				let obj = {
					type         : type,
					lastModified : rec.metadata.lastModified,
					lastOpened   : rec.metadata.lastOpened,
					id           : rec.extra._thisFileId,
					name         : rec.metadata.visibleName,
					// parentName   : getParentDirName(rec, files),
					parentId     : rec.metadata.parent,
					date_modified: new Date(parseInt(rec.metadata.lastModified)).toString().split(" GMT")[0],
					date_opened  : new Date(parseInt(rec.metadata.lastOpened)).toString().split(" GMT")[0],
					fullpath     : getParentPath(rec.extra._thisFileId, type, files),
				};
				results3.push(obj);
			});
			sorted3_dirs.forEach(function(d){
				let type = "CollectionType";
				let rec = files[type][d];
				console.log(rec);
				return; 
				let obj = {
					type         : type,
					lastModified : rec.metadata.lastModified,
					lastOpened   : rec.metadata.lastOpened,
					id           : rec.extra._thisFileId,
					name         : rec.metadata.visibleName,
					// parentName   : getParentDirName(rec, files),
					parentId     : rec.metadata.parent,
					date_modified: new Date(parseInt(rec.metadata.lastModified)).toString().split(" GMT")[0],
					date_opened  : new Date(parseInt(rec.metadata.lastOpened)).toString().split(" GMT")[0],
					fullpath     : getParentPath(rec.extra._thisFileId, type, files),
				};
				results3.push(obj);
			});


			resolve_top(JSON.stringify({
				byLastOpened  : results1,
				byLastModified: results2,
				favorites     : results3,
				// recent        : results4,
			}, null, 1));
		});
	},
	getThumbnails       : function(parentId, thumbnailPagesAs){
		return new Promise(async function(resolve_top,reject_top){
			let getThumbnail = function(notebookId, existingFilesJson){
				//. Use notebookId to get the folder, use .pages to get the page ids (in order.)
				let targetPath = dataPath + "" + notebookId + ".thumbnails";
	
				// Need to check that the directory exists.
				if(!fs.existsSync(targetPath)){ 
					console.log("targetPath does not exist.", targetPath); 
					throw "targetPath does not exist." + targetPath ; 
					return; 
				};

				// Get the first page id.
				let firstPageId = existingFilesJson.DocumentType[notebookId].content.pages[0];
				
				// Check that the file exists. 
				let firstThumbnail_path = path.join(targetPath, firstPageId+".jpg");
				if(!fs.existsSync(firstThumbnail_path)){ 
					console.log("firstThumbnail_path does not exist.", firstThumbnail_path); 
					throw "firstThumbnail_path does not exist." + firstThumbnail_path; 
					return; 
				};
				
				// Retrieve the file as base64.
				let firstThumbnail;
				if(thumbnailPagesAs == "filename"){
					firstThumbnail = firstThumbnail_path;
				}
				else if(thumbnailPagesAs == "base64"){
					// Read the file. 
					firstThumbnail = fs.readFileSync( firstThumbnail_path, 'base64');

					// Convert to data url.
					firstThumbnail = 'data:image/jpg;base64,' + firstThumbnail;
				}
				
				return firstThumbnail ;
			};

			// Get files.json.
			let existingFilesJson;
			try{ existingFilesJson = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }
			existingFilesJson = existingFilesJson.files;

			// Get list of documents that have the parentId as the parent.
			let recs = {};
			for(let key in existingFilesJson.DocumentType){
				let rec = existingFilesJson.DocumentType[key];
				if(rec.metadata.parent == parentId){ 
					let data;
					let notebookId = rec.extra._thisFileId;
					try { data = getThumbnail(notebookId, existingFilesJson); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }	
					recs[key] = data; 
				}
			}
			
			resolve_top(JSON.stringify(recs, null, 0));
		});
	},
};

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

		// Delete the pages key.
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
		try{ settings = fs.readFileSync(htmlPath + "/settingsDEMO.json"); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	}
	else{
		try{ settings = fs.readFileSync(htmlPath + "/settings.json"); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
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
	fs.writeFileSync(htmlPath + "/settings.json", JSON.stringify(req.body,null,1) );

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
	try{ returnValue = await updateRemoteDemo(); } catch(e){ console.log("ERROR: updateRemoteDemo: ", e); res.send(JSON.stringify(e)); return; }
	returnValue = returnValue;
	timeIt.stamp("route: updateRemoteDemo", timeItIndex);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	res.send(returnValue);
});

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
			port       : port, // port <number>
			host       : host, // host <string>
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
			app.use('/'                  , express.static(htmlPath));
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
			console.log(`App listening at http://${host}:${port}`);
			console.log("SERVER STARTED:", `${new Date().toString().split(" GMT")[0]} `) ;
			console.log("*************** APP INFO ***************");
			console.log("");
		}
	);
})();


// app.listen(port, host, () => {
// 	// Compression.
// 	// app.use(compression({ filter: shouldCompress }));

// 	// Set virtual paths.
// 	app.use('/'                  , express.static(htmlPath));
// 	app.use('/node_modules'      , express.static( path.join(__dirname, 'node_modules') ));
// 	app.use('/DEVICE_DATA'       , express.static(path.join(__dirname, 'DEVICE_DATA')));
// 	app.use('/DEVICE_DATA_IMAGES', express.static(path.join(__dirname, 'DEVICE_DATA_IMAGES')));

// 	// 
// 	console.log("");
// 	console.log("********** APP INFO **********");
// 	console.log(`CONFIGURATION: ${JSON.stringify(config,null,1)}`);
// 	console.log(`App listening at http://${host}:${port}`);
// 	console.log("********** APP INFO **********");
// 	console.log("");

// });