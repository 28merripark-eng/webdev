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

// Enemy battle state
state.enemy = null; // will be { level, hp, maxHp, reward, name }

function spawnEnemy(level = 1) {
    const baseHp = 20;
    const hp = Math.round(baseHp * Math.pow(1.28, level - 1));
    const reward = Math.round(5 * Math.pow(1.5, level - 1));
    state.enemy = { level, hp, maxHp: hp, reward, name: level === 1 ? 'Bandit' : `Bandit Lv.${level}` };
    updateEnemyUI();
}

// Start first enemy
spawnEnemy(1);

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
}

// Enemy UI helpers
const enemyNameEl = document.getElementById('enemyName');
const enemyLevelEl = document.getElementById('enemyLevel');
const enemyHpFill = document.getElementById('enemyHpFill');
const enemyHpText = document.getElementById('enemyHpText');
const defeatedEl = document.getElementById('defeated');
const enemySprite = document.getElementById('enemySprite');
// prefer user-supplied luffy.png in the clicker folder, fall back to images/luffy.svg
if (enemySprite) {
    enemySprite.src = 'luffy.png';
    enemySprite.onerror = () => { enemySprite.onerror = null; enemySprite.src = 'images/luffy.svg'; };
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
}

clickBtn.addEventListener('click', () => {
    // If an enemy exists, attack it instead of just collecting
    if (state.enemy) {
        state.enemy.hp -= state.perClick;
        // small hit flash
        clickBtn.style.transform = 'scale(0.97)';
        setTimeout(() => clickBtn.style.transform = '', 80);
        if (state.enemy.hp <= 0) {
            // reward player
            state.berries += state.enemy.reward;
            // count defeated bandits
            state.banditsDefeated = (state.banditsDefeated || 0) + 1;
            // spawn next enemy (increase level)
            const nextLv = state.enemy.level + 1;
            spawnEnemy(nextLv);
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
    state = { berries: 0, perClick: 1, cps: 0, items: [], banditsDefeated: 0 };
    updateUI(); renderShop();
}

saveBtn.addEventListener('click', save);
loadBtn.addEventListener('click', load);
resetBtn.addEventListener('click', reset);

// auto-save every 10s
setInterval(() => { localStorage.setItem('opc_save', JSON.stringify(state)); }, 10000);

// initial render
renderShop(); updateUI();
