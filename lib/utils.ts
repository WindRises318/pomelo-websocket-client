import { MessageTypes } from './protocol'
import { MSG_FLAG_BYTES, MSG_ROUTE_CODE_MAX } from './constant'

// 拷贝数组
export function copyArray(dest: any, doffset: number, src: any, soffset: number, length: number) {
    if ('function' === typeof src.copy) {
        // Buffer
        src.copy(dest, doffset, soffset, soffset + length);
    } else {
        // Uint8Array
        for (var index = 0; index < length; index++) {
            dest[doffset++] = src[soffset++];
        }
    }
};


export function msgHasId(type: number): boolean {
    return type === MessageTypes.TYPE_REQUEST || type === MessageTypes.TYPE_RESPONSE;
};

export function msgHasRoute(type: number): boolean {
    return type === MessageTypes.TYPE_REQUEST || type === MessageTypes.TYPE_NOTIFY || type === MessageTypes.TYPE_PUSH;
};

export function caculateMsgIdBytes(id: number) {
    let len = 0;
    do {
        len += 1;
        id >>= 7;
    } while (id > 0);
    return len;
};

export function encodeMsgFlag(type: number, compressRoute: number, buffer: Uint8Array, offset: number) {
    if (type !== MessageTypes.TYPE_REQUEST && type !== MessageTypes.TYPE_NOTIFY &&
        type !== MessageTypes.TYPE_RESPONSE && type !== MessageTypes.TYPE_PUSH) {
        throw new Error('unkonw MessageTypes type: ' + type);
    }

    buffer[offset] = (type << 1) | (compressRoute ? 1 : 0);

    return offset + MSG_FLAG_BYTES;
};

export function encodeMsgId(id: number, buffer: Uint8Array, offset: number) {
    do {
        let tmp = id % 128,
            next = Math.floor(id / 128);

        if (next !== 0) {
            tmp = tmp + 128;
        }
        buffer[offset++] = tmp;

        id = next;
    } while (id !== 0);

    return offset;
};

export function encodeMsgRoute(compressRoute: number, route: any, buffer: Uint8Array, offset: number) {
    if (compressRoute) {
        if (route > MSG_ROUTE_CODE_MAX) {
            throw new Error('route number is overflow');
        }

        buffer[offset++] = (route >> 8) & 0xff;
        buffer[offset++] = route & 0xff;
    } else {
        if (route) {
            buffer[offset++] = route.length & 0xff;
            copyArray(buffer, offset, route, 0, route.length);
            offset += route.length;
        } else {
            buffer[offset++] = 0;
        }
    }

    return offset;
};

export function encodeMsgBody(msg: any, buffer: Uint8Array, offset: number) {
    copyArray(buffer, offset, msg, 0, msg.length);
    return offset + msg.length;
};