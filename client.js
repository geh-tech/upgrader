// ===== ГЛОБАЛЬНЫЕ =====
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

// ===== НОВАЯ ФОРМУЛА КОЭФФИЦИЕНТА =====
function calculateCoefficient(chance) {
  return 100 / chance; // при chance=1% → 100, при 99% → ~1.01
}

// ===== СКРЫТЫЙ ШАНС (штраф от цены) =====
function calculateHiddenChance(chance, price) {
  const penalty = Math.min(10, price / 1000); // макс. штраф 10%
  return Math.max(1, chance - penalty);
}

// ===== РИСОВАНИЕ =====
function drawWheel(realChance) {
  const w = canvas.width, h = canvas.height;
  const cx = w/2, cy = h/2;
  const radius = Math.min(w,h)/2 - 10;

  ctx.clearRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI*2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (realChance > 0) {
    const startAngle = -Math.PI/2;
    const endAngle = startAngle + (realChance/100) * 2*Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,215,0,0.6)';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI*2);
  ctx.fillStyle = '#ffd700';
  ctx.fill();
}

function drawArrow(angle) {
  const w = canvas.width, h = canvas.height;
  const cx = w/2, cy = h/2;
  const radius = Math.min(w,h)/2 - 10;
  drawWheel(window._lastRealChance || 50);
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
  ctx.arc(cx, cy, 6, 0, Math.PI*2);
  ctx.fillStyle = '#ff4444';
  ctx.fill();
}

// ===== ОБНОВЛЕНИЕ =====
function updateChanceDisplay() {
  const declared = parseInt(chanceSlider.value);
  chanceDisplay.textContent = declared;
  const coeff = calculateCoefficient(declared);
  coeffDisplay.textContent = coeff.toFixed(3);

  const item = currentItems.find(i => i.id === selectedItemId);
  const price = item ? item.price : 100;
  const real = calculateHiddenChance(declared, price);
  hiddenChanceDisplay.textContent = real.toFixed(1);
  window._lastRealChance = real;

  drawWheel(real);
  drawArrow(0);
}

chanceSlider.addEventListener('input', updateChanceDisplay);

// ===== ИНВЕНТАРЬ (без изменений) =====
async function loadInventory() {
  try {
    const res = await fetch('/inventory');
    if (!res.ok) throw new Error('Не авторизован');
    const items = await res.json();
    currentItems = items;
    renderInventory(items);
  } catch (e) {
    document.getElementById('inventoryContainer').innerHTML = '<div class="empty-msg">Ошибка загрузки</div>';
  }
}

function renderInventory(items) {
  const container = document.getElementById('inventoryContainer');
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-msg">У вас пока нет предметов.</div>';
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

// ===== ДОБАВЛЕНИЕ / УДАЛЕНИЕ =====
async function addItem() {
  const name = document.getElementById('itemName').value.trim();
  const price = parseInt(document.getElementById('itemPrice').value) || 100;
  if (!name) { showMessage('Введите название', 'error'); return; }
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

async function deleteItem(id) {
  if (!confirm('Удалить?')) return;
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

// ===== МОДАЛКА =====
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

// ===== ВРАЩЕНИЕ (без изменений, работает) =====
function spinWheel(targetAngle, callback) {
  const duration = 3000;
  const startTime = performance.now();
  const startAngle = 0;
  const extraRotations = 5 + Math.random() * 3;
  const totalAngle = targetAngle + extraRotations * Math.PI * 2;
  const realChance = window._lastRealChance || 50;

  function animate(time) {
    const elapsed = time - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const angle = startAngle + totalAngle * eased;
    drawWheel(realChance);
    drawArrow(angle);
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      let finalAngle = angle % (2 * Math.PI);
      if (finalAngle < 0) finalAngle += 2 * Math.PI;
      const sectorStart = -Math.PI / 2;
      const sectorEnd = sectorStart + (realChance / 100) * 2 * Math.PI;
      let startNorm = ((sectorStart % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let endNorm = ((sectorEnd % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let hit = false;
      if (startNorm < endNorm) {
        if (finalAngle >= startNorm && finalAngle <= endNorm) hit = true;
      } else {
        if (finalAngle >= startNorm || finalAngle <= endNorm) hit = true;
      }
      console.log(`🎯 Угол: ${(finalAngle * 180 / Math.PI).toFixed(1)}°, сектор: ${(startNorm * 180 / Math.PI).toFixed(1)}° - ${(endNorm * 180 / Math.PI).toFixed(1)}°, попал: ${hit}`);
      callback(hit);
    }
  }
  requestAnimationFrame(animate);
}

// ===== ПОДТВЕРЖДЕНИЕ АПГРЕЙДА (исправлено) =====
async function confirmUpgrade() {
  if (isSpinning) return;
  const item = currentItems.find(i => i.id === selectedItemId);
  if (!item) return;

  const declared = parseInt(chanceSlider.value);
  const realChance = calculateHiddenChance(declared, item.price);
  const coeff = calculateCoefficient(declared);

  const btn = document.getElementById('upgradeBtn');
  btn.disabled = true;
  isSpinning = true;
  document.getElementById('modalResult').textContent = '🎲 Крутим...';

  const targetAngle = Math.random() * Math.PI * 2;

  spinWheel(targetAngle, async (hit) => {
    if (hit) {
      // ПОБЕДА: новый уровень и цена
      const newLevel = Math.ceil(item.level * coeff);
      const newPrice = Math.ceil(item.price * coeff);
      try {
        const res = await fetch('/force-upgrade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: selectedItemId, newLevel, newPrice })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('modalResult').textContent = `🎉 Успех! Уровень ${newLevel}, цена ${newPrice} (x${coeff.toFixed(3)})`;
          const itemInList = currentItems.find(i => i.id === selectedItemId);
          if (itemInList) {
            itemInList.level = newLevel;
            itemInList.price = newPrice;
          }
          renderInventory(currentItems);
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
        await fetch('/record-lose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: selectedItemId })
        });
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

// ===== ИСТОРИЯ (без изменений) =====
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
    document.getElementById('historyList').innerHTML = '<span class="history-placeholder">Ошибка загрузки</span>';
  }
}

// ===== АВТОРИЗАЦИЯ (без изменений) =====
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

// ===== ИНИЦИАЛИЗАЦИЯ =====
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
updateChanceDisplay();