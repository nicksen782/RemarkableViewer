/*
	Platform: Linux
	Requires: lsof installed (sudo apt install lsof)
	Notes   : Process should be owned by the runner of the script.
*/

const { exec } = require("child_process");

let findProcessIdByPort = function(port){
	let cmd = `lsof -b -t -i tcp:${port}`;
	// console.log("cmd: ", cmd);

	console.log(`Looking for process using port: ${port}`);
	exec(cmd, (error, stdout, stderr) => {
		if(stdout.length != 0){
			let pid = stdout.trim();
			console.log(`Process id found: ${pid}`);
			killProcessById(pid);
		}
		else{
			console.log(`Process NOT FOUND`);
		}
	});
};
let killProcessById = function(pid){
	let cmd = `kill -9 ${pid}`;
	// console.log("cmd: ", cmd);
	
	console.log(`Removing process: ${pid}`);
	exec(cmd, (error, stdout, stderr) => {
		if (error)  { console.log(`error: ${error}`); return; }
		if (stderr) { console.log(`stderr: ${stderr}`); return; }
		console.log(`SUCCESS: ${stdout}`);
	});
}

let allowedPorts = [3100, 3101, 3200];
let arg = process.argv.slice(2);
if(arg.length){
	// Get the port number and trim the result. 
	arg = arg[0].trim(); 

	// Make sure the port can be interpreted as a number. 
	if(isNaN(arg)){
		console.log("You must supply a port NUMBER.");
		process.exit();
	}
	else{
		// Convert the port number to an integer.
		arg = parseInt(arg, 10);

		// Make sure this is one of the allowed ports. 
		if(allowedPorts.indexOf(arg) == -1){
			console.log(`Sorry, only ports ${allowedPorts.join(", ")} are allowed.`);
			process.exit();
		}

		// Remove the process by port. 
		else{
			findProcessIdByPort(arg);
		}
	}
}
else{
	console.log("You must supply a port number.");
}