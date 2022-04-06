const fs              = require('fs');
const { performance } = require('perf_hooks');
// const { spawn }       = require('child_process');
// const path            = require('path');
// const async_mapLimit  = require('promise-async').mapLimit;

let _APP = null;

let _MOD = {
	// Init this module.
	module_init: async function(parent){
		// Save reference to ledger.
		_APP = parent;
		
		// Add routes.
		_MOD.addRoutes(_APP.app, _APP.express);
	},

	// Adds routes for this module.
	addRoutes         : function(app, express){
	},

	pdfPageToPng      : function(srcFile, destFile){
		return new Promise(async function(res_pdfPageToPng, rej_pdfPageToPng){
			let options = [
				"-alpha off", // Gives control of the alpha/matte channel of an image.
				// "-antialias"   , // Enable/Disable of the rendering of anti-aliasing pixels when drawing fonts and lines.
				// "+antialias"   , // Enable/Disable of the rendering of anti-aliasing pixels when drawing fonts and lines.
				// "-colorspace Gray", // Set the image colorspace.
				"-grayscale Rec709Luminance", // Set the image colorspace.
				// "-colors 8"  , // Set the preferred number of colors in the image.
				// "-depth 3"     , // Color depth is the number of bits per channel for each pixel.
				"-depth 8"     , // Color depth is the number of bits per channel for each pixel.
				// "+depth"     , // Color depth is the number of bits per channel for each pixel.
				"-strip"       , // Strip the image of any profiles, comments or these PNG chunks: bKGD,cHRM,EXIF,gAMA,iCCP,iTXt,sRGB,tEXt,zCCP,zTXt,date.
			];
	
			let cmd = `` + 
				`convert ${options.join(" ")} ` +
				`"${srcFile}" ` + // `"./DEVICE_DATA/xochitl/029d4e39-5bd5-47d0-96dd-1808d5fb5b77.pdf[0]" ` +
				`"${destFile}" `  // `"DEVICE_DATA_IMAGES/029d4e39-5bd5-47d0-96dd-1808d5fb5b77/pages/KOLBE1.pdf-0.png" ` }
			;
			
			let results;
			try{ 
				results = await _APP.m_funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
				results = results.stdOutHist.split("\n");
				res_pdfPageToPng(results);
				return; 
			}
			catch(e){ 
				console.log("Command failed:", e); 
				rej_pdfPageToPng(e); 
				return; 
			}
		});
	},
	
	rotate            : function(srcFile, degrees){
		return new Promise(async function(res_rotate, rej_rotate){
			let cmd = `convert -precision 15 "${srcFile}" -rotate ${degrees}\! "${srcFile}"`;
			let results;
			try{
				results = await _APP.m_funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
				res_rotate(); 
			}
			catch(e){ 
				console.log("Command failed:", e); 
				rej_rotate(e); 
				return; 
			}
		});
	},
	
	resize            : function(srcFile, newWidth, newHeight){
		return new Promise(async function(res_resize, rej_resize){
			let cmd = `convert "${srcFile}" -precision 15 -resize ${newWidth}x${newHeight}` +'! ' + `"${srcFile}"`;
			let results;
			try{
				results = await _APP.m_funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
				res_resize(); 
				return; 
			}
			catch(e){ 
				console.log("Command failed:", e); 
				rej_resize(e); 
				return; 
			}
		});
	},
	
	createPngSvg      : function(destPagesFilenamePng, newDims, destPagesFilenameSvg, svgDims){
		return new Promise(async function(res_createPngSvg, rej_createPngSvg){
			// Get the file and encode to base64.
			let base64 = fs.readFileSync( destPagesFilenamePng, 'base64');
			base64 = 'data:image/png;base64,' + base64;
	
			let svgFileTEST = `` +
			`<svg xmlns="http://www.w3.org/2000/svg" width="${newDims.width}" height="${newDims.height}">\n`+
			`	\n` +
			`	<!--\n` +
			`		newDims.width : ${newDims.width}\n` +
			`		newDims.height: ${newDims.height}\n` +
			`		svgDims.width : ${svgDims.width}\n` +
			`		svgDims.height: ${svgDims.height}\n` +
			`	-->\n` +
			`	\n` +
			`	<g>\n` +
			`		<image width="${newDims.width}" height="${newDims.height}" href="${base64}" />\n`+
			`	</g>\n` +
			`</svg>\n`
			;
	
			try{ 
				fs.writeFileSync(destPagesFilenameSvg, svgFileTEST);
				res_createPngSvg();
				return; 
			}
			catch(e){ 
				console.log("Command failed:", e); 
				rej_createPngSvg(e); 
				return; 
			}
	
		});
	},
	
	getDimensions     : function(srcFile){
		return new Promise(async function(res_getDimensions, rej_getDimensions){
			let cmd = `identify "${srcFile}"`;
	
			let results;
			try{ 
				results = await _APP.m_funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
				results = results.stdOutHist.trim().split("\n");
				
				let arr = [];
				results.forEach(function(line, line_i){
					// Trim the line. 
					line = line.trim();
	
					// Add null entry if the line is blank. 
					if(line == ""){ arr.push(null); return; }
					
					// Remove the filename part of the line.
					line = line.replace(srcFile, "");
	
					// Split the line on " ".
					let splits = line.split(" ");
					let type   = splits[1];
					let dims   = splits[2].split("x");
					let width  = parseFloat(dims[0]);
					let height = parseFloat(dims[1]);
	
					arr.push({
						pageNum : line_i  ,
						type      : type    ,
						width     : width   ,
						height    : height  ,
						doRotate  : width > height ? true : false,
						ratio     : _MOD.getRatio(width, height)
					});
				});
	
				res_getDimensions(arr);
				return; 
			}
			catch(e){ 
				console.log("Command failed:", e); 
				rej_getDimensions(e); 
				return; 
			}
	
			// console.log(results.stdOutHist);
	
		});
	},
	
	getRatio          : function(numerator, denominator){
		let a = numerator;
		let b = denominator;
		let c;
		
		while (b) {
			c = a % b; 
			a = b; 
			b = c;
		}
	
		let returnValue = `${""+(numerator / a)}:${"" + (denominator / a)}`;
		return returnValue;
	},
	
	incrementalResize : function(orgWidth, orgHeight, desiredRatio="3:4"){
		let loops = 1404;
		let ax = parseInt(desiredRatio.split(":")[0]);
		let ay = parseInt(desiredRatio.split(":")[1]);
		let width ;
		let height;
	
		return {
			width    : orgWidth    ,
			height   : orgHeight   ,
			orgWidth : orgWidth ,
			orgHeight: orgHeight,
			success  : true,
			where    : "success: KEEP original dimensions.",
			"triggeredBy":{
				"width:" : width  >= orgWidth,
				"height:": height >= orgHeight,
			}
		};
	
		
		// // Set width and height to ax and ay.
		// if(orgWidth >= 1404 || orgWidth >= 1872){
		// 	width  = ax;
		// 	height = ay;
		// }
		// else{
		// 	// Start with width and height equal to ax and ay.
		// 	width  = ax;
		// 	height = ay;
	
		// 	// Increase width and height by ax and ay until the orgWidth or orgHeight have been reached. 
		// 	for(let i=0; i<loops; i+=1){
		// 		if(width >= orgWidth && height >= orgWidth){
		// 			break;
		// 		}
		// 		else{
		// 			width  += ax;
		// 			height += ay;
		// 		}
		// 	}
	
		// 	return {
		// 		width    : width    ,
		// 		height   : height   ,
		// 		orgWidth : orgWidth ,
		// 		orgHeight: orgHeight,
		// 		success  : true,
		// 		where    : "success: Near document max dimensions (2).",
		// 		"triggeredBy":{
		// 			"width:" : width  >= orgWidth,
		// 			"height:": height >= orgHeight,
		// 		}
	
		// 	};
		// }
		// console.log("NOOOOOOO");
	
		// This guarantees an desiredRatio unless the org dims are too big already.
		width  = ax;
		height = ay;
		for(let i=0; i<loops; i+=1){
			// Are the width and height greater than or equal to the orgWidth and orgHeight?
			if(width >= orgWidth || height >= orgHeight){
				// return {
				// 	width    : width    ,
				// 	height   : height   ,
				// 	orgWidth : orgWidth ,
				// 	orgHeight: orgHeight,
				// 	success  : true,
				// 	where    : "success: Near original dimensions.",
				// 	"triggeredBy":{
				// 		"width:" : width  >= orgWidth,
				// 		"height:": height >= orgHeight,
				// 	}
				// };
			}
			// Are the width or height greater than the max width or height for a document?
			// else if(width >= 1404 || height >= 1872){
			if(width >= 1404 || height >= 1872){
				return {
					width    : width    ,
					height   : height   ,
					orgWidth : orgWidth ,
					orgHeight: orgHeight,
					success  : true,
					where    : "success: Near document max dimensions.",
					"triggeredBy":{
						"width:" : width  >= orgWidth,
						"height:": height >= orgHeight,
					}
	
				};
			}
			// Increment width and height by ax and ay.
			else{
				width  += ax;
				height += ay;
			}
		}
	
		console.log("THIS SHOULD NOT HAPPEN.");
		return {
			width    : width    ,
			height   : height   ,
			orgWidth : orgWidth ,
			orgHeight: orgHeight,
			success  : false,
			where    : "unknown",
			"triggeredBy":{
				"width:" : width  >= orgWidth,
				"height:": height >= orgHeight,
			}
		};
	},
	
	pdfConvert        : function(changeRec, fileRec, totalCount){
		return new Promise(async function(res_pdfConvert, rej_pdfConvert){
			let startTS = performance.now();
	
			// Vars.
			let msg;
			let destDir      = _APP.m_config.config.imagesPath + changeRec.docId + "/";
			let destPagesDir = _APP.m_config.config.imagesPath + changeRec.docId + "/pages/";
			let svgDims      = {width:1404, height: 1872};
	
			// Display the start message for this pdf.
			msg = `[${changeRec.index.toString().padStart(4, "0")}/${totalCount.toString().padStart(4, "0")}] ` +
			`convertAndOptimize/pdfConvert: (${fileRec.content.pages.length} pages)` +
			`\n  LOADING FILE: "${fileRec.path + fileRec.metadata.visibleName}" ` ;
			console.log(msg);
	
			// Check if the changeRec.srcFile exists.
			if(!fs.existsSync(changeRec.srcFile)){ 
				msg = `convertAndOptimize/pdfConvert: srcFile not found.` + `"${fileRec.path + fileRec.metadata.visibleName}", "${changeRec.srcFile}"`;
				console.log(msg);
				rej_pdfConvert();
				return; 
			}
			
			// Check if destDir exists. Create it if it is missing.
			if(!fs.existsSync(destDir)){ fs.mkdirSync(destDir); }
			
			// Check if destPagesDir exists. Create it if it is missing.
			if(!fs.existsSync(destPagesDir)){ fs.mkdirSync(destPagesDir); }
	
			// Get the dimensions of each page of the pdf.
			let pages = [];
			try{ 
				// Get the dimensions of all pdf pages.
				pages = await _MOD.getDimensions(changeRec.srcFile).catch(function(e) { throw e; }); 
				
				// Make sure the lengths match.
				if(pages.length != fileRec.content.pages.length){
					let msg = `Count of dims returned does not match .content.pages.length (${pages.length} vs ${fileRec.content.pages.length})`;
					console.log(msg);
					throw msg;
				}
	
				// Add the pageId and png source file to each pages entry.
				// console.log("pages.length:", pages.length);
				pages.forEach(function(page, page_i){
					// When ImageMagick exports png images from pdf it will not append the page number if there is only one page.
					if(pages.length == 1 ){ page.pagePng    = destPagesDir + `PNGPAGE-0.png`; }
					else                  { page.pagePng    = destPagesDir + `PNGPAGE-${page_i}.png`; }
					page.pageId     = fileRec.content.pages[page_i];
					page.pageSvg    = destPagesDir + `${page.pageId}.svg`;
					page.pageSvgMin = destPagesDir + `${page.pageId}.min.svg`;
				});
			}
			catch(e){
				msg = `convertAndOptimize/pdfConvert/getDimensions: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
				console.log(msg);
				console.trace(e);
				_APP.m_funcs.rejectionFunction("pdfConvert/getDimensions", e, rej_pdfConvert, false)
				return; 
			}
			
			// NOTE: Big pdfs can eat up lots of memory during conversion. For those it is better to do the pages separately.
			// Convert pdf all at once?
			let name = "PNGPAGE.png";
			if(pages.length == 1){
				// Convert the pdf into pngs all at once. 
				try{
					name = "PNGPAGE-0.png";
					await _MOD.pdfPageToPng(changeRec.srcFile,  _APP.m_config.config.imagesPath + changeRec.docId + `/pages/${name}` ).catch(function(e) { throw e; }); 
				}
				catch(e){
					msg = `convertAndOptimize/pdfConvert/pdfPageToPng: (all) ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
					console.log(msg);
					console.log(e);
					_APP.m_funcs.rejectionFunction("pdfConvert/pdfPageToPng", e, rej_pdfConvert, false)
					return; 
				}
			}
			// Convert pdf pages individually.
			else{
				// Convert the pdf into pngs in batches.
				// NOTE: With ImageMagick, you can get a range of pdf pages with [1,2,3,4,5] instead of something like just [0].
				try{
					let start=0;
					let step=50;
					let stop=step;
					for(let i=0; i<pages.length; i+=step){
						// Get the range of pages to convert.
						let pageRange = _APP.m_funcs.getRange(
							start, 
							((stop) > pages.length) ? Math.min((stop), pages.length) : (stop), 
							1
						).join();
	
						// Convert the pdf pages to png.
						await _MOD.pdfPageToPng(`${changeRec.srcFile}[${pageRange}]`,  _APP.m_config.config.imagesPath + changeRec.docId + `/pages/${name}` ).catch(function(e) { throw e; }); 
	
						// Clear the console status. 
						process.stdout.clearLine();
						process.stdout.cursorTo(0);
	
						// Update the console status.
						process.stdout.cursorTo(2);
						process.stdout.write(((i/pages.length)*100).toFixed(2) + '%' + " pages pre-processed. " + `(${i+1} of ${pages.length})`);
	
						// Increment start and stop by step.
						start += step;
						stop  += step;
					}
	
					// Clear the console status. 
					process.stdout.clearLine();
					process.stdout.cursorTo(0);
				}
				catch(e){
					msg = `convertAndOptimize/pdfConvert/pdfPageToPng: (batch) ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
					console.log(msg);
					console.log(e);
					_APP.m_funcs.rejectionFunction("pdfConvert/pdfPageToPng", e, rej_pdfConvert, false)
					return; 
				}
			}
	
			// Parse the returned data. Get width and height, determine rotation needs.
			for(let i=0; i<pages.length; i+=1){
				let page = pages[i];
				let startTS_inner = performance.now();
	
				let destPagesFilenamePng    = page.pagePng;    // Deleted at the end.
				let destPagesFilenameSvg    = page.pageSvg;    // Deleted after optimization.
				let destPagesFilenameSvgMin = page.pageSvgMin; // Retained.
	
				// Rotate the image if necessary.
				if(page.doRotate){
					try{ 
						//
						await _MOD.rotate(destPagesFilenamePng, -90).catch(function(e) { throw e; }); 
	
						// Since it has been rotated -90 degrees we need to swap width and height.
						let tmp = page.width;
						page.width    = page.height;
						page.height   = tmp;
						page.doRotate = false;
					}
					catch(e){
						msg = `convertAndOptimize/pdfConvert/rotate: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
						console.log(msg);
						console.log(e);
						_APP.m_funcs.rejectionFunction("pdfConvert/rotate", e, rej_pdfConvert, false)
						return; 
					}
				}
				
				// Calculate image dimensions that have a 3:4 aspect ratio.
				let newDims = _MOD.incrementalResize(page.width, page.height, "3:4");
				// console.log("     B/A: incrementalResize:", "WAS:", page.width, page.height, ", NOW:", newDims.width, newDims.height) ;
	
				if(!newDims.success){ 
					msg = `convertAndOptimize/pdfConvert/incrementalResize: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
					console.log(msg);
					console.log("ERROR:", newDims);
					_APP.m_funcs.rejectionFunction("pdfConvert/incrementalResize", newDims.where, rej_pdfConvert, false)
					return; 
				}
				
				// Resize the .png to a height that provides a 3:4 ratio.
				try{ 
					//
					await _MOD.resize(destPagesFilenamePng, newDims.width, newDims.height).catch(function(e) { throw e; }); 
	
					// Since it has been resized we need to update the width and the height. 
					page.width  = newDims.width;
					page.height = newDims.height;
				}
				catch(e){
					msg = `convertAndOptimize/pdfConvert/resize: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
					console.log(msg);
					console.log(e);
					_APP.m_funcs.rejectionFunction("pdfConvert/resize", e, rej_pdfConvert, false)
					return; 
				}
	
				// Create the .svg file for this page.
				try{ 
					//
					await _MOD.createPngSvg(destPagesFilenamePng, newDims, destPagesFilenameSvg, svgDims).catch(function(e) { throw e; }); 
				}
				catch(e){
					msg = `convertAndOptimize/pdfConvert/createPngSvg: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
					console.log(msg);
					console.log(e);
					_APP.m_funcs.rejectionFunction("pdfConvert/createPngSvg", e, rej_pdfConvert, false)
					return; 
				}
	
				// Remove the .svg and keep the .min.svg.
				//
				
				// Remove the .png
				//
	
				let endTS_inner = performance.now();
				console.log(`    Converted page: ${i+1} of ${pages.length} for PDF: "${fileRec.metadata.visibleName}" in ${(((endTS_inner - startTS_inner)/1000)/1).toFixed(3)} seconds`);
			}
	
			let endTS = performance.now();
			console.log(`  COMPLETED in ${(((endTS - startTS)/1000)/60).toFixed(3)} minutes: "${fileRec.metadata.visibleName}"`);
			
			res_pdfConvert();
			return; 
	
			// Loop pdf pages.
	
				// Convert the page to pdf (include rotation and resizing settings.
	
		});
	},
};

module.exports = _MOD;