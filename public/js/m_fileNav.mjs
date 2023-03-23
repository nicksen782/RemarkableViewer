let app = null;
let modName = null;
let moduleLoaded = false;

var fileNav = {
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
        // Action buttons.
        'filelistDiv' : 'd3_filelist',
        'showTrash'  :'dataDivShowTrash',
        'showDeleted':'dataDivShowDeleted',
        // 
    },

    init: async function(){
        // display_needed_changes
        // needed_changes

        // Create the DOM cache.
        for(let key in this.DOM){
            // Cache the DOM.
            this.DOM[key] = document.getElementById(this.DOM[key]);
        }
        
        // this.showCollection("");
        this.showCollection("9bc9f1d7-eec4-46ee-9cda-0ac50ffdb7a2");

        // ADD EVENT LISTENERS.

        this.DOM['showTrash']  .addEventListener("click", ()=>{ app.m_fileNav.showCollection("trash", true); }, false);
        this.DOM['showDeleted'].addEventListener("click", ()=>{ app.m_fileNav.showCollection("deleted", true); }, false);

        // let folders     = app.rm_fs.DocumentType  
        //     .filter(d=>{ if(!d.deleted) { return d.parent == ""; } })
        //     .map(d=>{ return {visibleName:d.visibleName, deleted: d.deleted} } );

        // console.log( "Collections in <root>:", collections );
        // console.log( "Documents   in <root>:", folders );
    },

    showDocument: async function(uuid){
        // Load the document.
        if(app.m_fileView1.showDocument){ await app.m_fileView1.showDocument(uuid); }
        if(app.m_fileView2.showDocument){ await app.m_fileView2.showDocument(uuid); }

        // Show the view.
        app.m_nav.showOne("fileView1");
        // app.m_nav.showOne("fileView2");
    },
    showCollection: function(parent, debugOutput=false){
        let entries = this.getEntriesInCollectionType(parent); 
        if(debugOutput){ console.log(entries); }
        // {
        //     parentPathBreadcrumbs : this.getParentPathBreadcrumbs(parent),
        //     CollectionType        : collections,
        //     DocumentType          : documents,
        // }

        /* 
            Navigation display:
            Acts like "breadcrumbs".
            Any link here can be clicked to go to that collection.
            Starts at "My files", separated by ">", last link is bold.
        */

        /* 
            CollectionType display:
            Inline div/span.
            Contains a folder icon (black if populated, white if not populated.)
            Clicking on the div anywhere will call showCollection.
        */

        /* 
            DocumentType display:
            Containing div.
            Thumbnail div using the first page thumbnail synced from the device.
            Title div.
            Div containing pageCount, displayed, sync status.
            Clicking on the div anywhere will call showDocument.
        */

        let createPathBreadcrumbsContainer = (parentPathBreadcrumbs)=>{
            let outer = document.createElement("div");
            let frag = document.createDocumentFragment();

            // visibleNames and uuids should have the same length.
            let maxLen = parentPathBreadcrumbs.visibleNames.length;
            for(let i=0; i<parentPathBreadcrumbs.visibleNames.length; i+=1){
                // Create the greater-than sign.
                if(i!=0){
                    let gt = document.createElement("span");
                    gt.classList.add("gt_sign", "crumb");
                    gt.innerHTML = " > ";
                    frag.append(gt);
                }
                
                // Create the crumb.
                let crumb = document.createElement("span");
                crumb.classList.add("crumb");

                // Use different text and an extra class for the root.
                if(parentPathBreadcrumbs.uuids[i] == ""){
                    crumb.classList.add("myfiles");
                    crumb.innerHTML = "My files";
                }
                // Use the visibleName.
                else{
                    crumb.innerHTML = parentPathBreadcrumbs.visibleNames[i];
                }

                // Is this the last crumb? If so then add the "activeCollection" class.
                if(i+1 == maxLen){
                    crumb.classList.add("activeCollection");
                }

                // Add click listener so that the user can click to navigate to the collection.
                crumb.onclick = ()=>{ 
                    this.showCollection(parentPathBreadcrumbs.uuids[i]);
                 }

                frag.append(crumb);
            }

            outer.append(frag);
            return outer;
        };
        let createCollectionTypeContainer = (rec, parentHasEntries=false)=>{
            let collection = document.createElement("span"); 
            collection.classList.add("navFileIcon", "CollectionType");
            
            if(parentHasEntries){ collection.classList.add("full"); }
            else                { collection.classList.add("empty"); }

            collection.innerText = rec.visibleName;

            collection.onclick = ()=>{ this.showCollection(rec.uuid); }

            return collection;
        };
        let createDocumentTypeContainer = (rec)=>{
            // Create
            let div_outer     = document.createElement("div"); div_outer.classList.add("DocumentType_file_outer");
            let div_inner     = document.createElement("div"); div_inner.classList.add("DocumentType_file_inner");
            let div_thumb     = document.createElement("div"); div_thumb.classList.add("DocumentType_file_thumb");
            let div_title     = document.createElement("div"); div_title.classList.add("DocumentType_file_title");
            let div_info      = document.createElement("div"); div_info.classList.add("DocumentType_file_info");
            let div_pages     = document.createElement("div"); div_pages.classList.add("DocumentType_file_pages");
            let div_displayed = document.createElement("div"); div_displayed.classList.add("DocumentType_file_displayed");
            let div_sync      = document.createElement("div"); div_sync.classList.add("DocumentType_file_sync");

            // Append
            div_outer.append(div_inner);
            div_inner.append(div_thumb);
            div_inner.append(div_title);
            div_inner.append(div_info);
            div_info.append(div_pages);
            div_info.append(div_displayed);
            div_info.append(div_sync);

            // Set/configure.
            div_outer.onclick = ()=>{ this.showDocument(rec.uuid); }
            div_title.innerText = rec.visibleName;
            div_title.title = rec.visibleName;
            div_pages.innerText = `Pages: ${rec.pageCount}`;

            div_displayed.innerText = "DISPLAYED";
            if(rec.synced){ div_sync.classList.add("synced"); }
            else          { div_sync.classList.add("notSynced"); }
            div_sync.title = `Synced To RM Cloud: ${rec.synced}\nUpdated: ${rec.modified}`;

            // OLD WAY
            // div_thumb.style['background-image'] = `url("deviceThumbs/${rec.uuid}.thumbnails/${rec.pages[0]}.jpg")`;
            
            // NEW WAY
            div_thumb.style['background-image'] = `url("getThumb/${rec.uuid}/${rec.pages[0]}")`;
            
            // Can use the .png from svgThumbs once it can be determined which is the newer file. 
            // It works now but I want whichever is the latest one for display.
            // div_thumb.style['background-image'] = `url("deviceSvg/${rec.uuid}/svgThumbs/${rec.pages[0]}.png")`;

            // Return.
            return div_outer;
        };

        // Start the document fragment. 
        let frag = document.createDocumentFragment();

        // Generate the breadcrumbs. 
        frag.append( createPathBreadcrumbsContainer( entries.parentPathBreadcrumbs ) );
        frag.append( document.createElement("br") );

        // Generate the CollectionType icons. 
        for(let i=0; i<entries.CollectionType.length; i+=1){
            // Determine if this CollectionType contains any docs or folders.
            let parentEntries = this.getEntriesInCollectionType(entries.CollectionType[i].uuid);
            let numDocs  = parentEntries.DocumentType.length;
            let numColls = parentEntries.CollectionType.length;
            let parentHasEntries = numDocs || numColls;

            // Add the entry.
            frag.append(createCollectionTypeContainer( entries.CollectionType[i], parentHasEntries ));
        }
        frag.append( document.createElement("br") );

        // Generate the DocumentType icons. 
        for(let i=0; i<entries.DocumentType.length; i+=1){
            frag.append(createDocumentTypeContainer( entries.DocumentType[i] ));
        }
        frag.append( document.createElement("br") );

        this.DOM['filelistDiv'].innerHTML = "";
        this.DOM['filelistDiv'].append(frag);
    },

    // Returns the full path for the given uuid and type.
    // debug3 - file nav
    getParentPath: function(uuid, type, addVisibleNameToEnd=false){
        // USAGE:
        // this.getParentPath(uuid  , "DocumentType");
        // this.getParentPath(parent, "CollectionType");

        // Get a handle to the DocumentType or CollectionType that the uuid is referring to.
        let file = app.rm_fs[type].find(d=>d.uuid == uuid);

        // fullPath will be added to this array. 
        let fullPath = [];

        // Flags for root, trash, and "deleted".
        let isAtRoot = false;
        let isAtTrash = false;
        let isAtDeleted = false;

        // Set the initial currId to the file's parent uuid.
        let currId = file.parent;

        // Allow the search for only up to 20 levels. 
        const maxSearchDepth = 20;
        for(let i=0; i<maxSearchDepth; i+=1){
            // End on "" or "trash" or "deleted".
            if(currId == ""        || file.parent == "")       { isAtRoot=true; break; }
            if(currId == "trash"   || file.parent == "trash")  { isAtTrash=true; break; }
            if(currId == "deleted" || file.parent == "deleted"){ isAtDeleted=true; break; }

            // Get the parent's visible name. 
            let obj = app.rm_fs["CollectionType"].find(d=>d.uuid == currId);

            // Add the visibleName to the fullPath.
            fullPath.unshift(obj.visibleName);

            // End on "" or "trash" or "deleted".
            if(obj.parent == ""        || file.parent == "")       { isAtRoot=true; break; }
            if(obj.parent == "trash"   || file.parent == "trash")  { isAtTrash=true; break; }
            if(obj.parent == "deleted" || file.parent == "deleted"){ isAtDeleted=true; break; }

            // Get the next uuid in the chain.
            let nextObj = app.rm_fs["CollectionType"].find(d=>d.uuid == obj.parent)

            // If a result was found then set the currId to it's uuid.
            if(nextObj && nextObj.uuid){ currId = nextObj.uuid; }

            // If no file was found then handle the breaking of the loop.
            else{ 
                if     (file.parent == "trash")  { currId = "trash"; }
                else if(file.parent == "deleted"){ currId = "deleted"; }
                else{ currId = ""; }
                break; 
            }
        }

        // Add to the fullPath based on flags set.
        if(isAtRoot)        { fullPath.unshift("/My files"); }
        else if(isAtTrash)  { fullPath.unshift("/trash"); }
        else if(isAtDeleted){ fullPath.unshift("/deleted"); }

        // Join the fullPath with "/" as separators, ending with a "/".
        fullPath = fullPath.join("/") + "/";
        
        // Add the visibleName of the file to the end of the string if requested.
        if(addVisibleNameToEnd){
            fullPath += file.visibleName;
        }
        
        // Return the completed fullPath (trimmed).
        return fullPath.trim();
    },

    // debug3 - file nav
    getParentPathBreadcrumbs: function(uuid){
        // Summary: Look for parents, add them to the list until parent is "", "trash", "deleted".
        // Example usage: this.getParentPathBreadcrumbs("7e16a6a5-a592-44d0-9b2e-f1c110650a6f");
        /* 
            Intended to provide a list of UUIDs and visibleName for each CollectionType 
            down from the path of the specified CollectionType uuid.
            Results will be:
                an object containing two objects containing arrays and one string for the full visible path.
         */
        /* 
        Example output:
        {
            visibleNames: [ 'My files', '_My Projects', 'Remarkable Page Turner', 'Old notes - v3' ],
            uuids: [
                "",
                "72a27ab3-aebf-490c-bda7-a8c057e927df",
                "4f668058-bfd5-402f-a4dd-e7a3e83f1578"
                "7e16a6a5-a592-44d0-9b2e-f1c110650a6f"
            ],
            fullVisiblePath: "/My files/_My Projects/Remarkable Page Turner/Old notes - v3"
        } 
        */

        // Holds the results.
        let results = {
            visibleNames: [],
            uuids: [],
            fullVisiblePath: "",
        };

        // Flags and constraints. 
        let initiallyAtEnd = false;
        let currSearchDepth = 0;
        const maxSearchDepth = 20;

        // Utility functions. 
        const addCrumb   = (name, uuid)=>{ results.visibleNames.unshift(name); results.uuids.unshift(uuid); };
        const addMyFiles = ()=>{ results.visibleNames.unshift("My files"); results.uuids.unshift(""); };
        const addTrash   = ()=>{ results.visibleNames.unshift("Trash");    results.uuids.unshift("trash"); };
        const addDeleted = ()=>{ results.visibleNames.unshift("Deleted");  results.uuids.unshift("deleted"); };

        // Get a handle to the CollectionType that the uuid is referring to.
        const file = app.rm_fs["CollectionType"].find(d=>d.uuid == uuid);
        let currentCollectionType = {};

        // Make sure that CollectionType is found (or "", "trash", "deleted".)
        if(!file){ 
            // Not found. At the end. Handle.
            if(uuid == "" || uuid == "trash" || uuid == "deleted"){
                initiallyAtEnd = true; 
                currentCollectionType.parent = uuid;
            }

            // Not found. Not at the end. Error.
            else{
                throw `Missing CollectionType: uuid: ${uuid}`; 
                return; 
            }
        }

        // We have the file. Get the first uuid to check against.
        else{
            currentCollectionType = app.rm_fs["CollectionType"].find(d=>d.uuid == file.uuid);
        }
        
        // Keep searching until reaching the end or going passed maxSearchDepth.
        while( currSearchDepth < maxSearchDepth ){
            // Increment the searchDepth counter. 
            currSearchDepth += 1;

            // Add the crumb if we are not at the end.
            if(!initiallyAtEnd){
                addCrumb(currentCollectionType.visibleName, currentCollectionType.uuid);
            }

            // Have we reached the end (root?)
            if(currentCollectionType.parent == ""){ addMyFiles(); break; }
            
            // Have we reached the end (trash?)
            else if(currentCollectionType.parent == "trash"){ addTrash(); addMyFiles(); break; }
            
            // Have we reached the end (deleted?)
            else if(currentCollectionType.parent == "deleted"){ addDeleted(); addMyFiles(); break; }

            // Not at the end. Get the next parent and continue.
            else{
                currentCollectionType = app.rm_fs["CollectionType"].find(d=>d.uuid == currentCollectionType.parent);
            }
        }

        // Add the fullVisiblePath.
        results.fullVisiblePath = "/" + results.visibleNames.join("/");

        // Return the results.
        return results;
    },

    // debug3 - file nav
    getEntriesInCollectionType: function(parent){
        const getEntryData = (type) => {
            return app.rm_fs[type].filter(d=>{ 
                if     (parent == "trash")  { return d.parent == parent; }
                else if(parent == "deleted"){ return d.parent == parent; }
                else if(!d.deleted)         { return d.parent == parent; } 
                return false;
            })
            .map(d=>{ 
                return {
                    ...d, 
                    basepath: this.getParentPath(d.uuid, type, true) 
                } 
            } )
            .sort(function(a, b){
                // Convert to lowercase (Might not be needed.)
                let keya = a.visibleName.toLowerCase();
                let keyb = b.visibleName.toLowerCase();
                
                // Sort ascending.
                if (keya < keyb) { return -1; }
                if (keya > keyb) { return  1; }
                return 0; 
            });
        };

        return {
            parentPathBreadcrumbs : this.getParentPathBreadcrumbs(parent),
            CollectionType        : getEntryData("CollectionType"),
            DocumentType          : getEntryData("DocumentType"),
        };
    },
};

export default fileNav;
