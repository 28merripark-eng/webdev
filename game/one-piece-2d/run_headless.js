// Minimal headless runner for game.js to capture runtime errors
global.window = global;
let rfcalls = 0;
global.requestAnimationFrame = (cb) => { rfcalls++; if (rfcalls <= 3) return setImmediate(cb); return 0; };
global.cancelAnimationFrame = () => { };
// Minimal Image mock so game-created dataURLs load without a DOM
global.Image = class {
    constructor() { this.onload = null; this.onerror = null; this.width = 32; this.height = 32; }
    set src(v) { setImmediate(() => { try { if (this.onload) this.onload(); } catch (e) { if (this.onerror) this.onerror(e); } }); }
};
// Minimal mock of canvas 2D context for methods used in game.js
function makeContext() {
    const ctx = {
        imageSmoothingEnabled: false,
        fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '12px sans-serif',
        clearRect() { }, fillRect() { }, fillText() { }, strokeRect() { }, beginPath() { }, arc() { }, stroke() { }, fill() { },
        translate() { }, save() { }, restore() { }, scale() { }, rotate() { }, drawImage() { }, putImageData() { }, getImageData() { return { data: new Uint8ClampedArray(4) }; },
        fillRect() { }, fillText() { }, measureText() { return { width: 0 }; }
    };
    return ctx;
}
function makeCanvas() {
    const c = {
        width: 800, height: 480, style: {}, addEventListener() { }, getBoundingClientRect() { return { left: 0, top: 0 }; },
        getContext() { return makeContext(); }
        , toDataURL() { return 'data:image/png;base64,FAKE'; }
    };
    return c;
}
// Minimal document mock
global.document = {
    _elems: {},
    getElementById(id) {
        if (!this._elems[id]) {
            if (id === 'game') this._elems[id] = makeCanvas();
            else this._elems[id] = { textContent: '', addEventListener() { }, click() { }, style: {}, value: '', files: null };
        }
        return this._elems[id];
    },
    createElement(tag) {
        if (tag === 'canvas') return makeCanvas();
        return { getContext: makeContext, addEventListener() { }, style: {}, value: '', files: null };
    },
    addEventListener() { },
}
global.window = global;
process.on('uncaughtException', (err) => { console.error('UNCAUGHT', err && err.stack || err); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error('UNHANDLEDREJ', err && err.stack || err); process.exit(1); });

try {
    require('./game.js');
    console.log('game.js loaded without throwing during initial run');
    // allow a short timeout for any async errors
    setTimeout(() => { console.log('done'); process.exit(0); }, 200);
} catch (err) {
    console.error('LOAD_ERROR', err && err.stack || err);
    process.exit(1);
}
