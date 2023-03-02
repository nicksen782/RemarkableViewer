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
    getServerUrl: function(){
        // EX: net.getServerUrl()
        return `` +
            `${window.location.protocol == "https:" ? "https" : "http"}://` +
            `${location.hostname}` +
            `${location.port ? ':'+location.port : ''}`
        ;
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
                'tab':'navbar_fileNav_button',
                'view':'navbar_fileNav_view',
            },
            'debug4': {
                'tab':'navbar_debug4_button',
                'view':'navbar_debug4_view',
            },
            'debug5': {
                'tab':'navbar_debug5_button',
                'view':'navbar_debug5_view',
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

            // Init the sidebar menu. 
            // NOTE: Expects "#LO1_menu_button", "#LO1_sidebar", and ".LO1_sidebar_icon span" to be valid selectors.
            LO1.init();

            // if(document.querySelectorAll(".LO1_header").length){
            //     console.log("yup!");
            // }
            // else{
            //     console.log("NOPE!");
            // }
        },

    },

    init: async function(){
        await this.get_rm_fsFile();

        // NAV INIT
        this.nav.init();
        // this.nav.showOne("debug1");
        // this.nav.showOne("debug2");
        // this.nav.showOne("debug3");
        // this.nav.showOne("debug4");
        this.nav.showOne("debug5");

        // DEBUG INIT
        await debug.init();
        await this.debug2View.init();
        await this.debug3View.init();
        await this.debug4View.init();

        await app.debug5View.showDocument("b9f01279-3a76-4a4c-a319-8b9e8673c92e");

        // Global event for keydown.
        document.body.onkeydown = (e)=>{ 
            // For debug4View: 
            if(app.nav.DOM.debug4.view.classList.contains("active")){
                app.debug4View.goToAdjacentPage(e.key);
            }
        }

        // Global event for window.resize.
        window.onresize = (e)=>{ 
            // For debug4View: 
            if(app.nav.DOM.debug5.view.classList.contains("active")){
                app.debug5View.resizeDispPages(e);
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
        runProcessing: async function(uuid, visibleName){
            let dataOptions = { 
                type:"json", method:"POST", 
                body: {
                    uuid: uuid,
                    filename: visibleName,
                }, 
            };
            let data = await net.send(`processing.run`, dataOptions, false);
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

            // convert all button.
            if(data.length){
                let convertAllButton = document.createElement("button");
                convertAllButton.innerText = "Convert All";
                convertAllButton.onclick = ()=>{ this.convertAll(); };
                this.DOM['needed_changes'].append(convertAllButton);
            }

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
                // let modifiedVisibleName = data.visibleName.replace(/[/\\?%*:|"<>]/g, '-');

                // Request the processing.
                let ts = performance.now();
                recDiv.style['background-color'] = "yellow";
                recDiv.classList.add("processing");
                // let resp = await this.runProcessing(data.uuid, modifiedVisibleName);
                let resp = await this.runProcessing(data.uuid, data.visibleName);
                
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
            
            // Load the document.
            await app.debug4View.showDocument(uuid);
            await app.debug5View.showDocument(uuid);

            // Show the view.
            app.nav.showOne("debug4");
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

                // OLD WAY
                // div_thumb.style['background-image'] = `url("deviceThumbs/${rec.uuid}.thumbnails/${rec.pages[0]}.jpg")`;
                
                // NEW WAY
                div_thumb.style['background-image'] = `url("getThumb/${rec.uuid}/${rec.pages[0]}")`;
                
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

        // Get the url for a page/thumb based on uuid, pageId, and type.
        generateImageUrl : function(uuid, pageId, type){
            let url = "";
            if(type == "page_svg")       { url = `deviceSvg/${uuid}/svg/${pageId}.svg`; }
            else if(type == "page_jpg")  { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
            else if(type == "thumb_png") { url = `deviceSvg/${uuid}/svgThumbs/${pageId}.png`; }
            else if(type == "thumb_jpg") { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
            return url;
        },

        // Create a thumb image using the device's .jpg thumb or this program's .png thumb. Whichever is newer.
        createThumb: async function(uuid, thumbFile, pageNum){
            // 
            let page      = this.pages.output[pageNum];
            let pageId    = page.pageId;
            let newerType = this.pages.output[pageNum].newerThumb;

            // let div = document.createElement("div");
            let div = document.createElement("img");
            div.setAttribute("loading", "lazy");
            div.classList.add("openedDoc_thumb");
            div.title = `Page: ${pageNum+1}\nPageId: ${pageId}\nTHUMB: ${newerType}`;

            // Use the newer thumb image for the thumb.
            if     (newerType == "svgThumb"){ div.setAttribute("src", `${this.generateImageUrl(uuid, pageId, "thumb_png")}`); }
            else if(newerType == "thumb"   ){ div.setAttribute("src", `${this.generateImageUrl(uuid, pageId, "thumb_jpg")}`); }
            else{ console.log(`Both the "thumb" and the "svgThumb" are missing for "${pageId}" newer: ${newerType}`, page); }

            // Add click event listener so that the page can be changed when it's thumbnail is clicked.
            div.onclick = ()=>{ this.updatePage(uuid, pageNum); };

            // The index is used to filter thumbs when changing the page.
            div.setAttribute("index", pageNum);
            
            // Return the completed div.
            return div;
        },
        
        // Create a page image using the device's .jpg thumb or this program's .svg. Whichever is newer.
        updatePage: async function(uuid, pageNum){
            //
            let page      = this.pages.output[pageNum];
            let pageId    = this.pages.output[pageNum].pageId;
            let newerType = this.pages.output[pageNum].newer;

            let div = document.createElement("div");
            div.classList.add("openedDoc_page");

            // Use the newer thumb image for the thumb.
            if     (newerType == "svg"   ){ div.style['background-image'] = `url("${this.generateImageUrl(uuid, pageId, "page_svg")}?")`;  }
            else if(newerType == "thumbs"){ div.style['background-image'] = `url("${this.generateImageUrl(uuid, pageId, "page_jpg")}?")`;  }
            else{ console.log(`Both the "thumb" and the "svg" are missing for: "${pageId}" newer: ${newerType}`, page); }

            // Go through the thumbnails and deactivate all. Also collect the the one for the current page.
            let thumbDivs = document.querySelectorAll(".openedDoc_thumb");
            let thisThumbDiv;
            thumbDivs.forEach(d=>{ 
                d.classList.remove("active"); 
                if(d.getAttribute("index") == pageNum){
                    thisThumbDiv = d;
                }
            });

            // Add active for the current page's thumbnail. 
            thisThumbDiv.classList.add("active");

            // Update the thumbnail data.
            this.DOM['dispPages'].innerHTML = "";
            this.DOM['dispPages'].append(div);
        },
        
        // Show the specified document.
        showDocument: async function(uuid){
            // Get the pages data for this document.
            this.pages = await app.getAvailablePages(uuid);

            // Clear existing thumbnails, generate new ones and add them.
            let thumbs_frag = document.createDocumentFragment();
            for(let i=0; i<this.pages.output.length; i+=1){
                thumbs_frag.append( await this.createThumb(uuid, this.pages.output[i].thumb, i) );
            }
            this.DOM['thumbs'].innerHTML = "";
            this.DOM['thumbs'].append(thumbs_frag);

            // Clear the page placeholder and show the first page.
            this.DOM['dispPages'].innerHTML = "";
            if(this.pages.output.length){ await this.updatePage(uuid, 0); }
            else{ console.log("ERROR: This document does not appear to have a first page.");  }
        },
        
        // Event listener to handle changing the displayed page based on using the keyboard arrow keys. 
        goToAdjacentPage: function(key){
            // Loads the next page and scrolls the thumbnail view. (Does bounds-checking also.)
            
            // Was a matching key pressed?
            if(["ArrowLeft", "ArrowRight"].indexOf(key) != -1){
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
    debug5View: {
        // Holds the DOM for elements within this view.
        DOM: {
        //     // Action buttons.
        //     'thumbs'      : 'openedDoc_thumbs',
        //     'dispPages'   : 'openedDoc_dispPages',
        },
        uuid: "",
        pages: [],
        metadata: [],

        init: async function(){
            // display_needed_changes
            // needed_changes

            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }
        },

        resizeDispPages: function(e){
            return;
            // console.log("resizeDispPages:", e, e.eventPhase, e.returnValue);
            // console.log("test1", e.target.innerWidth, e.target.innerHeight, window.innerWidth, window.innerHeight);

            let viewContainer2 = document.querySelector("#viewContainer2");
            let viewContainer2_thumbs = document.querySelector("#viewContainer2_thumbs");
            let viewContainer2_divider = document.querySelector("#viewContainer2_divider");

            let containerDims = viewContainer2.getBoundingClientRect();
            let thumbsDims    = viewContainer2_thumbs.getBoundingClientRect();
            let dividerDims   = viewContainer2_divider.getBoundingClientRect();

            
            let pagesWidth = (containerDims.width - thumbsDims.width - dividerDims.width)/2;
            pagesWidth  = 2 * Math.floor(pagesWidth  / 2) - 160;
            
            let viewContainer2_leftPage  = document.getElementById("viewContainer2_leftPage");
            let viewContainer2_rightPage = document.getElementById("viewContainer2_rightPage");

            viewContainer2_leftPage.style.width = `${pagesWidth}px`; 
            viewContainer2_rightPage.style.width = `${pagesWidth}px`;

            // viewContainer2_leftPage.style.height = `${pagesWidth}px`; 
            // viewContainer2_rightPage.style.height = `${pagesWidth}px`;

            console.log(pagesWidth);
        },

        generateImageUrl : function(uuid, pageId, type){
            let url = "";
            if(type == "page_svg")       { url = `deviceSvg/${uuid}/svg/${pageId}.svg`; }
            else if(type == "page_jpg")  { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
            else if(type == "thumb_png") { url = `deviceSvg/${uuid}/svgThumbs/${pageId}.png`; }
            else if(type == "thumb_jpg") { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
            return url;
        },
        getAspectRatio: function(w,h, gcfOnly=false){
            let greatestCommonFactor;
            
            // Get the greatest common factor.
            if(h==0){ greatestCommonFactor = w; }
            else    { greatestCommonFactor = this.getAspectRatio (h, w % h, true); }
            
            // Only return the gcf?
            if(gcfOnly){ return greatestCommonFactor; }

            // Normal return.
            return {
                gcf   : greatestCommonFactor,
                // dims  : {w:w, h:h},
                // aspect: `${w/greatestCommonFactor}:${h/greatestCommonFactor}`,
                rw   : w/greatestCommonFactor,
                rh   : h/greatestCommonFactor,
            };
        },
        showDocument: async function(uuid){
            return;
            // Get/store values for later use.
            this.uuid = uuid;
            this.pages = await app.getAvailablePages(uuid);
            this.metadata = app.rm_fs.DocumentType.find(d=>d.uuid == uuid);
            this.pdfFile = net.getServerUrl() + `/deviceSvg/${uuid}/${encodeURIComponent(this.pages.pdfFile)}?`;
            
            let page1svg = this.generateImageUrl(uuid, this.pages.output[4].pageId, "page_svg");
            let page2svg = this.generateImageUrl(uuid, this.pages.output[5].pageId, "page_svg");
            let page1png = this.generateImageUrl(uuid, this.pages.output[4].pageId, "thumb_png");
            let page2png = this.generateImageUrl(uuid, this.pages.output[5].pageId, "thumb_png");
            let page3png = this.generateImageUrl(uuid, this.pages.output[6].pageId, "thumb_png");
            let page4png = this.generateImageUrl(uuid, this.pages.output[7].pageId, "thumb_png");

            document.querySelector("#viewContainer2_thumbs img:nth-child(1)").src = page1png;
            document.querySelector("#viewContainer2_thumbs img:nth-child(2)").src = page2png;
            document.querySelector("#viewContainer2_thumbs img:nth-child(3)").src = page3png;
            document.querySelector("#viewContainer2_thumbs img:nth-child(4)").src = page4png;

            // let viewContainer2_thumbs = document.querySelector("#viewContainer2_thumbs");
            // let dims2 = viewContainer2_thumbs.getBoundingClientRect();
            // let viewContainer2_divider = document.querySelector("#viewContainer2_divider");
            // let dims3 = viewContainer2_divider.getBoundingClientRect();

            // --sidebar-closed-width

            let data = [
                { img:null, uuid:uuid, pageId:this.pages.output[4].pageId, type:"page_svg", side:"left" },
                { img:null, uuid:uuid, pageId:this.pages.output[5].pageId, type:"page_svg", side:"right" },
            ];
            let proms = [];
            for(let i=0; i<data.length; i+=1){
                data[i].img = new Image();
                proms.push( new Promise(async (res,rej)=>{ data[i].img.onload = ()=>{ 
                    // data[i].img.width  = 2 * Math.ceil(data[i].img.width  / 2);
                    // data[i].img.height = 2 * Math.ceil(data[i].img.height / 2);
                    res(); 
                } }) );
                data[i].img.src = net.getServerUrl() + "/" + this.generateImageUrl(data[i].uuid, data[i].pageId, data[i].type);
            }
            await Promise.all(proms);
            // console.log(data);
            // let viewContainer2 = document.querySelector("#viewContainer2");
            // let viewContainer2_thumbs = document.querySelector("#viewContainer2_thumbs");
            // let viewContainer2_divider = document.querySelector("#viewContainer2_divider");
            // let dims1 = viewContainer2.getBoundingClientRect();
            // let dims2 = viewContainer2_thumbs.getBoundingClientRect();
            // let dims3 = viewContainer2_divider.getBoundingClientRect();
            let leftPage = document.querySelector("#viewContainer2_leftPage");
            let rightPage = document.querySelector("#viewContainer2_rightPage");
            leftPage .innerHTML = ""; 
            rightPage.innerHTML = "";
            leftPage .append(data[0].img); 
            rightPage.append(data[1].img);

            // setTimeout(()=>{
                // this.resizeDispPages();
            // }, 2000)
            // console.log("debug5view:");
            // console.log("  Requested document uuid:", this.uuid);
            // console.log("  Requested document pages:", this.pages);
            // console.log("  Requested document metadata:", this.metadata);
            // console.log(`  There are "${this.metadata.pageCount}" pages in "${this.metadata.visibleName}"`);
            // console.log("  Link to the pdf:",  this.pdfFile); 
            // console.log("viewContainer2        :", dims1.width, dims1.height);
            // console.log("viewContainer2_thumbs :", dims2.width, dims2.height);
            // console.log("viewContainer2_divider:", dims3.width, dims3.height);
            // console.log("Container width:", dims1.width);
            // console.log("Available width:", dims1.width - dims2.width - dims3.width);
            // console.log("per page width:", (dims1.width - dims2.width - dims3.width)/2);
            // console.log("per page height:", (dims1.height - dims2.height - dims3.height)/1);

            // console.log(this.getAspectRatio(data[0].img.width, data[0].img.height));
            
            // return; 

            // let img1 = new Image();
            // let img2 = new Image();
            // // img1.setAttribute("loading", "lazy");
            // // img2.setAttribute("loading", "lazy");
            // img1.src = net.getServerUrl() + "/" + page1svg;
            // img2.src = net.getServerUrl() + "/" + page2svg;
            // proms.push( new Promise(async (res,rej)=>{ img1.onload = ()=>{ res(); } }) );
            // proms.push( new Promise(async (res,rej)=>{ img2.onload = ()=>{ res(); } }) );
            // console.log("now we wait.", proms, img1.src, img2.src);
            // console.log(img1.src);
            // console.log(img2.src);
            // await Promise.all(proms);
            // console.log("DONE WAITING.");

            // let viewContainer2 = document.querySelector("#viewContainer2");

            // INCONSISTENT
            // All notebook svg output appears to be 593 by 792.
            // pdf: 816 1056
            // 794 1123

            // console.log(window.getComputedStyle(viewContainer2));
            // console.log(viewContainer2.getBoundingClientRect());

            // let leftPage = document.querySelector("#viewContainer2_leftPage");
            // let rightPage = document.querySelector("#viewContainer2_rightPage");

            // leftPage .innerHTML = ""; 
            // rightPage.innerHTML = "";
            // leftPage .append(img1); 
            // rightPage.append(img2);

            // let leftPage_img = document.querySelector("#viewContainer2_leftPage img");
            // let rightPage_img = document.querySelector("#viewContainer2_rightPage img");

            // document.querySelector("#viewContainer2_thumbs img:nth-child(1)").src = page1png;
            // document.querySelector("#viewContainer2_thumbs img:nth-child(2)").src = page2png;
            // document.querySelector("#viewContainer2_thumbs img:nth-child(3)").src = page3png;
            // document.querySelector("#viewContainer2_thumbs img:nth-child(4)").src = page4png;

            // return;

            // console.log("page1svg:", page1svg);
            // console.log("page2svg:", page2svg);
            // console.log("page1png:", page1png);
            // console.log("page2png:", page2png);
            // console.log("page3png:", page3png);
            // console.log("page4png:", page4png);
            // return;

            // TEMP DATA FOR LOAD.
            // document.querySelector("#viewContainer1_dispPages_l img").src = page1svg;
            // document.querySelector("#viewContainer1_dispPages_r img").src = page2svg;
            // document.querySelector("#viewContainer1_thumbs img:nth-child(1)").src = page1png;
            // document.querySelector("#viewContainer1_thumbs img:nth-child(2)").src = page2png;

            // console.log("debug5view:");
            // console.log("  Requested document uuid:", this.uuid);
            // console.log("  Requested document pages:", this.pages);
            // console.log("  Requested document metadata:", this.metadata);
            // console.log(`  There are "${this.metadata.pageCount}" pages in "${this.metadata.visibleName}"`);
            // console.log("  Link to the pdf:",  this.pdfFile); 

            //
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