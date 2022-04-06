// Server-Sent-Events.
const sse                = {
	// References to the req and res of the connection. 
	req: {},
	res: {},
	clients: [],
	isActive: false,
	closeFunction : function(){
		if(sse.isActive){
			// Unexpected close.
			console.log("Client CLOSE", "Unexpected close");
			
			// End the stream.
			sse.res.end();
			
			//
			sse.isActive = false;
		}
	},
	endFunction : function(){
		if(sse.isActive){
			// Normal end.
			console.log("Client END", "Normal end");
				
			// End the stream.
			sse.res.end();

			//
			sse.isActive = false;
		}
	},

	// START SSE.
	start: async function(obj){
		
		// Break out the properties of the object into variables. 
		let { req, res } = obj;
		sse.req = req;
		sse.res = res;
		
		// Handles for connection close/end.
		sse.req.on("close", sse.closeFunction);
		sse.req.on("end"  , sse.endFunction);

		// START THE SSE STREAM.
		res.writeHead(200, { 
			"Content-Type": "text/event-stream",
			// 'Connection': 'keep-alive',
			"Cache-control": "no-cache" 
		});

		sse.isActive = true; 
	},
	
	// WRITE SSE.
	write: function(data){
		if(sse.isActive){
			// JSON stringify the recieved data.
			data = JSON.stringify(data);
			
			// Send this message right now. 
			sse.res.write(`data: ${data}\n\n`);
		}
	},
	
	// END SSE.
	end: function(data=null){
		if(sse.isActive){
			// END THE SSE STREAM.
			let endString = "==--ENDOFDATA--==";
			
			// Was there a final message? If so, send it.
			if(data){
				sse.write(data);
			}
			
			// Send the message.
			sse.write(endString);

			// End the stream.
			sse.res.end();

			//
			sse.isActive = false;
		}
		else{
			console.trace("SSE stream has already ended.");
			// sse.write(data);
		}
	},
};

// let obj = {
// 	"key1" : "value1",
// 	"key2" : "value2",
// 	"key3" : "",
// };
// const getObject = function(){
// 	return obj;
// };
// const setKeyValue = function(key, value){
// 	obj[key] = value;
// };

module.exports = {
	sse         : sse         , 
	// getObject   : getObject   , 
	// setKeyValue : setKeyValue , 

	_version  : function(){ return "Version 2021-09-23"; }
};