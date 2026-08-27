// ===== ГЛОБАЛЬНЫЕ =====
let currentUser = null;
let level = 1;
let limit = 100;
let inventory = [];
let dice = [0, 0, 0, 0, 0];
let selectedDice = [false, false, false, false, false];
let lockedDice = [false, false, false, false, false];
let rerollsLeft = 3;
let handsLeft = 3;
let isRolling = false;
let hasRolled = false;
let roundActive = false;

// Эмодзи для кубиков
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

// ===== ИНИЦИАЛИЗАЦИЯ =====
const diceElements = document.querySelectorAll('.dice');

diceElements.forEach((el, i) => {
  el.addEventListener('click', () => {
    if (!hasRolled || isRolling || !roundActive) return;
    if (lockedDice[i]) return;
    selectedDice[i] = !selectedDice[i];
    el.classList.toggle('selected');
    // Если хотя бы один выбран, активируем кнопку переброса
    const anySelected = selectedDice.some(v => v);
    document.getElementById('rerollBtn').disabled = !anySelected || rerollsLeft <= 0;
  });
});

// ===== ИГРОВЫЕ ФУНКЦИИ =====

// Начать новый раунд (автоматический бросок)
function startRound() {
  roundActive = true;
  hasRolled = true;
  rerollsLeft = 3;
  handsLeft = 3;
  lockedDice = [false, false, false, false, false];
  selectedDice = [false, false, false, false, false];
  diceElements.forEach(el => {
    el.classList.remove('selected', 'locked');
  });

  // Первый бросок всех кубиков
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

// Переброс выбранных кубиков
function rerollSelected() {
  if (isRolling) return;
  if (rerollsLeft <= 0) {
    showMessage('Нет перебросов!', 'error');
    return;
  }
  if (!hasRolled || !roundActive) return;

  let anySelected = false;
  for (let i = 0; i < 5; i++) {
    if (selectedDice[i] && !lockedDice[i]) {
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
  document.getElementById('rerollBtn').disabled = true; // сброс выбора

  if (rerollsLeft <= 0) {
    document.getElementById('rerollBtn').disabled = true;
  }
}

// Играть руку
function playHand() {
  if (isRolling) return;
  if (handsLeft <= 0) {
    showMessage('Нет рук!', 'error');
    return;
  }
  if (!hasRolled || !roundActive) return;

  // Блокируем кнопки
  document.getElementById('playBtn').disabled = true;
  document.getElementById('rerollBtn').disabled = true;

  // Рассчитываем результат
  const bone = dice.reduce((a, b) => a + b, 0);
  const multiplier = calculateMultiplier(dice);
  const total = bone * multiplier;

  const resultEl = document.getElementById('resultMessage');
  const isWin = total >= limit;

  if (isWin) {
    // ПОБЕДА
    resultEl.className = 'result win';
    resultEl.textContent = `🎉 Победа! ${bone} × ${multiplier} = ${total} (лимит ${limit})`;

    // Добавляем предмет
    const itemName = generateItemName();
    const price = Math.floor(bone * multiplier * 1.5);
    inventory.push({ name: itemName, price: price, level: 1 });
    saveProgress();

    // Повышаем уровень
    level++;
    limit = Math.floor(limit * 1.5) + 50;
    document.getElementById('levelDisplay').textContent = level;
    document.getElementById('limitDisplay').textContent = limit;

    renderInventory();
  } else {
    // ПОРАЖЕНИЕ
    resultEl.className = 'result lose';
    resultEl.textContent = `💀 Поражение! ${bone} × ${multiplier} = ${total} (лимит ${limit})`;

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

  if (handsLeft <= 0) {
    // Раунд окончен — блокируем всё, через 2 сек сброс
    roundActive = false;
    document.getElementById('playBtn').disabled = true;
    document.getElementById('rerollBtn').disabled = true;
    setTimeout(() => {
      startRound();
    }, 2500);
  } else {
    // Следующая рука — сброс кубиков и авто-бросок
    setTimeout(() => {
      // Сброс состояния для новой руки
      hasRolled = false;
      lockedDice = [false, false, false, false, false];
      selectedDice = [false, false, false, false, false];
      diceElements.forEach(el => {
        el.classList.remove('selected', 'locked');
      });
      // Автоматический бросок всех кубиков
      for (let i = 0; i < 5; i++) {
        dice[i] = Math.floor(Math.random() * 6) + 1;
      }
      hasRolled = true;
      updateDiceDisplay();
      updateStats();
      // Сброс перебросов для новой руки
      rerollsLeft = 3;
      updateRerollDisplay();
      document.getElementById('rerollBtn').disabled = true;
      document.getElementById('playBtn').disabled = false;
      document.getElementById('resultMessage').textContent = '';
      document.getElementById('resultMessage').className = 'result';
      // Разблокируем выбор кубиков
    }, 1500);
  }
}

// ===== РАСЧЁТ КОМБИНАЦИЙ =====
function calculateMultiplier(diceValues) {
  const counts = {};
  for (const val of diceValues) {
    counts[val] = (counts[val] || 0) + 1;
  }
  const sorted = Object.values(counts).sort((a, b) => b - a);
  const unique = Object.keys(counts).length;

  const sortedVals = [...diceValues].sort((a, b) => a - b);
  const isStraight = sortedVals.every((v, i) => i === 0 || v === sortedVals[i-1] + 1);

  if (sorted[0] === 5) return 6;
  if (sorted[0] === 4) return 4;
  if (sorted[0] === 3 && sorted[1] === 2) return 3.5;
  if (isStraight) return 2.5;
  if (sorted[0] === 3) return 2;
  if (sorted[0] === 2 && sorted[1] === 2) return 1.5;
  if (sorted[0] === 2) return 1.2;
  return 1;
}

// ===== ГЕНЕРАЦИЯ ПРЕДМЕТОВ =====
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
  const bone = dice.reduce((a, b) => a + b, 0);
  const multiplier = calculateMultiplier(dice);
  const total = bone * multiplier;
  document.getElementById('boneDisplay').textContent = bone;
  document.getElementById('multiplierDisplay').textContent = multiplier.toFixed(1);
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
      body: JSON.stringify({ level, limit_score: limit, inventory })
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
      limit = data.limit_score || 100;
      inventory = data.inventory || [];
      document.getElementById('levelDisplay').textContent = level;
      document.getElementById('limitDisplay').textContent = limit;
      renderInventory();
      // Запускаем первый раунд
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
        limit = data.limit_score || 100;
        inventory = data.inventory || [];
        document.getElementById('levelDisplay').textContent = level;
        document.getElementById('limitDisplay').textContent = limit;
        renderInventory();
        startRound();
      }
    }
  } catch (e) {}
}
fetchUser();