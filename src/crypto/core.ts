/* eslint-disable no-use-before-define */

/**
 * CryptoJS core components.
 */

let cryptoModule: any;

// Native crypto detection
if (typeof window !== 'undefined' && window.crypto) {
    cryptoModule = window.crypto;
} else if (typeof self !== 'undefined' && self.crypto) {
    cryptoModule = self.crypto;
} else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    cryptoModule = globalThis.crypto;
} else if (typeof window !== 'undefined' && (window as any).msCrypto) {
    cryptoModule = (window as any).msCrypto;
} else if (typeof global !== 'undefined' && (global as any).crypto) {
    cryptoModule = (global as any).crypto;
}

const cryptoSecureRandomInt = (): number => {
    if (cryptoModule) {
        if (typeof cryptoModule.getRandomValues === 'function') {
            try {
                return cryptoModule.getRandomValues(new Uint32Array(1))[0];
            } catch (err) {}
        }
        if (typeof cryptoModule.randomBytes === 'function') {
            try {
                return cryptoModule.randomBytes(4).readInt32LE();
            } catch (err) {}
        }
    }
    throw new Error('Native crypto module could not be used to get secure random number.');
};

export abstract class Base {
    /**
     * Creates a copy of this object.
     */
    clone(): this {
        const clone = Object.create(Object.getPrototypeOf(this));
        Object.assign(clone, this);
        return clone;
    }
}

export interface Encoder {
    stringify(wordArray: WordArray): string;
    parse(str: string): WordArray;
}

export class WordArray extends Base {
    public words: number[];
    public sigBytes: number;

    /**
     * Initializes a newly created word array.
     * Integrated logic from lib-typedarrays.js
     */
    constructor(words?: number[] | ArrayBuffer | ArrayBufferView, sigBytes?: number) {
        super();

        let typedArray: any = words;

        // Handle Typed Arrays (lib-typedarrays logic)
        if (typedArray instanceof ArrayBuffer) {
            typedArray = new Uint8Array(typedArray);
        }

        if (
            typedArray instanceof Int8Array ||
            (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray) ||
            typedArray instanceof Int16Array ||
            typedArray instanceof Uint16Array ||
            typedArray instanceof Int32Array ||
            typedArray instanceof Uint32Array ||
            typedArray instanceof Float32Array ||
            typedArray instanceof Float64Array
        ) {
            typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
        }

        if (typedArray instanceof Uint8Array) {
            const byteLength = typedArray.byteLength;
            const _words: number[] = [];
            for (let i = 0; i < byteLength; i++) {
                _words[i >>> 2] |= typedArray[i] << (24 - (i % 4) * 8);
            }
            this.words = _words;
            this.sigBytes = byteLength;
        } else {
            // Normal initialization
            this.words = (words as number[]) || [];
            this.sigBytes = sigBytes !== undefined ? sigBytes : this.words.length * 4;
        }
    }

    toString(encoder?: Encoder): string {
        return (encoder || Hex).stringify(this);
    }

    concat(wordArray: WordArray): this {
        const thisWords = this.words;
        const thatWords = wordArray.words;
        const thisSigBytes = this.sigBytes;
        const thatSigBytes = wordArray.sigBytes;

        this.clamp();

        if (thisSigBytes % 4) {
            for (let i = 0; i < thatSigBytes; i++) {
                const thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
            }
        } else {
            for (let j = 0; j < thatSigBytes; j += 4) {
                thisWords[(thisSigBytes + j) >>> 2] = thatWords[j >>> 2];
            }
        }
        this.sigBytes += thatSigBytes;

        return this;
    }

    clamp(): void {
        const words = this.words;
        const sigBytes = this.sigBytes;
        words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
        words.length = Math.ceil(sigBytes / 4);
    }

    clone(): this {
        const clone = super.clone();
        clone.words = this.words.slice(0);
        return clone;
    }

    static random(nBytes: number): WordArray {
        const words: number[] = [];
        for (let i = 0; i < nBytes; i += 4) {
            words.push(cryptoSecureRandomInt());
        }
        return new WordArray(words, nBytes);
    }
}

export const Hex: Encoder = {
    stringify(wordArray: WordArray): string {
        const words = wordArray.words;
        const sigBytes = wordArray.sigBytes;
        const hexChars: string[] = [];
        for (let i = 0; i < sigBytes; i++) {
            const bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            hexChars.push((bite >>> 4).toString(16));
            hexChars.push((bite & 0x0f).toString(16));
        }
        return hexChars.join('');
    },

    parse(hexStr: string): WordArray {
        const hexStrLength = hexStr.length;
        const words: number[] = [];
        for (let i = 0; i < hexStrLength; i += 2) {
            words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
        }
        return new WordArray(words, hexStrLength / 2);
    }
};

export const Latin1: Encoder = {
    stringify(wordArray: WordArray): string {
        const words = wordArray.words;
        const sigBytes = wordArray.sigBytes;
        const latin1Chars: string[] = [];
        for (let i = 0; i < sigBytes; i++) {
            const bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            latin1Chars.push(String.fromCharCode(bite));
        }
        return latin1Chars.join('');
    },

    parse(latin1Str: string): WordArray {
        const latin1StrLength = latin1Str.length;
        const words: number[] = [];
        for (let i = 0; i < latin1StrLength; i++) {
            words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
        }
        return new WordArray(words, latin1StrLength);
    }
};

export const Utf8: Encoder = {
    stringify(wordArray: WordArray): string {
        try {
            return decodeURIComponent(escape(Latin1.stringify(wordArray)));
        } catch (e) {
            throw new Error('Malformed UTF-8 data');
        }
    },

    parse(utf8Str: string): WordArray {
        return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
    }
};

export abstract class BufferedBlockAlgorithm extends Base {
    protected _data: WordArray = new WordArray();
    protected _nDataBytes: number = 0;
    protected _minBufferSize: number = 0;
    public abstract blockSize: number;

    reset(): void {
        this._data = new WordArray();
        this._nDataBytes = 0;
    }

    protected _append(data: WordArray | string): void {
        if (typeof data === 'string') {
            data = Utf8.parse(data);
        }
        this._data.concat(data);
        this._nDataBytes += data.sigBytes;
    }

    protected _process(doFlush?: boolean): WordArray {
        let processedWords: number[] | undefined;
        const data = this._data;
        const dataWords = data.words;
        const dataSigBytes = data.sigBytes;
        const blockSize = this.blockSize;
        const blockSizeBytes = blockSize * 4;

        let nBlocksReady = dataSigBytes / blockSizeBytes;
        if (doFlush) {
            nBlocksReady = Math.ceil(nBlocksReady);
        } else {
            nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
        }

        const nWordsReady = nBlocksReady * blockSize;
        const nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

        if (nWordsReady) {
            for (let offset = 0; offset < nWordsReady; offset += blockSize) {
                this._doProcessBlock(dataWords, offset);
            }
            processedWords = dataWords.splice(0, nWordsReady);
            data.sigBytes -= nBytesReady;
        }

        return new WordArray(processedWords, nBytesReady);
    }

    protected abstract _doProcessBlock(words: number[], offset: number): void;

    clone(): this {
        const clone = super.clone();
        clone._data = this._data.clone();
        return clone;
    }
}

export abstract class Hasher extends BufferedBlockAlgorithm {
    public blockSize: number = 512 / 32;
    public cfg: any;

    constructor(cfg?: any) {
        super();
        this.cfg = Object.assign({}, cfg);
        this.reset();
    }

    reset(): void {
        super.reset();
        this._doReset();
    }

    update(messageUpdate: WordArray | string): this {
        this._append(messageUpdate);
        this._process();
        return this;
    }

    finalize(messageUpdate?: WordArray | string): WordArray {
        if (messageUpdate) {
            this._append(messageUpdate);
        }
        return this._doFinalize();
    }

    protected abstract _doReset(): void;
    protected abstract _doFinalize(): WordArray;
}