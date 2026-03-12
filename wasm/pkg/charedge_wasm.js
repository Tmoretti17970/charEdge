/* @ts-self-types="./charedge_wasm.d.ts" */

/**
 * Compute Average True Range (Wilder's smoothing).
 * Requires parallel high/low/close Float64Arrays.
 * Returns Float64Array with NaN for warm-up indices.
 * @param {Float64Array} high
 * @param {Float64Array} low
 * @param {Float64Array} close
 * @param {number} period
 * @returns {Float64Array}
 */
export function wasm_atr(high, low, close, period) {
    const ret = wasm.wasm_atr(high, low, close, period);
    return ret;
}

/**
 * Compute Bollinger Bands.
 * Returns a flat Float64Array of length 3*n: [upper..., middle..., lower...].
 * Caller must split by n to get each band.
 * @param {Float64Array} close
 * @param {number} period
 * @param {number} multiplier
 * @returns {Float64Array}
 */
export function wasm_bollinger(close, period, multiplier) {
    const ret = wasm.wasm_bollinger(close, period, multiplier);
    return ret;
}

/**
 * Compute Exponential Moving Average.
 * Returns Float64Array with NaN for warm-up indices.
 * @param {Float64Array} close
 * @param {number} period
 * @returns {Float64Array}
 */
export function wasm_ema(close, period) {
    const ret = wasm.wasm_ema(close, period);
    return ret;
}

/**
 * Compute MACD.
 * Returns a flat Float64Array of length 3*n: [macd..., signal..., histogram...].
 * Caller must split by n to get each line.
 * @param {Float64Array} close
 * @param {number} fast
 * @param {number} slow
 * @param {number} signal
 * @returns {Float64Array}
 */
export function wasm_macd(close, fast, slow, signal) {
    const ret = wasm.wasm_macd(close, fast, slow, signal);
    return ret;
}

/**
 * Compute Relative Strength Index (Wilder's smoothing).
 * Returns Float64Array with values in [0, 100], NaN for warm-up.
 * @param {Float64Array} close
 * @param {number} period
 * @returns {Float64Array}
 */
export function wasm_rsi(close, period) {
    const ret = wasm.wasm_rsi(close, period);
    return ret;
}

/**
 * Compute Simple Moving Average.
 * Returns Float64Array with NaN for warm-up indices.
 * @param {Float64Array} close
 * @param {number} period
 * @returns {Float64Array}
 */
export function wasm_sma(close, period) {
    const ret = wasm.wasm_sma(close, period);
    return ret;
}

function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_6ddd609b62940d55: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_length_550d8a396009cd38: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_with_length_eae667475c36c4e4: function(arg0) {
            const ret = new Float64Array(arg0 >>> 0);
            return ret;
        },
        __wbg_prototypesetcall_79daf97fb14c7a19: function(arg0, arg1, arg2) {
            Float64Array.prototype.set.call(getArrayF64FromWasm0(arg0, arg1), arg2);
        },
        __wbg_set_636d1e3e4286e068: function(arg0, arg1, arg2) {
            arg0.set(getArrayF64FromWasm0(arg1, arg2));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./charedge_wasm_bg.js": import0,
    };
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat64ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('charedge_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
