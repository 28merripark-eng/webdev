const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Simple world
const gravity = 0.9;
let keys = {};

document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

// Special key handler for paused choice menus (e.g., Luffy heavy-attack choices)
document.addEventListener('keydown', e => {
    if (player._chooseHeavy && player.charId === 'luffy') {
        if (e.key === '1') {
            // start gum-gum bazooka animation sequence while paused
            startBazookaAnim();
            // clear lingering key state and stop other handlers
            keys[e.key.toLowerCase()] = false; e.preventDefault(); e.stopImmediatePropagation();
            return;
        }
        if (e.key === '2') {
            // Gear 2 selection: toggle Gear2; if turning off, start cooldown (50s)
            if (player._gear2) {
                player._gear2 = false;
                player.gear2Cooldown = 50 * 60; // 50 seconds at ~60fps
            } else {
                // prevent re-activating if cooldown active
                if (player.gear2Cooldown && player.gear2Cooldown > 0) {
                    // just close menu and unpause
                    player._chooseHeavy = false; gamePaused = false;
                    keys[e.key.toLowerCase()] = false; e.preventDefault(); e.stopImmediatePropagation();
                    return;
                }
                player._gear2 = true;
                // make absolutely sure the character id stays Luffy and restore immunities
                player.charId = 'luffy';
                const lc = characters.luffy || {};
                player.gunImmune = !!lc.gunImmune; player.swordImmune = !!lc.swordImmune;
            }
            // clear states and unpause
            player._chooseHeavy = false; gamePaused = false;
            // clear lingering key state and stop other handlers
            keys[e.key.toLowerCase()] = false; e.preventDefault(); e.stopImmediatePropagation();
            return;
        }
        if (e.key === '3') {
            // Gear 3 selection: toggle Gear3 (hand growth)
            player._gear3 = !player._gear3;
            // ensure still Luffy
            player.charId = 'luffy';
            const lc3 = characters.luffy || {};
            player.gunImmune = !!lc3.gunImmune; player.swordImmune = !!lc3.swordImmune;
            player._chooseHeavy = false; gamePaused = false;
            keys[e.key.toLowerCase()] = false; e.preventDefault(); e.stopImmediatePropagation();
            return;
        }
    }
});

// (Gear 2 is selected from the paused heavy-choice menu; no global toggle)

// Helper to begin the bazooka animation: find target and initialize animation state
function startBazookaAnim() {
    if (!player._chooseHeavy || player.charId !== 'luffy') return;
    // find nearest enemy in front
    let target = null; let bestD = 999999; let idx = -1;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive || e.petrified || e.grabbed || e.slamming) continue;
        const dx = (e.x - player.x) * player.facing;
        if (dx < 40) continue;
        if (dx < 1200) {
            const d = Math.abs(dx) + Math.abs(e.y - player.y);
            if (d < bestD) { bestD = d; target = e; idx = i; }
        }
    }
    if (!target) { player._chooseHeavy = false; gamePaused = false; return; }

    // compute arm back position (stretch to the edge of the current section behind the player)
    const sectionIndex = Math.floor(player.x / (SECTION_W + GAP));
    const sectionStart = sectionIndex * (SECTION_W + GAP);
    const sectionEnd = sectionStart + SECTION_W;
    const armBackX = player.facing === 1 ? sectionStart : sectionEnd;

    const snapTo = player.facing === 1 ? sectionEnd : sectionStart;
    const shift = 2 * (SECTION_W + GAP);

    // collect targets across the sweep from armBackX -> snapTo (enemies in the path)
    const sweepStart = Math.min(armBackX, snapTo);
    const sweepEnd = Math.max(armBackX, snapTo);
    const targets = [];
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive || e.petrified || e.grabbed || e.slamming) continue;
        // enemy center
        const cx = e.x + e.w / 2;
        if (cx >= sweepStart && cx <= sweepEnd) targets.push(i);
    }

    // prepare per-target state for the animation (enemy target X after launch)
    const targetsState = targets.map(i => {
        const e = enemies[i];
        return { origX: e.x, origY: e.y, t: 0, started: false, targetX: Math.min(WORLD_W - e.w - 8, e.x + shift) };
    });

    player._bazookaAnim = {
        phase: 'stretch', t: 0, durStretch: 30, durHold: 8, durSnap: 18, durEnemyFly: 36,
        armBackX: armBackX, snapTo: snapTo,
        targets: targets, targetsState: targetsState
    };
    // set Luffy into an attacking/animation state so his sprite reflects action
    player.attacking = true; player.attackType = 'heavy'; player.attackFrame = 60; player.attackCooldown = 80;
}

function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Player
const player = {
    x: 80, y: 360, w: 40, h: 56,
    vx: 0, vy: 0, speed: 4.5, jump: 16,
    onGround: false, facing: 1,
    maxHp: 100, hp: 100,
    // attack state
    attacking: false, attackFrame: 0, attackCooldown: 0, attackType: null, attackExt: 0,
    // flight / special move
    flyCooldown: 0, flyTimer: 0, flyMode: null,
    // animation state
    animT: 0, walkSpeed: 0,
    // character identity
    charId: 'luffy', gunImmune: false, swordImmune: false
};

// Character definitions (fan-inspired, procedural visuals only)
const characters = {
    luffy: { name: 'Luffy', gunImmune: true, swordImmune: false, hp: 100 },
    kizaru: { name: 'Kizaru', gunImmune: true, swordImmune: true, hp: 120 },
    buggy: { name: 'Buggy', gunImmune: false, swordImmune: true, hp: 110 },
    boa: { name: 'Boa', gunImmune: false, swordImmune: false, hp: 100 }
};

function applyCharacter(id) {
    const c = characters[id] || characters.luffy;
    player.charId = id; player.gunImmune = !!c.gunImmune; player.swordImmune = !!c.swordImmune;
    player.maxHp = c.hp; player.hp = player.maxHp;
    player.attacking = false; player.attackType = null; player.attackCooldown = 0; player.attackExt = 0; player._inv = 0;
}
applyCharacter('luffy');

let gamePaused = true; // used when player dead / selection menu; start paused until title selection
let gameStarted = false;
// detachable hands for Buggy
let hands = [];
// Boa's rideable snake when using her flight special
let boaSnake = null;

// Draw title screen and selection before game starts
function drawTitleScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd'; ctx.font = '36px sans-serif'; ctx.fillText('one piece pirate warriors 5', W / 2 - 260, H / 2 - 80);
    ctx.font = '16px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('Choose your character to begin', W / 2 - 120, H / 2 - 40);

    const choices = ['luffy', 'kizaru', 'buggy', 'boa'];
    const w = 240, h = 72;
    for (let i = 0; i < choices.length; i++) {
        const x = W / 2 - (choices.length * (w + 14)) / 2 + i * (w + 14);
        const y = H / 2 - 10;
        ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText(characters[choices[i]].name, x + 18, y + 40);
        // hint
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 12, y + 46, w - 24, 10);
    }
    ctx.fillStyle = '#ccc'; ctx.font = '12px sans-serif'; ctx.fillText('Click a portrait or press 1-4', W / 2 - 90, H / 2 + 70);
}

// World and level platforms (multiple themed horizontal sections)
// Increased section width and gaps so each theme feels like a separate, longer level
const SECTION_W = 1600; // wider per-theme section
const GAP = 220; // gap between sections to feel separated
const themes = [
    { name: 'Louge Town', bg: '#dbeefc' },
    { name: 'Alabasta', bg: '#f6e1c4' },
    { name: 'Skypiea', bg: '#eaf7ff' },
    { name: 'Water7', bg: '#e6f7fb' },
    { name: 'Enies Lobby', bg: '#f1e9e6' },
    { name: 'Punk Hazard', bg: '#f3e9eef0' },
    { name: 'Egghead', bg: '#eef2ff' }
];

// world width computed from sections + gaps
const WORLD_W = themes.length * SECTION_W + (themes.length - 1) * GAP;

// Egghead special region (fire starts halfway through Egghead)
const eggIndex = themes.findIndex(t => t.name === 'Egghead');
let eggStart = eggIndex * (SECTION_W + GAP);
let eggEnd = eggStart + SECTION_W;
let fireStart = eggStart + Math.floor(SECTION_W / 2);

// fire and boat state
let fireTick = 0;
let boatSequence = false;
let boatTimer = 0;
let boarded = false;
let needRestart = false;

let platforms = [];
function buildLevel() {
    platforms = [];
    // ground across world
    platforms.push({ x: 0, y: 460, w: WORLD_W, h: 80 });

    // add themed platform clusters
    for (let i = 0; i < themes.length; i++) {
        const baseX = i * (SECTION_W + GAP) + 80;
        // a few platforms per section
        platforms.push({ x: baseX + 120, y: 380 - (i % 3) * 10, w: 160, h: 16 });
        platforms.push({ x: baseX + 340, y: 300 - (i % 2) * 8, w: 150, h: 16 });
        platforms.push({ x: baseX + 560, y: 360 - ((i + 1) % 3) * 12, w: 120, h: 16 });
        platforms.push({ x: baseX + 760, y: 280 - (i % 2) * 6, w: 120, h: 16 });
    }
}
buildLevel();

// Enemies
let enemies = [];
function spawnEnemy(x, y) {
    // limit concurrent enemies to avoid runaway
    if (enemies.length > 60) return;
    const weapon = Math.random() < 0.5 ? 'gun' : 'sword';
    // ensure enemies don't spawn embedded in the ground/platforms
    const h = 64; const w = 48;
    let yy = y;
    if (platforms && platforms.length) {
        const groundY = platforms[0].y; // main ground
        if (yy + h > groundY) yy = groundY - h;
    }
    // larger full-body bandit size
    enemies.push({
        x: Math.max(0, Math.min(WORLD_W - w, x)), y: yy, w: w, h: h, vx: 1.0, patrol: [x - 120, x + 120], hp: 60, alive: true, weapon,
        petrified: false, removedTimer: 0, grabbed: false, slamming: false, origY: yy
    });
}
spawnEnemy(520, 256);
spawnEnemy(700, 320);
spawnEnemy(880, 236);

let score = 0;
let camX = 0;

function update() {
    if (gamePaused) return;
    // Input
    let left = keys['arrowleft'] || keys['a'];
    let right = keys['arrowright'] || keys['d'];
    let up = keys['arrowup'] || keys['w'];
    let down = keys['arrowdown'] || keys['s'];
    let attackKey = keys['k'];

    if (left) { player.vx = -player.speed; player.facing = -1 } else if (right) { player.vx = player.speed; player.facing = 1 } else { player.vx = 0 }

    if (up && player.onGround) { player.vy = -player.jump; player.onGround = false }

    // Attack handling: K = light, J = heavy stretch, L = spin
    let lightKey = keys['k'];
    let heavyKey = keys['j'];
    let spinKey = keys['l'];

    if (lightKey && player.attackCooldown <= 0 && !player.attacking) {
        let baseFrame = 8, baseCd = 22;
        if (player.charId === 'luffy' && player._gear2) { baseFrame = Math.max(1, Math.floor(baseFrame / 10)); baseCd = Math.max(1, Math.floor(baseCd / 10)); }
        player.attacking = true; player.attackType = 'light'; player.attackFrame = baseFrame; player.attackCooldown = baseCd;
    }
    if (heavyKey && player.attackCooldown <= 0 && !player.attacking) {
        if (player.charId === 'luffy') {
            // open heavy-attack choice menu for Luffy and pause the game to select
            player._chooseHeavy = true; gamePaused = true;
        } else {
            // apply Gear2 speedup for heavy attacks (except bazooka which sets its own frame elsewhere)
            let hf = 18, hcd = 48;
            if (player.charId === 'luffy' && player._gear2) { hf = Math.max(1, Math.floor(hf / 10)); hcd = Math.max(1, Math.floor(hcd / 10)); }
            player.attacking = true; player.attackType = 'heavy'; player.attackFrame = hf; player.attackCooldown = hcd;
        }
    }
    if (spinKey && player.attackCooldown <= 0 && !player.attacking) {
        let baseFrame = 20, baseCd = 80;
        if (player.charId === 'luffy' && player._gear2) { baseFrame = Math.max(1, Math.floor(baseFrame / 10)); baseCd = Math.max(1, Math.floor(baseCd / 10)); }
        player.attacking = true; player.attackType = 'spin'; player.attackFrame = baseFrame; player.attackCooldown = baseCd;
    }

    // heavy-choice selection handled via keydown listener while paused

    if (player.attacking) {
        player.attackFrame--;
        if (player.attackFrame <= 0) { player.attacking = false; player.attackType = null }
    }
    if (player.attackCooldown > 0) player.attackCooldown--

    // Flight / special move (F)
    if (player.flyCooldown > 0) player.flyCooldown--;
    // start flight when F pressed (flight persists while F held)
    if (keys['f'] && player.flyCooldown <= 0 && !player.flyMode) {
        // start special flight
        player.flyTimer = 0;
        if (player.charId === 'kizaru') {
            player.flyMode = 'kizaru_light';
            // become light: increase speed and slim hitbox for duration
            player.vx = player.facing * 8; player.vy = 0;
        } else if (player.charId === 'luffy') {
            // Luffy: sling upward briefly then launch forward two sections
            player.flyMode = 'luffy_stretch';
            // prepare sling state: delay while slinging up, then propel forward over frames
            const shift = 2 * (SECTION_W + GAP);
            const forwardFrames = 10;
            player._sling = { phase: 0, delay: 10, forwardFrames, shiftTotal: shift, shiftDone: 0, perFrame: Math.ceil(shift / forwardFrames) };
            // give an initial upward velocity to sling him into the air
            player.vy = -player.jump * 1.5;
            player.vx = 0;
        } else if (player.charId === 'buggy') {
            player.flyMode = 'buggy_pieces';
            // spawn pieces array attached to player
            player._pieces = [];
            for (let i = 0; i < 6; i++) player._pieces.push({ ox: -12 + i * 6, oy: -28 - (i % 2) * 6, vy: -1 - i * 0.4 });
        } else if (player.charId === 'boa') {
            // Boa Hancock: summon a blue-and-white rideable snake and stand on its head
            player.flyMode = 'boa_snake';
            // place snake's head near the player's feet and let it carry her forward
            boaSnake = {
                x: player.x + player.w / 2, // head x world coord
                y: player.y + player.h - 6, // head y world coord (slightly below player's feet)
                vx: player.facing * 6, dir: player.facing,
                wobble: 0, segs: 12, segW: 14, h: 16,
                color1: '#4da6ff', color2: '#ffffff'
            };
            player.vx = 0; player.vy = 0; player.onGround = false;
        } else {
            player.flyMode = 'generic_fly';
            player.vx = player.facing * 6;
        }
    }

    // advance flying timer / handle end
    if (player.flyMode) {
        player.flyTimer++;
        // durations kept for reference (not used for auto-ending while F held)
        const dur = player.charId === 'kizaru' ? 80 : player.charId === 'luffy' ? 28 : player.charId === 'buggy' ? 60 : player.charId === 'boa' ? 80 : 40;
        // update Boa's snake while active
        if (player.flyMode === 'boa_snake' && boaSnake) {
            boaSnake.x += boaSnake.vx;
            boaSnake.wobble += 0.14;
            // gentle vertical bob
            boaSnake.y += Math.sin(boaSnake.wobble) * 0.6;
            // clamp head in world bounds
            if (boaSnake.x < 8) boaSnake.x = 8;
            if (boaSnake.x > WORLD_W - 8) boaSnake.x = WORLD_W - 8;
            // keep player standing on the snake's head
            player.x = boaSnake.x - player.w / 2;
            player.y = boaSnake.y - player.h + 2;
            player.vx = 0; player.vy = 0; player.onGround = false;
        }
        // Luffy sling behavior while in luffy_stretch
        if (player.flyMode === 'luffy_stretch' && player._sling) {
            const s = player._sling;
            s.phase++;
            // during delay phase, let physics (vy) carry Luffy upward (we already set initial vy)
            if (s.phase > s.delay && s.forwardFrames > 0) {
                // move forward gradually over forwardFrames
                const move = Math.min(s.perFrame, s.shiftTotal - s.shiftDone);
                player.x = Math.min(WORLD_W - player.w - 8, player.x + move * (player.facing || 1));
                s.shiftDone += move;
                s.forwardFrames--;
            }
            // once shift complete, clear sling state so normal flight end handles cleanup
            if (s.shiftDone >= s.shiftTotal) {
                delete player._sling;
            }
        }
        // Flight no longer auto-ends by timer — it ends when the player releases the F key below.
        // (keep player.flyTimer available for visuals or effects while flying)

        // End flight when F released: cleanup and apply a short cooldown
        if (player.flyMode && !keys['f']) {
            // cleanup per-mode
            if (player.flyMode === 'boa_snake') { boaSnake = null; player.riding = false; }
            if (player.flyMode === 'buggy_pieces') { player._pieces = null; }
            if (player.flyMode === 'luffy_stretch') { delete player._sling; }
            // clear flying state
            player.flyMode = null; player.flyTimer = 0;
            // restore normal movement state
            player.vx = 0; player.vy = 0;
            // apply cooldown to prevent instant re-trigger
            player.flyCooldown = 60;
        }
    }

    // compute attack extension / radius based on type and progress
    if (player.attacking) {
        const tot = player.attackType === 'heavy' ? 18 : player.attackType === 'spin' ? 20 : 8;
        const t = (tot - Math.max(0, player.attackFrame)) / tot; // 0->1
        if (player.attackType === 'light') {
            player.attackExt = Math.round(t * 28) + 8; player.attackRadius = 0;
        } else if (player.attackType === 'heavy') {
            player.attackExt = Math.round(t * 96) + 12; player.attackRadius = 0;
        } else if (player.attackType === 'spin') {
            player.attackExt = 0; player.attackRadius = Math.round(20 + t * 56);
        }
    } else { player.attackExt = 0; player.attackRadius = 0 }

    // prevent negative or extremely large values
    player.attackExt = Math.max(0, Math.min(player.attackExt, 220));
    player.attackRadius = Math.max(0, Math.min(player.attackRadius, 380));

    // directional flight control for applicable flight modes
    if (player.flyMode === 'kizaru_light' || player.flyMode === 'generic_fly') {
        const dx = (right ? 1 : 0) - (left ? 1 : 0);
        const dy = (down ? 1 : 0) - (up ? 1 : 0);
        const sp = player.charId === 'kizaru' ? 8 : 6;
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy) || 1;
            player.vx = (dx / len) * sp;
            player.vy = (dy / len) * sp;
        } else {
            player.vx = player.facing * sp; player.vy = 0;
        }
    }

    // Physics: flying modes that allow directional movement should not be affected by gravity
    if (player.flyMode === 'kizaru_light' || player.flyMode === 'generic_fly') {
        player.x += player.vx;
        player.y += player.vy;
    } else {
        player.vy += gravity * 0.6;
        player.x += player.vx;
        player.y += player.vy;
    }

    // Update hands (Buggy's detachable hands)
    for (let i = hands.length - 1; i >= 0; i--) {
        const h = hands[i];
        if (h.attached) {
            // carry attached enemy upward until slam is triggered by reaching a certain height
            h.y += h.vy; h.vy -= 0.6; // upward deceleration (negative vy)
            const e = h.target;
            if (e) { e.x = h.x - 4; e.y = h.y - 12; }
            // when hand has lifted high enough, trigger slam
            if (h.y < player.y - 140) {
                if (h.target) {
                    h.target.grabbed = false; h.target.grabbedByHand = false; h.target.slamming = true; h.target.slamspeed = 18; h.target.origY = h.target.y;
                }
                h.returning = true; hands.splice(i, 1); continue;
            }
            continue;
        }

        // flying hand
        h.x += h.vx; h.y += h.vy; h.vy += gravity * 0.2;
        // collision with target enemy
        const t = h.target;
        if (t && !t.grabbed && !t.slamming && Math.abs(h.x - t.x) < 18 && Math.abs(h.y - t.y) < 18) {
            h.attached = true; h.vx = 0; h.vy = -6; t.grabbed = true; t.grabbedByHand = true; t.grabbedBy = h; continue;
        }

        // remove if out of world bounds or returning
        if (h.x < -100 || h.x > WORLD_W + 100 || h.returning) { hands.splice(i, 1); }
    }

    // update player hand-out state
    player.handsOut = hands.length > 0;

    // Platform collisions
    player.onGround = false;
    for (let p of platforms) {
        if (player.vy >= 0 && player.x + player.w > p.x && player.x < p.x + p.w) {
            if (player.y + player.h > p.y && player.y + player.h < p.y + p.h + player.vy + 8) {
                player.y = p.y - player.h; player.vy = 0; player.onGround = true;
            }
        }
    }

    // Keep in world bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > WORLD_W) player.x = WORLD_W - player.w;
    if (player.y > H) { player.hp = 0 }

    // Enemies update (handle grabbed/petrified/slamming states and special attacks)
    for (let e of enemies) {
        // launched enemies (from Luffy bazooka) - arc through air toward launchTargetX then die
        if (e.launched) {
            e.x += e.launchVx; e.y += e.launchVy; e.launchVy += gravity * 0.6;
            // small rotation or arc effect could be here
            // when reached or passed target X, mark dead and schedule removal
            if ((e.launchVx > 0 && e.x >= e.launchTargetX) || (e.launchVx < 0 && e.x <= e.launchTargetX)) {
                e.alive = false; e.launched = false; e.removedTimer = 40; score += 300;
            }
            continue;
        }
        // petrified corpses: countdown then expire
        if (e.petrified) {
            e.removedTimer = (e.removedTimer || 60) - 1;
            if (e.removedTimer <= 0) { e.petrified = false; e.petrifiedByBoa = false; }
            continue;
        }

        // If enemy is grabbed by player (not by Buggy's hand), attach to player until slam
        if (e.grabbed && !e.grabbedByHand) {
            e.x = player.x + (player.facing === 1 ? player.w + 8 : -12);
            e.y = player.y + 12;
            if (player.attackFrame <= 2 && !e.slamming) { e.grabbed = false; e.slamming = true; e.slamspeed = 14; }
            continue;
        }

        // slamming enemy fall to ground
        if (e.slamming) {
            e.y += e.slamspeed; e.slamspeed += 2;
            const groundY = platforms[0].y;
            if (e.y + e.h >= groundY) {
                // land: apply half-health effect for Buggy slam (enemy loses half HP)
                e.y = groundY - e.h;
                e.slamming = false;
                // if slammed by Buggy's hand, reduce HP by half (leave half remaining)
                e.hp = Math.max(1, Math.ceil(e.hp / 2));
                e.removedTimer = 40;
            }
            continue;
        }

        // normal movement
        e.x += e.vx;
        if (e.x < e.patrol[0] || e.x > e.patrol[1]) e.vx *= -1;

        // Attack hit detection (allow hits even if not touching player)
        if (player.attacking && player.attackType) {
            // SPIN attack (area)
            if (player.attackType === 'spin') {
                const R = player.attackRadius || 0;
                const hb = { x: player.x - R, y: player.y - R, w: player.w + R * 2, h: player.h + R * 2 };
                if (rectsOverlap(hb, e)) {
                    // Boa turns to stone and instantly kill
                    if (player.charId === 'boa') { e.petrified = true; e.petrifiedByBoa = true; e.removedTimer = 30; e.alive = false; score += 260; continue; }
                    const dmg = 30;
                    e.hp -= dmg; e.x += (e.x < player.x ? -1 : 1) * 8;
                    if (e.hp <= 0) { e.alive = false; score += 120 }
                    continue;
                }
            } else {
                // Kizaru heavy-beam: if Kizaru is using the heavy attack and the attack is in the firing window,
                // hit every enemy across the map vertically aligned with the player's attack zone.
                if (player.charId === 'kizaru' && player.attackType === 'heavy') {
                    const tot = 18; const t = (tot - Math.max(0, player.attackFrame)) / tot;
                    if (t > 0.45) {
                        const beam = { x: 0, y: player.y + 6, w: WORLD_W, h: player.h - 8 };
                        if (rectsOverlap(beam, e)) {
                            const dmg = 120; e.hp -= dmg; e.x += player.facing * 12;
                            if (e.hp <= 0) { e.alive = false; score += 600 }
                        }
                        continue;
                    }
                }
                const ext = player.attackExt || 0;
                const hw = 32 + ext;
                const hx = player.facing === 1 ? player.x + player.w : player.x - hw;
                const hb = { x: hx, y: player.y + 8, w: hw, h: player.h - 16 };

                if (rectsOverlap(hb, e)) {
                    // Buggy: attempt to grab on heavy
                    if (player.charId === 'buggy' && player.attackType === 'heavy' && !e.grabbed && !e.slamming) {
                        // spawn a detachable hand that targets this enemy
                        hands.push({ x: player.x + (player.facing === 1 ? player.w : -8), y: player.y + 12, vx: player.facing * 12, vy: -2, target: e, attached: false, returning: false, side: player.facing });
                        player.handsOut = true;
                        continue;
                    }

                    // Boa: turn light-grey then defeat (mark petrified-by-Boa)
                    if (player.charId === 'boa') { e.petrified = true; e.petrifiedByBoa = true; e.removedTimer = 30; e.alive = false; score += 260; continue; }

                    // Kizaru: heavy becomes beam (long-range) - apply beam when attack progress sufficient
                    // Kizaru beam removed: heavy attacks no longer create a long-range beam

                    // default damage
                    const dmg = player.attackType === 'heavy' ? 40 : 20;
                    e.hp -= dmg; e.x += player.facing * 10;
                    if (e.hp <= 0) { e.alive = false; score += (player.attackType === 'heavy' ? 180 : 100) }
                    continue;
                }
            }
        }

        // Simple collision with player (damage to player)
        if (rectsOverlap(player, e)) {
            // Kizaru: invulnerable while in light-flight
            if (player.flyMode === 'kizaru_light') { continue; }
            if (!player._inv) {
                // enemy weapon may be ineffective against certain chars
                let edmg = 8;
                if (e.weapon === 'gun' && player.gunImmune) edmg = 0;
                if (e.weapon === 'sword' && player.swordImmune) edmg = 0;
                player.hp -= edmg; player._inv = 40
            }
        }
    }

    if (player._inv > 0) player._inv--;

    // Remove dead enemies periodically but keep special-state visuals briefly
    enemies = enemies.filter(e => e.alive || e.petrified || e.grabbed || e.slamming || Math.random() < 0.01);

    // Camera follow player, clamp
    camX = Math.round(player.x - W / 2 + player.w / 2);
    camX = Math.max(0, Math.min(camX, WORLD_W - W));

    // Fire damage when inside Egghead's burning half
    if (!boatSequence && player.x > fireStart && player.x < eggEnd) {
        fireTick++;
        if (fireTick % 30 === 0) {
            player.hp -= 6;
            // small knockback
            player.vx = player.facing === 1 ? -1.5 : 1.5;
        }
    }

    // Boat boarding trigger: when player reaches the very end of Egghead, start boarding sequence
    if (!boatSequence && player.x >= eggEnd - 48) {
        boatSequence = true; boatTimer = 0;
    }

    // Handle boat sequence: player moves toward the boat and jumps in, then mark boarded
    if (boatSequence && !boarded) {
        boatTimer++;
        const targetX = eggEnd - 40;
        // nudge player toward boat, disable normal controls
        player.vx = 0; player.vy = 0; player.onGround = false;
        player.x += (targetX - player.x) * 0.18;
        if (boatTimer < 20) player.y -= 6; else if (boatTimer < 40) player.y -= 2;
        if (boatTimer > 60) { boarded = true; gamePaused = true; }
    }

    // Update UI
    document.getElementById('hp').textContent = Math.max(0, Math.round(player.hp));
    document.getElementById('pts').textContent = score;

    // spin attack visual: emit yellow radial lines when active (L attack)
    if (player.attacking && player.attackType === 'spin' && player.attackRadius) {
        const cx = Math.round(player.x + player.w / 2 - camX);
        const cy = Math.round(player.y + player.h / 2);
        const R = player.attackRadius;
        const rays = 16;
        for (let i = 0; i < rays; i++) {
            const a = (i / rays) * Math.PI * 2;
            const x2 = Math.round(cx + Math.cos(a) * R);
            const y2 = Math.round(cy + Math.sin(a) * R);
            ctx.strokeStyle = 'rgba(255,215,0,0.9)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke();
            // small ember dots along the ray
            for (let t = 0; t < R; t += 26) {
                const px = Math.round(cx + Math.cos(a) * t);
                const py = Math.round(cy + Math.sin(a) * t);
                ctx.fillStyle = 'rgba(255,240,120,0.9)'; ctx.fillRect(px - 2, py - 2, 4, 4);
            }
        }
    }

    // spin attack visual: emit yellow radial lines when active (L attack)
    if (player.attacking && player.attackType === 'spin' && player.attackRadius) {
        const cx = Math.round(player.x + player.w / 2 - camX);
        const cy = Math.round(player.y + player.h / 2);
        const R = player.attackRadius;
        const rays = 16;
        for (let i = 0; i < rays; i++) {
            const a = (i / rays) * Math.PI * 2;
            const x2 = Math.round(cx + Math.cos(a) * R);
            const y2 = Math.round(cy + Math.sin(a) * R);
            ctx.strokeStyle = 'rgba(255,215,0,0.9)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke();
            // small ember dots along the ray
            for (let t = 0; t < R; t += 26) {
                const px = Math.round(cx + Math.cos(a) * t);
                const py = Math.round(cy + Math.sin(a) * t);
                ctx.fillStyle = 'rgba(255,240,120,0.9)'; ctx.fillRect(px - 2, py - 2, 4, 4);
            }
        }
    }
}

// Draw an 8-bit style character and arm-stretch animation
function drawPlayer(ctx, p) {
    ctx.save();
    // draw at top-left world coords (so feet align with platform y)
    ctx.translate(Math.round(p.x), Math.round(p.y));
    const S = 2; // pixel scale: sprite grid is 16x28 -> 32x56
    const pxw = 16, pxh = 28;
    if (p.facing < 0) {
        ctx.scale(-1, 1);
        // when mirrored, translate so drawing still uses positive coordinates
        ctx.translate(-(pxw * S), 0);
    }

    function r(x, y, wpx, hpx, color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x * S), Math.round(y * S), Math.round(wpx * S), Math.round(hpx * S));
    }

    // Slight leg bob
    const legBob = Math.round(Math.abs(Math.sin(p.animT * 6)) * 1.5);

    // Palette
    const skin = p._gear2 ? '#f4b6a0' : '#f1c27d';
    const straw = '#f4d542';
    const band = '#b11';
    const shirt = '#d43';
    const pants = '#1b4a7a';
    const shoe = '#321b0f';

    if (p.charId === 'buggy') {
        // Buggy 8-bit clown-style model
        const skinB = '#ffe6d0';
        const hat = '#9b59b6';
        const brim = '#f44';
        const nose = '#e33';
        const stripeA = '#3aa0d9';
        const stripeB = '#ffffff';
        const pantsB = '#9b59b6';
        const shoeB = '#ff4d4d';
        const glove = '#ffffff';

        // Head/hat
        r(3, 1, 10, 8, skinB);       // face
        r(4, -4, 8, 4, hat);         // hat top
        r(2, -1, 12, 2, brim);       // hat brim

        // Eyes / makeup
        r(5, 3, 2, 1, '#000'); r(9, 3, 2, 1, '#000');
        // Red nose
        r(8, 4, 2, 2, nose);

        // Torso - striped shirt
        r(2, 10, 12, 3, stripeA);
        r(2, 13, 12, 3, stripeB);
        r(2, 16, 12, 3, stripeA);
        r(2, 19, 12, 3, stripeB);

        // Big pants / shorts
        r(4, 22, 8, 6, pantsB);

        // Legs and big clown shoes
        r(3, 30 + legBob, 4, 3, shoeB);
        r(9, 30 - legBob, 4, 3, shoeB);

        // Arms / gloves (hide while hands detached)
        if (!p.handsOut) {
            r(0, 12, 4, 4, glove); r(14, 12, 4, 4, glove);
        } else {
            // draw small shoulder stubs to imply detached hands
            r(1, 12, 2, 3, '#ddd'); r(14, 12, 2, 3, '#ddd');
        }

    } else if (p.charId === 'kizaru') {
        // Kizaru 8-bit inspired model: yellow suit + cape with blue logo
        const skinK = '#f1c27d';
        const suit = '#ffd700'; // bright yellow suit
        const suitShade = '#e6c200';
        const cape = '#072f6b'; // dark blue cape
        const capeLogo = '#4da6ff'; // light blue logo
        const hairK = '#e6d07a';
        const shoeK = '#2b2b2b';

        // Cape drawn slightly behind (left and right panels)
        r(-1, 6, 18, 18, cape);
        // cape logo near shoulder
        r(6, 10, 4, 4, capeLogo);

        // Head / hair
        r(4, 0, 8, 6, hairK);
        r(5, 2, 6, 6, skinK);
        // Eyes
        r(6, 3, 1, 1, '#000'); r(9, 3, 1, 1, '#000');

        // Suit torso (bright yellow) with slight shading
        r(3, 10, 10, 10, suit);
        r(3, 12, 10, 2, suitShade);

        // Trousers / boots
        r(4, 22, 6, 6, suit);
        r(9, 22, 3, 6, suit);
        r(3, 28, 4, 2, shoeK); r(10, 28, 4, 2, shoeK);

        // Arms (slim)
        r(1, 12, 3, 4, skinK); r(14, 12, 3, 4, skinK);

    } else if (p.charId === 'boa') {
        // Boa Hancock 8-bit inspired model (refined proportions)
        const skinB = '#fde0d6';
        const hair = '#22172a';
        const dress = '#c8376b';
        const gold = '#ffd86b';
        const shoeB = '#3b1f2b';

        // Hair - add side flow and softer top
        r(0, -6, 6, 6, hair); r(10, -6, 6, 6, hair);
        r(1, -2, 14, 4, hair);

        // Face (slightly narrower)
        r(5, 0, 6, 8, skinB);

        // Eyes (a little more distance)
        r(6, 3, 1, 1, '#000'); r(9, 3, 1, 1, '#000');

        // Decorative gold collar / epaulets
        r(3, 8, 10, 3, gold);
        r(2, 11, 12, 6, dress);

        // slimmer skirt with center panel
        r(5, 19, 6, 10, dress);
        r(4, 21, 8, 6, '#a62f57');

        // Legs / shoes (subtle bob)
        r(6, 31 + legBob, 2, 3, shoeB);
        r(8, 31 - legBob, 2, 3, shoeB);

        // Arms + shoulders (graceful pose)
        r(1, 12, 3, 4, skinB); r(14, 12, 3, 4, skinB);

    } else {
        // Luffy-style model (default)

        // Head area (pixel coords)
        r(4, 1, 8, 8, skin);       // face
        r(2, -2, 12, 4, straw);     // hat brim
        r(4, -6, 8, 6, straw);      // hat top
        r(4, -1, 8, 2, band);       // band

        // scar under eye (tiny)
        r(9, 4, 1, 1, '#a33');

        // Torso and shirt
        r(2, 9, 12, 10, shirt);

        // Shorts
        r(4, 19, 8, 6, pants);

        // Legs and shoes (with bob)
        r(4, 25 + legBob, 3, 3, pants);
        r(9, 25 - legBob, 3, 3, pants);
        r(3, 28 + legBob, 3, 2, shoe);
        r(10, 28 - legBob, 3, 2, shoe);

        // Arm base position
        const ax = 12; const ay = 12;
        // Arm extension based on attackExt
        const ext = p.attackExt ? Math.round((p.attackExt / 8)) : 0;
        // Upper arm
        r(ax - 2, ay, 4 + ext, 3, skin);
        // Hand (grow if Gear 3 active while attacking)
        const handW = (p._gear3 && p.attacking) ? 9 : 3;
        r(ax + 2 + ext, ay, handW, 3, skin);
    }

    ctx.restore();
}

function draw() {
    // Background
    ctx.clearRect(0, 0, W, H);
    // gear2 cooldown ticks even while paused (draw runs every frame)
    if (player.gear2Cooldown && player.gear2Cooldown > 0) player.gear2Cooldown--;
    // If title not shown/selected yet, draw title screen and skip game draw
    if (!gameStarted) {
        // draw faint background blocks for sections
        for (let i = 0; i < themes.length; i++) {
            const x = i * SECTION_W;
            ctx.fillStyle = themes[i].bg;
            ctx.fillRect(x - camX, 0, SECTION_W, H);
        }
        drawTitleScreen(ctx);
        return;
    }
    // Draw themed background sections (with gaps between them so levels feel separated)
    for (let i = 0; i < themes.length; i++) {
        const x = i * (SECTION_W + GAP);
        ctx.fillStyle = themes[i].bg;
        ctx.fillRect(x - camX, 0, SECTION_W, H);
        // theme label
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = '16px sans-serif';
        ctx.fillText(themes[i].name, x - camX + 12, 36);
        // small decorative skyline/land for each theme
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (let s = 0; s < 6; s++) ctx.fillRect(x - camX + 40 + s * 140, 120 + (i % 3) * 6, 80, 24 + (s % 2) * 8);

        // draw gap separator after the section (except after last)
        if (i < themes.length - 1) {
            const gapX = x + SECTION_W;
            ctx.fillStyle = '#cfdadf';
            ctx.fillRect(gapX - camX, 0, GAP, H);
        }
    }

    // Egghead fire: when player has progressed past halfway through Egghead, light the remainder on fire
    if (!boatSequence && player.x > fireStart) {
        const fx = Math.round(fireStart - camX);
        const fw = Math.round(eggEnd - fireStart);
        // animated flame bands
        for (let fxpos = 0; fxpos < fw; fxpos += 14) {
            const h = 8 + Math.floor(Math.abs(Math.sin((player.animT + fxpos * 0.05) * 4)) * 18);
            const xdraw = fx + fxpos;
            ctx.fillStyle = '#ff8a00'; ctx.fillRect(xdraw, platforms[0].y - h, 10, h);
            ctx.fillStyle = '#ffcf33'; ctx.fillRect(xdraw + 2, platforms[0].y - Math.floor(h * 0.6), 6, Math.floor(h * 0.6));
        }
    }

    // Ground tiles / platforms
    for (let p of platforms) {
        ctx.fillStyle = '#6b4f2b';
        ctx.fillRect(p.x - camX, p.y, p.w, p.h);
        // top edge
        ctx.fillStyle = '#8b5d3b';
        ctx.fillRect(p.x - camX, p.y - 6, p.w, 6);
    }

    // Enemies (world coords -> draw relative to camera) - larger full-body bandits
    for (let e of enemies) {
        if (!(e.alive || e.petrified || e.grabbed || e.slamming)) continue;
        const dx = Math.round(e.x - camX);
        const dy = Math.round(e.y);

        // choose body color by state; Boa-petrified corpses use a lighter grey so player sees the "turn grey then die" effect
        let bodyCol = '#5b3a2b';
        if (e.petrifiedByBoa) bodyCol = '#ddd';
        else if (e.petrified) bodyCol = '#999';
        else if (e.grabbedByHand) bodyCol = '#a0a';
        else if (e.slamming) bodyCol = '#600';

        // head (bigger)
        ctx.fillStyle = bodyCol; ctx.fillRect(dx + 8, dy + 2, 16, 12);
        // hat/bandana
        ctx.fillStyle = '#222'; ctx.fillRect(dx + 8, dy - 2, 16, 4);

        // torso
        ctx.fillStyle = '#6b7'; ctx.fillRect(dx + 6, dy + 16, 20, 20);

        // arms
        ctx.fillStyle = '#d6b'; ctx.fillRect(dx + 2, dy + 16, 6, 14);
        ctx.fillRect(dx + 34, dy + 16, 6, 14);

        // legs/shoes
        ctx.fillStyle = '#3b2d20'; ctx.fillRect(dx + 8, dy + 36, 6, 10); ctx.fillRect(dx + 22, dy + 36, 6, 10);

        // weapon icon: small readable glyph next to head
        if (e.weapon === 'gun') {
            ctx.fillStyle = '#111'; ctx.fillRect(dx + 22, dy + 6, 12, 6); ctx.fillRect(dx + 30, dy + 4, 2, 2);
        } else {
            ctx.fillStyle = '#bbb'; ctx.fillRect(dx + 22, dy + 6, 3, 18); ctx.fillStyle = '#aa3333'; ctx.fillRect(dx + 20, dy + 4, 6, 3);
        }

        // HP bar (hide while petrified so player sees the greyed-out corpse clearly)
        if (e.alive && !e.petrified) { ctx.fillStyle = '#000'; ctx.fillRect(dx, dy - 10, e.w, 5); ctx.fillStyle = '#0f0'; ctx.fillRect(dx, dy - 10, Math.round(e.w * Math.max(0, e.hp / 60)), 5); }
        if (e.petrified) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(dx + 12, dy + 8, 6, 6); }
    }

    // draw Buggy hands
    for (const h of hands) {
        const hx = Math.round(h.x - camX), hy = Math.round(h.y);
        // simple pixel glove: white base with pink fingers
        ctx.fillStyle = '#fff'; ctx.fillRect(hx, hy, 8, 8);
        ctx.fillStyle = '#f4c'; ctx.fillRect(hx + 1, hy + 1, 2, 2); ctx.fillRect(hx + 5, hy + 1, 2, 2);
        ctx.fillStyle = '#ddd'; ctx.fillRect(hx + 2, hy + 4, 4, 2);
        if (h.attached) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(hx - 2, hy + 8, 12, 3) }
    }

    // Draw flying / special visuals
    if (player.flyMode) {
        if (player.flyMode === 'kizaru_light') {
            // draw Kizaru as a yellow ball, but keep the flashing square overlay
            const cx = Math.round(player.x + player.w / 2 - camX);
            const cy = Math.round(player.y + player.h / 2);
            const r = Math.max(player.w, player.h) / 2;
            // yellow ball body
            ctx.fillStyle = 'rgba(255,220,90,0.98)';
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
            // small highlight
            ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, Math.max(2, r * 0.25), 0, Math.PI * 2); ctx.fill();
            // flashing square overlay (preserve existing visual)
            const sx = Math.round(player.x - camX);
            const sy = Math.round(player.y);
            ctx.fillStyle = 'rgba(255,230,120,0.22)'; ctx.fillRect(sx, sy - 2, player.w, player.h);
            ctx.strokeStyle = 'rgba(255,215,0,0.95)'; ctx.lineWidth = 2; ctx.strokeRect(sx, sy - 2, player.w, player.h);
        }
        if (player.flyMode === 'buggy_pieces' && player._pieces) {
            const baseX = Math.round(player.x - camX);
            const baseY = Math.round(player.y);
            for (const ps of player._pieces) {
                ps.oy += ps.vy; // float
                ctx.fillStyle = '#ffddff'; ctx.fillRect(baseX + ps.ox, baseY + ps.oy, 6, 6);
            }
            // feet remain visible (vulnerable)
            ctx.fillStyle = '#3b2d20'; ctx.fillRect(baseX + 6, baseY + player.h - 8, 8, 6);
            ctx.fillRect(baseX + player.w - 14, baseY + player.h - 8, 8, 6);
        }
        if (player.flyMode === 'luffy_stretch') {
            // draw a stretched arm line forward/up showing grab effect briefly
            const cx = Math.round(player.x + player.w / 2 - camX);
            const cy = Math.round(player.y + 12);
            ctx.strokeStyle = 'rgba(200,120,40,0.9)'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(cx, cy);
            const reach = 140;
            const tx = cx + player.facing * reach; const ty = cy - 40;
            ctx.lineTo(tx, ty); ctx.stroke();
        }
    }

    // draw boat at the end of Egghead
    const boatX = Math.round(eggEnd - 60 - camX);
    const boatY = platforms[0].y - 18;
    // simple boat hull
    ctx.fillStyle = '#5b3a2b'; ctx.fillRect(boatX, boatY, 80, 18);
    ctx.fillStyle = '#8b5d3b'; ctx.fillRect(boatX + 8, boatY - 6, 64, 6);
    // small flag/mast
    ctx.fillStyle = '#222'; ctx.fillRect(boatX + 12, boatY - 20, 2, 14);
    ctx.fillStyle = '#d22'; ctx.fillRect(boatX + 14, boatY - 20, 12, 6);

    // Player (8-bit sprite) - draw at world coords relative to camera
    player.animT += 0.12;
    // walking speed used for leg animation
    player.walkSpeed = Math.abs(player.vx);
    ctx.save(); ctx.translate(-camX, 0);
    // draw Boa's snake first so the player stands on its head
    if (boaSnake) {
        const bx = Math.round(boaSnake.x);
        const by = Math.round(boaSnake.y);
        const segW = boaSnake.segW || 14;
        const segs = boaSnake.segs || 10;
        for (let s = 0; s < segs; s++) {
            const sx = boaSnake.dir === 1 ? bx - s * segW : bx + s * segW;
            ctx.fillStyle = (s % 2) ? boaSnake.color1 : boaSnake.color2;
            ctx.fillRect(Math.round(sx), Math.round(by), segW, boaSnake.h);
        }
        // head (slightly larger and with an eye)
        ctx.fillStyle = boaSnake.color1;
        const headX = boaSnake.dir === 1 ? bx - Math.floor(segW / 2) : bx - Math.floor(segW / 2);
        ctx.fillRect(Math.round(headX), Math.round(by - 2), segW + 6, boaSnake.h + 4);
        ctx.fillStyle = '#000';
        const eyeX = boaSnake.dir === 1 ? bx + 2 : bx - 6;
        ctx.fillRect(Math.round(eyeX), Math.round(by + 4), 2, 2);
    }
    // Bazooka animation sequence for Luffy (plays while gamePaused)
    if (player._bazookaAnim) {
        const a = player._bazookaAnim;
        a.t = (a.t || 0) + 1;
        function lerp(a0, a1, p) { return a0 + (a1 - a0) * p; }
        // player's center world coordinate
        const px = player.x + player.w / 2; const py = player.y + player.h / 2;
        // phase: stretch -> hold -> snap -> enemyFlight
        if (a.phase === 'stretch') {
            const p = Math.min(1, a.t / a.durStretch);
            a.armX = lerp(px, a.armBackX, p);
            // draw stretched arm (grow if Gear 3 active)
            ctx.fillStyle = '#f1c27d';
            const x0 = Math.min(px, a.armX);
            let w = Math.abs(a.armX - px) || 4;
            const thickness = player._gear3 ? player.h * 3 : 6;
            if (player._gear3) { w = Math.max(w, player.w * 3); }
            const drawY = Math.round(py - thickness / 2);
            ctx.fillRect(Math.round(x0), drawY, Math.round(w), Math.round(thickness));
            if (p >= 1) { a.phase = 'hold'; a.t = 0; }
        } else if (a.phase === 'hold') {
            // keep arm extended briefly (respect Gear 3 size)
            const x0 = Math.min(px, a.armBackX);
            let w = Math.abs(a.armBackX - px) || 4;
            const thickness = player._gear3 ? player.h * 3 : 6;
            if (player._gear3) { w = Math.max(w, player.w * 3); }
            const drawY = Math.round(py - thickness / 2);
            ctx.fillStyle = '#f1c27d'; ctx.fillRect(Math.round(x0), drawY, Math.round(w), Math.round(thickness));
            if (a.t > a.durHold) { a.phase = 'snap'; a.t = 0; }
        } else if (a.phase === 'snap') {
            const p = Math.min(1, a.t / a.durSnap);
            a.armX = lerp(a.armBackX, a.snapTo, p);
            const x0 = Math.min(px, a.armX);
            let w = Math.abs(a.armX - px) || 4;
            const thickness = player._gear3 ? player.h * 3 : 6;
            if (player._gear3) { w = Math.max(w, player.w * 3); }
            const drawY = Math.round(py - thickness / 2);
            ctx.fillStyle = '#f1c27d'; ctx.fillRect(Math.round(x0), drawY, Math.round(w), Math.round(thickness));
            // animate all targets through the snap
            for (let ti = 0; ti < (a.targets || []).length; ti++) {
                const idx = a.targets[ti]; const st = a.targetsState[ti];
                const e = enemies[idx];
                if (!e) continue;
                if (!st.started && p > 0.35) { st.started = true; st.t = 0; }
                if (st.started) {
                    st.t++;
                    const ep = Math.min(1, st.t / a.durEnemyFly);
                    const targetX = st.targetX;
                    e.x = lerp(st.origX, targetX, ep);
                    const peak = Math.max(80, Math.abs(targetX - st.origX) * 0.08);
                    e.y = st.origY + Math.sin(ep * Math.PI) * -peak;
                    if (ep >= 1) { e.alive = false; e.removedTimer = 30; }
                }
            }
            if (p >= 1) { a.phase = 'enemyFlight'; a.t = 0; }
        } else if (a.phase === 'enemyFlight') {
            // ensure all enemies complete flight (redundant safety)
            for (let ti = 0; ti < (a.targets || []).length; ti++) {
                const idx = a.targets[ti]; const e = enemies[idx]; if (e) { e.alive = false; e.removedTimer = 30; }
            }
            // animation complete: cleanup and unpause
            delete player._bazookaAnim; player._bazookaAnim = null; player._chooseHeavy = false; player.attacking = false; gamePaused = false;
        }
    }

    // For Kizaru in light-flight, render him as a yellow ball only (player sprite hidden)
    if (!(player.charId === 'kizaru' && player.flyMode === 'kizaru_light')) {
        drawPlayer(ctx, player);
    }
    // draw spin attack visual if active
    if (player.attacking && player.attackType === 'spin' && player.attackRadius) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        const cx = player.x + player.w / 2; const cy = player.y + player.h / 2;
        const R = player.attackRadius;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2); ctx.stroke();
    }
    // Kizaru heavy-beam visual (covers the whole map while firing)
    if (player.attacking && player.charId === 'kizaru' && player.attackType === 'heavy') {
        const tot = 18; const t = (tot - Math.max(0, player.attackFrame)) / tot;
        if (t > 0.45) {
            const bx = 0;
            const beamW = WORLD_W;
            ctx.fillStyle = 'rgba(255,230,120,0.22)';
            ctx.fillRect(bx - camX, player.y + 6, beamW, player.h - 8);
            ctx.strokeStyle = 'rgba(255,215,0,0.95)'; ctx.lineWidth = 2; ctx.strokeRect(bx - camX, player.y + 6, beamW, player.h - 8);
            // small shimmer lines to emphasize reach
            ctx.strokeStyle = 'rgba(255,240,160,0.45)'; ctx.lineWidth = 1;
            for (let sx = bx; sx < bx + beamW; sx += 160) {
                ctx.beginPath(); ctx.moveTo(sx - camX, player.y + 6); ctx.lineTo(sx + 30 - camX, player.y + player.h - 8); ctx.stroke();
            }
        }
    }
    ctx.restore();

    // Player HP bar
    ctx.fillStyle = '#222'; ctx.fillRect(14, 12, 220, 14);
    ctx.fillStyle = '#e33'; ctx.fillRect(16, 14, (player.hp / player.maxHp) * 216, 10);
    ctx.strokeStyle = '#000'; ctx.strokeRect(14, 12, 220, 14);

    // Luffy heavy-choice overlay
    if (player._chooseHeavy) {
        const ox = W / 2 - 160, oy = H / 2 - 60;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(ox, oy, 320, 120);
        ctx.fillStyle = '#000'; ctx.font = '16px sans-serif'; ctx.fillText('Choose Heavy Attack for Luffy', ox + 12, oy + 28);
        ctx.fillStyle = '#ffd'; ctx.fillRect(ox + 12, oy + 40, 140, 48);
        ctx.fillStyle = '#000'; ctx.fillText('1: Gum Gum Bazooka', ox + 18, oy + 68);
        ctx.fillStyle = '#ffd'; ctx.fillRect(ox + 164, oy + 40, 100, 48);
        ctx.fillStyle = '#000'; ctx.fillText('2: Gear 2', ox + 170, oy + 68);
        ctx.fillStyle = '#ffd'; ctx.fillRect(ox + 268, oy + 40, 100, 48);
        ctx.fillStyle = '#000'; ctx.fillText('3: Gear 3', ox + 274, oy + 68);
    }

    // If player dead — require restart
    if (player.hp <= 0) {
        gamePaused = true; needRestart = true;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = '36px sans-serif'; ctx.fillText('You are defeated', W / 2 - 140, H / 2 - 40);
        ctx.font = '18px sans-serif'; ctx.fillText('Press R to return to title and restart', W / 2 - 200, H / 2 - 10);
    }

    // If player boarded the boat, show a short victory/transition message
    if (boarded) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = '30px sans-serif'; ctx.fillText('You boarded the boat!', W / 2 - 140, H / 2 - 20);
        ctx.font = '14px sans-serif'; ctx.fillText('Thanks for playing this slice — restart to play again.', W / 2 - 200, H / 2 + 10);
    }
}

function drawCharacterSelect(ctx) {
    const choices = Object.keys(characters);
    const w = 220, h = 60;
    for (let i = 0; i < choices.length; i++) {
        const x = W / 2 - (choices.length * (w + 12)) / 2 + i * (w + 12);
        const y = H / 2 + 10;
        ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.fillText(characters[choices[i]].name, x + 12, y + 28);
        ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x + 8, y + 34, w - 16, 12);
    }
    ctx.fillStyle = '#ccc'; ctx.font = '12px sans-serif'; ctx.fillText('Click a portrait or press 1-4', W / 2 - 90, H / 2 + 90);
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();

// Basic spawn wave to keep action going
setInterval(() => {
    if (gamePaused) return;
    const attempts = player && player._gear2 ? 10 : 1;
    for (let a = 0; a < attempts; a++) {
        if (Math.random() < 0.7) {
            const sx = 80 + Math.random() * (WORLD_W - 240);
            const sy = 200 + Math.random() * 260;
            spawnEnemy(sx, sy);
        }
    }
}, 3000);

// Simple help for touch devices: clicks make attacks
canvas.addEventListener('pointerdown', (ev) => {
    // quick tap = attack when alive
    if (!gamePaused && player.hp > 0) { keys['k'] = true; setTimeout(() => keys['k'] = false, 80); return }
    // if paused (dead) or title, process selection by click
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left; const my = ev.clientY - rect.top;
    if (!gameStarted) {
        const choices = ['luffy', 'kizaru', 'buggy', 'boa'];
        const w = 240, h = 72;
        const startX = W / 2 - (choices.length * (w + 14)) / 2;
        const y = H / 2 - 10;
        for (let i = 0; i < choices.length; i++) {
            const x = startX + i * (w + 14);
            if (mx >= x && mx <= x + w && my >= y && my <= y + h) { applyCharacter(choices[i]); gameStarted = true; gamePaused = false; return }
        }
        return;
    }
    // revive selection (disabled when a restart is required)
    if (needRestart) return;
    const choices = Object.keys(characters);
    const w = 220, h = 60;
    const startX = W / 2 - (choices.length * (w + 12)) / 2;
    const y = H / 2 + 10;
    for (let i = 0; i < choices.length; i++) {
        const x = startX + i * (w + 12);
        if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
            applyCharacter(choices[i]); gamePaused = false; break;
        }
    }
});

// keyboard quick-select when dead (1..4)
document.addEventListener('keydown', e => {
    // if on title screen, allow 1-3 to pick starting character
    if (player._chooseHeavy) return; // ignore global quick-select while in Luffy's choice menu
    if (!gameStarted && gamePaused) {
        const map0 = { '1': 'luffy', '2': 'kizaru', '3': 'buggy', '4': 'boa' };
        const id0 = map0[e.key];
        if (id0) { applyCharacter(id0); gameStarted = true; gamePaused = false; return }
    }

    // If restart required after death, allow pressing 'r' to go back to the title/start
    if (needRestart && e.key.toLowerCase() === 'r') {
        // reset state to title
        gameStarted = false; gamePaused = true; needRestart = false;
        applyCharacter('luffy'); player.x = 80; player.y = 360; player.vx = 0; player.vy = 0; player.hp = player.maxHp;
        enemies = []; hands = []; score = 0; camX = 0; boatSequence = false; boarded = false; fireTick = 0;
        buildLevel();
        return;
    }

    if (!gamePaused) return;
    if (needRestart) return; // block quick-revive while restart is required
    const map = { '1': 'luffy', '2': 'kizaru', '3': 'buggy', '4': 'boa' };
    const id = map[e.key];
    if (id) { applyCharacter(id); gamePaused = false }
});
