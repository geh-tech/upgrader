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

const db = new sqlite3.Database('./database.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS player_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    level INTEGER DEFAULT 1,
    limit_score INTEGER DEFAULT 50,
    inventory TEXT DEFAULT '[]',
    hand_upgrades TEXT DEFAULT '{}',
    passive_bonuses TEXT DEFAULT '{}',
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

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
      'INSERT INTO player_data (user_id, level, limit_score, inventory, hand_upgrades, passive_bonuses) VALUES (?, 1, 50, ?, ?, ?)',
      [userId, JSON.stringify([]), JSON.stringify({}), JSON.stringify({})],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

app.get('/user', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const data = await getPlayerData(user.id);
  res.json({
    username: user.username,
    level: data ? data.level : 1,
    limit_score: data ? data.limit_score : 50,
    inventory: data ? JSON.parse(data.inventory) : [],
    hand_upgrades: data ? JSON.parse(data.hand_upgrades) : {},
    passive_bonuses: data ? JSON.parse(data.passive_bonuses) : {}
  });
});

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

app.post('/update-progress', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { level, limit_score, inventory, hand_upgrades, passive_bonuses } = req.body;
  db.run(
    `UPDATE player_data 
     SET level = ?, limit_score = ?, inventory = ?, hand_upgrades = ?, passive_bonuses = ? 
     WHERE user_id = ?`,
    [level, limit_score, JSON.stringify(inventory), JSON.stringify(hand_upgrades || {}), JSON.stringify(passive_bonuses || {}), user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json({ success: true });
    }
  );
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://0.0.0.0:${PORT}`);
});