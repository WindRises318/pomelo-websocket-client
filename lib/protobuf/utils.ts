
export function isSimpleType(type: string): boolean {
    return (
        type === 'uInt32' ||
        type === 'sInt32' ||
        type === 'int32' ||
        type === 'uInt64' ||
        type === 'sInt64' ||
        type === 'float' ||
        type === 'double'
    );
}


export function encode2UTF8(charCode: any) {
    if (charCode <= 0x7f) {
        return [charCode];
    } else if (charCode <= 0x7ff) {
        return [0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f)];
    } else {
        return [0xe0 | (charCode >> 12), 0x80 | ((charCode & 0xfc0) >> 6), 0x80 | (charCode & 0x3f)];
    }
}

export function codeLength(code: any) {
    if (code <= 0x7f) {
        return 1;
    } else if (code <= 0x7ff) {
        return 2;
    } else {
        return 3;
    }
}