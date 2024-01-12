import { encode2UTF8, codeLength } from './utils'


 class Codec {
    private buffer: ArrayBuffer;
    private float32Array: Float32Array;
    private float64Array: Float64Array;
    private uInt8Array: Uint8Array;

    constructor() {
        this.buffer = new ArrayBuffer(8);
        this.float32Array = new Float32Array(this.buffer);
        this.float64Array = new Float64Array(this.buffer);
        this.uInt8Array = new Uint8Array(this.buffer);
    }

    encodeUInt32(n: string | number) {
        let new_num: number;
        if (typeof (n) === 'number') {
            new_num = n
        } else {
            new_num = parseInt(n);
        }
        if (isNaN(new_num) || new_num < 0) {
            return null;
        }

        var result: Array<number> = [];
        do {
            var tmp = new_num % 128;
            var next = Math.floor(new_num / 128);

            if (next !== 0) {
                tmp = tmp + 128;
            }
            result.push(tmp);
            new_num = next;
        } while (new_num !== 0);

        return result;
    }

    encodeSInt32(n: string | number) {
        let new_num: number;
        if (typeof (n) === 'number') {
            new_num = n
        } else {
            new_num = parseInt(n);
        }
        if (isNaN(new_num)) {
            return null;
        }
        new_num = new_num < 0 ? (Math.abs(new_num) * 2 - 1) : new_num * 2;
        return this.encodeUInt32(new_num);
    };

    decodeUInt32(bytes: any) {
        let n = 0;

        for (var i = 0; i < bytes.length; i++) {
            var m = parseInt(bytes[i]);
            n = n + ((m & 0x7f) * Math.pow(2, (7 * i)));
            if (m < 128) {
                return n;
            }
        }

        return n;
    };
    decodeSInt32(bytes:any) {
        var n = this.decodeUInt32(bytes);
        var flag = ((n % 2) === 1) ? -1 : 1;

        n = ((n % 2 + n) / 2) * flag;

        return n;
    };

    encodeFloat(float:any) {
        this.float32Array[0] = float;
        return this.uInt8Array;
    };

    decodeFloat(bytes:any, offset: number) {
        if (!bytes || bytes.length < (offset + 4)) {
            return null;
        }

        for (var i = 0; i < 4; i++) {
            this.uInt8Array[i] = bytes[offset + i];
        }

        return this.float32Array[0];
    };

    encodeDouble(double:any) {
        this.float64Array[0] = double;
        return this.uInt8Array.subarray(0, 8);
    };

    decodeDouble(bytes:any, offset: number) {
        if (!bytes || bytes.length < (offset + 8)) {
            return null;
        }

        for (var i = 0; i < 8; i++) {
            this.uInt8Array[i] = bytes[offset + i];
        }

        return this.float64Array[0];
    };

    encodeStr(bytes:any, offset: number, str: string) {
        for (var i = 0; i < str.length; i++) {
            var code = str.charCodeAt(i);
            var codes = encode2UTF8(code);

            for (var j = 0; j < codes.length; j++) {
                bytes[offset] = codes[j];
                offset++;
            }
        }

        return offset;
    };

    decodeStr(bytes:any, offset: number, length: number) {
        var array: Array<number> = [];
        var end = offset + length;

        while (offset < end) {
            var code = 0;

            if (bytes[offset] < 128) {
                code = bytes[offset];

                offset += 1;
            } else if (bytes[offset] < 224) {
                code = ((bytes[offset] & 0x3f) << 6) + (bytes[offset + 1] & 0x3f);
                offset += 2;
            } else {
                code = ((bytes[offset] & 0x0f) << 12) + ((bytes[offset + 1] & 0x3f) << 6) + (bytes[offset + 2] & 0x3f);
                offset += 3;
            }

            array.push(code);

        }

        var str = '';
        for (var i = 0; i < array.length;) {
            str += String.fromCharCode.apply(null, array.slice(i, i + 10000));
            i += 10000;
        }

        return str;
    };

    byteLength(str: string) {
        if (typeof (str) !== 'string') {
            return -1;
        }

        var length = 0;

        for (var i = 0; i < str.length; i++) {
            var code = str.charCodeAt(i);
            length += codeLength(code);
        }
        return length;
    };
}


const codec = new Codec()

export default codec;