let app = null;
let modName = null;
let moduleLoaded = false;

// await app.debug5View.showDocument("b9f01279-3a76-4a4c-a319-8b9e8673c92e");

var fileView2 = {
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
            //     // Action buttons.
            //     'thumbs'      : 'openedDoc_thumbs',
            //     'dispPages'   : 'openedDoc_dispPages',
            },
        uuid: "",
        pages: [],
        metadata: [],

        init: async function(){
            // display_needed_changes
            // needed_changes

            // Create the DOM cache.
            for(let key in this.DOM){
                // Cache the DOM.
                this.DOM[key] = document.getElementById(this.DOM[key]);
            }
        },

        resizeDispPages: function(e){
            return;
            // console.log("resizeDispPages:", e, e.eventPhase, e.returnValue);
            // console.log("test1", e.target.innerWidth, e.target.innerHeight, window.innerWidth, window.innerHeight);

            let viewContainer2 = document.querySelector("#viewContainer2");
            let viewContainer2_thumbs = document.querySelector("#viewContainer2_thumbs");
            let viewContainer2_divider = document.querySelector("#viewContainer2_divider");

            let containerDims = viewContainer2.getBoundingClientRect();
            let thumbsDims    = viewContainer2_thumbs.getBoundingClientRect();
            let dividerDims   = viewContainer2_divider.getBoundingClientRect();

            
            let pagesWidth = (containerDims.width - thumbsDims.width - dividerDims.width)/2;
            pagesWidth  = 2 * Math.floor(pagesWidth  / 2) - 160;
            
            let viewContainer2_leftPage  = document.getElementById("viewContainer2_leftPage");
            let viewContainer2_rightPage = document.getElementById("viewContainer2_rightPage");

            viewContainer2_leftPage.style.width = `${pagesWidth}px`; 
            viewContainer2_rightPage.style.width = `${pagesWidth}px`;

            // viewContainer2_leftPage.style.height = `${pagesWidth}px`; 
            // viewContainer2_rightPage.style.height = `${pagesWidth}px`;

            console.log(pagesWidth);
        },

        generateImageUrl : function(uuid, pageId, type){
            let url = "";
            if(type == "page_svg")       { url = `deviceSvg/${uuid}/svg/${pageId}.svg`; }
            else if(type == "page_jpg")  { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
            else if(type == "thumb_png") { url = `deviceSvg/${uuid}/svgThumbs/${pageId}.png`; }
            else if(type == "thumb_jpg") { url = `deviceThumbs/${uuid}.thumbnails/${pageId}.jpg`; }
            return url;
        },
        getAspectRatio: function(w,h, gcfOnly=false){
            let greatestCommonFactor;
            
            // Get the greatest common factor.
            if(h==0){ greatestCommonFactor = w; }
            else    { greatestCommonFactor = this.getAspectRatio (h, w % h, true); }
            
            // Only return the gcf?
            if(gcfOnly){ return greatestCommonFactor; }

            // Normal return.
            return {
                gcf   : greatestCommonFactor,
                // dims  : {w:w, h:h},
                // aspect: `${w/greatestCommonFactor}:${h/greatestCommonFactor}`,
                rw   : w/greatestCommonFactor,
                rh   : h/greatestCommonFactor,
            };
        },
        getAspectRatios: function (w, h) {
            const commonFactors = [];
    
            // Check for trivial cases
            if (w === 0 || h === 0) {
                return commonFactors;
            }
    
            // Find common factors
            for (let i = 1; i <= w && i <= h; i++) {
                if (w % i === 0 && h % i === 0) {
                commonFactors.push(i);
                }
            }
    
            return commonFactors;
        },
        showDocument: async function(uuid){
            return;
            // Get/store values for later use.
            this.uuid = uuid;
            this.pages = await app.m_fileView1.getAvailablePages(uuid);
            this.metadata = app.rm_fs.DocumentType.find(d=>d.uuid == uuid);
            this.pdfFile = app.m_net.getServerUrl() + `/deviceSvg/${uuid}/${encodeURIComponent(this.pages.pdfFile)}?`;
            
            let page1svg = this.generateImageUrl(uuid, this.pages.output[4].pageId, "page_svg");
            let page2svg = this.generateImageUrl(uuid, this.pages.output[5].pageId, "page_svg");
            let page1png = this.generateImageUrl(uuid, this.pages.output[4].pageId, "thumb_png");
            let page2png = this.generateImageUrl(uuid, this.pages.output[5].pageId, "thumb_png");
            let page3png = this.generateImageUrl(uuid, this.pages.output[6].pageId, "thumb_png");
            let page4png = this.generateImageUrl(uuid, this.pages.output[7].pageId, "thumb_png");

            document.querySelector("#viewContainer2_thumbs img:nth-child(1)").src = page1png;
            document.querySelector("#viewContainer2_thumbs img:nth-child(2)").src = page2png;
            document.querySelector("#viewContainer2_thumbs img:nth-child(3)").src = page3png;
            document.querySelector("#viewContainer2_thumbs img:nth-child(4)").src = page4png;

            // let viewContainer2_thumbs = document.querySelector("#viewContainer2_thumbs");
            // let dims2 = viewContainer2_thumbs.getBoundingClientRect();
            // let viewContainer2_divider = document.querySelector("#viewContainer2_divider");
            // let dims3 = viewContainer2_divider.getBoundingClientRect();

            // --sidebar-closed-width

            let data = [
                { img:null, uuid:uuid, pageId:this.pages.output[4].pageId, type:"page_svg", side:"left" },
                { img:null, uuid:uuid, pageId:this.pages.output[5].pageId, type:"page_svg", side:"right" },
            ];
            let proms = [];
            for(let i=0; i<data.length; i+=1){
                data[i].img = new Image();
                proms.push( new Promise(async (res,rej)=>{ data[i].img.onload = ()=>{ 
                    // data[i].img.width  = 2 * Math.ceil(data[i].img.width  / 2);
                    // data[i].img.height = 2 * Math.ceil(data[i].img.height / 2);
                    res(); 
                } }) );
                data[i].img.src = app.m_net.getServerUrl() + "/" + this.generateImageUrl(data[i].uuid, data[i].pageId, data[i].type);
            }
            await Promise.all(proms);
            // console.log(data);
            // let viewContainer2 = document.querySelector("#viewContainer2");
            // let viewContainer2_thumbs = document.querySelector("#viewContainer2_thumbs");
            // let viewContainer2_divider = document.querySelector("#viewContainer2_divider");
            // let dims1 = viewContainer2.getBoundingClientRect();
            // let dims2 = viewContainer2_thumbs.getBoundingClientRect();
            // let dims3 = viewContainer2_divider.getBoundingClientRect();
            let leftPage = document.querySelector("#viewContainer2_leftPage");
            let rightPage = document.querySelector("#viewContainer2_rightPage");
            leftPage .innerHTML = ""; 
            rightPage.innerHTML = "";
            leftPage .append(data[0].img); 
            rightPage.append(data[1].img);

            // setTimeout(()=>{
                // this.resizeDispPages();
            // }, 2000)
            // console.log("debug5view:");
            // console.log("  Requested document uuid:", this.uuid);
            // console.log("  Requested document pages:", this.pages);
            // console.log("  Requested document metadata:", this.metadata);
            // console.log(`  There are "${this.metadata.pageCount}" pages in "${this.metadata.visibleName}"`);
            // console.log("  Link to the pdf:",  this.pdfFile); 
            // console.log("viewContainer2        :", dims1.width, dims1.height);
            // console.log("viewContainer2_thumbs :", dims2.width, dims2.height);
            // console.log("viewContainer2_divider:", dims3.width, dims3.height);
            // console.log("Container width:", dims1.width);
            // console.log("Available width:", dims1.width - dims2.width - dims3.width);
            // console.log("per page width:", (dims1.width - dims2.width - dims3.width)/2);
            // console.log("per page height:", (dims1.height - dims2.height - dims3.height)/1);

            // console.log(this.getAspectRatio(data[0].img.width, data[0].img.height));
            
            // return; 

            // let img1 = new Image();
            // let img2 = new Image();
            // // img1.setAttribute("loading", "lazy");
            // // img2.setAttribute("loading", "lazy");
            // img1.src = app.m_net.getServerUrl() + "/" + page1svg;
            // img2.src = app.m_net.getServerUrl() + "/" + page2svg;
            // proms.push( new Promise(async (res,rej)=>{ img1.onload = ()=>{ res(); } }) );
            // proms.push( new Promise(async (res,rej)=>{ img2.onload = ()=>{ res(); } }) );
            // console.log("now we wait.", proms, img1.src, img2.src);
            // console.log(img1.src);
            // console.log(img2.src);
            // await Promise.all(proms);
            // console.log("DONE WAITING.");

            // let viewContainer2 = document.querySelector("#viewContainer2");

            // INCONSISTENT
            // All notebook svg output appears to be 593 by 792.
            // pdf: 816 1056
            // 794 1123

            // console.log(window.getComputedStyle(viewContainer2));
            // console.log(viewContainer2.getBoundingClientRect());

            // let leftPage = document.querySelector("#viewContainer2_leftPage");
            // let rightPage = document.querySelector("#viewContainer2_rightPage");

            // leftPage .innerHTML = ""; 
            // rightPage.innerHTML = "";
            // leftPage .append(img1); 
            // rightPage.append(img2);

            // let leftPage_img = document.querySelector("#viewContainer2_leftPage img");
            // let rightPage_img = document.querySelector("#viewContainer2_rightPage img");

            // document.querySelector("#viewContainer2_thumbs img:nth-child(1)").src = page1png;
            // document.querySelector("#viewContainer2_thumbs img:nth-child(2)").src = page2png;
            // document.querySelector("#viewContainer2_thumbs img:nth-child(3)").src = page3png;
            // document.querySelector("#viewContainer2_thumbs img:nth-child(4)").src = page4png;

            // return;

            // console.log("page1svg:", page1svg);
            // console.log("page2svg:", page2svg);
            // console.log("page1png:", page1png);
            // console.log("page2png:", page2png);
            // console.log("page3png:", page3png);
            // console.log("page4png:", page4png);
            // return;

            // TEMP DATA FOR LOAD.
            // document.querySelector("#viewContainer1_dispPages_l img").src = page1svg;
            // document.querySelector("#viewContainer1_dispPages_r img").src = page2svg;
            // document.querySelector("#viewContainer1_thumbs img:nth-child(1)").src = page1png;
            // document.querySelector("#viewContainer1_thumbs img:nth-child(2)").src = page2png;

            // console.log("debug5view:");
            // console.log("  Requested document uuid:", this.uuid);
            // console.log("  Requested document pages:", this.pages);
            // console.log("  Requested document metadata:", this.metadata);
            // console.log(`  There are "${this.metadata.pageCount}" pages in "${this.metadata.visibleName}"`);
            // console.log("  Link to the pdf:",  this.pdfFile); 

            //
        },
};

export default fileView2;
