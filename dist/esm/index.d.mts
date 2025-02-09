export declare const serdesTagSymbol: unique symbol;
export declare const serdesSerializeSymbol: unique symbol;
export declare const serdesDeserializeSymbol: unique symbol;
type Transferables = MessagePort | ReadableStream | WritableStream | ArrayBuffer | ArrayBufferView;
type Revokables = MessagePort;
export declare const serializer: (data: unknown) => {
    data: unknown;
    transferables: Transferables[];
    revokables: Revokables[];
};
export declare const deserializer: {
    (data: unknown): unknown;
    register<T>(ctor: {
        new (..._args: never): T;
        [serdesTagSymbol]: string;
        [serdesDeserializeSymbol]: (..._args: never) => T;
    }): void;
};
export {};
