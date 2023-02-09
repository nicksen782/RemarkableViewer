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
        // let files = await _MOD.getItemsInDir(_APP.m_config.config.dataPath, "files", ".metadata").catch(function(e) { throw e; });
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
                                fetchedFiles.push({ filepath });
                            }
                            
                            // Handle "dirs".
                            if (type=="dirs" && stats.isDirectory() && file.lastIndexOf(ext) != -1) {
                                fetchedFiles.push({ filepath });
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

        // Default routes:
        app.use('/'    , express.static(path.join(process.cwd(), './public')));
        app.use('/libs', express.static(path.join(process.cwd(), './node_modules')));
        
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
        });
    },

    get_rm_fsFile: async function(){
        if( !fs.existsSync(`deviceData/config/rm_fs.json`) ){
            fs.writeFileSync(`deviceData/config/rm_fs.json`, JSON.stringify({},null,1));
        }
        let rm_fs = fs.readFileSync(`deviceData/config/rm_fs.json`, {encoding:'utf8', flag:'r'});
        return JSON.parse(rm_fs);
    },

    // Sync down all .metadata files, .content files, and .thumbnails dirs.
    rsyncUpdate: async function(){
        let cmd1 = `bash ./deviceData/scripts/syncDownMetafiles.sh`;
        let results1;
        
        results1 = await this.runCommand_exec_progress(cmd1, 0, true).catch(function(e) { throw e; }); 

        // Create lists of filenames. 
        let files_metadata = await rm_fs.getItemsInDir("deviceData/queryData/meta/metadata", "files", ".metadata").catch(function(e) { throw e; });
        let files_content  = await rm_fs.getItemsInDir("deviceData/queryData/meta/content" , "files", ".content") .catch(function(e) { throw e; });
        let finished = {};
        let proms = [];
        for(let i=0; i<files_metadata.length; i+=1){
            let file = fs.readFileSync(files_metadata[i].filepath, {encoding:'utf8', flag:'r'});
            file = JSON.parse(file);
            let uuid = path.basename(files_metadata[i].filepath.split(".")[0]);
            finished[uuid] = {...file, uuid};
        }
        // let docs_v5=[];
        // let docs_v6=[];
        for(let i=0; i<files_content.length; i+=1){
            let file = fs.readFileSync(files_content[i].filepath, {encoding:'utf8', flag:'r'});
            file = JSON.parse(file);
            let uuid = path.basename(files_content[i].filepath.split(".")[0]);

            // Skip CollectionType.
            if(finished[uuid].type == "CollectionType"){ 
                // console.log("Skip Collectiontype:", finished[uuid].visibleName); 
                continue; 
            }

            // Need to get the list of page uuids for this document.

            // Does this document have pages?
            if(!file.cPages && !file.pages){
                // Not a document with pages. Skip this data.
                continue;
            }

            // Check for the new V6 content changes. Check for cPages existing instead of pages.
            if(file.cPages && ! file.pages){
                // Probably a V6 format. Check the formatVersion for 2.
                if(file.formatVersion == 2){
                    // Is V6 with the new formatVersion.

                    // Read the cPages.pages values to get a replacement list for .pages and save .pages.
                    finished[uuid].pages = file.cPages.pages.map(p=>{ return p.id; });
                    finished[uuid].formatVersion = file.formatVersion;
                    finished[uuid].orientation = file.orientation;
                    // docs_v6.push([file.fileType, finished[uuid].visibleName, uuid, finished[uuid].parent]);
                }
                else{
                    // Odd. This should not have happened.
                    console.log("FAILURE - Seems to be formatVersion:2 but formatVersion is not 2. VALUE:", file.formatVersion);
                    throw "";
                }
            }
            // V5 format.
            else{
                finished[uuid].pages = file.pages;
                finished[uuid].formatVersion = 1;
                finished[uuid].orientation = file.orientation;
                // docs_v5.push([file.fileType, finished[uuid].visibleName, uuid, finished[uuid].parent]);
            }
        }

        // Separate the data by DocumentType and CollectionType.
        let data = {
            CollectionType:[],
            DocumentType:[],
        };

        let uuids = Object.keys(finished);
        for(let i=0; i<uuids.length; i+=1){
            let rec = finished[uuids[i]];
            if(rec.type == "CollectionType"){
                data.CollectionType.push(rec);
            }
            else if( rec.type == "DocumentType"){
                data.DocumentType.push(rec);
            }
        }

        // Write the rm_fs.json file.
        // fs.writeFileSync(`deviceData/config/rm_fs.json`, JSON.stringify(finished,null,1));
        fs.writeFileSync(`deviceData/config/rm_fs.json`, JSON.stringify(data,null,1));
        
        return {
            // "files_metadata": files_metadata,
            // "files_content" : files_content,
            "rm_fs": finished,
            // "docs_v5": docs_v5,
            // "docs_v6": docs_v6,
        };
    },

    // Detect changes since timestamp and add/update needsUpdate.json.
    detectAndRecordChanges: async function(){
        // Get the list of folders (with no extension) in the xochitl folder. 
        // Include folder name, folder update time, and UUID.
        let cmd2 = `bash ./deviceData/scripts/getDocUUID_updatetimes.sh`;
        let results2;
        results2 = await this.runCommand_exec_progress(cmd2, 0, false).catch(function(e) { throw e; }); 
        results2 = results2.stdOutHist.trim().split("\n");
        let json2 = [];
        for(let i=0; i<results2.length; i+=1){
            results2[i] = results2[i].trim();
            let splitIt = results2[i].split(" ");
            json2.push({
                "uuid":path.basename(splitIt[1]),
                "time":parseInt(splitIt[0], 10),
                // "time2":new Date(parseInt(splitIt[0], 10)*1000).toISOString(),
                // "time3":new Date(parseInt(splitIt[0], 10)*1000),
            });
        }

        // Sort the array by last update time. (newest first)
        json2.sort((a, b) => b.time - a.time);

        // Determine if a new pdf needs to be made for this UUID.
        let lastSync = fs.readFileSync(`deviceData/config/lastSync.txt`, {encoding:'utf8', flag:'r'});
        lastSync = parseInt( lastSync.trim(), 10);

        let allDocUUIDs = json2.map(d=>{ return d.uuid; });
        let docNames=[];
        let needsUpdate = [];
        for(let i=0; i<allDocUUIDs.length; i+=1){
            // Get the .metadata file from local.
            let metadata = fs.readFileSync(`deviceData/queryData/meta/metadata/${allDocUUIDs[i]}.metadata`, {encoding:'utf8', flag:'r'});
            metadata = JSON.parse(metadata);
            
            // Get the .content file from local.
            let content = fs.readFileSync(`deviceData/queryData/meta/content/${allDocUUIDs[i]}.content`, {encoding:'utf8', flag:'r'});
            content = JSON.parse(content);

            let updates = json2.find(d=>{ return d.uuid == allDocUUIDs[i]; });
            if(!updates){ console.log("BAD"); }

            let newRec = {
                uuid        : allDocUUIDs[i],
                visibleName : metadata.visibleName,
                type        : metadata.type,
                parent      : metadata.parent,
                deleted     : metadata.deleted,
                pageCount   : content.pageCount, // V5 and V6
                fileType    : content.fileType,  // V5 and V6
                _time       : updates.time,
                // _time2      : updates.time2,
                // _time3      : updates.time3,
            };

            let _needsUpdate = lastSync < updates.time ? true : false;
            if(_needsUpdate){
                needsUpdate.push( newRec );
            }
            docNames.push(newRec);
        }

        // Update the needsUpdate.json file.
        let needsUpdate_file = fs.readFileSync(`deviceData/config/needsUpdate.json`, {encoding:'utf8', flag:'r+'});
        needsUpdate_file = JSON.parse(needsUpdate_file);
        let write_needsUpdate_file = false;
        let prevUpdatesNeeded = needsUpdate_file.length;
        let newUpdatesNeeded = 0;
        for(let i=0; i<needsUpdate.length; i+=1){
            // Try to find an existing record in the file.
            let rec = needsUpdate[i];
            let found = needsUpdate_file.find(d=>{ return rec.uuid == d.uuid; }) ; //? true : false;

            // If found then update the record.
            if(found){
                console.log("Updating existing record for:", `(${rec.fileType}) (${rec.visibleName}) (${rec.pageCount} pages) (${rec.uuid})`);
                
                // TODO: Must confirm that moving a notebook to another directory also updates the notebook directory too.
                // Must update the individual properties. Setting it to a new object, even with the same properties and values (or different) will NOT update the found object.
                found.uuid        = rec.uuid;
                found.visibleName = rec.visibleName;
                // found.type        = rec.type;
                found.parent      = rec.parent;
                found.deleted     = rec.deleted;
                found.pageCount   = rec.pageCount;
                // found.fileType    = rec.fileType;
                found._time       = rec._time;

                // Set the write_needsUpdate_file flag.
                write_needsUpdate_file = true;

                continue;
            };

            // This is a new record. Add it to the file. 
            needsUpdate_file.push({
                uuid       : rec.uuid,
                visibleName: rec.visibleName,
                type       : rec.type,
                parent     : rec.parent,
                deleted    : rec.deleted,
                pageCount  : rec.pageCount,
                fileType   : rec.fileType,
                _time      : rec._time,
                // _time3     : rec._time3,
            });
            newUpdatesNeeded += 1;
            
            // Set the write_needsUpdate_file flag.
            write_needsUpdate_file = true;
        }

        // Update the needsUpdate_file if the data has changed.
        if(write_needsUpdate_file){
            // Sort the array by last update time. (newest first)
            console.log("Sorting the data for needsUpdate.json...");
            needsUpdate_file.sort((a, b) => b._time - a._time);
            // console.log("...done");
            
            // Write the file. 
            console.log("Updating needsUpdate.json...");
            fs.writeFileSync(`deviceData/config/needsUpdate.json`, JSON.stringify(needsUpdate_file,null,1));
            // console.log("...done");
        }
        else{
            console.log("No update was needed for needsUpdate.json");
        }

        // Update the lastSync file.
        let prevLastSync = lastSync;

        // Set  the lastSync time to the newest (after sort) file.
        if(json2[0]){ lastSync = json2[0].time; }

        // Update the lastSync.txt file. 
        fs.writeFileSync(`deviceData/config/lastSync.txt`, lastSync.toString());

        return {
            prevUpdatesNeeded: prevUpdatesNeeded,     // Previous count of new updates needed.
            newUpdatesNeeded : newUpdatesNeeded,      // Count of new updates needed.
            totalUpdatesNeeded : (prevUpdatesNeeded + newUpdatesNeeded), // Full count of all updates needed.
            lastSync         : lastSync,              // The new recorded last sync time.
            prevLastSync     : prevLastSync,          // The last recorded new sync time.
            needsUpdate_file : needsUpdate_file,      // The list of conversions
            needsConversion  : (prevUpdatesNeeded + newUpdatesNeeded) != 0, // Are any updates needed?
        };
    },

    downloadPdfFile: async function(filePath, fileName, fileUUID){
        let results1;
        filePath = `deviceData/pdf/${fileUUID}/`;
        try{ 
            // If the dir does not exist then create it.
            if( !fs.existsSync(`${filePath}`) ){
                fs.mkdirSync(`${filePath}`);
            }
            
            // TODO
            // Create/update the pages_manifest.json file. 
            
            let cmd1 = `curl -s --compressed --insecure -o '${filePath}${fileName}' http://10.11.99.1/download/${fileUUID}/pdf`;
            results1 = await this.runCommand_exec_progress(cmd1, 0, false).catch(function(e) { throw e; }); 
            results1 = results1.stdOutHist.trim().split("\n"); 

            // TODO
            // Remove this file from the updatesNeeded file.
        }
        catch(e){
            console.log("ERROR?", e);
        }

        return [filePath, fileName, fileUUID, results1];
    },

    run_pdf2svg_and_svgo: async function(uuid, filename){
        // Get the .metadata file from local.
        let metadata = fs.readFileSync(`deviceData/queryData/meta/metadata/${uuid}.metadata`, {encoding:'utf8', flag:'r'});
        metadata = JSON.parse(metadata);

        // Get the .content file from local.
        let content = fs.readFileSync(`deviceData/queryData/meta/content/${uuid}.content`, {encoding:'utf8', flag:'r'});
        content = JSON.parse(content);

        let estimated = 1320 * content.pageCount;
        
        console.log(`V1: .pdf to .svg, optimize .svg: name: ${metadata.visibleName}, ${content.pageCount} pages. Estimated time: ${estimated} ms`);
        await this.pdf2svg(uuid, filename);
        await this.svgo(uuid, filename);
        console.log(`Estimated time was: ${estimated} ms for ${content.pageCount} pages.`);

        return ["run_pdf2svg_and_svgo", uuid, filename, results1];
    },
    run_pdf2svg_and_svgo2: async function(uuid, filename){
        //
        let basePath = `deviceData/pdf/${uuid}`; ///${filename}`;
        let results1;

        // If the dir does not exist then create it.
        if( !fs.existsSync(`${basePath}/svg`) ){ fs.mkdirSync(`${basePath}/svg`); }
        // if( !fs.existsSync(`${basePath}/svg_min`) ){ fs.mkdirSync(`${basePath}/svg_min`); }

        let cmd1 = `pdf2svg '${basePath}/${filename}' ${basePath}/svg/output-page%04d.svg all`;
        let cmd2 = `node_modules/svgo/bin/svgo --config 'deviceData/svgo.config.js' --recursive -f ${basePath}/svg/`;
        let cmd3 = `${cmd1} && ${cmd2}`;

        // Get the .metadata file from local.
        let metadata = fs.readFileSync(`deviceData/queryData/meta/metadata/${uuid}.metadata`, {encoding:'utf8', flag:'r'});
        metadata = JSON.parse(metadata);

        // Get the .content file from local.
        let content = fs.readFileSync(`deviceData/queryData/meta/content/${uuid}.content`, {encoding:'utf8', flag:'r'});
        content = JSON.parse(content);

        let estimated = 1280 * content.pageCount;
        
        console.log(`V2: .pdf to .svg, optimize .svg: name: ${metadata.visibleName}, ${content.pageCount} pages. Estimated time: ${estimated} ms`);

        results1 = await this.runCommand_exec_progress(cmd3, 0, false).catch(function(e) { throw e; }); 

        // console.log(`Estimated time was: ${estimated} ms for ${content.pageCount} pages.`);
        // return "DONE";

        return ["run_pdf2svg_and_svgo2", uuid, filename, results1];
    },

    // 
    pdf2svg: async function(uuid, filename){
        // pdf2svg 'New Sync Method.pdf' output-page%04d.svg all
        
        let basePath = `deviceData/pdf/${uuid}`; ///${filename}`;
        let cmd1 = `pdf2svg '${basePath}/${filename}' ${basePath}/svg/output-page%04d.svg all`;
        let results1;
        
        // If the dir does not exist then create it.
        if( !fs.existsSync(`${basePath}/svg`) ){ fs.mkdirSync(`${basePath}/svg`); }
        // if( !fs.existsSync(`${basePath}/svg_min`) ){ fs.mkdirSync(`${basePath}/svg_min`); }

        results1 = await this.runCommand_exec_progress(cmd1, 0, false).catch(function(e) { throw e; }); 
        // console.log(cmd1);
        // console.log(results1);
        return ["pdf2svg", uuid, filename, results1];
    },
    
    //
    svgo: async function(uuid, filename){
        // SVGO conversion
        let basePath = `deviceData/pdf/${uuid}`; ///${filename}`;
        
        // If the dir does not exist then create it.
        if( !fs.existsSync(`${basePath}/svg`) )    { fs.mkdirSync(`${basePath}/svg`); }
        // if( !fs.existsSync(`${basePath}/svg_min`) ){ fs.mkdirSync(`${basePath}/svg_min`); }

        // let cmd1 = `` +
        //     `find ${basePath}/svg ` +
        //     `-name '*.svg' ` +
        //     `-exec node_modules/svgo/bin/svgo ` +
        //     `--config 'deviceData/svgo.config.js' ` +
        //     `-o ${basePath}/svg_min/ ` +
        //     `-i {} +`; 

        let cmd1 = `` +
            `node_modules/svgo/bin/svgo ` +
            `--config 'deviceData/svgo.config.js' ` +
            `--recursive `+
            `-f ${basePath}/svg/ ` + 
            // `-o ${basePath}/svg_min/ ` +
            ``;
        ``;
        
        // console.log("basePath:", basePath);
        // console.log("cmd1:", cmd1);
        
        results1 = await this.runCommand_exec_progress(cmd1, 0, false).catch(function(e) { throw e; }); 
        return ["svgo", uuid, filename, results1];
    },

    addRoutes: async function(){
        app.post('/get_rm_fsFile', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: get_rm_fsFile");
            let resp = await this.get_rm_fsFile();
            console.log(`FINISH : get_rm_fsFile: ${(performance.now() - ts_s).toFixed(3)} ms`);
            res.json( resp ) ;
         });
        app.post('/rsyncUpdate', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: rsyncUpdate");
            let resp = await this.rsyncUpdate();
            console.log(`FINISH : rsyncUpdate: ${(performance.now() - ts_s).toFixed(3)} ms`);
            res.json( resp ) ;
         });
        app.post('/detectAndRecordChanges', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: detectAndRecordChanges");
            let resp = await this.detectAndRecordChanges();
            console.log(`FINISH : detectAndRecordChanges: ${(performance.now() - ts_s).toFixed(3)} ms`);
            res.json( resp ) ;
         });
         app.post('/pdf2svg', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: pdf2svg");
            let resp = await this.pdf2svg(req.body.uuid, req.body.filename);
            console.log(`FINISH : pdf2svg: ${(performance.now() - ts_s).toFixed(3)} ms`);
            res.json( { input: req.body, output: resp } ) ;
         });
         app.post('/svgo', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: svgo");
            let resp = await this.svgo(req.body.uuid, req.body.filename);
            console.log(`FINISH : svgo: ${(performance.now() - ts_s).toFixed(3)} ms`);
            res.json( { input: req.body, output: resp } ) ;
         });
         app.post('/run_pdf2svg_and_svgo', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: run_pdf2svg_and_svgo");
            let resp = await this.run_pdf2svg_and_svgo(req.body.uuid, req.body.filename);
            console.log(`FINISH : run_pdf2svg_and_svgo: ${(performance.now() - ts_s).toFixed(3)} ms`);
            res.json( { input: req.body, output: resp } ) ;
         });
         app.post('/run_pdf2svg_and_svgo2', express.json(), async (req, res) => {
            let ts_s = performance.now();
            console.log("STARTED: run_pdf2svg_and_svgo2");
            let resp = await this.run_pdf2svg_and_svgo2(req.body.uuid, req.body.filename);
            console.log(`FINISH : run_pdf2svg_and_svgo2: ${(performance.now() - ts_s).toFixed(3)} ms`);
            res.json( { input: req.body, output: resp } ) ;
         });


        app.post('/getData2', express.json(), async (req, res) => {
            let filePath = `/home/nick/`;
            // let fileUUID = `b9f01279-3a76-4a4c-a319-8b9e8673c92e`;
            // let fileName = `New Sync Method.pdf`;

            fileUUID = "f061597e-d6f2-4b8d-a747-15f8cfd29c75";
            fileName = "2023 02 February Work Notes.pdf";

            res.json({
             'data': await this.downloadPdfFile(filePath, fileName, fileUUID)
            });
         });
        app.post('/getData3', express.json(), async (req, res) => {
            let filePath = `/home/nick/`;
            fileUUID = "97538bbb-e782-4f17-b6a4-75ee3600669c";
            fileName = "2023 01 January Work Notes.pdf";

            res.json({
             'data': await this.downloadPdfFile(filePath, fileName, fileUUID)
            });
         });

         app.post('/getData4', express.json(), async (req, res) => {
            let filePath = `/home/nick/`;
            fileUUID = "b9f01279-3a76-4a4c-a319-8b9e8673c92e";
            fileName = "New Sync Method.pdf";
            
            res.json({
             'data': await this.downloadPdfFile(filePath, fileName, fileUUID)
            });
         });
    },
};
// obj.init();
obj.serverLoad();