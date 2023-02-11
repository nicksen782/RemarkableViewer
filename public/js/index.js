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
        app.rm_fs = data;
        console.log("app.rm_fs      :", app.rm_fs);

        // let collections = app.rm_fs.CollectionType
        //     .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
        //     .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );

        // let folders     = app.rm_fs.DocumentType  
        //     .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
        //     .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );

        // console.log( "Collections in <root>:", collections );
        // console.log( "Documents   in <root>:", folders );
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
                    console.log("End at ''");
                    results.visibleNames.unshift("My files");
                    results.uuids.unshift("");
                    break;
                }
                // End at trash?
                else if(obj.parent == "trash"){
                    console.log("End at 'trash'");
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
    },

    debug2View: {
        // Holds the DOM for elements within this view.
        DOM: {
            // Action buttons.
            'rsyncUpdate_and_detectAndRecordChanges' : 'rsyncUpdate_and_detectAndRecordChanges',
            'display_needed_changes' : 'display_needed_changes',
            'needed_changes'         : 'needed_changes',
        },

        rsyncUpdate_and_detectAndRecordChanges: async function(){
            // Create the options and body data.
            let dataOptions = {
                type:"json", method:"POST",
                body: { },
            };
    
            let data = await net.send(`rsyncUpdate_and_detectAndRecordChanges`, dataOptions, 300000);
            console.log(data);
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
            // console.log(data);
            return data;
        },

        history:[],
        convert: async function(recDiv, data, divCount=null){
            return new Promise( async (res,rej) => {
                if(!recDiv || !data){
                    console.log("Missing arguments.");
                    rej("Missing arguments.");
                    return; 
                }
                if(recDiv.classList.contains("processing")){ console.log("Already processing this one", data.visibleName); res(); return; }

                let ts = performance.now();
                recDiv.style['background-color'] = "yellow";
                recDiv.classList.add("processing");
                let resp = await this.run_fullDownloadAndProcessing(data.uuid, data.visibleName.replace(/[/\\?%*:|"<>]/g, '-'));
                
                if(resp === false){
                    recDiv.style['background-color'] = "red";
                    console.log("convert: there was an error.");
                    rej("convert: there was an error.");
                }
                else{
                    this.history.push(resp);
                    if(divCount != null){
                        console.log(`${divCount.i+1}/${divCount.len} FINISHED Convert for: NAME: "${data.visibleName}", PAGES: ${data.pageCount}, TIME: ${Math.round(performance.now() - ts)}`, resp);
                    }
                    else{
                        console.log(`FINISHED Convert for: NAME: "${data.visibleName}", PAGES: ${data.pageCount}, TIME: ${Math.round(performance.now() - ts)}`, resp);
                    }

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
            this.DOM['display_needed_changes'].addEventListener("click", async () => {
                let dataOptions = {
                    type:"json", method:"POST",
                    body: {},
                };
                let data = await net.send(`getNeededChanges`, dataOptions, false);
                // console.log("getNeededChanges:", data);

                let frag = document.createDocumentFragment();
                let totalTimeEstimate = 0;
                for(let i=0; i<data.length; i+=1){
                    let timeEstimate = data[i].pageCount * 1.8;
                    totalTimeEstimate += timeEstimate;
                    let pathOnly = app.getParentPath(data[i].uuid, "DocumentType");
                    // console.log(pathOnly + data[i].visibleName);

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
                    convertButton.onclick = ()=>{
                        this.convert(recDiv, data[i]);
                    };
                    recDiv_l3.append(convertButton);

                    recDiv.append(recDiv_l1, recDiv_l2, recDiv_l3, recDiv_l4);
                    frag.append(recDiv);

                    // let collections = app.rm_fs.CollectionType
                    // .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
                    // .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );
        
                    // let folders     = app.rm_fs.DocumentType  
                    //     .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
                    //     .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );
            
                    // console.log( "Collections in <root>:", collections );
                    // console.log( "Documents   in <root>:", folders );
                }

                this.DOM['needed_changes'].innerHTML = "";
                this.DOM['needed_changes'].append(frag);

                console.log(`totalTimeEstimate: There are ${data.length} records to process.`);
                console.log(`totalTimeEstimate: ${(totalTimeEstimate).toFixed(2)} seconds`);
                console.log(`totalTimeEstimate: ${(totalTimeEstimate/60).toFixed(2)} minutes`);
                console.log(`totalTimeEstimate: ${((totalTimeEstimate/60)/60).toFixed(2)} hours`);

            }, false);
        },
    },

    debug3View:{
        // Holds the DOM for elements within this view.
        DOM: {
            // Action buttons.
            // 'display_needed_changes' : 'display_needed_changes',
            'filelistDiv'         : 'd3_filelist',
        },

        showDocument: function(uuid){
            console.log("showDocument:", uuid);
        },
        showCollection: function(parent){
            let entries = app.getEntriesInCollectionType(parent); 
            // console.log("hi from debug3View", entries.parentPathBreadcrumbs.map(d=>d));
            console.log("hi from debug3View", entries);
            console.log("hi from debug3View", entries.parentPathBreadcrumbs.fullVisiblePath);

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
                div_thumb.style['background-image'] = `url("deviceThumbs/${rec.uuid}.thumbnails/${rec.pages[0]}.jpg")`;

                // Return.
                return div_outer;
            };
            let frag = document.createDocumentFragment();

            frag.append( createPathBreadcrumbsContainer( entries.parentPathBreadcrumbs ) );

            frag.append( document.createElement("br") );
            for(i=0; i<entries.CollectionType.length; i+=1){
                // let rec = entries.CollectionType[i];
                // let div = document.createElement("div");
                // div.innerText = rec.visibleName;
                // div.title = `${rec.visibleName} (${rec.uuid})`;
                // div.onclick = ()=>{ this.showCollection(rec.uuid); }
                // frag.append(div);

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
            
            this.showCollection("");

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
            // 'rsyncUpdate_and_detectAndRecordChanges' : 'rsyncUpdate_and_detectAndRecordChanges',
            // 'display_needed_changes' : 'display_needed_changes',
            // 'needed_changes'         : 'needed_changes',
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