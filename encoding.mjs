function encode( value ) {


	var type = typeof value;

	if ( value == null ) return createbuf( 1, 0 );

	if ( 'number' === type ) {

		var [ wholeStr, fracStr ] = String( Math.abs( value ) ).split( '.' );
		var whole = parseInt( wholeStr, 10 );
		var wholeLen = 255 >= whole ? 1 : 65535 >= whole ? 2 : 4294967295 >= whole ? 4 : 8;
		var frac = fracStr ? parseInt( fracStr, 10 ) : null;
		var fracLen = frac === null ? 0 : 255 >= frac ? 1 : 65535 >= frac ? 2 : 4294967295 >= frac ? 4 : 8;
		var buf = createbuf( wholeLen + 2 + fracLen, ( wholeLen + 1 ) * ( 0 <= value ? 1 : 2 ) );

		if ( 1 === wholeLen ) buf.view.setUint8( 1, whole );
		else if ( 2 === wholeLen ) buf.view.setUint16( 1, whole );
		else if ( 4 === wholeLen ) buf.view.setUint32( 1, whole );
		else buf.view.setBigUint64( 1, BigInt( whole ) );

		buf.view.setUint8( ++ wholeLen, fracLen );

		if ( 1 === fracLen ) buf.view.setUint8( ++ wholeLen, frac );
		else if ( 2 === fracLen ) buf.view.setUint16( ++ wholeLen, frac );
		else if ( 4 === fracLen ) buf.view.setUint32( ++ wholeLen, frac );
		else if ( 8 === fracLen ) buf.view.setBigUint64( ++ wholeLen, BigInt( frac ) );

		return buf;

	}

	if ( Array.isArray( value ) ) {

		var array = [],
			length = 0;

		value.forEach( item => {

			item = encode( item );
			array.push( item );
			length += item.length;

		} );

		var buf = createbuf( length + 3, 22 ),
			i = 3;

		buf.view.setUint16( 1, array.length );
		array.forEach( item => {

			buf.set( item, i );
			i += item.length;

		} );

		return buf;

	}

	var string_value = String( value );

	if ( '[object Object]' === string_value ) {

		var entries = Object.entries( value ),
			array = [],
			length = 0;

		entries.forEach( item => {

			var property = encode( item[ 0 ] );
			var val = encode( item[ 1 ] );
			array.push( [ property, val ] );
			length += property.length + val.length;

		} );

		var buf = createbuf( length + 3, 23 ),
			i = 3;

		buf.view.setUint16( 1, array.length );
		array.forEach( item => {

			var [ property, val ] = item;
			buf.set( property, i );
			i += property.length;
			buf.set( val, i );
			i += val.length;

		} );

		return buf;

	}

	var length = string_value.length;

	if ( 0 === length ) return createbuf( 1, 19 );

	if ( 1 === length )	{

		var buf = createbuf( 2, 20 );
		buf.view.setUint8( 1, string_value.charCodeAt( 0 ) );
		return buf;

	}

	var buf = createbuf( length + 3, 21 ), i = 3;

	buf.view.setUint16( 1, length );
	string_value.split( '' ).forEach( ch => buf.view.setUint8( i ++, ch.charCodeAt( 0 ) ) );

	return buf;

}



function createbuf( length, type ) {

	var buf = new Uint8Array( length );
	buf.view = new DataView( buf.buffer, 0 );
	buf.view.setUint8( 0, type );
	return buf;

}



function decode( arraybuffer ) {

	var dataview = new DataView( arraybuffer, 0 );

	var uint8array = new Uint8Array( arraybuffer );

	'undefined' === typeof arraybuffer._offset && ( arraybuffer._offset = uint8array.byteOffset );

	var type = dataview.getUint8( arraybuffer._offset ++ );

	if ( 19 > type ) {

		if ( 0 === type ) return undefined;

		var value;

		switch ( type ) {

			case 2:
				value = dataview.getUint8( arraybuffer._offset ++ );
				break;
			case 3:
				value = dataview.getUint16( arraybuffer._offset );
				arraybuffer._offset += 2;
				break;
			case 4:
				value = - dataview.getUint8( arraybuffer._offset ++ );
				break;
			case 5:
				value = dataview.getUint32( arraybuffer._offset );
				arraybuffer._offset += 4;
				break;
			case 6:
				value = - dataview.getUint16( arraybuffer._offset );
				arraybuffer._offset += 2;
				break;
			case 9:
				value = dataview.getBigUint64( arraybuffer._offset );
				arraybuffer._offset += 8;
				break;
			case 10:
				value = - dataview.getUint32( arraybuffer._offset );
				arraybuffer._offset += 4;
				break;
			case 18:
				value = - dataview.getBigUint64( arraybuffer._offset );
				arraybuffer._offset += 8;
				break;

		}

		var fracLen = dataview.getUint8( arraybuffer._offset ++ ),
			fracInt;

		if ( fracLen === 0 ) return value;

		if ( 1 === fracLen ) fracInt = dataview.getUint8( arraybuffer._offset );
		else if ( 2 === fracLen ) fracInt = dataview.getUint16( arraybuffer._offset );
		else if ( 4 === fracLen ) fracInt = dataview.getUint32( arraybuffer._offset );
		else if ( 8 === fracLen ) fracInt = dataview.getBigUint64( arraybuffer._offset );

		arraybuffer._offset += fracLen;

		return Number( `${value}.${fracInt}` );

	}

	if ( 19 === type ) return '';

	if ( 20 === type ) return String.fromCharCode( dataview.getUint8( arraybuffer._offset ++ ) );

	if ( 21 === type ) {

		var length = dataview.getUint16( arraybuffer._offset );
		arraybuffer._offset += 2;

		var i = arraybuffer._offset - uint8array.byteOffset;
		var value = String.fromCharCode.apply( null, uint8array.subarray( i, i + length ) );

		arraybuffer._offset += length;
		return value;

	}

	if ( 22 === type ) {

		var count = dataview.getUint16( arraybuffer._offset );
		arraybuffer._offset += 2;
		var value = [];
		for ( var i = 0; i < count; i ++ ) value.push( decode( arraybuffer ) );
		return value;

	}

	if ( 23 === type ) {

		var count = dataview.getUint16( arraybuffer._offset );
		arraybuffer._offset += 2;
		var value = {};
		for ( var i = 0; i < count; i ++ ) {

			var property = decode( arraybuffer );
			var val = decode( arraybuffer );
			value[ property ] = val;

		}

		return value;

	}

}

export default { encode, decode };
