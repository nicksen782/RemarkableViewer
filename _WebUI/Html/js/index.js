var rpt = {
	// globals     : {} ,
	// nav         : {} ,
	// apis        : {} ,
	// documentView: {} ,
};

rpt.globals = {
	// Holds the document and dir data: (not the images themselves)
	dirs  : {} , 
	files : {} , 

	// Tracks the environment:
	environment        : "" ,

	// Tracks the last loaded document and dir:
	lastLoadedDir      : "" ,
	lastLoadedDocument : "" ,

	// Timer trackers.
	queueCheckerId: null, 

	// SETTINGS:
	syncInterface            : null, // set via settings.json.
	open_document_fullscreen : null, // set via settings.json.
	addDirIdToUrl            : null, // set via settings.json.
	addDocumentdIdToUrl       : null, // set via settings.json.
	
	// SETTINGS LIST OF KEYS:
	keyList : [
		"syncInterface"            , // Settings
		"view_pdf_annotations"     , // Notebook
		"open_document_fullscreen" , // Settings
		"addDirIdToUrl"            , // Settings
		"addDocumentdIdToUrl"       , // Settings
	],

	// SHARED FUNCTIONS.
	fixDeletedFiles : function(){
		// If a dir is set as deleted then change it's parent to "deleted".
		for(let key in rpt.globals.dirs ){ 
			rec = rpt.globals.dirs[key];  
			if(rec.metadata.deleted == true) { 
				rec.metadata.parent = "deleted";
			} 
		}
	
		// If a file is set as deleted then change it's parent to "deleted".
		for(let key in rpt.globals.files){ 
			rec = rpt.globals.files[key]; 
			if(rec.metadata.deleted == true) { 
				rec.metadata.parent = "deleted";
			}
		}
	},

};

rpt.nav = {
	// Set url params
	getUrlParams                     : function(){
		const urlSearchParams = new URLSearchParams(window.location.search);
		const params = Object.fromEntries(urlSearchParams.entries());
		return params;
	},
	// Set url params
	setUrlParams                     : function(dirId, documentId){
		let newParams = {
		};
		let paramCount = 0;
		let queryString = "";
		
		if( dirId|| dirId == "" ){
			newParams.dir = dirId;
		}

		if( documentId ){
			newParams.document = documentId;
		}

		for(let key in newParams){
			let param = newParams[key];
			if(paramCount == 0){
				queryString += `?${key}=${param}`;
			}
			else{
				queryString += `&${key}=${param}`;
			}
			paramCount += 1;
		}

		// Change the url.
		history.replaceState(null, "", `${queryString}`);
	},
	//
	changeView                       : function(newView){
		let validKeys = [ "filesystem", "document", "settings" ];
		
		let navButtons = {
			filesystem: document.getElementById("rpt_nav_bar_button_filesystem"),
			document  : document.getElementById("rpt_nav_bar_button_notebook"),
			settings  : document.getElementById("rpt_nav_bar_button_settings"),
		};
		let views = {
			filesystem: document.getElementById("rpt_nav_bar_view_filesystem"),
			document  : document.getElementById("rpt_nav_bar_view_notebook"),
			settings  : document.getElementById("rpt_nav_bar_view_settings"),
		};

		// Show the document controls.
		// notebook_controls2.classList.add("active");

		// Remove the "active" class for the specified navButton and view.
		for(let key of validKeys){
			navButtons[key].classList.remove("active");
			views     [key].classList.remove("active");
		}
		
		// Add the "active" class for the specified navButton and view.
		if(validKeys.indexOf(newView) != -1){ 
			navButtons[newView].classList.add("active"); 
			views     [newView].classList.add("active");
		}

	},
	
	//
	getEntriesWithinParent           : function(parentId, data){
		let _files = data.files;
		let _dirs  = data.dirs;

		let obj = {
			dirs: [],
			files: [],
			thisDir: _dirs[parentId] != undefined ? _dirs[parentId] : ""
		};

		for(let key in _dirs){
			let rec = _dirs[key]
			
			// Hide these files/folders if the parentId is not "deleted" or "trash".
			if(key == "trash"   && parentId != "trash"  ){ continue; }
			if(key == "deleted" && parentId != "deleted"){ continue; }

			// Skip if not a match. 
			if(rec.metadata.parent == parentId) { 
				obj.dirs.push(rec);
			}
		}

		for(let key in _files){
			let rec = _files[key]
			
			// Hide these files/folders if the parentId is not "deleted" or "trash".
			if(key == "trash"   && parentId != "trash"  ){ continue; }
			if(key == "deleted" && parentId != "deleted"){ continue; }

			// Skip if not a match. 
			if(rec.metadata.parent == parentId) { 
				obj.files.push(rec);
			}
		}

		return obj;
	},

	// Get list of notebooks and directories within the specified parent. 
	listNotebooksAndDirsWithinParent : function(parentId){
		// Get the dirs for the specified folder. 
		let data = rpt.nav.getEntriesWithinParent(parentId, {dirs:rpt.globals.dirs, files:rpt.globals.files});
		
		// Sort the dirs by name. 
		data.dirs.sort(
			function(a,b) { return a.metadata.visibleName > b.metadata.visibleName ? 1 : -1; }
		);

		// Sort the files by name. 
		data.files.sort(
			function(a,b) { return a.metadata.visibleName > b.metadata.visibleName ? 1 : -1; }
		);

		// console.log("***", data);
		return data;
	},

	//
	createNavIcons                   : async function(parentId){
		// Get the visibleName of the file found within files. 
		let getParentDirName = function(file, files){
			// Cosmetic. "" is shown as "My files"
			if(file.metadata.parent == ""){
				return "My files";
			}
			else if(file.metadata.parent == "trash"){
				return "trash";
			}
			else if(file.metadata.deleted == true){
				return "deleted";
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

		let getBreadcrumbs = function(dirId){
			let timeIsUp = false;
			let startTime = performance.now();
			let id = dirId;
			let dirPathsData = [];

			while(id != "" || timeIsUp){
				let currentTime = performance.now();
				if(currentTime-startTime > 1000){ console.log("Took too long!"); timeIsUp = true; break; }
				
				let data = rpt.nav.listNotebooksAndDirsWithinParent(id);
				// console.log(data.thisDir, data.thisDir.metadata.visibleName}, data.thisDir.extra._thisFileId, data.thisDir.metadata.parent);
				id = data.thisDir.metadata.parent;
				dirPathsData.push({
					"thisDirName"       : data.thisDir.metadata.visibleName, 
					"thisDirId"         : data.thisDir.extra._thisFileId, 
					"parentDirName"     : getParentDirName(data.thisDir, { "CollectionType":rpt.globals.dirs, "DocumentType":rpt.globals.files }),
					"parentDirId"       : data.thisDir.metadata.parent,
				});
			}
			dirPathsData.push({
				// "thisDirName"  : "ROOT", 
				"thisDirName"  : "My files", 
				"thisDirId"    : "", 
				"parentDirName": null,
				"parentDirId"  : null,
			});

			dirPathsData.reverse();

			// console.log("*************");
			// console.log(dirPathsData);
			// console.log("*************");

			return dirPathsData;
		};
		
		// 
		// Set the url queryString. 
		rpt.nav.setUrlParams( (rpt.globals.addDirIdToUrl == "YES" ? parentId : null), null);

		// Updated the lastLoaded dir and document. 
		rpt.globals.lastLoadedDir      = parentId; 
		rpt.globals.lastLoadedDocument = ""; 

		let data = rpt.nav.listNotebooksAndDirsWithinParent(parentId);
		data.crumbs = getBreadcrumbs(parentId);
		
		let _crumbs = data.crumbs.map(function(d, i, a){ 
			let crumbClasses = "";
			if(i+1 >= a.length && a.length != 1){ crumbClasses = "crumb last activeItem"; }
			else { crumbClasses = "crumb"; }
			if(i==0){
				crumbClasses += " myfiles" ;
			}
			let html = `
				<span 
					class=" ${crumbClasses}" 
					title="NAME: ${d.thisDirName}\nID: ${d.thisDirId}" 
					onclick="rpt.nav.changeView('filesystem'); rpt.nav.createNavIcons('${d.thisDirId}');"
				>
					${d.thisDirName}
				`; 
				html += `</span>`
				if(i < a.length-1){
					html += `<span class="gt_sign crumb "> > </span>`;
				}

			return html; 

		}).join("");

		data.dirs.sort( function(a,b){ 
			// Make copy of the name string as upper-case.
			// var a_copy = (' ' + a.name.toUpperCase()).slice(1);
			// var b_copy = (' ' + b.name.toUpperCase()).slice(1);
			var a_copy = (' ' + a.metadata.visibleName.toUpperCase()).slice(1);
			var b_copy = (' ' + b.metadata.visibleName.toUpperCase()).slice(1);
			
			// Make all non-letter/char characters a '-' before the sort. (Puts them at the top.)
			let replaceWithDash = [ "[", "", "]", "^", "", "_", "`", "{", "|", "}", "~" ];
			if( replaceWithDash.indexOf(a_copy) ) { a_copy = a_copy.replace(/_/g, "-"); }
			if( replaceWithDash.indexOf(b_copy) ) { b_copy = b_copy.replace(/_/g, "-"); }
			
			if (a_copy < b_copy) return -1; 
			if (a_copy > b_copy) return 1 ; 
			return 0; 
		} );
		
		let _dirs = data.dirs.map(function(d, i, a){ 
			// Use the correct icon. 
			// Get the dirs for the specified folder. 
			let counts = rpt.nav.getEntriesWithinParent(d.extra._thisFileId, {dirs:rpt.globals.dirs, files:rpt.globals.files});
			let dirsLength  = counts.files.length;
			let filesLength = counts.dirs.length;

			let iconClass = "";
			if(dirsLength || filesLength){ iconClass += "full"; }
			else                         { iconClass += "empty"; }
			
			let html = `
				<span 
					class="navFileIcon CollectionType ${iconClass}" 
					XXXtitle="NAME: ${d.metadata.visibleName}\nID: ${d.extra._thisFileId}" 
					onclick="rpt.nav.changeView('filesystem'); rpt.nav.createNavIcons('${d.extra._thisFileId}');"
					onmouseenter="rpt.nav.displayNotebookMetadata('${d.extra._thisFileId}', '${d.metadata.type}');"
				> 
					${d.metadata.visibleName}
				</span>`
			; 

			return html;
		}).join("");

		let thumbnails;
		try { 
			thumbnails = await rpt.apis.getThumbnails(parentId); 
		} 
		catch(e){ 
			console.log("ERROR: Unable to retrieve thumbnails for this directory", parentId); 
		}

		let _files = data.files.map(function(d){ 
			// console.log("DocumentType id: " + d.extra._thisFileId, d.metadata.visibleName});

			let visibleName = `${d.metadata.visibleName}` ;
			if(visibleName.length > 50){
				// visibleName = `${visibleName.slice(0, 50)} ... (${d.content.pageCount})`
			}
			else{
				// visibleName = `${d.metadata.visibleName}} (${d.content.pageCount})`;
			}
			return `
				<div 
					class="file_box" 
					XXXtitle="NAME: ${d.metadata.visibleName}}\nID: ${d.extra._thisFileId}\nPages: ${d.content.pageCount}" 
					onclick="
						rpt.nav.changeView('document'); 
						rpt.documentView.display('${d.extra._thisFileId}');
					"
					onmouseenter="rpt.nav.displayNotebookMetadata('${d.extra._thisFileId}', '${d.metadata.type}');"
					document_id="${d.extra._thisFileId}"
				>
					<div class="thumbnail"   style="background-image:url('${thumbnails[d.extra._thisFileId]}')"></div>	
					<div class="visibleName" >${visibleName}</div>
					<div class="pages"       >
						${d.content.pageCount} pages
						<div class="indicators">
						<div class="displayed">DISPLAYED</div>
						<div title="${d.metadata.modified ? "Changes not synced to the cloud." : "Changes synced to the cloud."}" class="cloudStatus ${d.metadata.modified ? "cloud_not_synced" : "cloud_synced"}"></div>
						</div>
					</div>
				</div>
			`;
		}).join("");
		
		let html1 = (_crumbs) + ""; // Breadcrumbs.
		let html2 = (_dirs)   + ""; // Directories.
		let html3 = (_files)  + ""; // Documents.
	
		let rpt_nav_box_left_breadcrumbs      = document.getElementById("rpt_nav_box_left_breadcrumbs");
		let rpt_nav_box_left_filesystem_dirs  = document.getElementById("rpt_nav_box_left_filesystem_dirs");
		let rpt_nav_box_left_filesystem_files = document.getElementById("rpt_nav_box_left_filesystem_files");

		if( _crumbs.length                 ){ rpt_nav_box_left_breadcrumbs.innerHTML = html1;         } else{ rpt_nav_box_left_breadcrumbs.innerHTML = ""; }
		rpt_nav_box_left_filesystem_dirs .innerHTML = html2; 
		rpt_nav_box_left_filesystem_files.innerHTML = html3; 
	},

	//
	displayNotebookMetadata          : async function(id, type){
		let dest   = document.getElementById("rpt_nav_box_right_metadata2")  ;
		dest.innerHTML = ``;
		
		let src ;
		if(type == "CollectionType"){
			src = rpt.globals.dirs;
		}
		else if(type == "DocumentType"){
			src = rpt.globals.files;
		}

		let html = "";
		html += `<div style="font-size:100%; white-space: pre; font-family:monospace; overflow: hidden; text-overflow: ellipsis;">`;
		html += `HOVERED ${type == "CollectionType" ? "DIRECTORY" : "NOTEBOOK"}:\n`;
		html += ` Path: <span style="font-size:80%;" title="${src[id].path}">${src[id].path}</span>\n`
		html += ` Name          : ${src[id].metadata.visibleName} \n` ;
		html += ` parent        : ${src[id].metadata.parent} \n`;
		html += ` Modified      : ${new Date(parseInt(src[id].metadata.lastModified)).toString().split(" GMT")[0]} \n` ;
		html += ` Update count  : ${src[id].metadata.version} \n` ;
		html += ` Type          : ${src[id].metadata.type} \n` ;
		html += ` fileType      : ${src[id].content.fileType || "NOT SET"} \n` ;
		html += ` UUID-4        : <span style="font-size:80%;" title="${src[id].extra._thisFileId}">${src[id].extra._thisFileId}</span>\n`;
		html += ` Pinned        : ${src[id].metadata.pinned} \n` ;
		html += ` Trashed       : ${src[id].metadata.parent == "trash"} \n` ;
		html += ` Deleted       : ${src[id].metadata.deleted} \n` ;
		
		if(type == "CollectionType"){
			html += `\n`;
			let counts = rpt.nav.getEntriesWithinParent(src[id].extra._thisFileId, {dirs:rpt.globals.dirs, files:rpt.globals.files});
			let dirsLength  = counts.files.length;
			let filesLength = counts.dirs.length;

			html += ` Dirs  in dir  : ${dirsLength } \n`;
			html += ` Files in dir  : ${filesLength } \n`;
		}
		if(type == "DocumentType"){
			html += `\n`;
			html += ` Page count    : ${src[id].content.pageCount} \n`;
			html += ` Orientation   : ${src[id].content.orientation} \n`;
			html += ` Margins       : ${src[id].content.margins} \n`;
			html += ` Text Alignment: ${src[id].content.textAlignment} \n`;
			html += ` Text Scale    : ${src[id].content.textScale} \n`;
		}
		
		html += `\n`;
		html += ` Uploaded to cloud: ${src[id].metadata.synced} \n`;
		html += ` Updated in Cloud : ${!src[id].metadata.modified} \n`;
		
		html += `\n`;
		if(type == "CollectionType"){ html += `<button onclick="console.log(rpt.globals.dirs['${id}']); ">console.log: DIR</button> \n`; }
		if(type == "DocumentType"){ html += `<button onclick="console.log(rpt.globals.files['${id}']); ">console.log: FILE</button> \n`; }

		html += `</div> \n`;
		
		dest.innerHTML = html;
	},
}

rpt.apis = {
	// Used for GET requests. 
	rawFetch         : async function(url){
		// Backend should send JSON. 
		return fetch(url).then(response => response.text());
	},
	// Used for GET requests. 
	simpleFetch         : async function(url){
		// Backend should send JSON. 
		return fetch(url).then(response => response.json());
	},

	// Used for POST requests. 
	postFetch           : async function(url, body){
		// Backend should send JSON. 
		return fetch(
			url, 
			{
				method: 'POST',
				headers: {
				  'Accept': 'application/json',
				  'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			}
		).then(response => response.json());
	},

	// Runs a device-to-server sync and then updates the local image files. 
	updateFromDevice          : function(){
		return new Promise(function(resolve, reject){
			if(rpt.globals.environment == "demo"){
				alert("Function is not available in the demo version.");
				resolve();
				return;
			}

			// DOM.
			let progressDestParent = document.querySelector("#rpt_nav_bar_view_settings_sync_progress");
			let progressDest       = document.querySelector("#rpt_nav_bar_view_settings_sync_progress .content");

			// SSE
			let timestamp = null;
			let sseHasEnded = false;
			let queryString = `?` +
				`interface=`       + `${rpt.globals.syncInterface}` +
				`&recreateAll=` + `${false}`
			;
			const sse = new EventSource(`updateFromDevice${queryString}`);
			
			// A safeguard to ensure that this SSE doesn't repeat itself if something goes wrong. 
			sse.addEventListener("open"  , function(e){ 
				if(timestamp == null){ 
					start(e);
				}
				else{
					console.log("ERROR: open:", timestamp, e); 
					console.log("new timestamp... repeated connection. Closing.");
					end();
					// sse.close();
				} 
			});

			// Catches errors and will close the connection. 
			sse.addEventListener("error" , function(e){ 
				console.log("ERROR: Closing the connection.", timestamp);
				end();
				// sse.close();
			});

			// Handles all new messages.
			sse.addEventListener("message", function(e){ 
				// Parse the JSON. 
				let data = JSON.parse(e.data);

				// Check for the ending string. 
				let done = (data == "==--ENDOFDATA--==");

				// Are we still going? 
				if(!done){
					// console.log(data);
					queue.addToQueue(data);
					// window.requestAnimationFrame( displayFunc.bind(null, data) );
				}
				// No, we are done. Close the connection. 
				else{
					// console.log("Closing (end was detected.)");
					sseHasEnded=true;
					end();
				}
			});

			// Acts as a sort of rate-limiter for DOM updates. 
			const queue = {
				queue: [],
				delayTime: 100,
				
				start: function(){
					// Stop any existing queueChecker.
					if(rpt.globals.queueCheckerId != null){
						clearInterval(rpt.globals.queueCheckerId);
						rpt.globals.queueCheckerId = null;
					}
	
					// Start the queueChecker. 
					rpt.globals.queueCheckerId = setInterval(queue.queueChecker, queue.delayTime);

					// console.log("queue: start:", rpt.globals.queueCheckerId);
				},
				addToQueue: function(data){
					// Queue the data for later sending.
					// console.log("queue: addToQueue:", data);
					queue.queue.push(data);
				},
				end: function(){
					console.log("end of sse", "sseHasEnded:", sseHasEnded);
					// console.log("queue: end:", rpt.globals.queueCheckerId);
					// Stop queueChecker.
					// clearInterval(rpt.globals.queueCheckerId);
					// rpt.globals.queueCheckerId = null;

					// Send whatever is still in the queue.
					// sseHasEnded=true;

					// setTimeout(function(){
					// 	console.log("Dumping the remaining queue.")
					// 	queue.queueChecker();
					// }, 5000);
				},
				queueChecker : function(){
					// console.log("queue.queueChecker:", "queue length:", queue.queue.length);

					// Get some messages. (If there are fewer messages than this then this will still work.)
					if(sseHasEnded && queue.queue.length == 0){
						// Stop queueChecker.
						clearInterval(rpt.globals.queueCheckerId);
						rpt.globals.queueCheckerId = null;
						console.log("setInterval for queueChecker has ended.");
					}

					if(queue.queue.length){
						window.requestAnimationFrame(function(){
							// toDo = queue.queue.splice(0, 1);
							toDo = queue.queue.splice(0, Math.ceil( queue.queue.length * 0.25 ));
							// console.log("Sending:", toDo.length, "records of: ", queue.queue.length+toDo.length, toDo);
						
							// Send the messages (combined to reduce the number of DOM updates.)
							if(toDo.length){
								toDo = toDo.join("\n");	
								displayFunc(toDo);
							}
						}); 
					}

				},
			};

			// Updates the DOM.
			const displayFunc = function(data){
				// console.log("d:", data);
				progressDest.innerHTML += data + "<br>";
				progressDest.scrollTop = progressDest.scrollHeight;
			};

			// Start of SSE.
			const start = function(e){ 
				// console.log("start"); 
				timestamp = e.timeStamp; 
				progressDest.innerHTML = "";
				// progressDestParent.classList.remove("hide");

				// console.log("Starting queue...");
				queue.start();
			};

			// End of SSE.
			const end   = async function(){ 
				// console.log("end"); 
				sse.close();

				//
				sseHasEnded = true; 

				//
				queue.end();

				// Get files.json.
				try{ await rpt.apis.getFilesJson(); } catch(e){ console.log("ERROR: getFilesJson:", e); };

				// Reopen the current document.
				rpt.documentView.reDisplaySameNotebook();
			};

		});
	},
	
	// updateFromDeviceTemplates
	updateFromDeviceTemplates         : function(){
		return new Promise(function(resolve, reject){
			rpt.apis.simpleFetch("updateFromDeviceTemplates?interface=" + `${rpt.globals.syncInterface}`).then(
				function(results){
					resolve(results);
				}
			);
		});
	},
	// Gets the settings.json file and then loads it's settings. 
	getSettings         : function(){
		return new Promise(function(resolve, reject){
			rpt.apis.simpleFetch("getSettings").then(
				function(results){
					rpt.globals.syncInterface            = results.syncInterface; 
					rpt.globals.open_document_fullscreen = results.open_document_fullscreen; 
					rpt.globals.addDirIdToUrl            = results.addDirIdToUrl; 
					rpt.globals.addDocumentdIdToUrl       = results.addDocumentdIdToUrl; 
					rpt.globals.view_pdf_annotations     = results.view_pdf_annotations; 
					rpt.globals.environment              = results.environment;

					console.log("Environment:", rpt.globals.environment);
					resolve(results);
				}
			);
		});
	},

	// Saves current settings to the settings.json file. 
	updateSettings         : function(){
		return new Promise(function(resolve, reject){
			if(rpt.globals.environment == "demo"){
				// alert("Function is not available in the demo version.");
				resolve();
				return;
			}

			let data = {
				syncInterface            : rpt.globals.syncInterface, 
				open_document_fullscreen : rpt.globals.open_document_fullscreen, 
				addDirIdToUrl            : rpt.globals.addDirIdToUrl, 
				addDocumentdIdToUrl       : rpt.globals.addDocumentdIdToUrl, 
				view_pdf_annotations     : rpt.globals.view_pdf_annotations, 
			};
			rpt.apis.postFetch("updateSettings", data).then(
				function(results){
					resolve(results);
				}
			);
		});

	},

	// 
	getFilesJson        : function(){
		return new Promise(function(resolve, reject){
			rpt.apis.simpleFetch("getFilesJson").then(
				function(results){
					rpt.globals.files       = results.DocumentType;
					rpt.globals.dirs        = results.CollectionType;

					// Fix deleted files. 
					rpt.globals.fixDeletedFiles();
				
					// Get the last opened/modified notebooks. 
					rpt.apis.getGlobalUsageStats();

					resolve(results);
				}
			);
		});
	},

	//
	getGlobalUsageStats : function(){
		return new Promise(function(resolve, reject){
			rpt.apis.simpleFetch("getGlobalUsageStats").then(
				function(results){
					// Get a handle to the select menus.
					let date_opened_select   = document.getElementById("rpt_nav_box_right_metadata1_select1")  ;
					let date_modified_select = document.getElementById("rpt_nav_box_right_metadata1_select2")  ;
					let favorites_select     = document.getElementById("rpt_nav_box_right_metadata1_select3")  ; // Favorites
					
					// Clear the select menus (leave the first entry.)
					date_opened_select  .querySelectorAll("optgroup, option").forEach(function(d,i){ if(i!=0) { d.remove(); }});
					date_modified_select.querySelectorAll("optgroup, option").forEach(function(d,i){ if(i!=0) { d.remove(); }});
					favorites_select    .querySelectorAll("optgroup, option").forEach(function(d,i){ if(i!=0) { d.remove(); }});
					
					// Function that creates the select menus. 
					let createSelect = function(dest, data, key, usePrefix){
						// Create the document fragment for this select.
						let frag = document.createDocumentFragment();

						// "DocumentType"
						// "CollectionType"

						// Create the optgroups.
						data.forEach(function(d){
							// Make sure the optgroup does not already exist. 
							let exists = frag.querySelector("optgroup[label='"+d.fullpath+"']") ? true : false;
							if(exists){ return; }

							// Create the optgroup.
							let optgroup = document.createElement("optgroup");
							optgroup.setAttribute("label", d.fullpath);
							frag.append(optgroup);
						});
						
						// Create/add options to the matching optgroup.
						data.forEach(function(d){
							// Create the option. 
							let option = document.createElement("option");
							let extraData1 = key !== false ? "(" + d[key] + ")" : "";
							option.innerHTML = "";
							if(usePrefix){
								if     (d.type == "DocumentType" ){ option.innerHTML += `[FILE] `; }
								else if(d.type =="CollectionType"){ option.innerHTML += `[DIR]  `; }
							}
							// option.innerHTML += `${d.name} ${extraData1}`;
							option.innerHTML += `${extraData1} -- ${d.name}`;

							option.setAttribute("parentId", d.parentId);
							option.setAttribute("id", d.id);
							option.setAttribute("type", d.type);

							// Find and add to the option's optgroup.
							let optgroup = frag.querySelector("optgroup[label='"+d.fullpath+"']");
							optgroup.appendChild(option);
						});

						// Add the optgroups and options to the select.
						dest.appendChild(frag);
					};
					let addBlankOptGroup = function(dest){
						// Create the document fragment for this select.
						let frag = document.createDocumentFragment();

						// Create the optgroup.
						let optgroup = document.createElement("optgroup");
						optgroup.setAttribute("label", "");
						frag.append(optgroup);

						// Add the optgroup to the select.
						dest.appendChild(frag);
					};

					// Create the select menus.
					createSelect(date_opened_select  , results.byLastOpened   , "date_opened"  , false);
					createSelect(date_modified_select, results.byLastModified , "date_modified", false);
					createSelect(favorites_select    , results.favorites.files, false, true);
					addBlankOptGroup(favorites_select);
					createSelect(favorites_select    , results.favorites.dirs , false, true);

					// Add the diskFree info.
					document.getElementById("diskFree").innerText = `` + 
						`${results.diskFree['Used']} used ` +
						`of ${results.diskFree['1K-blocks']} total `+
						`(${results.diskFree['Available%']} free)` ;

					// Resolve - done!
					resolve(results);
				}
			);
		});
	},

	//
	getSvgs             : function(documentId){
		return new Promise(function(resolve, reject){
			rpt.apis.simpleFetch(`getSvgs?documentId=${documentId}`).then(
				function(results){
					resolve(results);
				}
			);
		});
	},

	//
	getThumbnails       : function(parentId){
		return new Promise(function(resolve, reject){
			rpt.apis.simpleFetch("getThumbnails?parentId="+parentId+"").then(
				function(results){
					resolve(results);
				}
			);
		});
	},
};

rpt.documentView = {
	// Reloads the currently opened document.
	reDisplaySameNotebook : async function(){
		// Check if a document 
		if(rpt.globals.lastLoadedDocument) {
			// console.log("Loading last document...", rpt.globals.lastLoadedDocument);
			rpt.nav.changeView('document');
			rpt.documentView.display(rpt.globals.lastLoadedDocument);
		}
		else{
			// console.log("Loading last dir...", rpt.globals.lastLoadedDir);
			rpt.nav.changeView('filesystem');
			try{ await rpt.nav.createNavIcons(rpt.globals.lastLoadedDir); } catch(e){ console.log("ERROR: in createNavIcons", e); return; }
		}
	},

	// UTILITY: Takes 2 numbers and returns the ratio of those numbers.
	reduce                : function(numerator, denominator) {
		let a = numerator;
		let b = denominator;
		let c;
		while (b) {
			c = a % b; 
			a = b; 
			b = c;
		}
		return [numerator / a, denominator / a];
	},

	// UTILITY: 
	getDimensionsByRatio  : function(width, height, arx, ary){
		let w = height * (arx/ary);
		let h = height;
	
		let i=100;
		while(w > width/2 && i > 0){
			w -= (arx*4);
			h -= (ary*4);
			i -= 1;
		}
		return {
			w: w,
			h: h,
			i: i
		}
	},
	
	// UTILITY: 
	getNonPaddedDimensions : function(elem){
		let computedStyle = getComputedStyle(elem);

		// Get the borders and paddings.
		let paddingX = parseFloat(computedStyle.paddingLeft)     + parseFloat(computedStyle.paddingRight);
		let paddingY = parseFloat(computedStyle.paddingTop)      + parseFloat(computedStyle.paddingBottom);
		let borderX  = parseFloat(computedStyle.borderLeftWidth) + parseFloat(computedStyle.borderRightWidth);
		let borderY  = parseFloat(computedStyle.borderTopWidth)  + parseFloat(computedStyle.borderBottomWidth);

		// Element width and height minus padding and border
		elementWidth  = elem.offsetWidth  - paddingX - borderX;
		elementHeight = elem.offsetHeight - paddingY - borderY;

		return {
			paddingX     : paddingX,
			paddingY     : paddingY,
			borderX      : borderX,
			borderY      : borderY,
			elementWidth : elementWidth,
			elementHeight: elementHeight,
			// org_elementWidth : elem.offsetWidth,
			// org_elementHeight: elem.offsetHeight,
			// computedStyle:computedStyle,
		};
	},
	
	// UTILITY: 
	generateNotebookSize   : function(elem, ratio_w, ratio_h, doFullScreen){
		// Use the values to generate the max-size value for the given element. 
		let dims1 = rpt.documentView.getNonPaddedDimensions( elem );
		let dims2;

		if(doFullScreen){
			dims2 = rpt.documentView.getDimensionsByRatio(dims1.elementWidth, dims1.elementHeight, ratio_w, ratio_h);
			// dims2 = rpt.documentView.getDimensionsByRatio(dims1.org_elementWidth, dims1.org_elementHeight, ratio_w, ratio_h);
			// console.log("dims1:", dims1);
			// console.log("dims2:", dims2);
		}
		else{
			dims2 = rpt.documentView.getDimensionsByRatio(dims1.elementWidth-(dims1.paddingX), dims1.elementHeight-(dims1.paddingY), ratio_w, ratio_h);
		}
		
		return dims2;
	},

	// Display the selected document.
	display                : async function(documentId){
		if(documentId == "") { return; }

		// console.log("window.innerWidth:", window.innerWidth, "window.innerHeight:", window.innerHeight);
		// console.log("window.outerWidth:", window.outerWidth, "window.outerHeight:", window.outerHeight);

		let notebookFiles;
		notebookFiles = await rpt.apis.getSvgs(documentId);
		
		let parentId = rpt.globals.files[documentId].metadata.parent;

		// Update the displayed File-system:
		try{ await rpt.nav.createNavIcons(parentId); } catch(e){ console.log("ERROR: in createNavIcons", e); return; }

		// Record the last loaded dirId and documentId.
		rpt.globals.lastLoadedDir      = parentId; 
		rpt.globals.lastLoadedDocument = documentId; 

		// Update the displayed url.
		rpt.nav.setUrlParams(rpt.globals.addDirIdToUrl == "YES" ? parentId : null, rpt.globals.addDocumentdIdToUrl == "YES" ? documentId : "");

		// Update the nav section to indicate the opened file. 
		let icons = document.querySelectorAll("#rpt_nav_box_left_filesystem_files .file_box");
		icons.forEach(function(d){ d.classList.remove("activeItem"); });
		icons.forEach(function(d){ if(d.getAttribute("document_id") == documentId) { d.classList.add("activeItem"); } });

		// Generate a document size that will fill the height of the destination parent. 
		// Full-screen?
		let destParent = document.getElementById("rpt_nav_bar_view_notebook");
		let notebookWidth ;
		let notebookHeight;
		let doFullScreen = Array.from(document.getElementsByName("open_document_fullscreen")).find(r => r.checked).value;
		doFullScreen = doFullScreen == "YES" ? true : false;

		// Fullscreen vs non-fullscreen resize the parent differently. 
		if(doFullScreen){
			// Add the expand class.
			destParent.classList.add("expand");
			
			// Adjust the parent width/height. 
			destParent.style.width  = (window.innerWidth  - 0) + "px";
			destParent.style.height = (window.innerHeight - 32) + "px";

			// destParent.style.width  = (window.outerWidth  - 0) + "px";
			// destParent.style.height = (window.outerHeight - 32) + "px";
		}
		else{
			// Remove the expand class.
			destParent.classList.remove("expand");

			// Adjust the parent width/height. 
			destParent.style.width = "100%";
			destParent.style.height = "100%";
		}

		// Determine proper dimensions for the document to fit in the parent container.
		let dimensions = rpt.documentView.generateNotebookSize( destParent, 3, 4, doFullScreen);

		// Save the document dimensions. 
		notebookWidth  = dimensions.w - 0;
		notebookHeight = dimensions.h - 64;

		// Set the footer dimensions.
		let footerWidth  = (notebookWidth * 2) ;
		let footerHeight = 32;

		// Adjust the parent dimensions.
		destParent.style.width  = (notebookWidth * 2) + "px";
		destParent.style.height = (notebookHeight   ) + "px";

		let destination = document.getElementById("rpt_nav_bar_view_notebook_pageview");

		destination.innerHTML = "LOADING...";
		let obj = {
			// totalPageNums  : pages.length,
			// pages          : pages,
			totalPageNums  : notebookFiles.layers.layer1.length,
			pages          : notebookFiles.layers,
			destination    : destination,
			notebookTitle   : notebookFiles.notebookTitle,
			dims : {
				main: {
					notebookWidth   : notebookWidth,
					notebookHeight  : notebookHeight,
				},
				footer: {
					footerWidth   : footerWidth,
					footerHeight  : footerHeight,
				}	
			}
		};

		pageFlip.displayFlipbook(obj);
	},
	
};

window.onload = async function(){
	window.onload=null;

	let setUiSettings = function(){
		for(let i=0; i<rpt.globals.keyList.length; i+=1){
			let key = rpt.globals.keyList[i];
			try{
				document.querySelector(`input[name="${key}"][value="${rpt.globals[key]}"]`).checked = true; 
			}
			catch(e){ 
				console.log("ERROR on key:", key, ", value:", rpt.globals[key], e); }
		}
	};

	let addEventListeners = function(){
		// Allows the user to press the escape key to return to the file system navigation menu. 
		document.addEventListener("keyup", function(e) {
			if (e.key === "Escape") { // escape key maps to keycode `27`
				rpt.nav.changeView('filesystem');
			}
		}, false);

		// Update the settings.json file when the user changes a setting.
		for(let i=0; i<rpt.globals.keyList.length; i+=1){
			let key = rpt.globals.keyList[i];

			document.querySelectorAll(`input[name="${key}"]`).forEach(function(d){
				// Disable this interface if in the demo mode.
				if(rpt.globals.environment == "demo"){
					d.disabled = true;
					d.parentElement.setAttribute("title", "Function is not available in the demo version.");
					return false;
				}

				if(rpt.globals.keyList.indexOf(key) != -1){
					// Event listeners: url changes.
					if(
						[
							"syncInterface", 
							"open_document_fullscreen", 
							"addDirIdToUrl", 
							"addDocumentdIdToUrl", 
						].indexOf(key) != -1
					){
						d.addEventListener("change", function(e){ 
							// Update the value in memory.
							rpt.globals[ key ] = this.value;

							// console.log("updating url:", rpt.globals.addDirIdToUrl, rpt.globals.addDocumentdIdToUrl);
							rpt.nav.setUrlParams(
								rpt.globals.addDirIdToUrl      == "YES" ? rpt.globals.lastLoadedDir      : "", 
								rpt.globals.addDocumentdIdToUrl == "YES" ? rpt.globals.lastLoadedDocument : ""
							);
		
							// Send the new settings to the server.
							rpt.apis.updateSettings();
						});
					}
					// Event listeners: view_pdf_annotations.
					else if(["view_pdf_annotations"].indexOf(key) != -1){
						
						// Send the new settings to the server.
						d.addEventListener("change", function(e){ 
							// Update the value in memory.
							rpt.globals[ key ] = this.value;

							rpt.apis.updateSettings();
							console.log("rpt.globals.view_pdf_annotations:", rpt.globals.view_pdf_annotations);
						});
					}
				};
			});
		}

		// let view_pdf_annotations = Array.from(document.getElementsByName("view_pdf_annotations")).find(r => r.checked).value;

		// For the last opened/modified select.
		let openViaSelect = async function(){
			if(this.value == "") { return; }
			let selectedOption = this.options[this.options.selectedIndex];
			let type = selectedOption.getAttribute("type");
			console.log(type);
			if(type == "DocumentType"){
				rpt.nav.changeView('document'); 
				let parentId = selectedOption.getAttribute("parentId");
				let id       = selectedOption.getAttribute("id");
				try{ await rpt.nav.createNavIcons(parentId); } catch(e){ console.log("ERROR: in createNavIcons", e); return; }
				rpt.documentView.display(id);
				this.value = "";
			}
			else if(type == "CollectionType"){
				rpt.nav.changeView('filesystem'); 
				let parentId = selectedOption.getAttribute("parentId");
				let id       = selectedOption.getAttribute("id");
				try{ await rpt.nav.createNavIcons(id); } catch(e){ console.log("ERROR: in createNavIcons", e); return; }
				// rpt.documentView.display(id);
				this.value = "";
			}
		};
		// For the last opened select.
		document.getElementById("rpt_nav_box_right_metadata1_select1").addEventListener("change", openViaSelect, false);
		// For the last modified select.
		document.getElementById("rpt_nav_box_right_metadata1_select2").addEventListener("change", openViaSelect, false);
		// For the favorites select.
		document.getElementById("rpt_nav_box_right_metadata1_select3").addEventListener("change", openViaSelect, false);

		// Clear the Sync Progress content when clicking it's header row.
		document.querySelector("#rpt_nav_bar_view_settings_sync_progress .row.header").addEventListener("click", function(){
			document.querySelector("#rpt_nav_bar_view_settings_sync_progress .row.content").innerHTML = "";
		}, false);

		// view_myfiles button.
		document.getElementById("view_myfiles").addEventListener("click", function(){
			rpt.nav.createNavIcons("");
		}, false);
		
		// view_trash button.
		document.getElementById("view_trash").addEventListener("click", function(){
			rpt.nav.createNavIcons("trash");
		}, false);

		// view_deleted button.
		document.getElementById("view_deleted").addEventListener("click", function(){
			rpt.nav.createNavIcons("deleted");
		}, false);
		
		// Listen for window resize.
		// window.addEventListener("resize", function () {
		// 	console.log(window.innerWidth, window.innerHeight);
		// });
		// console.log(window.innerWidth, window.innerHeight);
	};

	let displayStartDirAndNotebook = async function(){
		let params = rpt.nav.getUrlParams();
		if(params.dir == undefined){ 
			params.dir = ""; 
			// rpt.globals.lastLoadedDir = ""; 
		}
		if(params.document == undefined){ 
			params.document = null; 
			// rpt.globals.lastLoadedDir = null; 
		}

		if(params.dir || params.dir == "" || params.document){
			// console.log("sent some url params:", params);
			// Was a dir specified?
			if(params.dir || params.dir == ""){
				// Check if dir is valid.
				if( Object.keys(rpt.globals.dirs).indexOf(params.dir) != -1 || params.dir == ""){
					// Display the dir.
					try{ await rpt.nav.createNavIcons(params.dir); } catch(e){ console.log("ERROR: in createNavIcons", e); return; }
				}
				else{
					// Display the root. 
					try{ await rpt.nav.createNavIcons(""); } catch(e){ console.log("ERROR: in createNavIcons", e); return; }
				}
			}
			else{
				// Display the root. 
				try{ await rpt.nav.createNavIcons(""); } catch(e){ console.log("ERROR: in createNavIcons", e); return; }
			}
			
			// Was a document specified?
			if(params.document){
				// Is the document valid?
				if( Object.keys(rpt.globals.files).indexOf(params.document) != -1 ){
					rpt.nav.changeView('document');
					rpt.documentView.display(params.document);
				}
			}
		}

		// Is this needed?
		else{
			// Display the root. 
			try{ await rpt.nav.createNavIcons(""); } catch(e){ console.log("ERROR: in createNavIcons", e); return; }
		}
	};
	
	// Get settings.json.
	try{ await rpt.apis.getSettings();  } catch(e){ console.log("ERROR: getSettings:", e); };

	// Set UI settings.
	setUiSettings();

	// Get files.json.
	try{ await rpt.apis.getFilesJson(); } catch(e){ console.log("ERROR: getFilesJson:", e); };
	
	// Is this the first run? If so then dirs would only contain "trash" and "deleted" and files would be empty.
	// rpt.globals.files = {}
	// rpt.globals.dirs = {"trash":{}, "deleted":{}, }
	if( Object.keys(rpt.globals.files).length == 0 && Object.keys(rpt.globals.dirs).length == 2){
		console.log("This is the first run!");
		document.getElementById("rpt_nav_box_left_filesystem_files").innerHTML = "" + 
			"<div id='no_data'>" +
			"	<div class='no_data_box'>"+
			"		<span class='no_data_line1'>NO DATA.</span><br><br>"+
			"		<span class='no_data_line2'>Please go to the Settings tab and sync your Remarkable device.</span><br><br>"+
			"		" +
			"	</div>" +
			"</div>" ;
	}
	else{
		// Adjust the parent value for deleted directories.
		rpt.globals.fixDeletedFiles();

		// Display dir and document (if applicable.)
		displayStartDirAndNotebook();
	}

	// Add event listeners.
	addEventListeners();
}
