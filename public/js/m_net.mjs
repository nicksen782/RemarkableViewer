let app = null;
let modName = null;
let moduleLoaded = false;

var net = {
    isModuleLoaded: function(){ return moduleLoaded; },
    module_init: async function(parent, name){
        return new Promise(async (resolve,reject)=>{
            if(!moduleLoaded){
                // Save reference to the parent module.
                app = parent;

                // Save module name.
                modName = name;

                // Set the moduleLoaded flag.
                moduleLoaded = true;
                
                resolve();
            }
            else{
                resolve();
            }
        });
    },

    // DONE. Can use either "GET" or "POST" and type of either "json" or "text".
    // timeoutMs is for when the request should abort if it takes took long. Sending a falsey value will disable this feature.
    // let resp = await net.send2("/test/getOne", "json", "POST", { key: 'endpointid', value: 1 });
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

export default net;
