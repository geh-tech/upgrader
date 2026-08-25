const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// ===== БАЗА ДАННЫХ =====
const db = new sqlite3.Database('database.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT UNIQUE,
    password TEXT,
    level INTEGER DEFAULT 1,
    coins INTEGER DEFAULT 0,
    exp INTEGER DEFAULT 0,
    max_hp INTEGER DEFAULT 100,
    current_hp INTEGER DEFAULT 100
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    slot TEXT,
    armor INTEGER,
    damage INTEGER,
    rarity TEXT,
    upgrade_level INTEGER DEFAULT 0,
    equipped BOOLEAN DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS battles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER,
    player2_id INTEGER,
    status TEXT,
    turn INTEGER,
    hp1 INTEGER,
    hp2 INTEGER,
    FOREIGN KEY(player1_id) REFERENCES users(id),
    FOREIGN KEY(player2_id) REFERENCES users(id)
  )`);
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function generateItem(slot) {
  const rarities = [
    { name: 'Обычный', armor: 1, damage: 1, weight: 10 },
    { name: 'Необычный', armor: 3, damage: 3, weight: 5 },
    { name: 'Редкий', armor: 6, damage: 6, weight: 2 },
    { name: 'Эпический', armor: 10, damage: 10, weight: 1 },
    { name: 'Легендарный', armor: 15, damage: 15, weight: 0.5 },
  ];
  // Выбор редкости с весом
  let totalWeight = rarities.reduce((sum, r) => sum + r.weight, 0);
  let rand = Math.random() * totalWeight;
  let rarity = rarities[0];
  for (let r of rarities) {
    if (rand < r.weight) { rarity = r; break; }
    rand -= r.weight;
  }

  const names = {
    head: ['Шлем', 'Капюшон', 'Корона'],
    neck: ['Амулет', 'Ожерелье', 'Кулон'],
    body: ['Нагрудник', 'Броня', 'Куртка'],
    legs: ['Поножи', 'Штаны', 'Наколенники'],
    arms: ['Наручи', 'Перчатки', 'Браслеты'],
    gloves: ['Перчатки', 'Рукавицы'],
    boots: ['Сапоги', 'Ботинки', 'Кеды'],
    weapon1: ['Меч', 'Топор', 'Кинжал'],
    weapon2: ['Лук', 'Арбалет', 'Пистолет'],
    weapon3: ['Посох', 'Копьё', 'Цепь'],
  };
  const prefixes = ['Стальной', 'Кожаный', 'Железный', 'Мифриловый', 'Зачарованный', 'Тёмный', 'Светлый'];
  const name = prefixes[Math.floor(Math.random() * prefixes.length)] + ' ' +
    (names[slot] ? names[slot][Math.floor(Math.random() * names[slot].length)] : 'Предмет');

  return {
    name,
    slot,
    armor: Math.floor(Math.random() * rarity.armor) + 1,
    damage: Math.floor(Math.random() * rarity.damage) + 1,
    rarity: rarity.name,
    upgrade_level: 0
  };
}

function getUserById(id, cb) {
  db.get('SELECT * FROM users WHERE id = ?', [id], cb);
}

function getUserByNick(nick, cb) {
  db.get('SELECT * FROM users WHERE nickname = ?', [nick], cb);
}

function getInventory(userId, cb) {
  db.all('SELECT * FROM inventory WHERE user_id = ?', [userId], cb);
}

function getEquipped(userId, cb) {
  db.all('SELECT * FROM inventory WHERE user_id = ? AND equipped = 1', [userId], cb);
}

function addItem(userId, item, cb) {
  db.run(`INSERT INTO inventory (user_id, name, slot, armor, damage, rarity, upgrade_level, equipped)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [userId, item.name, item.slot, item.armor, item.damage, item.rarity, item.upgrade_level], cb);
}

function deleteItem(id, cb) {
  db.run('DELETE FROM inventory WHERE id = ?', [id], cb);
}

function updateEquipped(id, eq, cb) {
  db.run('UPDATE inventory SET equipped = ? WHERE id = ?', [eq ? 1 : 0, id], cb);
}

function upgradeItem(id, cb) {
  db.run('UPDATE inventory SET upgrade_level = upgrade_level + 1, armor = armor + 1, damage = damage + 1 WHERE id = ?', [id], cb);
}

function updateUser(user, cb) {
  db.run(`UPDATE users SET level=?, coins=?, exp=?, max_hp=?, current_hp=? WHERE id=?`,
    [user.level, user.coins, user.exp, user.max_hp, user.current_hp, user.id], cb);
}

// ===== МИДЛВЭРЫ =====
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'upgrader-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // на Railway https, но для локального теста false
}));

// ===== API =====

// Регистрация
app.post('/api/register', (req, res) => {
  const { nickname, password } = req.body;
  if (!nickname || !password) return res.status(400).json({ error: 'Все поля обязательны' });
  getUserByNick(nickname, (err, user) => {
    if (user) return res.status(400).json({ error: 'Ник занят' });
    db.run(`INSERT INTO users (nickname, password) VALUES (?, ?)`, [nickname, password], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      // Даём стартовый предмет
      const item = generateItem('weapon1');
      addItem(this.lastID, item, () => {});
      res.json({ success: true });
    });
  });
});

// Логин
app.post('/api/login', (req, res) => {
  const { nickname, password } = req.body;
  getUserByNick(nickname, (err, user) => {
    if (!user || user.password !== password) return res.status(401).json({ error: 'Неверные данные' });
    req.session.userId = user.id;
    res.json({ id: user.id, nickname: user.nickname, level: user.level, coins: user.coins, exp: user.exp, maxHp: user.max_hp, currentHp: user.current_hp });
  });
});

// Профиль
app.get('/api/profile', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  getUserById(req.session.userId, (err, user) => {
    res.json(user);
  });
});

// Инвентарь
app.get('/api/inventory', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  getInventory(req.session.userId, (err, items) => {
    res.json(items);
  });
});

// Экипировка
app.post('/api/equip', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  const { invId } = req.body;
  // Сначала получаем предмет
  db.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [invId, req.session.userId], (err, item) => {
    if (!item) return res.status(404).json({ error: 'Предмет не найден' });
    // Снимаем все предметы в этом слоте
    db.all('SELECT id FROM inventory WHERE user_id = ? AND slot = ? AND equipped = 1', [req.session.userId, item.slot], (err, rows) => {
      let done = 0;
      if (rows.length === 0) return updateEquipped(invId, true, () => res.json({ success: true }));
      rows.forEach(r => {
        updateEquipped(r.id, false, () => {
          done++;
          if (done === rows.length) {
            updateEquipped(invId, true, () => res.json({ success: true }));
          }
        });
      });
    });
  });
});

// Апгрейд (шанс 50%)
app.post('/api/upgrade', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  const { invId } = req.body;
  db.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [invId, req.session.userId], (err, item) => {
    if (!item) return res.status(404).json({ error: 'Предмет не найден' });
    const success = Math.random() < 0.5;
    if (success) {
      upgradeItem(invId, () => res.json({ success: true, message: 'Апгрейд успешен!' }));
    } else {
      deleteItem(invId, () => res.json({ success: false, message: 'Предмет уничтожен!' }));
    }
  });
});

// Создать бой (1v1 с противником по нику)
app.post('/api/battle/create', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  const { opponentNick } = req.body;
  getUserByNick(opponentNick, (err, opponent) => {
    if (!opponent) return res.status(404).json({ error: 'Противник не найден' });
    if (opponent.id === req.session.userId) return res.status(400).json({ error: 'Нельзя с собой' });
    // Проверяем, есть ли уже активный бой
    db.get('SELECT * FROM battles WHERE status = "active" AND (player1_id = ? OR player2_id = ?)', [req.session.userId, req.session.userId], (err, battle) => {
      if (battle) return res.status(400).json({ error: 'У вас уже есть активный бой' });
      // Получаем HP
      getUserById(req.session.userId, (err, p1) => {
        getUserById(opponent.id, (err, p2) => {
          db.run(`INSERT INTO battles (player1_id, player2_id, status, turn, hp1, hp2) VALUES (?, ?, 'active', ?, ?, ?)`,
            [p1.id, p2.id, p1.id, p1.current_hp, p2.current_hp], function(err) {
              res.json({ battleId: this.lastID });
            });
        });
      });
    });
  });
});

// Ход в бою
app.post('/api/battle/action', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  const { battleId } = req.body;
  db.get('SELECT * FROM battles WHERE id = ?', [battleId], (err, battle) => {
    if (!battle || battle.status !== 'active') return res.status(404).json({ error: 'Бой не найден или завершён' });
    if (battle.turn !== req.session.userId) return res.status(400).json({ error: 'Не ваш ход' });
    // Определяем противника
    const opponentId = battle.player1_id === req.session.userId ? battle.player2_id : battle.player1_id;
    // Вычисляем урон
    let attackerDamage = 5;
    let targetArmor = 0;
    // Берём экипировку атакующего
    getEquipped(req.session.userId, (err, attItems) => {
      attItems.forEach(it => {
        if (it.slot.startsWith('weapon')) attackerDamage += it.damage * (1 + it.upgrade_level);
        // Броня с тела
        if (['head','neck','body','legs','arms','gloves','boots'].includes(it.slot)) targetArmor += it.armor * (1 + it.upgrade_level); // на самом деле броня цели, но для простоты используем у атакующего? Но нам нужна броня цели – переделаем
      });
      // Броня цели
      getEquipped(opponentId, (err, defItems) => {
        let armor = 0;
        defItems.forEach(it => {
          if (['head','neck','body','legs','arms','gloves','boots'].includes(it.slot)) armor += it.armor * (1 + it.upgrade_level);
        });
        const damage = Math.max(1, attackerDamage - armor / 2 + Math.floor(Math.random() * 10));
        // Обновляем HP цели
        let hpKey = battle.player1_id === opponentId ? 'hp1' : 'hp2';
        let newHp = battle[hpKey] - damage;
        if (newHp < 0) newHp = 0;
        // Обновляем БД
        db.run(`UPDATE battles SET ${hpKey} = ?, turn = ? WHERE id = ?`, [newHp, opponentId, battleId], (err) => {
          if (newHp === 0) {
            // Победитель – атакующий
            // Передаём экипировку
            getEquipped(opponentId, (err, items) => {
              let done = 0;
              if (items.length === 0) finishBattle();
              items.forEach(it => {
                // Добавляем победителю
                addItem(req.session.userId, { name: it.name, slot: it.slot, armor: it.armor, damage: it.damage, rarity: it.rarity, upgrade_level: it.upgrade_level }, () => {
                  deleteItem(it.id, () => {
                    done++;
                    if (done === items.length) finishBattle();
                  });
                });
              });
              function finishBattle() {
                // Награда: 10 монет, опыт
                getUserById(req.session.userId, (err, winner) => {
                  getUserById(opponentId, (err, loser) => {
                    winner.coins += 10;
                    winner.exp += 50;
                    while (winner.exp >= 100) {
                      winner.exp -= 100;
                      winner.level++;
                      winner.max_hp += 10;
                      winner.current_hp = winner.max_hp;
                    }
                    updateUser(winner, () => {
                      // Обновляем статус боя
                      db.run('UPDATE battles SET status = "finished" WHERE id = ?', [battleId], () => {
                        res.json({ winner: winner.nickname, reward: '10 монет, опыт' });
                      });
                    });
                  });
                });
              }
            });
          } else {
            res.json({ message: 'Ход сделан', hp: newHp });
          }
        });
      });
    });
  });
});

// Получить статус боя
app.get('/api/battle/status/:id', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
  const battleId = req.params.id;
  db.get('SELECT * FROM battles WHERE id = ?', [battleId], (err, battle) => {
    if (!battle) return res.status(404).json({ error: 'Бой не найден' });
    res.json(battle);
  });
});

// Топ игроков
app.get('/api/top', (req, res) => {
  db.all('SELECT nickname, level FROM users ORDER BY level DESC, exp DESC LIMIT 10', (err, rows) => {
    res.json(rows);
  });
});

// Логаут
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ===== ЧАСОВАЯ НАГРАДА ТОПАМ =====
setInterval(() => {
  db.all('SELECT id FROM users ORDER BY level DESC, exp DESC LIMIT 10', (err, rows) => {
    rows.forEach(row => {
      const item = generateItem('weapon1'); // любой слот
      addItem(row.id, item, () => {
        console.log('Награда выдана игроку', row.id);
      });
    });
  });
}, 3600000); // каждый час

// ===== ЗАПУСК =====
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});