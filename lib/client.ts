

import Emitter from './emitter';
import Protobuf from './protobuf';

import {
    JS_WS_CLIENT_TYPE,
    JS_WS_CLIENT_VERSION,
    RES_OK,
    RES_OLD_CLIENT,
    DEFAULT_MAX_RECONNECT_ATTEMPTS
} from "./constant";
import {
    Protocol,
    PackageProtocol,
    MessageProtocol,
    PackageTypes,
    MessageTypes
} from './protocol'


// export interface PomeloClientOptions {

// }

export interface InitProps {
    host: string;
    port: string | number;
    log: boolean;
    encrypt?: boolean;
    user?: any;
    maxReconnectAttempts?: number;
    reconnect?: boolean;
    handshakeCallback?: CallBackFunc;
    [key: string]: any;
    // encode: (reqId: number, route: string, msg: any) => void;
    // decode: (data: any) => void;
}

type CallBackFunc = (data?: any) => void;

export class PomeloClient extends Emitter {
    private socket?: WebSocket | null;
    private protobuf: Protobuf;
    private reqId: number = 0;
    private callbacks: any = {};
    private handlers: any = {};
    private routeMap: any = {};
    private dict: any = {};    // route string to code
    private abbrs: any = {};   // code to route string
    private serverProtos: any = {};
    private clientProtos: any = {};

    private protoVersion: number = 0;

    private heartbeatInterval: number = 0;
    private heartbeatTimeout: number = 0;
    private nextHeartbeatTimeout: number = 0;
    private gapThreshold: number = 100;   // heartbeat gap threashold
    private heartbeatId?: number | null;
    private heartbeatTimeoutId?: number | null;
    private handshakeCallback?: CallBackFunc;


    // private decode: Function;
    // private encode: Function;

    private reconnect: boolean = false;
    private reconncetTimer?: number;
    private reconnectUrl?: string;
    private reconnectAttempts: number = 0;
    private reconnectionDelay: number = 5000;


    // private useCrypto?: boolean;
    private handshakeBuffer = {
        'sys': {
            type: JS_WS_CLIENT_TYPE,
            version: JS_WS_CLIENT_VERSION,
            rsa: {}
        },
        'user': {}
    };

    private initCallback?: Function;

    constructor() {
        super()
        this.handlers[PackageTypes.TYPE_HANDSHAKE] = this.handshake.bind(this);
        this.handlers[PackageTypes.TYPE_HEARTBEAT] = this.heartbeat.bind(this);
        this.handlers[PackageTypes.TYPE_DATA] = this.onData.bind(this);
        this.handlers[PackageTypes.TYPE_KICK] = this.onKick.bind(this);
        this.protobuf = new Protobuf()
    }


    public init(params: InitProps, callback?: CallBackFunc) {
        const { host, port, user, handshakeCallback: callBack } = params;
        let url = 'ws://' + host;
        if (port) {
            url += ':' + port;
        }
        this.handshakeBuffer.user = user;
        this.handshakeCallback = callBack;
        this.initCallback = callback;

        this.connect(params, url)
    }

    private connect(params: InitProps, url: string = '') {
        console.log('connect to ' + url);
        const maxReconnectAttempts = params.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS;
        if (window.localStorage && window.localStorage.getItem('protos') && this.protoVersion === 0) {
            const protos = JSON.parse(window.localStorage.getItem('protos') as string);
            this.protoVersion = protos.version || 0;
            this.serverProtos = protos.server || {};
            this.clientProtos = protos.version || {};
            if (!!this.protobuf) {
                this.protobuf.init({ encoderProtos: this.clientProtos, decoderProtos: this.serverProtos });
            }
        }
        this.handshakeBuffer.sys.version = this.protoVersion;
        const ws = new WebSocket(url)
        this.socket = ws
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
            if (!!this.reconnect) {
                this.emit('reconnect');
                // console.log("reconnect")
            }
            this.reset();
            let obj = PackageProtocol.encode(PackageTypes.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(this.handshakeBuffer)));
            this.send(obj);
        }

        ws.onmessage = (event) => {
            this.processPackage(PackageProtocol.decode(event.data));
            // new package arrived, update the heartbeat timeout
            if (this.heartbeatTimeout) {
                this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
            }
        }

        ws.onerror = (event) => {
            this.emit('error', event);
            console.error('socket error: ', event);
        };

        ws.onclose = (event) => {
            this.emit('close', event);
            this.emit('disconnect', event);
            if (!!params.reconnect && this.reconnectAttempts < maxReconnectAttempts) {
                this.reconnect = true;
                this.reconnectAttempts++;
                this.reconncetTimer = setTimeout(() => {
                    this.connect(params, this.reconnectUrl);
                }, this.reconnectionDelay);
                this.reconnectionDelay *= 2;
            }
        };
    }

    public request(route: any, msg: any, cb: any) {
        if (arguments.length === 2 && typeof msg === 'function') {
            cb = msg;
            msg = {};
        } else {
            msg = msg || {};
        }
        const new_route = route || msg.route;
        if (!route) {
            return;
        }

        this.reqId++;
        this.sendMessage(this.reqId, new_route, msg);

        this.callbacks[this.reqId] = cb;
        this.routeMap[this.reqId] = new_route;
    };

    public notify(route: any, msg: any) {
        msg = msg || {};
        this.sendMessage(0, route, msg);
    };


    public decode(data: any) {
        //probuff decode
        let msg = MessageProtocol.decode(data);

        if (msg.id > 0) {
            msg.route = this.routeMap[msg.id];
            delete this.routeMap[msg.id];
            if (!msg.route) {
                return;
            }
        }

        msg.body = this.deCompose(msg);
        return msg;
    };

    public encode(reqId: number, route: any, msg: any) {
        const type = reqId ? MessageTypes.TYPE_REQUEST : MessageTypes.TYPE_NOTIFY;

        //compress message by protobuf
        if (this.protobuf && this.clientProtos[route]) {
            msg = this.protobuf.encode(route, msg);
        } else {
            msg = Protocol.strencode(JSON.stringify(msg));
        }

        let compressRoute = 0;
        if (this.dict && this.dict[route]) {
            route = this.dict[route];
            compressRoute = 1;
        }

        return MessageProtocol.encode(reqId, type, compressRoute, route, msg);
    };

    public disconnect() {
        const arr = ['disconnect', "close"]
        if (this.socket) {
            for (let index = 0; index < arr.length; index++) {
                if ((this.socket as any)?.[arr[index]]) {
                    (this.socket as any)?.[arr[index]]()
                    break
                }
            }
            this.socket = null;
        }

        if (this.heartbeatId) {
            clearTimeout(this.heartbeatId);
            this.heartbeatId = null;
        }
        if (this.heartbeatTimeoutId) {
            clearTimeout(this.heartbeatTimeoutId);
            this.heartbeatTimeoutId = null;
        }
    };

    private reset() {
        this.reconnect = false;
        this.reconnectionDelay = 5000;
        this.reconnectAttempts = 0;
        clearTimeout(this.reconncetTimer);
    }

    private sendMessage(reqId: number, route: any, msg: any) {
        // if (this.useCrypto) {
        //     msg = JSON.stringify(msg);
        //     var sig = rsa.signString(msg, "sha256");
        //     msg = JSON.parse(msg);
        //     msg['__crypto__'] = sig;
        // }

        msg = this.encode(reqId, route, msg);
        var packet = PackageProtocol.encode(PackageTypes.TYPE_DATA, msg);
        this.send(packet);
    };

    private send(packet: any) {
        this.socket?.send(packet);
    }
    private processPackage(msgs: { type: string, body: any }) {
        if (Array.isArray(msgs)) {
            for (let i = 0; i < msgs.length; i++) {
                let msg = msgs[i];
                this.handlers[msg.type](msg.body);
            }
        } else {
            this.handlers[msgs.type](msgs.body);
        }
    };


    private heartbeat() {
        if (!this.heartbeatInterval) {
            // no heartbeat
            return;
        }

        let obj = PackageProtocol.encode(PackageTypes.TYPE_HEARTBEAT);
        if (this.heartbeatTimeoutId) {
            clearTimeout(this.heartbeatTimeoutId);
            this.heartbeatTimeoutId = undefined;
        }

        if (this.heartbeatId) {
            // already in a heartbeat interval
            return;
        }
        this.heartbeatId = setTimeout(() => {
            this.heartbeatId = null;
            this.send(obj);
            this.nextHeartbeatTimeout = Date.now() + this.heartbeatTimeout;
            this.heartbeatTimeoutId = setTimeout(this.heartbeatTimeoutCb, this.heartbeatTimeout);
        }, this.heartbeatInterval);
    };

    private heartbeatTimeoutCb() {
        let gap = this.nextHeartbeatTimeout - Date.now();
        if (gap > this.gapThreshold) {
            this.heartbeatTimeoutId = setTimeout(this.heartbeatTimeoutCb, gap);
        } else {
            console.error('server heartbeat timeout');
            this.emit('heartbeat', 'heartbeat timeout');
            this.disconnect();
        }
    };

    private handshake(data: any) {
        let jsonData = JSON.parse(Protocol.strdecode(data));
        console.log('jsonData', jsonData)
        if (jsonData.code === RES_OLD_CLIENT) {
            this.emit('error', 'client version not fullfill');
            return;
        }

        if (jsonData.code !== RES_OK) {
            this.emit('error', 'handshake fail');
            return;
        }
        this.handshakeInit(jsonData);

        let obj = PackageProtocol.encode(PackageTypes.TYPE_HANDSHAKE_ACK);
        this.send(obj);
        this.initCallback?.(this.socket);
    };

    private handshakeInit(data: any) {
        if (data.sys && data.sys.heartbeat) {
            this.heartbeatInterval = data.sys.heartbeat * 1000;   // heartbeat interval
            this.heartbeatTimeout = this.heartbeatInterval * 2;        // max heartbeat timeout
        } else {
            this.heartbeatInterval = 0;
            this.heartbeatTimeout = 0;
        }

        this.initData(data);
        this.handshakeCallback?.(data.user);
    };

    //Initilize data used in pomelo client
    private initData(data: any) {
        if (!data || !data.sys) {
            return;
        }
        this.dict = data.sys.dict;
        let protos = data.sys.protos;

        //Init compress dict
        if (this.dict) {
            // dict = dict;
            this.abbrs = {};

            for (let route in this.dict) {
                this.abbrs[this.dict[route]] = route;
            }
        }

        //Init protobuf protos
        if (protos) {
            this.protoVersion = protos.version || 0;
            this.serverProtos = protos.server || {};
            this.clientProtos = protos.client || {};

            //Save protobuf protos to localStorage
            window.localStorage.setItem('protos', JSON.stringify(protos));

            if (!!this.protobuf) {
                this.protobuf.init({ encoderProtos: protos.client, decoderProtos: protos.server });
            }

        }
    };

    private onData(data: any) {
        let msg = data;
        msg = this.decode(msg);
        this.processMessage(msg);
    };

    private onKick(data: any) {
        data = JSON.parse(Protocol.strdecode(data));
        this.emit('onKick', data);
    };

    private deCompose(msg: any) {
        let route = msg.route;
        //Decompose route from dict
        if (msg.compressRoute) {
            if (!this.abbrs[route]) {
                return {};
            }

            route = msg.route = this.abbrs[route];
        }
        if (this.protobuf && this.serverProtos[route]) {
            return this.protobuf.decode(route, msg.body);
        } else {
            return JSON.parse(Protocol.strdecode(msg.body));
        }
    };

    private processMessage(msg: any) {
        if (!msg.id) {
            // server push message
            this.emit(msg.route, msg.body);
            return;
        }

        //if have a id then find the callback function with the request
        let cb = this.callbacks[msg.id];

        // delete cache callback
        delete this.callbacks[msg.id];
        if (typeof cb !== 'function') {
            return;
        }

        cb(msg.body);
        return;
    };


}