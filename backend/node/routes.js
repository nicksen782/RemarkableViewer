const fs = require('fs');
const path = require('path'); 
const { performance } = require('perf_hooks');

let _APP;

let _MOD = {
    funcs: {
        test: function(){ console.log("***************hi"); }, 
    },
    // Specify the routes and group them.  (Added with: createRoutesFromFile),
    routes: {
        m_webServer:[
            {
                "path": "/getRoutePaths", "method": "get",
                "desc": "Outputs a list of manually registered routes.",
                "args": ["type"],
                "func": async (req,res)=>{
                    let result = _APP.m_webServer.getRoutePaths("manual");
                    res.json( result );
                }
            },
        ],
        m_shared: [
        ],
        m_sync:[
            {
                "path": "/rsyncUpdate_and_detectAndRecordChanges", "method": "get",
                "desc": "",
                "args": [],
                "func": async (req,res)=>{
                    // Send headers to indicate that this is an event-stream.
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.flushHeaders();
                    
                    // Set these shared variables.
                    let sse_mode = "sync";
                    let sse_status = "active";
                    
                    // This function will be used instead of console.log.
                    let sse_handler = function(...args){
                        let dataObj = { "mode":sse_mode, "data":args, "status":sse_status };
                        res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
                    };
                    
                    // Run the process and time it.
                    // console.log("STARTED: rsyncUpdate_and_detectAndRecordChanges");
                    // let ts_s = performance.now();
                    let resp = await _APP.m_sync.rsyncUpdate_and_detectAndRecordChanges(sse_handler);
                    // console.log(`FINISH : rsyncUpdate_and_detectAndRecordChanges: ${(performance.now() - ts_s).toFixed(3)} ms`);
                    
                    // End and send the resp.
                    sse_status = "finished";
                    dataObj = { "mode":sse_mode, "data":resp, "status":sse_status };
                    res.end(`data: ${JSON.stringify(dataObj)}\n\n`);
                }
            },
        ],
        m_convert:[
            {
                "path": "/processing.run", "method": "get",
                "desc": "",
                "args": [],
                "func": async (req,res)=>{
                    // Send headers to indicate that this is an event-stream.
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.flushHeaders();

                    // Set these shared variables.
                    let sse_mode = "convert";
                    let sse_status = "active";

                    // This function will be used instead of console.log.
                    let sse_handler = function(...args){
                        let dataObj = { "mode":sse_mode, "data":args, "status":sse_status };
                        res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
                    };

                    // Run the process and time it.
                    // console.log("STARTED: processing.run");
                    // let ts_s = performance.now();
                    let resp = await _APP.m_convert.run(req.query.uuid, sse_handler);
                    // console.log(`FINISH : processing.run: ${(performance.now() - ts_s).toFixed(3)} ms`);

                    // End and send the resp.
                    sse_status = "finished";
                    dataObj = { "mode":sse_mode, "data":resp, "status":sse_status };
                    res.end(`data: ${JSON.stringify(dataObj)}\n\n`);
                }
            },
        ],
        m_screenStream: [
            {
                "path": "/startRestream", "method": "post",
                "desc": "",
                "args": [],
                "func": async (req,res)=>{
                    await _APP.m_screenStream.startRestream();
                    res.json( "startRestream" );
                }
            },
            {
                "path": "/endRestream", "method": "post",
                "desc": "",
                "args": [],
                "func": async (req,res)=>{
                    await _APP.m_screenStream.endRestream();
                    res.json( "endRestream" );
                }
            },
        ],
        m_ui_nav: [
            {
                "path": "/docDebug/:uuid", "method": "get",
                "desc": "",
                "args": [],
                "func": async (req,res)=>{
                    let results = await _APP.m_ui_nav.docDebug(req.params.uuid);
                    res.send( results );
                }
            },
            {
                "path": "/get_rm_fsFile", "method": "post",
                "desc": "",
                "args": [],
                "func": async (req,res)=>{
                    let result = await _APP.m_shared.get_rm_fsFile();
                    res.json( result );
                }
            },
            {
                "path": "/getNeededChanges", "method": "post",
                "desc": "",
                "args": [],
                "func": async (req,res)=>{
                    let results = await _APP.m_ui_nav.getNeededChanges();
                    res.json( results );
                }
            },

            {
                "path": "/getAvailablePages", "method": "post",
                "desc": "",
                "args": [],
                "func": async (req,res)=>{
                    let results = await _APP.m_ui_nav.getAvailablePages(req.body.uuid);
                    res.json( results );
                }
            },

            {
                "path": "/getThumb/:uuid/:pageid", "method": "get",
                "desc": "",
                "args": ["uuid", "pageid"],
                "func": async (req,res)=>{
                    let result = await _APP.m_ui_nav.getThumb(req.params.uuid, req.params.pageid);

                    if(result.found){
                        const file = fs.createReadStream(result.outputFile);
                        const headers = {
                            'Content-Length': result.contentLength,
                            'Content-Type': result.contentType,
                        };
                        res.writeHead(200, headers);
                        file.pipe(res);
                    }
                    else{
                        console.log(`ERROR: File not found. hasMetadata: ${result.hasMetadata}, uuid: ${req.params.uuid}, pageid: ${req.params.pageid}`);
                        res.end("");
                    }
                }
            },
        ],
        m_db:[
            // {
            //     "path": "/backupToFile", "method": "post",
            //     "desc": "",
            //     "args": [],
            //     "func": async (req,res)=>{
            //         let result = await _APP.m_db.backupToFile();
            //         res.json( result );
            //     }
            // },
        
            // {
            //     "path": "/restoreFromFile", "method": "post",
            //     "desc": "",
            //     "args": [],
            //     "func": async (req,res)=>{
            //         // let result = await _APP.m_db.restoreFromFile(req.body.backupSql, req.body.db_filepath);
            //         // res.json( result );
            //     }
            // },
        
            // {
            //     "path": "/getListOfBackups", "method": "post",
            //     "desc": "",
            //     "args": [],
            //     "func": async (req,res)=>{
            //         let result = await _APP.m_db.getListOfBackups();
            //         res.json( result );
            //     }
            // },
        ],
    },

    // Static routes. (Added with: createStaticRoutesFromFile),
    staticRoutes: [
        { "type": "use", "webPath":"/"            , "localPath": './public' },
        { "type": "use", "webPath":"/libs"        , "localPath": './node_modules' },
        { "type": "use", "webPath":"/deviceSvg"   , "localPath": './deviceData/pdf' },
        { "type": "use", "webPath":"/deviceThumbs", "localPath": './deviceData/queryData/meta/thumbnails' },
    ],

    // WebSocket routes. (Added with: createWebsocketRoutesFromFile),
    websocketRoutes: [
    ],
};

module.exports = async function(parent){
    _APP = parent;

    // Return the routes by type.
    return {
        routes         : _MOD.routes,
        staticRoutes   : _MOD.staticRoutes,
        websocketRoutes: _MOD.websocketRoutes,
    }
};
