var globals = {
	site_config : {},
	site_config_changed : {},

	v4: {
		"htmlPath"             : "./_WebUI/HtmlV4/",
		"local_clientSettings" : "./_WebUI/HtmlV4/clientSettings.json",
		"demo_clientSettings"  : "./_WebUI/HtmlV4/clientSettingsDEMO.json",
	},
	v3: {
		"htmlPath"             : "./_WebUI/Html/",
		"local_clientSettings" : "./_WebUI/Html/clientSettings.json",
		"demo_clientSettings"  : "./_WebUI/Html/clientSettingsDEMO.json",
	},
};

var funcs = {
	fixType : function(str){
		// Trim the string. 
		if(typeof str == "string") { 
			str = str.trim(); 
		}
		
		// Is this a number? 
		if(!isNaN(str) && !isNaN(parseFloat(str))) { return parseFloat(str); }
		
		// Is this a boolean? 
		else if(str == "true" || str == "false") { 
			if(str == "true"){
				return true; 
			} 
			else if(str == "false"){
				return false; 
			} 
		}
		// Assume this is a string.
		else{
			return str;
		}
	},
	setKeysAsUnchanged : function(){
		// Set globals.site_config_changed.
		let keys = Object.keys(globals.site_config);
		keys.forEach(function(key){
			globals.site_config_changed[key] = false; 
		});
	},
	createInputTableFromJson : function(json, dest){
		if(!dest){ dest = document.getElementById("inputTable"); }
		dest.innerHTML = "";
		let table = document.createElement("table");
		table.style.width = "500px";
		
		let keys = Object.keys(json);
		let rowCount = 0; 
		keys.forEach(function(key){
			// This row and cells.
			let row        = table.insertRow(rowCount);
			row.setAttribute("key", key);
			let cell_key   = row.insertCell(0);
			let cell_value = row.insertCell(1);

			// Input for the value:
			let textInput = document.createElement("input");
			textInput.type = "text";
			textInput.value = json[key];
			textInput.style.width = "100%";

			textInput.onchange = function(){
				// Update the cached value. 
				globals.site_config[key] = funcs.fixType(this.value);
				
				// Set as changed. 
				globals.site_config_changed[key] = true; 
				
				// Change the appearance of this field. 
				this.classList.add("changed");
			};

			cell_key.innerHTML   = key;
			cell_value.appendChild(textInput);
		});
		dest.appendChild(table);
	},
	changeToV4Ui : function(){
		for(let key in globals.v4){
			let rec = globals.v4[key];
			globals.site_config_changed[key] = true; 
			globals.site_config[key] = rec;
			let elem = document.querySelector("#inputTable tr[key='"+key+"'] input[type='text']");
			elem.value = globals.site_config[key];
			elem.classList.add("changed");
		}
		// apis.updateSite_config();
	},
	changeToV3Ui : function(){
		for(let key in globals.v3){
			let rec = globals.v3[key];
			globals.site_config_changed[key] = true; 
			globals.site_config[key] = rec;
			let elem = document.querySelector("#inputTable tr[key='"+key+"'] input[type='text']");
			elem.value = globals.site_config[key];
			elem.classList.add("changed");
		}
		// apis.updateSite_config();
	},
};

var apis = {
	// Used for GET requests. 
	simpleFetch         : async function(url){
		// Backend should send JSON. 
		return fetch(url).then(response => response.json());
	},

	// Used for POST requests. 
	postFetch           : async function(url, body){
		// Backend should send JSON. 
		return fetch(
			url, 
			{
				method: 'POST',
				headers: {
				  'Accept': 'application/json',
				  'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			}
		).then(response => response.json());
	},	

	//
	getSite_config : function(){
		return new Promise(function(resolve, reject){
			apis.simpleFetch("/debug/getSite_config").then(
				function(results){
					resolve(results);
				}
			);
		});
	},

	updateSite_config : function(){
		return new Promise(function(resolve, reject){
			console.log("globals.site_config        :", globals.site_config);
			console.log("globals.site_config_changed:", globals.site_config_changed);
			
			let data = globals.site_config;
			apis.postFetch("/debug/updateSite_config", data).then(
				async function(results){
					// Get getSite_config.
					try{ globals.site_config = await apis.getSite_config();  } catch(e){ console.log("ERROR: getSite_config:", e); };	
					
					// Set globals.site_config_changed.
					funcs.setKeysAsUnchanged();
		
					// Create a table via with the settings. 
					funcs.createInputTableFromJson( globals.site_config );

					// Resolve - done.
					resolve(results);
				}
			);
			
		});
	},

};

window.onload = async function(){
	window.onload=null;

	// Get getSite_config.
	try{ globals.site_config = await apis.getSite_config();  } catch(e){ console.log("ERROR: getSite_config:", e); };	

	// Set globals.site_config_changed.
	funcs.setKeysAsUnchanged();

	// Create a table via with the settings. 
	funcs.createInputTableFromJson( globals.site_config );
};