// version and name
export const JS_WS_CLIENT_TYPE = 'pomelo-websocket-client';
export const JS_WS_CLIENT_VERSION: string | number = "1.0.2";

// result status code
export const RES_OK = 200;
export const RES_FAIL = 500;
export const RES_OLD_CLIENT = 501;

// default reconnect max count
export const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

// Protocol constants code 

export const PKG_HEAD_BYTES = 4;
export const MSG_FLAG_BYTES = 1;
export const MSG_ROUTE_CODE_BYTES = 2;
export const MSG_ID_MAX_BYTES = 5;
export const MSG_ROUTE_LEN_BYTES = 1;

export const MSG_ROUTE_CODE_MAX = 0xffff;

export const MSG_COMPRESS_ROUTE_MASK = 0x1;
export const MSG_TYPE_MASK = 0x7;

