let app = null;
let modName = null;
let moduleLoaded = false;

var screenStream = {
    isModuleLoaded: function(){ return moduleLoaded; },
    module_init: async function(parent, name){
        return new Promise(async (resolve,reject)=>{
            if(!moduleLoaded){
                // Save reference to the parent module.
                app = parent;

                // Save module name.
                modName = name;

                // Create the DOM cache.
                for(let key in this.DOM){
                    // Cache the DOM.
                    this.DOM[key] = document.getElementById(this.DOM[key]);
                }

                // ADD EVENT LISTENERS.

                // Rsync, update needsUpdate.json
                this.DOM['debug_startRestream'].addEventListener("click", ()=>{ this.startRestream(); }, false);

                // Create the needed_changes table.
                this.DOM['debug_endRestream'].addEventListener("click", ()=>this.endRestream(null), false);

                // Set the moduleLoaded flag.
                moduleLoaded = true;
                
                resolve();
            }
            else{
                resolve();
            }
        });
    },

    // Holds the DOM for elements within this view.
    DOM: {
        // Action buttons.
        'debug_startRestream' : 'debug_startRestream',
        'debug_endRestream'   : 'debug_endRestream',
    },
    startRestream: async function(){
        let dataOptions = { type:"json", method:"POST", body: { } };
        let data = await app.m_net.send(`startRestream`, dataOptions, false);
    },
    endRestream: async function(){
        let dataOptions = { type:"json", method:"POST", body: { } };
        let data = await app.m_net.send(`endRestream`, dataOptions, false);
    },
};

export default screenStream;
