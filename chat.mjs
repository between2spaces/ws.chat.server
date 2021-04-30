import encoding from './encoding.mjs';


export default class Chat {

	constructor( url ) {

		console.log( `Chat ${url}` );

		this.id = localStorage.getItem( 'id' );

		this.dom = document.createElement( "div" );
		this.dom.className = "ws-chat";

		this.historyDom = document.createElement( "div" );
		this.historyDom.className = "ws-chat-history";
		this.dom.append( this.historyDom );

		this.input = document.createElement( "input" );
		this.input.className = "ws-chat-input";
		this.input.setAttribute( "type", "text" );
		this.dom.append( this.input );

		this.blur();

		this.url = url;
		this.ident_change_cache = {};

		var self = this;

		window.addEventListener( 'beforeunload', () => {

			self.disconnect();

		} );

		this.re_rename = /^\/rename (\w+)$/;

		this.input.addEventListener( "focus", () => {

			this.focus();

		} );

		this.input.addEventListener( "blur", () => {

			this.blur();

		} );

		this.input.addEventListener( "keyup", event => {

			var key = event.key;

			if ( key === 'Enter' ) {

				var message = this.input.value;

				// remove XML/HTML markup from message
				message = message.replace( /(<([^>]+)>)/ig, "" ).trim();

				this.input.value = '';

				if ( message === '' ) return;

				if ( ! message.startsWith( '/' ) ) {

					this.write( message, this.id );
					this.say( message );
					return;

				}

				if ( this.re_rename.test( message ) ) {

					return this.rename( this.re_rename.exec( message )[ 1 ] );

				}

				this.write( `Command '${message}' not found` );

			}

		} );

		this.responses = {

			connected: ( id ) => {

				if ( ! this.id ) {

					this.id = id;
					localStorage.setItem( 'id', this.id );

				}

				this.send( [ 'ident', this.id ] );

			},

			welcome: ( id ) => {

				this.write( `Welcome <span class="ws-chat-name">${id}</span>` );

			},

			error: ( error, type ) => {

				this.write( error );

			},

			ident_change: ( oldid, newid ) => {

				console.log( `ident_change`, oldid, newid );

				if ( this.id === oldid ) {

					this.id = newid;
					localStorage.setItem( 'id', this.id );
					this.write( `Successfully renamed to <span class="ws-chat-name">${newid}</span>` );

				} else {

					this.ident_change_cache[ newid ] = oldid;

				}

			},

			say: ( id, message ) => {

				this.write( message, id );

			}

		};

		this.reconnect();

		setInterval( () => {

			if ( ! self.ws ) {

				console.log( 'WebSocket closed, attempting reconnection...' );

				self.reconnect();

			}

		}, 1000 );

	}

	reconnect() {

		console.log( 'reconnect' );

		this.ws = new WebSocket( this.url );
		this.ws.binaryType = 'arraybuffer';

		this.ws.onopen = () => {

			console.log( 'WebSocket open' );

		};

		this.ws.onmessage = event => {

			var message = encoding.decode( event.data );

			var response = message.shift();

			if ( 'function' === typeof this.responses[ response ] ) {

				this.responses[ response ]( ...message );

			}

		};

		this.ws.onclose = () => {

			this.ws = null;

		};

		this.ws.onerror = event => {

			console.log( event );

		};

	}

	disconnect() {

		if ( this.ws ) this.ws.close();

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

	focus() {

		this.dom.style.background = 'linear-gradient(180deg, rgba(2,0,36,1) 0%, rgba(39,44,102,0.7861345221682423) 70%, rgba(74,85,162,0.7273109927564776) 100%)';
		this.historyDom.style.border = '1px solid #666';
		this.historyDom.style.overflowY = 'auto';
		this.input.style.background = null;
		this.input.setAttribute( "placeholder", "Type a message..." );

	}

	blur() {

		this.historyDom.style.overflowY = 'hidden';
		this.dom.style.background = null;
		this.historyDom.style.border = '0';
		this.input.style.background = 'rgba(2,0,36,0.7217087518601191)';
		this.input.removeAttribute( "placeholder" );

	}

	connected() {

		return this.ws !== null;

	}

	write( text, origin ) {

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

		if ( origin ) {

			if ( this.ident_change_cache.hasOwnProperty( origin ) ) {

				var oldname = this.ident_change_cache[ origin ];
				delete this.ident_change_cache[ origin ];
				origin = `${oldname} - ${origin}`;

			}

			text = `<span class="ws-chat-name">${origin}:</span>${text}`;

		}

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

	rename( name ) {

		this.send( [ 'ident', name ] );

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
			min-height: 4em;
			min-width: 10em;
			max-height: 50%;
			width: 33%;
			left: 10px;
			bottom: 20px;
			overflow-x: hidden;
			font-family: 'Courier New', monospace;
			color: #aaa;
			border-radius: 5px;
		}
		.ws-chat-history {
			flex: 1;
			word-wrap: break-word;
			height: calc(100% - 2em);
			overflow-y: auto;
			border-radius: 5px;
			padding-left: 0.5em;
			padding-right: 0.5em;
		}
		.ws-chat-input {
			flex: 1;
			max-height: 1.5em;
			min-height: 1.5em;
			border: 2px solid orange;
			border-radius: 5px;
			outline: none;
			overflow-x: hidden;
			font-family: inherit;
			font-size: inherit;
			color: white;
			padding-left: 0.5em;
			padding-right: 0.5em;
			background: none;
		}
		input::-webkit-input-placeholder {
			color:    white;
			opacity:  1;
		}
		input:-moz-placeholder {
			color:    white;
			opacity:  1;
		}
		input::-moz-placeholder {
			color:    white;
			opacity:  1;
		}
		input.:-moz-placeholder {
			color:    white;
			opacity:  1;
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


