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
    target INTEGER DEFAULT 1,
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
      'INSERT INTO player_data (user_id, level, limit_score, inventory, hand_upgrades, passive_bonuses, coins, tutorial_shown) VALUES (?, 1, 50, ?, ?, ?, 0, 0)',
      [userId, JSON.stringify([]), JSON.stringify({}), JSON.stringify({})],
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

// ===== ГЕНЕРАЦИЯ ВСЕХ ВОЗМОЖНЫХ УЛУЧШЕНИЙ (для магазина и прокачки) =====
const ALL_UPGRADES = (function generateAllUpgrades() {
  const upgrades = [];
  const handTypes = ['high','pair','twoPair','three','straight','fullHouse','four','five','brokenStraight','poker','royal'];
  const handNames = {
    high:'Старшая карта', pair:'Пара', twoPair:'Две пары', three:'Тройка',
    straight:'Стрит', fullHouse:'Фулл-хаус', four:'Каре', five:'Пять одинаковых',
    brokenStraight:'Ломаный стрит', poker:'Покер', royal:'Рояль'
  };
  for (let level=1; level<=10; level++) {
    const bonus=level;
    for (const hand of handTypes) {
      upgrades.push({
        id: `upgrade_hand_${hand}_${level}`,
        name: `⬆ ${handNames[hand]} +${bonus}x`,
        type: 'hand',
        hand: hand,
        value: bonus,
        desc: `Множитель +${bonus} для ${handNames[hand]}`
      });
    }
  }
  for (let i=1; i<=6; i++) {
    const val=i*5;
    upgrades.push({ id:`passive_bones_${i}`, name:`💀 +${val} кости`, type:'passive', bonus:'bones', value:val, desc:`+${val} к костям` });
  }
  for (let i=1; i<=5; i++) {
    upgrades.push({ id:`passive_mult_${i}`, name:`💀 +${i} множитель`, type:'passive', bonus:'mult', value:i, desc:`+${i} к множителю` });
  }
  for (let i=1; i<=3; i++) {
    upgrades.push({ id:`passive_rerolls_${i}`, name:`💀 +${i} переброс`, type:'passive', bonus:'rerolls', value:i, desc:`+${i} к перебросам` });
  }
  for (let i=1; i<=2; i++) {
    upgrades.push({ id:`passive_hands_${i}`, name:`💀 +${i} рука`, type:'passive', bonus:'extra_hands', value:i, desc:`+${i} дополнительная рука` });
  }
  upgrades.push({ id:`passive_hands_rare_3`, name:`💀✨ +3 руки`, type:'passive', bonus:'extra_hands', value:3, desc:`+3 дополнительных руки (редкое)` });
  upgrades.push({ id:`passive_hands_rare_5`, name:`💀✨ +5 рук`, type:'passive', bonus:'extra_hands', value:5, desc:`+5 дополнительных рук (очень редкое)` });
  for (let i=1; i<=3; i++) {
    const val=i*10;
    upgrades.push({ id:`passive_limit_reduce_${i}`, name:`💀 Лимит -${val}`, type:'passive', bonus:'limit_reduce', value:val, desc:`Снижает лимит на ${val} (одноразово)` });
  }
  const combos = [{b:5,m:1},{b:10,m:2},{b:15,m:3},{b:20,m:4},{b:25,m:5}];
  for (let i=0; i<combos.length; i++) {
    const c=combos[i];
    upgrades.push({
      id:`passive_combo_${i}`,
      name:`💀 +${c.b} кости +${c.m} множ`,
      type:'passive',
      bonus:'combo_bones_mult',
      value:{ bones:c.b, mult:c.m },
      desc:`+${c.b} к костям и +${c.m} к множителю`
    });
  }
  for (let i=1; i<=2; i++) {
    upgrades.push({
      id:`passive_extra_level_${i}`,
      name:`💀 +${i} уровень при победе`,
      type:'passive',
      bonus:'extra_level',
      value:i,
      desc:`При победе +${i} уровень`
    });
  }
  return upgrades;
})();

// ===== ГЕНЕРАЦИЯ ЗАДАНИЙ =====
function generateAchievements() {
  const achievements = [];
  const comboTypes = [
    { id: 'pair', desc: 'Выбросить пару', target: 1, reward: 10 },
    { id: 'two_pair', desc: 'Выбросить две пары', target: 1, reward: 15 },
    { id: 'three', desc: 'Выбросить тройку', target: 1, reward: 20 },
    { id: 'straight', desc: 'Выбросить стрит', target: 1, reward: 25 },
    { id: 'full_house', desc: 'Выбросить фулл-хаус', target: 1, reward: 30 },
    { id: 'four', desc: 'Выбросить каре', target: 1, reward: 40 },
    { id: 'five', desc: 'Выбросить пять одинаковых', target: 1, reward: 50 },
    { id: 'broken_straight', desc: 'Выбросить ломаный стрит', target: 1, reward: 20 },
    { id: 'poker', desc: 'Выбросить покер', target: 1, reward: 25 },
    { id: 'royal', desc: 'Выбросить рояль', target: 1, reward: 35 }
  ];
  for (const combo of comboTypes) {
    achievements.push({
      id: `${combo.id}_1`,
      desc: combo.desc,
      target: combo.target,
      reward: combo.reward,
      type: combo.id
    });
  }
  const winTargets = [1, 2, 3];
  for (const t of winTargets) {
    achievements.push({
      id: `win_${t}`,
      desc: `Выиграть ${t} раунд${t>1?'а':' '}`,
      target: t,
      reward: 10 * t,
      type: 'win'
    });
  }
  const streakTargets = [1, 2, 3];
  for (const t of streakTargets) {
    achievements.push({
      id: `streak_${t}`,
      desc: `Победить ${t} раз${t>1?'а':' '} подряд`,
      target: t,
      reward: 15 * t,
      type: 'streak'
    });
  }
  const gameTargets = [1, 3, 5];
  for (const t of gameTargets) {
    achievements.push({
      id: `total_games_${t}`,
      desc: `Сыграть ${t} раунд${t>1?'ов':' '}`,
      target: t,
      reward: 5 * t,
      type: 'total_games'
    });
  }
  const levelTargets = [1, 2, 3];
  for (const t of levelTargets) {
    achievements.push({
      id: `level_up_${t}`,
      desc: `Повысить уровень на ${t}`,
      target: t,
      reward: 15 * t,
      type: 'level_up'
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
    coins: data ? data.coins : 0,
    tutorial_shown: data ? data.tutorial_shown : 0,
    stats: stats
  });
});

app.post('/update-progress', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { level, limit_score, inventory, hand_upgrades, passive_bonuses, stats, coins } = req.body;
  db.run(
    `UPDATE player_data 
     SET level = ?, limit_score = ?, inventory = ?, hand_upgrades = ?, passive_bonuses = ?, coins = ?
     WHERE user_id = ?`,
    [level, limit_score, JSON.stringify(inventory), JSON.stringify(hand_upgrades || {}), JSON.stringify(passive_bonuses || {}), coins || 0, user.id],
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

// ===== МАГАЗИН (покупка временных улучшений) =====
app.post('/buy-upgrade', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const { itemId } = req.body;
  // Находим предмет в списке всех улучшений
  const itemDef = ALL_UPGRADES.find(it => it.id === itemId);
  if (!itemDef) return res.status(400).json({ error: 'Товар не найден' });

  const data = await getPlayerData(user.id);
  let coins = data.coins || 0;
  const price = 5; // фиксированная цена за предмет
  if (coins < price) return res.status(400).json({ error: 'Недостаточно монет' });

  // Списываем монеты
  coins -= price;
  // Добавляем предмет в инвентарь (временный)
  let inventory = JSON.parse(data.inventory || '[]');
  const inventoryItem = {
    id: itemDef.id,
    name: itemDef.name,
    type: itemDef.type,
    hand: itemDef.hand || null,
    bonus: itemDef.bonus || null,
    value: itemDef.value,
    desc: itemDef.desc
  };
  inventory.push(inventoryItem);

  db.run(
    'UPDATE player_data SET coins = ?, inventory = ? WHERE user_id = ?',
    [coins, JSON.stringify(inventory), user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Ошибка БД' });
      res.json({ success: true, coins, inventory });
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
      const today = new Date().toISOString().slice(0,10);
      const shuffled = [...ALL_ACHIEVEMENTS].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 5);
      for (const ach of selected) {
        db.run('INSERT INTO daily_quests (user_id, quest_id, progress, completed, date, target) VALUES (?, ?, 0, 0, ?, ?)',
          [this.lastID, ach.id, today, ach.target]);
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

// ===== КВЕСТЫ =====
app.get('/quests', async (req, res) => {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Не авторизован' });
  const today = new Date().toISOString().slice(0,10);
  const data = await getPlayerData(user.id);
  const existing = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM daily_quests WHERE user_id = ? AND date = ?', [user.id, today], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  if (existing.length === 0) {
    const shuffled = [...ALL_ACHIEVEMENTS].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5);
    for (const ach of selected) {
      db.run('INSERT INTO daily_quests (user_id, quest_id, progress, completed, date, target) VALUES (?, ?, 0, 0, ?, ?)',
        [user.id, ach.id, today, ach.target]);
    }
    db.run('UPDATE player_data SET last_visit = ? WHERE user_id = ?', [today, user.id]);
  }
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
      target: row.target
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