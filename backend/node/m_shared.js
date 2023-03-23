const fs              = require('fs');
const path            = require('path');
const child_process   = require('child_process');

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
                
                // Load the rm_fs.json file. 
                _APP.consolelog(`Load rm_fs.json`, 2);
                let data = await this.get_rm_fsFile();
                this.rm_fs = data.rm_fs;
                this.rm_device = data.rm_device;

                // Set the moduleLoaded flag.
                _MOD.moduleLoaded = true;
                resolve();
            }
            else{
                resolve();
            }
        });
    },

    // Holds the rm_fs.
    rm_fs: {
        "CollectionType":[],
        "DocumentType":[],
    },

    //
    replaceIllegalFilenameChars : function(str){
        return str.replace(/[/\\?%*:|"<>]/g, '-');
    },
    // Returns the rm_fs.json file.
    get_rm_fsFile: async function(){
        // Get the rm_fs.json file.
        let rm_fs = fs.readFileSync(`deviceData/config/rm_fs.json`, {encoding:'utf8', flag:'r'});
        rm_fs = JSON.parse(rm_fs);

        // TODO: Get some device data.
        //
        let rm_device = {};

        // Return the data.
        return {
            rm_fs    : rm_fs,
            rm_device: rm_device,
        }
    },

    // Used for running shell commands. 
    runCommand_exec_progress : async function(cmd, expectedExitCode=0, progress=true, outputCallback=null){
        // EXAMPLE: cmd="ls", expectedExitCode=0, progress=true, outputCallback=(msg)=>{ console.log(msg); }
        // progress will output data as it is received by the command.
        // outputCallback will be passed the data to be handled.

        return new Promise(function(cmd_res, cmd_rej){
            const proc = child_process.spawn(cmd, { shell: true });
    
            let stdOutHist = "";
            let stdErrHist = "";
    
            proc.stdout.on('data', (data) => {
                if(progress){
                    console.log(`${data}`);
                }
                if(outputCallback){
                    outputCallback(`${data}`);
                }
                stdOutHist += data;
            });
    
            proc.stderr.on('data', (data) => {
                if(progress){
                    console.error(`  ${data}`);
                }
                if(outputCallback){
                    outputCallback(`${data}`);
                }
                stdErrHist += data;
            });
    
            proc.on('exit', (code) => {
                if(code == expectedExitCode){
                    if(typeof stdOutHist == "string"){ stdOutHist = stdOutHist.trim(); } 
                    if(typeof stdErrHist == "string"){ stdErrHist = stdErrHist.trim(); } 
                    cmd_res({
                        "stdOutHist": stdOutHist,
                        "stdErrHist": stdErrHist,
                    }); 
                }
                else{
                    // console.log(`  child process exited with code ${code}`);
                    // console.log(`  cmd: ${cmd}`);
                    if(typeof stdOutHist == "string"){ stdOutHist = stdOutHist.trim(); } 
                    if(typeof stdErrHist == "string"){ stdErrHist = stdErrHist.trim(); } 
                    cmd_rej({
                        "cmd": cmd,
                        "stdOutHist": stdOutHist,
                        "stdErrHist": stdErrHist,
                    });
                }
            });
    
        });
    },

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

module.exports = _MOD;