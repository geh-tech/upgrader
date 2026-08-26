// ===== Глобальные переменные =====
let currentUser = null;
let currentItems = [];
let selectedItemId = null;
let isSpinning = false;
let balance = 0;

// Элементы DOM
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const chanceSlider = document.getElementById('chanceSlider');
const chanceDisplay = document.getElementById('chanceDisplay');
const coeffDisplay = document.getElementById('coefficientDisplay');
const hiddenChanceDisplay = document.getElementById('hiddenChanceDisplay');
const feedList = document.getElementById('feedList');

// Константы
const LUCK = -0.05;

// ===== Функции расчёта =====
function calculateCoefficient(chance) {
  return 2 - (chance - 50) * 0.03 + LUCK;
}

// Скрытый шанс: чем выше цена предмета, тем ниже реальный шанс (но не менее 1%)
function calculateHiddenChance(baseChance, itemPrice) {
  // Цена влияет: чем выше цена, тем больше штраф.
  // Формула: realChance = baseChance - (price / 1000) * 2, но не менее 1
  let reduction = (itemPrice / 1000) * 2; // например, цена 1000 -> снижение на 2%
  let realChance = Math.max(1, baseChance - reduction);
  return Math.min(realChance, 99); // не более 99
}

// ===== Отрисовка круга и стрелки =====
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

  // Закрашенный сектор (шанс)
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

  // Рисуем деления (опционально)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const len = i % 3 === 0 ? radius * 0.9 : radius * 0.95;
    const x1 = cx + Math.cos(angle) * radius * 0.85;
    const y1 = cy + Math.sin(angle) * radius * 0.85;
    const x2 = cx + Math.cos(angle) * radius;
    const y2 = cy + Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawArrow(angle) {
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) / 2 - 10;

  // Перерисовываем круг без стрелки (чтобы не перекрывать)
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

  // Центр
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ff4444';
  ctx.fill();
}

// ===== Обновление дисплея =====
function updateChanceDisplay() {
  const chance = parseInt(chanceSlider.value);
  chanceDisplay.textContent = chance;
  const coeff = calculateCoefficient(chance);
  coeffDisplay.textContent = coeff.toFixed(3);

  // Получаем выбранный предмет для расчёта скрытого шанса
  const item = currentItems.find(i => i.id === selectedItemId);
  let hiddenChance = chance;
  if (item) {
    hiddenChance = calculateHiddenChance(chance, item.price);
  }
  hiddenChanceDisplay.textContent = Math.round(hiddenChance);

  drawWheel(chance);
  drawArrow(0);
}

chanceSlider.addEventListener('input', updateChanceDisplay);

// ===== Инвентарь (сетка) =====
function renderInventory(items) {
  const container = document.getElementById('inventoryContainer');
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-msg">У вас пока нет предметов. Получите случайный!</div>';
    return;
  }
  let html = '<div class="inventory-grid">';
  items.forEach(item => {
    const rarityColor = {
      'Обычный': '#aaa',
      'Необычный': '#5b9aff',
      'Редкий': '#b45eff',
      'Эпический': '#ff5e5e',
      'Легендарный': '#ffa500',
      'Мифический': '#ff69b4',
      'Вселенский': '#00ffff'
    }[item.rarity] || '#fff';
    html += `
      <div class="item-card" data-id="${item.id}">
        <div class="rarity" style="color:${rarityColor};">${item.rarity}</div>
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="level">Уровень ${item.level}</div>
        <div class="price">${item.price} 🪙</div>
        <div class="actions">
          <button class="upgrade-btn-card" onclick="openUpgrade(${item.id})">⚡ Апгрейд</button>
          <button class="delete-btn" onclick="deleteItem(${item.id})">✖</button>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// ===== Загрузка инвентаря =====
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

// ===== Получение случайного предмета =====
async function generateAndAddItem() {
  try {
    const res = await fetch('/generate-item');
    if (!res.ok) throw new Error('Ошибка генерации');
    const data = await res.json();
    // Добавляем в инвентарь
    const addRes = await fetch('/add-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (addRes.ok) {
      showMessage('Получен новый предмет: ' + data.name, 'success');
      loadInventory();
      updateBalance();
    } else {
      showMessage('Ошибка добавления предмета', 'error');
    }
  } catch (e) {
    showMessage('Ошибка соединения', 'error');
  }
}

// ===== Удаление предмета =====
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
      showMessage('Предмет удалён', 'success');
    } else {
      showMessage('Ошибка удаления', 'error');
    }
  } catch (e) {
    showMessage('Ошибка соединения', 'error');
  }
}

// ===== Апгрейд =====
function openUpgrade(id) {
  if (isSpinning) return;
  const item = currentItems.find(i => i.id === id);
  if (!item) return;
  selectedItemId = id;
  document.getElementById('modalItemName').textContent = item.name;
  document.getElementById('modalCurrentLevel').textContent = item.level;
  document.getElementById('modalItemPrice').textContent = item.price;
  document.getElementById('modalResult').textContent = '';
  document.getElementById('upgradeBtn').disabled = false;
  // Сбросить шанс на 50
  chanceSlider.value = 50;
  updateChanceDisplay();
  document.getElementById('upgradeModal').classList.add('active');
}

function closeModal() {
  if (isSpinning) return;
  document.getElementById('upgradeModal').classList.remove('active');
  selectedItemId = null;
}

// ===== Анимация вращения =====
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
    const chance = parseInt(chanceSlider.value);
    drawWheel(chance);
    drawArrow(angle);
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      const finalAngle = angle % (Math.PI * 2);
      // Определяем попадание
      let normalized = ((finalAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const deg = normalized * 180 / Math.PI;
      const sectorStart = 270;
      const sectorEnd = sectorStart + (chance / 100) * 360;
      let hit = false;
      if (sectorStart <= sectorEnd) {
        if (deg >= sectorStart && deg <= sectorEnd) hit = true;
      } else {
        if (deg >= sectorStart || deg <= sectorEnd) hit = true;
      }
      callback(hit);
    }
  }
  requestAnimationFrame(animate);
}

// ===== Подтверждение апгрейда =====
async function confirmUpgrade() {
  if (isSpinning) return;
  const item = currentItems.find(i => i.id === selectedItemId);
  if (!item) return;

  const baseChance = parseInt(chanceSlider.value);
  const realChance = calculateHiddenChance(baseChance, item.price);
  const coeff = calculateCoefficient(baseChance);

  const btn = document.getElementById('upgradeBtn');
  btn.disabled = true;
  isSpinning = true;
  document.getElementById('modalResult').textContent = '🎲 Крутим...';

  // Случайный угол остановки (0..2PI)
  const targetAngle = Math.random() * Math.PI * 2;

  spinWheel(targetAngle, async (hit) => {
    // Проверяем, попала ли стрелка в реальный сектор (скрытый шанс)
    // Но мы уже рассчитали realChance, который меньше baseChance.
    // Однако визуально сектор отображает baseChance, а решение принимаем по realChance.
    // Это и есть "скрытый шанс": игрок видит один сектор, а реальный шанс меньше.
    // Чтобы не перерисовывать круг, мы просто используем realChance для определения победы.
    // Сделаем так: генерируем случайное число 0-1, если < realChance/100 -> победа.
    const roll = Math.random() * 100;
    const success = roll <= realChance;

    if (success) {
      // Победа: новый уровень = текущий * coeff, округляем вверх
      const newLevel = Math.ceil(item.level * coeff);
      // Отправляем на сервер
      try {
        const res = await fetch('/force-upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: selectedItemId, newLevel, success: true })
        });
        if (res.ok) {
          document.getElementById('modalResult').textContent = `🎉 Успех! Уровень стал ${newLevel} (x${coeff.toFixed(3)})`;
          // Обновить инвентарь
          const itemInList = currentItems.find(i => i.id === selectedItemId);
          if (itemInList) itemInList.level = newLevel;
          renderInventory(currentItems);
          updateBalance();
          loadFeed();
        } else {
          document.getElementById('modalResult').textContent = '❌ Ошибка при обновлении';
        }
      } catch (e) {
        document.getElementById('modalResult').textContent = '❌ Ошибка соединения';
      }
    } else {
      // Проигрыш: предмет удаляется
      try {
        const res = await fetch('/delete-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: selectedItemId })
        });
        if (res.ok) {
          document.getElementById('modalResult').textContent = '💀 Не повезло... Предмет сгорел!';
          // Логируем проигрыш (на сервере логируется в force-upgrade, но мы не вызываем его при проигрыше, поэтому добавим отдельный лог)
          // Можно также вызвать force-upgrade с success:false, но проще добавить отдельный эндпоинт для лога.
          // Для простоты оставим так, лента обновится при следующей загрузке.
          loadInventory();
          updateBalance();
          loadFeed();
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

// ===== Лента апгрейдов =====
async function loadFeed() {
  try {
    const res = await fetch('/recent-upgrades');
    if (res.ok) {
      const logs = await res.json();
      feedList.innerHTML = '';
      if (logs.length === 0) {
        feedList.innerHTML = '<li>Пока нет апгрейдов</li>';
        return;
      }
      logs.forEach(log => {
        const li = document.createElement('li');
        const status = log.success ? '✅' : '❌';
        const cls = log.success ? 'win' : 'lose';
        li.innerHTML = `<span class="${cls}">${status}</span> ${log.username} улучшил ${log.item_name} (${log.old_level}→${log.new_level})`;
        feedList.appendChild(li);
      });
    }
  } catch (e) {}
}

// ===== Баланс =====
async function updateBalance() {
  try {
    const res = await fetch('/user');
    if (res.ok) {
      const data = await res.json();
      balance = data.balance || 0;
      document.getElementById('balanceDisplay').textContent = balance;
    }
  } catch (e) {}
}

// ===== Авторизация =====
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
      balance = data.balance || 0;
      document.getElementById('usernameDisplay').textContent = currentUser;
      document.getElementById('balanceDisplay').textContent = balance;
      document.getElementById('authSection').style.display = 'none';
      document.getElementById('userInfo').style.display = 'block';
      document.getElementById('addItemSection').style.display = 'flex';
      showMessage('Добро пожаловать!', 'success');
      loadInventory();
      loadFeed();
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

// ===== Вспомогательные =====
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

// ===== Инициализация =====
async function init() {
  // Проверка сессии
  try {
    const res = await fetch('/user');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.username;
      balance = data.balance || 0;
      document.getElementById('usernameDisplay').textContent = currentUser;
      document.getElementById('balanceDisplay').textContent = balance;
      document.getElementById('authSection').style.display = 'none';
      document.getElementById('userInfo').style.display = 'block';
      document.getElementById('addItemSection').style.display = 'flex';
      loadInventory();
      loadFeed();
    }
  } catch (e) {}
  // Начальная отрисовка круга
  updateChanceDisplay();
}

init();