const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Simple world
const gravity = 0.9;
let keys = {};

document.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

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

// Draw title screen and selection before game starts
function drawTitleScreen(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd'; ctx.font = '36px sans-serif'; ctx.fillText('one piece pirate warriors 5', W / 2 - 260, H / 2 - 80);
    ctx.font = '16px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('Choose your character to begin', W / 2 - 120, H / 2 - 40);

    const choices = ['buggy', 'boa', 'kizaru'];
    const w = 240, h = 72;
    for (let i = 0; i < choices.length; i++) {
        const x = W / 2 - (choices.length * (w + 14)) / 2 + i * (w + 14);
        const y = H / 2 - 10;
        ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif'; ctx.fillText(characters[choices[i]].name, x + 18, y + 40);
        // hint
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 12, y + 46, w - 24, 10);
    }
    ctx.fillStyle = '#ccc'; ctx.font = '12px sans-serif'; ctx.fillText('Click a portrait or press 1-3', W / 2 - 90, H / 2 + 70);
}

// World and level platforms (multiple themed horizontal sections)
const WORLD_W = 6500;
const SECTION_W = 1000; // each themed area width
const themes = [
    { name: 'Louge Town', bg: '#dbeefc' },
    { name: 'Alabasta', bg: '#f6e1c4' },
    { name: 'Skypiea', bg: '#eaf7ff' },
    { name: 'Water7', bg: '#e6f7fb' },
    { name: 'Enies Lobby', bg: '#f1e9e6' },
    { name: 'Punk Hazard', bg: '#f3e9eef0' },
    { name: 'Egghead', bg: '#eef2ff' }
];

let platforms = [];
function buildLevel() {
    platforms = [];
    // ground across world
    platforms.push({ x: 0, y: 460, w: WORLD_W, h: 80 });

    // add themed platform clusters
    for (let i = 0; i < themes.length; i++) {
        const baseX = i * SECTION_W + 80;
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
    enemies.push({
        x, y, w: 36, h: 44, vx: 1.2, patrol: [x - 80, x + 80], hp: 30, alive: true, weapon,
        petrified: false, removedTimer: 0, grabbed: false, slamming: false, origY: y
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
    let attackKey = keys['k'];

    if (left) { player.vx = -player.speed; player.facing = -1 } else if (right) { player.vx = player.speed; player.facing = 1 } else { player.vx = 0 }

    if (up && player.onGround) { player.vy = -player.jump; player.onGround = false }

    // Attack handling: K = light, J = heavy stretch, L = spin
    let lightKey = keys['k'];
    let heavyKey = keys['j'];
    let spinKey = keys['l'];

    if (lightKey && player.attackCooldown <= 0 && !player.attacking) {
        player.attacking = true; player.attackType = 'light'; player.attackFrame = 8; player.attackCooldown = 22;
    }
    if (heavyKey && player.attackCooldown <= 0 && !player.attacking) {
        player.attacking = true; player.attackType = 'heavy'; player.attackFrame = 18; player.attackCooldown = 48;
    }
    if (spinKey && player.attackCooldown <= 0 && !player.attacking) {
        player.attacking = true; player.attackType = 'spin'; player.attackFrame = 20; player.attackCooldown = 80;
    }

    if (player.attacking) {
        player.attackFrame--; if (player.attackFrame <= 0) { player.attacking = false; player.attackType = null }
    }
    if (player.attackCooldown > 0) player.attackCooldown--

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

    // Physics
    player.vy += gravity * 0.6;
    player.x += player.vx;
    player.y += player.vy;

    // Update hands (Buggy's detachable hands)
    for(let i=hands.length-1;i>=0;i--){
        const h = hands[i];
        if(h.attached){
            // carry attached enemy upward until slam is triggered by reaching a certain height
            h.y += h.vy; h.vy -= 0.6; // upward deceleration (negative vy)
            const e = h.target;
            if(e){ e.x = h.x - 4; e.y = h.y - 12; }
            // when hand has lifted high enough, trigger slam
            if(h.y < player.y - 140){
                if(h.target){
                    h.target.grabbed = false; h.target.slamming = true; h.target.slamspeed = 18; h.target.origY = h.target.y;
                }
                h.returning = true; hands.splice(i,1); continue;
            }
            continue;
        }

        // flying hand
        h.x += h.vx; h.y += h.vy; h.vy += gravity*0.2;
        // collision with target enemy
        const t = h.target;
        if(t && !t.grabbed && !t.slamming && Math.abs(h.x - t.x) < 18 && Math.abs(h.y - t.y) < 18){
            h.attached = true; h.vx = 0; h.vy = -6; t.grabbed = true; t.grabbedBy = h; continue;
        }

        // remove if out of world bounds or returning
        if(h.x < -100 || h.x > WORLD_W+100 || h.returning) { hands.splice(i,1); }
    }

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
        // petrified corpses: countdown then expire
        if (e.petrified) {
            e.removedTimer = (e.removedTimer || 60) - 1;
            if (e.removedTimer <= 0) e.petrified = false;
            continue;
        }

        // If enemy is grabbed, attach to player until slam
        if (e.grabbed) {
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
                    if (player.charId === 'boa') { e.petrified = true; e.removedTimer = 40; e.alive = false; score += 260; continue; }
                    const dmg = 30;
                    e.hp -= dmg; e.x += (e.x < player.x ? -1 : 1) * 8;
                    if (e.hp <= 0) { e.alive = false; score += 120 }
                    continue;
                }
            } else {
                const ext = player.attackExt || 0;
                const hw = 32 + ext;
                const hx = player.facing === 1 ? player.x + player.w : player.x - hw;
                const hb = { x: hx, y: player.y + 8, w: hw, h: player.h - 16 };

                if (rectsOverlap(hb, e)) {
                    // Buggy: attempt to grab on heavy
                    if (player.charId === 'buggy' && player.attackType === 'heavy' && !e.grabbed && !e.slamming) {
                        // spawn a detachable hand that targets this enemy
                        hands.push({ x: player.x + (player.facing===1?player.w: -8), y: player.y+12, vx: player.facing*12, vy: -2, target: e, attached:false, returning:false });
                        continue;
                    }

                    // Boa: stone-kill
                    if (player.charId === 'boa') { e.petrified = true; e.removedTimer = 40; e.alive = false; score += 260; continue; }

                    // Kizaru: heavy becomes beam (long-range) - apply beam when attack progress sufficient
                    if (player.charId === 'kizaru' && player.attackType === 'heavy') {
                        const beamLen = Math.max(120, player.attackExt || 160);
                        const bx = player.facing === 1 ? player.x + player.w : player.x - beamLen;
                        const beam = { x: bx, y: player.y + 6, w: beamLen, h: player.h - 8 };
                        if (rectsOverlap(beam, e)) {
                            const dmg = 60; e.hp -= dmg; e.x += player.facing * 12; if (e.hp <= 0) { e.alive = false; score += 300 };
                            continue;
                        }
                    }

                    // default damage (respect immunities)
                    const dmg = player.attackType === 'heavy' ? 40 : 20;
                    let effective = dmg;
                    if (e.weapon === 'gun' && player.gunImmune) effective = 0;
                    if (e.weapon === 'sword' && player.swordImmune) effective = 0;
                    e.hp -= effective; e.x += player.facing * 10;
                    if (e.hp <= 0) { e.alive = false; score += (player.attackType === 'heavy' ? 180 : 100) }
                    continue;
                }
            }
        }

        // Simple collision with player (damage to player)
        if (rectsOverlap(player, e)) {
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

    // Update UI
    document.getElementById('hp').textContent = Math.max(0, Math.round(player.hp));
    document.getElementById('pts').textContent = score;
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
    const skin = '#f1c27d';
    const straw = '#f4d542';
    const band = '#b11';
    const shirt = '#d43';
    const pants = '#1b4a7a';
    const shoe = '#321b0f';

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
    // Hand
    r(ax + 2 + ext, ay, 3, 3, skin);

    ctx.restore();
}

function draw() {
    // Background
    ctx.clearRect(0, 0, W, H);
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
    // Draw themed background sections
    for (let i = 0; i < themes.length; i++) {
        const x = i * SECTION_W;
        ctx.fillStyle = themes[i].bg;
        ctx.fillRect(x - camX, 0, SECTION_W, H);
        // theme label
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = '16px sans-serif';
        ctx.fillText(themes[i].name, x - camX + 12, 36);
        // small decorative skyline/land for each theme
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        for (let s = 0; s < 6; s++) ctx.fillRect(x - camX + 40 + s * 140, 120 + (i % 3) * 6, 80, 24 + (s % 2) * 8);
    }

    // Ground tiles / platforms
    for (let p of platforms) {
        ctx.fillStyle = '#6b4f2b';
        ctx.fillRect(p.x - camX, p.y, p.w, p.h);
        // top edge
        ctx.fillStyle = '#8b5d3b';
        ctx.fillRect(p.x - camX, p.y - 6, p.w, 6);
    }

    // Enemies (world coords -> draw relative to camera)
    for (let e of enemies) {
        if (!(e.alive || e.petrified || e.grabbed || e.slamming)) continue;
        // visual states
        if (e.petrified) ctx.fillStyle = '#999';
        else if (e.grabbed) ctx.fillStyle = '#a0a';
        else if (e.slamming) ctx.fillStyle = '#600';
        else ctx.fillStyle = '#a22';

        ctx.fillRect(e.x - camX, e.y, e.w, e.h);
        // HP bar (only for alive enemies)
        if (e.alive) {
            ctx.fillStyle = '#000'; ctx.fillRect(e.x - camX, e.y - 8, e.w, 4);
            ctx.fillStyle = '#0f0'; ctx.fillRect(e.x - camX, e.y - 8, e.w * Math.max(0, e.hp / 30), 4);
        } else if (e.petrified) {
            // small stone crack mark
            ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(e.x - camX + 6, e.y + 6, 4, 4);
        }
    }

    // draw Buggy hands
    for(const h of hands){
        ctx.fillStyle = '#f9c'; ctx.fillRect(h.x - camX, h.y, 8, 8);
        if(h.attached){ ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.fillRect(h.x - camX -2, h.y+8, 12, 3) }
    }

    // Player (8-bit sprite) - draw at world coords relative to camera
    player.animT += 0.12;
    // walking speed used for leg animation
    player.walkSpeed = Math.abs(player.vx);
    ctx.save(); ctx.translate(-camX, 0);
    drawPlayer(ctx, player);
    // draw spin attack visual if active
    if (player.attacking && player.attackType === 'spin' && player.attackRadius) {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        const cx = player.x + player.w / 2; const cy = player.y + player.h / 2;
        const R = player.attackRadius;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2); ctx.stroke();
    }
    // Kizaru beam visual for heavy attack
    if (player.attacking && player.charId === 'kizaru' && player.attackType === 'heavy') {
        const tot = 18; const t = (tot - Math.max(0, player.attackFrame)) / tot;
        if (t > 0.45) {
            const beamLen = Math.max(120, player.attackExt || 200);
            const bx = player.facing === 1 ? player.x + player.w : player.x - beamLen;
            ctx.fillStyle = 'rgba(255,240,200,0.18)';
            ctx.fillRect(bx - camX, player.y + 6, beamLen, player.h - 8);
            ctx.strokeStyle = 'rgba(255,240,200,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(bx - camX, player.y + 6, beamLen, player.h - 8);
        }
    }
    ctx.restore();

    // Player HP bar
    ctx.fillStyle = '#222'; ctx.fillRect(14, 12, 220, 14);
    ctx.fillStyle = '#e33'; ctx.fillRect(16, 14, (player.hp / player.maxHp) * 216, 10);
    ctx.strokeStyle = '#000'; ctx.strokeRect(14, 12, 220, 14);

    // If player dead
    if (player.hp <= 0) {
        gamePaused = true;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = '36px sans-serif'; ctx.fillText('You are defeated', W / 2 - 140, H / 2 - 40);
        ctx.font = '18px sans-serif'; ctx.fillText('Choose a character to revive as:', W / 2 - 150, H / 2 - 10);
        drawCharacterSelect(ctx);
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
    if (Math.random() < 0.7) {
        if (gamePaused) return;
        const sx = 80 + Math.random() * (WORLD_W - 240);
        const sy = 200 + Math.random() * 260;
        spawnEnemy(sx, sy);
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
        const choices = ['buggy', 'boa', 'kizaru'];
        const w = 240, h = 72;
        const startX = W / 2 - (choices.length * (w + 14)) / 2;
        const y = H / 2 - 10;
        for (let i = 0; i < choices.length; i++) {
            const x = startX + i * (w + 14);
            if (mx >= x && mx <= x + w && my >= y && my <= y + h) { applyCharacter(choices[i]); gameStarted = true; gamePaused = false; return }
        }
        return;
    }
    // revive selection
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
    if (!gameStarted && gamePaused) {
        const map0 = { '1': 'buggy', '2': 'boa', '3': 'kizaru' };
        const id0 = map0[e.key];
        if (id0) { applyCharacter(id0); gameStarted = true; gamePaused = false; return }
    }

    if (!gamePaused) return;
    const map = { '1': 'luffy', '2': 'kizaru', '3': 'buggy', '4': 'boa' };
    const id = map[e.key];
    if (id) { applyCharacter(id); gamePaused = false }
});
