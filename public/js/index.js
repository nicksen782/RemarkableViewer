// Static imports. (Should match modList.)
import m_net          from "./m_net.mjs";
import m_nav          from "./m_nav.mjs";
import m_debug        from "./m_debug.mjs";
import m_screenStream from "./m_screenStream.mjs";
import m_syncConvert  from "./m_syncConvert.mjs";
import m_shared       from "./m_shared.mjs";
import m_fileNav      from "./m_fileNav.mjs";
import m_fileView1    from "./m_fileView1.mjs";
import m_fileView2    from "./m_fileView2.mjs";

// Used to set the imports into their app object keys.
const modList = [
    { key:"m_net"         , obj:"m_net"         , from: "./m_net.mjs" },
    { key:"m_nav"         , obj:"m_nav"         , from: "./m_nav.mjs" },
    { key:"m_debug"       , obj:"m_debug"       , from: "./m_debug.mjs" },
    { key:"m_screenStream", obj:"m_screenStream", from: "./m_screenStream.mjs" },
    { key:"m_syncConvert" , obj:"m_syncConvert" , from: "./m_syncConvert.mjs" },
    { key:"m_shared"      , obj:"m_shared"      , from: "./m_shared.mjs" },
    { key:"m_fileNav"     , obj:"m_fileNav"     , from: "./m_fileNav.mjs" },
    { key:"m_fileView1"   , obj:"m_fileView1"   , from: "./m_fileView1.mjs" },
    { key:"m_fileView2"   , obj:"m_fileView2"   , from: "./m_fileView2.mjs" },
];

function test(){
    // DocumentType
    // {
    //     "uuid": "b9f01279-3a76-4a4c-a319-8b9e8673c92e",
    //     "visibleName": "New Sync Method",
    //     "type": "DocumentType",
    //     "parent": "9bc9f1d7-eec4-46ee-9cda-0ac50ffdb7a2",
    //     "deleted": false,
    //     "pageCount": 10,
    //     "fileType": "notebook",
    //     "_time": 1675984789
    // }

    // app.rm_fs.CollectionType.filter(d=>d.visibleName == "New pdf version");
    // app.rm_fs.CollectionType.filter(d=>d['uuid'] == "9bc9f1d7-eec4-46ee-9cda-0ac50ffdb7a2");
}

var app = {
    rm_fs    : { "CollectionType": [], "DocumentType": [] },
    rm_device: {},

    init: async function(){
        // Create the module keys.
        for(let i=0; i<modList.length; i+=1){
            // Save the key. 
            let key = modList[i].key;

            // Set the app key to the obj specified.
            this[key] = eval(modList[i].obj);
            
            // Run the module's init function (if it has one.) 
            if(this[key].module_init){
                if( ! this[key].isModuleLoaded() ){
                    await this[key].module_init(this, key);
                    // console.log(`LOADED: ${key}`);
                }
                else{ console.log(`ALREADY LOADED: ${key}`); }
            } 
        }

        // Select the default view.
        // this.m_nav.showOne("debug");
        // this.m_nav.showOne("syncConvert");
        this.m_nav.showOne("fileNav");
        // this.m_nav.showOne("fileView1");
        // this.m_nav.showOne("fileView2");

        // Add global event listeners.
        await this.addGlobalEvents();
    },
    
    addGlobalEvents: async function(){
        // Global event for keydown.
        document.body.onkeydown = (e)=>{ 
            // For m_fileView1: 
            if(app.m_nav.DOM.fileView1.view.classList.contains("active")){
                app.m_fileView1.goToAdjacentPage(e.key);
            }
        }
    
        // Global event for window.resize.
        window.onresize = (e)=>{ 
            // For m_fileView2: 
            if(app.m_nav.DOM.fileView2.view.classList.contains("active")){
                app.m_fileView2.resizeDispPages(e);
            }
        }
    },
};

(
    function(){
        let handler = async () => {
            // Remove this listener.
            window.removeEventListener('load', handler);

            app.init();
        };
        window.addEventListener('load', handler);
    }
)();

window.app = app;
// export { app };