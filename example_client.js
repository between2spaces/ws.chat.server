/*global encoding*/
'use strict';

( () => {

	class Chat {

		constructor( url ) {

			[ this.dom, this.messagesDom ] = createChatDom();

			this.url = url;
			this.ws = new WebSocket( url );
			this.ws.binaryType = 'arraybuffer';

			this.ws.onopen = () => {
				//chat.send( 'connection open' );
			};

			this.ws.onmessage = event => {

				this.write( encoding.decode( event.data ) );

			};

			this.ws.onclose = event => {

				console.log( event );
				this.ws = null;

			};

			this.ws.onerror = event => {

				console.log( event );

			};

		}

		static toString() {

			return 'usage: var chat = Chat( server_url )';

		}

		toString() {

			return [
				`Chat instance ${this.connected() ? '' : 'not '}connected to "${this.url}"`,
				'',
				'methods',
				'',
				'  help()                        Connection status and available methods',
				'  connected()                   True if connected; otherwise False',
				'  say( message )                Broadcast a message to all',
				'  whisper( name, message )      Send a private message to a user',
			].join( '\n' );

		}

		help() {

			return this.toString();

		}

		connected() {

			return this.ws !== null;

		}

		write( text ) {

			this.messagesDom.append( createMessageDom( text ) );

		}

		say( message ) {

			this.ws && this.ws.send( encoding.encode( message ) );

		}

		whisper( name, whisper ) {
		}

	}


	function createChatDom() {

		var dom = document.createElement( "div" );
		dom.className = "ws-chat";
		var history = document.createElement( "div" );
		history.className = "ws-chat-history";
		dom.append( history );
		var input = document.createElement( "input" );
		input.className = "ws-chat-input";
		input.setAttribute( "type", "text" );
		input.setAttribute( "placeholder", "Type a message..." );
		dom.append( input );

		return [ dom, history ];

	}


	function createMessageDom( text ) {

		var message = document.createElement( "div" );
		message.className = "ws-chat-message";
		message.textContent = text;

		return message;

	}


	if ( ! document.getElementById( "ws-chat-style" ) ) {

		const style = document.createElement( "style" );
		style.setAttribute( "id", "ws-chat-style" );
		style.textContent = `
		.ws-chat {
			display: flex;
			flex-direction: column;
			position: absolute;
			min-width: 10em;
			min-height: 3em;
			left: 0;
			right: 0;
			top: 0;
			bottom: 0;
			overflow-x: hidden;
			text-shadow: 0 0 5px #C8C8C8;
			font-family: 'Courier New', monospace;
			font-size: 2cm;
			color: black;
			border: 1px solid gray;
		}
		.ws-chat-history {
			flex: 1;
			border: 1px solid orange;
			word-wrap: break-word;
		}
		.ws-chat-input {
			flex: 1;
			max-height: 2em;
			border: 1px solid green;
			outline: none;
			overflow-x: hidden;
			text-shadow: 0 0 5px #C8C8C8;
			font-family: 'Courier New', monospace;
			font-size: 2cm;
			color: black;
		}
		`;
		document.head.append( style );

	}

	window.Chat = Chat;

	const chat = new Chat( "ws://localhost:8500" );
	document.body.append( chat.dom );


} )();
