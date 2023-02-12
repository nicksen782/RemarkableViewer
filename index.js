const fs              = require('fs');
const path            = require('path');
const { spawn }       = require('child_process');
const { performance } = require('perf_hooks');
// const pdf2svg = require('pdf2svg');

// const http = require("http");
// const https = require("https");

var server     ;// = require('https').createServer();
const express    = require('express');
const app        = express();

/*
    CollectionType         has .metadata, .content.
    DocumentType: notebook has .metadata, .content, local, .pagedata,              folders
    DocumentType: pdf      has .metadata, .content, local, .pagedata, .pdf,        folders
    DocumentType: epub     has .metadata, .content, local, .pagedata, .pdf, .epub, folders

    The folders for a DocumentType are named <UUID.<EXTENSION>
      Where <EXTENSION> can be "", thumbnails, textconversion, highlights, 

    https://remarkablewiki.com/tech/webinterface

    // PDF 2 SVG CONVERSION
    pdf2svg 'New Sync Method.pdf' output-page%04d.svg all

    // SVGO conversion
    svgo/bin/svgo -i Moutput-page0001.svg -o Moutput-page0001.svg
    svgo/bin/svgo --config="deviceData/svgo.config.json" -i Moutput-page0001.svg -o Moutput-page0001.svg

    // META folders.
    // ./deviceData/queryData/meta/metadata
    // ./deviceData/queryData/meta/content
    // ./deviceData/queryData/meta/thumbnails
*/

var rm_fs = {
    // Returns a filelist from the specified target path of type and file extension.
    getItemsInDir            : function(targetPath, type, ext=""){
        // EXAMPLE: let files = await _MOD.getItemsInDir(_APP.m_config.config.dataPath, "files", ".metadata").catch(function(e) { throw e; });
        // EXAMPLE OUTPUT:
        // {
        //     filepath: 'deviceData/pdf/29f27910-6b66-4dff-8279-5a4683fbce85/svg/output-page0001.svg',
        //     mtimeMs: 1675995876048.0078,
        //     ext: '.svg'
        // }
        return new Promise(function(resolve, reject){
            // Check for the correct type.
            if(["files", "dirs"].indexOf(type) == -1){
                let msg = "Invalid type specified.";
                console.log("getItemsInDir:", msg);
                reject(msg);
                return ;
            }
    
            // Read the file list for the indicated targetPath.
            fs.promises.readdir(targetPath)
                .then(async function(files){
                    const fetchedFiles = [];
                    
                    // Go through each file/dir returned by readdir.
                    for (let file of files) {
                        try {
                            // Get the filepath. 
                            const filepath = path.join(targetPath, file);
                
                            // Get the stats for this file. 
                            const stats = await fs.promises.lstat(filepath).catch(function(e) { throw e; });
                    
                            // Handle "files".
                            if (type=="files" && stats.isFile() && file.lastIndexOf(ext) != -1) {
                                fetchedFiles.push({ 
                                    filepath:filepath, 
                                    mtimeMs: stats.mtimeMs, 
                                    ext: ext 
                                });
                            }
                            
                            // Handle "dirs".
                            if (type=="dirs" && stats.isDirectory() && file.lastIndexOf(ext) != -1) {
                                fetchedFiles.push({ 
                                    filepath:filepath, 
                                    mtimeMs: stats.mtimeMs, 
                                    ext: ext 
                                });
                            }
                        } 
                        catch (err) {
                            console.error(err);
                            throw err;
                            return;
                        }
                    }
    
                    // Return the data.
                    resolve(fetchedFiles);
                    return; 
    
                })
                .catch(function(e){ 
                    console.log("getItemsInDir:", "Error while reading file stats.", e);
                    reject(e);
                    return;
                })
            ;
        
        });
    },
};

var obj = {
    // Holds an abstraction of the Remarkable's file system for local use. Mostly metadata.
    rm_fs : {},

    // Used for running shell commands. 
    runCommand_exec_progress : async function(cmd, expectedExitCode=0, progress=true){
        return new Promise(function(cmd_res, cmd_rej){
            const proc = spawn(cmd, { shell: true });
    
            let stdOutHist = "";
            let stdErrHist = "";
    
            proc.stdout.on('data', (data) => {
                if(progress){
                    // console.log(`  stdout: ${data}`);
                    console.log(`${data}`);
                }
                stdOutHist += data;
            });
    
            proc.stderr.on('data', (data) => {
                if(progress){
                    console.error(`  ${data}`);
                    // console.error(`  stderr: ${data}`);
                }
                stdErrHist += data;
            });
    
            proc.on('exit', (code) => {
                if(code == expectedExitCode){ 
                    cmd_res({
                        "stdOutHist": stdOutHist,
                        "stdErrHist": stdErrHist,
                    }); 
                }
                else{
                    console.log(`  child process exited with code ${code}`);
                    console.log(`  cmd: ${cmd}`);
                    cmd_rej({
                        "cmd": cmd,
                        "stdOutHist": stdOutHist,
                        "stdErrHist": stdErrHist,
                    });
                }
            });
    
        });
    },

    // Loaded once at program start.
    serverLoad: async function(){
        console.log("LOADING: Remarkable Viewer V4");

        // FILE CHECK.
        if( !fs.existsSync(`deviceData/config`) ){ 
            console.log("MISSING: config folder. Creating new folder.");
            fs.mkdirSync(`deviceData/config`); 
        }
        if( !fs.existsSync(`deviceData/config/lastSync.txt`) ){
            console.log("MISSING: lastSync.txt. Creating new file.");
            fs.writeFileSync(`deviceData/config/lastSync.txt`, JSON.stringify(0,null,1));
        }
        if( !fs.existsSync(`deviceData/config/needsUpdate.json`) ){
            console.log("MISSING: needsUpdate.json. Creating new file.");
            fs.writeFileSync(`deviceData/config/needsUpdate.json`, JSON.stringify([],null,1));
        }
        if( !fs.existsSync(`deviceData/config/rm_fs.json`) ){
            console.log("MISSING: rm_fs.json. Creating new file.");
            fs.writeFileSync(`deviceData/config/rm_fs.json`, JSON.stringify({"CollectionType": [], "DocumentType": []},null,1));
        }

        this.rm_fs = await this.get_rm_fsFile();

        // Default routes:
        app.use('/'            , express.static(path.join(process.cwd(), './public')));
        app.use('/libs'        , express.static(path.join(process.cwd(), './node_modules')));
        app.use('/deviceSvg'   , express.static(path.join(process.cwd(), './deviceData/pdf')));
        app.use('/deviceThumbs', express.static(path.join(process.cwd(), './deviceData/queryData/meta/thumbnails')));

        let conf = {
            host: "127.0.0.1", 
            port: 2000
        };

        const key  = fs.readFileSync("localhost-key.pem", "utf-8");
        const cert = fs.readFileSync("localhost.pem", "utf-8");

        if(key && cert){
            server = require('https').createServer(  { key, cert }, app );
        }
        else{
            // server = require('http').createServer()();
            // server.on('request', app);
        }

        await this.addRoutes();

        server.listen(conf, async function(){
            console.log("LOADED: Remarkable Viewer V4");
            console.log("");
        });
    },

    // Returns the rm_fs.json file.
    get_rm_fsFile: async function(){
        let data = fs.readFileSync(`deviceData/config/rm_fs.json`, {encoding:'utf8', flag:'r'});
        return JSON.parse(data);
    },

    // Returns the needsUpdate.json file.
    getNeededChanges: async function(){
        let data = fs.readFileSync(`deviceData/config/needsUpdate.json`, {encoding:'utf8', flag:'r'});
        return JSON.parse(data);
    },

    // Runs rsyncUpdate and detectAndRecordChanges in sequence.
    rsyncUpdate_and_detectAndRecordChanges: async function(){
        let res1, res2;
        // Sync down all .metadata files, .content files, and .thumbnails dirs. Also recreates rm_fs.json.
        try{ res1 = await this.rsyncUpdate(); }
        catch(e){ console.log("ERROR running rsyncUpdate", e); throw e; }
        console.log(`  RSYNC:`);
        console.log(`    UUIDs updated: ${res1.uuids_updated} of ${res1.uuids_total}`);
        console.log(`    Total of fileType: DocumentType: ${res1.uuids_DocumentType}, CollectionType: ${res1.uuids_CollectionType}`);
        console.log(`    Total of doc formats: V6: ${res1.v6_docs}, V5: ${res1.v5_docs}`);

        // Detect changes since timestamp and add/update needsUpdate.json.
        try{ res2 = await this.detectAndRecordChanges(); }
        catch(e){ console.log("ERROR running detectAndRecordChanges", e); throw e; }
        console.log(`  UPDATE of needsUpdate.json:`);
        console.log(`    Updates: new: ${res2.count_new}, updated: ${res2.count_updated}, total: ${res2.count_all}`);
        console.log(`    needsUpdate.json updated: ${res2.needsUpdateFileUpdated ? "YES" : "NO"}`);
        if(res2.needsUpdateFileUpdated){
            console.log(`    Files updated:`)
            console.log(`      ` + res2.updates.map(d=>{ return `[${d.type}] [${d.fileType}] [pages: ${d.pageCount}] "${d.visibleName}"` ; }).join("\n      ") )
        }
        else{
            console.log(`    No updates were needed.`)
        }

        // Return the outputs.
        return {
            "rsync"  : res1,
            "updates": res2,
        }
    },

    // HELPER: Sync down all .metadata files, .content files, and .thumbnails dirs. Also recreates rm_fs.json.
    rsyncUpdate: async function(){
        let cmd1 = `bash ./deviceData/scripts/syncDownMetafiles.sh`;
        
        let results1;
        results1 = await this.runCommand_exec_progress(cmd1, 0, false).catch(function(e) { throw e; }); 

        // Create lists of filenames. 
        let files_metadata = await rm_fs.getItemsInDir("deviceData/queryData/meta/metadata", "files", ".metadata").catch(function(e) { throw e; });
        let files_content  = await rm_fs.getItemsInDir("deviceData/queryData/meta/content" , "files", ".content") .catch(function(e) { throw e; });
        let finished = {};

        // Get the contents of the .metadata files. (add to "finished")
        let proms1 = [];
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
            if(rec.type == "CollectionType"){ data.CollectionType.push(rec); }
            else if( rec.type == "DocumentType"){ data.DocumentType.push(rec); }
        }

        // Update rm_fs in memory.
        this.rm_fs = data;

        // Replace the rm_fs.json file.
        fs.writeFileSync(`deviceData/config/rm_fs.json`, JSON.stringify(this.rm_fs,null,1));

        // Determine the number of updated uuids.
        let results1b = results1.stdOutHist.trim().split("\n").map(d=>d.split(" ")[1]).filter(d=>d);
        let syncedUuids = new Set();
        for(let i=0; i<results1b.length; i+=1){ syncedUuids.add( results1b[i].trim().split(".")[0] ); }

        // Get counts of the V5 and the V6 docs.
        let v5_docs = this.rm_fs.DocumentType.filter(d=>d.formatVersion == 1);
        let v6_docs = this.rm_fs.DocumentType.filter(d=>d.formatVersion == 2);

        // Return the updated rm_fs data and some other data.
        return {
            "uuids_updated"       : syncedUuids.size,
            "uuids_total"         : uuids.length,
            "uuids_DocumentType"  : this.rm_fs.DocumentType.length,
            "uuids_CollectionType": this.rm_fs.CollectionType.length,
            "v5_docs"             : v5_docs.length,
            "v6_docs"             : v6_docs.length,
            "rm_fs"               : this.rm_fs ,
        };
    },

    // HELPER: Detect changes since timestamp and add/update needsUpdate.json.
    detectAndRecordChanges: async function(){
        // Get the list of folders (with no extension) in the xochitl folder. 
        let cmd2 = `bash ./deviceData/scripts/getDocUUID_updatetimes.sh`;
        let results2;
        results2 = await this.runCommand_exec_progress(cmd2, 0, false).catch(function(e) { throw e; }); 
        results2 = results2.stdOutHist.trim().split("\n");
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
        let needsUpdate = [];
        for(let i=0; i<uuids.length; i+=1){
            // Find this record in the updates array. Fail if not found. 
            let updates = json2.find(d=>{ return d.uuid == uuids[i]; });
            if(!updates){ console.log("ERROR: COULD NOT FIND UPDATE DATA", uuids[i]); throw "MISSING UPDATE DATA"; }

            // Find the record in the rm_fs. Fail if not found.
            let recData = this.rm_fs.DocumentType.find(d=>uuids[i]==d.uuid); 
            if(!recData){ console.log("ERROR: COULD NOT FIND RECDATA", uuids[i]); throw "MISSING REC DATA"; }

            // Determine if this record needs an update.
            let _needsUpdate = lastSync < updates.time ? true : false;
            if(_needsUpdate){
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
            fs.writeFileSync(`deviceData/config/needsUpdate.json`, JSON.stringify(needsUpdate_file,null,1));
        }
        else{
            // console.log("No update was needed for needsUpdate.json");
        }

        // Store the previous lastSync value in a new variable.
        let prevLastSync = lastSync;

        // Set the lastSync time to the newest (after sort) file.
        if(json2[0]){ lastSync = json2[0].time; }

        // Update the lastSync.txt file if a file was found to be newer than prevLastSync. 
        if(prevLastSync != lastSync){
            fs.writeFileSync(`deviceData/config/lastSync.txt`, lastSync.toString());
        }

        // Return data.
        return {
            updates      : needsUpdate,
            count_updated: updatedUpdates,
            count_new    : newUpdates,
            count_all    : needsUpdate_file.length,
            needsUpdateFileUpdated : write_needsUpdate_file,
        };
    },

    // Download pdf, convert to svg files, optimize svg files, clear the record from needsUpdate.json.
    run_fullDownloadAndProcessing: async function(uuid, filename){
        // Indicate the document that will be processed.
        console.log(`  PROCESSING: ${uuid}, ${filename}`);

        // Get the current needsUpdate.json file. 
        let needsUpdate_file = fs.readFileSync(`deviceData/config/needsUpdate.json`, {encoding:'utf8', flag:'r+'});
        needsUpdate_file = JSON.parse(needsUpdate_file);

        // Make sure that this uuid is there.
        let index = needsUpdate_file.findIndex(d=>d.uuid == uuid);

        // Make sure this entry is there before doing anything else. 
        if(index == -1){
            console.log(`ABORT: run_fullDownloadAndProcessing: uuid: ${uuid} is NOT within needsUpdate.json`);
            return {
                "name" : filename,
                "uuid" : uuid,
                "fileType": "",
                "pages"   : 0,
                // "recData" : recData,
                "t_pdf"   : 0,
                "t_toSvg" : 0,
                "t_svgo"  : 0,
            };
        }

        // These will hold the results from the commands.
        let results1;
        let results2;
        let results3;
        
        // If the dir(s) does not exist then create it.
        let basePath = `deviceData/pdf/${uuid}`;
        if( !fs.existsSync(`${basePath}`) )    { fs.mkdirSync(`${basePath}`); }
        if( !fs.existsSync(`${basePath}/svg`) ){ fs.mkdirSync(`${basePath}/svg`); }

        // Find the record in the rm_fs. Fail if not found.
        let recData = this.rm_fs.DocumentType.find(d=>uuid==d.uuid); 
        if(!recData){ 
            console.log(`ABORT: run_fullDownloadAndProcessing: uuid: ${uuid} is NOT within rm_fs.json`);
            return {
                "name" : filename,
                "uuid" : uuid,
                "fileType": "",
                "pages"   : 0,
                // "recData" : recData,
                "t_pdf"   : 0,
                "t_toSvg" : 0,
                "t_svgo"  : 0,
            };
        }

        // Commands.
        let cmd0 = `curl -s --compressed --insecure -o "${basePath}/${filename}.pdf" http://10.11.99.1/download/${uuid}/pdf`;
        let cmd1 = `pdf2svg "${basePath}/${filename}.pdf" "${basePath}/svg/output-page%04d.svg" all`;
        let cmd2 = `node_modules/svgo/bin/svgo --config "deviceData/svgo.config.js" --recursive -f ${basePath}/svg/`;

        // Remove existing pdf file(s). (If document is renamed this will prevent there being more than 1 pdf in the folder.)
        let files_pdf   = await rm_fs.getItemsInDir(`${basePath}`  , "files", ".pdf").catch(function(e) { throw e; });
        files_pdf.forEach((d)=>{ fs.unlinkSync( d.filepath ); });

        // Download the pdf from the device.
        let ts1 = performance.now();
        try{
            // console.log(` DOWNLOAD PDF    : NAME: "${filename}", PAGES: ${recData.pageCount}, UUID: ${uuid}`);
            results1 = await this.runCommand_exec_progress(cmd0, 0, false)
            .catch(function(e) { console.log("ERROR: parta 1", results1); throw e; }); 
        } 
        catch(e){ console.log("ERROR: parta 2", e); throw e; }
        ts1 = (performance.now() - ts1)/1000;
        console.log(`  DONE: DOWNLOAD PDF           : ${(ts1).toFixed(3)}s, [${recData.type}] [${recData.fileType}] [pages: ${recData.pageCount}] "${filename}"`);

        // Make sure that the .pdf file exists.
        if( !fs.existsSync(`${basePath}/${filename}.pdf`) ){ 
            console.log("This file does not exist:", `${uuid}, ${filename}`, "Skipping... will remain in needsUpdate.json");
            return {
                "name" : filename,
                "uuid" : uuid,
                "fileType": recData.fileType,
                "pages"   : recData.pageCount,
                // "recData" : recData,
                "t_pdf"   : 0,
                "t_toSvg" : 0,
                "t_svgo"  : 0,
            };
        }

        // Remove the .svg files from the svg folder.
        let files_svgs0   = await rm_fs.getItemsInDir(`${basePath}/svg`  , "files", ".svg").catch(function(e) { throw e; });
        files_svgs0.forEach((d)=>{ fs.unlinkSync( d.filepath ); });

        // Convert the .pdf to .svg pages.
        let ts2 = performance.now();
        try{
            // console.log(` PDF TO SVG PAGES: NAME: "${filename}", PAGES: ${recData.pageCount}, UUID: ${uuid}`);
            results2 = await this.runCommand_exec_progress(cmd1, 0, false)
            .catch(function(e) { console.log("ERROR: partb 1", results2); throw e; }); 
        } 
        catch(e){ console.log("ERROR: partb 2", e); throw e; }
        ts2 = (performance.now() - ts2)/1000;
        console.log(`  DONE: PDF TO SVG PAGES       : ${(ts2).toFixed(3)}s, [${recData.type}] [${recData.fileType}] [pages: ${recData.pageCount}] "${filename}"`);
        
        // Get a new list of svg files in the svg folder. 
        let files_svgs   = await rm_fs.getItemsInDir(`${basePath}/svg`  , "files", ".svg").catch(function(e) { throw e; });
        
        // Sort each page in the svgs list based on filepath alphabetically. (They are still named like : output-page0001.svg)
        files_svgs.sort(function(a, b){
            // Convert to lowercase (Might not be needed.)
            let keya = a.filepath.toLowerCase();
            let keyb = b.filepath.toLowerCase();
            
            // Sort ascending.
            if (keya < keyb) { return -1; }
            if (keya > keyb) { return  1; }
            return 0; 
        });

        // Get the list of page ids for this document. (This will be used as the sort order and the filenames for each page.)
        let metaPages = this.rm_fs.DocumentType.find(d=>d.uuid == uuid).pages;
        
        // Rename the .svg pages to their matching page id. (include the .svg extension.)
        metaPages.forEach((d,i)=>{ 
            let split = files_svgs[i].filepath.split("/");
            let oldFilename = split.pop(); // Removes the last value in split (the filename.)
            let thisPath = split.join("/");
            let newFullPathAndFilename = `${thisPath}/${metaPages[i]}.svg`;
            fs.renameSync(files_svgs[i].filepath, newFullPathAndFilename);
        });

        // Optimize the .svgs in the svg folder.
        let ts3 = performance.now();
        try{ 
            // console.log(` SVG OPTIMIZE    : NAME: "${filename}", PAGES: ${recData.pageCount}, UUID: ${uuid}`);
            results3 = await this.runCommand_exec_progress(cmd2, 0, false)
            .catch(function(e) { console.log("ERROR: partc 1", results3); throw e; }); 
        } 
        catch(e){ console.log("ERROR: partc 2", e); throw e; }
        ts3 = (performance.now() - ts3)/1000;
        console.log(`  DONE: SVG OPTIMIZE           : ${(ts3).toFixed(3)}s, [${recData.type}] [${recData.fileType}] [pages: ${recData.pageCount}] "${filename}"`);

        // Can now remove this entry from needsUpdate.json
        needsUpdate_file = needsUpdate_file.filter(d=>d.uuid != uuid);

        // Write the file. 
        fs.writeFileSync(`deviceData/config/needsUpdate.json`, JSON.stringify(needsUpdate_file,null,1));
        console.log("  UPDATE needsUpdate.json: DONE");

        // Return some data.
        return {
            "name" : filename,
            "uuid" : uuid,
            "fileType": recData.fileType,
            "pages"   : recData.pageCount,
            // "recData" : recData,
            "t_pdf"   : ts1,
            "t_toSvg" : ts2,
            "t_svgo"  : ts3,
        };
    },

    //
    getAvailablePages: async function(uuid){
        // Get the pages from metadata.
            // pages array and pageCount.
            // (Note: page starts at 0, not 1.)
        // Determine which of the pages specified by metadata exists.
            // Search the .thumbnail folder.
        // Get the pages in the svg folder. 
            // The number at the end of each filename is the page number. (Note: page starts at 1, not 0.)
            // output-page0001.svg
            // output-page0002.svg
            // output-page0003.svg
        // The rm_fs pages array determines what pages are in a document and the new .svg filenames.
        // Rename the svg files to match the page ids (same as the thumbs.)
        // Both the .svg and the thumb file will be returned as well as the page id and which of the two files is newer.

        // Determine the basePaths.
        let basePath        = `deviceData/pdf/${uuid}`;
        let basePath_svgs   = `deviceData/pdf/${uuid}/svg`;
        let basePath_thumbs = `deviceData/queryData/meta/thumbnails/${uuid}.thumbnails`;
        
        // If the dir(s) does not exist then create it.
        if( !fs.existsSync(`${basePath}`) )     { fs.mkdirSync(`${basePath}`); }
        if( !fs.existsSync(`${basePath_svgs}`) ){ fs.mkdirSync(`${basePath_svgs}`); }

        // Get the list of .svg files from the svg folder.
        let files_svgs   = await rm_fs.getItemsInDir(`${basePath_svgs}`  , "files", ".svg").catch(function(e) { throw e; });
        files_svgs.forEach((d)=>{ d.filepath = path.basename(d.filepath); });

        // Get the thumb .jpg files.
        let files_thumbs = await rm_fs.getItemsInDir(`${basePath_thumbs}`, "files", ".jpg").catch(function(e) { throw e; });
        files_thumbs.forEach((d)=>{ d.filepath = path.basename(d.filepath); });
        
        // This will determine the output order of the pages. 
        let metaPages = this.rm_fs.DocumentType.find(d=>d.uuid == uuid).pages;

        let output = [];
        missing = [];
        for(let i=0; i<metaPages.length; i+=1){
            // Try to find the thumbnail file that matches this page id.
            let thumb = files_thumbs.find(d=>{ return d.filepath.split(".")[0] == metaPages[i]; });
            
            // Try to find the svg file that matches this page id.
            let svg = files_svgs[i].find(d=>{ return d.filepath.split(".")[0] == metaPages[i]; });;

            // Determine which is newer: The .svg file or the .jpg thumbnail file.
            let newer = "";

            // Using !thumb early as to "short-circuit" the rest which could throw an error.
            try{
                // If you have both the svg and the thumb...
                if(thumb && svg){
                    if(svg.mtimeMs > thumb.mtimeMs){ newer = "svg"; }
                    else{ newer = "thumb"; }
                }

                // If you have the thumb but not the svg...
                else if(thumb && !svg){ newer = "thumb"; }

                // If you have the svg but not the thumb...
                else if(!thumb && svg){ newer = "svg"; }

                // If you have neither the thumb or the svg...
                else{ newer = ""; }
            }
            catch(e){
                // Display the error.
                console.log(`catch in getAvailablePages while trying to determine the newer file:`, e, )
                console.log(`thumb: ${thumb}`);
                console.log(`svg: ${svg}`);

                // Set the svg and the thumb as objects with an empty string for filepath.
                svg   = { filepath: "" };
                thumb = { filepath: "" };
            }

            // If the thumb was not found add this page id to the missing list.
            if(!thumb){ 
                missing.push(metaPages[i]);
            }

            // Add to the output.
            output.push({
                thumb  : thumb ? thumb.filepath : "",
                svg    : svg ? svg.filepath : "",
                pageId : metaPages[i],
                newer  : newer,
                // meta: this.rm_fs.DocumentType.find(d=>d.uuid == uuid).pages
            });
        }

        // Return the output and the pages that have missing thumbs.
        return { 
            output:output,
            missing:missing,
        };
    },

    addRoutes: async function(){
        app.post('/get_rm_fsFile', express.json(), async (req, res) => {
            let ts_s = performance.now();
            // console.log("STARTED: get_rm_fsFile");
            let resp = await this.get_rm_fsFile();
            // console.log(`FINISH : get_rm_fsFile: ${(performance.now() - ts_s).toFixed(3)} ms`);
            // console.log("");
            res.json( resp ) ;
            });
        app.post('/getNeededChanges', express.json(), async (req, res) => {
            let ts_s = performance.now();
            // console.log("STARTED: getNeededChanges");
            let resp = await this.getNeededChanges();
            // console.log(`FINISH : getNeededChanges: ${(performance.now() - ts_s).toFixed(3)} ms`);
            // console.log("");
            res.json( resp ) ;
            });

        app.post('/rsyncUpdate_and_detectAndRecordChanges', express.json(), async (req, res) => {
        let ts_s = performance.now();
        console.log("STARTED: rsyncUpdate_and_detectAndRecordChanges");
        let resp = await this.rsyncUpdate_and_detectAndRecordChanges();
        console.log(`FINISH : rsyncUpdate_and_detectAndRecordChanges: ${(performance.now() - ts_s).toFixed(3)} ms`);
        console.log("");
        res.json( resp ) ;
        });

        app.post('/run_fullDownloadAndProcessing', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: run_fullDownloadAndProcessing");
            let resp = await this.run_fullDownloadAndProcessing(req.body.uuid, req.body.filename);
            console.log(`FINISH : run_fullDownloadAndProcessing: ${(performance.now() - ts_s).toFixed(3)} ms`);
            console.log("");
            res.json( resp ) ;
        });

        app.post('/getAvailablePages', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: getAvailablePages");
            let resp = await this.getAvailablePages(req.body.uuid);
            console.log(`FINISH : getAvailablePages: ${(performance.now() - ts_s).toFixed(3)} ms`);
            console.log("");
            res.json( resp ) ;
        });
    },
};
// obj.init();
obj.serverLoad();