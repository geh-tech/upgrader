// Клиентская логика

let currentUser = null;
let currentItems = [];
let selectedItemId = null;
let selectedChance = null;

// Загрузка инвентаря
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

// Отрисовка инвентаря
function renderInventory(items) {
  const container = document.getElementById('inventoryContainer');
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-msg">У вас пока нет предметов. Добавьте свой первый!</div>';
    return;
  }
  let html = '<div class="inventory">';
  items.forEach(item => {
    html += `
      <div class="item-card" data-id="${item.id}">
        <span class="name">${escapeHtml(item.name)}</span>
        <span class="level">Уровень ${item.level}</span>
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

// Добавление предмета
async function addItem() {
  const name = document.getElementById('itemName').value.trim();
  const level = document.getElementById('itemLevel').value.trim();
  if (!name || !level) {
    showMessage('Введите название и уровень', 'error');
    return;
  }
  try {
    const res = await fetch('/add-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, level: parseInt(level) })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('itemName').value = '';
      document.getElementById('itemLevel').value = '1';
      showMessage('Предмет добавлен!', 'success');
      loadInventory();
    } else {
      showMessage(data.error || 'Ошибка', 'error');
    }
  } catch (e) {
    showMessage('Ошибка соединения', 'error');
  }
}

// Удаление предмета
async function deleteItem(id) {
  if (!confirm('Удалить предмет?')) return;
  try {
    const res = await fetch('/delete-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: id })
    });
    const data = await res.json();
    if (data.success) {
      loadInventory();
    } else {
      showMessage('Ошибка удаления', 'error');
    }
  } catch (e) {
    showMessage('Ошибка соединения', 'error');
  }
}

// Открыть модалку апгрейда
function openUpgrade(id) {
  selectedItemId = id;
  const item = currentItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('modalItemName').textContent = item.name;
  document.getElementById('modalCurrentLevel').textContent = item.level;
  document.getElementById('modalResult').textContent = '';
  document.getElementById('upgradeBtn').disabled = false;
  selectedChance = null;
  document.querySelectorAll('.chance-buttons button').forEach(b => b.classList.remove('selected'));
  document.getElementById('chanceInfo').textContent = 'Выбери шанс';
  document.getElementById('upgradeModal').classList.add('active');
}

// Выбор шанса
function selectChance(chance) {
  selectedChance = chance;
  document.querySelectorAll('.chance-buttons button').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.chance-buttons button').forEach(b => {
    if (parseInt(b.textContent) === chance) b.classList.add('selected');
  });
  let bonus = chance === 50 ? 1 : chance === 30 ? 2 : 5;
  document.getElementById('chanceInfo').textContent = `При успехе: +${bonus} уровень`;
}

// Подтверждение апгрейда
async function confirmUpgrade() {
  if (!selectedChance) {
    document.getElementById('modalResult').textContent = '⚠️ Выбери шанс!';
    return;
  }
  const btn = document.getElementById('upgradeBtn');
  btn.disabled = true;
  document.getElementById('modalResult').textContent = '🎲 Крутим...';

  try {
    const res = await fetch('/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: selectedItemId, chance: selectedChance })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('modalResult').textContent = data.message;
      if (data.result === 'win') {
        const item = currentItems.find(i => i.id === selectedItemId);
        if (item) item.level = data.newLevel;
        renderInventory(currentItems);
      } else {
        loadInventory();
      }
    } else {
      document.getElementById('modalResult').textContent = '❌ ' + (data.error || 'Ошибка');
    }
  } catch (e) {
    document.getElementById('modalResult').textContent = '❌ Ошибка соединения';
  }
  btn.disabled = false;
}

// Закрыть модалку
function closeModal() {
  document.getElementById('upgradeModal').classList.remove('active');
  selectedItemId = null;
  selectedChance = null;
}

// Авторизация
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

// Вспомогательные
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

// Проверка сессии при загрузке
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
      }
    }
  } catch (e) {}
}
fetchUser();