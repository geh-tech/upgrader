// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let currentUser = null;
let currentItems = [];
let selectedItemId = null;
let isSpinning = false;

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const chanceSlider = document.getElementById('chanceSlider');
const chanceDisplay = document.getElementById('chanceDisplay');
const coeffDisplay = document.getElementById('coefficientDisplay');
const hiddenChanceDisplay = document.getElementById('hiddenChanceDisplay');

const LUCK = -0.05;

// ===== ФУНКЦИИ РАСЧЁТА =====
function calculateCoefficient(chance) {
  return 2 - (chance - 50) * 0.03 + LUCK;
}

function calculateHiddenChance(chance, price) {
  // Чем выше цена, тем больше штраф (макс. штраф 10% при цене > 10000)
  const penalty = Math.min(10, price / 1000); // 0..10
  return Math.max(1, chance - penalty);
}

// ===== РИСОВАНИЕ КРУГА =====
function drawWheel(chance) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 10;

  ctx.clearRect(0, 0, w, h);

  // Фон
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Сектор шанса (от 12 часов по часовой стрелке)
  if (chance > 0) {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (chance / 100) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 215, 0, 0.6)';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Центральная точка
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
}

function drawArrow(angle) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 10;

  // Перерисовываем круг с текущим шансом
  const chance = parseInt(chanceSlider.value);
  drawWheel(chance);

  // Стрелка
  const arrowLen = radius * 0.8;
  const tipX = cx + Math.sin(angle) * arrowLen;
  const tipY = cy - Math.cos(angle) * arrowLen;

  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ff4444';
  ctx.fill();
}

// ===== ОБНОВЛЕНИЕ ОТОБРАЖЕНИЯ =====
function updateChanceDisplay() {
  const chance = parseInt(chanceSlider.value);
  chanceDisplay.textContent = chance;
  const coeff = calculateCoefficient(chance);
  coeffDisplay.textContent = coeff.toFixed(3);

  // Получаем цену выбранного предмета
  const item = currentItems.find(i => i.id === selectedItemId);
  const price = item ? item.price : 100;
  const hidden = calculateHiddenChance(chance, price);
  hiddenChanceDisplay.textContent = hidden.toFixed(1);

  drawWheel(chance);
  drawArrow(0);
}

chanceSlider.addEventListener('input', updateChanceDisplay);

// ===== ИНВЕНТАРЬ (СЕТКА) =====
async function loadInventory() {
  try {
    const res = await fetch('/inventory');
    if (!res.ok) throw new Error('Не авторизован');
    const items = await res.json();
    currentItems = items;
    renderInventory(items);
  } catch (e) {
    document.getElementById('inventoryContainer').innerHTML = '<div class="empty-msg">Ошибка загрузки инвентаря</div>';
  }
}

function renderInventory(items) {
  const container = document.getElementById('inventoryContainer');
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-msg">У вас пока нет предметов. Добавьте свой первый!</div>';
    return;
  }
  let html = '<div class="inventory-grid">';
  items.forEach(item => {
    html += `
      <div class="item-card" data-id="${item.id}">
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="level">Уровень ${item.level}</div>
        <div class="price">💰 ${item.price}</div>
        <div class="rarity">Редкость: ${item.rarity}/1000</div>
        <div class="actions">
          <button onclick="openUpgrade(${item.id})">⚡ Апгрейд</button>
          <button class="delete-btn" onclick="deleteItem(${item.id})">✖</button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ===== ДОБАВЛЕНИЕ ПРЕДМЕТА (для теста) =====
async function addItem() {
  const name = document.getElementById('itemName').value.trim();
  const price = parseInt(document.getElementById('itemPrice').value) || 100;
  if (!name) {
    showMessage('Введите название', 'error');
    return;
  }
  try {
    const res = await fetch('/add-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, rarity: 500 })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('itemName').value = '';
      showMessage('Предмет добавлен!', 'success');
      loadInventory();
    } else {
      showMessage(data.error || 'Ошибка', 'error');
    }
  } catch (e) {
    showMessage('Ошибка соединения', 'error');
  }
}

// ===== УДАЛЕНИЕ =====
async function deleteItem(id) {
  if (!confirm('Удалить предмет?')) return;
  try {
    const res = await fetch('/delete-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id })
    });
    if (res.ok) {
      loadInventory();
    } else {
      showMessage('Ошибка удаления', 'error');
    }
  } catch (e) {
    showMessage('Ошибка соединения', 'error');
  }
}

// ===== ОТКРЫТИЕ МОДАЛКИ =====
function openUpgrade(id) {
  if (isSpinning) return;
  const item = currentItems.find(i => i.id === id);
  if (!item) return;
  selectedItemId = id;
  document.getElementById('modalItemName').textContent = item.name;
  document.getElementById('modalCurrentLevel').textContent = item.level;
  document.getElementById('modalPrice').textContent = item.price;
  document.getElementById('modalResult').textContent = '';
  document.getElementById('upgradeBtn').disabled = false;
  chanceSlider.value = 50;
  updateChanceDisplay();
  document.getElementById('upgradeModal').classList.add('active');
}

function closeModal() {
  if (isSpinning) return;
  document.getElementById('upgradeModal').classList.remove('active');
  selectedItemId = null;
}

// ===== АНИМАЦИЯ ВРАЩЕНИЯ (ИСПРАВЛЕНА ЛОГИКА ПОПАДАНИЯ) =====
function spinWheel(targetAngle, callback) {
  const duration = 3000;
  const startTime = performance.now();
  const startAngle = 0;
  const extraRotations = 5 + Math.random() * 3;
  const totalAngle = targetAngle + extraRotations * Math.PI * 2;

  function animate(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const angle = startAngle + totalAngle * eased;
    drawArrow(angle);
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Определяем финальный угол (от 0 до 2PI)
      let finalAngle = angle % (Math.PI * 2);
      if (finalAngle < 0) finalAngle += Math.PI * 2;
      // Проверяем попадание в сектор шанса
      const chance = parseInt(chanceSlider.value);
      // Сектор начинается с -PI/2 (12 часов) и идёт по часовой стрелке на chance%
      const sectorStart = -Math.PI / 2;
      const sectorEnd = sectorStart + (chance / 100) * Math.PI * 2;
      // Приводим finalAngle к диапазону [0, 2PI)
      // Сектор может быть от отрицательного до положительного, поэтому нормализуем
      let normFinal = finalAngle;
      // Переведём сектор в [0, 2PI)
      let start = sectorStart;
      let end = sectorEnd;
      // Если сектор пересекает 0, разбиваем
      // Но проще: проверяем, находится ли угол внутри сектора
      // Нормализуем сектор в [0, 2PI)
      while (start < 0) { start += Math.PI * 2; end += Math.PI * 2; }
      while (start >= Math.PI * 2) { start -= Math.PI * 2; end -= Math.PI * 2; }
      // Если end > 2PI, то сектор пересекает 0
      let hit = false;
      if (end <= Math.PI * 2) {
        // Сектор в пределах одного оборота
        if (normFinal >= start && normFinal <= end) hit = true;
      } else {
        // Сектор пересекает 0
        if (normFinal >= start || normFinal <= end - Math.PI * 2) hit = true;
      }
      callback(hit);
    }
  }
  requestAnimationFrame(animate);
}

// ===== ПОДТВЕРЖДЕНИЕ АПГРЕЙДА =====
async function confirmUpgrade() {
  if (isSpinning) return;
  const item = currentItems.find(i => i.id === selectedItemId);
  if (!item) return;

  const chosenChance = parseInt(chanceSlider.value);
  const hiddenChance = calculateHiddenChance(chosenChance, item.price);
  const coeff = calculateCoefficient(chosenChance);

  const btn = document.getElementById('upgradeBtn');
  btn.disabled = true;
  isSpinning = true;
  document.getElementById('modalResult').textContent = '🎲 Крутим...';

  // Случайный угол остановки (0..2PI)
  const targetAngle = Math.random() * Math.PI * 2;

  spinWheel(targetAngle, async (hit) => {
    // Но мы должны учесть скрытый шанс: фактически победа наступает, если hit И random < hiddenChance/100
    // Чтобы не нарушать механику, мы сначала определяем hit по сектору, а потом дополнительно проверяем скрытый шанс
    let actualWin = hit;
    if (hit) {
      // Дополнительная проверка скрытого шанса
      const extraRoll = Math.random() * 100;
      if (extraRoll > hiddenChance) {
        actualWin = false; // переопределяем как проигрыш
      }
    }

    if (actualWin) {
      // ПОБЕДА
      const newLevel = Math.ceil(item.level * coeff);
      try {
        const res = await fetch('/force-upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: selectedItemId, newLevel })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('modalResult').textContent = `🎉 Успех! Уровень стал ${newLevel} (x${coeff.toFixed(3)})`;
          const itemInList = currentItems.find(i => i.id === selectedItemId);
          if (itemInList) itemInList.level = newLevel;
          renderInventory(currentItems);
          // Добавляем в историю (сервер уже записал)
          loadHistory();
        } else {
          document.getElementById('modalResult').textContent = '❌ Ошибка при обновлении';
        }
      } catch (e) {
        document.getElementById('modalResult').textContent = '❌ Ошибка соединения';
      }
    } else {
      // ПРОИГРЫШ
      try {
        // Записываем проигрыш в историю
        await fetch('/record-lose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: selectedItemId })
        });
        // Удаляем предмет
        const res = await fetch('/delete-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: selectedItemId })
        });
        if (res.ok) {
          document.getElementById('modalResult').textContent = '💀 Не повезло... Предмет сгорел!';
          loadInventory();
          loadHistory();
        } else {
          document.getElementById('modalResult').textContent = '❌ Ошибка при удалении';
        }
      } catch (e) {
        document.getElementById('modalResult').textContent = '❌ Ошибка соединения';
      }
    }
    btn.disabled = false;
    isSpinning = false;
  });
}

// ===== ИСТОРИЯ (ОНЛАЙН-ЛЕНТА) =====
async function loadHistory() {
  try {
    const res = await fetch('/history');
    const entries = await res.json();
    const list = document.getElementById('historyList');
    if (!entries || entries.length === 0) {
      list.innerHTML = '<span class="history-placeholder">Нет апгрейдов</span>';
      return;
    }
    let html = '';
    entries.forEach(entry => {
      const cls = entry.win ? 'win' : 'lose';
      const resultText = entry.win ? '✅' : '❌';
      html += `
        <div class="history-item ${cls}">
          <span class="user">${escapeHtml(entry.username)}</span>
          поставил <span class="item">${escapeHtml(entry.item_name)}</span>
          ${entry.win ? `→ уровень ${entry.new_level}` : 'сгорел'}
          <span class="result-${entry.win ? 'win' : 'lose'}">${resultText}</span>
        </div>
      `;
    });
    list.innerHTML = html;
  } catch (e) {
    document.getElementById('historyList').innerHTML = '<span class="history-placeholder">Ошибка загрузки истории</span>';
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
      document.getElementById('userInfo').style.display = 'block';
      document.getElementById('addItemSection').style.display = 'flex';
      showMessage('Добро пожаловать!', 'success');
      loadInventory();
      loadHistory();
      // Периодическое обновление истории
      setInterval(loadHistory, 5000);
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
  document.getElementById('userInfo').style.display = 'none';
  document.getElementById('addItemSection').style.display = 'none';
  document.getElementById('inventoryContainer').innerHTML = '<div class="empty-msg">Войдите, чтобы увидеть инвентарь</div>';
  showMessage('Вы вышли', 'success');
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
        document.getElementById('userInfo').style.display = 'block';
        document.getElementById('addItemSection').style.display = 'flex';
        loadInventory();
        loadHistory();
        setInterval(loadHistory, 5000);
      }
    }
  } catch (e) {}
}
fetchUser();

// Инициализация круга
updateChanceDisplay();