type EventType = 'reconnect' | 'error' | 'close' | 'disconnect' | 'heartbeat' | 'onKick' | string & {}

type CallBackMap = { [key: string]: Array<any> };

export default class Emitter {

    private _callbacks: CallBackMap = {};

    on(event: EventType, fn: Function) {
        this._callbacks = this._callbacks || {};
        (this._callbacks[event] = this._callbacks[event] || []).push(fn);
        return this;
    }

    once(event: EventType, fn: Function) {
        const self = this;
        this._callbacks = this._callbacks || {};

        function on(this: any) {
            self.off(event, on);
            fn.apply(this, arguments);
        }
        on.fn = fn;
        this.on(event, on);
        return this;
    };

    addEventListener(event: EventType, fn: Function) {
        this._callbacks = this._callbacks || {};
        (this._callbacks[event] = this._callbacks[event] || [])
            .push(fn);
        return this;
    }

    off(event: EventType, fn: Function) {
        // specific event
        const callbacks = this._callbacks[event];
        if (!callbacks) return this;

        // remove specific handler
        let cb;
        for (let i = 0; i < callbacks.length; i++) {
            cb = callbacks[i];
            if (cb === fn || cb.fn === fn) {
                callbacks.splice(i, 1);
                break;
            }
        }
        return this;
    };

    removeListener(event: EventType, fn: Function) {
        // specific event
        const callbacks = this._callbacks[event];
        if (!callbacks) return this;

        // remove specific handler
        let cb;
        for (let i = 0; i < callbacks.length; i++) {
            cb = callbacks[i];
            if (cb === fn || cb.fn === fn) {
                callbacks.splice(i, 1);
                break;
            }
        }
        return this;
    };

    removeEventListener(event: EventType) {
        // specific event
        var callbacks = this._callbacks[event];
        if (!callbacks) return this;

        delete this._callbacks[event];
        return this;
    };

    removeAllListeners() {
        this._callbacks = {};
        return this;
    };

    emit(event: EventType, data?: any) {
        let callbacks = this._callbacks[event];

        if (callbacks) {
            callbacks = callbacks.slice(0);
            for (var i = 0, len = callbacks.length; i < len; ++i) {
                callbacks[i].apply(this, [data]);
            }
        }
        return this;
    };

    listeners(event: EventType): Array<any> {
        return this._callbacks[event] || [];
    };

    hasListeners(event: EventType): boolean {
        return !!this.listeners(event).length;
    };
}
