
var net = {
	// Calls to the server (processing.)
	simpleFetch : function(url){
		// Backend should send JSON. 
		// This function returns a promise. 
		return fetch(url).then(response => response.json());
	},
};
var apis = {
	syncUsingWifi       : function(){
		console.log("syncUsingWifi");
		return new Promise(function(resolve, reject){
			net.simpleFetch("syncUsingWifi").then(
				function(results){
					console.log("syncUsingWifi:", results);
					resolve(results);
				}
			);
		});
	},
	getFilesJson        : function(){
		console.log("getFilesJson");
		return new Promise(function(resolve, reject){
			net.simpleFetch("getFilesJson").then(
				function(results){
					console.log("getFilesJson:", results);
					resolve(results);
				}
			);
		});
	},
	getGlobalUsageStats : function(){
		console.log("getGlobalUsageStats");
		return new Promise(function(resolve, reject){
			net.simpleFetch("getGlobalUsageStats").then(
				function(results){
					console.log("getGlobalUsageStats:", results);
					resolve(results);
				}
			);
		});
	},
	getSvgs             : function(notebook_id){
		console.log("getSvgs");
		return new Promise(function(resolve, reject){
			net.simpleFetch("getSvgs?"+notebook_id).then(
				function(results){
					console.log("getSvgs:", results);
					resolve(results);
				}
			);
		});
	},
	getThumbnails       : function(notebook_id){
		console.log("getThumbnails");
		return new Promise(function(resolve, reject){
			net.simpleFetch("getThumbnails?"+notebook_id).then(
				function(results){
					console.log("getThumbnails:", results);
					resolve(results);
				}
			);
		});
	},
};

// These will contain the "file system".
var dirs = {};
var files = {};

window.onload = async function(){
	window.onload=null
	// await getJsonFs_new();
	// await getJsonFs_current();
	try{ await apis.getFilesJson(); } catch(e){ console.log("ERROR: getFilesJson:", e); };
};