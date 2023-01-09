const fs              = require('fs');
const path            = require('path');
const { spawn }       = require('child_process');
// const config          = require('./config.js').config;

let _APP = null;

let _MOD = {
	// Init this module.
	module_init: async function(parent){
		// Save reference to ledger.
		_APP = parent;
		
		// Add routes.
		_MOD.addRoutes(_APP.app, _APP.express);
	},

	// Adds routes for this module.
	addRoutes: function(app, express){
		//
		_APP.addToRouteList({ path: "/getFilesJson", method: "get", args: [], file: __filename, desc: "" });
		app.get('/getFilesJson'    ,express.json(), async (req, res) => {
			let resp = await _MOD.getExistingJsonFsData(false).catch(function(e) { throw e; });
			// res.json(resp);
			res.send(resp);
		});

	},

	// ROUTED: 
	getExistingJsonFsData    : async function(fullVersion=true){
		// throw "TEST1";
		return new Promise(async function(resolve,reject){
			let files;
			if( !fs.existsSync(_APP.m_config.config.filesjson) ){
				try{ 
					// Generate new config.filesjson and write the file to disk. 
					files = await _MOD.createJsonFsData(true).catch(function(e) { throw e; }); 
				} 
				catch(e){ 
					console.log("ERROR:", e); 
					reject(JSON.stringify(e)); 
					return; 
				}
			}
			else{
				// Read the config.filesjson file. 
				files = fs.readFileSync(_APP.m_config.config.filesjson);
	
				// Parse the file into JSON.
				files = JSON.parse(files);
			}
	
			// If fullVersion is false then reduce the data that returned 
			if(!fullVersion){
				// Remove some data from the CollectionTypes.
				for(let key in files.CollectionType){
					let rec = files.CollectionType[key];
					
					// Delete "name" from the object root. This is redundant.
					delete rec.name;
				}
				
				// Remove some data from the DocumentTypes.
				for(let key in files.DocumentType){
					let rec = files.DocumentType[key];
	
					// Save the only the first page. 
					if(!rec.extra._firstPageId){
						console.log("getExistingJsonFsData: Adding missing rec.extra._firstPageId");
						rec.extra._firstPageId = rec.content.pages[0];
					}
	
					// Delete from .content.
					let keys_content = Object.keys(rec.content);
					let keep_content = ["pageCount", "fileType", "textScale", "orientation", "margins"];
					
					// Debug: Add key(s) to the keep_content list. 
					keep_content.push("pages");
	
					// Remove all keys that are not specified by keep_content.
					keys_content.forEach(function(d){
						if(keep_content.indexOf(d) == -1){
							delete rec.content[d];
						}
					});
	
					// Delete "name" from the object root. This is redundant.
					delete rec.name;
				}
			}
	
			resolve( files );
		});
	},

	// 
	environmentCheck1        : function(){
		//
		let obj = {
			msg: "",
			allowed: true,
		};

		// 
		if(_APP.m_config.config.environment != "local"){ 
			obj.msg = "Function is not available in the demo version.";
			obj.allowed = false;
		}

		//
		return obj;
	},

	//
	getItemsInDir            : function(targetPath, type, ext=""){
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
	},

	//
	getParentPath            : function(id, type, files){
		let fullPath = [];
	
		let file = files[type][id];
		// console.log(files[type][id]); return "";
	
		let currId = file.metadata.parent;
		let isAtRoot = false;
		let isAtTrash = false;
		for(let i=0; i<20; i+=1){
			// Reached root?
			if(currId == "" || file.metadata.parent == ""){ isAtRoot=true; break; }
			
			let obj = _MOD.getParentDirName({ metadata: { parent: currId } }, files, true) ;
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
	},

	//
	runCommand_exec_progress : async function(cmd, expectedExitCode=0, progress=true){
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
	
	},

	//
	createJsonFsData         : async function(writeFile){
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
	
								// Check for the new V6 content changes. Check for cPages existing instead of pages.
								if(newObj.content.cPages && ! newObj.content.pages){
									// Probably a V6 format. Check the formatVersion for 2.
									if(newObj.content.formatVersion == 2){
										// Is V6 with the new formatVersion.

										// Read the cPages.pages values to get a replacement list for .pages and save .pages.
										newObj.content.pages = newObj.content.cPages.pages.map(p=>{
											return p.id;
										});

										// PAGEDATA (templates)
										// newObj.pagedata = newObj.content.pages;
										newObj.pagedata = newObj.content.cPages.pages.map(p=>{
											// Use the template.value if template exists.
											if(p.template){
												return p.template.value;
											}
											// No template specified? Set "Blank".
											else{
												return "Blank";
											}
										});
									}
									else{
										// Odd. This should not have happened.
										console.log("FAILURE - Seems to be formatVersion:2 but formatVersion is not 2. VALUE:", newObj.content.formatVersion);
									}
								}
								// V5 format. 
								else{
									if(newObj.content.formatVersion == undefined){
										newObj.content.formatVersion = 1;
									}
									// console.log("Is formatVersion:1. VALUE:", newObj.content.formatVersion);

									// PAGEDATA
									newObj.pagedata = pagedata_file.data.trim().split("\n");
								}

								// Save the first page id.
								newObj.extra["_firstPageId"] = newObj.content.pages[0]; // Save the first page. 

								// // Save the first page id.
								// try{
								// 	newObj.extra["_firstPageId"] = newObj.content.pages[0]; // Save the first page. 
								// }
								// catch(e){
								// 	console.log("e                   :", e);
								// 	// console.log("newObj              :", newObj);
								// 	// console.log("newObj.content      :", newObj.content);
								// 	console.log("newObj.metadata.visibleName:", newObj.metadata.visibleName);
								// 	// console.log("newObj.content.pages:", newObj.content.pages);
								// 	console.log("newObj.content.cPages:", JSON.stringify(newObj.content.cPages,null,1));
								// 	// console.log("KEYS: newObj.content.pages:", Object.keys(newObj.content));
								// 	//  2|RemarkableViewer  | 2023-01-08 19:35 -05:00: KEYS: newObj.content.pages: [
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'cPages',                'coverPageNumber',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'customZoomCenterX',     'customZoomCenterY',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'customZoomOrientation', 'customZoomPageHeight',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'customZoomPageWidth',   'customZoomScale',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'documentMetadata',      'dummyDocument',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'extraMetadata',         'fileType',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'fontName',              'formatVersion',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'lineHeight',            'margins',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'orientation',           'pageCount',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'pageTags',              'sizeInBytes',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'tags',                  'textAlignment',
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00:   'textScale',             'zoomMode'
								// 	// 	2|RemarkableViewer  | 2023-01-08 19:35 -05:00: ]
								// }
								
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
						rec.path = _MOD.getParentPath(rec.extra._thisFileId, "CollectionType", fin);
					}
					
					// Update the path value for DocumentType.
					for(let key in fin.DocumentType){
						let rec = fin.DocumentType[key];
						rec.path = _MOD.getParentPath(rec.extra._thisFileId, "DocumentType", fin);
					}
	
					res(fin);
				});
			};
	
			// Get a list of all the files in the xochitil folder.
			let files = await _MOD.getItemsInDir(_APP.m_config.config.dataPath, "files", ".metadata").catch(function(e) { throw e; });
			
			// Further filter each name to remove the full config.dataPath.
			files = files.map( function(d){
				let filename = d.filepath.split("/");
				filename = filename[filename.length-1];
				return filename; 
			});
	
			files = await getAllJson(files, _APP.m_config.config.dataPath).catch(function(e) { throw e; });
			files = await createDirectoryStructure(files).catch(function(e) { throw e; });
			
			if(writeFile){
				fs.writeFileSync(_APP.m_config.config.filesjson, JSON.stringify(files,null,0), function(err){
					if (err) { console.log("ERROR: ", err); reject(err); }
				});
			}
	
			resolve(files);
		});
	},

	//
	getParentDirName         : function(file, files, returnNameAndId=false){
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
	},

	//
	rejectionFunction        : function(title, e, rejectFunction, sse=null){
		let msg = `---------------ERROR in ${title}: ${JSON.stringify(e,null,1)}`;
		// let msg = `---------------ERROR in ${title}: ${e}`;
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
	},
	
	//
	getRange                 : function(start, stop, step = 1) {
		// EXAMPLE USAGES: 
		// let pageRange = funcs.getRange( 0, 5, 1 ); // Gives [0,1,2,3,4,5]
		// let pageRange = funcs.getRange( 0, 6, 2 ); // Gives [0,2,4,6]
		return Array( Math.ceil((stop - start) / step) )
		.fill(start)
		.map((x, y) => x + y * step);
	},
};

module.exports = _MOD;
