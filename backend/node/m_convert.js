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

    // Request the pdf from the Remarkable Tablet. 
    downloadPdfFromDevice: async function(uuid, filename){
        // WHAT DOES THIS DO?
        // Removes existing pdf file(s). (If document is renamed this will prevent there being more than 1 pdf in the folder.)
        // Downloads the pdf from the device.

        let cmd0 = `bash ./deviceData/scripts/process_downloadPdfFromDevice.sh "${uuid}" "${filename}.pdf"`;
        let results0;
        try{
            results0 = await _APP.m_shared.runCommand_exec_progress(cmd0, 0, false)
            .catch( function(e) { throw { results: results0, e: e}; } );
        } 
        catch(e){ throw e; }

        // Return some data.
        return results0;
    },
    // Convert the PDf to SVG pages.
    pdfToSvgPages: async function(uuid, filename){
        // WHAT DOES THIS DO?
        // Make sure that the .pdf file exists.
        // Remove the .svg files from the svg folder.
        // Convert the .pdf to .svg pages.
        // Get a new list of svg files in the svg folder. 
        // Sort each page in the svgs list based on filepath alphabetically. (They are still named like : output-page0001.svg)
        // Get the list of page ids for this document. (This will be used as the sort order and the filenames for each page.)
        // Rename the .svg pages to their matching page id. (include the .svg extension.)
        
        let cmd0 = `bash ./deviceData/scripts/process_pdfToSvgPages.sh "${uuid}" "${filename}.pdf"`;
        let results0;
        try{
            results0 = await _APP.m_shared.runCommand_exec_progress(cmd0, 0, false)
            .catch( function(e) { throw { results: results0, e: e}; } );
        } 
        catch(e){ throw e; }

        // Return some data.
        return results0;
    },
    // Optimize the filesize of the SVG pages. 
    optimizeSvgPages: async function(uuid){
        // WHAT DOES THIS DO?
        // Optimize the .svgs in the svg folder.
        
        let cmd0 = `bash ./deviceData/scripts/process_optimizeSvgPages.sh "${uuid}"`;
        let results0;
        try{
            results0 = await _APP.m_shared.runCommand_exec_progress(cmd0, 0, false)
            .catch( function(e) { throw { results: results0, e: e}; } );
        } 
        catch(e){ throw e; }

        // Return some data.
        return results0;
    },
    // Create PNG thumbs of the SVG pages. 
    svgPagesToPngThumbs: async function(uuid, format, w, h){
        // WHAT DOES THIS DO?
        // Remove the .png files from the svgThumbs folder.
        // Create thumbnails based on the .svg files.

        let cmd0 = `bash ./deviceData/scripts/process_svgPagesToPngThumbs.sh "${uuid}" ${format} ${w} ${h}`;
        let results0;
        try{
            results0 = await _APP.m_shared.runCommand_exec_progress(cmd0, 0, false)
            .catch( function(e) { throw { results: results0, e: e}; } );
        } 
        catch(e){ throw e; }

        // Return some data.
        return results0;
    },

    // Convert one file.
    run: async function(uuid, sse_handler = null){
        let ts = performance.now();
        let filename;
        let sendMessage = sse_handler ? sse_handler : console.log;

        // Get the needsUpdate.json file.
        let needsUpdate_file = fs.readFileSync(`deviceData/config/needsUpdate.json`, {encoding:'utf8', flag:'r+'});
        needsUpdate_file = JSON.parse(needsUpdate_file);

        // Check that the specified file is within the needsUpdate.json file.
        let index = needsUpdate_file.findIndex(d=>d.uuid == uuid);
        if(index == -1){
            // console.log(`ABORT: processing.run: uuid: ${uuid} is NOT within needsUpdate.json`);
            sendMessage(`ABORT: processing.run: uuid: ${uuid} is NOT within needsUpdate.json`);
            return {
                "name"    : filename,
                "uuid"    : uuid,
                "fileType": "",
                "pages"   : 0,
                "t_pdf"   : 0,
                "t_toSvg" : 0,
                "t_svgo"  : 0,
            };
        }

        // Find the file's record in rm_fs.
        let recData = _APP.m_shared.rm_fs.DocumentType.find(d=>uuid==d.uuid); 
        if(!recData){ 
            // console.log(`ABORT: processing.run: uuid: ${uuid} is NOT within rm_fs.json`);
            sendMessage(`ABORT: processing.run: uuid: ${uuid} is NOT within rm_fs.json`);
            return {
                "name" : filename,
                "uuid" : uuid,
                "fileType": "",
                "pages"   : 0,
                "t_pdf"   : 0,
                "t_toSvg" : 0,
                "t_svgo"  : 0,
            };
        }

        // Remove illegal characters in the filename.
        filename = _APP.m_shared.replaceIllegalFilenameChars(recData.visibleName);

        // Indicate what file is being processed.
        sendMessage(`PROCESSING: [${recData.fileType}] "${recData.visibleName}"`);
        sendMessage(`  UUID   : ${uuid}`);
        sendMessage(`  META   : [${recData.type}] [${recData.fileType}] [pages: ${recData.pageCount}]`);

        // ****************************
        // Run the processing commands.
        // ****************************

        // These will hold the results from the commands.
        // These will hold the time measurements.
        let errorDetected = false; 
        let results = [
            { func: this.downloadPdfFromDevice, ts:null, args: [uuid, filename],        results:null, error:null, skipped:false, desc: "Downloading the PDF from the device..." },
            { func: this.pdfToSvgPages        , ts:null, args: [uuid, filename],        results:null, error:null, skipped:false, desc: "Converting the PDF to SVG pages..." },
            { func: this.optimizeSvgPages     , ts:null, args: [uuid],                  results:null, error:null, skipped:false, desc: "Optimizing file sizes of the SVG pages..." },
            { func: this.svgPagesToPngThumbs  , ts:null, args: ["png", 180, 210, uuid], results:null, error:null, skipped:false, desc: "Creating PNG thumbs from the SVG pages..." },
        ];
        
        for(let i=0; i<results.length; i+=1){
            let r = results[i];
            if(errorDetected){ 
                sendMessage(`  SKIPPED: ${r.func.name.padEnd(21, " ")}`);
                r.func = r.func.name; 
                r.skipped = true; 
                continue; 
            }

            r.ts = performance.now();
            try{ 
                // sendMessage(`  FUNC   : ${r.func.name.padEnd(21, " ")}: ${r.desc}`);
                sendMessage(`  ${r.desc}`);
                r.results = await r.func(...r.args).catch( function(e) { throw e; } );
                r.ts = (performance.now() - r.ts)/1000;
                sendMessage(`    DONE: Time: ${(r.ts).toFixed(2)} seconds`);
                r.func = r.func.name;
            }
            catch(e){ 
                r.results = e.results;
                r.error = e.e;
                r.ts = (performance.now() - r.ts)/1000;
                errorDetected = true;
                
                sendMessage(`    ERROR:`);
                if(e.e.stdOutHist || e.e.stdErrHist){
                    if(e.e.stdOutHist){ sendMessage(`      ${e.e.stdOutHist}`); }
                    if(e.e.stdErrHist){ sendMessage(`      ${e.e.stdErrHist}`); }
                }
                else{
                    sendMessage(`      No error details to output.`);
                }

                r.func = r.func.name;
            }
        }

        if(!errorDetected){
            // Can now remove this entry from needsUpdate.json
            needsUpdate_file = needsUpdate_file.filter(d=>d.uuid != uuid);

            // Write the needsUpdate.json file. 
            fs.writeFileSync(`deviceData/config/needsUpdate.json`, JSON.stringify(needsUpdate_file,null,1));
            sendMessage("  Updated needsUpdate.json");
        }

        // Return some data.
        let timings = results.map(d=>{
            delete d.args;
            return d;
        });

        sendMessage(`FINISHED: Time: ${ ((performance.now() - ts)/1000).toFixed(2) } seconds`);

        return {
            "name"        : filename,
            "uuid"        : uuid,
            "fileType"    : recData.fileType,
            "pages"       : recData.pageCount,
            "results": timings,
            // "t_TOTAL"     : ts0 + ts1 + ts2 + ts3,
            // "t_pdf"       : ts0,
            // "t_toSvg"     : ts1,
            // "t_svgo"      : ts2,
            // "t_svgThumbs" : ts3,
        };
    },
};

module.exports = _MOD;