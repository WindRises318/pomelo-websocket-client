import codec from "./codec";
import { isSimpleType } from './utils'

export default class MessageDecoder {
    private buffer: any;
    private offset: number = 0;
    public protos:any = {};

    constructor(protos:any) {
        this.protos = protos || {};
    }
    setProtos(protos:any) {
        if (!!protos) {
            this.protos = protos;
        }
    };

    decode(route:any, buf:any) {
        let protos = this.protos[route];

        this.buffer = buf;
        this.offset = 0;

        if (!!protos) {
            return this.decodeMsg({}, protos, this.buffer.length);
        }

        return null;
    };

    private decodeMsg(msg:any, protos:any, length:any) {
        while (this.offset < length) {
            let head = this.getHead();
            let tag = head.tag;
            let name = protos.__tags[tag];

            switch (protos[name].option) {
                case 'optional':
                case 'required':
                    msg[name] = this.decodeProp(protos[name].type, protos);
                    break;
                case 'repeated':
                    if (!msg[name]) {
                        msg[name] = [];
                    }
                    this.decodeArray(msg[name], protos[name].type, protos);
                    break;
            }
        }
        return msg;
    }

    private getHead() {
        let tag = codec.decodeUInt32(this.getBytes());

        return {
            type: tag & 0x7,
            tag: tag >> 3
        };
    }

    // private peekHead() {
    //     let tag = codec.decodeUInt32(this.peekBytes());

    //     return {
    //         type: tag & 0x7,
    //         tag: tag >> 3
    //     };
    // }

    // private peekBytes() {
    //     return this.getBytes(true);
    // }
    private decodeProp(type:string, protos?: any) {
        switch (type) {
            case 'uInt32':
                return codec.decodeUInt32(this.getBytes());
            case 'int32':
            case 'sInt32':
                return codec.decodeSInt32(this.getBytes());
            case 'float':
                let float = codec.decodeFloat(this.buffer, this.offset);
                this.offset += 4;
                return float;
            case 'double':
                let double = codec.decodeDouble(this.buffer, this.offset);
                this.offset += 8;
                return double;
            case 'string':
                let length = codec.decodeUInt32(this.getBytes());

                let str = codec.decodeStr(this.buffer, this.offset, length);
                this.offset += length;

                return str;
            default:
                let message = protos && (protos.__messages[type] || protos['message ' + type]);
                if (!!message) {
                    let length = codec.decodeUInt32(this.getBytes());
                    let msg = {};
                    this.decodeMsg(msg, message, this.offset + length);
                    return msg;
                }
                break;
        }
    }

    private decodeArray(array:any, type:string, protos:any) {
        if (isSimpleType(type)) {
            let length = codec.decodeUInt32(this.getBytes());

            for (let i = 0; i < length; i++) {
                array.push(this.decodeProp(type));
            }
        } else {
            array.push(this.decodeProp(type, protos));
        }
    }

    private getBytes(flag?: boolean) {
        let bytes: Array<any> = [];
        let pos = this.offset;
        flag = flag || false;

        let b: any;

        do {
            b = this.buffer[pos];
            bytes.push(b);
            pos++;
        } while (b >= 128);

        if (!flag) {
            this.offset = pos;
        }
        return bytes;
    }

    // private isFinish(msg, protos) {
    //     return (!protos.__tags[this.peekHead().tag]);
    // }
}



