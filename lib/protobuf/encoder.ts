import codec from "./codec";
import { TYPES } from './constants';
import { isSimpleType } from './utils'

export default class MessageEncoder {
    public protos: any = {};
    private checkMessage: CheckMessage;

    constructor(protos: any) {
        this.checkMessage = new CheckMessage()
        this.protos = protos || {};
    }
    encode(route: any, msg: any) {
        //Get protos from protos map use the route as key
        let protos = this.protos[route];

        //Check msg
        if (!this.checkMessage.checkMsg(msg, protos)) {
            return null;
        }

        //Set the length of the buffer 2 times bigger to prevent overflow
        let length = codec.byteLength(JSON.stringify(msg));

        //Init buffer and offset
        let buffer = new ArrayBuffer(length);
        let uInt8Array = new Uint8Array(buffer);
        let offset = 0;

        if (!!protos) {
            offset = this.checkMessage.encodeMsg(uInt8Array, offset, protos, msg);
            if (offset > 0) {
                return uInt8Array.subarray(0, offset);
            }
        }

        return null;
    };

}



class CheckMessage {
    
    checkMsg(msg: any, protos: any) {
        if (!protos) {
            return false;
        }

        for (let name in protos) {
            let proto = protos[name];

            //All required element must exist
            switch (proto.option) {

                case 'required':
                    if (typeof (msg[name]) === 'undefined') {
                        console.warn('no property exist for required! name: %j, proto: %j, msg: %j', name, proto, msg);
                        return false;
                    }
                    break;
                case 'optional':
                    if (typeof (msg[name]) !== 'undefined') {
                        let message = protos.__messages[proto.type] || protos['message ' + proto.type];
                        if (!!message && !this.checkMsg(msg[name], message)) {
                            console.warn('inner proto error! name: %j, proto: %j, msg: %j', name, proto, msg);
                            return false;
                        }
                    }
                    break;
                case 'repeated':
                    //Check nest message in repeated elements
                    let message = protos.__messages[proto.type] || protos['message ' + proto.type];
                    if (!!msg[name] && !!message) {
                        for (let i = 0; i < msg[name].length; i++) {
                            if (!this.checkMsg(msg[name][i], message)) {
                                return false;
                            }
                        }
                    }
                    break;
            }
        }

        return true;
    }

    encodeMsg(buffer: any, offset: any, protos: any, msg: any) {
        for (let name in msg) {
            if (!!protos[name]) {
                let proto = protos[name];
                switch (proto.option) {
                    case 'required':
                    case 'optional':
                        offset = this.writeBytes(buffer, offset, this.encodeTag(proto.type, proto.tag));
                        offset = this.encodeProp(msg[name], proto.type, offset, buffer, protos);
                        break;
                    case 'repeated':
                        if (msg[name].length > 0) {
                            offset = this.encodeArray(msg[name], proto, offset, buffer, protos);
                        }
                        break;
                }
            }
        }

        return offset;
    }

    encodeProp(value: any, type: string, offset: number, buffer: any, protos?: any) {
        switch (type) {
            case 'uInt32':
                offset = this.writeBytes(buffer, offset, codec.encodeUInt32(value));
                break;
            case 'int32':
            case 'sInt32':
                offset = this.writeBytes(buffer, offset, codec.encodeSInt32(value));
                break;
            case 'float':
                this.writeBytes(buffer, offset, codec.encodeFloat(value));
                offset += 4;
                break;
            case 'double':
                this.writeBytes(buffer, offset, codec.encodeDouble(value));
                offset += 8;
                break;
            case 'string':
                let length = codec.byteLength(value);

                //Encode length
                offset = this.writeBytes(buffer, offset, codec.encodeUInt32(length));
                //write string
                codec.encodeStr(buffer, offset, value);
                offset += length;
                break;
            default:
                let message = protos.__messages[type] || protos['message ' + type];
                if (!!message) {
                    //Use a tmp buffer to build an internal msg
                    let tmpBuffer: any = new ArrayBuffer(codec.byteLength(JSON.stringify(value)) * 2);
                    let length = 0;

                    length = this.encodeMsg(tmpBuffer, length, message, value);
                    //Encode length
                    offset = this.writeBytes(buffer, offset, codec.encodeUInt32(length));
                    //contact the object
                    for (let i = 0; i < length; i++) {
                        buffer[offset] = tmpBuffer[i];
                        offset++;
                    }
                }
                break;
        }

        return offset;
    }

    encodeArray(array: any, proto: any, offset: number, buffer: any, protos: any) {
        let i = 0;

        if (isSimpleType(proto.type)) {
            offset = this.writeBytes(buffer, offset, this.encodeTag(proto.type, proto.tag));
            offset = this.writeBytes(buffer, offset, codec.encodeUInt32(array.length));
            for (i = 0; i < array.length; i++) {
                offset = this.encodeProp(array[i], proto.type, offset, buffer);
            }
        } else {
            for (i = 0; i < array.length; i++) {
                offset = this.writeBytes(buffer, offset, this.encodeTag(proto.type, proto.tag));
                offset = this.encodeProp(array[i], proto.type, offset, buffer, protos);
            }
        }

        return offset;
    }

    writeBytes(buffer: any, offset: number, bytes: any) {
        for (let i = 0; i < bytes.length; i++, offset++) {
            buffer[offset] = bytes[i];
        }

        return offset;
    }

    encodeTag(type: string, tag: number) {
        let value = (TYPES as any)[type] || 2;
        return codec.encodeUInt32((tag << 3) | value);
    }

}
