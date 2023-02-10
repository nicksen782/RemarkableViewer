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
    rsyncUpdate: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { },
        };

        let data = await net.send(`rsyncUpdate`, dataOptions, false);
        console.log(data);
    },
    detectAndRecordChanges: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { },
        };

        let data = await net.send(`detectAndRecordChanges`, dataOptions, 300000);
        console.log(data);
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

    pdf2svg_test1: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"f061597e-d6f2-4b8d-a747-15f8cfd29c75",
                filename:"2023 02 February Work Notes",
            }, 
        };
        let data = await net.send(`pdf2svg`, dataOptions, false);
        console.log(data);
    },
    pdf2svg_test2: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"97538bbb-e782-4f17-b6a4-75ee3600669c",
                filename:"2023 01 January Work Notes",
            }, 
        };
        let data = await net.send(`pdf2svg`, dataOptions, false);
        console.log(data);
    },
    pdf2svg_test3: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"b9f01279-3a76-4a4c-a319-8b9e8673c92e",
                filename:"New Sync Method",
            }, 
        };
        let data = await net.send(`pdf2svg`, dataOptions, false);
        console.log(data);
    },
    svgo_test1: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"f061597e-d6f2-4b8d-a747-15f8cfd29c75",
                filename:"2023 02 February Work Notes",
            }, 
        };
        let data = await net.send(`svgo`, dataOptions, false);
        console.log(data);
    },
    svgo_test2: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"97538bbb-e782-4f17-b6a4-75ee3600669c",
                filename:"2023 01 January Work Notes",
            }, 
        };
        let data = await net.send(`svgo`, dataOptions, false);
        console.log(data);
    },
    svgo_test3: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"b9f01279-3a76-4a4c-a319-8b9e8673c92e",
                filename:"New Sync Method",
            }, 
        };
        let data = await net.send(`svgo`, dataOptions, false);
        console.log(data);
    },

    both_test1: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"f061597e-d6f2-4b8d-a747-15f8cfd29c75",
                filename:"2023 02 February Work Notes",
            }, 
        };
        let data = await net.send(`run_pdf2svg_and_svgo`, dataOptions, false);
        console.log(data);
    },

    both_test2: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"97538bbb-e782-4f17-b6a4-75ee3600669c",
                filename:"2023 01 January Work Notes",
            }, 
        };
        let data = await net.send(`run_pdf2svg_and_svgo`, dataOptions, false);
        console.log(data);
    },

    both_test3: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"b9f01279-3a76-4a4c-a319-8b9e8673c92e",
                filename:"New Sync Method",
            }, 
        };
        let data = await net.send(`run_pdf2svg_and_svgo`, dataOptions, false);
        console.log(data);
    },

    both2_test1: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"f061597e-d6f2-4b8d-a747-15f8cfd29c75",
                filename:"2023 02 February Work Notes",
            }, 
        };
        let data = await net.send(`run_pdf2svg_and_svgo2`, dataOptions, false);
        console.log(data);
    },

    both2_test2: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"97538bbb-e782-4f17-b6a4-75ee3600669c",
                filename:"2023 01 January Work Notes",
            }, 
        };
        let data = await net.send(`run_pdf2svg_and_svgo2`, dataOptions, false);
        console.log(data);
    },

    both2_test3: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"b9f01279-3a76-4a4c-a319-8b9e8673c92e",
                filename:"New Sync Method",
            }, 
        };
        let data = await net.send(`run_pdf2svg_and_svgo2`, dataOptions, false);
        console.log(data);
    },

    // Get data files - style 2
    getData2: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: {
                'arg1': 'value1'
            },
        };

        let data = await net.send(`getData2`, dataOptions, 300000);
        console.log(data);
    },

    // Get data files - style 3
    getData3: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: {
                'arg1': 'value1'
            },
        };

        let data = await net.send(`getData3`, dataOptions, 300000);
        console.log(data);
    },

    // Get data files - style 4
    getData4: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: {
                "files": [
                ],
            },
        };

        let data = await net.send(`getData4`, dataOptions, 300000);
        console.log(data);
    },

    init: async function(){
        await this.get_rm_fsFile();
        
        document.getElementById('rsyncUpdate').addEventListener("click", ()=>{ this.rsyncUpdate(); }, false);
        document.getElementById('detectAndRecordChanges').addEventListener("click", ()=>{ this.detectAndRecordChanges(); }, false);
        document.getElementById('rsyncUpdate_and_detectAndRecordChanges').addEventListener("click", ()=>{ this.rsyncUpdate_and_detectAndRecordChanges(); }, false);
        
        document.getElementById('getData2').addEventListener("click", ()=>{ this.getData2(); }, false);
        document.getElementById('getData3').addEventListener("click", ()=>{ this.getData3(); }, false);
        document.getElementById('getData4').addEventListener("click", ()=>{ this.getData4(); }, false);
        
        document.getElementById('pdf2svg_test1').addEventListener("click", ()=>{ this.pdf2svg_test1(); }, false);
        document.getElementById('pdf2svg_test2').addEventListener("click", ()=>{ this.pdf2svg_test2(); }, false);
        document.getElementById('pdf2svg_test3').addEventListener("click", ()=>{ this.pdf2svg_test3(); }, false);
        document.getElementById('svgo_test1').addEventListener("click", ()=>{ this.svgo_test1(); }, false);
        document.getElementById('svgo_test2').addEventListener("click", ()=>{ this.svgo_test2(); }, false);
        document.getElementById('svgo_test3').addEventListener("click", ()=>{ this.svgo_test3(); }, false);

        document.getElementById('both_test1').addEventListener("click", ()=>{ this.both_test1(); }, false);
        document.getElementById('both_test2').addEventListener("click", ()=>{ this.both_test2(); }, false);
        document.getElementById('both_test3').addEventListener("click", ()=>{ this.both_test3(); }, false);

        document.getElementById('both2_test1').addEventListener("click", ()=>{ this.both2_test1(); }, false);
        document.getElementById('both2_test2').addEventListener("click", ()=>{ this.both2_test2(); }, false);
        document.getElementById('both2_test3').addEventListener("click", ()=>{ this.both2_test3(); }, false);
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
        // NAV INIT
        this.nav.init();
        // this.nav.showOne("debug1");
        this.nav.showOne("debug2");

        // DEBUG INIT
        // await this.debug1View.init();
        await this.debug2View.init();
        await this.debug3View.init();
    },

    debug2View: {
        // Holds the DOM for elements within this view.
        DOM: {
            // Action buttons.
            'display_needed_changes' : 'display_needed_changes',
            'needed_changes'         : 'needed_changes',
        },

        // Returns the full path for the given uuid and type.
        getParentPath: function(uuid, type, addVisibleNameToEnd=false){
            // USAGE:
            // this.getParentPath(uuid  , "DocumentType");
            // this.getParentPath(parent, "CollectionType");

            // Get a handle to the DocumentType or Collection type that the uuid is referring to.
            let file = app.rm_fs[type].find(d=>d.uuid == uuid);

            // fullPath will be added to this array. 
            let fullPath = [];

            // Flags for root and trash.
            let isAtRoot = false;
            let isAtTrash = false;

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
                // console.log(`FINISHED Convert for: NAME: ${data.visibleName}, UUID: ${data.uuid}. PAGES: ${data.pageCount}, TIME: ${performance.now() - ts}`);
                if(divCount != null){
                    console.log(`${divCount.i+1}/${divCount.len} FINISHED Convert for: NAME: "${data.visibleName}", PAGES: ${data.pageCount}, TIME: ${performance.now() - ts}`);
                }
                else{
                    console.log(`FINISHED Convert for: NAME: "${data.visibleName}", PAGES: ${data.pageCount}, TIME: ${performance.now() - ts}`);
                }
                
                if(resp == true){
                    recDiv.remove();
                    res();
                }
                else{
                    recDiv.style['background-color'] = "red";
                    console.log("convert: there was an error.");
                    rej("convert: there was an error.");
                }
            });
        },
        convertAll: async function(){
            let divs = this.DOM['needed_changes'].querySelectorAll(".neededUpdateDiv");
            console.log(`There are ${divs.length} records to process.`);
            for(let i=0; i<divs.length; i+=1){
                if(!divs[i]){ console.log("missing?"); continue; }

                let uuid        = divs[i].getAttribute("uuid");
                let data = app.rm_fs["DocumentType"].find(d=>d.uuid == uuid);

                if(divs[i].classList.contains("processing")){ console.log("Already processing this one", data.visibleName); continue; }
                await this.convert( divs[i], data, {i:i, len:divs.length} );
            }
            console.log("DONE");

        },
        init: async function(){
            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }

            // ADD EVENT LISTENERS.

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
                    let pathOnly = this.getParentPath(data[i].uuid, "DocumentType");
                    // console.log(pathOnly + data[i].visibleName);

                    // Create the containers and the sub containers.
                    let recDiv = document.createElement("div");
                    recDiv.classList.add("neededUpdateDiv");
                    recDiv.setAttribute("uuid", data[i].uuid);
                    recDiv.setAttribute("title", `NAME: ${data[i].visibleName}\nUUID: ${data[i].uuid}`);
                    let recDiv_l1 = document.createElement("div");
                    let recDiv_l2 = document.createElement("div");
                    let recDiv_l3 = document.createElement("div");
                    let recDiv_l4 = document.createElement("div");

                    recDiv_l1.innerText = `NAME: ${data[i].visibleName}`;
                    recDiv_l2.innerText = `PATH: ${pathOnly}`;
                    recDiv_l3.innerText = `PAGES: ${data[i].pageCount} - Estimated Time: ${(timeEstimate).toFixed(2)} seconds`;
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

            document.getElementById('both2_test3').addEventListener("click", ()=>{ this.both2_test3(); }, false);
        },
    },

    debug3View:{
        // Holds the DOM for elements within this view.
        DOM: {
            // Action buttons.
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

            // ADD EVENT LISTENERS.
        },
    },
};

(
    function(){
        let handler = async () => {
            // Remove this listener.
            window.removeEventListener('load', handler);

            debug.init();
            app.init();
        };
        window.addEventListener('load', handler);
    }
)();