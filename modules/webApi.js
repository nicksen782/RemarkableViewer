// WEB UI - FUNCTIONS.
const fs               = require('fs');
const path             = require('path');
const funcs            = require('./funcs.js').funcs;
const config           = require('./config.js').config;
const updateFromDevice = require('./updateFromDevice').updateFromDevice;

const webApi = {
	updateFromDevice    : updateFromDevice,
	getSvgs             : function(notebookId, notebookTemplatesAs, notebookPagesAs){
		return new Promise(async function(resolve_top,reject_top){
			// Get files.json.
			let files ;
			try{ 
				files = await funcs.getExistingJsonFsData(true); 
				files = files.files; 
			} 
			catch(e){ 
				console.log("ERROR:", e); 
				reject_top();
				return;
			}

			let fileType = files.DocumentType[notebookId].content.fileType;
			let layers;
			let pages = files.DocumentType[notebookId].content.pages;

			if(fileType == "pdf"){
				let annotatedPages = [];
				let fileDir = config.imagesPath + "" + notebookId + "/annotations/";

				pages.forEach(function(d){
					let findThis1 = fileDir + d + ".svg";
					let findThis2 = fileDir + d + ".min.svg";
					
					if( fs.existsSync(findThis1) ){
						annotatedPages.push(findThis1);
					}
					else if( fs.existsSync(findThis2) ){
						annotatedPages.push(findThis2);
					}
					else{
						annotatedPages.push("");
					}
				});

				// Get the notebook svgs.
				let temp2 = [];
				dirFiles.forEach(function(d){
					let filename = `${d.filepath}`
					temp2.push(filename);
				});

				layers = {
					// PDF pages.
					"layer1":temp2,

					// Annotations of PDF pages.
					"layer2":annotatedPages,
				};
			}
			else if(fileType == "notebook"){
				let fileDir = config.imagesPath + "" + notebookId + "/";

				// Get the templates. 
				let temp1 = [];
				files.DocumentType[notebookId].pagedata.forEach(function(d){
					let findThis1 = `DEVICE_DATA/templates/${d}.min.svg`;
					let findThis2 = `DEVICE_DATA/templates/${d}.svg`;
					let findThis3 = `DEVICE_DATA/templates/${d}.png`;
					// console.log("findThis1:", findThis1);
					// console.log("findThis2:", findThis2);
					// console.log("findThis3:", findThis3); 
					// console.log();
					if     ( fs.existsSync(findThis1) ){ temp1.push(findThis1); }
					else if( fs.existsSync(findThis2) ){ temp1.push(findThis2); }
					else if( fs.existsSync(findThis3) ){ temp1.push(findThis3); }
					else{ temp1.push(""); }
				});

				// Get the notebook svgs.
				let temp2 = [];
				pages.forEach(function(d){
					let findThis1 = fileDir + d + ".min.svg"; 
					let findThis2 = fileDir + d + ".svg";     
					let findThis3 = fileDir + d + ".png";     
					// console.log("findThis1:", findThis1);
					// console.log("findThis2:", findThis2);
					// console.log("findThis3:", findThis3); 
					// console.log();
					if     ( fs.existsSync(findThis1) ){ temp2.push(findThis1); }
					else if( fs.existsSync(findThis2) ){ temp2.push(findThis2); }
					else if( fs.existsSync(findThis3) ){ temp2.push(findThis3); }
					else{ temp2.push(""); }
				});

				layers = {
					// Template svgs.
					"layer1":temp1,

					// Notebook svgs.
					"layer2":temp2,
				};

				// pageData = files.DocumentType[notebookId].pagedata;
			}

			resolve_top(
				JSON.stringify(
					{
						// "__DEBUG": {
						// 	"notebookId": notebookId,
							// "dirFiles": dirFiles,
						// 	"ARGS": [notebookId, notebookTemplatesAs, notebookPagesAs],
						// },
						
						// DATA
						// "templateFiles": templateFiles,
						// "pageFiles"    : pageFiles,
						// "pagedata"     : pageData,
						"layers"       : layers,
						"notebookTitle": files.DocumentType[notebookId].metadata.visibleName,
						"type"         : files.DocumentType[notebookId].content.fileType,

					}, 
				null, 0)
			);
		});
	},
	
	NEWgetSvgs             : function(notebookId){
		return new Promise(async function(resolve_top,reject_top){
			// Get files.json.

			// Get handle to the document's object.

			// Get handle to content.pages.

			// Get those page file names and paths - templates, annotations, pdf images

			// Return data as a layer object - change layers based on content.fileType.
		});
	},
	getGlobalUsageStats : function(){
		return new Promise(async function(resolve_top,reject_top){
			// Get files.json.
			let files ;
			try{ 
				files = await funcs.getExistingJsonFsData(true); 
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

			resolve_top(JSON.stringify({
				byLastOpened  : byLastOpened_results  ,
				byLastModified: byLastModified_results,
				favorites     : {
					files: favorites_results_file ,
					dirs : favorites_results_dir  ,
				},
			}, null, 1));
		});
	},
	getThumbnails       : function(parentId, thumbnailPagesAs){
		return new Promise(async function(resolve_top,reject_top){
			let getThumbnail = function(notebookId, existingFilesJson){
				//. Use notebookId to get the folder, use .pages to get the page ids (in order.)
				let targetPath = config.dataPath + "" + notebookId + ".thumbnails";
	
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
			let existingFilesJson ;
			try{ 
				existingFilesJson = await funcs.getExistingJsonFsData(true); 
				existingFilesJson = existingFilesJson.files; 
			} 
			catch(e){ 
				console.log("ERROR:", e); 
				reject_top();
				return;
			}
			
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

module.exports = {
	webApi            : webApi,
	_version          : function(){ return "Version 2021-09-24"; }
};