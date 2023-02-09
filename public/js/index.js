var debug = {
    // DONE. Can use either "GET" or "POST" and type of either "json" or "text".
    // timeoutMs is for when the request should abort if it takes took long. Sending a falsey value will disable this feature.
    // let resp = await this.send2("/promo_push/test/getOne", "json", "POST", { key: 'pushEndpointid', value: 1 });
    // let data = await this.send(`${serverUrl}`, dataOptions, 45000);
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

    get_rm_fsFile: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { },
        };

        let data = await this.send(`get_rm_fsFile`, dataOptions, false);
        app.rm_fs = data;
        app.rm_fs_uuids = Object.keys(data);
        console.log(data);

        let collections = app.rm_fs.CollectionType
            .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
            .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );

        let folders     = app.rm_fs.DocumentType  
            .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
            .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );

        console.log( "Collections in <root>:", collections );
        console.log( "Documents   in <root>:", folders );
    },
    rsyncUpdate: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { },
        };

        let data = await this.send(`rsyncUpdate`, dataOptions, false);
        console.log(data);
    },
    detectAndRecordChanges: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { },
        };

        let data = await this.send(`detectAndRecordChanges`, dataOptions, 300000);
        console.log(data);
    },

    pdf2svg_test1: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"f061597e-d6f2-4b8d-a747-15f8cfd29c75",
                filename:"2023 02 February Work Notes.pdf",
            }, 
        };
        let data = await this.send(`pdf2svg`, dataOptions, false);
        console.log(data);
    },
    pdf2svg_test2: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"97538bbb-e782-4f17-b6a4-75ee3600669c",
                filename:"2023 01 January Work Notes.pdf",
            }, 
        };
        let data = await this.send(`pdf2svg`, dataOptions, false);
        console.log(data);
    },
    pdf2svg_test3: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"b9f01279-3a76-4a4c-a319-8b9e8673c92e",
                filename:"New Sync Method.pdf",
            }, 
        };
        let data = await this.send(`pdf2svg`, dataOptions, false);
        console.log(data);
    },
    svgo_test1: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"f061597e-d6f2-4b8d-a747-15f8cfd29c75",
                filename:"2023 02 February Work Notes.pdf",
            }, 
        };
        let data = await this.send(`svgo`, dataOptions, false);
        console.log(data);
    },
    svgo_test2: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"97538bbb-e782-4f17-b6a4-75ee3600669c",
                filename:"2023 01 January Work Notes.pdf",
            }, 
        };
        let data = await this.send(`svgo`, dataOptions, false);
        console.log(data);
    },
    svgo_test3: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"b9f01279-3a76-4a4c-a319-8b9e8673c92e",
                filename:"New Sync Method.pdf",
            }, 
        };
        let data = await this.send(`svgo`, dataOptions, false);
        console.log(data);
    },

    both_test1: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"f061597e-d6f2-4b8d-a747-15f8cfd29c75",
                filename:"2023 02 February Work Notes.pdf",
            }, 
        };
        let data = await this.send(`run_pdf2svg_and_svgo`, dataOptions, false);
        console.log(data);
    },

    both_test2: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"97538bbb-e782-4f17-b6a4-75ee3600669c",
                filename:"2023 01 January Work Notes.pdf",
            }, 
        };
        let data = await this.send(`run_pdf2svg_and_svgo`, dataOptions, false);
        console.log(data);
    },

    both_test3: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"b9f01279-3a76-4a4c-a319-8b9e8673c92e",
                filename:"New Sync Method.pdf",
            }, 
        };
        let data = await this.send(`run_pdf2svg_and_svgo`, dataOptions, false);
        console.log(data);
    },

    both2_test1: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"f061597e-d6f2-4b8d-a747-15f8cfd29c75",
                filename:"2023 02 February Work Notes.pdf",
            }, 
        };
        let data = await this.send(`run_pdf2svg_and_svgo2`, dataOptions, false);
        console.log(data);
    },

    both2_test2: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"97538bbb-e782-4f17-b6a4-75ee3600669c",
                filename:"2023 01 January Work Notes.pdf",
            }, 
        };
        let data = await this.send(`run_pdf2svg_and_svgo2`, dataOptions, false);
        console.log(data);
    },

    both2_test3: async function(){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid:"b9f01279-3a76-4a4c-a319-8b9e8673c92e",
                filename:"New Sync Method.pdf",
            }, 
        };
        let data = await this.send(`run_pdf2svg_and_svgo2`, dataOptions, false);
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

        let data = await this.send(`getData2`, dataOptions, 300000);
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

        let data = await this.send(`getData3`, dataOptions, 300000);
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

        let data = await this.send(`getData4`, dataOptions, 300000);
        console.log(data);
    },

    init: async function(){
        await this.get_rm_fsFile();
        
        document.getElementById('rsyncUpdate').addEventListener("click", ()=>{ this.rsyncUpdate(); }, false);
        document.getElementById('detectAndRecordChanges').addEventListener("click", ()=>{ this.detectAndRecordChanges(); }, false);
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

var app = {
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
    // debug1View:{},
    // debug2View:{},

    init: async function(){

        // NAV INIT
        this.nav.init();
        this.nav.showOne("debug1");
        // this.nav.showOne("debug2");

        // DEBUG INIT
        // await this.debug1View.init();
        // await this.debug2View.init();
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