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
    password TEXT,
    balance INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    level INTEGER,
    price INTEGER,
    rarity TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Таблица для логов апгрейдов (последние события)
  db.run(`CREATE TABLE IF NOT EXISTS upgrade_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    item_name TEXT,
    old_level INTEGER,
    new_level INTEGER,
    success BOOLEAN,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// ========== Вспомогательные функции ==========

function getUser(req) {
  return new Promise((resolve, reject) => {
    if (!req.session.userId) return resolve(null);
    db.get('SELECT id, username, balance FROM users WHERE id = ?', [req.session.userId], (err, row) => {
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

// Генерация предмета (название, уровень, цена, редкость)
const prefixes = ['Тенистый', 'Пламенный', 'Ледяной', 'Тёмный', 'Светлый', 'Древний', 'Божественный', 'Демонический', 'Космический', 'Звёздный', 'Лунный', 'Солнечный', 'Титановый', 'Радужный', 'Неоновый', 'Ржавый', 'Золотой', 'Серебряный', 'Бронзовый', 'Мифический', 'Легендарный', 'Эпический', 'Редкий', 'Необычный', 'Обычный', 'Базовый'];
const suffixes = ['Клинок', 'Доспех', 'Шлем', 'Амулет', 'Кольцо', 'Посох', 'Меч', 'Щит', 'Лук', 'Арбалет', 'Кинжал', 'Топор', 'Молот', 'Копьё', 'Чешуя', 'Кристалл', 'Руна', 'Глаз', 'Сердце', 'Печать', 'Скипетр', 'Жезл', 'Корона', 'Плащ', 'Крыло'];

function generateItem() {
  // Уровень 1-100, цена = уровень * 10 + случайный бонус
  const level = Math.floor(Math.random() * 100) + 1;
  const price = level * 10 + Math.floor(Math.random() * 50);
  // Редкость на основе уровня
  let rarity = '';
  if (level >= 90) rarity = 'Вселенский';
  else if (level >= 70) rarity = 'Мифический';
  else if (level >= 50) rarity = 'Легендарный';
  else if (level >= 30) rarity = 'Эпический';
  else if (level >= 15) rarity = 'Редкий';
  else if (level >= 5) rarity = 'Необычный';
  else rarity = 'Обычный';

  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  const name = prefix + ' ' + suffix;
  return { name, level, price, rarity };
}

// Получить последние логи апгрейдов (для онлайн-ленты)
function getRecentUpgrades(limit = 5) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT u.username, l.item_name, l.old_level, l.new_level, l.success, l.timestamp
      FROM upgrade_logs l
      JOIN users u ON l.user_id = u.id
      ORDER BY l.timestamp DESC
      LIMIT ?
    `, [limit], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ========== API ==========

// Получить текущего пользователя
app.get('/user', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  res.json({ username: user.username, balance: user.balance });
});

// Регистрация
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

// Вход
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Неверный логин или пароль' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Неверный логин или пароль' });
    req.session.userId = user.id;
    res.json({ success: true, username: user.username, balance: user.balance });
  });
});

// Выход
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Инвентарь
app.get('/inventory', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const items = await getInventory(user.id);
  res.json(items);
});

// Добавить предмет (можно использовать для получения случайного)
app.post('/add-item', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  let { name, level, price, rarity } = req.body;
  // Если не переданы, генерируем случайный
  if (!name) {
    const gen = generateItem();
    name = gen.name;
    level = gen.level;
    price = gen.price;
    rarity = gen.rarity;
  } else {
    level = parseInt(level) || 1;
    price = parseInt(price) || level * 10;
    rarity = rarity || 'Обычный';
  }
  db.run('INSERT INTO inventory (user_id, name, level, price, rarity) VALUES (?, ?, ?, ?, ?)',
    [user.id, name, level, price, rarity], function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json({ success: true, id: this.lastID });
    });
});

// Удалить предмет (продать или потерять)
app.post('/delete-item', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { itemId } = req.body;
  db.run('DELETE FROM inventory WHERE id = ? AND user_id = ?', [itemId, user.id], function(err) {
    if (err) return res.status(500).json({ error: 'Ошибка БД' });
    res.json({ success: true });
  });
});

// Получить случайный предмет (генерируется на сервере)
app.get('/generate-item', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const item = generateItem();
  // Можно сразу добавить в инвентарь или вернуть данные — пока вернём данные, а клиент сам добавит
  res.json(item);
});

// Апгрейд с принудительным результатом (используем для клиентской анимации)
app.post('/force-upgrade', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { itemId, newLevel, success } = req.body;
  if (!itemId || newLevel === undefined) return res.status(400).json({ error: 'Некорректные данные' });

  // Получаем предмет
  const item = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM inventory WHERE id = ? AND user_id = ?', [itemId, user.id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  if (!item) return res.status(404).json({ error: 'Предмет не найден' });

  // Обновляем уровень
  await new Promise((resolve, reject) => {
    db.run('UPDATE inventory SET level = ? WHERE id = ?', [newLevel, itemId], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Логируем апгрейд
  db.run('INSERT INTO upgrade_logs (user_id, item_name, old_level, new_level, success) VALUES (?, ?, ?, ?, ?)',
    [user.id, item.name, item.level, newLevel, success ? 1 : 0]);

  res.json({ success: true });
});

// Получить последние апгрейды (для ленты)
app.get('/recent-upgrades', async (req, res) => {
  const logs = await getRecentUpgrades(10);
  res.json(logs);
});

// Запуск
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://0.0.0.0:${PORT}`);
});