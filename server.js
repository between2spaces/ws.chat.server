'use strict';

const WebSocket = require( 'ws' );
const encoding = require( './encoding.js' );


const port = 8500;
const wss = new WebSocket.Server( { port: port } );
const ws_clients_by_csrftoken = {};


wss.on( 'connection', function connection( ws, req ) {

	var csrftoken = req.headers[ 'cookie' ].replace( /.*csrftoken=(\w+).*/, "$1" );

	if ( ! ( csrftoken in ws_clients_by_csrftoken ) ) {

		ws.csrftoken = csrftoken;
		ws.last_heard = ( new Date() ).getTime();
		ws_clients_by_csrftoken[ csrftoken ] = ws;
		console.log( `${csrftoken} connected` );
		ws.send( encoding.encode( [ 'welcome', csrftoken ] ) );
		broadcast( encoding.encode( [ 'connected', csrftoken ] ), ws );

	}

	ws.on( 'pong', () => {

		ws_clients_by_csrftoken[ csrftoken ].last_heard = ( new Date() ).getTime();

		console.log( `pong ${csrftoken} ${ws_clients_by_csrftoken[ csrftoken ].last_heard}` );

	} );

	ws.on( 'message', message => {

		encoded_message = message.buffer.slice( message.byteOffset, message.byteOffset + message.byteLength );
		decoded_message = encoding.decode( message );
		console.log( `${csrftoken}: ${decoded_message}` );
		broadcast( encoded_message );

	} );

} );



function broadcast( data, origin_ws ) {

	wss.clients.forEach( ws => {

		if ( ws !== origin_ws ) ws.send( data );

	} );

}



const CLIENT_UPDATE_INTERVAL = 10000;



setInterval( () => {

	var now = ( new Date() ).getTime();

	for ( const csrftoken in ws_clients_by_csrftoken ) {

		var ws = ws_clients_by_csrftoken[ csrftoken ];

		if ( ws.last_heard < now - CLIENT_UPDATE_INTERVAL * 2 ) {

			console.log( `${ws.csrftoken} disconnected` );
			broadcast( encoding.encode( [ 'disconnected', ws.csrftoken ] ) );
			delete ws_clients_by_csrftoken[ csrftoken ];
			return ws.terminate();

		}

		ws.ping();

	}

}, CLIENT_UPDATE_INTERVAL );



console.log( "local websocket chat server running at\n  => http://localhost:" + port + "/\nCTRL + C to shutdown" );
