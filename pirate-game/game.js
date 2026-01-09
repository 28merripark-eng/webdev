// Pirate Quest - prototype engine implementing core mechanics
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const TILE = 32;

let keys = {};
window.addEventListener('keydown', e=>keys[e.key]=true);
window.addEventListener('keyup', e=>keys[e.key]=false);

function log(msg){ const el = document.getElementById('log'); const p = document.createElement('p'); p.textContent = msg; el.prepend(p); if(el.childNodes.length>100) el.removeChild(el.lastChild); }

// Player
const player = {
  x: 14*TILE, y: 9*TILE,
  w:28, h:28,
  speed: 2.4,
  hp: 100, maxHp:100,
  atk: 12,
  lvl:1, xp:0,
  haki:{observation:0, armament:0},
  fruit: {type:'None', name:null},
  fruitCooldown:0
};

// NPC/enemies
let enemies = [
  {x:8*TILE,y:8*TILE,w:28,h:28,hp:40,atk:6},
  {x:22*TILE,y:11*TILE,w:28,h:28,hp:60,atk:8}
];

// Simple map (0 empty, 1 water/impassable)
const MAP_W = 30, MAP_H = 20;
let map = new Array(MAP_H).fill(0).map(()=>new Array(MAP_W).fill(0));
for(let i=0;i<MAP_W;i++){ map[0][i]=1; map[MAP_H-1][i]=1; }
for(let r=0;r<MAP_H;r++){ map[r][0]=1; map[r][MAP_W-1]=1; }

// Devil Fruits system (framework)
const DevilFruits = {
  "Gum-Gum": {type:'Paramecia', desc:'Stretchy melee dash', cooldown:120, use(ctx){ // short dash attack
    playDash();
  }},
  "Flame": {type:'Logia', desc:'Fire projectile', cooldown:90, use(ctx){ spawnProjectile(ctx); }},
  "Beast": {type:'Zoan', desc:'Short berserk buff', cooldown:200, use(ctx){ player.atk += 10; setTimeout(()=>player.atk-=10,4000); log('Beast form boost'); }}
};
// Give player a starter fruit for demo
player.fruit.name = 'Gum-Gum'; player.fruit.type = 'Paramecia';

// Projectiles
let projectiles = [];
function spawnProjectile(ctx){ projectiles.push({x:player.x,y:player.y,vx: (ctx.dir||1)*6,vy:0,atk:18,life:80}); log('Used Flame projectile'); }
function playDash(){ // dash forward and damage collisions
  const dir = lastDir.x || 1;
  player.x += dir*80;
  // damage nearby enemies
  enemies.forEach(e=>{ if(dist(player,e)<80){ e.hp -= 30; log('Dash hit enemy'); }});
}

function dist(a,b){ const dx=(a.x||a.x)-(b.x||b.x); const dy=(a.y||a.y)-(b.y||b.y); return Math.hypot(dx,dy); }

// Input / movement
let lastDir = {x:1,y:0};
function updatePlayer(){
  let dx=0, dy=0;
  if(keys.ArrowUp||keys.w) dy=-1;
  if(keys.ArrowDown||keys.s) dy=1;
  if(keys.ArrowLeft||keys.a) dx=-1;
  if(keys.ArrowRight||keys.d) dx=1;
  if(dx||dy){ const len = Math.hypot(dx,dy); dx/=len; dy/=len; player.x += dx*player.speed; player.y += dy*player.speed; lastDir.x = Math.sign(dx)||lastDir.x; lastDir.y = Math.sign(dy)||lastDir.y; }
  // attack
  if(keys[' ']){ basicAttack(); }
  // use fruit
  if(keys.D || keys.d){ useFruit(); keys.D = false; keys.d=false; }
  // toggle haki
  if(keys.H || keys.h){ player.haki.armament = Math.min(3, player.haki.armament+1); keys.H=false; keys.h=false; log('Armament Haki increased'); }
  if(player.fruitCooldown>0) player.fruitCooldown--;
}

function basicAttack(){ enemies.forEach(e=>{ if(rectIntersect(player,e)){ const dmg = player.atk + player.haki.armament*2; e.hp -= dmg; log('Basic attack dealt '+dmg); } }); }
function useFruit(){ if(!player.fruit.name){ log('No fruit equipped'); return; } if(player.fruitCooldown>0){ log('Fruit cooldown'); return; } const def = DevilFruits[player.fruit.name]; if(def){ def.use({dir:lastDir.x}); player.fruitCooldown = def.cooldown; }}

function rectIntersect(a,b){ return !(a.x+a.w < b.x || a.x > b.x+b.w || a.y+a.h < b.y || a.y > b.y+b.h); }

// Enemy AI simple
function updateEnemies(){ enemies.forEach(e=>{ if(e.hp<=0) return; const dx = player.x - e.x; const dy = player.y - e.y; const d = Math.hypot(dx,dy); if(d>40){ e.x += (dx/d)*0.9; e.y += (dy/d)*0.9; } else { // attack
    if(Math.random()<0.02){ const dmg = e.atk - player.haki.armament; player.hp -= Math.max(1,dmg); log('Player hit for '+Math.max(1,dmg)); }
  } });
  // remove dead
  for(let i=enemies.length-1;i>=0;i--){ if(enemies[i].hp<=0){ log('Enemy defeated'); player.xp += 20; enemies.splice(i,1); }}
}

function updateProjectiles(){ projectiles.forEach(p=>{ p.x += p.vx; p.life--; enemies.forEach(e=>{ if(!e) return; if(p.x>e.x && p.x<e.x+e.w && Math.abs(p.y-e.y)<20){ e.hp -= p.atk; p.life = 0; log('Projectile hit'); } }); }); projectiles = projectiles.filter(p=>p.life>0); }

// UI
function drawUI(){ const s = document.getElementById('stats'); s.innerHTML = `HP: ${player.hp}/${player.maxHp}  ATK: ${player.atk}  LVL: ${player.lvl}  Fruit: ${player.fruit.name||'None'}  Haki(A/O): ${player.haki.armament}/${player.haki.observation}`; }

// Draw loop
function draw(){ ctx.clearRect(0,0,canvas.width,canvas.height);
  // simple map tiles
  for(let r=0;r<MAP_H;r++) for(let c=0;c<MAP_W;c++){ if(map[r][c]===1){ ctx.fillStyle='#1e90ff'; ctx.fillRect(c*TILE,r*TILE,TILE,TILE); } }
  // player
  ctx.fillStyle='#ffd27f'; ctx.fillRect(player.x,player.y,player.w,player.h);
  // enemies
  enemies.forEach(e=>{ ctx.fillStyle='#9b5b5b'; ctx.fillRect(e.x,e.y,e.w,e.h); });
  // projectiles
  ctx.fillStyle='orange'; projectiles.forEach(p=>ctx.fillRect(p.x,p.y,8,8));
}

function gameLoop(){ updatePlayer(); updateEnemies(); updateProjectiles(); draw(); drawUI(); requestAnimationFrame(gameLoop); }

gameLoop();

// Simple helper to spawn more content for demo
setInterval(()=>{ if(enemies.length<4) enemies.push({x:Math.random()*800,y:Math.random()*500,w:28,h:28,hp:30+Math.random()*40,atk:5+Math.floor(Math.random()*6)}); },5000);
