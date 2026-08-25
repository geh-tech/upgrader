let currentUser = null;

function login() {
    const nick = document.getElementById('nick').value;
    const pass = document.getElementById('pass').value;
    fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({nickname: nick, password: pass})
    })
    .then(res => {
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    })
    .then(user => {
        currentUser = user;
        document.getElementById('login').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        loadProfile();
        loadInventory();
        loadTop();
    })
    .catch(err => alert('Ошибка входа: ' + err.message));
}

function register() {
    const nick = document.getElementById('nick').value;
    const pass = document.getElementById('pass').value;
    fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({nickname: nick, password: pass})
    })
    .then(res => {
        if (res.ok) alert('Регистрация успешна, теперь войдите');
        else alert('Пользователь уже существует');
    });
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
    if (tabId === 'profile') loadProfile();
    if (tabId === 'inventory') loadInventory();
    if (tabId === 'top') loadTop();
}

function loadProfile() {
    fetch('/api/profile')
        .then(res => res.json())
        .then(user => {
            document.getElementById('profileInfo').innerHTML =
                `<p>Ник: ${user.nickname}</p>
                 <p>Уровень: ${user.level}</p>
                 <p>Монеты: ${user.coins}</p>
                 <p>Опыт: ${user.exp}/100</p>
                 <p>HP: ${user.currentHp}/${user.maxHp}</p>`;
        })
        .catch(() => alert('Ошибка загрузки профиля'));
}

function loadInventory() {
    fetch('/api/inventory')
        .then(res => res.json())
        .then(items => {
            let html = '';
            // Группируем по слотам для удобства
            const slots = {};
            items.forEach(item => {
                fetch(`/api/item/${item.itemId}`)  // нет такого эндпоинта, упростим
                    .then(r => r.json())
                    .then(itemData => {
                        const slot = itemData.slot || 'unknown';
                        if (!slots[slot]) slots[slot] = [];
                        slots[slot].push({...item, name: itemData.name});
                    });
            });
            // Отобразим после загрузки (используем Promise.all)
            // Для простоты выведем просто id
            html = items.map(item => 
                `<div class="item">ID: ${item.id}, ItemId: ${item.itemId}, Уровень: ${item.upgradeLevel}, Экипировано: ${item.equipped ? 'Да' : 'Нет'}
                    <button onclick="equip(${item.id})">Экипировать</button>
                    <button onclick="upgrade(${item.id})">Апгрейд (50%)</button>
                </div>`
            ).join('');
            document.getElementById('inventoryList').innerHTML = html;
        });
}

function equip(invId) {
    fetch(`/api/equip?invId=${invId}`, {method:'POST'})
        .then(() => loadInventory());
}

function upgrade(invId) {
    const chance = 50;
    fetch(`/api/upgrade?invId=${invId}&chance=${chance}`, {method:'POST'})
        .then(res => res.text())
        .then(msg => {
            alert(msg === 'Success' ? 'Апгрейд успешен!' : 'Предмет уничтожен!');
            loadInventory();
        });
}

function loadTop() {
    fetch('/api/top')
        .then(res => res.json())
        .then(players => {
            let html = '<ul>';
            players.forEach((p, i) => html += `<li>${i+1}. ${p.nickname} - уровень ${p.level}</li>`);
            html += '</ul>';
            document.getElementById('topList').innerHTML = html;
        });
}

function logout() {
    fetch('/api/logout', {method:'POST'}).then(() => {
        document.getElementById('login').style.display = 'block';
        document.getElementById('game').style.display = 'none';
        currentUser = null;
    });
}

// Для боя (упрощённо) добавим форму создания боя с оппонентом
// Не реализовано полноценно, можно доработать