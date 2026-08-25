let currentUser = null;
let battleId = null;

function showTab(tabId) {
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if (tabId === 'profile') loadProfile();
  if (tabId === 'inventory') loadInventory();
  if (tabId === 'upgrade') loadUpgrade();
  if (tabId === 'top') loadTop();
}

function login() {
  const nick = document.getElementById('nick').value;
  const pass = document.getElementById('pass').value;
  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: nick, password: pass })
  })
  .then(res => res.json())
  .then(user => {
    if (user.error) return alert(user.error);
    currentUser = user;
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('gameSection').style.display = 'block';
    loadProfile();
    loadInventory();
    loadTop();
  })
  .catch(err => alert('Ошибка: ' + err));
}

function register() {
  const nick = document.getElementById('nick').value;
  const pass = document.getElementById('pass').value;
  fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: nick, password: pass })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) alert(data.error);
    else alert('Регистрация успешна, теперь войдите');
  });
}

function loadProfile() {
  fetch('/api/profile')
    .then(res => res.json())
    .then(user => {
      document.getElementById('profileInfo').innerHTML = `
        <p>Ник: ${user.nickname}</p>
        <p>Уровень: ${user.level}</p>
        <p>Монеты: ${user.coins}</p>
        <p>Опыт: ${user.exp}/100</p>
        <p>HP: ${user.current_hp}/${user.max_hp}</p>
      `;
    });
}

function loadInventory() {
  fetch('/api/inventory')
    .then(res => res.json())
    .then(items => {
      let html = items.map(item => `
        <div class="item">
          ${item.name} (${item.rarity}) | Ур.${item.upgrade_level} | Атака:${item.damage} | Защита:${item.armor} | Слот: ${item.slot}
          ${item.equipped ? '✅ Экипировано' : ''}
          <button onclick="equipItem(${item.id})">Экипировать</button>
        </div>
      `).join('');
      document.getElementById('inventoryList').innerHTML = html || 'Пусто';
    });
}

function loadUpgrade() {
  fetch('/api/inventory')
    .then(res => res.json())
    .then(items => {
      let html = items.map(item => `
        <div class="item">
          ${item.name} (Ур.${item.upgrade_level})
          <button onclick="upgradeItem(${item.id})">Апгрейд (50%)</button>
        </div>
      `).join('');
      document.getElementById('upgradeList').innerHTML = html || 'Нет предметов для апгрейда';
    });
}

function equipItem(invId) {
  fetch('/api/equip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invId })
  })
  .then(() => loadInventory());
}

function upgradeItem(invId) {
  fetch('/api/upgrade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invId })
  })
  .then(res => res.json())
  .then(data => {
    alert(data.message);
    loadUpgrade();
    loadInventory();
  });
}

function createBattle() {
  const opponent = document.getElementById('opponentNick').value;
  if (!opponent) return alert('Введите ник противника');
  fetch('/api/battle/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opponentNick: opponent })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) return alert(data.error);
    battleId = data.battleId;
    document.getElementById('actionBtn').style.display = 'block';
    checkBattleStatus();
  });
}

function checkBattleStatus() {
  if (!battleId) return;
  fetch(`/api/battle/status/${battleId}`)
    .then(res => res.json())
    .then(battle => {
      if (battle.status === 'finished') {
        document.getElementById('battleStatus').innerHTML = 'Бой завершён!';
        document.getElementById('actionBtn').style.display = 'none';
        return;
      }
      document.getElementById('battleStatus').innerHTML = `
        HP1: ${battle.hp1}, HP2: ${battle.hp2}<br>
        Ход: ${battle.turn === currentUser.id ? 'Ваш' : 'Противника'}
      `;
    });
}

function makeAction() {
  if (!battleId) return;
  fetch('/api/battle/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ battleId })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) return alert(data.error);
    alert(data.message || 'Ход сделан');
    checkBattleStatus();
    loadProfile();
  });
}

function loadTop() {
  fetch('/api/top')
    .then(res => res.json())
    .then(players => {
      let html = players.map((p, i) => `<li>${i+1}. ${p.nickname} (ур.${p.level})</li>`).join('');
      document.getElementById('topList').innerHTML = `<ul>${html}</ul>`;
    });
}

function logout() {
  fetch('/api/logout', { method: 'POST' })
    .then(() => {
      document.getElementById('loginSection').style.display = 'block';
      document.getElementById('gameSection').style.display = 'none';
      currentUser = null;
    });
}

// Автоматическое обновление статуса боя каждые 3 секунды
setInterval(() => {
  if (battleId) checkBattleStatus();
}, 3000);

// При загрузке страницы проверяем сессию (для простоты просто показываем форму)