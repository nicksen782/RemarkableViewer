// WEB UI - FUNCTIONS.
const fs               = require('fs');
const path             = require('path');
const funcs            = require('./funcs.js').funcs;
const config           = require('./config.js').config;
const updateFromDevice = require('./updateFromDevice').updateFromDevice;
const optimizeSvg      = require('./updateFromDevice').optimizeSvg;

const webApi = {
	//
	updateFromDevice    : updateFromDevice,
	//
	updateFromDeviceTemplates : function(){
		return new Promise(async function(resolve_top,reject_top){
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
	getSvgs             : function(notebookId){
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

			let visibleName = files.DocumentType[notebookId].metadata.visibleName;
			let fileType    = files.DocumentType[notebookId].content.fileType;
			let pages       = files.DocumentType[notebookId].content.pages;
			let layers;

			let fileDir      = config.imagesPath + "" + notebookId + "/";
			// let templatesDir = config.templatesPath; 

			if(fileType == "pdf"){
				// let annotationsDir = config.imagesPath + "" + notebookId + "/annotations/";

				// PDF PAGES.
				let temp1 = [];
				pages.forEach(function(d, i){
					let findThis1 = fileDir + d + ".min.svg";
					let findThis2 = fileDir + d + ".svg";
					let findThis3 = fileDir + d + ".png";
					let findThis4 = `DEVICE_DATA/xochitl/${notebookId}.thumbnails/${d}.jpg`;
					
					if     ( fs.existsSync(findThis1) ){ temp1.push(findThis1); console.log("PDF L1: .min.svg", visibleName, i); }
					else if( fs.existsSync(findThis2) ){ temp1.push(findThis2); console.log("PDF L1: .svg", visibleName, i); }
					else if( fs.existsSync(findThis3) ){ temp1.push(findThis3); console.log("PDF L1: .png", visibleName, i); }
					else if( fs.existsSync(findThis4) ){ temp1.push(findThis4); console.log("PDF L1: .jpg", visibleName, i); }
					else{ temp1.push(""); console.log("PDF L2: Could not find page file.", visibleName, i); }
				});

				// ANNOTATION PAGES.
				let temp2 = [];
				pages.forEach(function(d, i){
					let findThis1 = fileDir + d + ".min.svg"; 
					let findThis2 = fileDir + d + ".svg";
					let findThis3 = fileDir + d + ".png";
					let findThis4 = `DEVICE_DATA/xochitl/${notebookId}.thumbnails/${d}.jpg`;

					if     ( fs.existsSync(findThis1) ){ temp2.push(findThis1); console.log("ANOTATION L2: .min.svg", visibleName, i); }
					else if( fs.existsSync(findThis2) ){ temp2.push(findThis2); console.log("ANOTATION L2: .svg", visibleName, i); }
					else if( fs.existsSync(findThis3) ){ temp2.push(findThis3); console.log("ANOTATION L2: .png", visibleName, i); }
					else if( fs.existsSync(findThis4) ){ temp2.push(findThis4); console.log("ANOTATION L2: .jpg", visibleName, i); }
					else{ temp2.push(""); console.log("ANOTATION L2: Could not find page file.", visibleName, i); }
				});

				layers = {
					// PDF pages.
					"layer1":temp1,

					// Annotations of PDF pages.
					"layer2":temp2,
				};
			}

			else if(fileType == "notebook"){
				// Get the templates. 
				let temp1 = [];
				files.DocumentType[notebookId].pagedata.forEach(function(d, i){
					let findThis1 = config.templatesPath + d + ".min.svg"; 
					let findThis2 = config.templatesPath + d + ".svg";
					let findThis3 = config.templatesPath + d + ".png";

					if     ( fs.existsSync(findThis1) ){ temp1.push(findThis1); console.log("TEMPLATE L1: .min.svg", visibleName, i); }
					else if( fs.existsSync(findThis2) ){ temp1.push(findThis2); console.log("TEMPLATE L1: .svg", visibleName, i); }
					else if( fs.existsSync(findThis3) ){ temp1.push(findThis3); console.log("TEMPLATE L1: .png", visibleName, i); }
					else{ temp1.push(""); console.log("TEMPLATE L1: Could not find template file.", visibleName, i); }
				});

				// Get the notebook pages.
				let temp2 = [];
				pages.forEach(function(d, i){
					let findThis1 = fileDir + d + ".min.svg"; 
					let findThis2 = fileDir + d + ".svg";
					let findThis3 = fileDir + d + ".png";
					let findThis4 = `DEVICE_DATA/xochitl/${notebookId}.thumbnails/${d}.jpg`;

					if     ( fs.existsSync(findThis1) ){ temp2.push(findThis1); console.log("NOTEBOOK L2: .min.svg", visibleName, i); }
					else if( fs.existsSync(findThis2) ){ temp2.push(findThis2); console.log("NOTEBOOK L2: .svg", visibleName, i); }
					else if( fs.existsSync(findThis3) ){ temp2.push(findThis3); console.log("NOTEBOOK L2: .png", visibleName, i); }
					else if( fs.existsSync(findThis4) ){ temp2.push(findThis4); console.log("NOTEBOOK L2: .jpg", visibleName, i); }
					else{ temp2.push(""); console.log("NOTEBOOK L2: Could not find page file.", visibleName, i); }
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
						// 	"ARGS": [notebookId],
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
	//
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
	//
	getThumbnails       : function(parentId){
		return new Promise(async function(resolve_top,reject_top){
			let getThumbnail = function(notebookId, existingFilesJson){
				//. Use notebookId to get the folder, use .pages to get the page ids (in order.)
				let targetPath = config.dataPath + "" + notebookId + ".thumbnails";
	
				// Need to check that the directory exists.
				if(!fs.existsSync(targetPath)){ 
					console.log("ERROR: getThumbnail: targetPath does not exist.", targetPath); 
					throw "ERROR: getThumbnail: targetPath does not exist." + targetPath ; 
					return; 
				};

				// Get the first page id.
				let firstPageId = existingFilesJson.DocumentType[notebookId].content.pages[0];
				
				// Check that the file exists. 
				let firstThumbnail_path = path.join(targetPath, firstPageId+".jpg");
				if(!fs.existsSync(firstThumbnail_path)){ 
					console.log("ERROR: getThumbnail: firstThumbnail_path does not exist.", firstThumbnail_path); 
					throw "ERROR: getThumbnail: firstThumbnail_path does not exist." + firstThumbnail_path; 
					return; 
				};
				
				// Retrieve the file as base64.
				let firstThumbnail;
				firstThumbnail = firstThumbnail_path;
				
				return firstThumbnail ;
			};

			// Get files.json.
			let existingFilesJson ;
			try{ 
				existingFilesJson = await funcs.getExistingJsonFsData(true); 
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