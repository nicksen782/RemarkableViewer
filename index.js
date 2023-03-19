// console.log('Starting directory: ' + process.cwd());
try {
	process.chdir(__dirname);
    // console.log('New directory     : ' + process.cwd());
}
catch (err) {
	console.log('Could not change working directory: ' + err);
	process.exit(1);
}
require('./backend/node/MAIN.js'); 
