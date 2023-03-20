let app = null;
let modName = null;
let moduleLoaded = false;

var nav = {
    isModuleLoaded: function(){ return moduleLoaded; },
    module_init: async function(parent, name){
        return new Promise(async (resolve,reject)=>{
            if(!moduleLoaded){
                // Save reference to the parent module.
                app = parent;
    
                // Save module name.
                modName = name;
    
                // Create the DOM cache and add the click event listener to the nav tabs.
                for(let key in this.DOM){
                    // Cache the DOM.
                    this.DOM[key].view = document.getElementById(this.DOM[key].view);
                    this.DOM[key].tab  = document.getElementById(this.DOM[key].tab);

                    // Add event listeners to the tab.
                    this.DOM[key].tab.addEventListener("click", ()=>{
                        this.showOne(key);
                    }, false);
                }

                // Init the sidebar menu. 
                // NOTE: Expects "#LO1_menu_button", "#LO1_sidebar", and ".LO1_sidebar_icon span" to be valid selectors.
                LO1.init();

                // Set the moduleLoaded flag.
                moduleLoaded = true;
                
                resolve();
            }
            else{
                resolve();
            }
        });
    },

    // Holds the DOM for the nav buttons and nav views.
    DOM: {
        'debug': {
            'tab':'navbar_debug_button',
            'view':'navbar_debug_view',
        },
        'syncConvert': {
            'tab':'navbar_syncConvert_button',
            'view':'navbar_syncConvert_view',
        },
        'fileNav': {
            'tab':'navbar_fileNav_button',
            'view':'navbar_fileNav_view',
        },
        'fileView1': {
            'tab':'navbar_fileView1_button',
            'view':'navbar_fileView1_view',
        },
        'fileView2': {
            'tab':'navbar_fileView2_button',
            'view':'navbar_fileView2_view',
        },
    },
    
    // Deactivate all nav tabs and nav views.
    hideAll: function(){
        // Deactivate all views and nav buttons.
        for(let key in this.DOM){
            this.DOM[key].tab.classList.remove("active");
            this.DOM[key].view.classList.remove("active");
        }
    },

    // Activate one nav tab and nav view.
    showOne: function(key){
        // Check that the key is valid.
        if(Object.keys(this.DOM).indexOf(key) == -1){ console.log("WARN: Invalid nav key.", key); return; }

        // Deactivate all views and nav buttons.
        this.hideAll();

        // Active this view and nav button.
        this.DOM[key].tab.classList.add("active");
        this.DOM[key].view.classList.add("active");
    },
};

export default nav;
