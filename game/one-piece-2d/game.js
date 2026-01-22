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
    animT: 0, walkSpeed: 0
};

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
    enemies.push({ x, y, w: 36, h: 44, vx: 1.2, patrol: [x - 80, x + 80], hp: 30, alive: true });
}
spawnEnemy(520, 256);
spawnEnemy(700, 320);
spawnEnemy(880, 236);

let score = 0;
let camX = 0;

function update() {
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

    // Physics
    player.vy += gravity * 0.6;
    player.x += player.vx;
    player.y += player.vy;

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

    // Enemies update
    for (let e of enemies) {
        if (!e.alive) continue;
        e.x += e.vx;
        if (e.x < e.patrol[0] || e.x > e.patrol[1]) e.vx *= -1;

        // Attack hit detection (allow hits even if not touching player)
        if (player.attacking && player.attackType) {
            if (player.attackType === 'spin') {
                const R = player.attackRadius || 0;
                const hb = { x: player.x - R, y: player.y - R, w: player.w + R * 2, h: player.h + R * 2 };
                if (rectsOverlap(hb, e)) {
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
                    const dmg = player.attackType === 'heavy' ? 40 : 20;
                    e.hp -= dmg; e.x += player.facing * 10;
                    if (e.hp <= 0) { e.alive = false; score += (player.attackType === 'heavy' ? 180 : 100) }
                    continue;
                }
            }
        }

        // Simple collision with player (damage to player)
        if (rectsOverlap(player, e)) {
            if (!player._inv) { player.hp -= 8; player._inv = 40 }
        }
    }

    if (player._inv > 0) player._inv--;

    // Remove dead enemies periodically
    enemies = enemies.filter(e => e.alive || Math.random() < 0.01);

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
    if (p.facing < 0) {
        ctx.scale(-1, 1);
        // when mirrored, translate so drawing still uses positive coordinates
        ctx.translate(-(pxw * S), 0);
    }

    const S = 2; // pixel scale: sprite grid is 16x28 -> 32x56
    const pxw = 16, pxh = 28;

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
        if (!e.alive) continue;
        ctx.fillStyle = '#a22';
        ctx.fillRect(e.x - camX, e.y, e.w, e.h);
        // HP bar
        ctx.fillStyle = '#000'; ctx.fillRect(e.x - camX, e.y - 8, e.w, 4);
        ctx.fillStyle = '#0f0'; ctx.fillRect(e.x - camX, e.y - 8, e.w * Math.max(0, e.hp / 30), 4);
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
    ctx.restore();

    // Player HP bar
    ctx.fillStyle = '#222'; ctx.fillRect(14, 12, 220, 14);
    ctx.fillStyle = '#e33'; ctx.fillRect(16, 14, (player.hp / player.maxHp) * 216, 10);
    ctx.strokeStyle = '#000'; ctx.strokeRect(14, 12, 220, 14);

    // If player dead
    if (player.hp <= 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = '44px sans-serif'; ctx.fillText('You are defeated', W / 2 - 160, H / 2 - 10);
        ctx.font = '18px sans-serif'; ctx.fillText('Refresh page to try again', W / 2 - 110, H / 2 + 30);
    }
}

function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();

// Basic spawn wave to keep action going
setInterval(() => {
    if (Math.random() < 0.7) {
        const sx = 80 + Math.random() * (WORLD_W - 240);
        const sy = 200 + Math.random() * 260;
        spawnEnemy(sx, sy);
    }
}, 3000);

// Simple help for touch devices: clicks make attacks
canvas.addEventListener('pointerdown', () => { keys['k'] = true; setTimeout(() => keys['k'] = false, 80) });
