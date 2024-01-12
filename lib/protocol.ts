import {
    copyArray,
    encodeMsgBody,
    encodeMsgFlag,
    encodeMsgId,
    encodeMsgRoute,
    msgHasId,
    msgHasRoute,
    caculateMsgIdBytes
} from './utils'
import {
    PKG_HEAD_BYTES,
    MSG_COMPRESS_ROUTE_MASK,
    MSG_FLAG_BYTES,
    MSG_ROUTE_CODE_BYTES,
    MSG_ROUTE_LEN_BYTES,
    MSG_TYPE_MASK,
} from './constant'

export enum PackageTypes {
    TYPE_HANDSHAKE = 1,
    TYPE_HANDSHAKE_ACK,
    TYPE_HEARTBEAT,
    TYPE_DATA,
    TYPE_KICK
}

export enum MessageTypes {
    TYPE_REQUEST,
    TYPE_NOTIFY,
    TYPE_RESPONSE,
    TYPE_PUSH
}

const ByteArray = Uint8Array

class Protocol {
    static strencode(str: any) {
        let byteArray = new ByteArray(str.length * 3);
        let offset = 0;
        for (let i = 0; i < str.length; i++) {
            let charCode = str.charCodeAt(i);
            let codes: any;
            if (charCode <= 0x7f) {
                codes = [charCode];
            } else if (charCode <= 0x7ff) {
                codes = [0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f)];
            } else {
                codes = [0xe0 | (charCode >> 12), 0x80 | ((charCode & 0xfc0) >> 6), 0x80 | (charCode & 0x3f)];
            }
            for (let j = 0; j < codes.length; j++) {
                byteArray[offset] = codes[j];
                ++offset;
            }
        }
        let _buffer = new ByteArray(offset);
        copyArray(_buffer, 0, byteArray, 0, offset);
        return _buffer;
    };
    static strdecode(buffer: any) {
        let bytes = new ByteArray(buffer);
        let array: Array<number> = [];
        let offset = 0;
        let charCode = 0;
        let end = bytes.length;
        while (offset < end) {
            if (bytes[offset] < 128) {
                charCode = bytes[offset];
                offset += 1;
            } else if (bytes[offset] < 224) {
                charCode = ((bytes[offset] & 0x3f) << 6) + (bytes[offset + 1] & 0x3f);
                offset += 2;
            } else {
                charCode = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
                offset += 3;
            }
            array.push(charCode);
        }
        return String.fromCharCode.apply(null, array);
    };
}


class PackageProtocol {
    static encode(type: number, body?: Uint8Array) {
        let length = body ? body.length : 0;
        let buffer = new ByteArray(PKG_HEAD_BYTES + length);
        let index = 0;
        buffer[index++] = type & 0xff;
        buffer[index++] = (length >> 16) & 0xff;
        buffer[index++] = (length >> 8) & 0xff;
        buffer[index++] = length & 0xff;
        if (body) {
            copyArray(buffer, index, body, 0, length);
        }
        return buffer;
    };

    static decode = function (buffer: Uint8Array) {
        let offset = 0;
        let bytes = new ByteArray(buffer);
        let length = 0;
        let rs: Array<any> = [];
        while (offset < bytes.length) {
            let type = bytes[offset++];
            length = ((bytes[offset++]) << 16 | (bytes[offset++]) << 8 | bytes[offset++]) >>> 0;
            let body = length ? new ByteArray(length) : null;
            copyArray(body, 0, bytes, offset, length);
            offset += length;
            rs.push({ 'type': type, 'body': body });
        }
        return rs.length === 1 ? rs[0] : rs;
    };
}

class MessageProtocol {
    static encode(id: number, type: number, compressRoute: number, route: any, msg: any) {
        // caculate message max length
        let idBytes = msgHasId(type) ? caculateMsgIdBytes(id) : 0;
        let msgLen = MSG_FLAG_BYTES + idBytes;

        if (msgHasRoute(type)) {
            if (compressRoute) {
                if (typeof route !== 'number') {
                    throw new Error('error flag for number route!');
                }
                msgLen += MSG_ROUTE_CODE_BYTES;
            } else {
                msgLen += MSG_ROUTE_LEN_BYTES;
                if (route) {
                    route = Protocol.strencode(route);
                    if (route.length > 255) {
                        throw new Error('route maxlength is overflow');
                    }
                    msgLen += route.length;
                }
            }
        }

        if (msg) {
            msgLen += msg.length;
        }

        let buffer = new ByteArray(msgLen);
        let offset = 0;

        // add flag
        offset = encodeMsgFlag(type, compressRoute, buffer, offset);

        // add message id
        if (msgHasId(type)) {
            offset = encodeMsgId(id, buffer, offset);
        }

        // add route
        if (msgHasRoute(type)) {
            offset = encodeMsgRoute(compressRoute, route, buffer, offset);
        }

        // add body
        if (msg) {
            offset = encodeMsgBody(msg, buffer, offset);
        }

        return buffer;
    };

    static decode(buffer: any) {
        let bytes = new ByteArray(buffer);
        let bytesLen = bytes.length || bytes.byteLength;
        let offset = 0;
        let id = 0;
        let route: any;

        // parse flag
        let flag = bytes[offset++];
        let compressRoute = flag & MSG_COMPRESS_ROUTE_MASK;
        let type = (flag >> 1) & MSG_TYPE_MASK;

        // parse id
        if (msgHasId(type)) {
            let m = parseInt((bytes[offset] as any));
            let i = 0;
            do {
                m = parseInt((bytes[offset] as any));
                id = id + ((m & 0x7f) * Math.pow(2, (7 * i)));
                offset++;
                i++;
            } while (m >= 128);
        }

        // parse route
        if (msgHasRoute(type)) {
            if (compressRoute) {
                route = (bytes[offset++]) << 8 | bytes[offset++];
            } else {
                let routeLen = bytes[offset++];
                if (routeLen) {
                    route = new ByteArray(routeLen);
                    copyArray(route, 0, bytes, offset, routeLen);
                    route = Protocol.strdecode(route);
                } else {
                    route = '';
                }
                offset += routeLen;
            }
        }

        // parse body
        let bodyLen = bytesLen - offset;
        let body = new ByteArray(bodyLen);

        copyArray(body, 0, bytes, offset, bodyLen);

        return {
            'id': id, 'type': type, 'compressRoute': compressRoute,
            'route': route, 'body': body
        };
    };
}




export {
    Protocol,
    PackageProtocol,
    MessageProtocol
}