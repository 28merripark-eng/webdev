// One Piece Clicker - simple idle/clicker game
const berriesEl = document.getElementById('berries');
const perClickEl = document.getElementById('perClick');
const cpsEl = document.getElementById('cps');
const clickBtn = document.getElementById('clickBtn');
const shopList = document.getElementById('shopList');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');
const resetBtn = document.getElementById('resetBtn');

let state = {
    berries: 0,
    perClick: 1,
    cps: 0,
    items: []
};
// track how many bandits defeated
state.banditsDefeated = 0;
// damage upgrade level
state.upgradeDamageLevel = 0;

// Enemy battle state
state.enemy = null; // will be { level, hp, maxHp, reward, name }

function spawnEnemy(level = 1) {
    const baseHp = 20;
    const hp = Math.round(baseHp * Math.pow(1.28, level - 1));
    const reward = Math.round(5 * Math.pow(1.5, level - 1));
    // choose a bandit variant sprite based on level
    const variant = ((level - 1) % 3) + 1; // 1..3
    const name = level === 1 ? 'Bandit' : `Bandit Lv.${level}`;
    state.enemy = { level, hp, maxHp: hp, reward, name, variant };
    // set sprite src
    if (enemySprite) enemySprite.src = `images/bandit${variant}.svg`;
    updateEnemyUI();
}

// NOTE: don't start the first enemy here — DOM elements used by updateEnemyUI
// are initialized later. Initial spawn happens after DOM lookups below.

// Player state
state.player = { hp: 100, maxHp: 100, inv: 0 };

// Enemy attack behavior: every second enemy may attack player when alive
let enemyAttackTimer = 0;

const shopDefs = [
    { id: 'luffy', name: 'Recruit Luffy', cost: 50, cps: 1, description: 'Gum-Gum enthusiasm (+1 cps)' },
    { id: 'zoro', name: 'Recruit Zoro', cost: 250, cps: 6, description: 'Swords + steady damage (+6 cps)' },
    { id: 'nami', name: 'Recruit Nami', cost: 1200, cps: 30, description: 'Weather control (+30 cps)' },
    { id: 'ship', name: 'Thousand Sunny Upgrade', cost: 8000, cps: 120, description: 'Faster sailing (+120 cps)' }
];

function format(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return Math.floor(n).toString();
}

function renderShop() {
    shopList.innerHTML = '';
    for (const def of shopDefs) {
        const owned = state.items.filter(i => i === def.id).length;
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.innerHTML = `<div>
      <strong>${def.name}</strong>
      <div style="font-size:12px;color:#666">${def.description}</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:600">Cost: <span data-cost>${format(def.cost)}</span></div>
      <div style="font-size:12px;color:#666">Owned: ${owned}</div>
      <button data-id="${def.id}">Buy</button>
    </div>`;
        shopList.appendChild(el);
    }
}

function updateUI() {
    berriesEl.textContent = format(state.berries);
    perClickEl.textContent = format(state.perClick);
    cpsEl.textContent = format(state.cps);
    updateEnemyUI();
    // upgrade UI
    try {
        const cost = getUpgradeCost(state.upgradeDamageLevel || 0);
        if (upgradeCostEl) upgradeCostEl.textContent = format(cost);
        if (upgradeLevelEl) upgradeLevelEl.textContent = String(state.upgradeDamageLevel || 0);
    } catch (e) { }
}

function getUpgradeCost(level) {
    return Math.round(20 * Math.pow(2, level));
}

// Enemy UI helpers
const enemyNameEl = document.getElementById('enemyName');
const enemyLevelEl = document.getElementById('enemyLevel');
const enemyHpFill = document.getElementById('enemyHpFill');
const enemyHpText = document.getElementById('enemyHpText');
const defeatedEl = document.getElementById('defeated');
const enemySprite = document.getElementById('enemySprite');
const playerSprite = document.getElementById('playerSprite');
const playerHpFill = document.getElementById('playerHpFill');
const playerHpText = document.getElementById('playerHpText');
const bazookaBtn = document.getElementById('bazookaBtn');
const bazookaCooldownEl = document.getElementById('bazookaCooldown');
const gatlingBtn = document.getElementById('gatlingBtn');
const gatlingCooldownEl = document.getElementById('gatlingCooldown');
const redhawkBtn = document.getElementById('redhawkBtn');
const redhawkCooldownEl = document.getElementById('redhawkCooldown');
const upgradeBtn = document.getElementById('upgradeDamageBtn');
const upgradeCostEl = document.getElementById('upgradeCost');
const upgradeLevelEl = document.getElementById('upgradeLevel');
const consoleEl = document.getElementById('gameConsole');
// Ensure enemy bandit sprite shows up
if (enemySprite) {
    enemySprite.src = 'images/bandit.svg';
}

// Player sprite: try several likely One-Piece images from the workspace then fallback to svg
if (playerSprite) {
    // preference order: local packaged SVG first (guaranteed), then other fallbacks
    const candidates = [
        'images/luffy.svg',
        'luffy.png',
        '../one-piece-2d/images/16bitluffy.jpg',
        '../one-piece-2d/images/Screenshot 2026-01-30 100317.png',
        '../resume/images/luffy.jpg'
    ];
    let idx = 0;
    function tryNext() {
        if (idx >= candidates.length) return;
        const p = candidates[idx++];
        playerSprite.src = p;
    }
    playerSprite.onerror = () => { tryNext(); };
    tryNext();
}
function updateEnemyUI() {
    if (!state.enemy) {
        enemyNameEl.textContent = '';
        enemyLevelEl.textContent = '';
        enemyHpFill.style.width = '0%';
        enemyHpText.textContent = '';
    } else {
        enemyNameEl.textContent = state.enemy.name;
        enemyLevelEl.textContent = `Lv. ${state.enemy.level}`;
        const pct = Math.max(0, (state.enemy.hp / state.enemy.maxHp) * 100);
        enemyHpFill.style.width = pct + '%';
        enemyHpText.textContent = `HP: ${Math.max(0, state.enemy.hp)} / ${state.enemy.maxHp}`;
    }
    if (defeatedEl) defeatedEl.textContent = String(state.banditsDefeated || 0);
    // update player HP display
    if (playerHpFill) {
        const pPct = Math.max(0, (state.player.hp / state.player.maxHp) * 100);
        playerHpFill.style.width = pPct + '%';
    }
    if (playerHpText) playerHpText.textContent = `HP: ${Math.max(0, state.player.hp)} / ${state.player.maxHp}`;
    // cooldown UI for special attacks
    if (bazookaBtn) bazookaBtn.disabled = !!bazookaBtn.dataset.cooldown;
    if (gatlingBtn) gatlingBtn.disabled = !!gatlingBtn.dataset.cooldown;
    if (redhawkBtn) redhawkBtn.disabled = !!redhawkBtn.dataset.cooldown;
}

function addConsoleMessage(text) {
    try {
        if (!consoleEl) return;
        const line = document.createElement('div');
        line.className = 'line';
        line.textContent = text;
        consoleEl.appendChild(line);
        // limit to last 8 messages
        while (consoleEl.children.length > 8) consoleEl.removeChild(consoleEl.firstChild);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    } catch (e) { /* ignore */ }
}

clickBtn.addEventListener('click', () => {
    // If an enemy exists, attack it instead of just collecting
    if (state.enemy) {
        const beforeHp = state.enemy.hp;
        state.enemy.hp -= state.perClick;
        const dmg = Math.min(beforeHp, state.perClick);
        addConsoleMessage(`Luffy attacks ${state.enemy.name} for ${dmg} damage.`);
        // small hit flash
        clickBtn.style.transform = 'scale(0.97)';
        setTimeout(() => clickBtn.style.transform = '', 80);
        if (state.enemy.hp <= 0) {
            const name = state.enemy.name;
            const reward = state.enemy.reward;
            // reward player
            state.berries += reward;
            // count defeated bandits
            state.banditsDefeated = (state.banditsDefeated || 0) + 1;
            addConsoleMessage(`${name} was defeated; you gained ${reward} Berries.`);
            // play enemy flash and fallen animation then spawn next after short delay
            if (enemySprite) enemySprite.classList.add('flash');
            setTimeout(() => {
                if (enemySprite) { enemySprite.classList.remove('flash'); enemySprite.classList.add('fallen'); }
            }, 120);
            setTimeout(() => {
                if (enemySprite) enemySprite.classList.remove('fallen');
                const nextLv = state.enemy.level + 1;
                spawnEnemy(nextLv);
            }, 900);
        }
        updateUI();
        return;
    }
    state.berries += state.perClick;
    // small pop animation
    clickBtn.style.transform = 'scale(0.97)';
    setTimeout(() => clickBtn.style.transform = '', 80);
    updateUI();
});

// Bazooka special: 100 damage, 15s cooldown
const BAZOOKA_DAMAGE = 100;
const BAZOOKA_COOLDOWN_MS = 15000;
let bazookaTimer = null;

function getBazookaDamage() {
    const lvl = (state.upgradeDamageLevel || 0);
    // scale by 15% per upgrade level
    return Math.max(1, Math.round(BAZOOKA_DAMAGE * (1 + 0.15 * lvl)));
}

function startBazookaCooldown() {
    if (!bazookaBtn) return;
    const ms = BAZOOKA_COOLDOWN_MS;
    const end = Date.now() + ms;
    bazookaBtn.dataset.cooldown = '1';
    bazookaBtn.disabled = true;
    if (bazookaCooldownEl) bazookaCooldownEl.textContent = Math.ceil(ms / 1000) + 's';
    bazookaTimer = setInterval(() => {
        const remaining = Math.max(0, end - Date.now());
        if (bazookaCooldownEl) bazookaCooldownEl.textContent = remaining > 0 ? Math.ceil(remaining / 1000) + 's' : '';
        if (remaining <= 0) {
            clearInterval(bazookaTimer); bazookaTimer = null;
            delete bazookaBtn.dataset.cooldown;
            bazookaBtn.disabled = false;
            if (bazookaCooldownEl) bazookaCooldownEl.textContent = '';
        }
    }, 250);
}

if (bazookaBtn) {
    bazookaBtn.addEventListener('click', () => {
        if (!state.enemy) return alert('No enemy to use Bazooka on');
        if (bazookaBtn.dataset.cooldown) return; // still cooling down
        // apply big damage
        const beforeHp = state.enemy.hp;
        const bazDmg = getBazookaDamage();
        state.enemy.hp -= bazDmg;
        const dmg = Math.min(beforeHp, bazDmg);
        addConsoleMessage(`Luffy fires Gum-Gum Bazooka and deals ${dmg} damage to ${state.enemy.name}.`);
        // big attack visual: brief scale on button
        bazookaBtn.style.transform = 'scale(0.96)';
        setTimeout(() => bazookaBtn.style.transform = '', 120);
        if (state.enemy.hp <= 0) {
            const name = state.enemy.name;
            const reward = state.enemy.reward;
            state.berries += reward;
            state.banditsDefeated = (state.banditsDefeated || 0) + 1;
            addConsoleMessage(`${name} was defeated; you gained ${reward} Berries.`);
            if (enemySprite) enemySprite.classList.add('flash');
            setTimeout(() => {
                if (enemySprite) { enemySprite.classList.remove('flash'); enemySprite.classList.add('fallen'); }
            }, 120);
            setTimeout(() => {
                if (enemySprite) enemySprite.classList.remove('fallen');
                const nextLv = state.enemy.level + 1;
                spawnEnemy(nextLv);
            }, 900);
        }
        updateUI();
        startBazookaCooldown();
    });
}

// Gatling: up to 10 hit attempts, 25 damage per hit, 8s cooldown
const GATLING_HITS = 10;
const GATLING_HIT_PROB = 0.6; // per-hit chance
const GATLING_DMG_PER_HIT = 25; // base per-hit
const GATLING_COOLDOWN_MS = 8000;
let gatlingTimer = null;

function getGatlingDamagePerHit() {
    const lvl = (state.upgradeDamageLevel || 0);
    // scale by 12% per upgrade level
    return Math.max(1, Math.round(GATLING_DMG_PER_HIT * (1 + 0.12 * lvl)));
}

function startGatlingCooldown() {
    if (!gatlingBtn) return;
    const ms = GATLING_COOLDOWN_MS;
    const end = Date.now() + ms;
    gatlingBtn.dataset.cooldown = '1';
    gatlingBtn.disabled = true;
    if (gatlingCooldownEl) gatlingCooldownEl.textContent = Math.ceil(ms / 1000) + 's';
    gatlingTimer = setInterval(() => {
        const remaining = Math.max(0, end - Date.now());
        if (gatlingCooldownEl) gatlingCooldownEl.textContent = remaining > 0 ? Math.ceil(remaining / 1000) + 's' : '';
        if (remaining <= 0) {
            clearInterval(gatlingTimer); gatlingTimer = null;
            delete gatlingBtn.dataset.cooldown;
            gatlingBtn.disabled = false;
            if (gatlingCooldownEl) gatlingCooldownEl.textContent = '';
        }
    }, 250);
}

if (gatlingBtn) {
    gatlingBtn.addEventListener('click', () => {
        if (!state.enemy) return alert('No enemy to use Gatling on');
        if (gatlingBtn.dataset.cooldown) return; // still cooling down
        // perform up to 10 hit attempts
        let hits = 0;
        for (let i = 0; i < GATLING_HITS; i++) {
            if (Math.random() < GATLING_HIT_PROB) hits += 1;
        }
        const perHit = getGatlingDamagePerHit();
        const totalDmg = hits * perHit;
        const beforeHp = state.enemy.hp;
        state.enemy.hp -= totalDmg;
        const actual = Math.min(beforeHp, totalDmg);
        addConsoleMessage(`Luffy's Gatling hits ${hits}/${GATLING_HITS} times for ${actual} damage.`);
        // small visual touch
        if (enemySprite) enemySprite.classList.add('flash');
        setTimeout(() => { if (enemySprite) enemySprite.classList.remove('flash'); }, 200);
        // if perfect chain (all hits) - special flash
        if (hits === GATLING_HITS && enemySprite) {
            enemySprite.classList.add('fallen');
            setTimeout(() => { if (enemySprite) enemySprite.classList.remove('fallen'); }, 700);
        }
        if (state.enemy.hp <= 0) {
            state.berries += state.enemy.reward;
            state.banditsDefeated = (state.banditsDefeated || 0) + 1;
            if (enemySprite) enemySprite.classList.add('flash');
            setTimeout(() => {
                if (enemySprite) { enemySprite.classList.remove('flash'); enemySprite.classList.add('fallen'); }
            }, 120);
            setTimeout(() => {
                if (enemySprite) enemySprite.classList.remove('fallen');
                const nextLv = state.enemy.level + 1;
                spawnEnemy(nextLv);
            }, 900);
        }
        updateUI();
        startGatlingCooldown();
    });
}

// Red Hawk: heavy single hit, 350 damage, 20s cooldown
const REDHAWK_DAMAGE = 350;
const REDHAWK_COOLDOWN_MS = 20000;
let redhawkTimer = null;

function getRedhawkDamage() {
    const lvl = (state.upgradeDamageLevel || 0);
    // scale by 18% per upgrade level
    return Math.max(1, Math.round(REDHAWK_DAMAGE * (1 + 0.18 * lvl)));
}

function startRedhawkCooldown() {
    if (!redhawkBtn) return;
    const ms = REDHAWK_COOLDOWN_MS;
    const end = Date.now() + ms;
    redhawkBtn.dataset.cooldown = '1';
    redhawkBtn.disabled = true;
    if (redhawkCooldownEl) redhawkCooldownEl.textContent = Math.ceil(ms / 1000) + 's';
    redhawkTimer = setInterval(() => {
        const remaining = Math.max(0, end - Date.now());
        if (redhawkCooldownEl) redhawkCooldownEl.textContent = remaining > 0 ? Math.ceil(remaining / 1000) + 's' : '';
        if (remaining <= 0) {
            clearInterval(redhawkTimer); redhawkTimer = null;
            delete redhawkBtn.dataset.cooldown;
            redhawkBtn.disabled = false;
            if (redhawkCooldownEl) redhawkCooldownEl.textContent = '';
        }
    }, 250);
}

if (redhawkBtn) {
    redhawkBtn.addEventListener('click', () => {
        if (!state.enemy) return alert('No enemy to use Red Hawk on');
        if (redhawkBtn.dataset.cooldown) return; // still cooling down
        const beforeHp = state.enemy.hp;
        const redDmg = getRedhawkDamage();
        state.enemy.hp -= redDmg;
        const dmg = Math.min(beforeHp, redDmg);
        addConsoleMessage(`Luffy unleashes Red Hawk and scorches ${state.enemy.name} for ${dmg} damage.`);
        // fierce visual
        if (enemySprite) {
            enemySprite.classList.add('flash');
            setTimeout(() => { if (enemySprite) enemySprite.classList.remove('flash'); }, 350);
        }
        if (state.enemy.hp <= 0) {
            state.berries += state.enemy.reward;
            state.banditsDefeated = (state.banditsDefeated || 0) + 1;
            if (enemySprite) enemySprite.classList.add('flash');
            setTimeout(() => {
                if (enemySprite) { enemySprite.classList.remove('flash'); enemySprite.classList.add('fallen'); }
            }, 120);
            setTimeout(() => {
                if (enemySprite) enemySprite.classList.remove('fallen');
                const nextLv = state.enemy.level + 1;
                spawnEnemy(nextLv);
            }, 900);
        }
        updateUI();
        startRedhawkCooldown();
    });
}

// Upgrade Damage handler
if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => {
        const level = state.upgradeDamageLevel || 0;
        const cost = getUpgradeCost(level);
        if (state.berries < cost) return alert('Not enough Berries to upgrade damage');
        state.berries -= cost;
        state.upgradeDamageLevel = level + 1;
        // increase per-click damage: base +1 per level, with small scaling
        const incr = Math.ceil(1 * Math.pow(1.2, level));
        state.perClick = (state.perClick || 1) + incr;
        updateUI();
    });
}

shopList.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const def = shopDefs.find(s => s.id === id);
    if (!def) return;
    if (state.berries < def.cost) return alert('Not enough Berries');
    state.berries -= def.cost;
    state.items.push(def.id);
    state.cps += def.cps;
    updateUI();
    renderShop();
});

// passive income tick
setInterval(() => {
    state.berries += state.cps;
    updateUI();
}, 1000);

// enemy attack/logic tick (runs every 200ms)
setInterval(() => {
    // decrement invulns
    if (state.player.inv > 0) state.player.inv -= 1;
    if (!state.enemy) return;
    enemyAttackTimer += 200;
    if (enemyAttackTimer >= 900) {
        enemyAttackTimer = 0;
        // simple chance to attack
        if (Math.random() < 0.85) {
            // enemy deals damage relative to its level
            const dmg = Math.max(1, Math.round(2 * Math.pow(1.15, state.enemy.level - 1)));
            if (state.player.inv <= 0) {
                state.player.hp -= dmg;
                state.player.inv = 6; // short inv frames (6 ticks @200ms = 1.2s)
                // hit flash
                if (playerSprite) {
                    playerSprite.classList.add('flash');
                    setTimeout(() => playerSprite.classList.remove('flash'), 300);
                }
            }
            // if player dies, play fallen animation and revive after delay
            if (state.player.hp <= 0) {
                state.player.hp = 0;
                if (playerSprite) playerSprite.classList.add('flash');
                if (playerSprite) setTimeout(() => { if (playerSprite) playerSprite.classList.add('fallen'); }, 120);
                // revive after 2.2s
                setTimeout(() => {
                    if (playerSprite) { playerSprite.classList.remove('fallen'); playerSprite.classList.remove('flash'); }
                    state.player.hp = state.player.maxHp;
                    updateUI();
                }, 2200);
            }
            updateUI();
        }
    }
}, 200);

// Save / Load
function save() {
    localStorage.setItem('opc_save', JSON.stringify(state));
    alert('Game saved');
}
function load() {
    const raw = localStorage.getItem('opc_save');
    if (!raw) return alert('No save found');
    try {
        const obj = JSON.parse(raw);
        state = Object.assign(state, obj);
        updateUI(); renderShop();
        alert('Loaded');
    } catch (e) { alert('Failed to load save'); }
}
function reset() {
    if (!confirm('Reset your progress?')) return;
    state = {
        berries: 0,
        perClick: 1,
        cps: 0,
        items: [],
        banditsDefeated: 0,
        upgradeDamageLevel: 0,
        player: { hp: 100, maxHp: 100, inv: 0 },
        enemy: null
    };
    // respawn starting enemy and refresh UI
    spawnEnemy(1);
    updateUI();
    renderShop();
}

saveBtn.addEventListener('click', save);
loadBtn.addEventListener('click', load);
resetBtn.addEventListener('click', reset);

// auto-save every 10s
setInterval(() => { localStorage.setItem('opc_save', JSON.stringify(state)); }, 10000);

// spawn starting enemy now that DOM elements are ready
spawnEnemy(1);

// initial render
renderShop(); updateUI();
