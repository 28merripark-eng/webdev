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
    attacking: false, attackFrame: 0, attackCooldown: 0,
    animT: 0
};

// Level platforms
const platforms = [
    { x: 0, y: 460, w: 960, h: 80 },
    { x: 220, y: 380, w: 160, h: 16 },
    { x: 420, y: 300, w: 150, h: 16 },
    { x: 620, y: 360, w: 120, h: 16 },
    { x: 820, y: 280, w: 120, h: 16 }
];

// Enemies
let enemies = [];
function spawnEnemy(x, y) {
    enemies.push({ x, y, w: 36, h: 44, vx: 1.2, patrol: [x - 80, x + 80], hp: 30, alive: true });
}
spawnEnemy(520, 256);
spawnEnemy(700, 320);
spawnEnemy(880, 236);

let score = 0;

function update() {
    // Input
    let left = keys['arrowleft'] || keys['a'];
    let right = keys['arrowright'] || keys['d'];
    let up = keys['arrowup'] || keys['w'];
    let attackKey = keys['k'];

    if (left) { player.vx = -player.speed; player.facing = -1 } else if (right) { player.vx = player.speed; player.facing = 1 } else { player.vx = 0 }

    if (up && player.onGround) { player.vy = -player.jump; player.onGround = false }

    // Attack handling
    if (attackKey && player.attackCooldown <= 0 && !player.attacking) { player.attacking = true; player.attackFrame = 8; player.attackCooldown = 24 }
    if (player.attacking) { player.attackFrame--; if (player.attackFrame <= 0) player.attacking = false }
    if (player.attackCooldown > 0) player.attackCooldown--

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

    // Keep in bounds
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > W) player.x = W - player.w;
    if (player.y > H) { player.hp = 0 }

    // Enemies update
    for (let e of enemies) {
        if (!e.alive) continue;
        e.x += e.vx;
        if (e.x < e.patrol[0] || e.x > e.patrol[1]) e.vx *= -1;

        // Simple collision with player
        if (rectsOverlap(player, e)) {
            // If player attacking and attack hitbox overlaps enemy
            if (player.attacking) {
                // create attack hitbox
                const hx = player.facing === 1 ? player.x + player.w : player.x - 32;
                const hb = { x: hx, y: player.y + 8, w: 32, h: player.h - 16 };
                if (rectsOverlap(hb, e)) {
                    e.hp -= 20; e.x += player.facing * 6; // knockback
                    if (e.hp <= 0) { e.alive = false; score += 100 }
                }
            } else {
                // player takes damage
                if (!player._inv) { player.hp -= 8; player._inv = 40 }
            }
        }
    }

    if (player._inv > 0) player._inv--;

    // Remove dead enemies periodically
    enemies = enemies.filter(e => e.alive || Math.random() < 0.01);

    // Update UI
    document.getElementById('hp').textContent = Math.max(0, Math.round(player.hp));
    document.getElementById('pts').textContent = score;
}

// Draw an 8-bit style character and arm-stretch animation
function drawPlayer(ctx, p) {
    ctx.save();
    // center the sprite on player position
    ctx.translate(Math.round(p.x + p.w / 2), Math.round(p.y + p.h / 2));
    if (p.facing < 0) ctx.scale(-1, 1);

    const S = 2; // pixel scale
    const w = p.w, h = p.h;

    // helper to draw pixel rects relative to center
    function r(x, y, wpx, hpx, color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x * S), Math.round(y * S), Math.round(wpx * S), Math.round(hpx * S));
    }

    // offsets: draw relative so top-left of sprite area is at (-w/2, -h/2)
    const ox = -Math.round(w / 2 / S);
    const oy = -Math.round(h / 2 / S);

    // Slight leg bob when running
    const legBob = Math.abs(Math.sin(p.animT * 6)) * 1.5;

    // Colors
    const skin = '#f1c27d';
    const straw = '#f4d542';
    const band = '#b11';
    const shirt = '#d43';
    const pants = '#102a1a';

    // Head (10x10 pixels)
    r(ox + 6, oy + 2, 10, 10, skin);
    // Hat brim and top
    r(ox + 4, oy - 4, 14, 4, straw);
    r(ox + 6, oy - 8, 10, 6, straw);
    r(ox + 6, oy - 2, 10, 2, band);

    // Torso
    r(ox + 4, oy + 12, 16, 12, shirt);
    // Pants
    r(ox + 6, oy + 26, 12, 8, pants);

    // Legs (animated)
    r(ox + 6, oy + 34 + legBob, 5, 8, pants);
    r(ox + 15, oy + 34 - legBob, 5, 8, pants);

    // Right shoulder position (relative)
    const sx = ox + 20; const sy = oy + 16;

    // Arm stretch: when attacking extend forearm outward
    let baseArmLen = 6;
    let ext = 0;
    if (p.attacking) {
        // animate extension based on attackFrame (0..8)
        const t = (8 - Math.max(0, p.attackFrame)) / 8; // 0->1
        ext = Math.round(t * 18) + 2;
    }

    // Upper arm
    r(sx - 2, sy + 2, 6 + ext, 4, skin);
    // Hand
    r(sx + 4 + ext, sy + 2, 4, 4, skin);

    ctx.restore();
}

function draw() {
    // Background
    ctx.clearRect(0, 0, W, H);
    // sky gradient handled by CSS; draw some distant islands
    ctx.fillStyle = '#c6f0ff';
    // Ground tiles
    for (let p of platforms) {
        ctx.fillStyle = '#6b4f2b';
        ctx.fillRect(p.x, p.y, p.w, p.h);
        // top edge
        ctx.fillStyle = '#8b5d3b';
        ctx.fillRect(p.x, p.y - 6, p.w, 6);
    }

    // Enemies
    for (let e of enemies) {
        if (!e.alive) continue;
        ctx.fillStyle = '#a22';
        ctx.fillRect(e.x, e.y, e.w, e.h);
        // HP bar
        ctx.fillStyle = '#000'; ctx.fillRect(e.x, e.y - 8, e.w, 4);
        ctx.fillStyle = '#0f0'; ctx.fillRect(e.x, e.y - 8, e.w * Math.max(0, e.hp / 30), 4);
    }

    // Player (8-bit sprite)
    player.animT += 0.12;
    drawPlayer(ctx, player);

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
setInterval(() => { if (Math.random() < 0.7) spawnEnemy(40 + Math.random() * 880, 0 + Math.random() * 40 + 220) }, 3000);

// Simple help for touch devices: clicks make attacks
canvas.addEventListener('pointerdown', () => { keys['k'] = true; setTimeout(() => keys['k'] = false, 80) });
