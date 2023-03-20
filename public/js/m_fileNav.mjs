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
    showCollection: function(parent){
        let entries = this.getEntriesInCollectionType(parent); 

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
                crumb.onclick = ()=>{ this.showCollection(parentPathBreadcrumbs.uuids[i]); }

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
        let frag = document.createDocumentFragment();

        frag.append( createPathBreadcrumbsContainer( entries.parentPathBreadcrumbs ) );

        frag.append( document.createElement("br") );
        for(let i=0; i<entries.CollectionType.length; i+=1){
            let parentHasEntries = this.getEntriesInCollectionType(entries.CollectionType[i].uuid).DocumentType.length;
            frag.append(createCollectionTypeContainer( entries.CollectionType[i], parentHasEntries ));
        }
        frag.append( document.createElement("br") );
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

        // Flags for root and trash
        let isAtRoot = false;
        let isAtTrash = false;

        // Set the initial currId to the file's parent uuid.
        let currId = file.parent;

        // Allow the search for only up to 20 levels. 
        for(let i=0; i<20; i+=1){
            // End on "" or "trash".
            if(currId == ""      || file.parent == "")     { isAtRoot=true; break; }
            if(currId == "trash" || file.parent == "trash"){ isAtTrash=true; break; }

            // Get the parent's visible name. 
            let obj = app.rm_fs["CollectionType"].find(d=>d.uuid == currId);

            // Add the visibleName to the fullPath.
            fullPath.unshift(obj.visibleName);

            // End on "" or "trash".
            if(obj.parent == ""      || file.parent == "")     { isAtRoot=true; break; }
            if(obj.parent == "trash" || file.parent == "trash"){ isAtTrash=true; break; }

            // Get the next uuid in the chain.
            let nextObj = app.rm_fs["CollectionType"].find(d=>d.uuid == obj.parent)

            // If a result was found then set the currId to it's uuid.
            if(nextObj && nextObj.uuid){ currId = nextObj.uuid; }

            // If no file was found then handle the breaking of the loop.
            else{ 
                if(file.parent == "trash"){ currId = "trash"; }
                else{ currId = ""; }
                break; 
            }
        }

        // Add to the fullPath based on flags set.
        if(isAtRoot)      { fullPath.unshift("/My files"); }
        else if(isAtTrash){ fullPath.unshift("/trash"); }

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
            visibleNames: [
                'My files', 
                '_My Projects', 
                'Remarkable Page Turner',
                'Old notes - v3'
            ],
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

        // Get a handle to the CollectionType that the uuid is referring to.
        let file = app.rm_fs["CollectionType"].find(d=>d.uuid == uuid);

        // Check if the parent is "".
        if(uuid == ""){
            results.visibleNames.unshift("My files");
            results.uuids.unshift("");
        }
        // Check if the parent is "trash".
        else if(uuid == "trash"){
            results.visibleNames.unshift("trash");
            results.uuids.unshift("trash");
        }
        // Look for parents, add them to the list until parent is "".
        else{
            let currSearchDepth = 0;
            let maxSearchDepth = 20;
    
            // Get the first uuid to check against.
            let obj = app.rm_fs["CollectionType"].find(d=>d.uuid == file.uuid);

            // Keep searching until reaching the root or trash or going passed maxSearchDepth.
            while(
                currSearchDepth < maxSearchDepth
            ){
                // Record this.
                results.visibleNames.unshift(obj.visibleName);
                results.uuids.unshift(obj.uuid);

                // End at root?
                if(obj.parent == ""){
                    // console.log("End at ''");
                    results.visibleNames.unshift("My files");
                    results.uuids.unshift("");
                    break;
                }
                // End at trash?
                else if(obj.parent == "trash"){
                    // console.log("End at 'trash'");
                    results.visibleNames.unshift("trash");
                    results.uuids.unshift("trash");
                    break;
                }
                // Continue: get the next parent.
                else{
                    obj = app.rm_fs["CollectionType"].find(d=>d.uuid == obj.parent);
                    currSearchDepth += 1;
                }
            }
        }

        // Add the fullVisiblePath.
        results.fullVisiblePath = "/" + results.visibleNames.join("/");

        // Return the results.
        return results;
    },

    // debug3 - file nav
    getEntriesInCollectionType: function(parent){
        let collections = app.rm_fs.CollectionType
        .filter(d=>{ if(!d.deleted) { return d.parent == parent; } })
        .map(d=>{ return {...d, basepath: this.getParentPath(d.uuid, "CollectionType", true) } } )
        .sort(function(a, b){
            // Convert to lowercase (Might not be needed.)
            let keya = a.visibleName.toLowerCase();
            let keyb = b.visibleName.toLowerCase();
            
            // Sort ascending.
            if (keya < keyb) { return -1; }
            if (keya > keyb) { return  1; }
            return 0; 
        });
        
        let documents = app.rm_fs.DocumentType
        .filter(d=>{ if(!d.deleted) { return d.parent == parent; } })
        .map(d=>{ return {...d, basepath: this.getParentPath(d.uuid, "DocumentType", true) } } )
        .sort(function(a, b){
            // Convert to lowercase (Might not be needed.)
            let keya = a.visibleName.toLowerCase();
            let keyb = b.visibleName.toLowerCase();
            
            // Sort ascending.
            if (keya < keyb) { return -1; }
            if (keya > keyb) { return  1; }
            return 0; 
        });

        return {
            parentPathBreadcrumbs : this.getParentPathBreadcrumbs(parent),
            CollectionType        : collections,
            DocumentType          : documents,
        };
    },
};

export default fileNav;
