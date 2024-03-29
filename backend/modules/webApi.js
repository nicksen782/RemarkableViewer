// WEB UI - FUNCTIONS.
const fs                 = require('fs');
const path               = require('path');
// const funcs              = require('./funcs.js').funcs;
// const config             = require('./_APP.m_config.config.js').config;
// const updateFromDevice   = require('./updateFromDevice').updateFromDevice;
const parseChanges       = require('./updateFromDevice').parseChanges;
const convertAndOptimize = require('./updateFromDevice').convertAndOptimize;
const { performance }    = require('perf_hooks');

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
		_APP.addToRouteList({ path: "/getGlobalUsageStats", method: "get", args: [], file: __filename, desc: "" });
		app.get('/getGlobalUsageStats'    ,express.json(), async (req, res) => {
			let resp = await _MOD.getGlobalUsageStats().catch(function(e) { throw e; }); 
			res.json(resp);
		});

		//
		_APP.addToRouteList({ path: "/getSvgs", method: "get", args: ['documentId'], file: __filename, desc: "" });
		app.get('/getSvgs'    ,express.json(), async (req, res) => {
			let documentId = req.query.documentId;
			let resp = await _MOD.getSvgs(documentId).catch(function(e) { throw e; }); 
			res.send(resp);
		});
		
		//
		_APP.addToRouteList({ path: "/getThumbnails", method: "get", args: ['parentId'], file: __filename, desc: "" });
		app.get('/getThumbnails'    ,express.json(), async (req, res) => {
			let resp;
			try{ 
				resp = await _MOD.getThumbnails(req.query.parentId).catch(function(e) { throw e; }); 
			} 
			catch(e){ 
				console.trace("ERROR: /getThumbnails:", e); 
				res.send(JSON.stringify(e)); 
				return; 
			}
			res.send(resp);
		});
	},

	// ROUTED
	getGlobalUsageStats       : function(){
		// 
		let config      = _APP.m_config.config;
		let configExtra = _APP.m_config.configExtra;

		return new Promise(async function(resolve_top,reject_top){
			// Get files.json.
			let files ;
			try{ 
				files = await _APP.m_funcs.getExistingJsonFsData(true).catch(function(e) { throw e; });; 
			} 
			catch(e){ 
				console.log("ERROR:", e); 
				reject_top();
				return;
			}

			// Filter and sort.
			const filterAndSort = function(sortKey, type, filterKey, maxRecords){
				const formatDate = function(date) {
					// Create a date out of the argument. 
					let d = new Date(date);
					if(d == "Invalid Date"){ return d; }

					// Break-out the parts of the date. 
					let month   = (d.getMonth() + 1);
					let day     = d.getDate();
					let year    = d.getFullYear();
					let hours   = d.getHours();
					let minutes = d.getMinutes();
					let seconds = d.getSeconds();
					let ampm    = hours < 12 ? "AM" : "PM";

					// Reformat/pad the values. 
					if(month  <= 10) { month   = month  .toString().padStart(2, "0"); }
					if(day    <= 10) { day     = day    .toString().padStart(2, "0"); }
					if(hours  >= 13) { hours   -= 12; }
					if(hours   < 10) { hours   = hours  .toString().padStart(2, "0"); }
					if(minutes < 10) { minutes = minutes.toString().padStart(2, "0"); }
					if(seconds < 10) { seconds = seconds.toString().padStart(2, "0"); }
				
					// Create the date/time string. 
					let dateString = [year, month, day].join('-');
					dateString += ` ${hours}:${minutes}:${seconds} ${ampm}`;

					// Return the date/time string. 
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
					// dataset = dataset.slice(0, maxRecords);
					dataset.splice(maxRecords);
				}

				// Create the data.
				let results = [];
				dataset.forEach(function(id){
					let rec = files[type][id];
					let obj = {
						type         : type,
						lastOpened   : rec.metadata.lastOpened,
						id           : rec.extra._thisFileId,
						name         : rec.metadata.visibleName,
						parentId     : rec.metadata.parent,
						date_modified: formatDate(Number(rec.metadata.lastModified)),
						date_opened  : formatDate(Number(rec.metadata.lastOpened)),
						fullpath     : _APP.m_funcs.getParentPath(rec.extra._thisFileId, type, files),
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

			let obj = {
				byLastOpened  : byLastOpened_results  ,
				byLastModified: byLastModified_results,
				favorites     : {
					files: favorites_results_file ,
					dirs : favorites_results_dir  ,
				},
				diskFree: {
					"total" : {
					},
				},
			}

			// Get the diskFree data.
			if(!fs.existsSync(_APP.m_config.config.diskFree)){ 
				obj.diskFree['Used']       = "??";
				obj.diskFree['1K-blocks']  = "??";
				obj.diskFree['Available%'] = "??";
			}
			else{
				obj.diskFree = JSON.parse(fs.readFileSync(_APP.m_config.config.diskFree).toString()).total;
				obj.diskFree['Used']       = (((obj.diskFree['Used']      /1000) * 1024) / 1000000).toFixed(2) + "GB";
				obj.diskFree['1K-blocks']  = (((obj.diskFree['1K-blocks'] /1000) * 1024) / 1000000).toFixed(2) + "GB";
				obj.diskFree['Available%'] = (100 - parseFloat(obj.diskFree['Use%'])) + "%";
			}

			// resolve_top(JSON.stringify(obj, null, 1));
			resolve_top(obj);
		});
	},

	// ROUTED
	getThumbnails             : function(parentId){
		return new Promise(async function(resolve_top,reject_top){
			let getThumbnail = function(documentId, existingFilesJson){
				//. Use documentId to get the folder, use .pages to get the page ids (in order.)
				let targetPath = _APP.m_config.config.dataPath + "" + documentId + ".thumbnails";
	
				// Need to check that the directory exists.
				if(!fs.existsSync(targetPath)){ 
					let msg = ``;
					msg += `------------------\n`;
					msg += "ERROR: getThumbnail: targetPath does not exist." + targetPath + `\n`;
					msg += `  targetPath: ${targetPath}\n`;
					msg += `  documentId: ${documentId}\n`;
					msg += `e           : DOES NOT EXIST\n`;
					msg += `------------------\n`;
					console.log(msg); 
					throw msg ; 
					return; 
				};

				// Get the first page id.
				let firstPageId = existingFilesJson.DocumentType[documentId].content.pages[0];
				
				// Check that the file exists. 
				let firstThumbnail = path.join(targetPath, firstPageId+".jpg");
				if(!fs.existsSync(firstThumbnail)){ 
					let msg = "ERROR: getThumbnail: firstThumbnail_path does not exist. " + firstThumbnail;
					console.log(msg); 
					// throw msg; 
					return null; 
				};
				
				// Send the file.
				return firstThumbnail ;
			};

			// Get files.json.
			let existingFilesJson ;
			try{ 
				existingFilesJson = await _APP.m_funcs.getExistingJsonFsData(true).catch(function(e) { throw e; });; 
			} 
			catch(e){ 
				console.log("ERROR: getThumbnails:", e); 
				reject_top();
				return;
			}
			
			// Get list of documents that have the parentId as the parent.
			let recs = {};
			for(let key in existingFilesJson.DocumentType){
				let rec = existingFilesJson.DocumentType[key];

				// If the record's parent is the passed parentId, or the passed parentId is "deleted":
				if(rec.metadata.parent == parentId || parentId == "deleted"){ 
					let data;
					try { data = getThumbnail(rec.extra._thisFileId, existingFilesJson); } catch(e){ console.log("ERROR: getThumbnail:", e); reject_top(JSON.stringify(e)); return; }	
					if(data){
						recs[key] = data; 
					}
				}
			}

			resolve_top(JSON.stringify(recs, null, 0));
		});
	},

	// ROUTED
	getSvgs                   : function(documentId){
		return new Promise(async function(resolve_top,reject_top){
			// Get files.json.
			let fileData ;
			try{ 
				fileData = await _APP.m_funcs.getExistingJsonFsData(true).catch(function(e) { throw e; });
			} 
			catch(e){ 
				console.log("ERROR:", e); 
				reject_top();
				return;
			}

			let visibleName = fileData.DocumentType[documentId].metadata.visibleName;
			let fileType    = fileData.DocumentType[documentId].content.fileType;
			let fileDir     = _APP.m_config.config.imagesPath + "" + documentId + "/";
			let layers = {
				layer1 : [],
				layer2 : [],
			};

			// Generate and return a list of the files required for the document's fileType.
			let getFilenames = function(){
				// Object for layer 1.
				let layer1_files = {
					info: { baseText: "", showNotFoundText: false, showFoundText: false },
					data: [],
				};
				// Object for layer 2.
				let layer2_files = {
					info: { baseText: "", showNotFoundText: false, showFoundText: false },
					data: [],
				};
			
				// Generate a list of files for each page based on the fileType and by layer..
				if     (fileType == "pdf")     {
					// Layer 1: info
					layer1_files.info.baseText = "PDF L1";
					layer1_files.info.showNotFoundText = true;
					layer1_files.info.showFoundText = true;
					
					// Layer 2: info
					layer2_files.info.baseText = "PDF L2";
					layer2_files.info.showNotFoundText = false;
					layer2_files.info.showFoundText = true;
					
					// Layer 1: Pdf images: Get layer1_files.
					fileData.DocumentType[documentId].content.pages.forEach(function(d, i){
						layer1_files.data.push(
							[
								// { file: `${fileDir}pages/${d}.min.svg`                         , pageNum: i+1, showText: true, text: `TYPE: A: (.min.svg)` },
								// { file: `${fileDir}pages/${d}.svg`                             , pageNum: i+1, showText: true, text: `TYPE: B: (.svg)    ` },
								// { file: `${fileDir}pages/${d}.png`                             , pageNum: i+1, showText: true, text: `TYPE: C: (.png)    ` },
								// { file: `${fileDir}pages/${visibleName}-${i}.png`              , pageNum: i+1, showText: true, text: `TYPE: D: (.png)    ` },
								// { file: `${fileDir}pages/TEST2_${d}.svg`                       , pageNum: i+1, showText: true, text: `TYPE: E: (.svg)    ` },
								{ file: `${fileDir}pages/PNGPAGE-${i}.png`                     , pageNum: i+1, showText: true, text: `TYPE: F: (.png)    ` },
								// { file: `${fileDir}pages/TEST_${d}.svg`                        , pageNum: i+1, showText: true, text: `TYPE: G: (.svg)    ` },
								// { file: `DEVICE_DATA/xochitl/${documentId}.thumbnails/${d}.jpg`, pageNum: i+1, showText: true, text: `TYPE: H: (.jpg)    ` },
							]
						);
					});

					// Layer 2: Notebook annotations: Get layer2_files.
					fileData.DocumentType[documentId].content.pages.forEach(function(d, i){
						layer2_files.data.push(
							[
								{ file: `${fileDir}${d}.min.svg`                               , pageNum: i+1, text: `TYPE: A: (.min.svg)` },
								{ file: `${fileDir}${d}.svg`                                   , pageNum: i+1, text: `TYPE: B: (.svg)    ` },
								// { file: `DEVICE_DATA/xochitl/${documentId}.thumbnails/${d}.jpg`, pageNum: i, text: `(c): .jpg    ` },
							]
						);
					});
				}
				else if(fileType == "epub")    {
					// Layer 1: info
					layer1_files.info.baseText = "EPUB L1";
					layer1_files.info.showNotFoundText = true;
					layer1_files.info.showFoundText = true;
					
					// Layer 2: info
					layer2_files.info.baseText = "EPUB L2";
					layer2_files.info.showNotFoundText = false;
					layer2_files.info.showFoundText = true;

					// Layer 1: EPUB images: Get layer1_files.
					fileData.DocumentType[documentId].content.pages.forEach(function(d, i){
						layer1_files.data.push(
							[
								{ file: `${fileDir}pages/${d}.min.svg`                         , pageNum: i+1, text: `TYPE: A: (.min.svg)` },
								{ file: `${fileDir}pages/${d}.svg`                             , pageNum: i+1, text: `TYPE: B: (.svg)    ` },
								{ file: `${fileDir}pages/${d}.png`                             , pageNum: i+1, text: `TYPE: C: (.png)    ` },
								{ file: `${fileDir}pages/${visibleName}-${i}.png`              , pageNum: i+1, text: `TYPE: D: (.png)    ` },
								{ file: `${fileDir}pages/TEST_${d}.svg`                        , pageNum: i+1, text: `TYPE: E: (.svg)    ` },
								{ file: `DEVICE_DATA/xochitl/${documentId}.thumbnails/${d}.jpg`, pageNum: i+1, text: `TYPE: F: (.jpg)    ` },
							]
						);
					});

					// Layer 2: Notebook annotations: Get layer2_files.
					fileData.DocumentType[documentId].content.pages.forEach(function(d, i){
						layer2_files.data.push(
							[
								{ file: `${fileDir}${d}.min.svg`                               , pageNum: i+1, text: `TYPE: A: (.min.svg)` },
								{ file: `${fileDir}${d}.svg`                                   , pageNum: i+1, text: `TYPE: B: (.svg)    ` },
								// { file: `DEVICE_DATA/xochitl/${documentId}.thumbnails/${d}.jpg`, pageNum: i, text: `(c): .jpg    ` },
							]
						);
					});
				}
				else if(fileType == "notebook"){
					// Layer 1: info
					layer1_files.info.baseText = "NOTEBOOK L1";
					layer1_files.info.showNotFoundText = true;
					layer1_files.info.showFoundText = true;

					// Layer 2: info
					layer2_files.info.baseText = "NOTEBOOK L2";
					layer2_files.info.showNotFoundText = true;
					layer2_files.info.showFoundText = true;
					
					// Layer 1: Background templates: Get layer1_files.
					fileData.DocumentType[documentId].pagedata.forEach(function(d, i){
						layer1_files.data.push(
							[
								{ file: `${_APP.m_config.config.templatesPath}${d}.min.svg`                  , pageNum: i+1, text: `TYPE A: (.min.svg)` },
								{ file: `${_APP.m_config.config.templatesPath}${d}.svg`                      , pageNum: i+1, text: `TYPE B: (.svg)    ` },
								{ file: `${_APP.m_config.config.templatesPath}${d}.png`                      , pageNum: i+1, text: `TYPE C: (.png)    ` },
							]
						);
					});
						
					// Layer 2: Notebook pages: Get layer2_files.
					fileData.DocumentType[documentId].content.pages.forEach(function(d, i){
						layer2_files.data.push(
							[
								{ file: `${fileDir}${d}.min.svg`                               , pageNum: i+1, text: `TYPE A: (.min.svg)` },
								{ file: `${fileDir}${d}.svg`                                   , pageNum: i+1, text: `TYPE B: (.svg)    ` },
								{ file: `DEVICE_DATA/xochitl/${documentId}.thumbnails/${d}.jpg`, pageNum: i+1, text: `TYPE C: (.jpg)    ` },
							]
						);
					});
				}

				// Return the files by layer.
				return {
					layer1_files : layer1_files,
					layer2_files : layer2_files,
				};
			};

			let findingFunction = function(layerFiles){
				// Look through the list of files.
				// Try to find the file. If found then add it, break, and set the found flag.
				// File not found? Add "".
				// Return the value.
				
				let arrDest = [];
				let fileFound ; 
				
				// // Add the file modification date (from the filesystem) for each returned file.
				// //
				// let proms = [];
				// Promise.all(proms).then(
				// 	function(){
						
				// 	},
				// 	function(){}
				// );

				// Break-out the data and info.
				let data = layerFiles.data;
				let info = layerFiles.info;

				let padStartNum = data.length.toString().split("").length;
				for(let thisPage=0; thisPage<data.length; thisPage +=1 ){
					let page = data[thisPage];
					
					fileFound = false; 
					for(let thisFile=0; thisFile<page.length; thisFile +=1 ){
						let rec = page[thisFile];

						if(fs.existsSync(rec.file)){
							// Show file found text? 
							if(info.showFoundText){
								// console.log(`  FOUND    : ${info.baseText}: ${rec.text} PAGE #${rec.pageNum.toString().padStart(padStartNum, "0")}, `, rec.file);
							}
							
							// Add the file to the list (with the modified time in the querystring.)
							// If the file never changes then neither would the queryString part.
							// If the file changes, the queryString changes thus becoming an as-needed cache-buster.
							let stat = fs.statSync(rec.file).mtimeMs;
							arrDest.push(rec.file + "?mtime=" + stat); 

							// Set the filefound flag.
							fileFound = true; 

							// Break the for loop.
							break; 
						}
					}
					// Show file not found text? 
					if(!fileFound){
						// Show file found text? 
						if(info.showNotFoundText){
							console.log(`  NOT FOUND: ${info.baseText} PAGE #${thisPage.toString().padStart(padStartNum, "0")}`);
						}

						// Add a blank entry to the list for this file. 
						arrDest.push(""); 
					}
				}
				
				// Return the array.
				return arrDest;
			};

			// Perform the actions.
			console.log(`Retrieving page files for: ${visibleName} (${fileType})`);
			let layerFiles = getFilenames();
			layers.layer1 = findingFunction(layerFiles.layer1_files);
			layers.layer2 = findingFunction(layerFiles.layer2_files);
			// console.log(`DONE`);

			// Resolve. All done!
			let obj = {
				"layers"       : layers,
				"notebookTitle": visibleName,
				"type"         : fileType,
			};
			resolve_top( JSON.stringify(obj, null, 0) );
		});
	},

};

module.exports = _MOD;
