// WEB UI - FUNCTIONS.
const fs              = require('fs');
const path            = require('path');
const funcs           = require('./funcs.js').funcs;
const config          = require('./config.js').config;
const updateAll2      = require('./updateAll2').updateAll2;

const webApi = {
	updateAll2          : updateAll2,
	// updateAll2          : function(obj){ console.log("hey!", updateAll2, test); updateAll2(obj); },
	getFilesJson        : function(){
		return new Promise(async function(resolve_top,reject_top){
			let existingFilesJson;
			try{ existingFilesJson = await funcs.getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }
			resolve_top(existingFilesJson.files);
		});
	},
	getSvgs             : function(notebookId, notebookTemplatesAs, notebookPagesAs){
		return new Promise(async function(resolve_top,reject_top){
			// Need to check that the directory exists.
			// Need to check if there are already svg files in the directory.
			// Retrieve what is in that directory.
			// let dirExists = fs.existsSync(targetPath);
			// let dirFiles = await funcs.getItemsInDir(targetPath, "files"); // fs.promises.readdir(targetPath);

			// Get files.json.
			let files ;
			try{ files = await webApi.getFilesJson(); } catch(e){ console.log("ERROR:", e); res.send(JSON.stringify(e)); return; }
			
			let fileType = files.DocumentType[notebookId].content.fileType;

			// Get the template files. 
			let proms = [];
			let templateFiles = {};
			if(fileType == "notebook"){
				files.DocumentType[notebookId].pagedata.forEach(function(d){
					let filename = `DEVICE_DATA/templates/${d}.svg`
					let baseFilename = filename.split("/")[2];
					let keyName = baseFilename.split(".")[0];

					if(templateFiles[d] == undefined){
						if(notebookTemplatesAs == "base64"){
							templateFiles[keyName] = "";
							proms.push(
								new Promise(function(res1, rej1){
									fs.readFile(filename, function (err, file_buffer) {
										if (err) {
											console.log("ERROR READING FILE 1", filename, err); 
											rej1([filename, err]); 
											return;
										}
										if(filename.indexOf(".png") != -1){
											templateFiles[keyName] = 'data:image/png;base64,' + file_buffer.toString('base64').trim();
											res1();
										}
										else if(filename.indexOf(".svg") != -1){
											templateFiles[keyName] = 'data:image/svg+xml;base64,' + file_buffer.toString('base64').trim();
											res1();
										}
										else{ 
											console.log("no match???");
											rej1(); 
										}
									})
								})
							);
						}
						else if(notebookTemplatesAs == "filename"){
							templateFiles[keyName] = filename;
						}
					}
				});
			}
				
			// Get the notebook page files. 
			let targetPath = config.imagesPath + "" + notebookId;
			let dirFiles = await funcs.getItemsInDir(targetPath, "files"); // fs.promises.readdir(targetPath);
			let pageFiles = {};
			dirFiles.forEach(function(file){
				// console.log("notebook page file:", file);
				proms.push(
					new Promise(function(res1, rej1){
						let filename = file.filepath;
						let baseFilename = filename.split("/")[2];
						pageFiles[baseFilename] = "";

						if(notebookPagesAs == "base64"){
							fs.readFile(filename, function (err, file_buffer) {
								if (err) {
									console.log("ERROR READING FILE 1", file, err); 
									rej1([file, err]); 
									return;
								}
								// 
								if(filename.indexOf(".png") != -1){
									pageFiles[baseFilename] = 'data:image/png;base64,' + file_buffer.toString('base64').trim();
									res1( pageFiles[baseFilename] );
								}
								else if(filename.indexOf(".svg") != -1){
									pageFiles[baseFilename] = 'data:image/svg+xml;base64,' + file_buffer.toString('base64').trim();
									res1( pageFiles[baseFilename] );
								}
								// else if(filename.indexOf(".rm") != -1){
									// pageFiles[baseFilename] = 'application/octet-stream;base64,' + file_buffer.toString('base64').trim();
									// res1( pageFiles[baseFilename] );
								// }
								else{
									console.log("invalid file type.");
									rej();
								}
							})
						}
						else if(notebookPagesAs == "filename"){
							pageFiles[baseFilename] = filename; 
							res1(file);
						}
					})
				);
			});

			Promise.all(proms).then(
				function(results){
					let layers;

					if(files.DocumentType[notebookId].content.fileType == "pdf"){
						let annotatedPages = [];
						let pages = files.DocumentType[notebookId].content.pages;
						// let fileDir = config.dataPath + "" + notebookId + "/annotations/";
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
					if(files.DocumentType[notebookId].content.fileType == "notebook"){
						// Get the templates. 
						let temp1 = [];
						files.DocumentType[notebookId].pagedata.forEach(function(d){
							let filename = `DEVICE_DATA/templates/${d}.svg`
							temp1.push(filename);
						});

						// Get the notebook svgs.
						let temp2 = [];
						dirFiles.forEach(function(d){
							let filename = `${d.filepath}`
							temp2.push(filename);
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

				},

				function(error){ console.log("ERROR:", error); reject_top(JSON.stringify([],null,0)); }
			);

		});
	},
	getGlobalUsageStats : function(){
		return new Promise(async function(resolve_top,reject_top){
			let files;
			try{ files = await funcs.getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject(JSON.stringify(e)); return; }
			files = files.files;

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

			return; 
			const lastOpened   = function(sortKey, type){
				
			};
			const lastModified = function(){
			};
			const favorites    = function(){
			};

			

			let sortKey2 = "lastOpened";
			let sorted2 = Object.keys(files.DocumentType).sort(
				function(a,b){
					return files.DocumentType[b].metadata[sortKey2] - files.DocumentType[a].metadata[sortKey2];
				}
			);
			sorted2 = sorted2.slice(0, 20);
			let results2 = [];
			sorted2.forEach(function(d){
				let type = "DocumentType";
				let rec = files.DocumentType[d];
				let obj = {
					type         : type,
					lastModified : rec.metadata.lastModified,
					lastOpened   : rec.metadata.lastOpened,
					id           : rec.extra._thisFileId,
					name         : rec.metadata.visibleName,
					// parentName   : funcs.getParentDirName(rec, files),
					parentId     : rec.metadata.parent,
					date_modified: new Date(parseInt(rec.metadata.lastModified)).toString().split(" GMT")[0],
					date_opened  : new Date(parseInt(rec.metadata.lastOpened)).toString().split(" GMT")[0],
					fullpath     : funcs.getParentPath(rec.extra._thisFileId, type, files),
				};
				results2.push(obj);
			});

			let results3 = [];
			let sorted3_files = Object.keys(files.DocumentType).filter(function(d){
				return files.DocumentType[d].metadata["pinned"];
			});
			let sortKey3 = "lastModified";
			sorted3_files = sorted3_files.sort(
				function(a,b){
					return files.DocumentType[b].metadata[sortKey3] - files.DocumentType[a].metadata[sortKey3];
				}
			);
			let sorted3_dirs = Object.keys(files.CollectionType).filter(function(d){
				return files.CollectionType[d].metadata["pinned"];
			});
			sorted3_dirs = Object.keys(sorted3_dirs).sort(
				function(a,b){
					return files.CollectionType[b].metadata[sortKey3] - files.CollectionType[a].metadata[sortKey3];
				}
			);

			sorted3_files.forEach(function(d){
				let type = "DocumentType";
				let rec = files[type][d];
				let obj = {
					type         : type,
					lastModified : rec.metadata.lastModified,
					lastOpened   : rec.metadata.lastOpened,
					id           : rec.extra._thisFileId,
					name         : rec.metadata.visibleName,
					// parentName   : funcs.getParentDirName(rec, files),
					parentId     : rec.metadata.parent,
					date_modified: new Date(parseInt(rec.metadata.lastModified)).toString().split(" GMT")[0],
					date_opened  : new Date(parseInt(rec.metadata.lastOpened)).toString().split(" GMT")[0],
					fullpath     : funcs.getParentPath(rec.extra._thisFileId, type, files),
				};
				results3.push(obj);
			});
			sorted3_dirs.forEach(function(d){
				let type = "CollectionType";
				let rec = files[type][d];
				console.log(rec);
				return; 
				let obj = {
					type         : type,
					lastModified : rec.metadata.lastModified,
					lastOpened   : rec.metadata.lastOpened,
					id           : rec.extra._thisFileId,
					name         : rec.metadata.visibleName,
					// parentName   : funcs.getParentDirName(rec, files),
					parentId     : rec.metadata.parent,
					date_modified: new Date(parseInt(rec.metadata.lastModified)).toString().split(" GMT")[0],
					date_opened  : new Date(parseInt(rec.metadata.lastOpened)).toString().split(" GMT")[0],
					fullpath     : funcs.getParentPath(rec.extra._thisFileId, type, files),
				};
				results3.push(obj);
			});


			resolve_top(JSON.stringify({
				byLastOpened  : results1,
				byLastModified: results2,
				favorites     : results3,
				// recent        : results4,
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
			let existingFilesJson;
			try{ existingFilesJson = await funcs.getExistingJsonFsData(); } catch(e){ console.log("ERROR:", e); reject_top(JSON.stringify(e)); return; }
			existingFilesJson = existingFilesJson.files;

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
	_version          : function(){ return "Version 2021-09-23"; }
};