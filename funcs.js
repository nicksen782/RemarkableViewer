const fs              = require('fs');
const path            = require('path');
const { spawn }       = require('child_process');
const config          = require('./config.js').config;

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

		let files = await getItemsInDir(config.dataPath, "files");
		files = files.filter(function(d){
			if(d.filepath.indexOf(".metadata") != -1){ return true; }
		})
		.map(
			function(d){
				let base = d.filepath.replace(config.dataPath, "");
				return base;
			})
		;

		files = await getAllJson(files, config.dataPath);

		files = await createDirectoryStructure(files);
		
		if(writeFile){
			fs.writeFileSync(config.htmlPath + "/files.json", JSON.stringify(files,null,0), function(err){
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
		if( !fs.existsSync(config.htmlPath + "/files.json") ){
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
			files = fs.readFileSync(config.htmlPath + "/files.json");
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
		fs.writeFileSync(config.scriptsPath + "/demo_files.json", JSON.stringify(newFilesJson,null,1), function(err){
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
		fs.writeFileSync(config.scriptsPath + "/updateRemoteDemo.filter", filterText.join("\n"), function(err){
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
		fs.writeFileSync(config.scriptsPath + "/updateRemoteDemo.resps.json", JSON.stringify(retObj,null,1), function(err){
			if (err) { console.log("ERROR: ", err); reject(err); }
		});

		resolve(retObj);
	});
};

module.exports = {
	funcs : {
		getLastValueOfArray     : getLastValueOfArray     ,
		getItemsInDir           : getItemsInDir           ,
		getParentDirName        : getParentDirName        ,
		getParentPath           : getParentPath           ,
		runCommand_exec_progress: runCommand_exec_progress,
		createJsonFsData        : createJsonFsData        ,
		getExistingJsonFsData   : getExistingJsonFsData   ,
		updateRemoteDemo        : updateRemoteDemo        ,
	},
	// getLastValueOfArray     : getLastValueOfArray     ,
	// getItemsInDir           : getItemsInDir           ,
	// getParentDirName        : getParentDirName        ,
	// getParentPath           : getParentPath           ,
	// runCommand_exec_progress: runCommand_exec_progress,
	// createJsonFsData        : createJsonFsData        ,
	// getExistingJsonFsData   : getExistingJsonFsData   ,
	// updateRemoteDemo        : updateRemoteDemo        ,
	
	_version          : function(){ return "Version 2021-09-23"; }
};