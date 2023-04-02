let app = null;
let modName = null;
let moduleLoaded = false;

var fileView1 = {
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
        'fileView1_container' : 'fileView1_container',
        'thumbs'    : 'openedDoc_thumbs',
        'dispPages' : 'openedDoc_dispPages',
        // navbar_fileView1_view
    },
    pages: [],

    init: async function(){
        // display_needed_changes
        // needed_changes

        // Create the DOM cache.
        for(let key in this.DOM){
            // Cache the DOM.
            this.DOM[key] = document.getElementById(this.DOM[key]);
        }
    },

    //
    getAvailablePages: async function(uuid){
        // Create the options and body data.
        let dataOptions = {
            type:"json", method:"POST",
            body: { uuid: uuid },
        };

        let data = await app.m_net.send(`getAvailablePages`, dataOptions, false);
        return data;
    },

    // Get the url for a page/thumb based on uuid, pageId, and type.
    generateImageUrl : function(uuid, pageId, type){
        let url = "";
        if(type == "page_svg")       { url = `deviceSvg/${uuid}/svg/${pageId}.svg`; }
        else if(type == "page_jpg")  { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
        else if(type == "thumb_png") { url = `deviceSvg/${uuid}/svgThumbs/${pageId}.png`; }
        else if(type == "thumb_jpg") { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
        return url;
    },

    // Create a thumb image using the device's .jpg thumb or this program's .png thumb. Whichever is newer.
    createThumb: async function(uuid, thumbFile, pageNum){
        // 
        let page      = this.pages.output[pageNum];
        let pageId    = page.pageId;
        let newerType = this.pages.output[pageNum].newerThumb;

        // let div = document.createElement("div");
        let div = document.createElement("img");
        div.setAttribute("loading", "lazy");
        div.classList.add("openedDoc_thumb");
        div.title = `Page: ${pageNum+1}\nPageId: ${pageId}\nTHUMB: ${newerType}`;

        // Use the newer thumb image for the thumb.
        if     (newerType == "svgThumb"){ div.setAttribute("src", `${this.generateImageUrl(uuid, pageId, "thumb_png")}`); }
        else if(newerType == "thumb"   ){ div.setAttribute("src", `${this.generateImageUrl(uuid, pageId, "thumb_jpg")}`); }
        else{ console.log(`Both the "thumb" and the "svgThumb" are missing for "${pageId}" newer: ${newerType}`, page); }

        // Add click event listener so that the page can be changed when it's thumbnail is clicked.
        div.onclick = ()=>{ 
            // window.requestAnimationFrame( ()=>{
                this.updatePage(uuid, pageNum); 
            // } );
        };

        // The index is used to filter thumbs when changing the page.
        div.setAttribute("index", pageNum);
        
        // Return the completed div.
        return div;
    },
    
    determineScale: function(parent, element){
        const parentWidth   = parent.clientWidth;
        const parentHeight  = parent.clientHeight;
        const elementWidth  = element.clientWidth;
        const elementHeight = element.clientHeight;
        const scale = Math.min( (parentWidth / elementWidth), (parentHeight / elementHeight) );
        return scale;
    },

    // Create a page image using the device's .jpg thumb or this program's .svg. Whichever is newer.
    updatePage: async function(uuid, pageNum){
        //
        let page      = this.pages.output[pageNum];
        let pageId    = this.pages.output[pageNum].pageId;
        let newerType = this.pages.output[pageNum].newer;

        let imgElem = document.createElement("img");
        // imgElem.setAttribute("loading", "lazy");
        imgElem.classList.add("openedDoc_page");
        imgElem.onload = ()=>{
            imgElem.onload = null;

            // Force an aspect ratio for the image. (3:4)
            let width  = Math.floor(imgElem.width/3) * 3;
            let height = Math.floor(width *4/3);
            imgElem.style["width"]  = (width ) + "px";
            imgElem.style["height"] = (height) + "px";

            // Set the two divs to have the same height as the image.
            this.DOM['thumbs']   .style["max-height"] = height + "px";
            this.DOM['dispPages'].style["max-height"] = height + "px";

            // Determine the scale needed to completely fit the container into the parent. 
            let scale = this.determineScale(app.m_nav.DOM.fileView1.view, this.DOM['fileView1_container']);

            // Update the thumbnail data.
            this.DOM['dispPages'].innerHTML = "";
            this.DOM['dispPages'].append(imgElem);

            // Scale the container.
            this.DOM['fileView1_container'].style.transform = `scale(${scale})`;

            window.requestAnimationFrame( ()=>{
            } );
        };

        if     (newerType == "svg"   ){ imgElem.src = `${this.generateImageUrl(uuid, pageId, "page_svg")}?)`; }
        else if(newerType == "thumbs"){ imgElem.src = `${this.generateImageUrl(uuid, pageId, "page_jpg")}?)`; }
        else{ console.log(`Both the "thumb" and the "svg" are missing for: "${pageId}" newer: ${newerType}`, page); }

        // Use the newer thumb image for the thumb.
        // if     (newerType == "svg"   ){ div.style['background-image'] = `url("${this.generateImageUrl(uuid, pageId, "page_svg")}?")`;  }
        // else if(newerType == "thumbs"){ div.style['background-image'] = `url("${this.generateImageUrl(uuid, pageId, "page_jpg")}?")`;  }
        // else{ console.log(`Both the "thumb" and the "svg" are missing for: "${pageId}" newer: ${newerType}`, page); }

        // Go through the thumbnails and deactivate all. Also collect the the one for the current page.
        let thumbDivs = document.querySelectorAll(".openedDoc_thumb");
        let thisThumbDiv;
        thumbDivs.forEach(d=>{ 
            d.classList.remove("active"); 
            if(d.getAttribute("index") == pageNum){
                thisThumbDiv = d;
            }
        });

        // Add active for the current page's thumbnail. 
        thisThumbDiv.classList.add("active");
    },
    
    // Show the specified document.
    showDocument: async function(uuid){
        // Get the pages data for this document.
        this.pages = await app.m_fileView1.getAvailablePages(uuid);

        // Clear existing thumbnails, generate new ones and add them.
        let thumbs_frag = document.createDocumentFragment();
        for(let i=0; i<this.pages.output.length; i+=1){
            thumbs_frag.append( await this.createThumb(uuid, this.pages.output[i].thumb, i) );
        }
        this.DOM['thumbs'].innerHTML = "";
        this.DOM['thumbs'].append(thumbs_frag);

        // Clear the page placeholder and show the first page.
        this.DOM['dispPages'].innerHTML = "";
        if(this.pages.output.length){ 
            // window.requestAnimationFrame( ()=>{
                this.updatePage(uuid, 0); 
            // } );
        }
        else{ console.log("ERROR: This document does not appear to have a first page.");  }
    },
    
    // Event listener to handle changing the displayed page based on using the keyboard arrow keys. 
    goToAdjacentPage: function(key){
        // Loads the next page and scrolls the thumbnail view. (Does bounds-checking also.)
        
        // Was a matching key pressed?
        if(["ArrowLeft", "ArrowRight"].indexOf(key) != -1){
            // Which page is displayed? Look to the thumbnails. 

            // Get all the thumbnail divs.
            let thumbs = document.querySelectorAll(".openedDoc_thumb");

            // Get the total number of thumbnail divs. 
            let numThumbs = thumbs.length;

            // Determine the active thumbnail in the list of thumbnails. 
            let activeThumb = false;
            let activeThumbIndex = false;
            for(let i=0; i<thumbs.length; i+=1){
                // Is this thumbnail active? 
                if(thumbs[i].classList.contains("active")){
                    // Set the active thumb and the activeThumbIndex and break;
                    activeThumb = thumbs[i];
                    activeThumbIndex = i;
                    break;
                }
            }

            // Did we find the activeThumb?
            if(activeThumb){
                // Set the scrolling options. 
                let options = {behavior: "auto", block: "nearest", inline: "center"};

                if     (key == "ArrowLeft" && activeThumbIndex != 0){
                    activeThumbIndex -= 1;
                    thumbs[activeThumbIndex].click();
                    thumbs[activeThumbIndex].scrollIntoView(options);
                }
                else if(key == "ArrowRight" && activeThumbIndex != numThumbs-1){
                    activeThumbIndex += 1;
                    thumbs[activeThumbIndex].click();
                    thumbs[activeThumbIndex].scrollIntoView(options);
                }
            }

        }
    },
};

export default fileView1;
