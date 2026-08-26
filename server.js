const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.use(session({
  secret: 'casino_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ===== БАЗА ДАННЫХ =====
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    price INTEGER,
    rarity INTEGER,
    level INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS item_pool (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    base_price INTEGER,
    rarity INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS upgrade_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    item_name TEXT,
    old_level INTEGER,
    new_level INTEGER,
    win BOOLEAN,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getUser(req) {
  return new Promise((resolve, reject) => {
    if (!req.session.userId) return resolve(null);
    db.get('SELECT id, username FROM users WHERE id = ?', [req.session.userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getInventory(userId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM inventory WHERE user_id = ?', [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getLatestHistory(limit = 20) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM upgrade_history ORDER BY timestamp DESC LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

// ===== ГЕНЕРАЦИЯ ПУЛА ПРЕДМЕТОВ =====
function generateItemPool() {
  const prefixes = ['Тенистый', 'Лунный', 'Огненный', 'Ледяной', 'Кровавый', 'Золотой', 'Древний', 'Космический', 'Призрачный', 'Божественный'];
  const suffixes = ['Клинок', 'Щит', 'Амулет', 'Кольцо', 'Посох', 'Меч', 'Лук', 'Кинжал', 'Топор', 'Молот'];
  const items = [];
  for (let i = 0; i < 200; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const name = `${prefix} ${suffix}`;
    const rarity = Math.floor(Math.random() * 1000) + 1;
    const base_price = Math.floor(rarity * 1.5 + Math.random() * 100);
    items.push({ name, base_price, rarity });
  }
  // Убираем дубликаты по имени
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    if (!seen.has(item.name)) {
      seen.add(item.name);
      unique.push(item);
    }
  }
  db.run('DELETE FROM item_pool', (err) => {
    if (err) console.error('Ошибка очистки item_pool:', err);
    const stmt = db.prepare('INSERT INTO item_pool (name, base_price, rarity) VALUES (?, ?, ?)');
    for (const item of unique) {
      stmt.run(item.name, item.base_price, item.rarity);
    }
    stmt.finalize();
    console.log(`✅ Сгенерировано ${unique.length} предметов в пуле`);
  });
}

// Заполняем пул при старте, если пуст
db.get('SELECT COUNT(*) as count FROM item_pool', (err, row) => {
  if (err) console.error(err);
  else if (row.count === 0) {
    generateItemPool();
  }
});

// ===== API =====
app.get('/user', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  res.json({ username: user.username });
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
      if (err) return res.status(400).json({ error: 'Пользователь уже существует' });
      // Выдаём 3 случайных предмета
      db.all('SELECT * FROM item_pool ORDER BY RANDOM() LIMIT 3', (err2, items) => {
        if (!err2 && items) {
          const stmt = db.prepare('INSERT INTO inventory (user_id, name, price, rarity, level) VALUES (?, ?, ?, ?, ?)');
          for (const item of items) {
            stmt.run(this.lastID, item.name, item.base_price, item.rarity, 1);
          }
          stmt.finalize();
        }
        res.json({ success: true });
      });
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Неверный логин или пароль' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Неверный логин или пароль' });
    req.session.userId = user.id;
    res.json({ success: true, username: user.username });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/inventory', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const items = await getInventory(user.id);
  res.json(items);
});

app.get('/history', async (req, res) => {
  const history = await getLatestHistory(20);
  res.json(history);
});

app.post('/add-item', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { name, price, rarity } = req.body;
  if (!name) return res.status(400).json({ error: 'Введите название' });
  db.run('INSERT INTO inventory (user_id, name, price, rarity, level) VALUES (?, ?, ?, ?, 1)',
    [user.id, name, price || 100, rarity || 500],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json({ success: true, id: this.lastID });
    });
});

app.post('/delete-item', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { itemId } = req.body;
  db.run('DELETE FROM inventory WHERE id = ? AND user_id = ?', [itemId, user.id], function(err) {
    if (err) return res.status(500).json({ error: 'Ошибка БД' });
    res.json({ success: true });
  });
});

app.post('/force-upgrade', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { itemId, newLevel } = req.body;
  if (!itemId || !newLevel) return res.status(400).json({ error: 'Некорректные данные' });

  const item = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [itemId, user.id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  if (!item) return res.status(404).json({ error: 'Предмет не найден' });

  const oldLevel = item.level;
  await new Promise((resolve, reject) => {
    db.run('UPDATE inventory SET level = ? WHERE id = ?', [newLevel, itemId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  db.run(
    'INSERT INTO upgrade_history (username, item_name, old_level, new_level, win) VALUES (?, ?, ?, ?, ?)',
    [user.username, item.name, oldLevel, newLevel, 1]
  );
  res.json({ success: true });
});

app.post('/record-lose', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'Некорректные данные' });

  const item = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [itemId, user.id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  if (!item) return res.status(404).json({ error: 'Предмет не найден' });

  db.run(
    'INSERT INTO upgrade_history (username, item_name, old_level, new_level, win) VALUES (?, ?, ?, ?, ?)',
    [user.username, item.name, item.level, item.level, 0]
  );
  res.json({ success: true });
});

app.get('/random-items', async (req, res) => {
  const count = parseInt(req.query.count) || 5;
  db.all('SELECT * FROM item_pool ORDER BY RANDOM() LIMIT ?', [count], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Ошибка БД' });
    res.json(rows);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://0.0.0.0:${PORT}`);
});