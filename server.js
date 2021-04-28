'use strict';

const WebSocket = require( 'ws' );
const encoding = require( './encoding.js' );
const http = require( "http" );
const fs = require( "fs" );



const httpserver = http.createServer( ( req, res ) => {

	if ( "GET" === req.method ) {

		var content = "";

		try {

			var filepath = "." + ( ( "/" === req.url ) ? "/index.html" : req.url );

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


const ws_connection = {};

const ws_identified = {};

const requests = {};

const wss = new WebSocket.Server( { server: httpserver } );

wss.on( 'connection', ( ws, req ) => {

	ws.id = 'Guest-' + s4();
	ws.last_heard = ( new Date() ).getTime();

	ws.on( 'pong', () => {

		if ( ! ws_identified.hasOwnProperty( ws.id ) ) return;
		ws_identified[ ws.id ].last_heard = ( new Date() ).getTime();

	} );

	ws.on( 'message', message => {

		var encoded_message = message.buffer.slice( message.byteOffset, message.byteOffset + message.byteLength );
		var decoded_message = encoding.decode( encoded_message );

		console.log( `${ws.id}: ${decoded_message}` );

		if ( ! Array.isArray( decoded_message ) ) return;

		var request = decoded_message.shift();

		requests.hasOwnProperty( request ) && requests[ request ]( ws, ...decoded_message );

	} );

	ws_connection[ ws.id ] = ws;

	send( ws, [ 'connected', ws.id ] );

} );



function s4() {

	return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );

}



function send( ws, message ) {

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

	for ( const id in ws_connection ) {

		var ws = ws_connection[ id ];

		if ( ws.last_heard < now - CLIENT_UPDATE_INTERVAL * 2 ) {

			console.log( `${id} failed to identify` );
			delete ws_connection[ id ];
			ws.terminate();

		}

	}

	for ( const id in ws_identified ) {

		var ws = ws_identified[ id ];

		if ( ws.last_heard < now - CLIENT_UPDATE_INTERVAL * 2 ) {

			console.log( `${ws.id} disconnected, ${id}` );
			broadcast( ws, [ 'disconnected', ws.id ] );
			delete ws_identified[ id ];
			ws.terminate();

		}

		ws.ping();

	}

}, CLIENT_UPDATE_INTERVAL );




requests.identifyas = ( ws, id ) => {

	var welcome = false;

	if ( ws_connection.hasOwnProperty( ws.id ) ) {

		delete ws_connection[ ws.id ];
		welcome = ! ws_identified.hasOwnProperty( id );

	}

	ws_identified[ id ] = ws;
	ws.id = id;

	if ( welcome ) {

		console.log( `welcome ${ws.id}` );
		broadcast( null, [ 'welcome', ws.id ] );

	}

};




requests.say = ( ws, message ) => {

	// remove XML/HTML markup from message
	message = message.replace( /(<([^>]+)>)/ig, "" );
	broadcast( ws, [ 'say', ws.id, message ] );

};
