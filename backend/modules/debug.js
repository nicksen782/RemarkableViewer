const fs = require('fs');
// const path = require('path');

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
		_APP.addToRouteList({ path: "/debug/metadata_unsync", method: "get", args: [], file: __filename, desc: "" });
		app.get('/debug/metadata_unsync'    ,express.json(), async (req, res) => {
			let envCheck = _APP.m_funcs.MOD.environmentCheck1();
			if(!envCheck.allowed){ res.send(JSON.stringify(envCheck.msg,null,0)); return; }

			let resp = await _MOD.metadata_unsync().catch(function(e) { throw e; });
			// res.json(resp);
			res.send(resp);
		});

		//
		_APP.addToRouteList({ path: "/debug/updateRemoteDemo", method: "get", args: [], file: __filename, desc: "" });
		app.get('/debug/updateRemoteDemo'    ,express.json(), async (req, res) => {
			let envCheck = _APP.m_funcs.MOD.environmentCheck1();
			if(!envCheck.allowed){ res.send(JSON.stringify(envCheck.msg,null,0)); return; }
			
			let resp = await _MOD.updateRemoteDemo().catch(function(e) { throw e; });
			// res.json(resp);
			res.send(resp);
		});

		//
		_APP.addToRouteList({ path: "/debug/rebuildDeviceImages", method: "get", args: ['pdf', 'pdfAnnotations', 'rmtosvg', 'optimizesvg', 'fromList', 'listItems'], file: __filename, desc: "" });
		app.get('/debug/rebuildDeviceImages'    ,express.json(), async (req, res) => {
 			let envCheck = _APP.m_funcs.MOD.environmentCheck1();
			if(!envCheck.allowed){ res.send(JSON.stringify(envCheck.msg,null,0)); return; }
			
			// Fix the query string values to be boolean.
			req.query.pdf            = req.query.pdf            == "true" ? true : false;
			req.query.pdfAnnotations = req.query.pdfAnnotations == "true" ? true : false;
			req.query.rmtosvg        = req.query.rmtosvg        == "true" ? true : false;
			req.query.optimizesvg    = req.query.optimizesvg    == "true" ? true : false;
			req.query.fromList       = req.query.fromList                 ? true : false;

			// If fromList is set then make sure that listItems exists, even if empty.
			if(req.query.fromList && !req.query.listItems){ req.query.listItems = []; }

			// console.log("\nroute: rebuildServerStorage2:\nreq.query:\n" + JSON.stringify(req.query,null,1));

			// Make sure at least one of the required arguments are true.
			if(!req.query.pdf && !req.query.pdfAnnotations && !req.query.rmtosvg &&!req.query.optimizesvg){
				let msg = "ERROR: Invalid arguments: debug/rebuildServerStorage:\nreq.query:" + JSON.stringify(req.query,null,1);
				console.log(msg);
				res.send(msg);
				return; 
			}

			_MOD.rebuildDeviceImages({
				pdf           : req.query.pdf,
				pdfAnnotations: req.query.pdfAnnotations,
				rmtosvg       : req.query.rmtosvg,
				optimizesvg   : req.query.optimizesvg,
				fromList      : req.query.fromList,
				listItems     : req.query.listItems,
			});

			res.send("DONE");
		});
	},

	// ROUTED: Used to set your files as never synced to the cloud. (You still need to rsync them to the Remarkable Tablet.)
	metadata_unsync          : async function(){
		// EXAMPLE RSYNC: cd DEVICE_DATA && rsync --delete -r -v -a --stats  --exclude '.cache/' --exclude 'webusb' --exclude 'syncthirdparty' --exclude 'templates' --exclude '.gitkeep' . remarkableusb:/home/root/.local/share/remarkable/^C
		return new Promise(async function(resolve,reject){
			// Get the file names in the dir.
			let files = await getItemsInDir(_APP.m_config.config.dataPath, "files", ".metadata");
	
			// Return only an array of filenames.
			files.map(
				function(d){
					let base = d.filepath.replace(_APP.m_config.config.dataPath, "");
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
	}, 

	// ROUTED: 
	updateRemoteDemo         : async function(){
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
			try{ files = await _APP.m_funcs.getExistingJsonFsData(true).catch(function(e) { throw e; }); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
	
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
			fs.writeFileSync(_APP.m_config.config.demo_filesjson, JSON.stringify(newFilesJson,null,1), function(err){
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
			fs.writeFileSync(_APP.m_config.config.demo_filter, filterText.join("\n"), function(err){
				if (err) { console.log("ERROR: ", err); reject(err); }
			});
			// console.log("Generated config.demo_filter:", filterText.join("\n"));
			
			// Break up the script into parts (easier to debug.)
			let cmd;
			cmd = `cd ${_APP.m_config.config.scriptsPath} && ./updateRemoteDemo.sh `;
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
			fs.writeFileSync(_APP.m_config.config.demo_resps, JSON.stringify(retObj,null,1), function(err){
				if (err) { console.log("ERROR: ", err); reject(err); }
			});
	
			resolve(retObj);
		});
	}, 

	// ROUTED:
	rebuildDeviceImages       : function(obj){
		return new Promise(async function(resolve_top,reject_top){
			let startTS = performance.now();
	
			let {pdf, pdfAnnotations, rmtosvg, optimizesvg, fromList, listItems} = obj;
			// console.log(obj);
			// console.log(pdf, pdfAnnotations, rmtosvg, optimizesvg, fromList, listItems);
			// resolve_top();
			// return; 
	
			let files;
			try{ 
				// Create files.json data from the DEVICE_DATA backup dir.
				files = await _APP.m_funcs.createJsonFsData(false).catch(function(e) { throw e; }); 
			} 
			catch(e){ 
				console.trace("ERROR: rebuildDeviceImages:", e); 
				reject_top(e);
				// res.end("Error in createJsonFsData,", JSON.stringify(e)); 
				return; 
			}
		
			// Holds changes.
			let changes       = [];
			// let changesFullCount = 0;
		
			// 
			for(let key in files.DocumentType){
				let id      = key;
				let fileRec = files.DocumentType[key];
				// let dirPath = _APP.m_config.config.dataPath + id + "/";
		
				// If fromList is true then only allow ids that are in listItems.
				if(fromList && listItems.indexOf(id) == -1){
					continue; 
				}
		
				// PDF
				if(fileRec.content.fileType == "pdf"){
					// PDF pages.
					if(pdf     == true){
						let filename = _APP.m_config.config.dataPath + id + ".pdf";
						if( !fs.existsSync(filename) ){
							// console.log("  FILE MISSING: ", filename);
						}
						else{
							// Add the pdf id to the list.
							changes.push(filename.replace("./DEVICE_DATA/", "")); 
							// changesFullCount += fileRec.content.pages.length;
						}
					}
		
					// PDF annotations.
					if(pdfAnnotations){
						fileRec.content.pages.forEach(function(pageId){
							let filename  = _APP.m_config.config.dataPath + id + "/" + pageId + ".rm";
							if( !fs.existsSync(filename) ){
								// console.log("  FILE MISSING: ", filename);
							}
							else{
								// Add to rmToSvg.
								changes.push(filename.replace("./DEVICE_DATA/", "")); 
								// changesFullCount += 1;
								// changesFullCount += 1; // For the svg optimization.
							}
						});
		
					}
				}
		
				// RM2SVG.
				if(fileRec.content.fileType == "notebook"){
					if(rmtosvg == true){
						fileRec.content.pages.forEach(function(pageId){
							let filename  = _APP.m_config.config.dataPath + id + "/" + pageId + ".rm";
							if( !fs.existsSync(filename) ){
								// console.log("  FILE MISSING: ", filename);
							}
							else{
								// Add to rmToSvg.
								changes.push(filename.replace("./DEVICE_DATA/", "")); 
								// changesFullCount += 1;
								// changesFullCount += 1; // For the svg optimization.
							}
						});
					}	
				}
		
				// SVG OPTIMIZE is automatic.
			}
		
			console.log("");
			
			let changeRecs;
			let new_filesjson;
			try{ 
				changeRecs = await parseChanges(changes);
				// console.log("***", Object.keys(changeRecs));
				changeRecs    = changeRecs.changes;
				new_filesjson = changeRecs.new_filesjson;
			}
			catch(e){ 
				console.trace("ERROR: parseChanges:", e); 
				// res.end("Error in parseChanges,", JSON.stringify(e)); 
				reject_top(e);
				return; 
			}
		
			try{ 
				await convertAndOptimize(changeRecs).catch(function(e) { throw e; }); 
			} 
			catch(e){ 
				console.trace("ERROR: convertAndOptimize:", e); 
				res.end("Error in convertAndOptimize,", JSON.stringify(e)); 
				reject_top();
				return; 
			}
		
			let endTS = performance.now();
			console.log(`rebuildDeviceImages: COMPLETED in ${(((endTS - startTS)/1000)/60).toFixed(3)} minutes.`);
			resolve_top();
		});
	},
};

module.exports = _MOD;
