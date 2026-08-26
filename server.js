const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.use(session({
  secret: 'casino_secret_key_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// База данных
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
    level INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// Вспомогательные функции
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

// API
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
      res.json({ success: true });
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

app.post('/add-item', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { name, level } = req.body;
  if (!name || !level) return res.status(400).json({ error: 'Введите название и уровень' });
  const lvl = parseInt(level);
  if (isNaN(lvl) || lvl < 1) return res.status(400).json({ error: 'Уровень должен быть числом >= 1' });
  db.run('INSERT INTO inventory (user_id, name, level) VALUES (?, ?, ?)', [user.id, name, lvl], function(err) {
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

app.post('/upgrade', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { itemId, chance } = req.body;
  if (!itemId || !chance) return res.status(400).json({ error: 'Некорректные данные' });

  const item = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [itemId, user.id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  if (!item) return res.status(404).json({ error: 'Предмет не найден' });

  const chanceNum = parseInt(chance);
  if (![10, 30, 50].includes(chanceNum)) return res.status(400).json({ error: 'Недопустимый шанс' });

  let bonus = 0;
  if (chanceNum === 50) bonus = 1;
  else if (chanceNum === 30) bonus = 2;
  else if (chanceNum === 10) bonus = 5;

  const roll = Math.floor(Math.random() * 100) + 1;
  const success = roll <= chanceNum;

  let newLevel = item.level;
  if (success) {
    newLevel += bonus;
    await new Promise((resolve, reject) => {
      db.run('UPDATE inventory SET level = ? WHERE id = ?', [newLevel, item.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    res.json({ success: true, result: 'win', newLevel, message: `🎉 Успех! Уровень +${bonus} (теперь ${newLevel})` });
  } else {
    await new Promise((resolve, reject) => {
      db.run('DELETE FROM inventory WHERE id = ?', [item.id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    res.json({ success: true, result: 'lose', message: '💀 Не повезло... Предмет сгорел!' });
  }
});

// ====== ГЛАВНОЕ ИСПРАВЛЕНИЕ: слушаем 0.0.0.0 ======
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://0.0.0.0:${PORT}`);
});