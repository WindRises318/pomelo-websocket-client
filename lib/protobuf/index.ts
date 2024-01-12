import MessageEncoder from "./encoder"
import MessageDecoder from "./decoder"


export interface ProtobufInitProps {
    encoderProtos: any;
    decoderProtos: any;
}

export default class Protobuf {
    private encoder?: MessageEncoder;
    private decoder?: MessageDecoder;

    init(params: ProtobufInitProps) {
        const { encoderProtos, decoderProtos } = params
        this.encoder = new MessageEncoder(encoderProtos)
        this.decoder = new MessageDecoder(decoderProtos)
    }

    encode(key: any, msg: any) {
        return this.encoder?.encode(key, msg)
    }

    decode(key: any, msg: any) {
        return this.decoder?.decode(key, msg)
    }
}
