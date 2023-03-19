const fs = require('fs');
const path = require('path'); 
// const { performance } = require('perf_hooks');
var server;
const express    = require('express');
const app        = express();

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
                
                // Save the app and express references.
                _APP.app = app;
                _APP.express = express;

                // Add routes.
                _APP.consolelog(`addRoutes: ${name}`, 2);
                _MOD.addRoutes(_APP.app, _APP.express);

                // Set the moduleLoaded flag.
                _MOD.moduleLoaded = true;
                resolve();
            }
            else{
                resolve();
            }
        });
    },

    // ROUTES
    // ROUTES
    // ROUTES

    // Adds routes for this module.
    addRoutes: async function(app, express){
        // Default routes:
        app.use('/'            , express.static(path.join(process.cwd(), './public')));
        app.use('/libs'        , express.static(path.join(process.cwd(), './node_modules')));

        // Get the route data.
        let routeObj = await require(_APP.config.node.routes.req)(_APP);

        // Generate routes from file. 
        let len1 = await this.createStaticRoutesFromFile(routeObj.staticRoutes);
        let len2 = await this.createRoutesFromFile(routeObj.routes);
        let len3 = await this.createWebsocketRoutesFromFile(routeObj.websocketRoutes);

        // Output the number of each type of route.
        _APP.consolelog(`Number of static routes added   : ${len1}`, 4);
        _APP.consolelog(`Number of routes added          : ${len2}`, 4);
        _APP.consolelog(`Number of WebSocket routes added: ${len3}`, 4);
    },

    // Creates routes from a file. 
    createRoutesFromFile: async function(array){
        // Get the module keys.
        let module_keys = Object.keys(array);

        // Count the number of routes added.
        let routeCount = 0;

        // List of REST verbs.
        let restVerbs = [ "get", "post", "put", "patch", "delete", "options" ];

        // Go through each module key.
        for(let m=0; m<module_keys.length; m+=1){
            // Get the module_key.
            let mkey = module_keys[m];
            
            // Go through each route for this module key.
            for(let i=0; i<array[mkey].length; i+=1){
                // Get the record. 
                let rec = array[mkey][i];

                // REST route?
                if(restVerbs.indexOf(rec.method) != -1){
                    // Add the actual route to Express.
                    app[rec.method](rec.path, express.json(), rec.func);
                }

                // WebSocket? (ws) 
                else if(rec.method == "ws"){
                    // Do not add the route to Express (unneeded.)
                }

                // Unmatched REST verb or method?
                else{
                    _APP.consolelog(`Cannot add route. Unknown REST verb or method. Method: "${rec.method}", Path: "${rec.path}"`, 4);
                    continue;
                }

                // Add the route to addToRouteList.
                _APP.m_webServer.addToRouteList({ path: rec.path, method: rec.method, args: rec.args, desc: rec.desc, file: mkey });

                // Increment the route count. 
                routeCount += 1;
            }
        }

        // Return the number of routes.
        return routeCount;
    },
    // Creates static routes from a file. 
    createStaticRoutesFromFile: async function(array){
        // Count the number of static routes added.
        let routeCount = 0;

        // Add each static route. 
        for(let i=0; i<array.length; i+=1){
            let rec = array[i];

            // Add the actual route to Express.
            app[rec.type](rec.webPath, express.static( path.join( process.cwd(), rec.localPath ) ));
             
            // Add the route to addToRouteList.
            _APP.m_webServer.addToRouteList({ path: rec.webPath, method: "get", args: [], desc: `LOCAL: ${rec.localPath}`, file: "STATIC" });

            // Increment the count. 
            routeCount += 1;
        }

        return routeCount;
    },
    // TODO
    // Creates WebSocket routes from a file.
    createWebsocketRoutesFromFile: async function(array){
        return array.length;
    },

    // Adds a manual route entry to the routeList.
    addToRouteList : function(obj){
        let file = path.basename(obj.file);
        if(!_APP.routeList[file]){ _APP.routeList[file] = []; }
        _APP.routeList[file].push({
            path  : obj.path, 
            method: obj.method, 
            args  : obj.args,
            desc  : obj.desc,
        });
    },

    // Return the manual routeList.
    getRoutePaths : function(type="manual"){
        let routes;

        switch(type){
            case "manual" : 
                return {
                    manual: _APP.routeList,
                };
                break; 

            default: break; 
        }

        if(type=="manual"){
        }
    },
    
    // Displays the routes in the console (For debug mode.)
    printRoutes : function(_APP){
        // let routes = this.getRoutePaths("manual").manual;
        let routes = _APP.m_webServer.getRoutePaths("manual").manual;
        let restVerbs = [ "get", "post", "put", "patch", "delete", "options" ];

        let staticRoutes = function(){
            // Determine the max lengths for padding. 
            let numRoutes_rest = 0;
            let maxes = { "filename" : 0, "method" : 0, "path" : 0 };
            for(filename in routes){ 
                for(rec of routes[filename]){
                    if(filename == "STATIC"){
                        if(maxes.filename    < filename.length){ maxes.filename = filename.length; }
                        if(rec.method.length > maxes.method   ){ maxes.method = rec.method.length; } 
                        if(rec.path.length   > maxes.path     ){ maxes.path   = rec.path.length; } 
                        numRoutes_rest += 1;
                    }
                }
            }
    
            // Display the REST routes. 
            _APP.consolelog(`ROUTES: (STATIC) (${numRoutes_rest})`, 0);
            for(filename in routes){
                for(rec of routes[filename]){
                    if(filename == "STATIC"){
                        _APP.consolelog(
                            `  ` +
                            `MOD: ${  (filename  ).padEnd(maxes.filename, " ")}` + " || " + 
                            `METHOD: ${(rec.method).padEnd(maxes.method  , " ")}` + " || " + 
                            `PATH: ${  (rec.path  ).padEnd(maxes.path    , " ")}` + " || " + 
                            `DESC: ${  (rec.desc  )}`+
                            ``, 0);
                    }
                }	
            };
        };
        let restRoutes   = function(){
            // Determine the max lengths for padding. 
            let numRoutes_rest = 0;
            let maxes = { "filename" : 0, "method" : 0, "path" : 0 };
            for(filename in routes){ 
                for(rec of routes[filename]){
                    if(restVerbs.indexOf(rec.method) != -1 && filename != "STATIC"){
                        if(maxes.filename    < filename.length){ maxes.filename = filename.length; }
                        if(rec.method.length > maxes.method   ){ maxes.method   = rec.method.length; } 
                        if(rec.path.length   > maxes.path     ){ maxes.path     = rec.path.length; } 
                        numRoutes_rest += 1;
                    }
                }
            }

            // Display the REST routes. 
            _APP.consolelog(`ROUTES: (REST) (${numRoutes_rest})`, 0);
            for(filename in routes){
                for(rec of routes[filename]){
                    if(restVerbs.indexOf(rec.method) != -1 && filename != "STATIC"){
                        _APP.consolelog(
                            `  ` +
                            `MOD: ${  (filename  ).padEnd(maxes.filename, " ")}` + " || " + 
                            `METHOD: ${(rec.method).padEnd(maxes.method  , " ")}` + " || " + 
                            `PATH: ${  (rec.path  ).padEnd(maxes.path    , " ")}` + " || " + 
                            `DESC: ${  (rec.desc  )}`+
                            ``, 0);
                    }
                }	
            };
        };
        let wsRoutes     = function(){
            let numRoutes_ws = 0;
            let maxes = { "filename" : 0, "method" : 0, "path" : 0 };
            maxes = { "filename" : 0, "method" : 0, "path" : 0, "args": 0 };
            for(filename in routes){ 
                for(rec of routes[filename]){
                    if(rec.method == "ws"){
                        if(maxes.filename    < filename.length){ maxes.filename = filename.length; }
                        if(rec.method.length > maxes.method   ){ maxes.method   = rec.method.length; } 
                        if(rec.path.length   > maxes.path     ){ maxes.path     = rec.path.length; } 
                        if(rec.args.length){
                            rec.args.forEach(function(d){
                                if(d.length   > maxes.args   ){ maxes.args   = d.length; } 
                            });
                        }
                        numRoutes_ws += 1;
                    }
                }
            }
            _APP.consolelog(`ROUTES: (WEBSOCKET) (${numRoutes_ws})`, 0);
            for(filename in routes){
                for(rec of routes[filename]){
                    if(rec.method == "ws"){
                        _APP.consolelog(
                            `  ` +
                            `MOD: ${  ( filename           ).padEnd(maxes.filename, " ")}` + " || " + 
                            `METHOD: ${( rec.method         ).padEnd(maxes.method  , " ")}` + " || " + 
                            `PATH: ${  ( rec.path           ).padEnd(maxes.path    , " ")}` + " || " + 
                            `ARGS: ${  ( rec.args.join(",") ).padEnd(maxes.args    , " ")}` + " || " + 
                            `DESC: ${  ( rec.desc  )}`+
                            ``, 0);
                    }
                }	
            };
        };

        staticRoutes();
        restRoutes();
        wsRoutes();


        // WS routes.
    },

    // SERVER START
    // SERVER START
    // SERVER START

    // Starts the WebServer.
    activateServer: async function(){
        return new Promise(async(resolve,reject)=>{
            let conf = _APP.config.node.http;
    
            // Use HTTPS?
            if(conf.useHttps){
                // TODO: Adjust for using a non-self-signed cert.
                // Get the keys. 
                const key  = fs.readFileSync(_APP.config.node.httpsCert.key, "utf-8");
                const cert = fs.readFileSync(_APP.config.node.httpsCert.cert, "utf-8");
                
                if(key && cert){
                    // TODO: Adjust for using a non-self-signed cert.
                    // The cert is configured for "localhost". 0.0.0.0 or 127.0.0.1 will not work.
                    if(_APP.config.node.debug != true){ 
                        conf.host = "localhost";
                    }
                    server = require('https').createServer(  { key, cert }, app );
                }
            }

            // Use HTTP.
            else{
                server = require('http').createServer();
                server.on('request', app);
            }
    
            // Set the server to listen for and handle new connections. 
            await server.listen(conf, async ()=>{
                console.log("");
                let str = `** WEB SERVER READY: "Remarkable Viewer V4" ${conf.useHttps ? "https" : "http"}://${conf.host}:${conf.port} **`;
                console.log("*".repeat(str.length));
                console.log(str);
                console.log("*".repeat(str.length));
                console.log("");
                resolve();
            });
        });
        
    },
};

module.exports = _MOD;
