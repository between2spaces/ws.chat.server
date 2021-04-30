'use strict';

import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';
import encoding from './encoding.mjs';



const CLIENT_UPDATE_INTERVAL = 10000;
const ws_connection = {};
const ws_welcomed = {};
const ws_identified = {};
const ws_closed = {};
const requests = {};


const blacklisted_names = [ 'undefined', 'null', 'name', 'admin', 'penis', 'dick', 'vagina', 'cunt', 'shit', 'dick' ];


requests.ident = ( ws, id ) => {

	id = id.trim();

	if ( id.length < 3 ) {

		return send( ws, [ 'error', `Name '${id}' not long enough. Must be between 3 and 12 characters.`, 'ident' ] );

	}

	if ( id.length > 12 ) {

		return send( ws, [ 'error', `Name '${id}' too long. Must be between 3 and 12 characters.`, 'ident' ] );

	}

	for ( var i = 0; i < blacklisted_names.length; i ++ ) {

		if ( id.indexOf( blacklisted_names[ i ] ) > - 1 ) return send( ws, [ 'error', `Name '${id}' not available.`, 'ident' ] );

	}

	if ( ws_identified.hasOwnProperty( id ) && ws_identified[ id ] != ws ) {

		return send( ws, [ 'error', `Name '${id}' not available`, 'ident' ] );

	}

	var welcome = false;

	if ( ws_connection.hasOwnProperty( ws.id ) ) {

		delete ws_connection[ ws.id ];
		welcome = ! ws_identified.hasOwnProperty( id ) && ! ws_closed.hasOwnProperty( id );

	}

	ws_identified[ id ] = ws;

	if ( ws_closed.hasOwnProperty( id ) ) delete ws_closed[ id ];

	if ( welcome ) {

		ws_welcomed[ id ] = ws;
		broadcast( null, [ 'welcome', id ] );

	} else if ( ws_welcomed.hasOwnProperty( ws.id ) ) {

		broadcast( null, [ 'ident_change', ws.id, id ] );

	}

	ws.id = id;

};




requests.say = ( ws, message ) => {

	// remove XML/HTML markup from message
	message = message.replace( /(<([^>]+)>)/ig, "" );
	broadcast( ws, [ 'say', ws.id, message ] );

};




function send( ws, message ) {

	ws.send( encoding.encode( message ) );

}



function broadcast( origin_ws, message ) {

	var origin_id = origin_ws ? origin_ws.id : '';
	console.log( `${origin_id} -> broadcast`, message );

	var encoded_message = encoding.encode( message );

	wss.clients.forEach( ws => {

		if ( ws !== origin_ws ) ws.send( encoded_message );

	} );

}


var wss;



if ( process.mainModule === this ) {

	process.on( "SIGINT", () => {

		console.log( "SIGINT received, stopping..." );
		broadcast( null, [ 'say', null, 'Server shut down' ] );
		process.exit();

	} );


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
						mjs: "text/javascript",
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

	wss = new WebSocket.Server( { server: httpserver } );

	wss.on( 'connection', ws => {

		ws.id = 'Guest-' + Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
		ws.last_heard = ( new Date() ).getTime();

		ws.on( 'close', () => {

			if ( ws_connection.hasOwnProperty( ws.id ) ) delete ws_connection[ ws.id ];
			if ( ws_identified.hasOwnProperty( ws.id ) ) delete ws_identified[ ws.id ];
			ws_closed[ ws.id ] = ws;

		} );

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

		console.log( `${ws.id} connected` );

		send( ws, [ 'connected', ws.id ] );

	} );



	setInterval( () => {

		var expired = ( new Date() ).getTime() - CLIENT_UPDATE_INTERVAL * 2;

		for ( const id in ws_connection ) {

			var ws = ws_connection[ id ];

			if ( ws.last_heard < expired ) {

				console.log( `${id} failed to identify` );
				delete ws_connection[ id ];
				ws.terminate();

			}

		}

		for ( const id in ws_identified ) {

			var ws = ws_identified[ id ];

			if ( ws.last_heard < expired ) {

				console.log( `${ws.id} disconnected, ${id}` );
				broadcast( ws, [ 'disconnected', ws.id ] );
				delete ws_identified[ id ];
				ws.terminate();

			}

			ws.ping();

		}

		for ( const id in ws_closed ) {

			var ws = ws_closed[ id ];

			if ( ws.last_heard < expired ) {

				console.log( `${ws.id} closed` );
				delete ws_closed[ id ];
				ws.terminate();

			}

		}

	}, CLIENT_UPDATE_INTERVAL );

}
