const fs              = require('fs');
const path            = require('path');
const { performance } = require('perf_hooks');

let _APP = null;
let modName = null;

let _MOD = {
    moduleLoaded: false,

    module_init: async function(parent, name){
        return new Promise(async (resolve,reject)=>{
            if(!_MOD.moduleLoaded){
                // Save reference to the parent module.
                _APP = parent;

                // Save module name.
                modName = name;

                // Indicate the module to load.
                _APP.consolelog(`INIT:: ${modName}`, 0);

                // Set the moduleLoaded flag.
                _MOD.moduleLoaded = true;
                resolve();
            }
            else{
                resolve();
            }
        });
    },

    // Removes document directories locally.
    removeLocalDeletedDocuments: async function (local, remote, sse_handler = null){
        let sendMessage = sse_handler ? sse_handler : console.log;

        // EXPLANATION:
        // It is expected that uuids in rm_fs can only be updated via regeneration during "rsyncUpdate" and never manually/locally.
        // Any differences in the list should be uuids that are no longer on the device.
        // These uuids should be used to delete the data locally.
        // EXAMPLE USAGE:
        // this.removeLocalDeletedDocuments(_APP.m_shared.rm_fs, data, sendMessage);

        // Create new sets of uuids for both local and remote uuids.
        const localSet  = new Set( local .DocumentType.map( d=>d.uuid ) );
        const remoteSet = new Set( remote.DocumentType.map( d=>d.uuid ) );
        
        // What DocumentTypes are in local but no longer on remote?
        const missing = [...localSet].filter(item => !remoteSet.has(item));

        // Were there any missing files on the device that need to be removed locally?
        if(missing.length){
            sendMessage(`  Need to remove ${missing.length} deleted Documents...`);

            // Loop through all the missing uuids...
            for(let i=0; i<missing.length; i+=1){
                // Make sure that the local record was found before continuing.
                let uuid = missing[i];
                let localRec = local .DocumentType.find( d=>d.uuid == uuid ) ;
                if(localRec){
                    sendMessage(`    Removing: "${localRec.visibleName}"`);
                    sendMessage(`            : uuid: ${uuid}`);
                    
                    // Remove the local document directory.
                    let resp;
                    try{ resp = await this.process_removeLocalDocumentDir(uuid); }
                    catch(e){ throw e; return false; }

                    // Handle the response.
                    if(!resp.stdOutHist && !resp.stdErrHist){
                        sendMessage(`          : DONE`);
                    }
                    else{
                        if(resp.stdOutHist){ sendMessage(`          : DONE : ${resp.stdOutHist}`); }
                        if(resp.stdErrHist){ sendMessage(`          : ERROR: ${resp.stdErrHist}`); }
                    }
                }
                // The local record was not found.
                // The removed file on the device will NOT be detectable if rm_fs is updated.
                else{
                    // Throw an error to prevent the update to rm_fs and abort the sync process.
                    throw `Error in removeLocalDeletedDocuments: Could not find record for uuid: ${uuid}`; 
                    return false;
                }
            }
        }
        else{
            sendMessage("  No deleted Documents were detected.", missing.length);
        }

        // Return true to indicate that there were no errors. 
        return true;
    },
    // Removes one document directory locally.
    process_removeLocalDocumentDir: async function(uuid){
        // WHAT DOES THIS DO?
        // Removes the local document directory indicated by the uuid provided.
        
        let cmd1 = `bash ./deviceData/scripts/process_removeLocalDocumentDir.sh "${uuid}"`;
        let results1;
        try{
            results1 = await _APP.m_shared.runCommand_exec_progress(cmd1, 0, false).catch(function(e) { throw e; })
            .catch( function(e) { throw { results: results1, e: e}; } );
        }
        catch(e){ throw e; }

        // Return some data.
        return results1;
    },

    // Runs rsyncUpdate and detectAndRecordChanges in sequence.
    rsyncUpdate_and_detectAndRecordChanges: async function( sse_handler = null ){
        let res1, res2, line;
        let ts = performance.now();
        let sendMessage = sse_handler ? sse_handler : console.log;
        
        // Sync down all .metadata files, .content files, and .thumbnails dirs. Also recreates rm_fs.json.
        try{ 
            sendMessage(`RSYNC:`);
            res1 = await this.rsyncUpdate(sse_handler); 
        }
        catch(e){ 
            // Make sure that "e" will be displayed correctly. 
            let newE;
            if(typeof e == "string"){ newE = e; }
            else{ newE = JSON.stringify(e); }

            sendMessage("ERROR running rsyncUpdate", newE); 
            res1 = { error: JSON.stringify(e) };
            res2 = { error: "Skipped: detectAndRecordChanges" };
        }

        // If the call to rsyncUpdate was successful...
        if(!res1.error){
            if(res1.uuids_updated2.length){
                sendMessage(`  These files were updated and need conversion:`);

                // Output the names for the updated items.
                for(let i=0; i<res1.uuids_updated2.length; i+=1){
                    // Get the object for this uuid. (It may be a DocumentType or CollectionType.)
                    
                    // Is the UUID for a DocumentType?
                    let recDoc      = _APP.m_shared.rm_fs.DocumentType  .find(d=>d.uuid == res1.uuids_updated2[i]);
                    if(recDoc)     { sendMessage(`    D: "${recDoc.visibleName}"` ); }
                    
                    // No? Is the UUID for a CollectionType?
                    else{
                        let recColl = _APP.m_shared.rm_fs.CollectionType.find(d=>d.uuid == res1.uuids_updated2[i]);
                        if(recColl){ sendMessage(`    C: "${recColl.visibleName}"`); }
                    }
                }
            }

            // Detect changes since timestamp and add/update needsUpdate.json.
            try{ 
                sendMessage(`UPDATE of needsUpdate.json:`);
                res2 = await this.detectAndRecordChanges(sse_handler); 

                sendMessage(`  `);
                sendMessage(`  Totals by fileType:`);
                sendMessage(`    "DocumentType"  : ${res1.uuids_DocumentType}`);
                sendMessage(`    "CollectionType": ${res1.uuids_CollectionType}`);
                sendMessage(`  Totals by DocumentType version:`);
                sendMessage(`    V6: ${res1.v6_docs}`);
                sendMessage(`    V5: ${res1.v5_docs}`);
                sendMessage(`  UUIDs:`);
                sendMessage(`    Updates needed: ${res1.uuids_updated}.`);
                sendMessage(`    Active total  : ${res1.uuids_total}.`);
                sendMessage(`  `);
            }
            catch(e){ 
                // Make sure that "e" will be displayed correctly. 
                let newE;
                if(typeof e == "string"){ newE = e; }
                else{ newE = JSON.stringify(e); }

                sendMessage("ERROR running detectAndRecordChanges", newE); 
                res2 = { error: e }; 
            }

            // 
            if(!res2.error){
                // sendMessage(`UPDATE of needsUpdate.json:`);
                sendMessage(`  Updates: new: ${res2.count_new}, updated: ${res2.count_updated}, total: ${res2.count_all}`);
                sendMessage(`  needsUpdate.json updated: ${res2.needsUpdateFileUpdated ? "YES" : "NO"}`);
                if(res2.needsUpdateFileUpdated){
                    sendMessage(`  Files updated:`);
                    res2.updates.forEach(
                        d => { 
                            // sendMessage(`[${d.type}] [${d.fileType}] [pages: ${d.pageCount}] "${d.visibleName}"`); 
                            sendMessage(`    ${d.type == "DocumentType" ? "D" : "C"}: "${d.visibleName}"`); 
                        }
                    )
                }
                else{
                    sendMessage(`  No updates were needed.`)
                }
            }
        }

        // Send the finished message with the total time.
        sendMessage(`FINISHED: Time: ${ ((performance.now() - ts)/1000).toFixed(2) } seconds`);
        
        // Return the outputs.
        return {
            "rsync"  : res1,
            "updates": res2,
        }
    },

    // HELPER: Sync down all .metadata files, .content files, and .thumbnails dirs. Also recreates rm_fs.json.
    rsyncUpdate: async function( sse_handler = null ){
        let sendMessage = sse_handler ? sse_handler : console.log;

        sendMessage("  Syncing meta files from the device...");
        let cmd1 = `bash ./deviceData/scripts/sync_syncDownMetafiles.sh`;
        
        let results1;
        results1 = await _APP.m_shared.runCommand_exec_progress(cmd1, 0, false).catch(function(e) { throw e; }); 

        // Create lists of filenames. 
        let files_metadata = await _APP.m_shared.getItemsInDir("deviceData/queryData/meta/metadata", "files", ".metadata").catch(function(e) { throw e; });
        let files_content  = await _APP.m_shared.getItemsInDir("deviceData/queryData/meta/content" , "files", ".content") .catch(function(e) { throw e; });
        
        let finished = {};

        // Get the contents of the .metadata files. (add to "finished")
        let proms1 = [];
        sendMessage("  Parsing .metadata files...");
        for(let i=0; i<files_metadata.length; i+=1){
            // ASYNC
            proms1.push( 
                new Promise( (res,rej) => {
                    fs.readFile(files_metadata[i].filepath, {encoding:'utf8', flag:'r'}, (err,data) =>{
                        if(err){ rej(err); return; }
                        file = JSON.parse(data);
                        let uuid = path.basename(files_metadata[i].filepath.split(".")[0]);
                        finished[uuid] = {...file, uuid};
                        res();
                    });
                })
            );
        }
        await Promise.all(proms1);

        // Get pages, formatVersion, orientation, pageCount, fileType from the .context files.  (update "finished")
        let proms2 = [];
        sendMessage("  Parsing .content files...");
        for(let i=0; i<files_content.length; i+=1){
            proms2.push( 
                new Promise( (res,rej) => {
                    fs.readFile(files_content[i].filepath, {encoding:'utf8', flag:'r'}, (err,data) =>{
                        if(err){ rej(err); return; }
                        file = JSON.parse(data);
                        let uuid = path.basename(files_content[i].filepath.split(".")[0]);
            
                        // Skip CollectionType.
                        if(finished[uuid].type == "CollectionType"){ 
                            // console.log("Skip Collectiontype:", finished[uuid].visibleName); 
                            // continue; 
                            res();
                            return;
                        }
            
                        // Need to get the list of page uuids for this document.
            
                        // Does this document have pages?
                        if(!file.cPages && !file.pages){
                            // Not a document with pages. Skip this data.
                            res();
                            return;
                        }
            
                        // Check for the new V6 content changes. Check for cPages existing instead of pages.
                        if(file.cPages && ! file.pages){
                            // Probably a V6 format. Check the formatVersion for 2.
                            if(file.formatVersion == 2){
                                // Add the formatVersion.
                                finished[uuid].formatVersion = file.formatVersion;

                                // Generate and store the list of pages for this document. 

                                // Filter out deleted pages.
                                finished[uuid].pages = file.cPages.pages.filter(p=>{
                                    // Include this page if the key of "deleted" is not present.
                                    if(undefined == p.deleted) { return true; }
                                    
                                    // Do not include pages that have the key of "deleted" and the "value" of 1.
                                    else if(p.deleted.value) { 
                                        // console.log("Deleted page detected:", finished[uuid].visibleName, ", deleted obj:", p.deleted); 
                                        return false; 
                                    }

                                    // No. It may still be possible to have the deleted key but it's value not set to 1.
                                    else{ return true; }
                                    
                                })

                                // Sort each page based on idx.value (Example values are: "ba", "bb", "bc", etc.)
                                .sort(function(a, b){
                                    // Convert to lowercase (Might not be needed.)
                                    let keya = a.idx.value.toLowerCase();
                                    let keyb = b.idx.value.toLowerCase();
                                    
                                    // Sort ascending.
                                    if (keya < keyb) { return -1; }
                                    if (keya > keyb) { return  1; }
                                    return 0; 
                                })

                                // Return only the page ids.
                                .map(p=>{ return p.id; });
                            }
                            else{
                                // Odd. This should not have happened. Is this s formatVersion newer than 2?
                                console.log(`FAILURE - Seems to be formatVersion:2 but formatVersion is not 2. formatVersion: ${file.formatVersion}, visibleName: ${finished[uuid].visibleName}`);
                                rej(`FAILURE - Seems to be formatVersion:2 but formatVersion is not 2. formatVersion: ${file.formatVersion}, visibleName: ${finished[uuid].visibleName}`);
                                return;
                            }
                        }
                        // Assuming that this is the V5 format.
                        else{
                            finished[uuid].pages = file.pages;
                            finished[uuid].formatVersion = 1;
                        }

                        // Save these keys as well.
                        finished[uuid].pageCount = file.pageCount;
                        finished[uuid].fileType = file.fileType;
                        finished[uuid].orientation = file.orientation;

                        res();
                    });
                })
            );
        }
        await Promise.all(proms2);

        // Separate the "finished" data by DocumentType and CollectionType into "data".
        let data = {
            CollectionType:[],
            DocumentType:[],
        };
        let uuids = Object.keys(finished);
        for(let i=0; i<uuids.length; i+=1){
            let rec = finished[uuids[i]];

            // Change the .parent value to "deleted" if .deleted is true.
            // Otherwise the parent is "" and will show up in "My files"
            if(rec.deleted && rec.parent == ""){
                // console.log(`DELETED: parent: ${rec.parent}, name: ${rec.visibleName}`);
                rec.parent = "deleted";
            }

            // Add the record to the correct key.
            if     (rec.type == "CollectionType"){ data.CollectionType.push(rec); }
            else if(rec.type == "DocumentType")  { data.DocumentType  .push(rec); }
        }

        // The local rm_fs has not been overwritten yet. 
        // Compare the current DocumentType uuids with the new list of uuids from the device. 
        // This checks if a uuid is no longer on the device but is still local and needs to be deleted locally.
        try{
            await this.removeLocalDeletedDocuments(_APP.m_shared.rm_fs, data, sendMessage)
            .catch( function(e) { throw  e } );
        }
        catch(e){
            sendMessage(`  ABORT: Error in removeLocalDeletedDocuments. rm_fs will not be updated.`);
            throw e;
        }
        
        // Update rm_fs in memory.
        sendMessage("  Updating rm_fs in memory...");
        _APP.m_shared.rm_fs = data;
        
        // Replace the rm_fs.json file.
        sendMessage("  Updating rm_fs.json on disk...");
        fs.writeFileSync(`deviceData/config/rm_fs.json`, JSON.stringify(_APP.m_shared.rm_fs,null,1));

        // Determine the number of updated uuids.
        let results1b = results1.stdOutHist.trim().split("\n").map(d=>d.split(" ")[1]).filter(d=>d);
        let syncedUuids = new Set();
        for(let i=0; i<results1b.length; i+=1){ syncedUuids.add( results1b[i].trim().split(".")[0] ); }

        // Get counts of the V5 and the V6 docs.
        let v5_docs = _APP.m_shared.rm_fs.DocumentType.filter(d=>d.formatVersion == 1);
        let v6_docs = _APP.m_shared.rm_fs.DocumentType.filter(d=>d.formatVersion == 2);

        // Return the updated rm_fs data and some other data.
        return {
            "uuids_updated2"      : [...syncedUuids],
            "uuids_updated"       : syncedUuids.size,
            "uuids_total"         : uuids.length,
            "uuids_DocumentType"  : _APP.m_shared.rm_fs.DocumentType.length,
            "uuids_CollectionType": _APP.m_shared.rm_fs.CollectionType.length,
            "v5_docs"             : v5_docs.length,
            "v6_docs"             : v6_docs.length,
            "rm_fs"               : _APP.m_shared.rm_fs ,
            "error"               : false ,
        };
    },

    // HELPER: Detect changes since timestamp and add/update needsUpdate.json.
    detectAndRecordChanges: async function( sse_handler = null ){
        let sendMessage = sse_handler ? sse_handler : console.log;

        // Get the list of folders (with no extension) in the xochitl folder. 
        sendMessage("  Getting file update dates from the device...");
        let cmd2 = `bash ./deviceData/scripts/sync_getDocUUID_updatetimes.sh`;
        let results2;
        results2 = await _APP.m_shared.runCommand_exec_progress(cmd2, 0, false).catch(function(e) { throw e; }); 
        results2 = results2.stdOutHist.trim().split("\n");

        sendMessage("  Parsing result... Creating the update list...");
        let json2 = [];
        for(let i=0; i<results2.length; i+=1){
            // Separate the data in this line.
            results2[i] = results2[i].trim();
            let splitIt = results2[i].split(" ");

            // Include folder name, folder update time, and UUID.
            json2.push({
                "uuid":path.basename(splitIt[1]),
                "time":parseInt(splitIt[0], 10),
                // "time2":new Date(parseInt(splitIt[0], 10)*1000).toISOString(),
                // "time3":new Date(parseInt(splitIt[0], 10)*1000),
            });
        }
        // Sort the array by last update time. (newest first)
        json2.sort((a, b) => b.time - a.time);

        // Get the list of uuids from the data.
        let uuids = json2.map(d=>{ return d.uuid; });

        // Determine the unix time to compare against for determining which files are newer.
        let lastSync = fs.readFileSync(`deviceData/config/lastSync.txt`, {encoding:'utf8', flag:'r'});
        lastSync = parseInt( lastSync.trim(), 10);

        // Generate an array of objects containing data on which documents are newer than lastSync.
        sendMessage("  Comparing each timestamp against the lastSync timestamp...");
        let needsUpdate = [];
        for(let i=0; i<uuids.length; i+=1){
            // Find this record in the updates array. Fail if not found. 
            let updates = json2.find(d=>{ return d.uuid == uuids[i]; });
            if(!updates){ console.log("ERROR: COULD NOT FIND UPDATE DATA", uuids[i]); throw "MISSING UPDATE DATA"; }

            // Find the record in the rm_fs. Fail if not found.
            let recData = _APP.m_shared.rm_fs.DocumentType.find(d=>uuids[i]==d.uuid); 
            if(!recData){ console.log("ERROR: COULD NOT FIND RECDATA", uuids[i]); throw "MISSING REC DATA"; }

            // Determine if this record needs an update.
            let _needsUpdate = lastSync < updates.time ? true : false;
            if(_needsUpdate){
                // Do not include changed files that are in the "trash" or are "deleted".
                if(recData.parent == "trash" || recData.parent == "deleted"){
                    continue;
                }

                // Create the new record for needsUpdate and add to needsUpdate.
                let newRec = {
                    uuid        : uuids[i],
                    visibleName : recData.visibleName,
                    type        : recData.type,
                    parent      : recData.parent,
                    deleted     : recData.deleted,
                    pageCount   : recData.pageCount,
                    fileType    : recData.fileType,
                    _time       : updates.time,
                    // _time2      : updates.time2,
                    // _time3      : updates.time3,
                };
                needsUpdate.push( newRec );
            }
        }

        // Get the current newsUpdate.json file. 
        let needsUpdate_file = fs.readFileSync(`deviceData/config/needsUpdate.json`, {encoding:'utf8', flag:'r+'});
        needsUpdate_file = JSON.parse(needsUpdate_file);

        // Determine if this is a new update or an update to an existing update record.
        let write_needsUpdate_file = false;
        let updatedUpdates = 0;
        let newUpdates = 0;
        for(let i=0; i<needsUpdate.length; i+=1){
            // Try to find an existing record in the file.
            let rec = needsUpdate[i];
            let found = needsUpdate_file.find(d=>{ return rec.uuid == d.uuid; });

            // If found then update the record.
            if(found){
                sendMessage(`    Update record updated for: ${rec.visibleName}`);
                // console.log("Updating existing record for:", `(${rec.fileType}) (${rec.visibleName}) (${rec.pageCount} pages) (${rec.uuid})`);
                
                // TODO: Must confirm that moving a notebook to another directory also updates the notebook directory too.
                // TODO: Must confirm that moving a page from one notebook to another also updates the notebook directories too.

                // Must update the individual properties. Setting it to a new object, even with the same properties and values (or different) will NOT update the found object.
                found.uuid        = rec.uuid;
                found.visibleName = rec.visibleName;
                found.parent      = rec.parent;
                found.deleted     = rec.deleted;
                found.pageCount   = rec.pageCount;
                found._time       = rec._time;
                // found.type        = rec.type;
                // found.fileType    = rec.fileType;

                // Set the write_needsUpdate_file flag.
                write_needsUpdate_file = true;

                //
                updatedUpdates += 1;

                continue;
            };

            // This is a new record. Add it to the file. 
            // console.log("Adding new record for:", `(${rec.fileType}) (${rec.visibleName}) (${rec.pageCount} pages) (${rec.uuid})`);
            sendMessage(`    Update record created for: ${rec.visibleName}`);
            needsUpdate_file.push({
                uuid       : rec.uuid,
                visibleName: rec.visibleName,
                type       : rec.type,
                parent     : rec.parent,
                deleted    : rec.deleted,
                pageCount  : rec.pageCount,
                fileType   : rec.fileType,
                _time      : rec._time,
            });
            newUpdates += 1;
            
            // Set the write_needsUpdate_file flag.
            write_needsUpdate_file = true;
        }

        // Update the needsUpdate.json if the data has changed.
        if(write_needsUpdate_file){
            // Sort the array by last update time. (newest first)
            needsUpdate_file.sort((a, b) => b._time - a._time);
            
            // Write the file. 
            sendMessage(`  Updated needsUpdate.json`);
            fs.writeFileSync(`deviceData/config/needsUpdate.json`, JSON.stringify(needsUpdate_file,null,1));
        }
        else{
            // console.log("No update was needed for needsUpdate.json");
            sendMessage(`  No update was needed for needsUpdate.json`);
        }

        // Store the previous lastSync value in a new variable.
        let prevLastSync = lastSync;

        // Set the lastSync time to the newest (after sort) file.
        if(json2[0]){ lastSync = json2[0].time; }

        // Update the lastSync.txt file if a file was found to be newer than prevLastSync. 
        if(prevLastSync != lastSync){
            sendMessage(`  Updating the timestamp inlastSync.txt.`);
            fs.writeFileSync(`deviceData/config/lastSync.txt`, lastSync.toString());
        }

        // Return data.
        return {
            updates      : needsUpdate,
            updatesAll   : needsUpdate_file,
            count_updated: updatedUpdates,
            count_new    : newUpdates,
            count_all    : needsUpdate_file.length,
            needsUpdateFileUpdated : write_needsUpdate_file,
            error : false,
        };
    },
};

module.exports = _MOD;