const child_process = require('child_process');
var treeKill = require('tree-kill');

let _APP = null;
let modName = null;

let _MOD = {
    moduleLoaded: false,

    cp_child: null,
    script: "deviceData/scripts/reStream.sh",

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

    startRestream: async function(){
        console.log("Starting: restream");
        await this.endRestream();
        this.cp_child = child_process.spawn(
            "bash", [this.script]
        );

        this.cp_child.stdout.on('data' , (e,f)=>{ 
            // console.log("data stdout:", e.toString()); 
        });

        // This listener must be added. If it is not then within 1 minute the output will freeze.
        this.cp_child.stderr.on('data' , (e,f)=>{ 
            // console.log("data stderr:", e.toString()); 
        });
        this.cp_child       .on('error', (e,f)=>{ console.log("error:", e.toString()); });
        this.cp_child       .on('close', (e,f)=>{ this.endRestream(); });
        this.cp_child       .on('exit' , (e,f)=>{ this.endRestream(); });
    },
    endRestream: async function(){
        if(this.cp_child && this.cp_child.pid){ 
            console.log("Closing: restream");
            treeKill(this.cp_child.pid);
            this.cp_child = null;
        }
    },
};

module.exports = _MOD;