function pageflip_init(pages){
	let flipToNextPage = function(elem){
		if(elem.previousElementSibling){
			elem.classList.remove('flipped');
			elem.previousElementSibling.classList.remove('flipped');
		}
		// else{
			// console.log("ERROR: This is the first page.")
		// }
	};
	let flipToPrevPage = function(elem){
		if(elem.nextElementSibling) {
			elem.classList.add('flipped');
			elem.nextElementSibling.classList.add('flipped');
		}
		else{
			// console.log("ERROR: This is the last page.")
		}
	};

	// var pages = document.getElementsByClassName('page');
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
			if (this.pageNum % 2 === 0) {
				flipToNextPage(this);
			}
			else {
				flipToPrevPage(this);
			}
		}
	}
}

var pageFlip = {
	displayFlipbook : async function(obj){
		
		let createCoverTop = function(title){
			// Cover - front - page.
			let pageParent = document.createElement("div");
			pageParent.classList.add("page");
			pageParent.classList.add("cover_page_front");
			pageParent.style["width"]  = obj.dims.main.notebookWidth  + "px";
			pageParent.style["height"] = obj.dims.main.notebookHeight + obj.dims.footer.footerHeight + "px";
			pageParent.innerHTML = "";
			pageParent.innerHTML += `<p class="title">${title}</p>`;

			let frag = document.createDocumentFragment();
			let table = document.createElement("table"); 
			
			// Pages
			let tr_r1 = document.createElement("tr");
			let td_r1_c1 = document.createElement("td"); td_r1_c1.innerHTML = "Pages: ";
			let td_r1_c2 = document.createElement("td"); td_r1_c2.innerHTML = "3";
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
		let createPages = async function(pages){
			let frag = document.createDocumentFragment();
			let i = 0;
	
			for(let p = 0; p<obj.totalPageNums; p+=1){
				let img1 = pages.layer1[i];
				let img2 = pages.layer2[i];
				
				// Create texts.
				let thisPageNum = (i+1).toString(); i+=1;
				let pageText    = ""+thisPageNum+"/"+obj.totalPageNums+"";
				let shortname   = (obj.notebookTitle) ;
	
				// Create the page container. 
				let pageParent = document.createElement("div");
				pageParent.classList.add("page");
				pageParent.style["width"]  = obj.dims.main.notebookWidth  + "px";
				pageParent.style["height"] = obj.dims.main.notebookHeight + obj.dims.footer.footerHeight + "px";

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
				
				if(img1.indexOf("TEST_") != -1){
					let svgBody = await rpt.apis.rawFetch(img1).catch(function(d){ throw e; });
					layer1.innerHTML = svgBody;
				}
				else if(img1 != ""){
					layer1.style["background-image"] = `url('${img1}')` ;
				}
				// else{ layer1.style["background-color"] = "#00ff0088";  }
				
				// Create layer2 for the layered images container. 
				let layer2 = document.createElement("div");
				layer2.classList.add("layer2");
				layer2.style["width"]  = obj.dims.main.notebookWidth  + "px";
				layer2.style["height"] = obj.dims.main.notebookHeight + "px";
				if(img2 != ""){
					layer2.style["background-image"] = `url('${img2}')` ;
				}
				// else{ layer2.style["background-color"] = "#0000ff88";  }
				
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
		try{ coverTop  = createCoverTop (obj.notebookTitle);           } catch(e){ console.log("failure in createCoverTop" , e); }
		try{ coverBack = createCoverBack("LAST PAGE");                 } catch(e){ console.log("failure in createCoverBack", e); }
		try{ pages     = await createPages(obj.pages);                 } catch(e){ console.log("failure in createPages"    , e); }
		try{ container = createContainer(coverTop, pages, coverBack);  } catch(e){ console.log("failure in createContainer", e); }

		// Load the html element into the parent.
		obj.destination.innerHTML = "";
		obj.destination.appendChild(container);

		let pagesElems = document.querySelectorAll("#book .page");
		pageflip_init(pagesElems);

		// Flip to the first page after a short delay.
		setTimeout(function(){ 
			pagesElems[0].click();
		}, 500);

	},
};