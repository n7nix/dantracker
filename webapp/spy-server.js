// http://ejohn.org/blog/ecmascript-5-strict-mode-json-and-more/
"use strict";

/* Optional:
 * You will see the process.title name in 'ps', 'top', etc.
 */
process.title = 'spy-server';

var mod_ctype = require('/usr/local/lib/node_modules/ctype');
var fs = require('fs');

// *** Network socket server
var net = require('net');
var NETHOST = '127.0.0.1';
var UNIXPORT = '/tmp/N7NIX_SPYUI';

// *** Web socket server
var webSocketsServerPort = 1348;

// *** HTML server
var HTMLPORT = 8081;
var TCP_DELIMITER = '\n';
var TCP_BUFFER_SIZE = Math.pow(2,16);


/**
 * Global variables
 */
// list of currently connected clients (users)
var spyClients = [];

// websocket and http servers
var webSocketServer = require('/usr/local/lib/node_modules/websocket').server;
var http = require('http');
var events = require("events");

var spy_emitter = new events.EventEmitter();

/**
 * Helper function for escaping spy content
 */
function htmlEntities(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

fs.unlink(UNIXPORT, function(err) {
        if (err) {
                console.log('Will create Unix socket:' + UNIXPORT );
        };
});

/**
   * HTTP server
   */
var server = http.createServer(function(request, response) {
    // Not important for us. We're writing WebSocket server, not HTTP server
});
server.listen(webSocketsServerPort, function() {
	console.log((new Date()) + " WebSocket Server is listening on port " + webSocketsServerPort);
});

spy_emitter.on("spy_display", function(message) {

        if(spyClients[0] !== undefined && spyClients.length !== undefined) {

                console.log('clients[' + spyClients.length + '] ' + 'message: ' + message);

                for (var i=0; i < spyClients.length; i++) {
//                        console.log('spy_emitter: sending to ' +  i + ' total: '+ spyClients.length);
                        spyClients[i].sendUTF(message);

                }
        }
});

/**
 * ===================== WebSocket server ========================
 */
var wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. WebSocket request is just
    // an enhanced HTTP request. For more info http://tools.ietf.org/html/rfc6455#page-6
	httpServer: server
});


// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {

	/* accept connection - you should check 'request.origin' to make sure that
	 * client is connecting from your website
	 * (http://en.wikipedia.org/wiki/Same_origin_policy)
	 */
	var connection = request.accept(null, request.origin);
	// we need to know client index to remove them on 'close' event
        var index = spyClients.push(connection) - 1;
        var curIndex =0;

        console.log((new Date()) + ' Connection from ' + request.origin + ', index: ' + index);

        /* This code is not used
         * No input from spy page is expected
         */
        connection.on('message', function(message) {
                if (message.type === 'utf8') { // accept only text

                        /* get data sent from users web page */
                        var frontendmsg = JSON.parse(message.utf8Data);

                        console.log('Unhandled message type from client: ' + frontendmsg.type);
                }
        });

        // user disconnected
        connection.on('close', function(connection) {
                console.log((new Date()) + " Peer "
                            + connection.remoteAddress + " disconnected.");
                // remove user from the list of connected clients
                spyClients.splice(index, 1);
        });
});

/**
 * ===================== network Socket server ========================
 *
 * Create a server instance, and chain the listen function to it
 * The function passed to net.createServer() becomes the event handler for the 'connection' event
 * The sock object the callback function receives is UNIQUE for each connection
 */
net.createServer(function(sock) {


	// We have a connection - a socket object is assigned to the connection automatically
        console.log('CONNECTED');

	// To buffer tcp data see:
	// http://stackoverflow.com/questions/7034537/nodejs-what-is-the-proper-way-to-handling-tcp-socket-streams-which-delimiter
	var buf = new Buffer(TCP_BUFFER_SIZE);  //new buffer with size 2^16

	var icount = 0;

        // Add a 'data' event handler to this instance of socket
        sock.on('data', function(data) {
                /* This is a TCP connection so is stream based NOT
                 * message based.
                 * This handler can receive multiple spy packets for
                 * each instance called.
                 */
                var dataStr = data.toString('utf8');

                icount++;

                try {
                        var jsonchk = JSON.parse(data);
                } catch(e) {
                        // Check for TCP stream combining multiple JSON objects
                        var nSearch = dataStr.search("}{");

                        // Does packet contain any concatenated JSON objects?
                        if(nSearch != -1) {
                                // Packet contains at least one concateated object
                                while (nSearch != -1) {
                                        var firstPkt = dataStr.slice(0, nSearch+1);
                                        dataStr = dataStr.slice(nSearch+1);

                                        spy_emitter.emit("spy_display", firstPkt);
                                        // console.log('DATA [' + icount + "] len: " + firstPkt.length + '  ' + firstPkt);
                                        icount++;
                                        nSearch = dataStr.search("}{");
                                }
                        } else {
                                console.log('Parse error on pkt [' + icount + "] len: " + dataStr.length + '  ' + dataStr);
                        }
                }
                spy_emitter.emit("spy_display", dataStr);
                //  console.log('DATA [' + icount + "] len: " + dataStr.length + '  ' + dataStr;

        });

	// Add a 'close' event handler to this instance of socket
	sock.on('close', function(data) {
		console.log('Unix socket connection closed at: ' + (new Date()) + 'socket address: ' + sock.remoteAddress +' '+ sock.remotePort);
	});

}).listen(UNIXPORT, NETHOST);

console.log((new Date()) + ' UnixSocket Server listening on ' + NETHOST +':'+ UNIXPORT);

/**
 * ===================== HTML server ========================
 */

var connect = require('/usr/local/lib/node_modules/connect');
connect.createServer(
                     connect.static(__dirname),
                     function(req, res){
        res.setHeader('Content-Type', 'text/html');
        res.end('You need a path, try /spy.html\n');
}
).listen(HTMLPORT);
