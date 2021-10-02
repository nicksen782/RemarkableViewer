// WEB UI - FUNCTIONS.
const fs               = require('fs');
const path             = require('path');
const funcs            = require('./funcs.js').funcs;
const config           = require('./config.js').config;
const updateFromDevice = require('./updateFromDevice').updateFromDevice;
const optimizeSvg      = require('./updateFromDevice').optimizeSvg;

const webApi = {
	//
	updateFromDevice          : updateFromDevice,
	//
	updateFromDeviceTemplates : function(){
		return new Promise(async function(resolve_top,reject_top){
			reject_top("NOT READY YET"); return;
			resolve_top("NOT READY YET"); return;
			// Get the /usr/share/remarkable/templates directory from the device.
			
			// scripts/syncTemplates.sh
			// optimizeSvg
			// const optimizeSvg = function(changeRec, fileRec, totalCount){
			// let obj = {
			// 	docId      : key, // docId: 'af6beacb-ddea-4ada-91da-bb63bcb38ef3',
			// 	name       : rec.metadata.visibleName, // name: 'To do',
			// 	pageFile   : d, // pageFile: ffe8551c-c0c9-4c4c-bd42-0a8a0817c691
			// 	fileType   : rec.content.fileType, // fileType: 'notebook',
			// 	srcFile    : config.dataPath + key + "/" + d +".rm", // path: 'xochitl/af6beacb-ddea-4ada-91da-bb63bcb38ef3/ffe8551c-c0c9-4c4c-bd42-0a8a0817c691.rm',
			// 	changeType : "updated", // changeType: 'updated'
			// };

		});
	},
	//
	getSvgs                   : function(notebookId){
		return new Promise(async function(resolve_top,reject_top){
			// Get files.json.
			let fileData ;
			try{ 
				fileData = await funcs.getExistingJsonFsData(true).catch(function(e) { throw e; });
				fileData = fileData.files; 
			} 
			catch(e){ 
				console.log("ERROR:", e); 
				reject_top();
				return;
			}

			let visibleName = fileData.DocumentType[notebookId].metadata.visibleName;
			let fileType    = fileData.DocumentType[notebookId].content.fileType;
			let fileDir     = config.imagesPath + "" + notebookId + "/";
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
					fileData.DocumentType[notebookId].content.pages.forEach(function(d, i){
						layer1_files.data.push(
							[
								{ file: `${fileDir}pages/${d}.min.svg`                         , pageNum: i+1, showText: true, text: `TYPE: A: (.min.svg)` },
								{ file: `${fileDir}pages/${d}.svg`                             , pageNum: i+1, showText: true, text: `TYPE: B: (.svg)    ` },
								// { file: `${fileDir}pages/${d}.png`                             , pageNum: i+1, showText: true, text: `TYPE: C: (.png)    ` },
								// { file: `${fileDir}pages/${visibleName}-${i}.png`              , pageNum: i+1, showText: true, text: `TYPE: D: (.png)    ` },
								// { file: `${fileDir}pages/TEST_${d}.svg`                        , pageNum: i+1, showText: true, text: `TYPE: E: (.svg)    ` },
								{ file: `DEVICE_DATA/xochitl/${notebookId}.thumbnails/${d}.jpg`, pageNum: i+1, showText: true, text: `TYPE: F: (.jpg)    ` },
							]
						);
					});

					// Layer 2: Notebook annotations: Get layer2_files.
					fileData.DocumentType[notebookId].content.pages.forEach(function(d, i){
						layer2_files.data.push(
							[
								// { file: `${fileDir}${d}.min.svg`                               , pageNum: i+1, text: `TYPE: A: (.min.svg)` },
								// { file: `${fileDir}${d}.svg`                                   , pageNum: i+1, text: `TYPE: B: (.svg)    ` },
								// { file: `DEVICE_DATA/xochitl/${notebookId}.thumbnails/${d}.jpg`, pageNum: i, text: `(c): .jpg    ` },
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
					fileData.DocumentType[notebookId].content.pages.forEach(function(d, i){
						layer1_files.data.push(
							[
								{ file: `${fileDir}pages/${d}.min.svg`                         , pageNum: i+1, text: `TYPE: A: (.min.svg)` },
								{ file: `${fileDir}pages/${d}.svg`                             , pageNum: i+1, text: `TYPE: B: (.svg)    ` },
								{ file: `${fileDir}pages/${d}.png`                             , pageNum: i+1, text: `TYPE: C: (.png)    ` },
								{ file: `${fileDir}pages/${visibleName}-${i}.png`              , pageNum: i+1, text: `TYPE: D: (.png)    ` },
								{ file: `${fileDir}pages/TEST_${d}.svg`                        , pageNum: i+1, text: `TYPE: E: (.svg)    ` },
								{ file: `DEVICE_DATA/xochitl/${notebookId}.thumbnails/${d}.jpg`, pageNum: i+1, text: `TYPE: F: (.jpg)    ` },
							]
						);
					});

					// Layer 2: Notebook annotations: Get layer2_files.
					fileData.DocumentType[notebookId].content.pages.forEach(function(d, i){
						layer2_files.data.push(
							[
								{ file: `${fileDir}${d}.min.svg`                               , pageNum: i+1, text: `TYPE: A: (.min.svg)` },
								{ file: `${fileDir}${d}.svg`                                   , pageNum: i+1, text: `TYPE: B: (.svg)    ` },
								// { file: `DEVICE_DATA/xochitl/${notebookId}.thumbnails/${d}.jpg`, pageNum: i, text: `(c): .jpg    ` },
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
					fileData.DocumentType[notebookId].pagedata.forEach(function(d, i){
						layer1_files.data.push(
							[
								{ file: `${config.templatesPath}${d}.min.svg`                  , pageNum: i+1, text: `TYPE A: (.min.svg)` },
								{ file: `${config.templatesPath}${d}.svg`                      , pageNum: i+1, text: `TYPE B: (.svg)    ` },
								{ file: `${config.templatesPath}${d}.png`                      , pageNum: i+1, text: `TYPE C: (.png)    ` },
							]
						);
					});
						
					// Layer 2: Notebook pages: Get layer2_files.
					fileData.DocumentType[notebookId].content.pages.forEach(function(d, i){
						layer2_files.data.push(
							[
								{ file: `${fileDir}${d}.min.svg`                               , pageNum: i+1, text: `TYPE A: (.min.svg)` },
								{ file: `${fileDir}${d}.svg`                                   , pageNum: i+1, text: `TYPE B: (.svg)    ` },
								{ file: `DEVICE_DATA/xochitl/${notebookId}.thumbnails/${d}.jpg`, pageNum: i+1, text: `TYPE C: (.jpg)    ` },
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
								console.log(`  FOUND    : ${info.baseText}: ${rec.text} PAGE #${rec.pageNum.toString().padStart(padStartNum, "0")}, `, rec.file);
							}
							
							// Add the file to the list. 
							arrDest.push(rec.file); 

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
			console.log(`DONE`);

			// Resolve. All done!
			let obj = {
				"layers"       : layers,
				"notebookTitle": visibleName,
				"type"         : fileType,
			};
			resolve_top( JSON.stringify(obj, null, 0) );
		});
	},
	//
	getGlobalUsageStats       : function(){
		return new Promise(async function(resolve_top,reject_top){
			// Get files.json.
			let files ;
			try{ 
				files = await funcs.getExistingJsonFsData(true).catch(function(e) { throw e; });; 
				files = files.files; 
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
						fullpath     : funcs.getParentPath(rec.extra._thisFileId, type, files),
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
			}
			resolve_top(JSON.stringify(obj, null, 1));
		});
	},
	//
	getThumbnails             : function(parentId){
		return new Promise(async function(resolve_top,reject_top){
			let getThumbnail = function(notebookId, existingFilesJson){
				//. Use notebookId to get the folder, use .pages to get the page ids (in order.)
				let targetPath = config.dataPath + "" + notebookId + ".thumbnails";
	
				// Need to check that the directory exists.
				if(!fs.existsSync(targetPath)){ 
					let msg = "ERROR: getThumbnail: targetPath does not exist." + targetPath;
					console.log(msg); 
					throw msg ; 
					return; 
				};

				// Get the first page id.
				let firstPageId = existingFilesJson.DocumentType[notebookId].content.pages[0];
				
				// Check that the file exists. 
				let firstThumbnail = path.join(targetPath, firstPageId+".jpg");
				if(!fs.existsSync(firstThumbnail)){ 
					let msg = "ERROR: getThumbnail: firstThumbnail_path does not exist. " + firstThumbnail;
					console.log(msg); 
					throw msg; 
					return; 
				};
				
				// Send the file.
				return firstThumbnail ;
			};

			// Get files.json.
			let existingFilesJson ;
			try{ 
				existingFilesJson = await funcs.getExistingJsonFsData(true).catch(function(e) { throw e; });; 
				existingFilesJson = existingFilesJson.files; 
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
					recs[key] = data; 
				}
			}

			resolve_top(JSON.stringify(recs, null, 0));
		});
	},
};

module.exports = {
	webApi            : webApi,
	_version          : function(){ return "Version 2021-09-24"; }
};