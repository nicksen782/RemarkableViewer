// Libraries/frameworks from NPM.
// var serveIndex = require('serve-index');
const express     = require('express'); // npm install express
const compression = require('compression');
const app         = express();
const path        = require('path');
const exec        = require('child_process').exec;
const { spawn }   = require('child_process');
const fs          = require('fs');
// const { mapLimit } = require('promise-async');
const async = require('promise-async');

// Personal libraries/frameworks.
const timeIt = require('./timeIt.js');

// express.compress({
// 	filter: function (req, res) {
// 	  return true;
// 	}
// });

//
const port       = 3100;
const dataPath   = "DEVICE_DATA/xochitl/";
const imagesPath = "DEVICE_DATA_IMAGES/";
const htmlPath   = path.join("..", 'Html');


// UTILITY
const getLastValueOfArray = function(arr){
	return arr[arr.length-1];
};
const getItemsInDir = async function(targetPath, type){
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
				if (stats.isFile()) {
					fetchedFiles.push({ filepath });
				}
			}
			
			else if(type=="dirs"){
				if (stats.isDirectory()) {
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
const getParentDirName = function(file, files){
	// Cosmetic. "" is shown as "FSROOT"
	if(file.metadata.parent == ""){
		return "FSROOT";
	}
	else if(file.metadata.parent == "trash"){
		return "TRASH";
	}
	else{
		try{
			return files["CollectionType"][file.metadata.parent].metadata.visibleName;
		}
		catch(e){
			console.log("****", file.metadata.parent, "****", e);
			return "ERROR" + file.metadata.parent;
		}
	}
};
const getFullPathToDocument = function(){
	return new Promise(async function(resolve_top,reject_top){
		resolve_top();
	});
};
// Runs a specified command (with promise.)
const runCommand_exec = async function(cmd){
	return new Promise(function(cmd_res, cmd_rej){
		// Run the command.
		exec(cmd, 
			function (error, stdout, stderr) {
				if (error) {
					console.log(
						JSON.stringify({ error: error, stderr:stderr, stdout:stdout })
					);
					cmd_rej(JSON.stringify({error: error, stderr:stderr, stdout:stdout}));
					throw "ERROR in runCommand_exec";
					return;
				}
				// let debug_stdout = stdout.split("\n")[0].trim();
				// if(debug_stdout != ""){
				// 	messages.push("createNotebookPageImages: cmd: " + debug_stdout);
				// 	console.log(getLastValueOfArray(messages));
				// }
				cmd_res();
			}
		);
	});

};
// Runs a specified command (with promise, and progress)
const runCommand_exec_progress = async function(cmd, expectedExitCode = 0, progress=true){
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

// FUNCTIONS.
const createJsonFsData = async function(writeFile){
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
							fs.readFile(path.join(basePath, file), function (err, file_buffer) {
								if (err) {
									console.log("ERROR READING FILE 1", file, err); 
									rej1([file, err]); 
									return;
								}
								
								// Start creating the new json entry.
								let newObj = {};
		
								// Create metadata.
								newObj.metadata = JSON.parse(file_buffer);
		
								// DEBUG: Remove keys
								if(newObj.metadata.type == "CollectionType"){
									delete newObj.metadata.deleted;
									delete newObj.metadata.lastModified;
									delete newObj.metadata.modified;
									delete newObj.metadata.pinned;
									delete newObj.metadata.synced;
									delete newObj.metadata.version;
									delete newObj.metadata.metadatamodified;
								}
								else if(newObj.metadata.type == "DocumentType"){
									delete newObj.metadata.deleted;
									// delete newObj.metadata.lastModified;
									delete newObj.metadata.modified;
									delete newObj.metadata.pinned;
									delete newObj.metadata.synced;
									// delete newObj.metadata.version;
									delete newObj.metadata.metadatamodified;
									delete newObj.metadata.lastOpened;     
									delete newObj.metadata.lastOpenedPage; 
								}
		
								// Create extra.
								newObj.extra = {};
								newObj.extra["_thisFileId"] = file.replace(".metadata", "");

								// newObj.extra["_thisFileId"] = file.replace(".metadata", "");
		
								// Get the .content file too.
								fs.readFile(path.join(basePath, file.replace(".metadata", ".content")), function (err, file_buffer2) {
									if (err) {
										console.log("ERROR READING FILE 2", file, err); 
										rej1([file, err]); 
										return;
									}
		
									// Create content.
									newObj.content = JSON.parse(file_buffer2);
		
									// ********** NEW PRE-FILTERING **********
									let check0 = newObj.metadata.type         == "CollectionType";
									let check1 = newObj.content.fileType      != "notebook";
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
									}
									// Only compare notebooks. 
									else if(check1){
										// console.log("Skipping non-notebook.");
									}
									// Ignore dummyDocument true.
									else if(check2){
										// console.log("Skipping dummyDocument.");
									}
									// Ignore trash.
									else if(check3){
										// console.log("Skipping trash.");
									}
									// Add the completed record.
									else {
										newObj.extra["_firstPageId"] = newObj.content.pages[0]; // Save the first page. 
										json[newObj.metadata.type].push(newObj);
									}
									
									// Resolve.
									res1();
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
				fileList["CollectionType"].forEach(function(d){
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
						// path: [],
						name: d.metadata.visibleName
					};
				});
		
				// Creates "files"
				fileList["DocumentType"].forEach(function(d){
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
						
						// DEBUG
						// path: [],
						name: d.metadata.visibleName
					};
				});
		
				let fin = {
					"CollectionType":dirs,
					"DocumentType":files,
				};
		
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
const getExistingJsonFsData = async function(recreateIfMissing = true){
	return new Promise(async function(resolve,reject){
		let files;
		let recreateall = false;
		if( !fs.existsSync(htmlPath + "/files.json") ){
			// if(recreateIfMissing){
				console.log("getExistingJsonFsData: no existing data. Creating it now.");
				try{ files = await createJsonFsData(true); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
			// }
			// else{
				// console.log("getExistingJsonFsData: no existing data. recreateIfMissing was set to false. Not creating data.");
			// }
			recreateall = true;
		}
		else{
			console.log("getExistingJsonFsData: Data exists, retrieving it.");
			files = fs.readFileSync(htmlPath + "/files.json");
			files = JSON.parse(files);
		}

		resolve({recreateall:recreateall, files:files});
	});
};
const createNotebookPageImages = async function(recreateall, messages=[]){
	return new Promise(async function(resolve_top,reject_top){
		// Holds changed/new files data. 
		let fileIdsWithChanges = [];

		// Holds the list of commands;
		let cmdList = [];

		// Get the files.json file (or create it if it doesn't exist.)
		let existingFilesJson;
		let returnValue;
		existingFilesJson
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

		fs.writeFileSync(htmlPath + "/testExisting.json", existingJson), function(err){
			if (err) { console.log("ERROR: ", err); reject(err); }
		};
		fs.writeFileSync(htmlPath + "/testNew.json", newJson), function(err){
			if (err) { console.log("ERROR: ", err); reject(err); }
		};

		if(!recreateall && existingJson == newJson ){
			messages.push("createNotebookPageImages: NO changes have been detected.");
			console.log(getLastValueOfArray(messages));
			resolve_top( { messages: messages, fileIdsWithChanges: fileIdsWithChanges } );
			return; 
		}
		// They are different. Determine what has changed and only update what has changed.
		else{
			messages.push("createNotebookPageImages: Checking for file changes..." + Object.keys( NewFilesJson ).length );
			console.log(getLastValueOfArray(messages));

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

				try{ file_existing_lastModified = file_existing.metadata.lastModified;      } catch(e){ file_existing_lastModified = undefined; }
				try{ file_new_lastModified      = file_new.metadata.lastModified;           } catch(e){ file_new_lastModified      = undefined; }
				try{ file_existing_visibleName  = file_existing.metadata.visibleName;       } catch(e){ file_existing_visibleName  = undefined; }
				try{ file_new_visibleName       = file_new.metadata.visibleName;            } catch(e){ file_new_visibleName       = undefined; }
				try{ file_dir_visibleName       = getParentDirName(file_new, NewFilesJson); } catch(e){ file_dir_visibleName       = undefined; }

				// recreateall override?
				if(recreateall){
					// messages.push("createNotebookPageImages: recreateall");
					// console.log(getLastValueOfArray(messages));
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
					if(isModified || isRenamed){
						messages.push("createNotebookPageImages: Update: FILE: " + file_new_visibleName + " (PARENT: " + file_dir_visibleName + ")");
						console.log(getLastValueOfArray(messages));
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
				}
				// This should never happen.
				else{
					messages.push("createNotebookPageImages: (NO MATCH): FILE: " + file_new_visibleName + " (PARENT: " + file_dir_visibleName + ")");
					console.log(getLastValueOfArray(messages));
				}
			});

			//
			for(let i=0; i<fileIdsWithChanges.length; i+=1){
				let obj = fileIdsWithChanges[i];
				let regenerateAllPages=false;

				if(recreateall){
					// messages.push("createNotebookPageImages:   recreateall.");
					// console.log(getLastValueOfArray(messages)); 

					// Just regenerate all the pages. 
					regenerateAllPages = true; 
				}
				else if(obj.change=="updated"){
					// Have the number of pages changed?
					if( obj.oldFile.content.pages.length != obj.newFile.content.pages.length ){
						messages.push("createNotebookPageImages:   Page count change. (" + obj.newFile.metadata.visibleName + ") : " +obj.oldFile.content.pages.length + " vs " + obj.newFile.content.pages.length );
						console.log(getLastValueOfArray(messages));

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

						// Just regenerate all the pages. 
						regenerateAllPages = true; 
					}
					// Just a data change on the file.
					else{
						messages.push("createNotebookPageImages:   Page data change. (" + obj.newFile.metadata.visibleName +")");
						console.log(getLastValueOfArray(messages)); 
	
						// Regenerate THIS page.
						//

						// Just regenerate all the pages. 
						regenerateAllPages = true; 
					}
				}
				else if(obj.change=="newfile"){
					messages.push("createNotebookPageImages:   New file. (" + obj.newFile.metadata.visibleName + ")" );
					console.log(getLastValueOfArray(messages)); 
					// resolve_top( { messages: messages, cmdList: cmdList } );
					regenerateAllPages=true;
				}
				else if(obj.change=="delete"){
					// resolve_top( { messages: messages, cmdList: cmdList } );
					messages.push("createNotebookPageImages:   Deleted file. (" + obj.newFile.metadata.visibleName + ")" );
					console.log(getLastValueOfArray(messages)); 
					regenerateAllPages=true;
				}
				else{
					// Unknown change type. 
					messages.push("createNotebookPageImages:   UNKNOWN CHANGE TYPE. (" + obj.newFile.metadata.visibleName + ")" );
					console.log(getLastValueOfArray(messages)); 
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
						let baseFileName    = obj.newFile.metadata.visibleName.replace(/[^A-Z0-9]+/ig, "_");
						let dest_fullName   = imagesPath + obj.key + "/" + baseFileName ;
						let srcFile         = dataPath + obj.key + "/" + page + ".rm";
						let pageNum         = page_i.toString().padStart(3, "0");
						let fullOutputName  = `${dest_fullName}_PAGE_${pageNum}.svg`;
						let fullOutputName2 = `${dest_fullName}_PAGE_${pageNum}.min.svg`;
						let cmd             = `python3 scripts/rM2svg.py -i ${srcFile} -o ${fullOutputName}`;
						let cmd2            = `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" -i ${fullOutputName} -o ${fullOutputName2} `;
						let cmd3            = `rm ${fullOutputName}`;
						
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
						});
					});
				}
			}
			
			// Is there something to do?
			if(cmdList.length){
				messages.push("createNotebookPageImages: There are " + cmdList.length + " changes");
				console.log(getLastValueOfArray(messages));

				try{ await optimizeImages(cmdList, messages); } catch(e){ console.log("failure: optimizeImages", e); }
				
				resolve_top( { messages: messages } );
				return; 
			}
			else{
				messages.push("createNotebookPageImages: No changes have been made.");
				console.log(getLastValueOfArray(messages));
				console.log("No commands to run.", "cmdList.length:", cmdList.length);
				resolve_top( { messages: messages } );
				return;
			}

		}
	});
};
const optimizeImages = async function(cmdList, messages){
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
		let prom_cmd1 = async.mapLimit(cmdList, 2, async function(rec, callback){
			// Create the directory.if it doesn't exist.
			// if( !fs.existsSync(rec.destDir) ){ fs.mkdirSync(rec.destDir); }
			
			let cmd = rec.cmd;
			let response;
			
			try{ response = await runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: rM2svg.py:", e, cmd.length, "of", 32000); throw rec.cmd; }
			currentCmd += 1;
			if(response.stdOutHist) { console.log("stdOutHist:", response.stdOutHist); }
			if(response.stdErrHist) { console.log("stdErrHist:", response.stdErrHist); }
			
			messages.push(`  optimizeImages: ${currentCmd}/${totalCmds} rM2svg.py: DONE: ${rec.fullOutputName}`);
			console.log(getLastValueOfArray(messages));
			
			callback(null, rec);
		})
		.then(
			function(data){ 
				timeIt.stamp("optimizeImages.rM2svg.py", stamp);

				stamp = timeIt.stamp("optimizeImages.svgo rm", null);

				let currentCmd = 0;
				let totalCmds  = cmdList.length;
				let prom_cmd1and2 = async.mapLimit(cmdList, 2, async function(rec, callback){
					let cmd;
					let response;
					
					cmd = rec.cmd2;
					try{ response = await runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: svgo", e, cmd.length, "of", 32000); throw rec.cmd2; }
					currentCmd += 1;
					let respLines = response.stdOutHist.split("\n");
					if(response.stdOutHist) { 
						messages.push(`  optimizeImages: ${currentCmd}/${totalCmds} svgo     : DONE: ${rec.fullOutputName2} (${respLines[3].split(" - ")[1].split("%")[0]}% reduction)`);
						console.log(getLastValueOfArray(messages));
						// console.log("stdOutHist:", "svgo:   ", response.stdOutHist.replace(/\n/g, " ").trim()); 
					}

					if(response.stdErrHist) { console.log("stdErrHist:", response.stdErrHist); }

					cmd = rec.cmd3;
					try{ response = await runCommand_exec_progress(cmd, 0, false); } catch(e){ console.log("failure: optimizeImages: rm", e, cmd.length, "of", 32000); throw rec.cmd3;}
					if(response.stdOutHist) { console.log("stdOutHist:", response.stdOutHist); }
					if(response.stdErrHist) { console.log("stdErrHist:", response.stdErrHist); }
					
					callback(null, rec);
				})
				.then(
					async function(){ 
						timeIt.stamp("optimizeImages.svgo rm", stamp);

						stamp = timeIt.stamp("optimizeImages.createJsonFsData", null);
						try{ await createJsonFsData(true); } catch(e){ console.log("failure: createJsonFsData", e); }
						timeIt.stamp("optimizeImages.createJsonFsData", stamp);

						resolve_top();
					},
					function(err){ console.log("err:", err); }
				);
			},
			function(err){ console.log("err:", err); },
		);
	});
};
const updateRemoteDemo = async function(){
	return new Promise(async function(resolve,reject){
		// try{ files = await createJsonFsData(true); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }

		resolve(true);
	});
};

const webApi = {
	updateAll : function(){
		return new Promise(async function(res_top, rej_top){
			// try{ resp = await runCommand_exec_progress(cmd, 0, true); } catch(e){ console.log("Error in syncRunner:", e); reject_top(); }
			// let resp1 ;
			// try{ resp1 = await webApi.syncRunner("tolocal", "wifi"); } catch(e){ console.log("ERROR:", e); rej_top(); return; }
			
			// let resp1 ;
			// try{ resp1 = await webApi.syncRunner("tolocal", "wifi"); } catch(e){ console.log("ERROR:", e); rej_top(); return; }

			// DEBUG: Forces a recreateall event within createNotebookPageImages. 
			// if( fs.existsSync(htmlPath + "/files.json") ){
			// 	fs.unlinkSync(htmlPath + "/files.json");
			// }
			
			let stamp1;
			let stamp2;
			let returnValue1;
			let returnValue2;

			// Holds log messages.
			var messages = [];

			// First, syncUsingWifi.
			messages.push("Starting: webApi.syncRunner.");
			console.log(getLastValueOfArray(messages));

			stamp1 = timeIt.stamp("webApi.syncRunner", null);
			try{ returnValue1 = await webApi.syncRunner("tolocal", "wifi", messages); } catch(e){ console.log("ERROR:", e); rej_top(); return; }
			timeIt.stamp("webApi.syncRunner", stamp1);

			messages.push("Finished: webApi.syncRunner.");
			console.log(getLastValueOfArray(messages));

			// Next, create and compress local .svgs, then update files.json.
			stamp2 = timeIt.stamp("createNotebookPageImages", null);
			try{ returnValue2 = await createNotebookPageImages(false, messages); } catch(e){ console.log("ERROR:", e); rej_top(); return; }
			timeIt.stamp("createNotebookPageImages", stamp2);
			
			res_top([returnValue1, returnValue2]);
		});
	},
	syncRunner : function(dest, interface, messages=[]){
		return new Promise(async function(resolve_top,reject_top){
			// Check for the validity of both arguments.
			if( ["tolocal", "toremote"].indexOf(dest) == -1) {
				reject_top(JSON.stringify("ERROR: Invalid 'dest'"));
				return;
			}
			if( ["wifi", "usb"].indexOf(interface) == -1) {
				reject_top(JSON.stringify("ERROR: Invalid 'interface'"));
				return;
			}

			let cmd = `cd scripts && ./syncRunner.sh ${dest} ${interface}`;

			let resp ;
			try{ resp = await runCommand_exec_progress(cmd, 0, true); } catch(e){ console.log("Error in syncRunner:", e); reject_top(); }

			resolve_top(resp);
		});
	},
	getFilesJson : function(){
		return new Promise(async function(resolve_top,reject_top){
			let existingFilesJson;
			try{ existingFilesJson = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }
			resolve_top(existingFilesJson.files);
		});
	},
	getSvgs : function(notebookId){
		return new Promise(async function(resolve_top,reject_top){
			// Need to check that the directory exists.
			// Need to check if there are already svg files in the directory.
			// Retrieve what is in that directory.
			let targetPath = imagesPath + "" + notebookId;
			let dirExists = fs.existsSync(targetPath);
			let dirFiles = await getItemsInDir(targetPath, "files"); // fs.promises.readdir(targetPath);

			let dirFiles_pngs = [];
			dirFiles.forEach(function(file){
				// Try to send the .min.svg files.
				if     (file.filepath.indexOf(".min.svg") != -1){ dirFiles_pngs.push(file); }

				// If they are not available (yet) then send the .svg file.
				else if(file.filepath.indexOf(".svg")     != -1){ dirFiles_pngs.push(file); }
			});

			// Option 1: Send a filelist for the client to download.
			// *Option 2: Send a filelist containing each svg. (svg is plain text.)
			// Option 3: Send a .zip file of the svgs.

			let proms = [];
			dirFiles_pngs.forEach(function(file){
				// console.log(file);
				proms.push(
					new Promise(function(res1, rej1){
						fs.readFile(file.filepath, function (err, file_buffer) {
							if (err) {
								console.log("ERROR READING FILE 1", file, err); 
								rej1([file, err]); 
								return;
							}
							// 
							if(file.filepath.indexOf(".png") != -1){
								res1( 'data:image/png;base64,' + file_buffer.toString('base64').trim() );
							}
							else if(file.filepath.indexOf(".svg") != -1){
								res1( 'data:image/svg+xml;base64,' + file_buffer.toString('base64').trim() );
							}
						})
					})
				)
			});
			Promise.all(proms).then(
				function(results){
					// console.log(results.length, results);
					resolve_top(
						JSON.stringify(
							{
								"notebookId": notebookId,
								"targetPath": targetPath,
								"dirExists": dirExists,
								// "dirFiles": dirFiles,
								"dirFiles": dirFiles_pngs,
								"svgTexts": results,
							}, null, 0));
				},

				function(error){ console.log("ERROR:", error); reject_top(JSON.stringify([],null,0)); }
			);
		});
	},
	getGlobalUsageStats : function(){
		return new Promise(async function(resolve_top,reject_top){
			resolve_top(JSON.stringify([],null,0));
			// reject_top(JSON.stringify([],null,0));
		});
	},
	getThumbnails : function(notebookId){
		return new Promise(async function(resolve_top,reject_top){
			// Use the parentId
			let targetPath = dataPath + "" + notebookId;

			resolve_top(JSON.stringify([],null,0));
			// reject_top(JSON.stringify([],null,0));
		});
	},

};

// WEB UI ROUTES.
app.get('/updateAll' , async (req, res) => {
	console.log("\nroute: updateAll:", req.query);
	
	let stamp = timeIt.stamp("route: updateAll", null);
	let returnValue;
	try{ returnValue = await webApi.updateAll(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: updateAll", stamp);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	// Should be JSON already.
	res.send(returnValue);
});


app.get('/syncUsingWifi'       , async (req, res) => {
	console.log("\nroute: syncUsingWifi:", req.query);
	let stamp;

	// First, syncUsingWifi.
	stamp = timeIt.stamp("route: syncUsingWifi", null);
	let returnValue1;
	try{ returnValue1 = await webApi.syncRunner("tolocal", "wifi"); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: syncRunner", stamp);

	// Next, create and compress local .svgs, then update files.json.
	stamp = timeIt.stamp("createNotebookPageImages", null);
	let returnValue2;
	try{ returnValue2 = await createNotebookPageImages(false); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("createNotebookPageImages", stamp);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));

	// timeIt.clearTimeItStamps();

	// Should be JSON already.
	res.send({
		"syncUsingWifi"           : returnValue1,
		"createNotebookPageImages": returnValue2,
	});
});
app.get('/getFilesJson'        , async (req, res) => {
	console.log("\nroute: getFilesJson:", req.query);
	
	let stamp = timeIt.stamp("route: getFilesJson", null);
	let returnValue;
	try{ returnValue = await webApi.getFilesJson(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: getFilesJson", stamp);

	// The web UI does not need the "pages" within .content so remove them. 
	for(let key in returnValue.DocumentType){
		let rec = returnValue.DocumentType[key];

		// Save the first page. 
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

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	// Should be JSON already.
	res.send(returnValue);
});
app.get('/getGlobalUsageStats' , async (req, res) => {
	console.log("\nroute: getGlobalUsageStats:", req.query);
	
	let stamp = timeIt.stamp("route: getGlobalUsageStats", null);
	let returnValue;
	try{ returnValue = await webApi.getGlobalUsageStats(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: getGlobalUsageStats", stamp);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	// Should be JSON already.
	res.send(returnValue);
});
app.get('/getSvgs'             , async (req, res) => {
	console.log("\nroute: getSvgs", req.query);
	
	let stamp = timeIt.stamp("route: getSvgs:", null);
	let returnValue;
	try{ returnValue = await webApi.getSvgs(req.query.notebookId); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: getSvgs", stamp);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	// Should be JSON already.
	res.send(returnValue);
});

app.get('/getThumbnails'       , async (req, res) => {
	console.log("\nroute: getThumbnails:", req.query);
	// req.query.parentId

	let stamp = timeIt.stamp("route: getThumbnails", null);
	let returnValue;
	try{ returnValue = await webApi.getThumbnails(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: getThumbnails", stamp);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	// Should be JSON already.
	res.send(returnValue);
});

// DEBUG AND TEST ROUTES.
app.get('/showTimeItStamps'        , async (req, res) => {
	// http://localhost:3100/showTimeItStamps
	console.log("/showTimeItStamps");
	
	let timeStampString = timeIt.getStampString();
	let returnValue = "";
	returnValue += "*".repeat(83) + "\n";
	returnValue += "timeIt_stamps: " + timeStampString + "\n";
	returnValue += "*".repeat(83) + "\n";
	console.log(returnValue);
	
	// timeIt.clearTimeItStamps();

	// Convert '\n' to '<br>' for display via direct route.
	res.send( returnValue.replace(/\n/g, "<br>") );
});
app.get('/syncRunner'              , async (req, res) => {
	// http://localhost:3100/syncRunner?dest=tolocal&interface=wifi
	// http://localhost:3100/syncRunner?dest=tolocal&interface=usb
	// http://localhost:3100/syncRunner?dest=toremotel&interface=wifi
	// http://localhost:3100/syncRunner?dest=toremotel&interface=usb

	let func = function(dest, interface){
		return new Promise(function(resolve, reject){
			// Check for the validity of both arguments.
			if( ["tolocal", "toremote"].indexOf(dest) == -1) {
				res.send(JSON.stringify("ERROR: Invalid 'dest'"));
				return;
			}
			if( ["wifi", "usb"].indexOf(interface) == -1) {
				res.send(JSON.stringify("ERROR: Invalid 'interface'"));
				return;
			}

			let cmd = `cd scripts && ./syncRunner.sh ${dest} ${interface}`;
			console.log("syncRunner: ", cmd);
			exec(cmd, 
				function (error, stdout, stderr) {
					if (error) {
						console.log("syncRunner: ", "ERROR");
						// res.send(JSON.stringify({error: error, stderr:stderr, stdout:stdout}));
						reject(JSON.stringify({error: error, stderr:stderr, stdout:stdout}));
						return;
					}
					console.log("syncRunner: ", "DONE");
					// let ret = JSON.stringify(stdout);
					// res.send(stdout);
					resolve(stdout);
				}
			);
		});
	};

	let stamp = timeIt.stamp("route: syncRunner", null);
	let returnValue;
	try{ returnValue = await func(req.query.dest, req.query.interface); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: syncRunner", stamp);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	res.send(returnValue);
});
app.get('/createJsonFsData'        , async (req, res) => {
	console.log("/createJsonFsData");
	
	let timeItIndex = timeIt.stamp("route: createJsonFsData", null);
	let returnValue;
	try{ returnValue = await createJsonFsData(true); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: createJsonFsData", timeItIndex);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	res.send(
		"/createJsonFsData: (data written): " +
		"Files: "  + (Object.keys(returnValue["DocumentType"]).length) +
		", Dirs: " + (Object.keys(returnValue["CollectionType"]).length)
	);

});
app.get('/getExistingJsonFsData'   , async (req, res) => {
	console.log("/getExistingJsonFsData");
	
	// First, get the data.
	let timeItIndex = timeIt.stamp("route: getExistingJsonFsData", null);
	let returnValue;
	try{ returnValue = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	returnValue = returnValue.files;

	timeIt.stamp("route: getExistingJsonFsData", timeItIndex);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	res.send(returnValue);
});
app.get('/createNotebookPageImages', async (req, res) => {
	console.log("/createNotebookPageImages");
	
	let timeItIndex = timeIt.stamp("route: createNotebookPageImages", null);
	let recreateall = req.query.recreateall ? true : false;
	console.log("recreateall:", recreateall);
	let returnValue;
	try{ returnValue = await createNotebookPageImages(recreateall); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: createNotebookPageImages", timeItIndex);
	
	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	res.send(returnValue);
	console.log(returnValue);
});
app.get('/updateRemoteDemo'        , async (req, res) => {
	console.log("/getExistingJsonFsData");
	
	// First, get the data.
	let timeItIndex = timeIt.stamp("route: updateRemoteDemo", null);
	let returnValue;
	try{ returnValue = await updateRemoteDemo(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	returnValue = returnValue.files;

	timeIt.stamp("route: updateRemoteDemo", timeItIndex);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	res.send(returnValue);
});

// function shouldCompress (req, res) {
// 	// if (req.headers['x-no-compression']) {
// 	//   // don't compress responses with this request header
// 	//   return false;
// 	// }
  
// 	// fallback to standard filter function
// 	return compression.filter(req, res);
	
// 	// Just return true; 
// 	// return true;
// }
app.listen(port, () => {
	// Compression.
	// app.use(compression({ filter: shouldCompress }));

	// Set virtual paths.
	app.use('/'                  , express.static(htmlPath));
	app.use('/node_modules'      , express.static( path.join(__dirname, 'node_modules') ));
	app.use('/DEVICE_DATA'       , express.static(path.join(__dirname, 'DEVICE_DATA')));
	app.use('/DEVICE_DATA_IMAGES', express.static(path.join(__dirname, 'DEVICE_DATA_IMAGES')));

	// app.use('/data', express.static(path.join(__dirname, 'DEVICE_DATA')));
	// app.use('/svgs', express.static(path.join(__dirname, 'DEVICE_DATA_IMAGES')));

	// app.use('/DEVICE_DATA_IMAGES', serveIndex(__dirname + '/DEVICE_DATA_IMAGES'));
	// app.use('/DEVICE_DATA_IMAGES', serveIndex(path.join(__dirname, "DEVICE_DATA_IMAGES")));
	// app.use('/svgs', express.static('DEVICE_DATA_IMAGES'), serveIndex('DEVICE_DATA_IMAGES', {'icons': true}))
		
	//
	console.log(`*App listening at http://localhost:${port}*`);

});