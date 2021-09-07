// Libraries/frameworks from NPM.
// var serveIndex = require('serve-index');
const express  = require('express'); // npm install express
const compression = require('compression');
const app      = express();
const path     = require('path');
const exec     = require('child_process').exec;
const { spawn } = require('child_process');
const fs       = require('fs');
// const { mapLimit } = require('promise-async');
const async = require('promise-async');
const svg_to_png = require('svg-to-png');

// Personal libraries/frameworks.
var timeIt = require('./timeIt.js');

// express.compress({
// 	filter: function (req, res) {
// 	  return true;
// 	}
// });

//
const port     = 3100;
const dataPath = "DEVICE_DATA/xochitl/";
const imagesPath = "DEVICE_DATA_IMAGES/";
const htmlPath = path.join("..", 'Html');

// UTILITY
var getLastValueOfArray = function(arr){
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
let getParentDirName = function(file, files){
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
let getFullPathToDocument = function(){
	return new Promise(async function(resolve_top,reject_top){
		resolve_top();
	});
};
// Runs a specified command (with promise.)
let runCommand_exec = async function(cmd){
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
let runCommand_exec_progress = async function(cmd, expectedExitCode = 0, progress=true){
	return new Promise(function(cmd_res, cmd_rej){
		const proc = spawn(cmd, {
			shell: true
		});
		let stdOutHist = "";
		let stdErrHist = "";

		proc.stdout.on('data', (data) => {
			if(progress){
				console.log(`  stdout: ${data}`);
			}
			stdOutHist += data;
		});
		proc.stderr.on('data', (data) => {
			if(progress){
				console.error(`  stderr: ${data}`);
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
				cmd_rej();
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
		
								// ********** NEW PRE-FILTERING **********
								// Filter out what you don't need (just keep notebook-related stuff.)
								// preFilterObj = JSON.parse(file_buffer);
								// let keys_new      = Object.keys( preFilterObj["DocumentType"] );
								// keys_new.forEach(function(key){
									// let file_new      = preFilterObj["DocumentType"][key];
									
								// Only compare notebooks. 
								// if(file_new.content.fileType != "notebook"){ 
									// console.log("Skip non-notebook.", file_new_visibleName, file_dir_visibleName); 
									return; 
								// }

								// Ignore dummyDocument true.
								// else if(file_new.content.dummyDocument != false){ 
									// console.log("Skip dummyDocument.", file_new_visibleName, file_dir_visibleName); 
									// return; 
								// }

								// Ignore trash.
								// else if(file_dir_visibleName == "TRASH"){ 
								// 	console.log("Skip trash.", file_new_visibleName, file_dir_visibleName); 
								// 	return; 
								// }
								// });
								// ********** NEW PRE-FILTERING **********

								// Create metadata.
								newObj.metadata = JSON.parse(file_buffer);
		
								// DEBUG: Remove keys
								if(newObj.metadata.type == "CollectionType"){
									// delete newObj.metadata.deleted;
									// delete newObj.metadata.lastModified;
									// delete newObj.metadata.modified;
									// delete newObj.metadata.pinned;
									// delete newObj.metadata.synced;
									// delete newObj.metadata.version;
									// delete newObj.metadata.metadatamodified;
								}
								else if(newObj.metadata.type == "DocumentType"){
									// delete newObj.metadata.deleted;
									// delete newObj.metadata.lastModified;
									// delete newObj.metadata.modified;
									// delete newObj.metadata.pinned;
									// delete newObj.metadata.synced;
									// delete newObj.metadata.version;
									// delete newObj.metadata.metadatamodified;
		
									delete newObj.metadata.lastOpened;     
									delete newObj.metadata.lastOpenedPage; 
								}
		
								// Create extra.
								newObj.extra = {};
								newObj.extra["_thisFileId"] = file.replace(".metadata", "");
		
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
									let check1 = newObj.content.fileType != "notebook";
									let check2 = newObj.content.dummyDocument != false;
									let check3 = newObj.metadata.parent == "trash";

									// Only compare notebooks. 
									if(check1){

									}
									// Ignore dummyDocument true.
									else if(check2){

									}
									// Ignore trash.
									else if(check3){

									}
									// Add the completed record.
									else {
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
						// console.log("SUCCESS:", success.length, "files.");
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
const getExistingJsonFsData = async function(){
	return new Promise(async function(resolve,reject){
		let files;
		if( !fs.existsSync(htmlPath + "/files.json") ){
			console.log("getExistingJsonFsData: no existing data. Creating it now.");
			try{ files = await createJsonFsData(true); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
		}
		else{
			console.log("getExistingJsonFsData: Data exists, retrieving it.");
			files = fs.readFileSync(htmlPath + "/files.json");
			files = JSON.parse(files);
		}

		resolve(files);
	});
};
const createNotebookPageImages = async function(recreateall){
	return new Promise(async function(resolve_top,reject_top){
		// Holds log messages.
		let messages = [];

		// Holds changed/new files data. 
		let fileIdsWithChanges = [];

		// Holds the list of commands;
		let cmdList = [];

		// Runs a specified command.
		let preCommand = async function(cmdList){
			return new Promise(function(cmd_res, cmd_rej){
				let dirs1 = cmdList.map(function(d){
					return d.destDir;
				});
				
				let dirs = [];
				dirs1.forEach(function(d){
					if(dirs.indexOf(d) == -1) { dirs.push(d); }
				});

				console.log("Removing " + dirs.length + " directories recursively") ;

				for(let i=0; i<dirs.length; i+=1){
					try{
						let dest = dirs[i];
						if( fs.existsSync(dest) ){
							// Remove the directory recursively.
							fs.rmdirSync(dest, { recursive: true });
						}
						fs.mkdirSync(dest);
					}
					catch(e){
						cmd_rej();
					}
				}

				cmd_res();
			});
		};

		// Get the files.json file (or create it if it doesn't exist.)
		let existingFilesJson;
		try{ existingFilesJson = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }

		// Generate data against the synced data on the server. 
		let NewFilesJson;
		try{ NewFilesJson = await createJsonFsData(false); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }

		// Compare existing and new to detect changes. (new needs to win all conflicts.)

		// Check to see if the files are equal.
		if(!recreateall && JSON.stringify(existingFilesJson["DocumentType"]) == JSON.stringify(NewFilesJson["DocumentType"]) ){
			messages.push("createNotebookPageImages: No changes have been detected.");
			console.log(getLastValueOfArray(messages));
			resolve_top( { messages: messages, fileIdsWithChanges: fileIdsWithChanges } );
			return; 
		}
		// They are different. Determine what has changed and only update what has changed.
		else{
			messages.push("createNotebookPageImages: Changes have been detected.");
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

				// Only compare notebooks. 
				if(file_new.content.fileType != "notebook"){ 
					// console.log("Skip non-notebook.", file_new_visibleName, file_dir_visibleName); 
					return; 
				}
				
				// Ignore dummyDocument true.
				if(file_new.content.dummyDocument != false){ 
					console.log("Skip dummyDocument.", file_new_visibleName, file_dir_visibleName); 
					return; 
				}
				
				// Ignore trash.
				if(file_dir_visibleName == "TRASH"){ 
					console.log("Skip trash.", file_new_visibleName, file_dir_visibleName); 
					return; 
				}

				// Ignore content with missing transforms.
				// if(file_new.content.transform == undefined){ 
				// 	console.log("Missing transform.", file_new_visibleName, file_dir_visibleName); 
				// 	return;
				// }

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
			// fileIdsWithChanges.forEach(async function(obj){
				let regenerateAllPages=false;

				if(recreateall){
					// messages.push("createNotebookPageImages:   recreateall.");
					// console.log(getLastValueOfArray(messages)); 

					// Just regenerate all the pages. 
					regenerateAllPages = true; 
				}
				else if(obj.change=="updated"){
					// reMarkable .lines file, version=5

					// Have the number of pages changed?
					if( obj.oldFile.content.pages.length != obj.newFile.content.pages ){
						messages.push("createNotebookPageImages:   Page count change.");
						console.log(getLastValueOfArray(messages));

						// Just regenerate all the pages. 
						regenerateAllPages = true; 
					}
					// Has the order of the pages changed?
					else if( obj.oldFile.content.pages.toString() != obj.newFile.content.pages.toString() ){
						messages.push("createNotebookPageImages:   Page order change.");
						console.log(getLastValueOfArray(messages)); 

						// Just regenerate all the pages. 
						regenerateAllPages = true; 
					}
					// Just a data change on the file.
					else{
						messages.push("createNotebookPageImages:   Page data change.");
						console.log(getLastValueOfArray(messages)); 
	
						// Just regenerate all the pages. 
						regenerateAllPages = true; 
					}
				}
				else if(obj.change=="newfile"){
					// resolve_top( { messages: messages, cmdList: cmdList } );
					regenerateAllPages=true;
				}
				else if(obj.change=="delete"){
					// resolve_top( { messages: messages, cmdList: cmdList } );
					regenerateAllPages=true;
				}
				else{
					// Unknown change type. 
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
						let baseFileName = obj.newFile.metadata.visibleName.replace(/[^A-Z0-9]+/ig, "_");
						let dest_fullName = imagesPath + obj.key + "/" + baseFileName ;
						let srcFile = dataPath + obj.key + "/" + page + ".rm";
						let pageNum = page_i.toString().padStart(3, "0");
						let fullOutputName = `${dest_fullName}_PAGE_${pageNum}.svg`;
						let cmd = `python3 scripts/rM2svg.py -i ${srcFile} -o ${fullOutputName}`;
						let cmd2 = `node_modules/svgo/bin/svgo --config="scripts/svgo.config.json" ${fullOutputName} -o ${fullOutputName} `;
						
						// Add the full command and info.
						cmdList.push({
							cmd: cmd, 
							cmd2: cmd2, 
							key: obj.key,
							numPages: pages.length,
							clearFirst: true,
							srcRmDir: dataPath + obj.key,
							destDir: imagesPath + obj.key,
							fullOutputName: fullOutputName,
							baseFileName: baseFileName + "_PAGE_" + pageNum,
						});
						// console.log("Wait here");
					});
				}
			// });
			}

			if(cmdList.length){
				try{ await preCommand(cmdList); } catch(e){ console.log("failure: preCommand", e); }

				let destDirs_pre = [];
				cmdList.forEach(function(d){ if(destDirs_pre.indexOf(d.destDir) == -1){ 
					destDirs_pre.push(d.destDir); 
					}
				});

				let destDirs = [];
				destDirs_pre.forEach(function(dir, dir_i, dir_a){
					// Allow only one.
					// if(dir.indexOf("1c5917c5-1451-4fb4-8b5a-03531b32dbf4") == -1){ return; } // Go Fish
					// if(dir.indexOf("d70d80a5-9378-4739-81a5-4cb14c22e9c4") == -1){ return; } // Pen Test

					destDirs.push({
						"dir": dir,
						"num": (dir_i+1) + "/" + dir_a.length, 
						"pages": cmdList.filter(function(f){ if(f.destDir==dir){ return true; } }).length,
						"notebookName":NewFilesJson["DocumentType"][dir.split("/")[1]].metadata.visibleName,
						"parentName": getParentDirName(NewFilesJson["DocumentType"][dir.split("/")[1]], NewFilesJson),
					});
				});

				// let bigCmd = 'echo "First noteboook..."' ;
				let bigCmd = '' ;
				console.log("STARTING: rM2svg...");
				for(let notebook=0; notebook<destDirs.length; notebook+=1){
					let rec = destDirs[notebook];

					// if(rec.pages != 10) { continue; }
					
					let recs = cmdList.filter(function(r){
						if(rec.dir == r.destDir) { return true; }
					});
					
					for(let cmd_i=0; cmd_i<recs.length; cmd_i+=1){
						// Just the first command. 
						if(bigCmd == ""){
							bigCmd += "" + recs[cmd_i].cmd ;
						}
						else{
							bigCmd += " && " + recs[cmd_i].cmd ;
						}
					}
					console.log("CURRENT: notebook:", (notebook+1), "of", destDirs.length, ", pages:", rec.pages, ", cmdLength:", bigCmd.length);
					try{ await runCommand_exec_progress(bigCmd, 0, true); } catch(e){ console.log("failure: bigCmd", e, bigCmd.length, "of", 32000); }
					
					// bigCmd = 'echo "Next notebook..."';
					bigCmd = '';
				}
				
				// convertSvgsToPngs
				// try{ await convertSvgsToPngs(cmdList); } catch(e){ console.log("failure: convertSvgsToPngs", e); }
				// resolve_top( { messages: messages } );
				
				// convertSvgsToPngs2
				bigCmd = '' ;
				console.log("STARTING: svgexport...");
				for(let notebook=0; notebook<destDirs.length; notebook+=1){
					let rec = destDirs[notebook];

					// if(rec.pages != 10) { continue; }
					
					let recs = cmdList.filter(function(r){
						if(rec.dir == r.destDir) { return true; }
					});
					
					for(let cmd_i=0; cmd_i<recs.length; cmd_i+=1){
						if(bigCmd == ""){
							bigCmd += "" ;
						}
						else{
							bigCmd += " && "
						}
						let pngName = recs[cmd_i].fullOutputName.replace(/.svg/g, ".png");
						bigCmd += `svgexport ${recs[cmd_i].fullOutputName} ${pngName} png 100% 555:666 pad `
						// bigCmd += `svgexport ${recs[cmd_i].fullOutputName} ${pngName} png 100% pad `
					}
					console.log("CURRENT: notebook:", (notebook+1), "of", destDirs.length, ", pages:", rec.pages, ", cmdLength:", bigCmd.length);
					try{ await runCommand_exec_progress(bigCmd, 0, true); } catch(e){ console.log("failure: bigCmd", e, bigCmd.length, "of", 32000); }
					
					// bigCmd = 'echo "Next notebook..."';
					bigCmd = '';
				}
				
				// try{ await convertSvgsToPngs(cmdList); } catch(e){ console.log("failure: convertSvgsToPngs", e); }
				// resolve_top( { messages: messages } );
				
				resolve_top( { messages: messages } );
				
			}
			else{
				console.log("No commands to run.");
				resolve_top( { messages: messages } );
			}

		}
	});
};
const convertSvgsToPngs = async function(destDirs){
	return new Promise(async function(resolve_top,reject_top){
		// console.log(destDirs);
		// dir: 'DEVICE_DATA_IMAGES/862892f0-e2fc-459c-b347-176c36e75040',
		// num: '99/188',
		// pages: 3,
		// notebookName: 'Assigning Identity-based Policies for users, Roles, and Groups on AWS',
		// parentName: '01 Beginner'

		// {
		// 	key: "010d635d-60c4-4ed2-bc13-1b0c728a449c",
		// 	numPages: 27,
		// 	srcRmDir: "DEVICE_DATA/xochitl/010d635d-60c4-4ed2-bc13-1b0c728a449c",
		// 	destDir: "DEVICE_DATA_IMAGES/010d635d-60c4-4ed2-bc13-1b0c728a449c",
		// 	fullOutputName: "DEVICE_DATA_IMAGES/010d635d-60c4-4ed2-bc13-1b0c728a449c/Work_Notes_1_PAGE_000.svg",
		// 	baseFileName: "Work_Notes_1_PAGE_000",
		// }

		// Run the commands.
		let currentFile=0;
		let totalFiles = destDirs.length;
		let prom_svgToPng = async.mapLimit(destDirs, 10, async function(rec, callback){
			let fullpath_src  = path.join(__dirname, rec.fullOutputName);// + "/" + srcFile;
			let fullpath_dest = path.join(__dirname, rec.destDir);
			// console.log(rec.baseFileName, "START:", rec.destDir);
			try{ await svg_to_png.convert(fullpath_src, fullpath_dest); } catch(e){ console.log("error in convertSvgsToPngs", e); } 
			console.log(`DONE: (${currentFile+1} of ${totalFiles}) ${rec.baseFileName} (${rec.destDir})`);
			// console.log(rec.baseFileName, "DONE:", rec.destDir);
			currentFile+=1;
			callback(null, rec);
		});

		prom_svgToPng
		.then(
			result => {
				console.log("success:", result.length, "of", destDirs.length);
				// resolve_top( { messages: messages } );
				resolve_top( { } );
			}
		)
		.catch(
			(err) => {
				console.log("no success", err);
				reject_top(err);
			}
		);

	});
};
const convertSvgsToPngs2 = async function(destDirs){
	return new Promise(async function(resolve_top,reject_top){
		// console.log(destDirs);
		// dir: 'DEVICE_DATA_IMAGES/862892f0-e2fc-459c-b347-176c36e75040',
		// num: '99/188',
		// pages: 3,
		// notebookName: 'Assigning Identity-based Policies for users, Roles, and Groups on AWS',
		// parentName: '01 Beginner'

		// {
		// 	key: "010d635d-60c4-4ed2-bc13-1b0c728a449c",
		// 	numPages: 27,
		// 	srcRmDir: "DEVICE_DATA/xochitl/010d635d-60c4-4ed2-bc13-1b0c728a449c",
		// 	destDir: "DEVICE_DATA_IMAGES/010d635d-60c4-4ed2-bc13-1b0c728a449c",
		// 	fullOutputName: "DEVICE_DATA_IMAGES/010d635d-60c4-4ed2-bc13-1b0c728a449c/Work_Notes_1_PAGE_000.svg",
		// 	baseFileName: "Work_Notes_1_PAGE_000",
		// }

		// Make big command.

		// Run the commands.
		let currentFile=0;
		let totalFiles = destDirs.length;
		let prom_svgToPng = async.mapLimit(destDirs, 10, async function(rec, callback){
			let fullpath_src  = path.join(__dirname, rec.fullOutputName);// + "/" + srcFile;
			let fullpath_dest = path.join(__dirname, rec.destDir);
			// console.log(rec.baseFileName, "START:", rec.destDir);
			
			// try{ await svg_to_png.convert(fullpath_src, fullpath_dest); } catch(e){ console.log("error in convertSvgsToPngs", e); } 

			console.log(`DONE: (${currentFile+1} of ${totalFiles}) ${rec.baseFileName} (${rec.destDir})`);
			// console.log(rec.baseFileName, "DONE:", rec.destDir);
			currentFile+=1;
			callback(null, rec);
		});

		prom_svgToPng
		.then(
			result => {
				console.log("success:", result.length, "of", destDirs.length);
				// resolve_top( { messages: messages } );
				resolve_top( { } );
			}
		)
		.catch(
			(err) => {
				console.log("no success", err);
				reject_top(err);
			}
		);

	});
};
const webApi = {
	syncRunner : async function(dest, interface){
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
			// console.log("syncRunner: ", cmd);
			exec(cmd, 
				function (error, stdout, stderr) {
					if (error) {
						console.log("syncRunner: ", "ERROR");
						reject_top(JSON.stringify({error: error, stderr:stderr, stdout:stdout}));
						return;
					}
					// console.log("syncRunner: ", "DONE");
					// console.log( {error: error, stderr:stderr, stdout:stdout} );
					resolve_top(JSON.stringify(stdout+stderr,null,1));
				}
			);
		});
	},
	getFilesJson : async function(){
		return new Promise(async function(resolve_top,reject_top){
			let existingFilesJson;
			try{ existingFilesJson = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }
			resolve_top(existingFilesJson);
		});
	},
	getSvgs : async function(notebookId){
		return new Promise(async function(resolve_top,reject_top){
			// Need to check that the directory exists.
			// Need to check if there are already svg files in the directory.
			// Retrieve what is in that directory.
			let targetPath = imagesPath + "/" + notebookId;
			let dirExists = fs.existsSync(targetPath);
			let dirFiles = await getItemsInDir(targetPath, "files"); // fs.promises.readdir(targetPath);

			let dirFiles_pngs = [];
			dirFiles.forEach(function(file){
				if(file.filepath.indexOf(".png") != -1){ dirFiles_pngs.push(file); }
				// if(file.filepath.indexOf(".svg") != -1){ dirFiles_pngs.push(file); }
			});

			// Option 1: Send a filelist for the client to download.
			// Option 2: Send a filelist containing each svg. (svg is plain text.)
			// Option 3: Send a .zip file of the svgs.

			let proms = [];
			dirFiles_pngs.forEach(function(file){
				console.log(file);
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
	getGlobalUsageStats : async function(){
		return new Promise(async function(resolve_top,reject_top){
			resolve_top(JSON.stringify([],null,0));
			// reject_top(JSON.stringify([],null,0));
		});
	},
	getThumbnails : async function(parentId){
		return new Promise(async function(resolve_top,reject_top){
			resolve_top(JSON.stringify([],null,0));
			// reject_top(JSON.stringify([],null,0));
		});
	},
	debug_getNotebookList : async function(){
		return new Promise(async function(resolve_top,reject_top){
			// resolve_top(JSON.stringify([],null,0));
			// reject_top(JSON.stringify([],null,0));

			let existingFilesJson;
			try{ existingFilesJson = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }

			let list = [];
			let keys = Object.keys(existingFilesJson.DocumentType);
			keys.forEach(function(key){
				let d = existingFilesJson.DocumentType[key];

				// Get content.fileType
				if(d.content.fileType != "notebook") { return; }
				
				// Get content.dummyDocument
				if(d.content.dummyDocument) { return; }

				let obj = {};

				// Get metadata.visibleName
				obj.visibleName = d.metadata.visibleName;
				
				// Get content.pageCount
				obj.pageCount = d.content.pageCount;
				
				// Get content.pages.length
				// obj.pageCount2 = d.content.pages.length;
				
				// Add the key.
				obj.key = key;

				// Add the parent.
				try{ obj.parentName = getParentDirName(d, existingFilesJson); } catch(e){ obj.parentName = "UNKNOWN"; }

				list.push(obj);
			});

			list.sort((a,b)=> (a.parentName > b.parentName ? 1 : -1));
			// list.sort((a,b)=> (a.pageCount > b.pageCount ? 1 : -1));

			// resolve_top(list);
			resolve_top(JSON.stringify(list,null,0));
		});
	},
};

// WEB UI ROUTES.
app.get('/syncUsingWifi'       , async (req, res) => {
	console.log("\nroute: syncUsingWifi:", req.query);

	let stamp = timeIt.stamp("route: syncUsingWifi", null);
	let returnValue;
	try{ returnValue = await webApi.syncRunner("tolocal", "wifi"); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: syncRunner", stamp);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	// Should be JSON already.
	res.send(returnValue);
});
app.get('/getFilesJson'        , async (req, res) => {
	console.log("\nroute: getFilesJson:", req.query);
	
	let stamp = timeIt.stamp("route: getFilesJson", null);
	let returnValue;
	try{ returnValue = await webApi.getFilesJson(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: getFilesJson", stamp);

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
app.get('/getSvgs' , async (req, res) => {
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
app.get('/debug_getNotebookList' , async (req, res) => {
	console.log("\nroute: debug_getNotebookList", req.query);
	
	let stamp = timeIt.stamp("route: debug_getNotebookList:", null);
	let returnValue;
	try{ returnValue = await webApi.debug_getNotebookList(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	timeIt.stamp("route: debug_getNotebookList", stamp);

	let timeStampString = timeIt.getStampString();
	console.log("*".repeat(83));
	console.log("timeIt_stamps:", timeStampString );
	console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();

	// Should be JSON already.
	res.send(returnValue);
});

app.get('/getThumbnails'             , async (req, res) => {
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
app.get('/showTimeItStamps', async (req, res) => {
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
app.get('/syncRunner', async (req, res) => {
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
app.get('/createJsonFsData', async (req, res) => {
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
app.get('/getExistingJsonFsData', async (req, res) => {
	console.log("/getExistingJsonFsData");
	
	let timeItIndex = timeIt.stamp("route: getExistingJsonFsData", null);
	let returnValue;
	try{ returnValue = await getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
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

function shouldCompress (req, res) {
	// if (req.headers['x-no-compression']) {
	//   // don't compress responses with this request header
	//   return false;
	// }
  
	// fallback to standard filter function
	return compression.filter(req, res);
  }
app.listen(port, () => {
	// Compression.
	app.use(compression({ filter: shouldCompress }));

	// Set virtual paths.
	app.use('/'                  , express.static(htmlPath));
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