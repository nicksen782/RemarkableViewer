let app = null;
let modName = null;
let moduleLoaded = false;

var syncConvert = {
    isModuleLoaded: function(){ return moduleLoaded; },
    module_init: async function(parent, name){
        return new Promise(async (resolve,reject)=>{
            if(!moduleLoaded){
                // Save reference to the parent module.
                app = parent;

                // Save module name.
                modName = name;

                await this.init();

                // Set the moduleLoaded flag.
                moduleLoaded = true;
                
                resolve();
            }
            else{
                resolve();
            }
        });
    },

    // Holds the DOM for elements within this view.
    DOM: {
        // Action buttons.
        'rsyncUpdate_and_detectAndRecordChanges' : 'rsyncUpdate_and_detectAndRecordChanges',
        'display_needed_changes' : 'display_needed_changes',
        'needed_changes'         : 'needed_changes',
        'sync_output'            : 'sync_output',
        'convert_output'         : 'convert_output',
    },
    history:[],
    init: async function(){
        await this.get_rm_fsFile();

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
    get_rm_fsFile: async function(){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { },
        };

        // Make the request. 
        let data = await app.m_net.send(`get_rm_fsFile`, dataOptions, false);

        // Save the data locally. (To the main module.)
        app.rm_fs     = data.rm_fs;
        app.rm_device = data.rm_device;
    },
    runProcessing: async function(uuid, visibleName){
        let dataOptions = { 
            type:"json", method:"POST", 
            body: {
                uuid: uuid,
                filename: visibleName,
            }, 
        };
        let data = await app.m_net.send(`processing.run`, dataOptions, false);
        return data;
    },
    rsyncUpdate_and_detectAndRecordChanges: async function(){
        // console.log("NEW: rsyncUpdate_and_detectAndRecordChanges");

        // Create an EventSource object to listen to SSE messages
        // console.log("Opening EventSource.")
        this.DOM['sync_output'].innerHTML = "";
        const eventSource = new EventSource('rsyncUpdate_and_detectAndRecordChanges');

        let isThisJson = function(text){
            try{ return JSON.parse(text); }
            catch(e){ return false; }
        };

        // Listen to SSE messages
        eventSource.onopen    = (event) => { 
            // console.log(`*OPEN`, event); 
        };
        eventSource.onclose   = (event) => { 
            // console.log(`*CLOSE`, event); 
            eventSource.close(); 
        };
        eventSource.onerror   = (event) => { console.log(`*ERROR`, event); eventSource.close(); };
        eventSource.onmessage = (event) => {
            // The data is expected to be JSON. It will have a key of "mode" and a key of "data".
            let json = isThisJson(event.data);
            if(!json){ console.log("NOT JSON", event.data); return;  }

            // Is the stream on-going?
            if(json.status == "active"){
                // console.log(`Received SSE message:`, json.status, json.data);
                let newText = "";
                if(Array.isArray(json.data)){
                    // console.log("json.data IS an array. Iterate through each entry.", json.data);
                    json.data.forEach(d=>{ 
                        if(typeof d == "string"){
                            // Is the string JSON?
                            let tmp = isThisJson(d);

                            // Yes?
                            if(tmp){ 
                                // console.log("JSON: ", tmp); 
                                let keys = Object.keys(tmp);
                                keys.forEach(k=>{
                                    let lines = tmp[k].split("\n");
                                    newText += `${k}: ` + "\n"; 
                                    lines.forEach(l=>{
                                        if(l){ newText += `  ` + l.trim() + "\n";  }
                                    });
                                });
                            }
                            // No, it is text.
                            else   { 
                                if(d){ 
                                    // console.log("TEXT: ", d); 
                                    newText += d + "\n"; 
                                }
                            }
                        }
                        // Unknown type.
                        else{
                            console.log("Invalid type:", typeof d, d);
                        }
                    });
                }
                else{
                    console.log("--------------- json.data is not an array.", json);
                }

                // Add the text to the display.
                this.DOM['sync_output'].innerHTML += newText ;

                // Scroll the text to the bottom.
                this.DOM['sync_output'].scrollTop = this.DOM['sync_output'].scrollHeight;

                // console.log("newText:", newText);
            }
            // Is the stream finished?
            else if(json.status == "finished"){
                // console.log("Data stream is finished. Closing EventSource.");
                eventSource.close();

                let data = json.data;

                // Detect errors.
                if(data.rsync.error || data.updates.error){
                    let errorLines = [];

                    // Get the stdOut and stdErr lines. 
                    if(data.rsync.error){
                        let tmp = isThisJson(data.rsync.error);
                        if(tmp.stdOutHist || tmp.stdErrHist){
                            if(tmp.cmd){ errorLines.push("CMD: " + tmp.cmd); }
                            if(tmp.stdOutHist){ errorLines.push(...tmp.stdOutHist.split("\n")); }
                            if(tmp.stdErrHist){ errorLines.push(...tmp.stdErrHist.split("\n")); }
                        }
                        else{
                            errorLines.push(data.rsync.error);
                        }
                    }

                    // Get the stdOut and stdErr lines. 
                    if(data.updates.error){
                        let tmp = isThisJson(data.updates.error);
                        if(tmp.stdOutHist || tmp.stdErrHist){
                            if(tmp.cmd){ errorLines.push("CMD: " + tmp.cmd); }
                            if(tmp.stdOutHist){ errorLines.push(...tmp.stdOutHist.split("\n")); }
                            if(tmp.stdErrHist){ errorLines.push(...tmp.stdErrHist.split("\n")); }
                        }
                        else{
                            errorLines.push(data.updates.error);
                        }
                    }

                    // Filter out any blank lines. 
                    errorLines = errorLines.filter(d=>{
                        try{ return d.trim(); }
                        catch(e){ console.log("ERROR returning trim.", e); return false; }
                    });

                    // Display the errors.
                    console.log("ERROR: rsyncUpdate_and_detectAndRecordChanges: ", errorLines);
                }
                else{
                    // Update rm_fs and reload the current file nav view.
                    if(data.rsync.rm_fs){
                        // Update the local rm_fs with the copy sent by the server.
                        // console.log("updating rm_fs");
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
            }
            else{
                console.log("Invalid status:", json.status, json);
            }
        };
    },
    display_needed_changes: async function(data=null){
        // console.log("Running real function. data:", data ? "provided" : "request");

        // Data can either be passed to or requested from this program. Was data specified?
        if(!data){
            let dataOptions = {
                type:"json", method:"POST",
                body: {},
            };
            data = await app.m_net.send(`getNeededChanges`, dataOptions, false);
        }

        // console.log("Data:", data);

        let frag = document.createDocumentFragment();
        // let totalTimeEstimate = 0;
        for(let i=0; i<data.length; i+=1){
            let timeEstimate = data[i].pageCount * 1.8;
            // totalTimeEstimate += timeEstimate;
            let pathOnly = app.m_fileNav.getParentPath(data[i].uuid, "DocumentType");

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

            // Request the processing.
            let ts = performance.now();
            recDiv.style['background-color'] = "yellow";
            recDiv.classList.add("processing");
        
            // Create an EventSource object to listen to SSE messages
            // console.log("Opening EventSource.")

            if(divCount == null){
                this.DOM['convert_output'].innerHTML = "";
            }

            let url = `processing.run/?uuid=${data.uuid}&filename=${encodeURIComponent(data.visibleName)}`;
            const eventSource = new EventSource(url);

            let isThisJson = function(text){
                try{ return JSON.parse(text); }
                catch(e){ return false; }
            }

            // Listen to SSE messages
            eventSource.onopen    = (event) => { 
                // console.log(`*OPEN`, event); 
            };
            eventSource.onclose   = (event) => { 
                // console.log(`*CLOSE`, event); 
                eventSource.close(); 
            };
            eventSource.onerror   = (event) => { 
                recDiv.style['background-color'] = "red";
                console.log("convert: there was an error.");
                rej("convert: there was an error.");
                console.log(`*ERROR`, event); 
                eventSource.close(); 
            };
            eventSource.onmessage = (event) => { 
                // The data is expected to be JSON. It will have a key of "mode" and a key of "data".
                let json = isThisJson(event.data);
                if(!json){ console.log("NOT JSON", event.data); return; }

                // Is the stream on-going?
                if(json.status == "active"){
                    // Update the display with the new lines of text.
                    // console.log(`Received SSE message:`, json.status, json.data);
                    let newText = "";

                    // Is json.data an array?
                    if(Array.isArray(json.data)){
                        json.data.forEach(d=>{ 
                            // Is the string JSON?
                            let tmp = isThisJson(d);

                            // Yes?
                            if(tmp){
                                let keys = Object.keys(tmp);
                                keys.forEach(k=>{
                                    let lines = tmp[k].split("\n");
                                    newText += `${k}: ` + "\n"; 
                                    lines.forEach(l=>{
                                        if(l){ newText += `  ` + l.trim() + "\n";  }
                                    });
                                });
                            }
                            // No, it is text.
                            else{
                                newText += d + "\n"; 
                            }

                        });
                    }
                    // It isn't?
                    else{
                    }

                    // Add the text to the display.
                    this.DOM['convert_output'].innerHTML += newText ;
                    
                    // Scroll the text to the bottom.
                    this.DOM['convert_output'].scrollTop = this.DOM['convert_output'].scrollHeight;
                }
                // Is the stream finished?
                else if(json.status == "finished"){
                    // console.log("Data stream is finished. Closing EventSource.");
                    eventSource.close();
                    // data = json.data;
                    // console.log("***", json);
                    // console.log("***", json.data);
                    // console.log("***", data);

                    // Finish.

                    // TODO: Check for returned errors.
                    //

                    // Add to the local history.
                    this.history.push(data);

                    // "convertAll" output.(divCount will be set if using "convertAll".)
                    if(divCount != null){
                        console.log(`${divCount.i+1}/${divCount.len} FINISHED Convert for: NAME: "${data.visibleName}", PAGES: ${data.pageCount}, TIME: ${Math.round(performance.now() - ts)}`, data);

                        // Add the text to the display.
                        this.DOM['convert_output'].innerHTML += "\n" ;
                        
                        // Scroll the text to the bottom.
                        this.DOM['convert_output'].scrollTop = this.DOM['convert_output'].scrollHeight;

                    }
                    // Normal output.
                    else{
                        console.log(`FINISHED Convert for: NAME: "${data.visibleName}", PAGES: ${data.pageCount}, TIME: ${Math.round(performance.now() - ts)}`, data);
                    }

                    // Remove the div from the list since the file has been successfully processed.
                    recDiv.remove();

                    res();
                }
                // Unknown type.
                else{
                    console.log("Invalid status:", json.status, json);
                }
            };

        });
    },
    convertAll: async function(fileType=null){
        let divs = this.DOM['needed_changes'].querySelectorAll(".neededUpdateDiv");
        console.log(`There are ${divs.length} records to process.`);

        this.DOM['convert_output'].innerHTML = "";

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
};

export default syncConvert;
