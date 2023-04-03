let app = null;
let modName = null;
let moduleLoaded = false;

var debug = {
    isModuleLoaded: function(){ return moduleLoaded; },
    module_init: async function(parent, name){
        return new Promise(async (resolve,reject)=>{
            if(!moduleLoaded){
                // Save reference to the parent module.
                app = parent;

                // Save module name.
                modName = name;

                await this.init();

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
        'delete_container'        : 'files_to_delete_container',
        'files_to_delete_refresh' : 'files_to_delete_refresh',
        'delete_deleteSelected'   : 'files_to_delete_deleteSelected',
        'delete_checkAll'         : 'files_to_delete_checkAll',
        'delete_uncheckAll'       : 'files_to_delete_uncheckAll',
        'delete_output'           : 'files_to_delete_output',
    },

    // Creates a row for each deleted record.
    createDeletionRows: function(){
        // Query app.rm_fs to determine the list of files/folders that are marked as deleted: true
        let toDelete = {
            "CollectionType":[],
            "DocumentType":[],
        };

        // Look for deleted records.
        toDelete.CollectionType = app.rm_fs.CollectionType.filter(d=>d.deleted);
        toDelete.DocumentType   = app.rm_fs.DocumentType.filter(d=>d.deleted);

        // Create the data if there is any.
        if( (toDelete.CollectionType.length || toDelete.DocumentType.length) ){
            let frag = document.createDocumentFragment();
            let keys = Object.keys(toDelete);

            // Go through the keys (applying the same actions for each.)
            for(let k=0; k<keys.length; k+=1){
                let key = keys[k];
                
                // We have the key. Interate through the records and create the rows...
                for(let i=0; i<toDelete[key].length; i+=1){
                    let rec = toDelete[key][i];
                    let table, tr, td1, td2;

                    table = document.createElement("table");
                    table.classList.add("deletionRecord");

                    // Name
                    tr = table.insertRow(); td1 = tr.insertCell(); td2 = tr.insertCell();
                    td1.innerText = "Name  :";
                    td2.innerText = rec.visibleName;
                    td2.classList.add("delete_visibleName");

                    // Type
                    tr = table.insertRow(); td1 = tr.insertCell(); td2 = tr.insertCell();
                    td1.innerText = "Type  :";
                    td2.innerText = `[${rec.type}]`;
                    td2.classList.add("delete_docType");
                    
                    // UUID
                    tr = table.insertRow(); td1 = tr.insertCell(); td2 = tr.insertCell();
                    td1.innerText = "UUID  :";
                    td2.innerText = rec.uuid;
                    td2.classList.add("delete_uuid");
                    if(rec.type == "DocumentType"){
                        td2.classList.add("delete_uuid_DocumentType");
                        td2.title = "Right-click to access docDebug.";
                        td2.oncontextmenu = (e)=>{ 
                            // Open the new tab (should be reusable.)
                            window.open(`docDebug/${rec.uuid}`, "RMV2_CHILD").focus();
                            // Prevent the context menu from appearing.
                            return false; 
                        }
                    }
                    
                    // Delete
                    tr = table.insertRow(); td1 = tr.insertCell(); td2 = tr.insertCell();
                    td1.innerText = "Delete:";
                    // td2.innerText = "";

                    // Delete: NO
                    let deleteNo = document.createElement("button");
                    deleteNo.classList.add("deleteButton", "deleteNo", "active");
                    deleteNo.innerText = "NO";
                    deleteNo.onclick = ()=>{ deleteYes.classList.remove("active"); deleteNo.classList.add("active"); }
                    
                    // Delete: YES
                    let deleteYes = document.createElement("button");
                    deleteYes.classList.add("deleteButton", "deleteYes");
                    deleteYes.innerText = "YES";
                    deleteYes.onclick = ()=>{ deleteYes.classList.add("active"); deleteNo.classList.remove("active"); }

                    td2.append(deleteNo, deleteYes);

                    frag.append( table );
                }
            }

            // Clear the output and then replace the output with the new rows. 
            this.DOM['delete_output'].innerHTML = "";
            this.DOM['delete_output'].append(frag);
        }
        else{
            this.DOM['delete_output'].innerHTML = "NONE";
        }
    },

    // Makes the deletion request. 
    device_delete1DocumentFiles: async function(uuid){
        let dataOptions = {
            type:"json", method: "POST",
            body: { uuid: uuid },
        };
        let data = await app.m_net.send(`device_delete1DocumentFiles`, dataOptions, false);
        return data;
    },

    init: async function(){
        // Create the DOM cache.
        for(let key in this.DOM){
            // Cache the DOM.
            this.DOM[key] = document.getElementById(this.DOM[key]);
        }

        this.DOM['delete_deleteSelected']  .addEventListener("click", async ()=>{ 
            // Get a list of tables that have the .deleteYes button also having the .active class.
            let tables = Array.from( this.DOM['delete_output'].querySelectorAll("table.deletionRecord .deleteYes.active") ).map(d=>d.closest("table"));
            
            // Create an array of objects where each object has the uuid value, visibleName, type, and a reference to the table. 
            let toDelete = [];
            for(let i=0; i<tables.length; i+=1){
                let uuid           = tables[i].querySelector(".delete_uuid").innerText;
                let visibleName    = tables[i].querySelector(".delete_visibleName").innerText;
                let delete_docType = tables[i].querySelector(".delete_docType").innerText;
                toDelete.push({
                    table      : tables[i],
                    uuid       : uuid,
                    visibleName: visibleName,
                    type       : delete_docType,
                });
            }

            for(let i=0; i<toDelete.length; i+=1){
                toDelete[i].table.style['background-color'] = "yellow";
                let data = await this.device_delete1DocumentFiles(toDelete[i].uuid);
                
                if(!data.error){
                    console.log(`SUCCESS REMOVING: [${toDelete[i].type}] ${toDelete[i].visibleName} (${toDelete[i].uuid})`);
                    toDelete[i].table.remove();
                }
                else{
                    let text = "";
                    if(data.e.stdOutHist){ text += "\nO: " + data.e.stdOutHist ; }
                    if(data.e.stdErrHist){ text += "\nE: " + data.e.stdErrHist ; }
                    console.log(`FAILURE REMOVING: [${toDelete[i].type}] ${toDelete[i].visibleName}:`, text ?? "");
                    toDelete[i].table.style['background-color'] = "red";
                }
            }

        }, false); 

        this.DOM['delete_checkAll']  .addEventListener("click", ()=>{ 
            let tables = Array.from( this.DOM['delete_output'].querySelectorAll("table.deletionRecord") );
            for(let i=0; i<tables.length; i+=1){
                let yes = tables[i].querySelector(".deleteYes");
                let no = tables[i].querySelector(".deleteNo");
                yes.classList.add("active");
                no.classList.remove("active");
            }
        }, false); 

        this.DOM['delete_uncheckAll'].addEventListener("click", ()=>{ 
            let tables = Array.from( this.DOM['delete_output'].querySelectorAll("table.deletionRecord") );
            for(let i=0; i<tables.length; i+=1){
                let yes = tables[i].querySelector(".deleteYes");
                let no = tables[i].querySelector(".deleteNo");
                yes.classList.remove("active");
                no.classList.add("active");
            }
        }, false); 
        
        this.DOM['files_to_delete_refresh'].addEventListener("click", ()=>{ 
            this.createDeletionRows();
        }, false);

        // Create the deletion rows. 
        this.createDeletionRows();
    },

};

export default debug;
