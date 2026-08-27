// ===== ГЛОБАЛЬНЫЕ =====
let currentUser = null;
let level = 1;
let limit = 25;
let inventory = [];
let dice = [0, 0, 0, 0, 0];
let selectedDice = [false, false, false, false, false];
let rerollsLeft = 3;
let handsLeft = 3;
let isRolling = false;
let hasRolled = false;
let roundActive = false;

// ===== НОВАЯ СИСТЕМА ПРОКАЧКИ =====
const BASE_MULTIPLIERS = {
  high: 1,
  pair: 1.2,
  twoPair: 1.5,
  three: 2,
  straight: 2.5,
  fullHouse: 3.5,
  four: 4,
  five: 6
};

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
  rerolls: 0
};

const ALL_UPGRADES = [
  { id: 'upgrade_high', name: '⬆ Старшая карта', type: 'hand', hand: 'high', desc: 'Множитель +0.2' },
  { id: 'upgrade_pair', name: '⬆ Пара', type: 'hand', hand: 'pair', desc: 'Множитель +0.3' },
  { id: 'upgrade_twoPair', name: '⬆ Две пары', type: 'hand', hand: 'twoPair', desc: 'Множитель +0.4' },
  { id: 'upgrade_three', name: '⬆ Тройка', type: 'hand', hand: 'three', desc: 'Множитель +0.5' },
  { id: 'upgrade_straight', name: '⬆ Стрит', type: 'hand', hand: 'straight', desc: 'Множитель +0.7' },
  { id: 'upgrade_fullHouse', name: '⬆ Фулл-хаус', type: 'hand', hand: 'fullHouse', desc: 'Множитель +1.0' },
  { id: 'upgrade_four', name: '⬆ Каре', type: 'hand', hand: 'four', desc: 'Множитель +1.5' },
  { id: 'upgrade_five', name: '⬆ Пять одинаковых', type: 'hand', hand: 'five', desc: 'Множитель +2.0' },
  { id: 'passive_bones', name: '💀 +Кости', type: 'passive', bonus: 'bones', value: 3, desc: '+3 к костям в каждом раунде' },
  { id: 'passive_bones2', name: '💀 ++Кости', type: 'passive', bonus: 'bones', value: 6, desc: '+6 к костям в каждом раунде' },
  { id: 'passive_mult', name: '💀 +Множитель', type: 'passive', bonus: 'mult', value: 0.3, desc: '+0.3 к множителю в каждом раунде' },
  { id: 'passive_mult2', name: '💀 ++Множитель', type: 'passive', bonus: 'mult', value: 0.6, desc: '+0.6 к множителю в каждом раунде' },
  { id: 'passive_reroll', name: '💀 +Переброс', type: 'passive', bonus: 'rerolls', value: 1, desc: '+1 к перебросам за раунд' },
  { id: 'passive_reroll2', name: '💀 ++Переброс', type: 'passive', bonus: 'rerolls', value: 2, desc: '+2 к перебросам за раунд' },
];

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const diceElements = document.querySelectorAll('.dice');

diceElements.forEach((el, i) => {
  el.addEventListener('click', () => {
    if (!hasRolled || isRolling || !roundActive) return;
    selectedDice[i] = !selectedDice[i];
    el.classList.toggle('selected');
    const anySelected = selectedDice.some(v => v);
    document.getElementById('rerollBtn').disabled = !anySelected || rerollsLeft <= 0;
  });
});

// ===== ИГРОВЫЕ ФУНКЦИИ =====

function startRound() {
  roundActive = true;
  hasRolled = true;
  const bonusRerolls = passiveBonuses.rerolls || 0;
  rerollsLeft = 3 + bonusRerolls;
  handsLeft = 3;
  selectedDice = [false, false, false, false, false];
  diceElements.forEach(el => el.classList.remove('selected'));

  for (let i = 0; i < 5; i++) {
    dice[i] = Math.floor(Math.random() * 6) + 1;
  }
  updateDiceDisplay();
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
  updateDiceDisplay();
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

  const bone = dice.reduce((a, b) => a + b, 0) + (passiveBonuses.bones || 0);
  const handType = getHandType(dice);
  const baseMultiplier = calculateMultiplier(dice);
  const upgradeBonus = handUpgrades[handType] || 0;
  const multiplier = baseMultiplier + upgradeBonus + (passiveBonuses.mult || 0);
  const total = Math.floor(bone * multiplier);

  const resultEl = document.getElementById('resultMessage');
  const isWin = total >= limit;

  if (isWin) {
    resultEl.className = 'result win';
    resultEl.textContent = `🎉 Победа! ${bone} × ${multiplier.toFixed(2)} = ${total} (лимит ${limit})`;

    const itemName = generateItemName();
    const price = Math.floor(bone * multiplier * 1.5);
    inventory.push({ name: itemName, price: price, level: 1 });

    level++;
    limit = Math.floor(limit * 1.8) + 80;

    document.getElementById('levelDisplay').textContent = level;
    document.getElementById('limitDisplay').textContent = limit;

    renderInventory();
    saveProgress();

    showUpgradeModal();
  } else {
    resultEl.className = 'result lose';
    resultEl.textContent = `💀 Поражение! ${bone} × ${multiplier.toFixed(2)} = ${total} (лимит ${limit})`;

    if (inventory.length > 0) {
      const lostIndex = Math.floor(Math.random() * inventory.length);
      const lostItem = inventory[lostIndex];
      inventory.splice(lostIndex, 1);
      renderInventory();
      showMessage(`🔥 "${lostItem.name}" сгорел!`, 'error');
      saveProgress();
    }
  }

  handsLeft--;
  updateHandsDisplay();

  if (handsLeft <= 0 && !isWin) {
    roundActive = false;
    document.getElementById('playBtn').disabled = true;
    document.getElementById('rerollBtn').disabled = true;
    setTimeout(() => {
      startRound();
    }, 2500);
  } else if (!isWin) {
    setTimeout(() => {
      hasRolled = false;
      selectedDice = [false, false, false, false, false];
      diceElements.forEach(el => el.classList.remove('selected'));
      for (let i = 0; i < 5; i++) {
        dice[i] = Math.floor(Math.random() * 6) + 1;
      }
      hasRolled = true;
      updateDiceDisplay();
      updateStats();
      const bonusRerolls = passiveBonuses.rerolls || 0;
      rerollsLeft = 3 + bonusRerolls;
      updateRerollDisplay();
      document.getElementById('rerollBtn').disabled = true;
      document.getElementById('playBtn').disabled = false;
      document.getElementById('resultMessage').textContent = '';
      document.getElementById('resultMessage').className = 'result';
    }, 1500);
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
}

function applyUpgrade(index) {
  const upgrade = window._currentUpgrades[index];
  if (!upgrade) return;

  if (upgrade.type === 'hand') {
    const hand = upgrade.hand;
    const bonus = upgrade.id.includes('high') ? 0.2 :
                  upgrade.id.includes('pair') ? 0.3 :
                  upgrade.id.includes('twoPair') ? 0.4 :
                  upgrade.id.includes('three') ? 0.5 :
                  upgrade.id.includes('straight') ? 0.7 :
                  upgrade.id.includes('fullHouse') ? 1.0 :
                  upgrade.id.includes('four') ? 1.5 :
                  upgrade.id.includes('five') ? 2.0 : 0.3;
    handUpgrades[hand] = (handUpgrades[hand] || 0) + bonus;
    showMessage(`✅ Улучшена комбинация "${getHandName(hand)}"! +${bonus.toFixed(1)} к множителю`, 'success');
  } else if (upgrade.type === 'passive') {
    const bonus = upgrade.bonus;
    const value = upgrade.value;
    passiveBonuses[bonus] = (passiveBonuses[bonus] || 0) + value;
    const bonusNames = {
      bones: 'костям',
      mult: 'множителю',
      rerolls: 'перебросам'
    };
    showMessage(`✅ Получен бонус: +${value} к ${bonusNames[bonus] || bonus}!`, 'success');
  }

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

function calculateMultiplier(diceValues) {
  const type = getHandType(diceValues);
  return BASE_MULTIPLIERS[type] || 1;
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

function generateItemName() {
  const prefixes = ['Тенистый', 'Лунный', 'Огненный', 'Ледяной', 'Кровавый', 'Золотой', 'Древний', 'Космический', 'Призрачный', 'Божественный'];
  const suffixes = ['Клинок', 'Щит', 'Амулет', 'Кольцо', 'Посох', 'Меч', 'Лук', 'Кинжал', 'Топор', 'Молот'];
  return prefixes[Math.floor(Math.random() * prefixes.length)] + ' ' + suffixes[Math.floor(Math.random() * suffixes.length)];
}

// ===== ОТОБРАЖЕНИЕ =====

function updateDiceDisplay() {
  diceElements.forEach((el, i) => {
    if (dice[i] >= 1 && dice[i] <= 6) {
      el.textContent = DICE_FACES[dice[i] - 1];
    } else {
      el.textContent = '⚀';
    }
  });
}

function updateStats() {
  const bone = dice.reduce((a, b) => a + b, 0) + (passiveBonuses.bones || 0);
  const handType = getHandType(dice);
  const baseMultiplier = calculateMultiplier(dice);
  const upgradeBonus = handUpgrades[handType] || 0;
  const multiplier = baseMultiplier + upgradeBonus + (passiveBonuses.mult || 0);
  const total = Math.floor(bone * multiplier);
  document.getElementById('boneDisplay').textContent = bone;
  document.getElementById('multiplierDisplay').textContent = multiplier.toFixed(2);
  document.getElementById('totalDisplay').textContent = total;
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
    container.innerHTML = '<div style="color:#666;padding:10px;">Пусто</div>';
    return;
  }
  let html = '';
  inventory.forEach((item, idx) => {
    html += `
      <div class="inv-item">
        <div class="inv-name">${escapeHtml(item.name)}</div>
        <div class="inv-level">Ур. ${item.level || 1}</div>
        <div class="inv-price">💰 ${item.price || 100}</div>
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
      limit = data.limit_score || 25;
      inventory = data.inventory || [];
      handUpgrades = data.hand_upgrades || {
        high: 0, pair: 0, twoPair: 0, three: 0,
        straight: 0, fullHouse: 0, four: 0, five: 0
      };
      passiveBonuses = data.passive_bonuses || { bones: 0, mult: 0, rerolls: 0 };
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
  el.className = type === 'error' ? 'error-msg' : 'success-msg';
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
        limit = data.limit_score || 25;
        inventory = data.inventory || [];
        handUpgrades = data.hand_upgrades || {
          high: 0, pair: 0, twoPair: 0, three: 0,
          straight: 0, fullHouse: 0, four: 0, five: 0
        };
        passiveBonuses = data.passive_bonuses || { bones: 0, mult: 0, rerolls: 0 };
        document.getElementById('levelDisplay').textContent = level;
        document.getElementById('limitDisplay').textContent = limit;
        renderInventory();
        startRound();
      }
    }
  } catch (e) {}
}
fetchUser();