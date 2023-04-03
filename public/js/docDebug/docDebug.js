var app = {
    nav: {
        // Holds the DOM for the nav buttons and nav views.
        DOM: {
            'view_thumbs': { 'tab': 'nav_tab_thumbs', 'view': 'nav_view_thumbs' },
            'view_pages' : { 'tab': 'nav_tab_pages' , 'view': 'nav_view_pages'  },
            'view_misc'  : { 'tab': 'nav_tab_misc'  , 'view': 'nav_view_misc'   },
        },

        // Deactivates all nav buttons and views. 
        hideAll: function() {
            // Deactivate all views and nav buttons.
            for (let key in this.DOM) {
                this.DOM[key].tab .classList.remove("active");
                this.DOM[key].view.classList.remove("active");
            }
        },

        // Activates one nav buttons and view. 
        showOne: function(key) {
            // Check that the nav key is valid.
            if(Object.keys(this.DOM).indexOf(key) == -1){ console.log("WARN: Invalid nav key.", key); return; }

            // Deactivate all views and nav buttons.
            this.hideAll();

            // Active this view and nav button.
            this.DOM[key].tab .classList.add("active");
            this.DOM[key].view.classList.add("active");
        },

        // Init for the nav (side.)
        init: async function() {
            // Create the DOM cache and add the click event listener to the nav tabs.
            for (let key in this.DOM) {
                // Cache the DOM.
                this.DOM[key].view = document.getElementById(this.DOM[key].view);
                this.DOM[key].tab  = document.getElementById(this.DOM[key].tab);

                // Add event listeners to the tab.
                this.DOM[key].tab.addEventListener("click", () => { this.showOne(key); }, false);
            }
        },
    },

    shared: {
        // Get the url for a page/thumb based on uuid, pageId, and type.
        generateImageUrl : function(uuid, pageId, type){
            let url = "";
            if(type == "page_svg")       { url = `deviceSvg/${uuid}/svg/${pageId}.svg`; }
            else if(type == "page_jpg")  { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
            else if(type == "thumb_png") { url = `deviceSvg/${uuid}/svgThumbs/${pageId}.png`; }
            else if(type == "thumb_jpg") { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
            return url;
        },
        generatePageLinks: function(){
            let links = [];
            let uuid = data.rmfsRec.uuid;
            for(let i=0; i<data.docData.availablePages.output.length; i+=1){
                let rec = data.docData.availablePages.output[i];
                
                let thumbType = rec.newerThumb;
                if     (thumbType=="svgThumb"){ thumbType = "thumb_png"; }
                else if(thumbType=="thumb"){ thumbType = "thumb_jpg"; }
                else{ console.log("??? thumbType ??"); continue; }
                let thumbUrl = "../" + this.generateImageUrl(uuid, rec.pageId, thumbType);
                
                let pageType = rec.newer;
                if     (pageType=="svg"){ pageType = "page_svg"; }
                else if(pageType=="thumb"){ pageType = "page_jpg"; }
                else{ console.log("??? pageType ??"); continue; }
                let pageUrl = "../" + this.generateImageUrl(uuid, rec.pageId, pageType);
    
                links.push( { pageNum: i, pageId: rec.pageId, thumbUrl: thumbUrl, thumbType: thumbType, pageUrl: pageUrl, pageType: pageType } );
            }
            return links;
        },
    },
    thumbs: {
        DOM: {
            'thumbs_div'         : 'thumbs_div',
        },

        // Init for the view.
        init: async function() {
            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }

            // Add the thumbnail images.
            let frag = document.createDocumentFragment();
            for(let i=0; i<app.imgLinks.length; i+=1){
                let rec = app.imgLinks[i];
                let container = document.createElement("span");
                container.classList.add("thumbnailImg_container");

                let imgElem = document.createElement("img");
                imgElem.setAttribute("loading", "lazy");
                imgElem.setAttribute("alt", "");
                imgElem.setAttribute("title", `PG: ${rec.pageNum+1}/${app.imgLinks.length}, (${rec.pageId})`);
                imgElem.setAttribute("src", rec.thumbUrl);
                imgElem.style.width = "135px";
                imgElem.style.height = "181px";
                imgElem.classList.add("thumbnailImg");
                imgElem.onclick = ()=>{
                    app.pages.ext_changePage(i);
                };

                let row1 = document.createElement("div");
                row1.classList.add("thumbnailImg_row1");
                row1.innerText = `Page: ${rec.pageNum+1}/${app.imgLinks.length}`;
                
                let row2 = document.createElement("div");
                row2.classList.add("thumbnailImg_row2");
                if(rec.thumbType == "thumb_png"){}
                else if(rec.thumbType == "thumb_jpg"){ row2.innerText = "(!) "; }
                row2.innerText += `T: ${rec.thumbType.split("_").pop()}`;
                
                let row3 = document.createElement("div");
                row3.classList.add("thumbnailImg_row3");
                if(rec.pageType == "page_svg"){}
                else if(rec.pageType == "page_jpg"){ row3.innerText = "(!) "; }
                row3.innerText += `P: ${rec.pageType.split("_").pop()}`;

                container.append(row1);
                container.append(row2);
                container.append(row3);
                container.append(imgElem);

                frag.append(container);
            }

            this.DOM['thumbs_div'].append(frag);

            //

            // console.log("data.docData.availablePages:", data.docData.availablePages);
        },
    },

    pages: {
        DOM: {
            'page_select': 'page_select',
            'page_data'  : 'page_data',
            'page_div'   : 'page_div',
            'page_img'   : 'page_img',
        },

        ext_changePage: function(index){
            app.nav.showOne("view_pages");
            this.DOM['page_select'].selectedIndex = index;
            this.DOM['page_select'].dispatchEvent(new Event("change"));
            this.DOM['page_select'].focus();
        },
        // Init for the view.
        init: async function() {
            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }

            // Event listener: change.
            this.DOM['page_select'].addEventListener("change", (e)=>{ 
                let option = this.DOM['page_select'].options[this.DOM['page_select'].selectedIndex]; 
                let url = option.value;
                let thumbType = option.getAttribute("thumbType");
                let pageType = option.getAttribute("pageType");
                this.DOM['page_data'].innerText = `THUMB: ${thumbType}, PAGE: ${pageType}`;
                this.DOM['page_img'].src = url;
            }, false);

            // Populate the select options. 
            let frag = document.createDocumentFragment();
            for(let i=0; i<app.imgLinks.length; i+=1){
                let rec = app.imgLinks[i];
                let option = document.createElement("option");
                option.innerText = `PAGE: ${rec.pageNum+1}/${app.imgLinks.length} (T: ${rec.thumbType.split("_").pop()}, P: ${rec.pageType.split("_").pop()})`;
                option.value = rec.pageUrl;
                option.setAttribute("thumbType", rec.thumbType.split("_").pop());
                option.setAttribute("pageType", rec.pageType.split("_").pop());
                frag.append(option);
            }
            this.DOM['page_select'].append(frag);

            // Load the first page.
            this.DOM['page_select'].dispatchEvent(new Event("change"));
        },
    },

    misc: {
        DOM: {
            'metadata_textarea': 'metadata_textarea',
            'content_textarea' : 'content_textarea',
            'rmfsRec_textarea' : 'rmfsRec_textarea',
        },

        // Init for the view.
        init: async function() {
            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }

            // Populate the textareas.
            this.DOM['rmfsRec_textarea'] .value = JSON.stringify(data.rmfsRec, null, 1);
            this.DOM['metadata_textarea'].value = JSON.stringify(data.metadata.data, null, 1);
            this.DOM['content_textarea'] .value = JSON.stringify(data.content.data, null, 1);
        }
    },

    // Init for the app.
    DOM: {},
    imgLinks: [],
    init: async function() {
        // Create the DOM cache.
        for(let key in this.DOM){
            // Cache the DOM.
            this.DOM[key] = document.getElementById(this.DOM[key]);
        }

        // PRE-INIT
        // Get the links for each thumbnail and page.
        this.imgLinks = app.shared.generatePageLinks();

        // Inits.
        await app.nav.init();
        await app.thumbs.init();
        await app.pages.init();
        await app.misc.init();

        // Show the default view.
        app.nav.showOne("view_thumbs");
        // app.nav.showOne("view_pages");
        // app.nav.showOne("view_misc");
        
        // console.log("data:", data);
        // console.log("this.imgLinks:", this.imgLinks);
    },
};

(
    async function(){
        let handler = async () => {
            // Remove this listener.
            window.removeEventListener('load', handler);

            await app.init();

        };
        window.addEventListener('load', handler);
    }
)();