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
// health upgrade level
state.upgradeHealthLevel = 0;
// bounty system
state.bounty = 0;
state.bossesDefeated = 0;
state.bluenoBossDefeated = false; // track if Blueno (Gear 2 unlock) has been defeated
state.kaidoCycles = 0; // track how many times we've cycled past Kaido

// Boss definitions in order (cycles back to Crocodile after Kaido)
// Bounty increases based on Kaido cycles
const bosses = [
    { name: 'Crocodile', baseBounty: 80000000 },
    { name: 'Enel', baseBounty: 200000000 },
    { name: 'Blueno', baseBounty: 280000000 }, // NEW - gates Gear 2 unlock
    { name: 'Lucci', baseBounty: 380000000 },
    { name: 'Moria', baseBounty: 550000000 },
    { name: 'Akainu', baseBounty: 950000000 },
    { name: 'Caesar Clown', baseBounty: 1050000000 }, // NEW
    { name: 'Doflamingo', baseBounty: 1400000000 },
    { name: 'Katakuri', baseBounty: 1600000000 },
    { name: 'Kaido', baseBounty: 2200000000 }
];

// Enemy battle state
state.enemy = null; // will be { level, hp, maxHp, reward, name }

function spawnEnemy(level = 1) {
    // Check if this is a boss level (every 10 levels)
    if (level % 10 === 0) {
        // Boss encounter
        const bossIndex = ((level / 10) - 1) % bosses.length;
        const boss = bosses[bossIndex];

        // Calculate bounty with Kaido cycle multiplier
        // Each time you pass Kaido, all bounties increase by 50%
        const cycleMultiplier = Math.pow(1.5, state.kaidoCycles || 0);
        const adjustedBounty = Math.round(boss.baseBounty * cycleMultiplier);

        const bossHp = 100 + (level * 15); // Bosses have much more HP
        state.enemy = {
            level,
            hp: bossHp,
            maxHp: bossHp,
            reward: adjustedBounty,
            name: boss.name,
            isBoss: true,
            variant: 1,
            isKaido: boss.name === 'Kaido'
        };
        if (enemySprite) enemySprite.src = `images/bandit.svg`; // placeholder
        updateEnemyUI();
        return;
    }

    // Regular bandit
    // Linear HP scaling: +2 HP per level
    const baseHp = 20;
    const hp = baseHp + (level - 1) * 2;

    // Reduced reward for balanced money system (base 2, 1.20x multiplier)
    const baseReward = 2;
    const reward = Math.round(baseReward * Math.pow(1.20, level - 1));
    
    // Create the regular bandit enemy
    const variant = (level % 3) + 1; // variations 1-3
    state.enemy = {
        level,
        hp: hp,
        maxHp: hp,
        reward: reward,
        name: `Bandit (Lv.${level})`,
        isBoss: false,
        variant: variant
    };
    
    if (enemySprite) enemySprite.src = `images/bandit${variant}.svg`;
    updateEnemyUI();
}

// NOTE: don't start the first enemy here — DOM elements used by updateEnemyUI
// are initialized later. Initial spawn happens after DOM lookups below.

// Player state
state.player = { hp: 100, maxHp: 100, inv: 0, gear2Active: false, gear2TimeLeft: 0 };

// Enemy attack behavior: every second enemy may attack player when alive
let enemyAttackTimer = 0;
let gear2Timer = null;
let gear3CooldownTimer = null;

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
    if (bountyEl) bountyEl.textContent = format(state.bounty || 0);
    if (bossesDefeatedEl) bossesDefeatedEl.textContent = String(state.bossesDefeated || 0);
    updateEnemyUI();
    // upgrade UI
    try {
        const cost = getUpgradeCost(state.upgradeDamageLevel || 0);
        if (upgradeCostEl) upgradeCostEl.textContent = format(cost);
        if (upgradeLevelEl) upgradeLevelEl.textContent = String(state.upgradeDamageLevel || 0);
        // health upgrade UI
        const hcost = getUpgradeHealthCost(state.upgradeHealthLevel || 0);
        if (upgradeHealthCostEl) upgradeHealthCostEl.textContent = format(hcost);
        if (upgradeHealthLevelEl) upgradeHealthLevelEl.textContent = String(state.upgradeHealthLevel || 0);
    } catch (e) { }
}

function getUpgradeCost(level) {
    // Costs scale more reasonably: 20 -> 40 -> 80 -> 160 instead of exponential spike
    // Balance: early upgrades are affordable, late game still requires grind
    return Math.round(20 * Math.pow(1.8, level));
}

function getUpgradeHealthCost(level) {
    // Health upgrades slightly cheaper than damage to encourage balance
    return Math.round(25 * Math.pow(1.75, level));
}

// Enemy UI helpers
const enemyNameEl = document.getElementById('enemyName');
const enemyLevelEl = document.getElementById('enemyLevel');
const enemyHpFill = document.getElementById('enemyHpFill');
const enemyHpText = document.getElementById('enemyHpText');
const defeatedEl = document.getElementById('defeated');
const bountyEl = document.getElementById('bounty');
const bossesDefeatedEl = document.getElementById('bossesDefeated');
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
const gear2Btn = document.getElementById('gear2Btn');
const gear2CooldownEl = document.getElementById('gear2Cooldown');
const gear3Btn = document.getElementById('gear3Btn');
const gear3CooldownEl = document.getElementById('gear3Cooldown');
const upgradeBtn = document.getElementById('upgradeDamageBtn');
const upgradeCostEl = document.getElementById('upgradeCost');
const upgradeLevelEl = document.getElementById('upgradeLevel');
const upgradeHealthBtn = document.getElementById('upgradeHealthBtn');
const upgradeHealthCostEl = document.getElementById('upgradeHealthCost');
const upgradeHealthLevelEl = document.getElementById('upgradeHealthLevel');
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
        // Display boss indicator
        const bossLabel = state.enemy.isBoss ? '👑 BOSS: ' : '';
        enemyNameEl.textContent = bossLabel + state.enemy.name;
        enemyLevelEl.textContent = `Lv. ${state.enemy.level}`;
        const pct = Math.max(0, (state.enemy.hp / state.enemy.maxHp) * 100);
        enemyHpFill.style.width = pct + '%';
        enemyHpText.textContent = `HP: ${Math.max(0, state.enemy.hp)} / ${state.enemy.maxHp}`;
        // Change HP bar color for bosses
        if (state.enemy.isBoss) {
            enemyHpFill.style.backgroundColor = '#ff6b6b';
            enemyHpFill.style.boxShadow = '0 0 10px #ff6b6b';
        } else {
            enemyHpFill.style.backgroundColor = '';
            enemyHpFill.style.boxShadow = '';
        }
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
    if (gear3Btn) gear3Btn.disabled = !!gear3Btn.dataset.cooldown;
    // Gear 2 visual indicator: show active status with lighter pink
    if (state.player.gear2Active && playerSprite) {
        playerSprite.style.filter = 'hue-rotate(-30deg) brightness(1.3) saturate(1.2)';
    } else if (playerSprite) {
        playerSprite.style.filter = '';
    }
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
        // Gear 2 one-shots: instantly kill enemy if Gear 2 is active
        if (state.player.gear2Active) {
            state.enemy.hp = -1; // instant kill
        }

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

            // Handle boss defeat
            if (state.enemy.isBoss) {
                state.bounty += reward;
                state.bossesDefeated = (state.bossesDefeated || 0) + 1;

                // Check for Blueno (Gear 2 unlock)
                if (name === 'Blueno') {
                    state.bluenoBossDefeated = true;
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                    addConsoleMessage(`⚡ You have unlocked GEAR 2!`);
                } else if (state.enemy.isKaido) {
                    // Kaido defeated - increment cycle for bounty scaling
                    state.kaidoCycles = (state.kaidoCycles || 0) + 1;
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                    addConsoleMessage(`🔄 Kaido cycle increased to ${state.kaidoCycles}! All bosses' bounties will be stronger next cycle.`);
                } else {
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                }
            } else {
                addConsoleMessage(`${name} was defeated; you gained ${reward} Berries.`);
            }

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
    // Increased scaling to 20% per upgrade level (from 15%)
    // Makes special attacks scale better with progression
    return Math.max(1, Math.round(BAZOOKA_DAMAGE * (1 + 0.20 * lvl)));
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
        // Gear 2 one-shots: instantly kill enemy if Gear 2 is active
        if (state.player.gear2Active) {
            state.enemy.hp = -1; // instant kill
        }
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
            if (state.enemy.isBoss) {
                state.bounty += reward;
                state.bossesDefeated = (state.bossesDefeated || 0) + 1;

                // Check for Blueno (Gear 2 unlock)
                if (name === 'Blueno') {
                    state.bluenoBossDefeated = true;
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                    addConsoleMessage(`⚡ You have unlocked GEAR 2!`);
                } else if (state.enemy.isKaido) {
                    // Kaido defeated - increment cycle for bounty scaling
                    state.kaidoCycles = (state.kaidoCycles || 0) + 1;
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                    addConsoleMessage(`🔄 Kaido cycle increased to ${state.kaidoCycles}! All bosses' bounties will be stronger next cycle.`);
                } else {
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                }
            } else {
                addConsoleMessage(`${name} was defeated; you gained ${reward} Berries.`);
            }
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
const GATLING_HIT_PROB = 0.65; // slightly increased from 0.6 for more consistency
const GATLING_DMG_PER_HIT = 25; // base per-hit
const GATLING_COOLDOWN_MS = 8000;
let gatlingTimer = null;

function getGatlingDamagePerHit() {
    const lvl = (state.upgradeDamageLevel || 0);
    // Increased scaling to 16% per upgrade level (from 12%)
    return Math.max(1, Math.round(GATLING_DMG_PER_HIT * (1 + 0.16 * lvl)));
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
        // Gear 2 one-shots: instantly kill enemy if Gear 2 is active
        if (state.player.gear2Active) {
            state.enemy.hp = -1; // instant kill
        }
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
            const name = state.enemy.name;
            const reward = state.enemy.reward;
            state.berries += reward;
            state.banditsDefeated = (state.banditsDefeated || 0) + 1;
            if (state.enemy.isBoss) {
                state.bounty += reward;
                state.bossesDefeated = (state.bossesDefeated || 0) + 1;

                // Check for Blueno (Gear 2 unlock)
                if (name === 'Blueno') {
                    state.bluenoBossDefeated = true;
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                    addConsoleMessage(`⚡ You have unlocked GEAR 2!`);
                } else if (state.enemy.isKaido) {
                    // Kaido defeated - increment cycle for bounty scaling
                    state.kaidoCycles = (state.kaidoCycles || 0) + 1;
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                    addConsoleMessage(`🔄 Kaido cycle increased to ${state.kaidoCycles}! All bosses' bounties will be stronger next cycle.`);
                } else {
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                }
            } else {
                addConsoleMessage(`${name} was defeated; you gained ${reward} Berries.`);
            }
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
    // Increased scaling to 22% per upgrade level (from 18%)
    return Math.max(1, Math.round(REDHAWK_DAMAGE * (1 + 0.22 * lvl)));
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
        // Gear 2 one-shots: instantly kill enemy if Gear 2 is active
        if (state.player.gear2Active) {
            state.enemy.hp = -1; // instant kill
        }
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
            const name = state.enemy.name;
            const reward = state.enemy.reward;
            state.berries += reward;
            state.banditsDefeated = (state.banditsDefeated || 0) + 1;
            if (state.enemy.isBoss) {
                state.bounty += reward;
                state.bossesDefeated = (state.bossesDefeated || 0) + 1;

                // Check for Blueno (Gear 2 unlock)
                if (name === 'Blueno') {
                    state.bluenoBossDefeated = true;
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                    addConsoleMessage(`⚡ You have unlocked GEAR 2!`);
                } else if (state.enemy.isKaido) {
                    // Kaido defeated - increment cycle for bounty scaling
                    state.kaidoCycles = (state.kaidoCycles || 0) + 1;
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                    addConsoleMessage(`🔄 Kaido cycle increased to ${state.kaidoCycles}! All bosses' bounties will be stronger next cycle.`);
                } else {
                    addConsoleMessage(`🏆 BOSS DEFEATED! ${name} Bounty: ${format(reward)}`);
                }
            } else {
                addConsoleMessage(`${name} was defeated; you gained ${reward} Berries.`);
            }
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

// Gear 2: One-shots any enemy, lasts 1 min 30 sec (90 seconds), 120s cooldown
const GEAR2_DURATION_MS = 90000; // 1 min 30 seconds
const GEAR2_COOLDOWN_MS = 120000; // 2 minutes
let gear2CooldownTimer = null;

function startGear2() {
    // Check if Blueno has been defeated (Gear 2 unlock requirement)
    if (!state.bluenoBossDefeated) {
        return alert('You must defeat Blueno first to unlock Gear 2!');
    }

    if (!state.enemy) return alert('No enemy to activate Gear 2 on');
    if (gear2Btn.dataset.cooldown) return; // still cooling down

    // Activate Gear 2
    state.player.gear2Active = true;
    state.player.gear2TimeLeft = GEAR2_DURATION_MS;
    addConsoleMessage('⚡ Luffy activates Gear 2!');

    // Immediately one-shot the current enemy
    const name = state.enemy.name;
    const reward = state.enemy.reward;
    state.berries += reward;
    state.banditsDefeated = (state.banditsDefeated || 0) + 1;
    addConsoleMessage(`${name} was obliterated! Gained ${reward} Berries.`);

    // Enemy defeated animation
    if (enemySprite) enemySprite.classList.add('flash');
    setTimeout(() => {
        if (enemySprite) { enemySprite.classList.remove('flash'); enemySprite.classList.add('fallen'); }
    }, 120);
    setTimeout(() => {
        if (enemySprite) enemySprite.classList.remove('fallen');
        const nextLv = state.enemy.level + 1;
        spawnEnemy(nextLv);
    }, 900);

    updateUI();
    startGear2Cooldown();

    // Countdown timer for Gear 2 duration
    const end = Date.now() + GEAR2_DURATION_MS;
    const durTimer = setInterval(() => {
        const remaining = Math.max(0, end - Date.now());
        state.player.gear2TimeLeft = remaining;

        if (gear2CooldownEl && remaining > 0) {
            gear2CooldownEl.textContent = Math.ceil(remaining / 1000) + 's (active)';
        }

        if (remaining <= 0) {
            clearInterval(durTimer);
            state.player.gear2Active = false;
            state.player.gear2TimeLeft = 0;
            if (gear2CooldownEl) gear2CooldownEl.textContent = '';
            addConsoleMessage('⚡ Gear 2 deactivated.');
            updateUI();
        }
    }, 250);
}

function startGear2Cooldown() {
    if (!gear2Btn) return;
    const ms = GEAR2_COOLDOWN_MS;
    const end = Date.now() + ms;
    gear2Btn.dataset.cooldown = '1';
    gear2Btn.disabled = true;
    if (gear2CooldownEl) gear2CooldownEl.textContent = Math.ceil(ms / 1000) + 's';
    gear2CooldownTimer = setInterval(() => {
        const remaining = Math.max(0, end - Date.now());
        if (gear2CooldownEl) gear2CooldownEl.textContent = remaining > 0 ? Math.ceil(remaining / 1000) + 's' : '';
        if (remaining <= 0) {
            clearInterval(gear2CooldownTimer); gear2CooldownTimer = null;
            delete gear2Btn.dataset.cooldown;
            gear2Btn.disabled = false;
            if (gear2CooldownEl) gear2CooldownEl.textContent = '';
        }
    }, 250);
}

if (gear2Btn) {
    gear2Btn.addEventListener('click', startGear2);
}

// Gear 3: Kills 15 enemies and skips ahead 15 levels, 180s cooldown
const GEAR3_COOLDOWN_MS = 180000; // 3 minutes

function startGear3() {
    if (!state.enemy) return alert('No enemy to activate Gear 3 on');
    if (gear3Btn.dataset.cooldown) return; // still cooling down

    // Display epic story message
    const storyMessages = [
        '💪 Luffy\'s body begins to expand and grow immense!',
        '💪 "GEAR THIRD!!!"',
        '💪 With mighty fists, Luffy shatters through 15 enemies like they\'re nothing!',
        '💪 The battlefield trembles from the sheer power!',
        '💪 Luffy has grown 15 levels stronger...'
    ];

    storyMessages.forEach((msg, idx) => {
        setTimeout(() => {
            addConsoleMessage(msg);
        }, idx * 300);
    });

    // Get rewards from 15 defeated enemies
    let totalRewards = 0;
    let totalBounty = 0;
    for (let i = 0; i < 15; i++) {
        const currentLevel = state.enemy.level + i;

        // Check if this level has a boss
        if (currentLevel % 10 === 0) {
            const bossIndex = ((currentLevel / 10) - 1) % bosses.length;
            const boss = bosses[bossIndex];

            // Calculate bounty with Kaido cycle multiplier
            const cycleMultiplier = Math.pow(1.5, state.kaidoCycles || 0);
            const adjustedBounty = Math.round(boss.baseBounty * cycleMultiplier);

            totalRewards += adjustedBounty;
            totalBounty += adjustedBounty;
            state.bossesDefeated = (state.bossesDefeated || 0) + 1;

            // Check if this is Kaido or Blueno
            if (boss.name === 'Kaido') {
                state.kaidoCycles = (state.kaidoCycles || 0) + 1;
            } else if (boss.name === 'Blueno') {
                state.bluenoBossDefeated = true;
            }
        } else {
            const baseReward = 2;
            const reward = Math.round(baseReward * Math.pow(1.20, currentLevel - 1));
            totalRewards += reward;
        }

        state.banditsDefeated = (state.banditsDefeated || 0) + 1;
    }

    state.berries += totalRewards;
    if (totalBounty > 0) {
        state.bounty += totalBounty;
        addConsoleMessage(`${totalRewards} Berries collected from 15 defeated enemies! (Including ${format(totalBounty)} bounty)`);
    } else {
        addConsoleMessage(`${totalRewards} Berries collected from 15 defeated enemies!`);
    }

    // Skip ahead 15 levels
    const oldLevel = state.enemy.level;
    const newLevel = oldLevel + 15;
    addConsoleMessage(`⬆️ Jumped from Lv.${oldLevel} to Lv.${newLevel}!`);

    // Spawn enemy at new level
    spawnEnemy(newLevel);
    updateUI();
    startGear3Cooldown();
}

function startGear3Cooldown() {
    if (!gear3Btn) return;
    const ms = GEAR3_COOLDOWN_MS;
    const end = Date.now() + ms;
    gear3Btn.dataset.cooldown = '1';
    gear3Btn.disabled = true;
    if (gear3CooldownEl) gear3CooldownEl.textContent = Math.ceil(ms / 1000) + 's';
    gear3CooldownTimer = setInterval(() => {
        const remaining = Math.max(0, end - Date.now());
        if (gear3CooldownEl) gear3CooldownEl.textContent = remaining > 0 ? Math.ceil(remaining / 1000) + 's' : '';
        if (remaining <= 0) {
            clearInterval(gear3CooldownTimer); gear3CooldownTimer = null;
            delete gear3Btn.dataset.cooldown;
            gear3Btn.disabled = false;
            if (gear3CooldownEl) gear3CooldownEl.textContent = '';
        }
    }, 250);
}

if (gear3Btn) {
    gear3Btn.addEventListener('click', startGear3);
}

// Health upgrade: increases player's max HP and fully heals
if (upgradeHealthBtn) {
    upgradeHealthBtn.addEventListener('click', () => {
        const lvl = state.upgradeHealthLevel || 0;
        const cost = getUpgradeHealthCost(lvl);
        if (state.berries < cost) return alert('Not enough Berries to upgrade health');
        state.berries -= cost;
        state.upgradeHealthLevel = lvl + 1;
        // increase max HP: scale more aggressively to keep pace with enemy damage
        // Provides steady health progression throughout game
        const increase = Math.round(30 * Math.pow(1.18, lvl));
        state.player.maxHp = (state.player.maxHp || 100) + increase;
        // fully heal on upgrade
        state.player.hp = state.player.maxHp;
        addConsoleMessage(`Luffy's max HP increased by ${increase} and is fully healed.`);
        updateUI();
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
        // Increase per-click damage with better scaling:
        // Level 1: +2, Level 2: +2.4, Level 3: +2.9, etc.
        // Ensures damage upgrades remain relevant throughout game
        const incr = Math.ceil(2 * Math.pow(1.2, level));
        state.perClick = (state.perClick || 1) + incr;
        addConsoleMessage(`Luffy's attack power increased by ${incr}!`);
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
            // enemy deals damage: Linear scaling +2 damage per level
            // Level 1: 2 damage, Level 2: 4 damage, Level 3: 6 damage, etc.
            const dmg = Math.max(1, 2 * state.enemy.level);
            if (state.player.inv <= 0) {
                state.player.hp -= dmg;
                state.player.inv = 6; // short inv frames (6 ticks @200ms = 1.2s)
                // hit flash
                if (playerSprite) {
                    playerSprite.classList.add('flash');
                    setTimeout(() => playerSprite.classList.remove('flash'), 300);
                }
            }
            // if player dies, ask to restart instead of auto-reviving
            if (state.player.hp <= 0) {
                state.player.hp = 0;
                if (playerSprite) playerSprite.classList.add('flash');
                if (playerSprite) setTimeout(() => { if (playerSprite) playerSprite.classList.add('fallen'); }, 120);
                // After animation, ask player if they want to restart
                setTimeout(() => {
                    const restart = confirm('You died! Would you like to restart the game?');
                    if (restart) {
                        performReset();
                    } else {
                        // If they don't want to restart, keep the fallen state
                        if (playerSprite) playerSprite.classList.remove('fallen');
                        state.player.hp = 0;
                    }
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
    performReset();
}

function performReset() {
    // Clear any ongoing timers
    if (bazookaTimer) {
        clearInterval(bazookaTimer);
        bazookaTimer = null;
    }
    if (gatlingTimer) {
        clearInterval(gatlingTimer);
        gatlingTimer = null;
    }
    if (redhawkTimer) {
        clearInterval(redhawkTimer);
        redhawkTimer = null;
    }
    if (gear2Timer) {
        clearInterval(gear2Timer);
        gear2Timer = null;
    }
    if (gear2CooldownTimer) {
        clearInterval(gear2CooldownTimer);
        gear2CooldownTimer = null;
    }
    if (gear3CooldownTimer) {
        clearInterval(gear3CooldownTimer);
        gear3CooldownTimer = null;
    }

    // Clear any sprite classes and effects
    if (playerSprite) {
        playerSprite.classList.remove('flash');
        playerSprite.classList.remove('fallen');
        playerSprite.style.filter = '';
    }
    if (enemySprite) {
        enemySprite.classList.remove('flash');
        enemySprite.classList.remove('fallen');
    }

    // Clear button cooldown states
    if (bazookaBtn) {
        delete bazookaBtn.dataset.cooldown;
        bazookaBtn.disabled = false;
    }
    if (gatlingBtn) {
        delete gatlingBtn.dataset.cooldown;
        gatlingBtn.disabled = false;
    }
    if (redhawkBtn) {
        delete redhawkBtn.dataset.cooldown;
        redhawkBtn.disabled = false;
    }
    if (gear2Btn) {
        delete gear2Btn.dataset.cooldown;
        gear2Btn.disabled = false;
    }
    if (gear3Btn) {
        delete gear3Btn.dataset.cooldown;
        gear3Btn.disabled = false;
    }

    // Clear cooldown text
    if (bazookaCooldownEl) bazookaCooldownEl.textContent = '';
    if (gatlingCooldownEl) gatlingCooldownEl.textContent = '';
    if (redhawkCooldownEl) redhawkCooldownEl.textContent = '';
    if (gear2CooldownEl) gear2CooldownEl.textContent = '';
    if (gear3CooldownEl) gear3CooldownEl.textContent = '';

    state = {
        berries: 0,
        perClick: 1,
        cps: 0,
        items: [],
        banditsDefeated: 0,
        bossesDefeated: 0,
        bounty: 0,
        bluenoBossDefeated: false,
        kaidoCycles: 0,
        upgradeDamageLevel: 0,
        upgradeHealthLevel: 0,
        player: { hp: 100, maxHp: 100, inv: 0, gear2Active: false, gear2TimeLeft: 0 },
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
