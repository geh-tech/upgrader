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
    permanent_upgrades TEXT DEFAULT '[]',
    shop_progress TEXT DEFAULT '{}',
    coins INTEGER DEFAULT 0,
    last_visit DATE,
    tutorial_shown INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS player_stats (
    user_id INTEGER PRIMARY KEY,
    total_wins INTEGER DEFAULT 0,
    total_games INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    pair_count INTEGER DEFAULT 0,
    two_pair_count INTEGER DEFAULT 0,
    three_count INTEGER DEFAULT 0,
    straight_count INTEGER DEFAULT 0,
    full_house_count INTEGER DEFAULT 0,
    four_count INTEGER DEFAULT 0,
    five_count INTEGER DEFAULT 0,
    broken_straight_count INTEGER DEFAULT 0,
    poker_count INTEGER DEFAULT 0,
    royal_count INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS daily_quests (
    user_id INTEGER,
    quest_id INTEGER,
    progress INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    date DATE,
    PRIMARY KEY (user_id, quest_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    achievement_id TEXT,
    completed INTEGER DEFAULT 0,
    date DATE,
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
      'INSERT INTO player_data (user_id, level, limit_score, inventory, hand_upgrades, passive_bonuses, permanent_upgrades, shop_progress, coins, tutorial_shown) VALUES (?, 1, 50, ?, ?, ?, ?, ?, 0, 0)',
      [userId, JSON.stringify([]), JSON.stringify({}), JSON.stringify({}), JSON.stringify([]), JSON.stringify({})],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getStats(userId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM player_stats WHERE user_id = ?', [userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function initStats(userId) {
  return new Promise((resolve, reject) => {
    db.run('INSERT OR IGNORE INTO player_stats (user_id) VALUES (?)', [userId], function(err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ===== ГЕНЕРАЦИЯ УНИКАЛЬНЫХ ПРЕДМЕТОВ МАГАЗИНА (без дублей) =====
function generateShopItems() {
  const items = [];
  const handTypes = ['high', 'pair', 'twoPair', 'three', 'straight', 'fullHouse', 'four', 'five', 'brokenStraight', 'poker', 'royal'];
  const handNames = {
    high:'Старшая карта', pair:'Пара', twoPair:'Две пары', three:'Тройка',
    straight:'Стрит', fullHouse:'Фулл-хаус', four:'Каре', five:'Пять одинаковых',
    brokenStraight:'Ломаный стрит', poker:'Покер', royal:'Рояль'
  };
  // Только +1 для каждой руки (чтобы не было дублирования +1 и +2)
  for (const hand of handTypes) {
    items.push({
      id: `shop_hand_${hand}_1`,
      name: `Вечный +1 к ${handNames[hand]}`,
      desc: `Навсегда +1 множителя для ${handNames[hand]}`,
      type: 'hand',
      hand: hand,
      value: 1,
      basePrice: 5
    });
  }
  // Пассивные бонусы (разные значения)
  const passives = [
    { id: 'bones', name: 'Кости', values: [3, 5, 8, 10, 15] },
    { id: 'mult', name: 'Множитель', values: [1, 2] },
    { id: 'rerolls', name: 'Перебросы', values: [1, 2] },
    { id: 'hands', name: 'Руки', values: [1, 2] },
    { id: 'limit', name: 'Скидка лимита', values: [3, 5, 8, 10] },
    { id: 'extra_level', name: 'Бонус уровня', values: [1, 2] }
  ];
  for (const p of passives) {
    for (const val of p.values) {
      items.push({
        id: `shop_passive_${p.id}_${val}`,
        name: `Вечный +${val} ${p.name}`,
        desc: `Навсегда +${val} к ${p.name}`,
        type: 'passive',
        bonus: p.id,
        value: val,
        basePrice: 5
      });
    }
  }
  // Комбинированные (кости+множ) – разные варианты
  const combos = [
    { b: 2, m: 1 }, { b: 3, m: 2 }, { b: 5, m: 1 }, { b: 5, m: 2 },
    { b: 8, m: 1 }, { b: 8, m: 3 }, { b: 10, m: 2 }, { b: 12, m: 3 }
  ];
  for (let i = 0; i < combos.length; i++) {
    const c = combos[i];
    items.push({
      id: `shop_combo_${i}`,
      name: `Вечный +${c.b} кости +${c.m} множ`,
      desc: `Навсегда +${c.b} к костям и +${c.m} к множителю`,
      type: 'combo',
      bonus: 'combo_bones_mult',
      value: { bones: c.b, mult: c.m },
      basePrice: 5
    });
  }
  // Редкие усиления (большие значения)
  const rare = [
    { id: 'rare_hands_3', name: 'Вечные +3 руки', desc: 'Навсегда +3 руки за раунд', type: 'passive', bonus: 'extra_hands', value: 3 },
    { id: 'rare_hands_5', name: 'Вечные +5 рук', desc: 'Навсегда +5 рук за раунд', type: 'passive', bonus: 'extra_hands', value: 5 },
    { id: 'rare_rerolls_3', name: 'Вечные +3 переброса', desc: 'Навсегда +3 переброса за раунд', type: 'passive', bonus: 'rerolls', value: 3 },
    { id: 'rare_bones_20', name: 'Вечные +20 костей', desc: 'Навсегда +20 к костям', type: 'passive', bonus: 'bones', value: 20 },
    { id: 'rare_mult_3', name: 'Вечный +3 множитель', desc: 'Навсегда +3 к множителю', type: 'passive', bonus: 'mult', value: 3 },
    { id: 'rare_limit_15', name: 'Вечная скидка лимита -15', desc: 'Навсегда уменьшает стартовый лимит на 15', type: 'passive', bonus: 'limit', value: 15 },
    { id: 'rare_extra_level_3', name: 'Вечный +3 уровня при победе', desc: 'Навсегда +3 дополнительных уровня при победе', type: 'passive', bonus: 'extra_level', value: 3 }
  ];
  for (const r of rare) {
    items.push({ ...r, basePrice: 5 });
  }
  // Итого: 11 + (5+2+2+2+4+2) + 8 + 7 = 11 + 17 + 8 + 7 = 43 предмета, достаточно
  return items;
}

const SHOP_ITEMS = generateShopItems();
console.log(`✅ Сгенерировано ${SHOP_ITEMS.length} предметов магазина`);

// ===== ГЕНЕРАЦИЯ АЧИВОК (заданий) =====
function generateAchievements() {
  const types = [
    { id: 'win_3', desc: 'Выиграть 3 раунда', target: 3, reward: 10 },
    { id: 'win_5', desc: 'Выиграть 5 раундов', target: 5, reward: 20 },
    { id: 'win_10', desc: 'Выиграть 10 раундов', target: 10, reward: 30 },
    { id: 'win_20', desc: 'Выиграть 20 раундов', target: 20, reward: 50 },
    { id: 'win_50', desc: 'Выиграть 50 раундов', target: 50, reward: 100 },
    { id: 'win_100', desc: 'Выиграть 100 раундов', target: 100, reward: 200 },
    { id: 'streak_3', desc: 'Победить 3 раза подряд', target: 3, reward: 15 },
    { id: 'streak_5', desc: 'Победить 5 раз подряд', target: 5, reward: 25 },
    { id: 'streak_10', desc: 'Победить 10 раз подряд', target: 10, reward: 50 },
    { id: 'pair_5', desc: 'Выбросить пару 5 раз', target: 5, reward: 10 },
    { id: 'pair_10', desc: 'Выбросить пару 10 раз', target: 10, reward: 20 },
    { id: 'two_pair_3', desc: 'Выбросить две пары 3 раза', target: 3, reward: 15 },
    { id: 'two_pair_5', desc: 'Выбросить две пары 5 раз', target: 5, reward: 25 },
    { id: 'three_3', desc: 'Выбросить тройку 3 раза', target: 3, reward: 20 },
    { id: 'three_5', desc: 'Выбросить тройку 5 раз', target: 5, reward: 30 },
    { id: 'straight_2', desc: 'Выбросить стрит 2 раза', target: 2, reward: 20 },
    { id: 'straight_5', desc: 'Выбросить стрит 5 раз', target: 5, reward: 40 },
    { id: 'full_house_2', desc: 'Выбросить фулл-хаус 2 раза', target: 2, reward: 25 },
    { id: 'full_house_5', desc: 'Выбросить фулл-хаус 5 раз', target: 5, reward: 50 },
    { id: 'four_1', desc: 'Выбросить каре 1 раз', target: 1, reward: 30 },
    { id: 'four_3', desc: 'Выбросить каре 3 раза', target: 3, reward: 60 },
    { id: 'five_1', desc: 'Выбросить пять одинаковых 1 раз', target: 1, reward: 50 },
    { id: 'five_3', desc: 'Выбросить пять одинаковых 3 раза', target: 3, reward: 100 },
    { id: 'broken_straight_2', desc: 'Выбросить ломаный стрит 2 раза', target: 2, reward: 20 },
    { id: 'broken_straight_5', desc: 'Выбросить ломаный стрит 5 раз', target: 5, reward: 40 },
    { id: 'poker_2', desc: 'Выбросить покер 2 раза', target: 2, reward: 25 },
    { id: 'poker_5', desc: 'Выбросить покер 5 раз', target: 5, reward: 50 },
    { id: 'royal_1', desc: 'Выбросить рояль 1 раз', target: 1, reward: 40 },
    { id: 'royal_3', desc: 'Выбросить рояль 3 раза', target: 3, reward: 80 },
    { id: 'total_games_10', desc: 'Сыграть 10 раундов', target: 10, reward: 10 },
    { id: 'total_games_25', desc: 'Сыграть 25 раундов', target: 25, reward: 20 },
    { id: 'total_games_50', desc: 'Сыграть 50 раундов', target: 50, reward: 30 },
    { id: 'total_games_100', desc: 'Сыграть 100 раундов', target: 100, reward: 50 },
    { id: 'level_up_2', desc: 'Повысить уровень на 2', target: 2, reward: 20 },
    { id: 'level_up_5', desc: 'Повысить уровень на 5', target: 5, reward: 40 },
    { id: 'level_up_10', desc: 'Повысить уровень на 10', target: 10, reward: 60 },
  ];
  const achievements = [];
  for (let i = 0; i < 100; i++) {
    const base = types[i % types.length];
    const multiplier = Math.floor(i / types.length) + 1;
    const newTarget = base.target * multiplier;
    const newReward = Math.floor(base.reward * multiplier * 0.8);
    achievements.push({
      id: `${base.id}_${i}`,
      desc: `${base.desc} (${newTarget} раз)`,
      target: newTarget,
      reward: newReward,
      type: base.id.split('_')[0]
    });
  }
  return achievements;
}

const ALL_ACHIEVEMENTS = generateAchievements();

// ===== API =====

app.get('/user', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const data = await getPlayerData(user.id);
  const stats = await getStats(user.id) || {};
  res.json({
    username: user.username,
    level: data ? data.level : 1,
    limit_score: data ? data.limit_score : 50,
    inventory: data ? JSON.parse(data.inventory) : [],
    hand_upgrades: data ? JSON.parse(data.hand_upgrades) : {},
    passive_bonuses: data ? JSON.parse(data.passive_bonuses) : {},
    permanent_upgrades: data ? JSON.parse(data.permanent_upgrades) : [],
    shop_progress: data ? JSON.parse(data.shop_progress) : {},
    coins: data ? data.coins : 0,
    tutorial_shown: data ? data.tutorial_shown : 0,
    stats: stats
  });
});

app.post('/update-progress', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { level, limit_score, inventory, hand_upgrades, passive_bonuses, permanent_upgrades, shop_progress, stats, coins } = req.body;
  db.run(
    `UPDATE player_data 
     SET level = ?, limit_score = ?, inventory = ?, hand_upgrades = ?, passive_bonuses = ?, permanent_upgrades = ?, shop_progress = ?, coins = ?
     WHERE user_id = ?`,
    [level, limit_score, JSON.stringify(inventory), JSON.stringify(hand_upgrades || {}), JSON.stringify(passive_bonuses || {}), JSON.stringify(permanent_upgrades || []), JSON.stringify(shop_progress || {}), coins || 0, user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
    }
  );
  if (stats) {
    db.run(
      `INSERT OR REPLACE INTO player_stats 
       (user_id, total_wins, total_games, current_streak, best_streak, 
        pair_count, two_pair_count, three_count, straight_count, full_house_count,
        four_count, five_count, broken_straight_count, poker_count, royal_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, stats.total_wins || 0, stats.total_games || 0,
       stats.current_streak || 0, stats.best_streak || 0,
       stats.pair_count || 0, stats.two_pair_count || 0,
       stats.three_count || 0, stats.straight_count || 0,
       stats.full_house_count || 0, stats.four_count || 0,
       stats.five_count || 0, stats.broken_straight_count || 0,
       stats.poker_count || 0, stats.royal_count || 0]
    );
  }
  res.json({ success: true });
});

// ===== МАГАЗИН =====
app.get('/shop-items', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const data = await getPlayerData(user.id);
  const shopProgress = data ? JSON.parse(data.shop_progress || '{}') : {};
  const itemsWithPrice = SHOP_ITEMS.map(item => {
    const progress = shopProgress[item.id] || { count: 0, price: item.basePrice };
    return {
      ...item,
      currentPrice: progress.price,
      count: progress.count
    };
  });
  res.json(itemsWithPrice);
});

app.post('/buy-upgrade', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { itemId } = req.body;
  const itemDef = SHOP_ITEMS.find(it => it.id === itemId);
  if (!itemDef) return res.status(400).json({ error: 'Товар не найден' });

  const data = await getPlayerData(user.id);
  let coins = data.coins || 0;
  let shopProgress = JSON.parse(data.shop_progress || '{}');
  let progress = shopProgress[itemId] || { count: 0, price: itemDef.basePrice };
  if (coins < progress.price) return res.status(400).json({ error: 'Недостаточно монет' });

  coins -= progress.price;
  progress.count += 1;
  progress.price += 5;
  shopProgress[itemId] = progress;

  db.run(
    'UPDATE player_data SET shop_progress = ?, coins = ? WHERE user_id = ?',
    [JSON.stringify(shopProgress), coins, user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json({ success: true, coins, shopProgress, newPrice: progress.price, count: progress.count });
    }
  );
});

// ===== РЕГИСТРАЦИЯ =====
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
  try {
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], async function(err) {
      if (err) return res.status(400).json({ error: 'Пользователь уже существует' });
      await createPlayerData(this.lastID);
      await initStats(this.lastID);
      // Создаём задания для нового пользователя на сегодня
      const today = new Date().toISOString().slice(0,10);
      const shuffled = [...ALL_ACHIEVEMENTS].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 5);
      for (const ach of selected) {
        db.run('INSERT INTO daily_quests (user_id, quest_id, progress, completed, date) VALUES (?, ?, 0, 0, ?)',
          [this.lastID, ach.id, today]);
      }
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

// ===== АЧИВКИ / ЗАДАНИЯ =====
app.get('/quests', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const today = new Date().toISOString().slice(0,10);
  const data = await getPlayerData(user.id);
  
  // Проверяем, есть ли задания на сегодня
  const existing = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM daily_quests WHERE user_id = ? AND date = ?', [user.id, today], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  if (existing.length === 0) {
    // Если заданий нет – создаём
    const shuffled = [...ALL_ACHIEVEMENTS].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5);
    for (const ach of selected) {
      db.run('INSERT INTO daily_quests (user_id, quest_id, progress, completed, date) VALUES (?, ?, 0, 0, ?)',
        [user.id, ach.id, today]);
    }
    // Обновляем last_visit
    db.run('UPDATE player_data SET last_visit = ? WHERE user_id = ?', [today, user.id]);
  }

  // Получаем задания с прогрессом
  const questsWithProgress = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM daily_quests WHERE user_id = ? AND date = ?', [user.id, today], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  const fullQuests = questsWithProgress.map(row => {
    const def = ALL_ACHIEVEMENTS.find(a => a.id === row.quest_id);
    return {
      ...row,
      desc: def ? def.desc : 'Задание',
      reward: def ? def.reward : 10,
      target: def ? def.target : 1
    };
  });
  res.json(fullQuests);
});

app.post('/quest-progress', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { questId, increment } = req.body;
  db.run(
    'UPDATE daily_quests SET progress = progress + ? WHERE user_id = ? AND quest_id = ? AND completed = 0',
    [increment || 1, user.id, questId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      db.get(
        'SELECT progress, target FROM daily_quests WHERE user_id = ? AND quest_id = ?',
        [user.id, questId],
        (err2, row) => {
          if (row && row.progress >= row.target) {
            db.run('UPDATE daily_quests SET completed = 1 WHERE user_id = ? AND quest_id = ?', [user.id, questId]);
            const def = ALL_ACHIEVEMENTS.find(a => a.id === questId);
            if (def) {
              db.run('UPDATE player_data SET coins = coins + ? WHERE user_id = ?', [def.reward, user.id]);
            }
            res.json({ success: true, completed: true });
          } else {
            res.json({ success: true, completed: false });
          }
        }
      );
    }
  );
});

app.get('/leaderboard', (req, res) => {
  db.all(
    `SELECT u.username, p.level, p.limit_score, p.coins
     FROM player_data p 
     JOIN users u ON p.user_id = u.id 
     ORDER BY p.level DESC, p.limit_score DESC 
     LIMIT 100`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json(rows);
    }
  );
});

app.get('/chat', (req, res) => {
  db.all(
    'SELECT username, message, timestamp FROM chat_messages ORDER BY timestamp DESC LIMIT 50',
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json(rows.reverse());
    }
  );
});

app.post('/chat', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { message } = req.body;
  if (!message || message.length > 200) return res.status(400).json({ error: 'Сообщение слишком длинное' });
  db.run('INSERT INTO chat_messages (username, message) VALUES (?, ?)', [user.username, message]);
  res.json({ success: true });
});

app.post('/tutorial-shown', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  db.run('UPDATE player_data SET tutorial_shown = 1 WHERE user_id = ?', [user.id]);
  res.json({ success: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://0.0.0.0:${PORT}`);
});