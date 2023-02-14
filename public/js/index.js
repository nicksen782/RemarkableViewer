function test(){
    // DocumentType
    // {
    //     "uuid": "b9f01279-3a76-4a4c-a319-8b9e8673c92e",
    //     "visibleName": "New Sync Method",
    //     "type": "DocumentType",
    //     "parent": "9bc9f1d7-eec4-46ee-9cda-0ac50ffdb7a2",
    //     "deleted": false,
    //     "pageCount": 10,
    //     "fileType": "notebook",
    //     "_time": 1675984789
    // }

    // app.rm_fs.CollectionType.filter(d=>d.visibleName == "New pdf version");
    // app.rm_fs.CollectionType.filter(d=>d['uuid'] == "9bc9f1d7-eec4-46ee-9cda-0ac50ffdb7a2");
}

var debug = {
    init: async function(){
    },
};
var net = {
    // DONE. Can use either "GET" or "POST" and type of either "json" or "text".
    // timeoutMs is for when the request should abort if it takes took long. Sending a falsey value will disable this feature.
    // let resp = await net.send2("/promo_push/test/getOne", "json", "POST", { key: 'pushEndpointid', value: 1 });
    // let data = await net.send(`${serverUrl}`, dataOptions, 45000);
    send: async function(url, userOptions, timeoutMs=10000){
        // console.log("SEND:", url, userOptions, timeoutMs);
        return new Promise(async (resolve,reject)=>{
            // Set default values if the value is missing.
            if(!userOptions || typeof userOptions != "object"){ userOptions = {}; }
            if(!userOptions.method){ userOptions.method = "POST"; }
            if(!userOptions.type)  { userOptions.type = "json"; }

            // Set method.
            let method = userOptions.method.toUpperCase();
            let options = {
                method: userOptions.method,
                headers: {},
            };

            // Set body?
            switch(userOptions.method){
                case "GET": { break; }
                case "POST": { if(userOptions.body) { options.body = JSON.stringify(userOptions.body); } break; }
                default : { throw "ERROR: INVALID METHOD: " + method; resolve(false); return; break; }
            }

            // Set headers.
            switch(userOptions.type){
                case "json": {
                    options.headers = {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    };
                    break;
                }
                case "text": {
                    options.headers = {
                        'Accept': 'text/plain',
                        'Content-Type': 'text/plain'
                    };
                    break;
                }
                default : { throw "ERROR: INVALID TYPE: " + userOptions.type; resolve(false); return; break; }
            };

            // Setup an AbortController to control the timeout length of the request.
            let controller;
            let id;
            if(timeoutMs){
                controller = new AbortController();
                id = setTimeout(() => controller.abort(), timeoutMs);
                options.signal = controller.signal;
            }
            let aborted = false;

            // console.log("SEND2:", options);
            // Make the request.
            let resp;
            try{
                resp = await fetch(url, options )
                .catch(e=>{
                    // Clear the abort timeout.
                    if(timeoutMs){
                        clearTimeout(id);
                    }

                    // We had a problem. Was it due to the abort signal?
                    if(e.type=="aborted"){
                        console.log("ABORTED A");
                        aborted = true;
                        // resolve(e.type);
                        resolve(false);
                        return;
                    }

                    // Throw the error.
                    throw e;
                });

                // Are we done and the aborted flag hasn't been set?
                if(!aborted){
                    // Clear the abort timeout.
                    if(timeoutMs){
                        clearTimeout(id);
                    }

                    // Was the response good?
                    if(resp.statusText == "OK" || resp.status == 200 || resp.statusText == ""){
                        if     (userOptions.type=="json"){ resp = await resp.json(); }
                        else if(userOptions.type=="text"){ resp = await resp.text(); }
                        else{
                            console.log("SEND: Bad userOptions.type", userOptions.type);
                        }
                        // console.log("SEND GOOD:", resp);
                        resolve(resp); return;
                    }
                    // Bad response.
                    else{
                        // console.log(resp.statusText, resp);
                        console.log("BAD RESPONSE", resp);
                        resolve(false); return;
                    }
                }

                // It was aborted. This request has failed.
                else{
                    console.log("ABORTED B", resp);
                    resolve(false); return;
                }

            }

            // Something went wrong in the try.
            catch(e){
                console.log("Something went wrong in the try:", e);
                resolve(false); return;
            }
        });
    },
};

var app = {
    rm_fs: { "CollectionType": [], "DocumentType": [] },

    get_rm_fsFile: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { },
        };

        let data = await net.send(`get_rm_fsFile`, dataOptions, false);
        app.rm_fs = data.rm_fs;
        
        // console.log("app.rm_fs      :", app.rm_fs);

        // let collections = app.rm_fs.CollectionType
        //     .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
        //     .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );

        // let folders     = app.rm_fs.DocumentType  
        //     .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
        //     .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );

        // console.log( "Collections in <root>:", collections );
        // console.log( "Documents   in <root>:", folders );
    },
    getAvailablePages: async function(uuid){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { uuid: uuid },
        };

        let data = await net.send(`getAvailablePages`, dataOptions, false);
        // console.log("getAvailablePages      :", data);
        return data;
    },
    // Returns the full path for the given uuid and type.
    getParentPath: function(uuid, type, addVisibleNameToEnd=false){
        // USAGE:
        // app.getParentPath(uuid  , "DocumentType");
        // app.getParentPath(parent, "CollectionType");

        // Get a handle to the DocumentType or CollectionType that the uuid is referring to.
        let file = app.rm_fs[type].find(d=>d.uuid == uuid);

        // fullPath will be added to this array. 
        let fullPath = [];

        // Flags for root and trash.getParentPath

        // Set the initial currId to the file's parent uuid.
        let currId = file.parent;

        // Allow the search for only up to 20 levels. 
        for(let i=0; i<20; i+=1){
            // End on "" or "trash".
            if(currId == "" || file.parent == ""){ isAtRoot=true; break; }
            if(currId == "trash" || file.parent == "trash"){ isAtTrash=true; break; }

            // Get the parent's visible name. 
            let obj = app.rm_fs["CollectionType"].find(d=>d.uuid == currId);

            // Add the visibleName to the fullPath.
            fullPath.unshift(obj.visibleName);

            // End on "" or "trash".
            if(obj.parent == ""      || file.parent == ""){ isAtRoot=true; break; }
            if(obj.parent == "trash" || file.parent == "trash"){ isAtTrash=true; break; }

            // Get the next uuid in the chain.
            let nextObj = app.rm_fs["CollectionType"].find(d=>d.uuid == obj.parent)

            // If a result was found then set the currId to it's uuid.
            if(nextObj && nextObj.uuid){ currId = nextObj.uuid; }

            // If no file was found then handle the breaking of the loop.
            else{ 
                if(file.parent == "trash"){ currId = "trash"; }
                else{ currId = ""; }
                break; 
            }
        }

        // Add to the fullPath based on flags set.
        if(isAtRoot)      { fullPath.unshift("/My files"); }
        else if(isAtTrash){ fullPath.unshift("/trash"); }

        // Join the fullPath with "/" as separators, ending with a "/".
        fullPath = fullPath.join("/") + "/";
        
        // Add the visibleName of the file to the end of the string if requested.
        if(addVisibleNameToEnd){
            fullPath += file.visibleName;
        }
        
        // Return the completed fullPath (trimmed).
        return fullPath.trim();
    },
    getParentPathBreadcrumbs: function(uuid){
        // Example usage: app.getParentPathBreadcrumbs("7e16a6a5-a592-44d0-9b2e-f1c110650a6f");

        /* 
            Intended to provide a list of UUIDs and visibleName for each CollectionType 
            down from the path of the specified CollectionType uuid.
            Results will be:
                an object containing two objects containing arrays and one string for the full visible path.
         */

        /* 
        Example output:
        {
            visibleNames: [
                'My files', 
                '_My Projects', 
                'Remarkable Page Turner',
                'Old notes - v3'
            ],
            uuids: [
                "",
                "72a27ab3-aebf-490c-bda7-a8c057e927df",
                "4f668058-bfd5-402f-a4dd-e7a3e83f1578"
                "7e16a6a5-a592-44d0-9b2e-f1c110650a6f"
            ],
            fullVisiblePath: "/My files/_My Projects/Remarkable Page Turner/Old notes - v3"
        } 
        */

        // Holds the results.
        let results = {
            visibleNames: [],
            uuids: [],
            fullVisiblePath: "",
        };

        // Get a handle to the CollectionType that the uuid is referring to.
        let file = app.rm_fs["CollectionType"].find(d=>d.uuid == uuid);

        // Check if the parent is "".
        if(uuid == ""){
            results.visibleNames.unshift("My files");
            results.uuids.unshift("");
        }
        // Check if the parent is "trash".
        else if(uuid == "trash"){
            results.visibleNames.unshift("trash");
            results.uuids.unshift("trash");
        }
        // Look for parents, add them to the list until parent is "".
        else{
            let currSearchDepth = 0;
            let maxSearchDepth = 20;
    
            // Get the first uuid to check against.
            let obj = app.rm_fs["CollectionType"].find(d=>d.uuid == file.uuid);

            // Keep searching until reaching the root or trash or going passed maxSearchDepth.
            while(
                currSearchDepth < maxSearchDepth
            ){
                // Record this.
                results.visibleNames.unshift(obj.visibleName);
                results.uuids.unshift(obj.uuid);

                // End at root?
                if(obj.parent == ""){
                    // console.log("End at ''");
                    results.visibleNames.unshift("My files");
                    results.uuids.unshift("");
                    break;
                }
                // End at trash?
                else if(obj.parent == "trash"){
                    // console.log("End at 'trash'");
                    results.visibleNames.unshift("trash");
                    results.uuids.unshift("trash");
                    break;
                }
                // Continue: get the next parent.
                else{
                    obj = app.rm_fs["CollectionType"].find(d=>d.uuid == obj.parent);
                    currSearchDepth += 1;
                }
            }
        }

        // Add the fullVisiblePath.
        results.fullVisiblePath = "/" + results.visibleNames.join("/");

        // Return the results.
        return results;
    },
    getEntriesInCollectionType: function(parent){
        let collections = app.rm_fs.CollectionType
        .filter(d=>{ if(!d.deleted) { return d.parent == parent; } })
        .map(d=>{ return {...d, basepath: app.getParentPath(d.uuid, "CollectionType", true) } } );

        let documents = app.rm_fs.DocumentType
        .filter(d=>{ if(!d.deleted) { return d.parent == parent; } })
        .map(d=>{ return {...d, basepath: app.getParentPath(d.uuid, "DocumentType", true) } } );

        return {
            parentPathBreadcrumbs : app.getParentPathBreadcrumbs(parent),
            CollectionType        : collections,
            DocumentType          : documents,
        };
    },

    // NAVBAR NAVIGATION
    nav: {
        // Holds the DOM for the nav buttons and nav views.
        DOM: {
            'debug1': {
                'tab':'navbar_debug1_button',
                'view':'navbar_debug1_view',
            },
            'debug2': {
                'tab':'navbar_debug2_button',
                'view':'navbar_debug2_view',
            },
            'debug3': {
                'tab':'navbar_debug3_button',
                'view':'navbar_debug3_view',
            },
            'debug4': {
                'tab':'navbar_debug4_button',
                'view':'navbar_debug4_view',
            },
        },
        hideAll: function(){
            // Deactivate all views and nav buttons.
            for(let key in this.DOM){
                this.DOM[key].tab.classList.remove("active");
                this.DOM[key].view.classList.remove("active");
            }
        },

        showOne: function(key){
            // Check that the key is valid.
            if(Object.keys(this.DOM).indexOf(key) == -1){ console.log("WARN: Invalid nav key.", key); return; }

            // Deactivate all views and nav buttons.
            this.hideAll();

            // Active this view and nav button.
            this.DOM[key].tab.classList.add("active");
            this.DOM[key].view.classList.add("active");
        },

        init: function(){
            // Create the DOM cache and add the click event listener to the nav tabs.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key].view = document.getElementById(this.DOM[key].view);
                this.DOM[key].tab  = document.getElementById(this.DOM[key].tab);

                // Add event listeners to the tab.
                this.DOM[key].tab.addEventListener("click", ()=>{
                    this.showOne(key);
                }, false);
            }
        },

    },

    init: async function(){
        await this.get_rm_fsFile();

        // NAV INIT
        this.nav.init();
        // this.nav.showOne("debug1");
        // this.nav.showOne("debug2");
        this.nav.showOne("debug3");
        // this.nav.showOne("debug4");

        // DEBUG INIT
        await debug.init();
        await this.debug2View.init();
        await this.debug3View.init();
        await this.debug4View.init();

        // Global event for keydown.
        document.body.onkeydown = (e)=>{ 
            // For debug4View: 
            if(app.nav.DOM.debug4.view.classList.contains("active")){
                app.debug4View.goToAdjacentPage(e.key);
            }
        }
    },

    debug2View: {
        // Holds the DOM for elements within this view.
        DOM: {
            // Action buttons.
            'rsyncUpdate_and_detectAndRecordChanges' : 'rsyncUpdate_and_detectAndRecordChanges',
            'display_needed_changes' : 'display_needed_changes',
            'needed_changes'         : 'needed_changes',
        },

        run_fullDownloadAndProcessing: async function(uuid, visibleName){
            let dataOptions = { 
                type:"json", method:"POST", 
                body: {
                    uuid: uuid,
                    filename: visibleName,
                }, 
            };
            let data = await net.send(`run_fullDownloadAndProcessing`, dataOptions, false);
            return data;
        },
        rsyncUpdate_and_detectAndRecordChanges: async function(){
            // Create the options and body data.
            let dataOptions = {
                type:"json", method:"POST",
                body: { },
            };
    
            let data = await net.send(`rsyncUpdate_and_detectAndRecordChanges`, dataOptions, 300000);

            // Detect errors.
            if(data.rsync.error || data.updates.error){
                let errorLines = [];

                // Get the stdOut and stdErr lines. 
                if(data.rsync.error.stdOutHist || data.rsync.error.stdErrHist){
                    if(data.rsync.error.stdOutHist){
                        errorLines.push(...data.rsync.error.stdOutHist.split("\n"));
                    }
                    if(data.rsync.error.stdErrHist){
                        errorLines.push(...data.rsync.error.stdErrHist.split("\n"));
                    }
                }
                else{
                    errorLines.push(data.rsync.error);
                }

                // Filter out any blank lines. 
                errorLines = errorLines.filter(d=>d.trim());

                // Display the errors.
                console.log("errorLines:", errorLines);
            }
            else{
                // Update rm_fs and reload the current file nav view.
                if(data.rsync.rm_fs){
                    // console.log("updating rm_fs");
                    // Update the local rm_fs with the copy sent by the server.
                    app.rm_fs = data.rsync.rm_fs;
                    
                    // Update the active file nav.
                    // console.log("updating current file view");
                    let activeCollection = document.querySelector(".crumb.activeCollection");
                    if(activeCollection){ activeCollection.click(); }
                }

                // If there are updates then display them.
                if(data.updates.updates){
                    // console.log("Displaying needed updates", data.updates.updatesAll.length);
                    this.display_needed_changes( data.updates.updatesAll );
                }
            }
        },
        display_needed_changes: async function(data=null){
            // console.log("Running real function. data:", data ? "provided" : "request");

            // Data can either be passed to or requested from this program. Was data specified?
            if(!data){
                let dataOptions = {
                    type:"json", method:"POST",
                    body: {},
                };
                data = await net.send(`getNeededChanges`, dataOptions, false);
            }

            // console.log("Data:", data);

            let frag = document.createDocumentFragment();
            // let totalTimeEstimate = 0;
            for(let i=0; i<data.length; i+=1){
                let timeEstimate = data[i].pageCount * 1.8;
                // totalTimeEstimate += timeEstimate;
                let pathOnly = app.getParentPath(data[i].uuid, "DocumentType");

                // Create the containers and the sub containers.
                let recDiv = document.createElement("div");
                recDiv.classList.add("neededUpdateDiv");
                recDiv.setAttribute("uuid", data[i].uuid);
                recDiv.setAttribute("title", `NAME: ${data[i].visibleName}\nUUID: ${data[i].uuid}`);
                recDiv.setAttribute("fileType", data[i].fileType);
                let recDiv_l1 = document.createElement("div");
                let recDiv_l2 = document.createElement("div");
                let recDiv_l3 = document.createElement("div");
                let recDiv_l4 = document.createElement("div");

                recDiv_l1.innerText = `[${data[i].fileType.toUpperCase()}]`;
                recDiv_l2.innerText = `NAME: ${data[i].visibleName}`;
                recDiv_l3.innerText = `PATH: ${pathOnly}`;
                recDiv_l4.innerText = `PAGES: ${data[i].pageCount} - Estimated Time: ${(timeEstimate).toFixed(2)} seconds`;
                recDiv_l4.style = `border-bottom:5px solid black;`;

                let convertButton = document.createElement("button");
                convertButton.innerText = "Convert!";
                convertButton.onclick = ()=>{ this.convert(recDiv, data[i]); };
                recDiv_l3.append(convertButton);

                recDiv.append(recDiv_l1, recDiv_l2, recDiv_l3, recDiv_l4);
                frag.append(recDiv);
            }

            this.DOM['needed_changes'].innerHTML = "";
            this.DOM['needed_changes'].append(frag);

            // console.log(`totalTimeEstimate: There are ${data.length} records to process.`);
            // console.log(`totalTimeEstimate: ${(totalTimeEstimate).toFixed(2)} seconds`);
            // console.log(`totalTimeEstimate: ${(totalTimeEstimate/60).toFixed(2)} minutes`);
            // console.log(`totalTimeEstimate: ${((totalTimeEstimate/60)/60).toFixed(2)} hours`);
        },

        history:[],
        convert: async function(recDiv, data, divCount=null){
            return new Promise( async (res,rej) => {
                // Check for missing or null arguments. 
                if(!recDiv || !data){
                    console.log("Missing arguments.");
                    rej("Missing arguments.");
                    return; 
                }
                // Do not allow more processing until this has finished processing.
                if(recDiv.classList.contains("processing")){ console.log("Already processing this one", data.visibleName); res(); return; }

                // Use a modified visible name for the output file. Strips out invalid filename characters.
                let modifiedVisibleName = data.visibleName.replace(/[/\\?%*:|"<>]/g, '-');

                // Request the processing.
                let ts = performance.now();
                recDiv.style['background-color'] = "yellow";
                recDiv.classList.add("processing");
                let resp = await this.run_fullDownloadAndProcessing(data.uuid, modifiedVisibleName);
                
                // Was the request successful? 
                if(resp === false){
                    recDiv.style['background-color'] = "red";
                    console.log("convert: there was an error.");
                    rej("convert: there was an error.");
                }
                // Successful?
                else{
                    // TODO: Check for returned errors.
                    //

                    // Add to the local history.
                    this.history.push(resp);

                    // "convertAll" output.(divCount will be set if using "convertAll".)
                    if(divCount != null){
                        console.log(`${divCount.i+1}/${divCount.len} FINISHED Convert for: NAME: "${data.visibleName}", PAGES: ${data.pageCount}, TIME: ${Math.round(performance.now() - ts)}`, resp);
                    }
                    // Normal output.
                    else{
                        console.log(`FINISHED Convert for: NAME: "${data.visibleName}", PAGES: ${data.pageCount}, TIME: ${Math.round(performance.now() - ts)}`, resp);
                    }

                    // Remove the div from the list since the file has been successfully processed.
                    recDiv.remove();

                    res();
                }
            });
        },
        convertAll: async function(fileType=null){
            let divs = this.DOM['needed_changes'].querySelectorAll(".neededUpdateDiv");
            console.log(`There are ${divs.length} records to process.`);
            for(let i=0; i<divs.length; i+=1){
                if(!divs[i]){ console.log("missing?"); continue; }

                let uuid        = divs[i].getAttribute("uuid");
                let data = app.rm_fs["DocumentType"].find(d=>d.uuid == uuid);

                if(divs[i].classList.contains("processing")){ console.log("Already processing this one", data.visibleName); continue; }
                await this.convert( divs[i], data, {i:i, len:divs.length} );
            }
            console.log("HISTORY:", this.history);
            console.log("DONE");

        },
        init: async function(){
            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }

            // ADD EVENT LISTENERS.

            // Rsync, update needsUpdate.json
            this.DOM['rsyncUpdate_and_detectAndRecordChanges'].addEventListener("click", ()=>{ this.rsyncUpdate_and_detectAndRecordChanges(); }, false);

            // Create the needed_changes table.
            this.DOM['display_needed_changes'].addEventListener("click", ()=>this.display_needed_changes(null), false);
        },
    },

    debug3View:{
        // Holds the DOM for elements within this view.
        DOM: {
            // Action buttons.
            'filelistDiv' : 'd3_filelist',
        },

        showDocument: async function(uuid){
            // Show the view.
            app.nav.showOne("debug4");

            // Load the document.
            app.debug4View.showDocument(uuid);
        },
        showCollection: function(parent){
            let entries = app.getEntriesInCollectionType(parent); 
            // console.log("hi from debug3View", entries.parentPathBreadcrumbs.map(d=>d));
            // console.log("hi from debug3View", entries);
            // console.log("hi from debug3View", entries.parentPathBreadcrumbs.fullVisiblePath);

            // {
            //     parentPathBreadcrumbs : app.getParentPathBreadcrumbs(parent),
            //     CollectionType        : collections,
            //     DocumentType          : documents,
            // }

            /* 
                Navigation display:
                Acts like "breadcrumbs".
                Any link here can be clicked to go to that collection.
                Starts at "My files", separated by ">", last link is bold.
             */

            /* 
                CollectionType display:
                Inline div/span.
                Contains a folder icon (black if populated, white if not populated.)
                Clicking on the div anywhere will call showCollection.
             */

            /* 
                DocumentType display:
                Containing div.
                Thumbnail div using the first page thumbnail synced from the device.
                Title div.
                Div containing pageCount, displayed, sync status.
                Clicking on the div anywhere will call showDocument.
             */

            let createPathBreadcrumbsContainer = (parentPathBreadcrumbs)=>{
                let outer = document.createElement("div");
                let frag = document.createDocumentFragment();

                // visibleNames and uuids should have the same length.
                let maxLen = parentPathBreadcrumbs.visibleNames.length;
                for(let i=0; i<parentPathBreadcrumbs.visibleNames.length; i+=1){
                    // Create the greater-than sign.
                    if(i!=0){
                        let gt = document.createElement("span");
                        gt.classList.add("gt_sign", "crumb");
                        gt.innerHTML = " > ";
                        frag.append(gt);
                    }
                    
                    // Create the crumb.
                    let crumb = document.createElement("span");
                    crumb.classList.add("crumb");

                    // Use different text and an extra class for the root.
                    if(parentPathBreadcrumbs.uuids[i] == ""){
                        crumb.classList.add("myfiles");
                        crumb.innerHTML = "My files";
                    }
                    // Use the visibleName.
                    else{
                        crumb.innerHTML = parentPathBreadcrumbs.visibleNames[i];
                    }

                    // Is this the last crumb? If so then add the "activeCollection" class.
                    if(i+1 == maxLen){
                        crumb.classList.add("activeCollection");
                    }

                    // Add click listener so that the user can click to navigate to the collection.
                    crumb.onclick = ()=>{ this.showCollection(parentPathBreadcrumbs.uuids[i]); }

                    frag.append(crumb);
                }

                outer.append(frag);
                return outer;
            };
            let createCollectionTypeContainer = (rec, isEmpty=false)=>{
                let collection = document.createElement("span"); 
                collection.classList.add("navFileIcon", "CollectionType");
                
                if(isEmpty){ collection.classList.add("empty"); }
                else       { collection.classList.add("full"); }

                collection.innerText = rec.visibleName;

                collection.onclick = ()=>{ this.showCollection(rec.uuid); }

                return collection;
            };
            let createDocumentTypeContainer = (rec)=>{
                // Create
                let div_outer     = document.createElement("div"); div_outer.classList.add("DocumentType_file_outer");
                let div_inner     = document.createElement("div"); div_inner.classList.add("DocumentType_file_inner");
                let div_thumb     = document.createElement("div"); div_thumb.classList.add("DocumentType_file_thumb");
                let div_title     = document.createElement("div"); div_title.classList.add("DocumentType_file_title");
                let div_info      = document.createElement("div"); div_info.classList.add("DocumentType_file_info");
                let div_pages     = document.createElement("div"); div_pages.classList.add("DocumentType_file_pages");
                let div_displayed = document.createElement("div"); div_displayed.classList.add("DocumentType_file_displayed");
                let div_sync      = document.createElement("div"); div_sync.classList.add("DocumentType_file_sync");

                // Append
                div_outer.append(div_inner);
                div_inner.append(div_thumb);
                div_inner.append(div_title);
                div_inner.append(div_info);
                div_info.append(div_pages);
                div_info.append(div_displayed);
                div_info.append(div_sync);

                // Set/configure.
                div_outer.onclick = ()=>{ this.showDocument(rec.uuid); }
                div_title.innerText = rec.visibleName;
                div_title.title = rec.visibleName;
                div_pages.innerText = `Pages: ${rec.pageCount}`;

                div_displayed.innerText = "DISPLAYED";
                if(rec.synced){ div_sync.classList.add("synced"); }
                else          { div_sync.classList.add("notSynced"); }
                div_sync.title = `Synced To RM Cloud: ${rec.synced}\nUpdated: ${rec.modified}`;

                div_thumb.style['background-image'] = `url("deviceThumbs/${rec.uuid}.thumbnails/${rec.pages[0]}.jpg")`;
                
                // Can use the .png from svgThumbs once it can be determined which is the newer file. 
                // It works now but I want whichever is the latest one for display.
                // div_thumb.style['background-image'] = `url("deviceSvg/${rec.uuid}/svgThumbs/${rec.pages[0]}.png")`;

                // Return.
                return div_outer;
            };
            let frag = document.createDocumentFragment();

            frag.append( createPathBreadcrumbsContainer( entries.parentPathBreadcrumbs ) );

            frag.append( document.createElement("br") );
            for(i=0; i<entries.CollectionType.length; i+=1){
                frag.append(createCollectionTypeContainer( entries.CollectionType[i] ));
            }
            frag.append( document.createElement("br") );
            for(i=0; i<entries.DocumentType.length; i+=1){
                frag.append(createDocumentTypeContainer( entries.DocumentType[i] ));
            }
            frag.append( document.createElement("br") );

            this.DOM['filelistDiv'].innerHTML = "";
            this.DOM['filelistDiv'].append(frag);
        },

        init: async function(){
            // display_needed_changes
            // needed_changes

            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }
            
            // this.showCollection("");
            this.showCollection("9bc9f1d7-eec4-46ee-9cda-0ac50ffdb7a2");

            // ADD EVENT LISTENERS.

            // let folders     = app.rm_fs.DocumentType  
            //     .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
            //     .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );

            // console.log( "Collections in <root>:", collections );
            // console.log( "Documents   in <root>:", folders );
        },
    },

    debug4View: {
        // Holds the DOM for elements within this view.
        DOM: {
            // Action buttons.
            'thumbs'      : 'openedDoc_thumbs',
            'dispPages'   : 'openedDoc_dispPages',
        },
        pages: [],

        // Create a thumb image using the device's .jpg thumb or this program's .png thumb. Whichever is newer.
        createThumb: async function(uuid, thumbFile, pageNum){
            let div = document.createElement("div");
            div.classList.add("openedDoc_thumb");
            
            // Do not try to load the thumbnail if the pageId is in the pages.missing array.
            let pageId = this.pages.output[pageNum].pageId;
            let isMissing = this.pages.missing.find(d=>d==pageId);
            if(!isMissing){
                // Use the svgThumb png file if it is newer.
                if(this.pages.output[pageNum].newerThumb == "svgThumb"){
                    div.style['background-image'] = `url("deviceSvg/${uuid}/svgThumbs/${this.pages.output[pageNum].svgThumb}?")`; 
                }
                // The .jpg thumb is newer.
                else{
                    div.style['background-image'] = `url("deviceThumbs/${uuid}.thumbnails/${thumbFile}?")`;
                }
            }
            else{
                if(this.pages.output[pageNum].newerThumb == "svgThumb"){
                    div.style['background-image'] = `url("deviceSvg/${uuid}/svgThumbs/${this.pages.output[pageNum].svgThumb}?")`; 
                }
                else{
                    // console.log(`The thumb is missing for "${pageId}"`);
                }
            }

            div.title = `Page: ${pageNum+1}\nPageId: ${this.pages.output[pageNum].pageId}\nTHUMB: ${this.pages.output[pageNum].newerThumb}`;
            div.onclick = async ()=>{ 
                if(this.pages.output[pageNum].svg)  { await this.updatePage(uuid, pageNum, "svg"); }
                else if(this.pages.output[pageNum].thumb){ await this.updatePage(uuid, pageNum, "thumb"); }
                else{
                    console.log("ERROR: This page does not appear to be in the pages list."); 
                }
            };
            div.setAttribute("index", pageNum);
            
            let div2 = document.createElement("div");
            div2.innerText = `Page: ${pageNum+1}`;
            div.append(div2);

            return div;
        },
        
        // Create a page image using the device's .jpg thumb or this program's .svg. Whichever is newer.
        updatePage: async function(uuid, pageNum){
            let div = document.createElement("div");
            div.classList.add("openedDoc_page");

            let newer = this.pages.output[pageNum].newer;
            if(newer == "svg"){
                div.style['background-image'] = `url("deviceSvg/${uuid}/svg/${this.pages.output[pageNum].svg}?")`; 
            }
            else if(newer == "thumb"){
                div.style['background-image'] = `url("deviceThumbs/${uuid}.thumbnails/${this.pages.output[pageNum].thumb}?")`; 
            }
            else{
                // Missing file.
                console.log(`The page files (both) are missing for: "${this.pages.output[pageNum].pageId}" newer: ${newer}`, this.pages.output[pageNum]);
            }

            let thumbDivs = document.querySelectorAll(".openedDoc_thumb");
            let thisThumbDiv;
            thumbDivs.forEach(d=>{ 
                d.classList.remove("active"); 
                if(d.getAttribute("index") == pageNum){
                    thisThumbDiv = d;
                }
            });
            thisThumbDiv.classList.add("active");

            this.DOM['dispPages'].innerHTML = "";
            this.DOM['dispPages'].append(div);
        },
        
        //
        showDocument: async function(uuid){
            this.pages = await app.getAvailablePages(uuid);
            console.log(`showDocument: uuid: ${uuid}, pages:`, this.pages);

            //
            let thumbs_frag = document.createDocumentFragment();
            for(let i=0; i<this.pages.output.length; i+=1){
                thumbs_frag.append( await this.createThumb(uuid, this.pages.output[i].thumb, i) );
            }

            // Clear the thumbs and the displayed pages.
            this.DOM['thumbs'].innerHTML = "";
            this.DOM['dispPages'].innerHTML = "";

            // Add the frag for the thumbs.
            this.DOM['thumbs'].append(thumbs_frag);

            // Display the first page.
            let dispPages_frag = document.createDocumentFragment();
            // if     (this.pages.output[0].svg || this.pages.output[0].thumb)  { dispPages_frag.append( await this.updatePage(uuid, 0)   ); }
            if     (this.pages.output[0].svg || this.pages.output[0].thumb)  { await this.updatePage(uuid, 0); }
            // if     (this.pages.output[0].svg)  { dispPages_frag.append( this.updatePage(uuid, 0  , "svg")   ); }
            // else if(this.pages.output[0].thumb){ dispPages_frag.append( this.updatePage(uuid, 0, "thumb") ); }
            else{
                console.log("ERROR: This page does not appear to be in the pages list."); 
            }

            // Add the frag for the first page.
            this.DOM['dispPages'].append(dispPages_frag);
            
            // Show the view.
            app.nav.showOne("debug4");
        },
        
        //
        goToAdjacentPage: function(key){
            // Which page is displayed? Look to the thumbnails. 

            // Get all the thumbnail divs.
            let thumbs = document.querySelectorAll(".openedDoc_thumb");

            // Get the total number of thumbnail divs. 
            let numThumbs = thumbs.length;

            // Determine the active thumbnail in the list of thumbnails. 
            let activeThumb = false;
            let activeThumbIndex = false;
            for(let i=0; i<thumbs.length; i+=1){
                // Is this thumbnail active? 
                if(thumbs[i].classList.contains("active")){
                    // Set the active thumb and the activeThumbIndex and break;
                    activeThumb = thumbs[i];
                    activeThumbIndex = i;
                    break;
                }
            }

            // Did we find the activeThumb?
            if(activeThumb){
                // Set the scrolling options. 
                let options = {behavior: "auto", block: "nearest", inline: "center"};

                // Load the next page and scroll the thumbnail view. (Do bounds-checking also.)
                if(["ArrowLeft", "ArrowRight"].indexOf(key) != -1){
                    if     (key == "ArrowLeft" && activeThumbIndex != 0){
                        activeThumbIndex -= 1;
                        thumbs[activeThumbIndex].click();
                        thumbs[activeThumbIndex].scrollIntoView(options);
                    }
                    else if(key == "ArrowRight" && activeThumbIndex != numThumbs-1){
                        activeThumbIndex += 1;
                        thumbs[activeThumbIndex].click();
                        thumbs[activeThumbIndex].scrollIntoView(options);
                    }
                }
            }
        },

        init: async function(){
            // display_needed_changes
            // needed_changes

            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }

        },
    },
};

(
    function(){
        let handler = async () => {
            // Remove this listener.
            window.removeEventListener('load', handler);

            app.init();
        };
        window.addEventListener('load', handler);
    }
)();