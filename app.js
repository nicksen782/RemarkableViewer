// Libraries/frameworks from NPM.
var serveIndex = require('serve-index');
const express  = require('express'); // npm install express
const app      = express();
const path     = require('path');
const exec     = require('child_process').exec;
const fs       = require('fs');
// const { mapLimit } = require('promise-async');
const async = require('promise-async');

// Personal libraries/frameworks.
var timeIt = require('./timeIt.js');

//
const port     = 3100;
const dataPath = "DEVICE_DATA/xochitl/";
const imagesPath = "DEVICE_DATA_IMAGES/";
var cmdHistory = []; // DEBUG
var stdoutHistory = []; // DEBUG
var storage = {
	// files:{}
};
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
		
									// Add the completed record.
									json[newObj.metadata.type].push(newObj);
									
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
			fs.writeFileSync('public/files.json', JSON.stringify(files,null,0), function(err){
				if (err) { console.log("ERROR: ", err); reject(err); }
			});
		}

		resolve(files);
	});
};
const getExistingJsonFsData = async function(){
	return new Promise(async function(resolve,reject){
		let files;
		if( !fs.existsSync("public/files.json") ){
			console.log("getExistingJsonFsData: no existing data. Creating it now.");
			try{ files = await createJsonFsData(true); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
		}
		else{
			console.log("getExistingJsonFsData: Data exists, retrieving it.");
			files = fs.readFileSync("public/files.json");
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

		// Runs a specified command.
		let runCommand = async function(cmd_obj){
			return new Promise(function(cmd_res, cmd_rej){
				let cmd        = cmd_obj.cmd;
				let key        = cmd_obj.key;
				let srcRmDir   = cmd_obj.srcRmDir;

				let dest = imagesPath + key;
				
				// Create the directory if it doesn't exist. 
				// if( !fs.existsSync(dest) ){
				// 	// Create the directory.
				// 	fs.mkdirSync(dest);
				// }

				// Run the command.
				exec(cmd, 
					function (error, stdout, stderr) {
						if (error) {
							console.log(
								JSON.stringify({
									error: error, 
									stderr:stderr, 
									stdout:stdout
								})
							);
							cmd_rej(JSON.stringify({error: error, stderr:stderr, stdout:stdout}));
							throw "ERROR in runCommand";
							return;
						}
						let debug_stdout = stdout.split("\n")[0].trim();
						if(debug_stdout != ""){
							messages.push("createNotebookPageImages: cmd: " + debug_stdout);
							console.log(getLastValueOfArray(messages));
						}
						cmd_res();
					}
				);
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
						let cmd = `python3 scripts/rM2svg.py -i ${srcFile} -o ${dest_fullName}_PAGE_${pageNum}.svg`;
						cmdList.push({
							cmd: cmd, 
							key: obj.key,
							clearFirst: true,
							srcRmDir: dataPath + obj.key,
							destDir: imagesPath + obj.key,
							baseFileName: baseFileName + "_PAGE_" + pageNum
						});
					});
				}
			// });
			}

			// resolve_top( { messages: messages } ); return; 

			if(cmdList.length){
				// console.log("Yay! we have commands.");
				// console.log("Yay! we have commands.", cmdList.map(function(d){return d.key;}));
				cmdList.sort(function(a,b) {
					return a.srcRmDir - b.srcRmDir;
				});

				// Clear and then recreate the directories.
				try{ await preCommand(cmdList); } catch(e){ console.log("failure: preCommand", e); }

				// Run the commands.
				// Use the data from fileIdsWithChanges to create the image conversion commands.
				let currentFile = 0;
				let totalPages = (cmdList.length).toString().padStart(4, "_");
				let cmds_prom = async.mapLimit(cmdList, 10, async function(cmd_obj, callback){
					// messages.push(rec);
					// console.log(getLastValueOfArray(messages)); 
					// console.log("  cmd: ", cmd_obj.cmd);
					let currPage = (currentFile+1).toString().padStart(4, "_");
					console.log("Page: " + (currPage) + " of " + totalPages + " pages", " ::: ", cmd_obj.baseFileName);
					try{ await runCommand(cmd_obj); } catch(e){ console.log("failure: runCommand", e); }
					currentFile +=1 ;

					callback(null, cmd_obj);
				});
	
				cmds_prom
				.then(
					result => {
						console.log("success:", result.length, "of", cmdList.length);
						resolve_top( { messages: messages } );
					}
				)
				.catch(
					(err) => {
						console.log("no success", err);
						reject_top(err);
					}
				);
			}
			else{
				console.log("No commands to run.");
				resolve_top( { messages: messages } );
			}

		}
	});
};

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
	timeIt.clearTimeItStamps();

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
	timeIt.clearTimeItStamps();

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
	timeIt.clearTimeItStamps();

	res.send(returnValue);
});

app.get('/removeAllNotebookPageImages', async (req, res) => {
	console.log("/removeAllNotebookPageImages");
	res.send("not ready yet.");	
	// let timeItIndex = timeIt.stamp("route: removeAllNotebookPageImages", null);
	// let returnValue;
	// try{ returnValue = await removeAllNotebookPageImages(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
	// timeIt.stamp("route: removeAllNotebookPageImages", timeItIndex);
	
	// let timeStampString = timeIt.getStampString();
	// console.log("*".repeat(83));
	// console.log("timeIt_stamps:", timeStampString );
	// console.log("*".repeat(83));
	// timeIt.clearTimeItStamps();
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
	timeIt.clearTimeItStamps();

	console.log("cmdHistory:", cmdHistory);

	res.send(returnValue);
	// res.send(returnValue.fileIdsWithChanges.map(function(d){
	// 	d.oldFile = "FILTERED-OUT";
	// 	d.newFile = "FILTERED-OUT";
	// 	d.DEBUG = JSON.stringify(d.DEBUG,null,1);
	// 	return d;
	// }) );
	console.log(returnValue);
});

app.listen(port, () => {
	
	// Set virtual path.
	app.use('/', express.static(path.join(__dirname, 'public')));
	// app.use('/DEVICE_DATA_IMAGES', serveIndex(__dirname + '/DEVICE_DATA_IMAGES'));
	// app.use('/DEVICE_DATA_IMAGES', serveIndex(path.join(__dirname, "DEVICE_DATA_IMAGES")));
	
	app.use('/svgs', express.static('DEVICE_DATA_IMAGES'), serveIndex('DEVICE_DATA_IMAGES', {'icons': true}))

	// app.use ('/test', express.static( path.join(__dirname, "DEVICE_DATA_IMAGES")));
		
	//
	console.log(`App listening at http://localhost:${port}`);

});