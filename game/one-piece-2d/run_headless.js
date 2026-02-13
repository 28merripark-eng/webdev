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
        clearRect() { }, fillRect() { }, strokeRect() { }, fillText() { }, stroke() { }, beginPath() { }, arc() { }, fill() { },
        translate() { }, save() { }, restore() { }, scale() { }, rotate() { }, drawImage() { }, putImageData() { }, getImageData() { return { data: new Uint8ClampedArray(4) }; },
        measureText() { return { width: 0 }; }
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
            else this._elems[id] = { textContent: '', _listeners: {}, addEventListener(name, fn) { this._listeners[name] = this._listeners[name] || []; this._listeners[name].push(fn); }, click() { (this._listeners['click'] || []).forEach(f => f({})); }, style: {}, value: '', files: null };
        }
        return this._elems[id];
    },
    createElement(tag) {
        if (tag === 'canvas') return makeCanvas();
        return { getContext: makeContext, _listeners: {}, addEventListener(name, fn) { this._listeners[name] = this._listeners[name] || []; this._listeners[name].push(fn); }, dispatch(name, ev) { (this._listeners[name] || []).forEach(f => f(ev || {})); }, style: {}, value: '', files: null };
    },
    addEventListener(name, fn) { this._globalListeners = this._globalListeners || {}; this._globalListeners[name] = this._globalListeners[name] || []; this._globalListeners[name].push(fn); },
}
global.window = global;
process.on('uncaughtException', (err) => { console.error('UNCAUGHT', err && err.stack || err); process.exit(1); });
process.on('unhandledRejection', (err) => { console.error('UNHANDLEDREJ', err && err.stack || err); process.exit(1); });

try {
    require('./game.js');
    console.log('game.js loaded without throwing during initial run');
    // allow a short timeout for any async errors then dump diagnostics
    setTimeout(() => {
        try {
            const d = global._debug || {};
            console.log('DIAG player', d.player ? { x: d.player.x, y: d.player.y, w: d.player.w, h: d.player.h, onGround: d.player.onGround, hp: d.player.hp, charId: d.player.charId } : null);
            console.log('DIAG platforms0', d.platforms && d.platforms[0] ? { y: d.platforms[0].y, h: d.platforms[0].h } : null);
            console.log('DIAG enemies', d.enemies ? d.enemies.length : 0);
            console.log('gameStarted', typeof d.gameStarted === 'function' ? d.gameStarted() : null, 'gamePaused', typeof d.gamePaused === 'function' ? d.gamePaused() : null);
        } catch (e) { console.error('DIAG_ERR', e && e.stack || e); }
        console.log('done'); process.exit(0);
    }, 2200);
} catch (err) {
    console.error('LOAD_ERROR', err && err.stack || err);
    process.exit(1);
}

// --- Simulation harness for headless testing ---
// Spawn a few enemies and trigger the bazooka animation to validate behavior
setTimeout(() => {
    try {
        const d = global._debug;
        if (!d || !d.player || !d.enemies) return;
        console.log('SIM: injecting test enemies');
        // push some enemies near player
        for (let i = 0; i < 3; i++) {
            d.enemies.push({ x: d.player.x + 120 + i * 80, y: d.player.y, w: 48, h: 64, vx: 1, patrol: [d.player.x + 40, d.player.x + 400], hp: 60, alive: true, weapon: 'sword' });
        }
        console.log('SIM enemies count', d.enemies.length);

        // Compute bazooka targets similarly to in-game selection
        const center = d.player.x + d.player.w / 2;
        const reach = 480;
        let sweepStart, sweepEnd, armBackX, snapTo;
        if (d.player.facing > 0) {
            sweepStart = center; sweepEnd = center + reach;
            armBackX = d.player.x - 120; snapTo = center + reach - 60;
        } else {
            sweepEnd = center; sweepStart = center - reach;
            armBackX = d.player.x + d.player.w + 120; snapTo = center - reach + 60;
        }
        const targets = [];
        for (let i = 0; i < d.enemies.length; i++) {
            const en = d.enemies[i];
            if (!en.alive || en.petrified || en.grabbed || en.slamming) continue;
            const cx = en.x + en.w / 2;
            if (cx >= Math.min(sweepStart, sweepEnd) && cx <= Math.max(sweepStart, sweepEnd)) targets.push(i);
        }
        const targetsState = targets.map(i => {
            const e2 = d.enemies[i];
            return { origX: e2.x, origY: e2.y, t: 0, started: false, targetX: Math.min(20000, e2.x + (d.player.facing > 0 ? 400 : -400)) };
        });

        // Attach bazooka animation object to player
        d.player._bazookaAnim = { phase: 'stretch', t: 0, durStretch: 6, durHold: 4, durSnap: 6, durEnemyFly: 12, armBackX: armBackX, snapTo: snapTo, targets: targets, targetsState: targetsState };
        d.player.attacking = true; d.player.attackType = 'heavy'; d.player.attackFrame = 60; d.player.attackCooldown = 80;
        console.log('SIM: bazooka triggered with targets', targets);

        // allow animation to progress for a short period then dump enemy positions
        setTimeout(() => {
            console.log('SIM: post-animation enemy states:');
            d.enemies.forEach((e, idx) => console.log('E', idx, { x: Math.round(e.x), y: Math.round(e.y), alive: !!e.alive, hp: e.hp }));
        }, 800);
    } catch (e) { console.error('SIM_ERR', e && e.stack || e); }
}, 300);
