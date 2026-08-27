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
  secret: 'dice_of_kalma_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ===== БАЗА ДАННЫХ =====
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  // Пользователи
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  // Прогресс игрока (уровень, лимит, инвентарь)
  db.run(`CREATE TABLE IF NOT EXISTS player_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    level INTEGER DEFAULT 1,
    limit_score INTEGER DEFAULT 100,
    inventory TEXT DEFAULT '[]', -- JSON массив предметов
    FOREIGN KEY(user_id) REFERENCES users(id)
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

function getPlayerData(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM player_data WHERE user_id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function createPlayerData(userId) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO player_data (user_id, level, limit_score, inventory) VALUES (?, 1, 100, ?)',
      [userId, JSON.stringify([])],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// ===== API =====

// Получить текущего пользователя
app.get('/user', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const data = await getPlayerData(user.id);
  res.json({
    username: user.username,
    level: data ? data.level : 1,
    limit_score: data ? data.limit_score : 100,
    inventory: data ? JSON.parse(data.inventory) : []
  });
});

// Регистрация
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], async function(err) {
      if (err) return res.status(400).json({ error: 'Пользователь уже существует' });
      await createPlayerData(this.lastID);
      res.json({ success: true });
    });
  } catch (e) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход
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

// Выход
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Обновить прогресс (после победы/поражения)
app.post('/update-progress', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { level, limit_score, inventory } = req.body;
  db.run(
    'UPDATE player_data SET level = ?, limit_score = ?, inventory = ? WHERE user_id = ?',
    [level, limit_score, JSON.stringify(inventory), user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json({ success: true });
    }
  );
});

// Добавить предмет в инвентарь (при победе)
app.post('/add-item', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { name, price } = req.body;
  if (!name) return res.status(400).json({ error: 'Введите название' });

  const data = await getPlayerData(user.id);
  const inventory = data ? JSON.parse(data.inventory) : [];
  inventory.push({ name, price: price || 100, level: 1 });

  db.run(
    'UPDATE player_data SET inventory = ? WHERE user_id = ?',
    [JSON.stringify(inventory), user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json({ success: true });
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://0.0.0.0:${PORT}`);
});