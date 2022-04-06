const { performance } = require('perf_hooks');

var stamps = [];

// Used for managing the timing of processes. 
var stamp = function(key, index = null, prePadKey = true){
	// Example usage: Create: let stampIndex = stamp("function_name", null); 
	// Example usage: Update: stamp("function_name", 0);

	// NOTES:
	// "key" can be any string such as the name of a function.
	// "index" is always returned. It is used for updating an existing timestamp.
	// Because of the index, multiple calls to the same key will remain as separate entries.

	// New time stamp?
	if(index == null){
		// Add the timestamp.
		stamps.push(
			{
				key     : (prePadKey ? "  " : "") + key,
				stamp   : performance.now(),
				complete: false
			}
		);
		
		// Get this index.
		index = stamps.length - 1;

		// console.log("Added stamp entry:", stamps[index]);
	}

	// Existing timestamp. Index is required to edit the correct array index.
	else{
		// Update the timestamp
		stamps[index].stamp = performance.now() - stamps[index].stamp;
		stamps[index].complete = true; 

		// console.log("Updated stamp entry:", stamps[index]);
	}

	// console.log("stamp index:", index);
	
	// Return the index.
	return index;
};

// Returns a nicely formatted array of stamp stamps.
var getStampString = function(){
	return JSON.stringify(
		stamps
			.map(
				function(d){
					let key   = d.key.toString().padEnd(35, " ") ;
					let stamp = ((d.stamp / 1).toFixed(3) + " ms").padStart(12, " ")
					
					return "" +
						  "key: "      + key + 
						", complete: " + d.complete +
						",     time: " + stamp + 
						""
					; 
				}
			)
	, null, 1);
};
var clearTimeItStamps = function(){
	stamps = [];
};

module.exports = {
	stamps            : stamps,
	getStampString    : getStampString,
	clearTimeItStamps : clearTimeItStamps,
	stamp             : stamp,
	_version          : function(){ return "Version 2021-09-24"; }
};