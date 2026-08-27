// ===== ГЛОБАЛЬНЫЕ =====
let currentUser = null;
let level = 1;
let limit = 50;
let inventory = [];
let dice = [0, 0, 0, 0, 0];
let selectedDice = [false, false, false, false, false];
let rerollsLeft = 3;
let handsLeft = 3;
let isRolling = false;
let hasRolled = false;
let roundActive = false;
let currentHandType = 'high';

// ===== БАЗОВЫЕ МНОЖИТЕЛИ =====
const BASE_MULTIPLIERS = {
  high: 1,
  pair: 2,
  twoPair: 3,
  three: 4,
  straight: 5,
  fullHouse: 6,
  four: 8,
  five: 12
};

// ===== ПРОКАЧКИ =====
let handUpgrades = {
  high: 0,
  pair: 0,
  twoPair: 0,
  three: 0,
  straight: 0,
  fullHouse: 0,
  four: 0,
  five: 0
};

let passiveBonuses = {
  bones: 0,
  mult: 0,
  rerolls: 0,
  extra_hands: 0,
  limit_reduce: 0,
  combo_bones_mult: null,
  extra_level: 0
};

// ===== ГЕНЕРАЦИЯ УЛУЧШЕНИЙ =====
function generateAllUpgrades() {
  const upgrades = [];
  const handTypes = ['high', 'pair', 'twoPair', 'three', 'straight', 'fullHouse', 'four', 'five'];
  const handNames = {
    high: 'Старшая карта',
    pair: 'Пара',
    twoPair: 'Две пары',
    three: 'Тройка',
    straight: 'Стрит',
    fullHouse: 'Фулл-хаус',
    four: 'Каре',
    five: 'Пять одинаковых'
  };
  for (let level = 1; level <= 10; level++) {
    const bonus = level;
    for (const hand of handTypes) {
      upgrades.push({
        id: `upgrade_hand_${hand}_${level}`,
        name: `⬆ ${handNames[hand]} +${bonus}x`,
        type: 'hand',
        hand: hand,
        value: bonus,
        desc: `Множитель +${bonus} для ${handNames[hand]}`
      });
    }
  }

  for (let i = 1; i <= 6; i++) {
    const val = i * 5;
    upgrades.push({
      id: `passive_bones_${i}`,
      name: `💀 +${val} кости`,
      type: 'passive',
      bonus: 'bones',
      value: val,
      desc: `+${val} к костям в каждом раунде`
    });
  }
  for (let i = 1; i <= 5; i++) {
    upgrades.push({
      id: `passive_mult_${i}`,
      name: `💀 +${i} множитель`,
      type: 'passive',
      bonus: 'mult',
      value: i,
      desc: `+${i} к множителю в каждом раунде`
    });
  }
  for (let i = 1; i <= 3; i++) {
    upgrades.push({
      id: `passive_rerolls_${i}`,
      name: `💀 +${i} переброс`,
      type: 'passive',
      bonus: 'rerolls',
      value: i,
      desc: `+${i} к перебросам в каждом раунде`
    });
  }
  for (let i = 1; i <= 2; i++) {
    upgrades.push({
      id: `passive_hands_${i}`,
      name: `💀 +${i} рука`,
      type: 'passive',
      bonus: 'extra_hands',
      value: i,
      desc: `+${i} дополнительная рука за раунд`
    });
  }
  for (let i = 1; i <= 3; i++) {
    const val = i * 10;
    upgrades.push({
      id: `passive_limit_reduce_${i}`,
      name: `💀 Лимит -${val}`,
      type: 'passive',
      bonus: 'limit_reduce',
      value: val,
      desc: `Снижает лимит на ${val} в следующем раунде (одноразово)`
    });
  }
  const combos = [
    { b: 5, m: 1 },
    { b: 10, m: 2 },
    { b: 15, m: 3 },
    { b: 20, m: 4 },
    { b: 25, m: 5 }
  ];
  for (let i = 0; i < combos.length; i++) {
    const c = combos[i];
    upgrades.push({
      id: `passive_combo_${i}`,
      name: `💀 +${c.b} кости +${c.m} множ`,
      type: 'passive',
      bonus: 'combo_bones_mult',
      value: { bones: c.b, mult: c.m },
      desc: `+${c.b} к костям и +${c.m} к множителю`
    });
  }
  for (let i = 1; i <= 2; i++) {
    upgrades.push({
      id: `passive_extra_level_${i}`,
      name: `💀 +${i} уровень при победе`,
      type: 'passive',
      bonus: 'extra_level',
      value: i,
      desc: `При победе получаете дополнительный +${i} уровень`
    });
  }
  return upgrades;
}

const ALL_UPGRADES = generateAllUpgrades();
console.log(`✅ Сгенерировано ${ALL_UPGRADES.length} улучшений`);

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const diceElements = document.querySelectorAll('.dice');

// ===== ЗВУКИ (Web Audio API) =====
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type) {
  try {
    initAudio();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    gainNode.gain.value = 0.15;

    switch (type) {
      case 'click':
        oscillator.frequency.value = 800;
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
        break;
      case 'roll':
        oscillator.frequency.value = 400;
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
        break;
      case 'win':
        oscillator.frequency.setValueAtTime(523, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(659, audioCtx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, audioCtx.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.4);
        break;
      case 'lose':
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(200, audioCtx.currentTime + 0.2);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.4);
        break;
      case 'upgrade':
        oscillator.frequency.setValueAtTime(500, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime + 0.08);
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.16);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
        break;
      default:
        break;
    }
  } catch (e) {
    // Подавляем ошибки звука
  }
}

// ===== ЧАСТИЦЫ =====
function createParticles(x, y, count, color, spread) {
  const container = document.getElementById('particlesContainer');
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const size = Math.random() * 8 + 4;
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * spread + 50;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.background = color;
    particle.style.left = (x - size/2) + 'px';
    particle.style.top = (y - size/2) + 'px';
    particle.style.setProperty('--tx', tx + 'px');
    particle.style.setProperty('--ty', ty + 'px');
    particle.style.animationDuration = (Math.random() * 0.6 + 0.4) + 's';
    container.appendChild(particle);
    setTimeout(() => particle.remove(), 1200);
  }
}

function spawnWinParticles() {
  const rect = document.getElementById('resultMessage').getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  createParticles(cx, cy, 40, '#69db7c', 300);
  createParticles(cx - 50, cy - 30, 20, '#ffd700', 200);
}

function spawnLoseParticles() {
  const rect = document.getElementById('resultMessage').getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  createParticles(cx, cy, 30, '#ff6b6b', 250);
  createParticles(cx + 40, cy - 20, 15, '#ff4444', 180);
}

function spawnUpgradeParticles() {
  const container = document.querySelector('.upgrade-modal-content');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  createParticles(cx, cy, 50, '#ffd700', 350);
  createParticles(cx - 60, cy - 40, 25, '#ff8c00', 250);
}

// ===== ВСПЫШКА =====
function flashOverlay(type) {
  const overlay = document.getElementById('flashOverlay');
  overlay.className = '';
  // Триггер перерисовки
  void overlay.offsetWidth;
  overlay.className = type === 'win' ? 'flash-win' : 'flash-lose';
  setTimeout(() => { overlay.className = ''; }, 900);
}

// ===== DICE CLICK =====
diceElements.forEach((el, i) => {
  el.addEventListener('click', () => {
    if (!hasRolled || isRolling || !roundActive) return;
    selectedDice[i] = !selectedDice[i];
    el.classList.toggle('selected');
    const anySelected = selectedDice.some(v => v);
    document.getElementById('rerollBtn').disabled = !anySelected || rerollsLeft <= 0;
    if (selectedDice[i]) playSound('click');
  });
});

// ===== СБРОС ИГРЫ =====
function resetGame() {
  level = 1;
  limit = 50;
  inventory = [];
  handUpgrades = { high: 0, pair: 0, twoPair: 0, three: 0, straight: 0, fullHouse: 0, four: 0, five: 0 };
  passiveBonuses = { bones: 0, mult: 0, rerolls: 0, extra_hands: 0, limit_reduce: 0, combo_bones_mult: null, extra_level: 0 };
  document.getElementById('levelDisplay').textContent = level;
  document.getElementById('limitDisplay').textContent = limit;
  renderInventory();
  saveProgress();
  roundActive = false;
  setTimeout(() => {
    startRound();
  }, 500);
}

// ===== ИГРОВЫЕ ФУНКЦИИ =====

function startRound() {
  roundActive = true;
  hasRolled = true;
  const bonusRerolls = passiveBonuses.rerolls || 0;
  const bonusHands = passiveBonuses.extra_hands || 0;
  rerollsLeft = 3 + bonusRerolls;
  handsLeft = 3 + bonusHands;
  selectedDice = [false, false, false, false, false];
  diceElements.forEach(el => el.classList.remove('selected'));

  if (passiveBonuses.limit_reduce && passiveBonuses.limit_reduce > 0) {
    const reduce = passiveBonuses.limit_reduce;
    window._originalLimit = limit;
    limit = Math.max(10, limit - reduce);
    document.getElementById('limitDisplay').textContent = limit;
    passiveBonuses.limit_reduce = 0;
    showMessage(`💡 Лимит снижен на ${reduce} (текущий: ${limit})`, 'info');
  }

  for (let i = 0; i < 5; i++) {
    dice[i] = Math.floor(Math.random() * 6) + 1;
  }
  updateDiceDisplay(true);
  updateStats();
  updateRerollDisplay();
  updateHandsDisplay();
  document.getElementById('rerollBtn').disabled = true;
  document.getElementById('playBtn').disabled = false;
  document.getElementById('resultMessage').textContent = '';
  document.getElementById('resultMessage').className = 'result';
}

function rerollSelected() {
  if (isRolling) return;
  if (rerollsLeft <= 0) {
    showMessage('Нет перебросов!', 'error');
    return;
  }
  if (!hasRolled || !roundActive) return;

  let anySelected = false;
  for (let i = 0; i < 5; i++) {
    if (selectedDice[i]) {
      dice[i] = Math.floor(Math.random() * 6) + 1;
      anySelected = true;
      selectedDice[i] = false;
      diceElements[i].classList.remove('selected');
    }
  }
  if (!anySelected) {
    showMessage('Выберите кубики для переброса!', 'error');
    return;
  }

  rerollsLeft--;
  playSound('roll');
  updateDiceDisplay(true);
  updateStats();
  updateRerollDisplay();
  document.getElementById('rerollBtn').disabled = true;

  if (rerollsLeft <= 0) {
    document.getElementById('rerollBtn').disabled = true;
  }
}

function playHand() {
  if (isRolling) return;
  if (handsLeft <= 0) {
    showMessage('Нет рук!', 'error');
    return;
  }
  if (!hasRolled || !roundActive) return;

  document.getElementById('playBtn').disabled = true;
  document.getElementById('rerollBtn').disabled = true;
  playSound('click');

  // Рассчёт
  let bone = dice.reduce((a, b) => a + b, 0) + (passiveBonuses.bones || 0);
  if (passiveBonuses.combo_bones_mult) {
    bone += passiveBonuses.combo_bones_mult.bones || 0;
  }
  const handType = getHandType(dice);
  currentHandType = handType;
  const baseMultiplier = BASE_MULTIPLIERS[handType] || 1;
  let upgradeBonus = handUpgrades[handType] || 0;
  let multBonus = passiveBonuses.mult || 0;
  if (passiveBonuses.combo_bones_mult) {
    multBonus += passiveBonuses.combo_bones_mult.mult || 0;
  }
  const multiplier = baseMultiplier + upgradeBonus + multBonus;
  const total = Math.floor(bone * multiplier);

  const resultEl = document.getElementById('resultMessage');
  const isWin = total >= limit;

  if (isWin) {
    // ПОБЕДА
    const oldLimit = limit;
    level++;
    limit = Math.floor(limit * 1.3);
    resultEl.className = 'result win';
    resultEl.textContent = `🎉 Победа! ${bone} × ${multiplier} = ${total} (лимит ${oldLimit} → ${limit})`;

    if (passiveBonuses.extra_level) {
      const extra = passiveBonuses.extra_level;
      level += extra;
      showMessage(`✨ Дополнительный +${extra} уровень!`, 'success');
    }

    document.getElementById('levelDisplay').textContent = level;
    document.getElementById('limitDisplay').textContent = limit;

    // Эффекты победы
    playSound('win');
    flashOverlay('win');
    spawnWinParticles();

    saveProgress();
    showUpgradeModal();
  } else {
    // ПОРАЖЕНИЕ
    resultEl.className = 'result lose';
    resultEl.textContent = `💀 Поражение! ${bone} × ${multiplier} = ${total} (лимит ${limit})`;
    playSound('lose');
    flashOverlay('lose');
    spawnLoseParticles();
    resetGame();
  }

  handsLeft--;
  updateHandsDisplay();

  if (handsLeft <= 0 && !isWin) {
    roundActive = false;
    document.getElementById('playBtn').disabled = true;
    document.getElementById('rerollBtn').disabled = true;
  }
}

// ===== УЛУЧШЕНИЯ =====

function showUpgradeModal() {
  const shuffled = [...ALL_UPGRADES].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  const modal = document.createElement('div');
  modal.className = 'upgrade-modal';
  modal.innerHTML = `
    <div class="upgrade-modal-content">
      <h2>⬆ УРОВЕНЬ ${level}!</h2>
      <p class="upgrade-subtitle">Выберите улучшение:</p>
      <div class="upgrade-options">
        ${selected.map((upgrade, index) => `
          <div class="upgrade-option" data-index="${index}">
            <div class="upgrade-name">${upgrade.name}</div>
            <div class="upgrade-desc">${upgrade.desc}</div>
            <button class="upgrade-select-btn" onclick="applyUpgrade(${index})">Выбрать</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  window._currentUpgrades = selected;
  // Звук и частицы при открытии
  playSound('upgrade');
  setTimeout(spawnUpgradeParticles, 300);
}

function applyUpgrade(index) {
  const upgrade = window._currentUpgrades[index];
  if (!upgrade) return;

  if (upgrade.type === 'hand') {
    handUpgrades[upgrade.hand] = (handUpgrades[upgrade.hand] || 0) + upgrade.value;
    showMessage(`✅ Улучшена комбинация "${getHandName(upgrade.hand)}"! +${upgrade.value} к множителю`, 'success');
  } else if (upgrade.type === 'passive') {
    const bonus = upgrade.bonus;
    const value = upgrade.value;
    if (bonus === 'combo_bones_mult') {
      passiveBonuses.combo_bones_mult = value;
    } else {
      passiveBonuses[bonus] = (passiveBonuses[bonus] || 0) + value;
    }
    const bonusNames = {
      bones: 'костям',
      mult: 'множителю',
      rerolls: 'перебросам',
      extra_hands: 'рукам',
      limit_reduce: 'снижению лимита',
      combo_bones_mult: 'комбо (кости+множ)',
      extra_level: 'дополнительному уровню'
    };
    showMessage(`✅ Получен череп: +${value} к ${bonusNames[bonus] || bonus}!`, 'success');
  }

  // Добавляем в инвентарь
  const inventoryItem = {
    id: upgrade.id,
    name: upgrade.name,
    type: upgrade.type,
    hand: upgrade.hand || null,
    bonus: upgrade.bonus || null,
    value: upgrade.value,
    desc: upgrade.desc
  };
  inventory.push(inventoryItem);
  renderInventory();

  // Эффект выбора
  playSound('upgrade');
  spawnUpgradeParticles();

  const modal = document.querySelector('.upgrade-modal');
  if (modal) modal.remove();

  saveProgress();
  setTimeout(() => {
    startRound();
  }, 500);
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

function getHandType(diceValues) {
  const counts = {};
  for (const val of diceValues) {
    counts[val] = (counts[val] || 0) + 1;
  }
  const sorted = Object.values(counts).sort((a, b) => b - a);
  const sortedVals = [...diceValues].sort((a, b) => a - b);
  const isStraight = sortedVals.every((v, i) => i === 0 || v === sortedVals[i-1] + 1);

  if (sorted[0] === 5) return 'five';
  if (sorted[0] === 4) return 'four';
  if (sorted[0] === 3 && sorted[1] === 2) return 'fullHouse';
  if (isStraight) return 'straight';
  if (sorted[0] === 3) return 'three';
  if (sorted[0] === 2 && sorted[1] === 2) return 'twoPair';
  if (sorted[0] === 2) return 'pair';
  return 'high';
}

function getHandName(type) {
  const names = {
    high: 'Старшая карта',
    pair: 'Пара',
    twoPair: 'Две пары',
    three: 'Тройка',
    straight: 'Стрит',
    fullHouse: 'Фулл-хаус',
    four: 'Каре',
    five: 'Пять одинаковых'
  };
  return names[type] || type;
}

// ===== ОТОБРАЖЕНИЕ =====

function updateDiceDisplay(animate = false) {
  diceElements.forEach((el, i) => {
    if (dice[i] >= 1 && dice[i] <= 6) {
      el.textContent = DICE_FACES[dice[i] - 1];
    } else {
      el.textContent = '⚀';
    }
    if (animate) {
      el.classList.remove('rolling');
      void el.offsetWidth;
      el.classList.add('rolling');
    }
  });
}

function updateStats() {
  let bone = dice.reduce((a, b) => a + b, 0) + (passiveBonuses.bones || 0);
  if (passiveBonuses.combo_bones_mult) {
    bone += passiveBonuses.combo_bones_mult.bones || 0;
  }
  const handType = getHandType(dice);
  currentHandType = handType;
  const baseMultiplier = BASE_MULTIPLIERS[handType] || 1;
  let upgradeBonus = handUpgrades[handType] || 0;
  let multBonus = passiveBonuses.mult || 0;
  if (passiveBonuses.combo_bones_mult) {
    multBonus += passiveBonuses.combo_bones_mult.mult || 0;
  }
  const multiplier = baseMultiplier + upgradeBonus + multBonus;
  const total = Math.floor(bone * multiplier);
  document.getElementById('boneDisplay').textContent = bone;
  document.getElementById('multiplierDisplay').textContent = multiplier;
  document.getElementById('totalDisplay').textContent = total;
  renderInventory();
}

function updateRerollDisplay() {
  document.getElementById('rerollCount').textContent = rerollsLeft;
  document.getElementById('rerollBtn').disabled = (rerollsLeft <= 0 || !hasRolled || !roundActive);
}

function updateHandsDisplay() {
  document.getElementById('handCount').textContent = handsLeft;
  document.getElementById('playBtn').disabled = (handsLeft <= 0 || !hasRolled || !roundActive);
}

function renderInventory() {
  const container = document.getElementById('inventoryContainer');
  if (!inventory || inventory.length === 0) {
    container.innerHTML = '<div style="color:#666;padding:10px;">Нет улучшений</div>';
    return;
  }
  let html = '';
  const reversed = [...inventory].reverse();
  reversed.forEach((item) => {
    const isHand = item.type === 'hand';
    const icon = isHand ? '🎯' : '💀';
    let valueText = '';
    if (isHand) {
      valueText = `+${item.value}x`;
    } else {
      if (typeof item.value === 'object') {
        valueText = `+${item.value.bones}к +${item.value.mult}м`;
      } else {
        valueText = `+${item.value}`;
      }
    }
    let activeClass = '';
    if (isHand && item.hand === currentHandType) {
      activeClass = ' active';
    }
    html += `
      <div class="inv-item${activeClass}">
        <div class="inv-name">${icon} ${escapeHtml(item.name)}</div>
        <div class="inv-level">${valueText}</div>
        <div class="inv-price">${escapeHtml(item.desc)}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ===== СОХРАНЕНИЕ =====
async function saveProgress() {
  try {
    await fetch('/update-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        limit_score: limit,
        inventory,
        hand_upgrades: handUpgrades,
        passive_bonuses: passiveBonuses
      })
    });
  } catch (e) {
    console.error('Ошибка сохранения:', e);
  }
}

// ===== АВТОРИЗАЦИЯ =====

async function register() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!username || !password) { showMessage('Заполните все поля', 'error'); return; }
  try {
    const res = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      showMessage('Регистрация успешна! Теперь войдите.', 'success');
    } else {
      showMessage(data.error || 'Ошибка', 'error');
    }
  } catch (e) {
    showMessage('Ошибка соединения', 'error');
  }
}

async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  if (!username || !password) { showMessage('Заполните все поля', 'error'); return; }
  try {
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.username;
      document.getElementById('usernameDisplay').textContent = currentUser;
      document.getElementById('authSection').style.display = 'none';
      document.getElementById('gameSection').style.display = 'block';
      showMessage('Добро пожаловать!', 'success');
      loadGameData();
    } else {
      showMessage(data.error || 'Ошибка', 'error');
    }
  } catch (e) {
    showMessage('Ошибка соединения', 'error');
  }
}

async function logout() {
  await fetch('/logout');
  currentUser = null;
  document.getElementById('authSection').style.display = 'flex';
  document.getElementById('gameSection').style.display = 'none';
  showMessage('Вы вышли', 'success');
}

// ===== ЗАГРУЗКА ДАННЫХ =====

async function loadGameData() {
  try {
    const res = await fetch('/user');
    if (res.ok) {
      const data = await res.json();
      level = data.level || 1;
      limit = data.limit_score || 50;
      inventory = data.inventory || [];
      handUpgrades = data.hand_upgrades || {
        high: 0, pair: 0, twoPair: 0, three: 0,
        straight: 0, fullHouse: 0, four: 0, five: 0
      };
      passiveBonuses = data.passive_bonuses || { bones: 0, mult: 0, rerolls: 0, extra_hands: 0, limit_reduce: 0, combo_bones_mult: null, extra_level: 0 };
      document.getElementById('levelDisplay').textContent = level;
      document.getElementById('limitDisplay').textContent = limit;
      renderInventory();
      startRound();
    }
  } catch (e) {
    showMessage('Ошибка загрузки данных', 'error');
  }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ =====

function showMessage(text, type) {
  const el = document.getElementById('message');
  el.textContent = text;
  el.className = type === 'error' ? 'error-msg' : (type === 'info' ? 'result info' : 'success-msg');
  setTimeout(() => { el.textContent = ''; el.className = ''; }, 5000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== ПРОВЕРКА СЕССИИ =====

async function fetchUser() {
  try {
    const res = await fetch('/user');
    if (res.ok) {
      const data = await res.json();
      if (data.username) {
        currentUser = data.username;
        document.getElementById('usernameDisplay').textContent = currentUser;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'block';
        level = data.level || 1;
        limit = data.limit_score || 50;
        inventory = data.inventory || [];
        handUpgrades = data.hand_upgrades || {
          high: 0, pair: 0, twoPair: 0, three: 0,
          straight: 0, fullHouse: 0, four: 0, five: 0
        };
        passiveBonuses = data.passive_bonuses || { bones: 0, mult: 0, rerolls: 0, extra_hands: 0, limit_reduce: 0, combo_bones_mult: null, extra_level: 0 };
        document.getElementById('levelDisplay').textContent = level;
        document.getElementById('limitDisplay').textContent = limit;
        renderInventory();
        startRound();
      }
    }
  } catch (e) {}
}
fetchUser();