function pageflip_init(pages){
	return new Promise(function(resolve, reject){
		for (var i = 0; i < pages.length; i++) {
			var page = pages[i];
			if (i % 2 === 0) {
				page.style.zIndex = (pages.length - i);
			}
		}
		for (var i = 0; i < pages.length; i++) {
			//Or var page = pages[i];
			pages[i].pageNum = i + 1;
			pages[i].onclick = function () {
				pageFlip.flip.handleFlip(this);
			}
		}
		resolve();
	});
}

var pageFlip = {
	util : {
		// Wait. 
		sleep : function(ms){
			return new Promise((resolve) => {
				setTimeout(resolve, ms);
			});
		},
		getThePageNumberPair : function(){
			// Get a handle to the pages of the flipbook. 
			let pages = document.querySelectorAll("#book .page");
			let pagesFlipped = document.querySelectorAll("#book .page.flipped").length;
			let frontCoverPage ;
			let backCoverPage  ;
			for(let i=0; i<pages.length; i+=1){ if(pages[i].classList.contains("cover_page_front")){ frontCoverPage = i; break; } }
			for(let i=0; i<pages.length; i+=1){ if(pages[i].classList.contains("cover_page_back") ){ backCoverPage  = i; break; } }
			return {
				pages          : pages         ,
				numPages       : pages.length  ,
				pageNumLeft    : pagesFlipped-1,
				pageNumRight   : pagesFlipped  ,
				frontCoverPage : frontCoverPage,
				backCoverPage  : backCoverPage ,
			};
		},
	},
	flip : {
		loadUnloadPages : function(){
			let data = pageFlip.util.getThePageNumberPair();
			let belowPageNum = data.pageNumLeft - (4*2); 
			let abovePageNum = data.pageNumLeft + (4*2);

			// Determine pages to keep.
			let toRemove = [];
			let toKeep = [];
			for(let i=1; i<data.numPages; i+=2){
				// Ignore the cover pages.
				if(data.frontCoverPage == i){ continue; }
				if(data.backCoverPage  == i){ continue; }

				// Define the tests. 
				let test1 = i < belowPageNum;
				let test2 = i > abovePageNum;

				if(test1){
					toRemove.push(i);
					toRemove.push(i+1);
				}
				else if(test2){
					toRemove.push(i);
					toRemove.push(i+1);
				}
				else{
					toKeep.push(i);
					toKeep.push(i+1);
				}
			}

			toRemove.forEach(function(p, p_i){
				// Skip the front and back covers.
				if(data.frontCoverPage == p){ return; }
				if(data.backCoverPage  == p){ return; }

				// A handle to the layers. 
				let layer1 = data.pages[p].querySelector(".layer1");
				let layer2 = data.pages[p].querySelector(".layer2");

				// Hide.
				layer1.style["display"] = "none";
				layer2.style["display"] = "none";
			});

			toKeep.forEach(function(p, p_i){
				// Skip the front and back covers.
				if(data.frontCoverPage == p){ return; }
				if(data.backCoverPage  == p){ return; }

				// A handle to the layers. 
				let layer1 = data.pages[p].querySelector(".layer1");
				let layer2 = data.pages[p].querySelector(".layer2");

				// Show
				layer1.style["display"] = "block";
				layer2.style["display"] = "block";
			});

		},
		handleFlip : function(elem){
			if (elem.pageNum % 2 === 0) {
				// console.log("Left page");
				if(elem.previousElementSibling){
					elem.classList.remove('flipped');
					elem.previousElementSibling.classList.remove('flipped');
				}
				// else{
				//	console.log("ERROR: This is the first page.")
				// }
				pageFlip.util.getThePageNumberPair();
			}
			else {
				// console.log("Right page");
				if(elem.nextElementSibling) {
					elem.classList.add('flipped');
					elem.nextElementSibling.classList.add('flipped');
				}
				// else{
				//	console.log("ERROR: This is the last page.")
				// }
			}
			
			// Load/Unload images?
			pageFlip.flip.loadUnloadPages();
		},

		// FINAL.
		flipToPage: async function(pageNum, delayMs=75){
			// console.log("delayMs:", delayMs);
			// Get a handle to the pages of the flipbook. 
			let pages = document.querySelectorAll("#book .page");
			let pagesFlipped = document.querySelectorAll("#book .page.flipped").length;
			let direction;

			// Determine direction.
			if     (pageNum > pagesFlipped){ direction = "F"; }
			else if(pageNum < pagesFlipped){ direction = "B"; }
			else{ return; }

			// AHEAD: Flip pages until the indicated pageNum has been reached (or reaching the last page.)
			if(direction == "F"){
				if(pageNum %2 == 0){ pageNum-=1; }
				for(let i=0; (i<pageNum && i<pages.length); i+=2){
					// Don't flip pages that are already flipped.
					if(pages[i].classList.contains("flipped")){ continue; } ;

					// Flip the page. 
					pageFlip.flip.handleFlip(pages[i]);
		
					// Short wait. 
					await pageFlip.util.sleep(delayMs).catch(function(e) { throw e; }); 
				};
			}
			
			// PREV: Flip pages until the indicated pageNum has been reached (or reaching the first page.)
			else if(direction == "B"){
				if(pagesFlipped %2 == 0){ pagesFlipped-=1; }
				for(let i=pagesFlipped; (i>pageNum && i>0); i-=2){
					// Don't flip pages that are already flipped.
					// if(!pages[i].classList.contains("flipped")){ continue; } ;
					
					// Flip the page. 
					pageFlip.flip.handleFlip(pages[i]);
					
					// Short wait. 
					await pageFlip.util.sleep(delayMs).catch(function(e) { throw e; }); 
				};
			}
		},
	},

	displayFlipbook : function(obj, autoOpenFirstPage){
		return new Promise(async function(resolve, reject){
			let createCoverTop = function(title){
				// Cover - front - page.
				let pageParent = document.createElement("div");
				pageParent.classList.add("page");
				pageParent.classList.add("cover_page_front");
				pageParent.style["width"]  = obj.dims.main.notebookWidth  + "px";
				pageParent.style["height"] = obj.dims.main.notebookHeight + obj.dims.footer.footerHeight + "px";
				pageParent.innerHTML = "";
				pageParent.innerHTML += `<p class="title">${title}</p>`;
				pageParent.setAttribute("pageNum", 0);

				let frag = document.createDocumentFragment();
				let table = document.createElement("table"); 

				// Pages
				let tr_r1 = document.createElement("tr");
				let td_r1_c1 = document.createElement("td"); td_r1_c1.innerHTML = "Pages: ";
				let td_r1_c2 = document.createElement("td"); td_r1_c2.innerHTML = obj.totalPageNums;
				tr_r1.appendChild(td_r1_c1);
				tr_r1.appendChild(td_r1_c2);
				table.appendChild(tr_r1);
				
				// last modified
				let tr_r2 = document.createElement("tr");
				let td_r2_c1 = document.createElement("td"); td_r2_c1.innerHTML = "Modified: ";
				let td_r2_c2 = document.createElement("td"); td_r2_c2.innerHTML = "2021-09-21 05:57:38 PM";
				tr_r2.appendChild(td_r2_c1);
				tr_r2.appendChild(td_r2_c2);
				table.appendChild(tr_r2);

				pageParent.appendChild(table);

				// Return.
				return pageParent;
			};
			let createPages    = async function(pages){
				let frag = document.createDocumentFragment();
				let i = 0;
		
				for(let p = 0; p<obj.totalPageNums; p+=1){
					let img1         = pages.layer1[i];
					let img2         = pages.layer2[i];

					// Create texts.
					let thisPageNum = (i+1).toString(); i+=1;
					let pageText    = ""+thisPageNum+"/"+obj.totalPageNums+"";
					let shortname   = (obj.notebookTitle) ;
		
					// Create the page container. 
					let pageParent = document.createElement("div");
					pageParent.classList.add("page");
					pageParent.style["width"]  = obj.dims.main.notebookWidth  + "px";
					pageParent.style["height"] = obj.dims.main.notebookHeight + obj.dims.footer.footerHeight + "px";
					pageParent.setAttribute("pageNum", i+1);

					// Create the layered images container.
					let layeredImagesDiv = document.createElement("div");
					layeredImagesDiv.classList.add("layeredImagesDiv");
					layeredImagesDiv.style["width"]  = obj.dims.main.notebookWidth  + "px";
					layeredImagesDiv.style["height"] = obj.dims.main.notebookHeight + "px";
					
					// Create layer1 for the layered images container. 
					let layer1 = document.createElement("div");
					layer1.classList.add("layer1");
					layer1.style["width"]  = obj.dims.main.notebookWidth  + "px";
					layer1.style["height"] = obj.dims.main.notebookHeight + "px";
					layer1.style["display"] = "none";
					layer1.style["background-image"] = `url('${img1}')` ;
					
					// Display the first few pages.
					if([1,2,3,4].indexOf(i) != -1){
						// console.log("Displaying l1 of p:"+i);
						layer1.style["display"] = "block";
					}
					
					// Create layer2 for the layered images container. 
					let layer2 = document.createElement("div");
					layer2.classList.add("layer2");
					layer2.style["width"]  = obj.dims.main.notebookWidth  + "px";
					layer2.style["height"] = obj.dims.main.notebookHeight + "px";
					layer2.style["display"] = "none";
					layer2.style["background-image"] = `url('${img2}')` ;
					
					// Display the first few pages.
					if([1,2,3,4].indexOf(i) != -1){
						// console.log("Displaying l2 of p:"+i);
						layer2.style["display"] = "block";
					}
					
					// Create the page footer container.
					let pageFooter = document.createElement("div");
					pageFooter.classList.add("pageFooter_container");
					
					// Create the page footer container - left side.
					let pageFooter_left  = document.createElement("div");
					pageFooter_left.classList.add("pageFooter_left");
					pageFooter_left.innerHTML = `${shortname}`;
					
					// Create the page footer container - right side.
					let pageFooter_right = document.createElement("div");
					pageFooter_right.classList.add("pageFooter_right");
					pageFooter_right.innerHTML = `(${pageText})`;
		
					// Appends
					layeredImagesDiv.appendChild(layer1);
					layeredImagesDiv.appendChild(layer2);
					pageParent.appendChild(layeredImagesDiv);
					pageFooter.appendChild(pageFooter_left);
					pageFooter.appendChild(pageFooter_right);
					pageParent.appendChild(pageFooter);

					// Final append for this page record - to the document fragment. 
					frag.appendChild(pageParent);
				}
		
				// Return the pages fragment.
				return frag;
			};
			let createCoverBack = function(title){
				// Cover - back - page.
				let pageParent = document.createElement("div");
				pageParent.classList.add("page");
				pageParent.classList.add("cover_page_back");
				pageParent.style["width"]  = obj.dims.main.notebookWidth  + "px";
				pageParent.style["height"] = obj.dims.main.notebookHeight + obj.dims.footer.footerHeight + "px";
				pageParent.innerHTML = title;
				pageParent.setAttribute("pageNum", (obj.pages.layer1.length+2));

				// console.log("pages:", pages);

				// Return.
				return pageParent;
			}
			let createContainer = function(topPage, pages, backPage){
				// Book container.
				let book = document.createElement("div");
				book.classList.add("book");
				book.id = "book";
				book.style["width"] = (obj.dims.main.notebookWidth * 2) + "px";
				book.style["height"] = obj.dims.main.notebookHeight + obj.dims.footer.footerHeight + "px";

				// Pages container. 
				let pagesDiv = document.createElement("div");
				pagesDiv.classList.add("pages");
				pagesDiv.style["width"] = (obj.dims.main.notebookWidth * 2) + "px";
				pagesDiv.style["height"] = obj.dims.main.notebookHeight + obj.dims.footer.footerHeight + "px";
		
				// Append.
				pagesDiv.appendChild(topPage);
				pagesDiv.appendChild(pages);
				pagesDiv.appendChild(backPage);
				book.appendChild(pagesDiv);

				// Return.
				return book;
			}
		
			// console.log(obj);
			let coverTop;
			let pages;
			let coverBack;
			let container;
			try{ coverTop  = createCoverTop (obj.notebookTitle);          } catch(e){ console.log("failure in createCoverTop" , e); }
			try{ pages     = await createPages(obj.pages);                } catch(e){ console.log("failure in createPages"    , e); }
			try{ coverBack = createCoverBack("LAST PAGE");                } catch(e){ console.log("failure in createCoverBack", e); }
			try{ container = createContainer(coverTop, pages, coverBack); } catch(e){ console.log("failure in createContainer", e); }

			// Load the html element into the parent.
			obj.destination.innerHTML = "";
			obj.destination.appendChild(container);

			// Was a startDisplayAt value specified?

			let pagesElems = document.querySelectorAll("#book .page");
			await pageflip_init(pagesElems);

			// Flip to the first page after a short delay.
			setTimeout(function(){ 
				if(autoOpenFirstPage){
					// console.log("Auto-opening the first page...");
					pagesElems[0].click();
					resolve();
				}
				else{
					resolve();
				}
			}, 500);
		});

	},
};