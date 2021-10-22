const fs              = require('fs');
const path            = require('path');
const { spawn }       = require('child_process');
const config          = require('./config.js').config;

// UTILITY FUNCTIONS - SHARED.

// Shared function to handle rejections. 
const rejectionFunction        = function(title, e, rejectFunction, sse=null){
	let msg = `ERROR in ${title}: ${e}`;
	console.log(msg); 
	if(sse){ sse.write(JSON.stringify(msg)); }
	
	//
	msg = `FAILED: updateFromDevice\n`;
	console.log(msg); 
	if(sse){ sse.write(msg); }
	
	// END THE SSE STREAM.
	if(sse){ sse.end(); }

	// REJECT AND RETURN.
	rejectFunction(JSON.stringify(e)); 
};

//
const getRange                 = function(start, stop, step = 1) {
	// EXAMPLE USAGES: 
	// let pageRange = funcs.getRange( 0, 5, 1 ); // Gives [0,1,2,3,4,5]
	// let pageRange = funcs.getRange( 0, 6, 2 ); // Gives [0,2,4,6]
	return Array( Math.ceil((stop - start) / step) )
	.fill(start)
	.map((x, y) => x + y * step);
}

//
const getItemsInDir            = function(targetPath, type, ext=""){
	return new Promise(function(resolve, reject){
		// Check for the correct type.
		if(["files", "dirs"].indexOf(type) == -1){
			let msg = "Invalid type specified.";
			console.log("getItemsInDir:", msg);
			reject(msg);
			return ;
		}

		// Read the file list for the indicated targetPath.
		fs.promises.readdir(targetPath)
			.then(async function(files){
				const fetchedFiles = [];
				
				// Go through each file/dir returned by readdir.
				for (let file of files) {
					try {
						// Get the filepath. 
						const filepath = path.join(targetPath, file);
			
						// Get the stats for this file. 
						const stats = await fs.promises.lstat(filepath).catch(function(e) { throw e; });
				
						// Handle "files".
						if (type=="files" && stats.isFile() && file.lastIndexOf(ext) != -1) {
							fetchedFiles.push({ filepath });
						}
						
						// Handle "dirs".
						if (type=="dirs" && stats.isDirectory() && file.lastIndexOf(ext) != -1) {
							fetchedFiles.push({ filepath });
						}
					} 
					catch (err) {
						console.error(err);
						throw err;
						return;
					}
				}

				// Return the data.
				resolve(fetchedFiles);
				return; 

			})
			.catch(function(e){ 
				console.log("getItemsInDir:", "Error while reading file stats.", e);
				reject(e);
				return;
			})
		;
	
	});
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
//
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

		proc.on('exit', (code) => {
			if(code == expectedExitCode){ 
				cmd_res({
					"stdOutHist": stdOutHist,
					"stdErrHist": stdErrHist,
				}); 
			}
			else{
				console.log(`  child process exited with code ${code}`);
				console.log(`  cmd: ${cmd}`);
				cmd_rej({
					"cmd": cmd,
					"stdOutHist": stdOutHist,
					"stdErrHist": stdErrHist,
				});
			}
		});

	});

};

// FUNCTIONS - SHARED.

//
const createJsonFsData         = async function(writeFile){
	return new Promise(async function(resolve, reject){
		const getAllJson = function(fileList, basePath){
			return new Promise(async function(res, rej){
				let json = {
					"CollectionType": [],
					"DocumentType": [],
				};

				let getFileData = function(filename, type){ 
					return new Promise(function(res1, rej1){
						let obj = {
							"filename" : filename,
							"type"     : type,
							"data"     : null,
							"error"    : null,
						};

						fs.readFile(filename, function (err, file_buffer) {
							if (err) {
								obj.error = `Error on file access: ${err.code}`;
								rej1(obj);
								return;
							}
							else{
								if(type == "json"){
									obj.data = JSON.parse(file_buffer);
									res1(obj);
									return;
								}
								else if(type == "text"){
									obj.data = file_buffer.toString();
									res1(obj);
									return;
								}
								else{
									obj.error = "File type is invalid.";
									rej1(obj);
									return;
								}
							}
						});
					}); 
				};

				let getFilenames = function(basePath, file){
					let obj = {};
					obj.metadata = path.join(basePath, file);
					obj.content  = path.join(basePath, file.replace(".metadata", ".content") );
					obj.pagedata = path.join(basePath, file.replace(".metadata", ".pagedata") );
					return obj;
				};

				let proms = [];
				for(let index = 0; index<fileList.length; index+=1){
					let _thisFileId = fileList[index].replace(".metadata", "");
					let filenames     = getFilenames(basePath, fileList[index]);
					let metadata_file = await getFileData( filenames.metadata, "json").catch(function(e) { return e; });
					let content_file  = await getFileData( filenames.content , "json").catch(function(e) { return e; });
					let pagedata_file = await getFileData( filenames.pagedata, "text").catch(function(e) { return e; });

					// If either the metadata or the content file is missing then we cannot continue.
					if(metadata_file.error){
						rej([filenames.metadata, metadata_file.error]); 
						return;
					}
					else if(content_file.error){
						rej([filenames.content, content_file.error]); 
						return;
					}

					proms.push(
						new Promise(function(res1, rej1){
							// Start creating the new json entry.
							let newObj = {};

							// METADATA
							newObj.metadata = metadata_file.data;

							// CONTENT
							newObj.content = {};
							newObj.content = content_file.data;

							// EXTRA
							newObj.extra = {};
							newObj.extra["_thisFileId"] = _thisFileId; 

							// ********** NEW PRE-FILTERING **********
							let check0 = newObj.metadata.type         == "CollectionType";
							let check1 = newObj.content.fileType      != "notebook" && newObj.content.fileType != "pdf";
							let check2 = newObj.content.dummyDocument != false;

							// Allow all CollectionType (no further checks.)
							if(check0){ 
								json[newObj.metadata.type].push(newObj); 
								res1(); 
								return;
							}

							// Allow notebook and pdf. 
							else if(check1){ res1(); return; }

							// Disallow dummyDocument.
							else if(check2){ res1(); return; }

							// PAGEDATA
							newObj.pagedata = pagedata_file.data.trim().split("\n");

							// Save the first page id.
							newObj.extra["_firstPageId"] = newObj.content.pages[0]; // Save the first page. 
							
							// Add the completed record.
							json[newObj.metadata.type].push(newObj);
							res1(); 
							return; 
						})
					);
				}
		
				Promise.all(proms).then(
					function(success){
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
		
				// Creates "directories"
				fileList["CollectionType"].forEach(function(d){
					// Create the object if it doesn't exist.
					if(!dirs[d.metadata.parent]){
						dirs[d.extra._thisFileId] = {};
					}
		
					// Add to the object
					dirs[d.extra._thisFileId] = {
						metadata: d.metadata,
						content : d.content,
						extra   : d.extra,
						
						// DEBUG
						path: "",
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
						content : d.content,
						extra   : d.extra,
						pagedata: d.pagedata,
						
						// DEBUG
						path: "",
						name: d.metadata.visibleName
					};
				});
		
				// Create a "directory" for trash.
				dirs["trash"] = {
					metadata: {
						"deleted": false,
						"lastModified": "0",
						"metadatamodified": false,
						"modified": true,
						"parent": "",
						"pinned": false,
						"synced": false,
						"type": "CollectionType",
						"version": 1,
						"visibleName": "trash"
					},
					content : {},
					extra   : {
						"_thisFileId": "trash"
					},

					// DEBUG
					path: "",
					name: "trash"
				};
				// Create a "directory" for deleted.
				dirs["deleted"] = {
					metadata: {
						"deleted": false,
						"lastModified": "0",
						"metadatamodified": false,
						"modified": true,
						"parent": "",
						"pinned": false,
						"synced": false,
						"type": "CollectionType",
						"version": 1,
						"visibleName": "deleted"
					},
					content : {},
					extra   : {
						"_thisFileId": "deleted"
					},

					// DEBUG
					path: "",
					name: "deleted"
				};

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

		// Get a list of all the files in the xochitil folder.
		let files = await getItemsInDir(config.dataPath, "files", ".metadata").catch(function(e) { throw e; });
		
		// Further filter each name to remove the full config.dataPath.
		files = files.map( function(d){
			let filename = d.filepath.split("/");
			filename = filename[filename.length-1];
			return filename; 
		});

		files = await getAllJson(files, config.dataPath).catch(function(e) { throw e; });
		files = await createDirectoryStructure(files).catch(function(e) { throw e; });
		
		if(writeFile){
			fs.writeFileSync(config.filesjson, JSON.stringify(files,null,0), function(err){
				if (err) { console.log("ERROR: ", err); reject(err); }
			});
		}

		resolve(files);
	});
};
//
const getExistingJsonFsData    = async function(fullVersion=true){
	// throw "TEST1";
	return new Promise(async function(resolve,reject){
		let files;
		let recreateall = false;
		if( !fs.existsSync(config.filesjson) ){
			try{ 
				files = await createJsonFsData(true).catch(function(e) { throw e; }); 
			} 
			catch(e){ 
				console.log("ERROR:", e); 
				reject(JSON.stringify(e)); 
				return; 
			}
			recreateall = true;
		}
		else{
			files = fs.readFileSync(config.filesjson);
			files = JSON.parse(files);
		}

		if(!fullVersion){
			// Remove some data from the CollectionTypes.
			for(let key in files.CollectionType){
				let rec = files.CollectionType[key];
				
				// Delete from object root:
				delete rec.name;
			}
			
			// Remove some data from the DocumentTypes.
			for(let key in files.DocumentType){
				let rec = files.DocumentType[key];

				// Save the only the first page. 
				if(!rec.extra._firstPageId){
					console.log("Adding missing rec.extra._firstPageId");
					rec.extra._firstPageId = rec.content.pages[0];
				}

				// Delete from .content:
				let keys_content = Object.keys(rec.content);
				let keep_content = ["pageCount", "fileType", "textScale", "orientation", "margins"];
				keep_content.push("pages");
				keys_content.forEach(function(d){
					if(keep_content.indexOf(d) == -1){
						delete rec.content[d];
					}
				});
				// delete rec.content.pages;

				// Remove the remaining unneeded keys.
				// delete newObj.content.coverPageNumber;
				// delete newObj.content.documentMetadata;
				// delete newObj.content.extraMetadata;
				// delete newObj.content.fontName;
				// delete newObj.content.lineHeight;
				// delete newObj.content.transform;

				// Delete from object root:
				delete rec.name;
			}
		}

		resolve({recreateall:recreateall, files:files});
	});
};
//
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
		try{ files = await getExistingJsonFsData(true).catch(function(e) { throw e; }); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
		files = files.files;

		// Get a list of all files and directories within "Remarkable Page Turner"
		let newFilesJson = {
			"CollectionType": {}, 
			"DocumentType"  : {}, 
		};

		// Dirs of the parent "Remarkable Page Turner" directory..
		let dirIds = [
			"4f668058-bfd5-402f-a4dd-e7a3e83f1578", // "Remarkable Page Turner"
			"4d763cad-5f31-4afd-bcd8-e7e77dd9ee60", // "Old notes - v1" 
			"4a6d27f9-affc-4280-95b4-bbca0964ae6b", // "Old notes - v2" 
			"7e16a6a5-a592-44d0-9b2e-f1c110650a6f", // "Old notes - v3" 
			// "051a804c-9d36-4617-96d5-41091e89c520", // "V4 Notes"       
			"05593124-305f-478d-b603-1a62993f0c20", // "Drawings        
			// "4f668058-bfd5-402f-a4dd-e7a3e83f1578", // "Install Instructions"
		];
		// console.log("Generated the dirIds:", dirIds);
		
		// Get the directories for the "Remarkable Page Turner" directory.
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
		// newFilesJson.DocumentType["78f004b5-c3ec-44f6-b624-0f47d1eacb0c"].metadata.parent = ""; // old getting started.
		newFilesJson.DocumentType["6fa5ae80-08ee-4c30-99ca-babe9ea1254a"].metadata.parent = ""; // new getting started.
		
		// console.log("Generated CollectionType/DocumentType:", newFilesJson);

		// Create a demo_files.json with only that data.
		fs.writeFileSync(config.demo_filesjson, JSON.stringify(newFilesJson,null,1), function(err){
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
		fs.writeFileSync(config.demo_filter, filterText.join("\n"), function(err){
			if (err) { console.log("ERROR: ", err); reject(err); }
		});
		// console.log("Generated config.demo_filter:", filterText.join("\n"));
		
		// Break up the script into parts (easier to debug.)
		let cmd;
		cmd = `cd ${config.scriptsPath} && ./updateRemoteDemo.sh `;
		let resp1, resp2, resp3, resp4, resp5, resp6;
		try{ console.log("(SERVER)             - part1: "); resp1 = await runCommand_exec_progress(cmd + " part1", 0, true).catch(function(e) { throw e; }); } catch(e){ console.log("Error in updateRemoteDemo: part1", e); reject(); }
		try{ console.log("(configFile.json)    - part2: "); resp2 = await runCommand_exec_progress(cmd + " part2", 0, true).catch(function(e) { throw e; }); } catch(e){ console.log("Error in updateRemoteDemo: part2", e); reject(); }
		try{ console.log("(Html)               - part3: "); resp3 = await runCommand_exec_progress(cmd + " part3", 0, true).catch(function(e) { throw e; }); } catch(e){ console.log("Error in updateRemoteDemo: part3", e); reject(); }
		try{ console.log("(files.json)         - part4: "); resp4 = await runCommand_exec_progress(cmd + " part4", 0, true).catch(function(e) { throw e; }); } catch(e){ console.log("Error in updateRemoteDemo: part4", e); reject(); }
		try{ console.log("(DEVICE_DATA)        - part5: "); resp5 = await runCommand_exec_progress(cmd + " part5", 0, true).catch(function(e) { throw e; }); } catch(e){ console.log("Error in updateRemoteDemo: part5", e); reject(); }
		try{ console.log("(DEVICE_DATA_IMAGES) - part6: "); resp6 = await runCommand_exec_progress(cmd + " part6", 0, true).catch(function(e) { throw e; }); } catch(e){ console.log("Error in updateRemoteDemo: part6", e); reject(); }

		let retObj = {
			"part1": resp1 ,
			"part2": resp2 ,
			"part3": resp3 ,
			"part4": resp4 ,
			"part5": resp5 ,
			"part6": resp6 ,
		};

		// Write the file with the resps in it.
		fs.writeFileSync(config.demo_resps, JSON.stringify(retObj,null,1), function(err){
			if (err) { console.log("ERROR: ", err); reject(err); }
		});

		resolve(retObj);
	});
};

// Used to set your files as never synced to the cloud. (You still need to rsync them to the Remarkable Tablet.)
const metadata_unsync          = async function(){
	// EXAMPLE RSYNC: cd DEVICE_DATA && rsync --delete -r -v -a --stats  --exclude '.cache/' --exclude 'webusb' --exclude 'syncthirdparty' --exclude 'templates' --exclude '.gitkeep' . remarkableusb:/home/root/.local/share/remarkable/^C
	return new Promise(async function(resolve,reject){
		// Get the file names in the dir.
		let files = await getItemsInDir(config.dataPath, "files", ".metadata");

		// Return only an array of filenames.
		files.map(
			function(d){
				let base = d.filepath.replace(config.dataPath, "");
				return base;
			})
		;

		let bk;
		let proms = [];
		for(let i=0; i<files.length; i+=1){
			let file = files[i];
			proms.push(
				 new Promise(async function(res,rej){
				// Retrieve and open the file.
					fs.readFile(file, function (err, file_buffer) {
						// This is unlikely to happen since we provide a file list.
						if(err){ console.log("ERROR: Could not read the file.", err); rej(err); return; }
					
						// Parse the file json.
						let json = JSON.parse(file_buffer.toString()); 
					
						// Set "deleted" to false.
						json.deleted = false;
						
						// Set "synced" to false (Means never synced to the cloud.)
						json.synced = false;
						
						// Set "modified" to true (Means changed since last sync to the cloud.)
						json.modified = true;

						// Update the file. 
						fs.writeFileSync(file, JSON.stringify(json,null,1) );

						// Resolve this promise.
						res(i);
					});
				})
			)
		}

		Promise.all(proms).then(
			function(results){
				// Indicate success.
				console.log("DEVICE_DATA .metadata files updated.");
				
				// Indicate recreation of files.json.
				createJsonFsData(true);
				console.log("files.json updated.");

				// Resolve. DONE!
				resolve();
			},
			function(err){ console.log("promise error:", err); }
		);
	});
};

module.exports = {
	funcs : {
		rejectionFunction       : rejectionFunction       ,
		getRange                : getRange                ,
		getItemsInDir           : getItemsInDir           ,
		getParentDirName        : getParentDirName        ,
		getParentPath           : getParentPath           ,
		runCommand_exec_progress: runCommand_exec_progress,
		createJsonFsData        : createJsonFsData        ,
		getExistingJsonFsData   : getExistingJsonFsData   ,
		updateRemoteDemo        : updateRemoteDemo        ,
		metadata_unsync         : metadata_unsync         ,
	},
	
	_version          : function(){ return "Version 2021-09-24"; }
};
