const { spawn }       = require('child_process');
const fs              = require('fs');
const path            = require('path');
const async_mapLimit  = require('promise-async').mapLimit;
const { performance } = require('perf_hooks');

const funcs  = require('./funcs.js').funcs;
const config = require('./config.js').config;
// const webApi = require('./webApi.js').webApi;

const pdfPageToPng = function(srcFile, destFile){
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
			`"${destFile}" ` // `"DEVICE_DATA_IMAGES/029d4e39-5bd5-47d0-96dd-1808d5fb5b77/pages/KOLBE1.pdf-0.png" ` }
		;
		
		let results;
		try{ 
			results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
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
};

const rotate = function(srcFile, degrees){
	return new Promise(async function(res_rotate, rej_rotate){
		let cmd = `convert -precision 15 "${srcFile}" -rotate ${degrees}\! "${srcFile}"`;
		let results;
		try{
			results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
			res_rotate(); 
		}
		catch(e){ 
			console.log("Command failed:", e); 
			rej_rotate(e); 
			return; 
		}
	});
};

const resize = function(srcFile, newWidth, newHeight){
	return new Promise(async function(res_resize, rej_resize){
		let cmd = `convert "${srcFile}" -precision 15 -resize ${newWidth}x${newHeight}` +'! ' + `"${srcFile}"`;
		let results;
		try{
			results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
			res_resize(); 
			return; 
		}
		catch(e){ 
			console.log("Command failed:", e); 
			rej_resize(e); 
			return; 
		}
	});
};

const createPngSvg = function(destPagesFilenamePng, newDims, destPagesFilenameSvg, svgDims){
	return new Promise(async function(res_createPngSvg, rej_createPngSvg){
		// Get the file and encode to base64.
		let base64 = fs.readFileSync( destPagesFilenamePng, 'base64');
		base64 = 'data:image/png;base64,' + base64;

		let svgFileTEST = `` +
		`<svg xmlns="http://www.w3.org/2000/svg" height="${newDims.height}" width="${newDims.width}">\n`+
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
};

//
const getDimensions = function(srcFile){
	return new Promise(async function(res_getDimensions, rej_getDimensions){
		let cmd = `identify "${srcFile}"`;
		// DEVICE_DATA/xochitl/54ee7bf5-ad7e-43b0-ab28-3a69da9f1acf.pdf[23] PDF 525x404 525x404+0+0 16-bit sRGB 142686B 0.020u 0:00.030
		// nicksen782@dev3:~/node_sites/remarkable-viewer/SERVER$ identify  "DEVICE_DATA/xochitl/54ee7bf5-ad7e-43b0-ab28-3a69da9f1acf.pdf"

		let results;
		try{ 
			results = await funcs.runCommand_exec_progress(cmd, 0, false).catch(function(e) { throw e; }); 
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
					ratio     : getRatio(width, height)
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
};

//
const getRatio = function(numerator, denominator){
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
};

const incrementalResize = function(orgWidth, orgHeight, desiredRatio="3:4"){
	let loops = 1404;
	let ax = parseInt(desiredRatio.split(":")[0]);
	let ay = parseInt(desiredRatio.split(":")[1]);
	let width  = ax;
	let height = ay;

	// This guarantees an desiredRatio unless the org dims are too big already.
	for(let i=0; i<loops; i+=1){
		// Is either the width or the height above the max?
		if(width  >= 1404){ 
			return {
				width    : width    ,
				height   : height   ,
				orgWidth : orgWidth ,
				orgHeight: orgHeight,
				success  : false,
				where    : "Too wide",
			};
		}
		if(height >= 1872){ 
			return {
				width    : width    ,
				height   : height   ,
				orgWidth : orgWidth ,
				orgHeight: orgHeight,
				success  : false,
				where    : "Too tall",
			};
		}
		
		// Are the width and height greater than or equal to the orgWidth and orgHeight
		if(width >= orgWidth && height >= orgHeight){
			// console.log("DONE!", width, height, getRatio(width, height), `PARAMS: ${orgWidth}, ${orgHeight}, ${desiredRatio}`);
			return {
				width    : width    ,
				height   : height   ,
				orgWidth : orgWidth ,
				orgHeight: orgHeight,
				success  : true,
				where    : "success",

			};
		}
		else{
			width  += ax;
			height += ay;
		}
	}

	// console.log("FAILURE");
	return {
		width    : width    ,
		height   : height   ,
		orgWidth : orgWidth ,
		orgHeight: orgHeight,
		success  : false,
		where    : "unknown",
	};
};

const pdfConvert = function(changeRec, fileRec, totalCount){
	return new Promise(async function(res_pdfConvert, rej_pdfConvert){
		let startTS = performance.now();

		let msg;
		let destDir = config.imagesPath + changeRec.docId + "/";
		let destPagesDir = config.imagesPath + changeRec.docId + "/pages/";
		let svgDims = {width:1404, height: 1872};
		
		// Check if the changeRec.srcFile exists.
		if(!fs.existsSync(changeRec.srcFile)){ 
			msg = `convertAndOptimize/pdfConvert: srcFile not found.` + `"${fileRec.path + fileRec.metadata.visibleName}", "${changeRec.srcFile}"`;
			console.log(msg);
			rej_pdfConvert();
			return; 
		}
		
		// Check if destDir exists.
		if(!fs.existsSync(destDir)){ fs.mkdirSync(destDir); }
		
		// Check if destPagesDir exists.
		if(!fs.existsSync(destPagesDir)){ fs.mkdirSync(destPagesDir); }

		// Get dimensions for each page.
		let pages = [];
		try{ 
			// Get the dimensions of all pdf pages.
			pages = await getDimensions(changeRec.srcFile).catch(function(e) { throw e; }); 
			
			// Make sure the lengths match.
			if(pages.length != fileRec.content.pages.length){
				let msg = `Count of dims returned does not match .content.pages.length (${pages.length} vs ${fileRec.content.pages.length})`;
				console.log(msg);
				throw msg;
			}

			// Add the pageId to each pages entry.
			pages.forEach(function(page, page_i){
				pages[page_i].pageId = fileRec.content.pages[page_i];
			});
		}
		catch(e){
			msg = `convertAndOptimize/pdfConvert/getDimensions: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
			console.log(msg);
			console.log(e);
			funcs.rejectionFunction("pdfConvert/getDimensions", e, rej_pdfConvert, false)
			return; 
		}
		
		// Parse the returned data. Get width and height, determine rotation needs.
		msg = `[${changeRec.index.toString().padStart(4, "0")}/${totalCount.toString().padStart(4, "0")}] ` +
			`convertAndOptimize/pdfConvert: ` + 
			`(${fileRec.content.pages.length} pages)` +
			`\n  FILE: "${fileRec.path + fileRec.metadata.visibleName}" ` ;
		console.log(msg);

		for(let i=0; i<pages.length; i+=1){
			let page = pages[i];

			let destPagesFilenamePng = config.imagesPath + changeRec.docId + "/pages/" + (page.pageId) + ".png";
			let destPagesFilenameSvg = config.imagesPath + changeRec.docId + "/pages/" + "TEST2_" + page.pageId + ".svg";

			// Convert pdf page to .png.
			console.log(`    Converting page: ${i+1} of ${pages.length} for PDF: "${fileRec.metadata.visibleName}"`);
			try{ 
				//
				await pdfPageToPng(changeRec.srcFile +`[${i}]`, destPagesFilenamePng).catch(function(e) { throw e; }); 
			}
			catch(e){
				msg = `convertAndOptimize/pdfConvert/pdfPageToPng: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
				console.log(msg);
				console.log(e);
				funcs.rejectionFunction("pdfConvert/pdfPageToPng", e, rej_pdfConvert, false)
				return; 
			}

			if(page.doRotate){
				try{ 
					//
					await rotate(destPagesFilenamePng, -90).catch(function(e) { throw e; }); 

					// Since it has been rotated -90 degrees we need to swap width and height.
					let tmp = page.width;
					page.width = page.height;
					page.height = tmp;
					page.doRotate = false;
				}
				catch(e){
					msg = `convertAndOptimize/pdfConvert/rotate: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
					console.log(msg);
					console.log(e);
					funcs.rejectionFunction("pdfConvert/rotate", e, rej_pdfConvert, false)
					return; 
				}
			}
			
			// Calculate image dimensions that have a 3:4 aspect ratio.
			let newDims = incrementalResize(page.width, page.height, "3:4");
			if(!newDims.success){ 
				msg = `convertAndOptimize/pdfConvert/incrementalResize: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
				console.log(msg);
				console.log("ERROR:", newDims);
				funcs.rejectionFunction("pdfConvert/incrementalResize", newDims.where, rej_pdfConvert, false)
				return; 
			}
			
			// Resize the .png to a height that provides a 3:4 ratio.
			try{ 
				//
				await resize(destPagesFilenamePng, newDims.width, newDims.height).catch(function(e) { throw e; }); 

				// Since it has been resized we need to update the width and the height. 
				page.width  = newDims.width;
				page.height = newDims.height;
			}
			catch(e){
				msg = `convertAndOptimize/pdfConvert/resize: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
				console.log(msg);
				console.log(e);
				funcs.rejectionFunction("pdfConvert/resize", e, rej_pdfConvert, false)
				return; 
			}

			// Create the .svg file for this page.
			// try{ 
			// 	//
			// 	console.log(`    Page ${i+1}: ${JSON.stringify(newDims)}`);
			// 	await createPngSvg(destPagesFilenamePng, newDims, destPagesFilenameSvg, svgDims).catch(function(e) { throw e; }); 
			// }
			// catch(e){
			// 	msg = `convertAndOptimize/pdfConvert/createPngSvg: ` + `FAILURE: "${fileRec.path + fileRec.metadata.visibleName}"`;
			// 	console.log(msg);
			// 	console.log(e);
			// 	funcs.rejectionFunction("pdfConvert/createPngSvg", e, rej_pdfConvert, false)
			// 	return; 
			// }
		}

		let endTS = performance.now();
		console.log(`  COMPLETED in ${((endTS - startTS)/1000).toFixed(3)} seconds: "${fileRec.metadata.visibleName}"`);
		
		res_pdfConvert();
		return; 

		// Loop pdf pages.

			// Convert the page to pdf (include rotation and resizing settings.

	});
};

// "./DEVICE_DATA/xochitl/029d4e39-5bd5-47d0-96dd-1808d5fb5b77.pdf[0]"

module.exports = {
	pdfConvert : pdfConvert , // Expected use by updateFromDevice.js 
	_version  : function(){ return "Version 2021-10-03"; }
};