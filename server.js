'use strict';

const WebSocket = require( 'ws' );
const encoding = require( './encoding.js' );
const http = require( "http" );
const fs = require( "fs" );



const httpserver = http.createServer( ( req, res ) => {

	console.log( `${req.method} ${req.url}` );

	if ( "POST" === req.method && ( "/git" === req.url || "/update" === req.url ) ) {

		req.on( "data", function ( data ) {

			var sig = "sha1=" + cryptojs.HmacSHA1( "" + data, process.env.SECRET ).toString( cryptojs.enc.Hex );

			if ( sig !== req.headers[ "x-hub-signature" ] ) {

				res.writeHead( 401, { "Content-Type": "application/json" } );
				return res.end( '{"error": "Unauthorized"}', "utf-8" );

			}

			if ( "/git" === req.url && "push" === req.headers[ "x-github-event" ] ) gitPushWebhook();

			res.writeHead( 200, { "Content-Type": "application/json" } );
			return res.end( "{}", "utf-8" );

		} );

	} else if ( "GET" === req.method ) {

		var content = "";

		try {

			var filepath = "." + ( ( "/" === req.url ) ? "/index.html" : req.url );

			console.log( `${filepath}` );

			content = fs.readFileSync( filepath );

			res.writeHead( 200, {
				"Content-Type": {
					html: "text/html",
					js: "text/javascript",
					css: "text/css",
					json: "application/json"
				}[ filepath.split( "." ).pop().toLowerCase() ] || "text/*"
			} );

		} catch ( err ) {

			res.code = "ENOENT" === err.code ? 404 : 500, res.writeHead( res.code, { "Content-Type": "text/html" } ), content = "<!doctype html><html><head><title>PBBG</title></head><body>" + err.message + "</body></html>";

		}

		return res.end( content, "utf-8" );

	}

} );

httpserver.listen( process.env.PORT, () => {

	console.log( `Server started on port ${process.env.PORT}` );

} );



const ws_clients_by_id = {};

const requests = {};

const wss = new WebSocket.Server( { server: httpserver } );

wss.on( 'connection', ( ws, req ) => {

	ws.id = 'Guest-' + s4();
	ws.last_heard = ( new Date() ).getTime();

	ws.on( 'pong', () => {

		if ( ! ws_clients_by_id.hasOwnProperty( ws.id ) ) return;
		ws_clients_by_id[ ws.id ].last_heard = ( new Date() ).getTime();
		console.log( `pong ${ws.id} ${ws_clients_by_id[ ws.id ].last_heard}` );

	} );

	ws.on( 'message', message => {

		var encoded_message = message.buffer.slice( message.byteOffset, message.byteOffset + message.byteLength );
		var decoded_message = encoding.decode( encoded_message );
		console.log( `${ws.id}: ${decoded_message}` );

		if ( ! Array.isArray( decoded_message ) ) return;

		var request = decoded_message.shift();

		requests.hasOwnProperty( request ) && requests[ request ]( ws, ...decoded_message );

	} );

	ws_clients_by_id[ ws.id ] = ws;

	send( ws, [ 'connected', ws.id ] );

} );



function s4() {

	return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );

}



function send( ws, message ) {

	console.log( `${ws.id} ${message}` );

	ws.send( encoding.encode( message ) );

}


function broadcast( origin_ws, message ) {

	var encoded_message = encoding.encode( message );

	wss.clients.forEach( ws => {

		if ( ws !== origin_ws ) ws.send( encoded_message );

	} );

}



const CLIENT_UPDATE_INTERVAL = 10000;



setInterval( () => {

	var now = ( new Date() ).getTime();

	for ( const id in ws_clients_by_id ) {

		var ws = ws_clients_by_id[ id ];

		if ( ws.last_heard < now - CLIENT_UPDATE_INTERVAL * 2 ) {

			if ( ! ws.identitied ) {

				console.log( `${ws.id} failed to identify` );

			} else {

				console.log( `${ws.id} disconnected, ${id}` );
				broadcast( ws, [ 'disconnected', ws.id ] );

			}

			delete ws_clients_by_id[ id ];
			ws.terminate();

		}

		ws.ping();

	}

}, CLIENT_UPDATE_INTERVAL );




requests.identifyas = ( ws, id ) => {

	var welcome = ! ( id in ws_clients_by_id );

	if ( ws.id !== id ) {

		ws_clients_by_id[ id ] = ws;
		delete ws_clients_by_id[ ws.id ];
		ws.id = id;

	}

	ws.identitied = true;

	if ( welcome ) broadcast( null, [ 'welcome', ws.id ] );

};




requests.say = ( ws, message ) => {

	broadcast( ws, [ 'say', ws.id, message ] );

};
