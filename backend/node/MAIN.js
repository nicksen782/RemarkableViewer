const fs              = require('fs');
const path            = require('path');
// const { performance } = require('perf_hooks');

let _APP = {
    // SHARED
    // Manual route list. (Emulates something like route annotations.)
    routeList: {}, 
    consolelog: function(str, indent=2){
        let prefix = "[DEBUG]";
        try{
            if(_APP.config.toggles.show_APP_consolelog){
                console.log(`${prefix}${" ".repeat(indent)}`, str);
            }
        }
        catch(e){
            console.log(e);
            console.log(`${prefix}${" ".repeat(indent)}`, str);
        }
    },

    // Config
    config : {},

    // Modules
    modList : [
        { "name":"m_webServer"   , "reqFile":"./m_webServer" },
        { "name":"m_screenStream", "reqFile":"./m_screenStream" },
        { "name":"m_shared"      , "reqFile":"./m_shared" },
        { "name":"m_ui_nav"      , "reqFile":"./m_ui_nav" },
        { "name":"m_sync"        , "reqFile":"./m_sync" },
        { "name":"m_convert"     , "reqFile":"./m_convert" },
    ],

    // Make sure that certain directories and files exist.
    fileChecks: async function(){
        // FOLDERS CHECK
        const folders = [
            { label: "config"                   , relPath: "deviceData/config" },
            { label: "custTemplates"            , relPath: "deviceData/custTemplates" },
            { label: "pdf"                      , relPath: "deviceData/pdf" },
            { label: "queryData"                , relPath: "deviceData/queryData" },
            { label: "queryData/meta"           , relPath: "deviceData/queryData/meta" },
            { label: "queryData/meta/metadata"  , relPath: "deviceData/queryData/meta/metadata" },
            { label: "queryData/meta/content"   , relPath: "deviceData/queryData/meta/content" },
            { label: "queryData/meta/thumbnails", relPath: "deviceData/queryData/meta/thumbnails" },
        ];
        for(let rec of folders) {
            if( !fs.existsSync(rec.relPath) ){ 
                console.log(`CREATE FOLDER: ${rec.label ? rec.label : rec.relPath}`);
                fs.mkdirSync(rec.relPath); 
            }
        }

        // FILE CHECK. (copies)
        const copies = [
            { label : "'backend config'", src: "backend/config.example.json", dst: "backend/config.json" },
        ];
        for(let rec of copies) {
            if(!fs.existsSync(rec.dst)){ 
                console.log(`COPY FILE FROM EXAMPLE: ${rec.label ? rec.label : rec.dst}`);
                fs.copyFileSync(rec.src, rec.dst);
            }
        }

        // if(!fs.existsSync("backend/config.json")){ 
        //     console.log(`MISSING: backend/config.json. Creating file from backend/config.example.json`);
        //     fs.copyFileSync("backend/config.example.json", "backend/config.json");
        // }
        
        // FILE CHECK (individual)
        const files = [
            { label: "lastSync.txt"    , dst: "deviceData/config/lastSync.txt"    , content: JSON.stringify(0,null,1) },
            { label: "needsUpdate.json", dst: "deviceData/config/needsUpdate.json", content: JSON.stringify([],null,1) },
            { label: "rm_fs.json"      , dst: "deviceData/config/rm_fs.json"      , content: JSON.stringify({"CollectionType": [], "DocumentType": []},null,1) },
        ];
        for(let rec of files) {
            if( !fs.existsSync(rec.dst) ){
                console.log(`CREATE FILE: ${rec.label ? rec.label : rec.dst}`);
                fs.writeFileSync(rec.dst, rec.content);
            }
        }

        // if( !fs.existsSync(`deviceData/config/lastSync.txt`) ){
        //     console.log("MISSING: lastSync.txt. Creating new file.");
        //     fs.writeFileSync(`deviceData/config/lastSync.txt`, JSON.stringify(0,null,1));
        // }
        // if( !fs.existsSync(`deviceData/config/needsUpdate.json`) ){
        //     console.log("MISSING: needsUpdate.json. Creating new file.");
        //     fs.writeFileSync(`deviceData/config/needsUpdate.json`, JSON.stringify([],null,1));
        // }
        // if( !fs.existsSync(`deviceData/config/rm_fs.json`) ){
        //     console.log("MISSING: rm_fs.json. Creating new file.");
        //     fs.writeFileSync(`deviceData/config/rm_fs.json`, JSON.stringify({"CollectionType": [], "DocumentType": []},null,1));
        // }

        
    },

    // MODULE INITS
    app_init: async function(){
        // Make sure that certain directories and files exist.
        await this.fileChecks();

        // Bring in the config. 
        this.config = JSON.parse( fs.readFileSync("backend/config.json") );

        // Load the modules and perform their module inits.
        for(let i=0; i<this.modList.length; i+=1){
            // Save the name. 
            let name = this.modList[i].name;

            // Require the file. 
            this[name] = await require(this.modList[i].reqFile);

            // Run the module's init function. 
            await this[name].module_init(this, name);
        }
        _APP.consolelog("INITS ARE COMPLETE", 0);
        
        // Only run this if the webServer module was loaded.
        if(this.m_webServer){
            // Show the list of routes.
            this.m_webServer.printRoutes(_APP);
            
            // Run activateServer function.
            await this.m_webServer.activateServer();
        }
    },
};

(
    async function(){
        await _APP.app_init();

        // Do the import.
        // await _APP.m_imports.doImport([]);
        
        return;
    }
)();