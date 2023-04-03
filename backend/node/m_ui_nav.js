const fs              = require('fs');
const path            = require('path');
// const { performance } = require('perf_hooks');
var mime = require('mime-types');

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

    // Gets the page data for the specified notebook.
    getAvailablePages: async function(uuid){
        // Get the pages from metadata.
            // pages array and pageCount.
            // (Note: page starts at 0, not 1.)
        // Determine which of the pages specified by metadata exists.
            // Search the .thumbnail folder.
        // Get the pages in the svg folder. 
            // The number at the end of each filename is the page number. (Note: page starts at 1, not 0.)
            // pg0001.svg
            // pg0002.svg
            // pg0003.svg
        // The rm_fs pages array determines what pages are in a document and the new .svg filenames.
        // Rename the svg files to match the page ids (same as the thumbs.)
        // Both the .svg and the thumb file will be returned as well as the page id and which of the two files is newer.

        // Determine the basePaths.
        let basePath           = `deviceData/pdf/${uuid}`;
        let basePath_svgs      = `deviceData/pdf/${uuid}/svg`;
        let basePath_thumbs    = `deviceData/queryData/meta/thumbnails/${uuid}.thumbnails`;
        let basePath_svgThumbs = `deviceData/pdf/${uuid}/svgThumbs`;
        
        // If the dir(s) does not exist then create it.
        if( !fs.existsSync(`${basePath}`) )          { fs.mkdirSync(`${basePath}`); }
        if( !fs.existsSync(`${basePath_svgs}`) )     { fs.mkdirSync(`${basePath_svgs}`); }
        if( !fs.existsSync(`${basePath_thumbs}`) )   { fs.mkdirSync(`${basePath_thumbs}`); }
        if( !fs.existsSync(`${basePath_svgThumbs}`) ){ fs.mkdirSync(`${basePath_svgThumbs}`); }

        // Get the list of .svg files from the svg folder.
        let files_svgs   = await _APP.m_shared.getItemsInDir(`${basePath_svgs}`  , "files", ".svg").catch(function(e) { console.log("getAvailablePages: getItemsInDir: files_svgs:", e); throw e; });
        if(!files_svgs){ files_svgs = []; }
        files_svgs.forEach((d)=>{ d.filepath = path.basename(d.filepath); });

        // Get the thumb .jpg files.
        let files_thumbs = await _APP.m_shared.getItemsInDir(`${basePath_thumbs}`, "files", ".jpg").catch(function(e) { console.log("getAvailablePages: getItemsInDir: files_thumbs:", e); });
        if(!files_thumbs){ files_thumbs = []; }
        files_thumbs.forEach((d)=>{ d.filepath = path.basename(d.filepath); });
        
        // Get the svgThumbs files. 
        let files_svgsThumbs   = await _APP.m_shared.getItemsInDir(`${basePath_svgThumbs}`  , "files", ".png").catch(function(e) { console.log("getAvailablePages: getItemsInDir: files_svgsThumbs:", e); throw e; });
        if(!files_svgsThumbs){ files_svgsThumbs = []; }
        files_svgsThumbs.forEach((d)=>{ d.filepath = path.basename(d.filepath); });
        
        // This will determine the output order of the pages. 
        let metadata = _APP.m_shared.rm_fs.DocumentType.find(d=>d.uuid == uuid);
        let metaPages = metadata.pages;

        // Get the pdf filename.
        let modifiedVisibleName = _APP.m_shared.replaceIllegalFilenameChars(metadata.visibleName);
        let pdfFile            = `${modifiedVisibleName}.pdf`;

        let output = [];
        missing = [];
        for(let i=0; i<metaPages.length; i+=1){
            // Try to find the thumbnail file that matches this page id.
            let thumb = files_thumbs.find(d=>{ return d.filepath.split(".")[0] == metaPages[i]; });
            
            // Try to find the svg file that matches this page id.
            let svg = files_svgs.find(d=>{ return d.filepath.split(".")[0] == metaPages[i]; });

            // Try to find the svgThumb file that matches this page id.
            let svgThumb = files_svgsThumbs.find(d=>{ return d.filepath.split(".")[0] == metaPages[i]; });

            // Determine which is newer: The .svg file or the .jpg thumbnail file.
            let newer = "";
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
                console.log(`svg  : ${svg}`);

                // Set the svg and the thumb as objects with an empty string for filepath.
                svg   = { filepath: "" };
                thumb = { filepath: "" };
            }

            // Now determine which thumb is newer: The thumb from the device or the svgThumb.
            let newerThumb = "";
            try{
                // If you have both the svgThumb and the thumb...
                if(thumb && svgThumb){
                    if(svgThumb.mtimeMs > thumb.mtimeMs){ newerThumb = "svgThumb"; }
                    else{ newerThumb = "thumb"; }
                }

                // If you have the thumb but not the svgThumb...
                else if(thumb && !svgThumb){ newerThumb = "thumb"; }

                // If you have the svgThumb but not the thumb...
                else if(!thumb && svgThumb){ newerThumb = "svgThumb"; }

                // If you have neither the thumb or the svgThumb...
                else{ newerThumb = ""; }
            }
            catch(e){
                // Display the error.
                console.log(`catch in getAvailablePages while trying to determine the newer thumb file:`, e, )
                console.log(`thumb   : ${thumb}`);
                console.log(`svgThumb: ${svg}`);

                // Set the svgThumb and the thumb as objects with an empty string for filepath.
                svgThumb = { filepath: "" };
                thumb = { filepath: "" };
            }

            // If the thumb was not found add this page id to the missing list.
            if(!thumb){ 
                missing.push(metaPages[i]);
            }

            // Get extensions.
            // let ext_thumb    = "";
            // let ext_svg      = "";
            // let ext_svgThumb = "";
            // if(thumb)   { let s = thumb.filepath   .split("."); ext_thumb    = s[s.length-1]; } 
            // if(svg)     { let s = svg.filepath     .split("."); ext_svg      = s[s.length-1]; } 
            // if(svgThumb){ let s = svgThumb.filepath.split("."); ext_svgThumb = s[s.length-1]; } 

            // Add to the output.
            output.push({
                // thumb     : ext_thumb   , // thumb    ? thumb.filepath    : "",
                // svg       : ext_svg     , // svg      ? svg.filepath      : "",
                // svgThumb  : ext_svgThumb, // svgThumb ? svgThumb.filepath : "",
                pageId    : metaPages[i],
                newer     : newer,
                newerThumb: newerThumb,
                // meta: _APP.m_shared.rm_fs.DocumentType.find(d=>d.uuid == uuid).pages
            });
        }

        // Return the output and the pages that have missing thumbs.
        return { 
            output:output,
            pdfFile:pdfFile,
            // missing:missing,
        };
    },

    // docDebug
    docDebug: async function(uuid){
        let template = fs.readFileSync(`public/docDebug.html`, {encoding:'utf8', flag:'r'});

        // Find the record by UUID. If not found then just return nothing. 
        let rmfsRec = _APP.m_shared.rm_fs.DocumentType.find(d=>d.uuid == uuid);
        if(!rmfsRec){ return ""; }

        // Generate some data.
        let files = {
            "metadata": { 
                // local: path.resolve(`./deviceData/queryData/meta/metadata/${uuid}.metadata`), 
                local: `./deviceData/queryData/meta/metadata/${uuid}.metadata`, 
                data : function(){
                    this.data = JSON.parse( fs.readFileSync(this.local, {encoding:'utf8', flag:'r'}) )
                }  
            },
            "content": { 
                // local: path.resolve(`./deviceData/queryData/meta/content/${uuid}.content`), 
                local: `./deviceData/queryData/meta/content/${uuid}.content`, 
                data : function(){
                    this.data = JSON.parse( fs.readFileSync(this.local, {encoding:'utf8', flag:'r'}) )
                }
            },
            "docData":{
                "dir"           : `/deviceSvg/${uuid}`,
                "availablePages": await _APP.m_ui_nav.getAvailablePages(uuid),
                "svg"           : `/deviceSvg/${uuid}/svg`,
                "deviceThumbs"  : `/deviceThumbs/${uuid}.thumbnails`,
                "svgThumbs"     : `/deviceSvg/${uuid}/svgThumbs`,
                "pdf"           : `/deviceSvg/${uuid}/${_APP.m_shared.replaceIllegalFilenameChars(rmfsRec.visibleName)}.pdf`
            },
            "rmfsRec": rmfsRec,
        };
        files.metadata.data();
        files.content.data();

        // Add the data using string replace.
        template = template.replace(`"metadata": {},`  , `"metadata": ${JSON.stringify(files.metadata)} ,`);
        template = template.replace(`"content": {},`   , `"content" : ${JSON.stringify(files.content)} ,`);
        template = template.replace(`"docData": {},`    , `"docData"  : ${JSON.stringify(files.docData)} ,`);
        template = template.replace(`"rmfsRec": {},`   , `"rmfsRec" : ${JSON.stringify(files.rmfsRec)} ,`);

        // Return the completed file.
        return template;
    },

    // Returns the needsUpdate.json file.
    getNeededChanges: async function(){
        let data = fs.readFileSync(`deviceData/config/needsUpdate.json`, {encoding:'utf8', flag:'r'});
        return JSON.parse(data);
    },

    // Returns the name and data for the newest thumbnail (.jpg or .svg.)
    getThumb: async function(uuid, pageid){
        let tmp = {};

        let basePath_thumbs    = `deviceData/queryData/meta/thumbnails/${uuid}.thumbnails`;
        let basePath_svgThumbs = `deviceData/pdf/${uuid}/svgThumbs`;
        let metadata = _APP.m_shared.rm_fs.DocumentType.find(d=>d.uuid == uuid);

        if(!metadata){
            return {
                found        : false,
                hasMetadata: false,
            };
        }

        tmp.visibleName = metadata.visibleName;

        let stats_jpgThumb;
        let stats_pngThumb;
        try{ stats_jpgThumb = await fs.promises.lstat(`${basePath_thumbs}/${pageid}.jpg`)   .catch(function(e) { throw e; }); } catch(e){ }
        try{ stats_pngThumb = await fs.promises.lstat(`${basePath_svgThumbs}/${pageid}.png`).catch(function(e) { throw e; }); } catch(e){ }

        let outputStats;
        let outputFile = "";

        // If we have both files then we can compare which is newer. 
        if(stats_jpgThumb && stats_pngThumb){
            if(stats_jpgThumb.mtimeMs > stats_pngThumb.mtimeMs){
                tmp.newer = "jpg";
                outputFile = `${basePath_thumbs}/${pageid}.jpg`
                outputStats = stats_jpgThumb;
            }
            else if(stats_jpgThumb.mtimeMs < stats_pngThumb.mtimeMs){
                tmp.newer = "png";
                outputFile = `${basePath_svgThumbs}/${pageid}.png`
                outputStats = stats_pngThumb;
            }
        }
        // We don't have both files. Get the values for the file that we do have. 
        else{
            if(stats_pngThumb){
                tmp.newer = "png2";
                outputFile = `${basePath_svgThumbs}/${pageid}.png`
                outputStats = stats_pngThumb;
            }
            else if(stats_jpgThumb){
                tmp.newer = "jpg2";
                outputFile = `${basePath_thumbs}/${pageid}.jpg`
                outputStats = stats_jpgThumb;
            }
        }
        
        // Did we get the data for a file? If so, stream it out.
        if(outputFile && outputStats){
            return {
                found        : true,
                hasMetadata  : metadata ? true : false,
                outputFile   : outputFile,
                contentLength: outputStats.size,
                contentType  : mime.lookup(outputFile)
            };

            // console.log("RETURNING:", tmp);
            const file = fs.createReadStream(outputFile);
            const headers = {
                'Content-Length': outputStats.size,
                'Content-Type': mime.lookup(outputFile),
            };
            res.writeHead(200, headers);
            file.pipe(res);
            // console.log("--");
        }
        // We did not get a file. Send blank output. 
        else{
            return {
                found        : false,
                hasMetadata  : metadata ? true : false,
            };
            console.log("MISSING DATA:", tmp);
            res.end("");
            // console.log("--");
        }
    },

};

module.exports = _MOD;