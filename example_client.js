/*global encoding*/
'use strict';

( () => {

	class Chat {

		constructor( url ) {

			this.id = localStorage.getItem( 'id' );

			this.dom = document.createElement( "div" );
			this.dom.className = "ws-chat";

			this.historyDom = document.createElement( "div" );
			this.historyDom.className = "ws-chat-history";
			this.dom.append( this.historyDom );

			this.input = document.createElement( "input" );
			this.input.className = "ws-chat-input";
			this.input.setAttribute( "type", "text" );
			this.input.setAttribute( "placeholder", "Type a message..." );
			this.dom.append( this.input );

			this.input.addEventListener( "keyup", event => {

				var key = event.key;

				if ( key === 'Enter' ) {

					var command = this.input.value.trim();

					if ( ! command.startsWith( '/' ) ) {

						this.write( command );
						this.say( command );

					}

					this.input.value = '';

				}

			} );

			this.url = url;

			this.responses = {

				connected: ( id ) => {

					if ( ! this.id ) {

						this.id = id;
						localStorage.setItem( 'id', this.id );

					}

					this.send( [ 'identifyas', this.id ] );

				},

				welcome: ( id ) => {

					this.write( `Welcome <span class="ws-chat-name">${id}</span>` );

				},

				say: ( id, message ) => {

					this.write( `<span class="ws-chat-name">${id}:</span> ${message}` );

				}

			};

			this.reconnect();

		}

		reconnect() {

			this.ws = new WebSocket( this.url );
			this.ws.binaryType = 'arraybuffer';

			this.ws.onopen = () => {

				console.log( 'WebSocket open' );

			};

			this.ws.onmessage = event => {

				var message = encoding.decode( event.data );

				this.write( message );

				var response = message.shift();

				this.write( response );

				if ( 'function' === typeof this.responses[ response ] ) {

					this.responses[ response ]( ...message );

				}

			};

			this.ws.onclose = () => {

				console.log( 'WebSocket closed, attempting reconnection...' );
				this.reconnect();

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

			var now = new Date();
			var minsec = `0${now.getHours()}`.slice( - 2 ) + ':' + `0${now.getMinutes()}`.slice( - 2 );

			if ( ! this.lastwrite || this.lastwrite != minsec ) {

				var timestamp = document.createElement( "div" );
				timestamp.className = "ws-chat-timestamp";
				timestamp.textContent = minsec;
				this.historyDom.append( timestamp );

			}


			var message = document.createElement( "div" );
			message.className = "ws-chat-message";

			message.innerHTML += text;

			this.historyDom.append( message );
			this.historyDom.scrollTo( 0, this.historyDom.scrollHeight );

			this.lastwrite = minsec;

		}

		send( message ) {

			this.ws && this.ws.send( encoding.encode( message ) );

		}

		say( message ) {

			this.send( [ 'say', message ] );

		}

		whisper( name, whisper ) {
		}

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
			max-height: 100%;
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
			height: calc(100% - 2em);
			overflow-y: auto;
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
			caret-shape: block;
		}
		.ws-chat-message {
			min-height: 0;
		}
		.ws-chat-timestamp {
			color: #aaa;
			margin-right: 0.5em;
		}
		.ws-chat-name {
			color: #87d7f7;
		}
		`;
		document.head.append( style );

	}

	window.Chat = Chat;

	const chat = new Chat( "ws://localhost:8500" );
	document.body.append( chat.dom );


} )();
