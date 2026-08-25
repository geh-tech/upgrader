const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

console.log('PORT из окружения:', process.env.PORT);
console.log('Реальный порт для listen:', PORT);

// ===== ЛОГИРОВАНИЕ ВСЕХ ЗАПРОСОВ =====
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ===== ОБРАБОТЧИКИ НЕОБРАБОТАННЫХ ОШИБОК =====
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

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
  cookie: { secure: false }
}));

// ===== ТЕСТОВЫЕ МАРШРУТЫ =====
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/health', (req, res) => {
  res.send('OK');
});

// ===== ОСНОВНОЙ МАРШРУТ =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Ошибка отправки index.html:', err);
      res.status(500).send('Ошибка загрузки страницы');
    }
  });
});

// ===== API (все маршруты, которые были ранее) =====
// ... здесь должны быть все ваши /api/... маршруты (регистрация, логин, инвентарь, бой и т.д.)
// Я сократил для краткости, но вы должны скопировать их из предыдущего кода.
// Вставьте сюда все ваши существующие маршруты API без изменений.

// ===== ЧАСОВАЯ НАГРАДА ТОПАМ =====
setInterval(() => {
  db.all('SELECT id FROM users ORDER BY level DESC, exp DESC LIMIT 10', (err, rows) => {
    rows.forEach(row => {
      const item = generateItem('weapon1');
      addItem(row.id, item, () => {
        console.log('Награда выдана игроку', row.id);
      });
    });
  });
}, 3600000);

// ===== ЗАПУСК =====
app.listen(PORT, HOST, () => {
  console.log(`Сервер запущен на http://${HOST}:${PORT}`);
});