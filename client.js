// ===== ГЛОБАЛЬНЫЕ =====
let currentUser = null;
let level = 1;
let limit = 50;
let coins = 0;
let inventory = [];
let permanentUpgrades = [];
let shopProgress = {};
let dice = [0,0,0,0,0];
let selectedDice = [false,false,false,false,false];
let rerollsLeft = 3;
let handsLeft = 3;
let baseHands = 3;
let totalHands = 3;
let roundTotal = 0;
let isRolling = false;
let hasRolled = false;
let roundActive = false;
let currentHandType = 'high';
let stats = {
  total_wins:0, total_games:0, current_streak:0, best_streak:0,
  pair_count:0, two_pair_count:0, three_count:0, straight_count:0,
  full_house_count:0, four_count:0, five_count:0,
  broken_straight_count:0, poker_count:0, royal_count:0
};

// ===== БАЗОВЫЕ МНОЖИТЕЛИ =====
const BASE_MULTIPLIERS = {
  high:1, pair:2, twoPair:3, three:4, straight:5, fullHouse:6, four:8, five:12,
  brokenStraight:4, poker:5, royal:6
};

// ===== ПРОКАЧКИ =====
let handUpgrades = {
  high:0, pair:0, twoPair:0, three:0, straight:0, fullHouse:0, four:0, five:0,
  brokenStraight:0, poker:0, royal:0
};
let passiveBonuses = {
  bones:0, mult:0, rerolls:0, extra_hands:0, limit_reduce:0,
  combo_bones_mult:null, extra_level:0
};

// ===== ГЕНЕРАЦИЯ УЛУЧШЕНИЙ (для модалки) =====
function generateAllUpgrades() {
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
        id:`upgrade_hand_${hand}_${level}`,
        name:`⬆ ${handNames[hand]} +${bonus}x`,
        type:'hand', hand:hand, value:bonus,
        desc:`Множитель +${bonus} для ${handNames[hand]}`
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
      type:'passive', bonus:'combo_bones_mult',
      value:{ bones:c.b, mult:c.m },
      desc:`+${c.b} к костям и +${c.m} к множителю`
    });
  }
  for (let i=1; i<=2; i++) {
    upgrades.push({
      id:`passive_extra_level_${i}`,
      name:`💀 +${i} уровень при победе`,
      type:'passive', bonus:'extra_level', value:i,
      desc:`При победе +${i} уровень`
    });
  }
  return upgrades;
}
const ALL_UPGRADES = generateAllUpgrades();

const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
const diceElements = document.querySelectorAll('.dice');

// ===== ЗВУКИ =====
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSound(type) {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type='sine';
    gain.gain.value=0.15;
    switch(type) {
      case 'click': osc.frequency.value=800; gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime+0.1); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.1); break;
      case 'roll': osc.frequency.value=400; gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime+0.15); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.15); break;
      case 'win': osc.frequency.setValueAtTime(523, audioCtx.currentTime); osc.frequency.setValueAtTime(659, audioCtx.currentTime+0.1); osc.frequency.setValueAtTime(784, audioCtx.currentTime+0.2); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime+0.4); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.4); break;
      case 'lose': osc.frequency.setValueAtTime(400, audioCtx.currentTime); osc.frequency.setValueAtTime(300, audioCtx.currentTime+0.1); osc.frequency.setValueAtTime(200, audioCtx.currentTime+0.2); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime+0.4); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.4); break;
      case 'upgrade': osc.frequency.setValueAtTime(500, audioCtx.currentTime); osc.frequency.setValueAtTime(600, audioCtx.currentTime+0.08); osc.frequency.setValueAtTime(800, audioCtx.currentTime+0.16); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime+0.3); osc.start(audioCtx.currentTime); osc.stop(audioCtx.currentTime+0.3); break;
      default: break;
    }
  } catch(e) {}
}

// ===== ЧАСТИЦЫ =====
function createParticles(x,y,count,color,spread) {
  const container = document.getElementById('particlesContainer');
  for (let i=0; i<count; i++) {
    const p = document.createElement('div');
    p.className='particle';
    const size=Math.random()*8+4;
    const angle=Math.random()*Math.PI*2;
    const dist=Math.random()*spread+50;
    const tx=Math.cos(angle)*dist;
    const ty=Math.sin(angle)*dist;
    p.style.width=size+'px'; p.style.height=size+'px';
    p.style.background=color;
    p.style.left=(x-size/2)+'px'; p.style.top=(y-size/2)+'px';
    p.style.setProperty('--tx', tx+'px'); p.style.setProperty('--ty', ty+'px');
    p.style.animationDuration=(Math.random()*0.6+0.4)+'s';
    container.appendChild(p);
    setTimeout(()=>p.remove(),1200);
  }
}
function spawnWinParticles() {
  const rect = document.getElementById('resultMessage').getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  createParticles(cx,cy,40,'#69db7c',300);
  createParticles(cx-50,cy-30,20,'#ffd700',200);
}
function spawnLoseParticles() {
  const rect = document.getElementById('resultMessage').getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  createParticles(cx,cy,30,'#ff6b6b',250);
  createParticles(cx+40,cy-20,15,'#ff4444',180);
}
function spawnUpgradeParticles() {
  const container = document.querySelector('.upgrade-modal-content');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  createParticles(cx,cy,50,'#ffd700',350);
  createParticles(cx-60,cy-40,25,'#ff8c00',250);
}
function spawnCoinParticles() {
  const rect = document.getElementById('coinsDisplay').getBoundingClientRect();
  const cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
  createParticles(cx,cy,30,'#ffd700',200);
  createParticles(cx-30,cy-20,15,'#ff8c00',150);
}

function flashOverlay(type) {
  const overlay = document.getElementById('flashOverlay');
  overlay.className='';
  void overlay.offsetWidth;
  overlay.className=type==='win'?'flash-win':'flash-lose';
  setTimeout(()=>{overlay.className='';},900);
}

diceElements.forEach((el,i)=>{
  el.addEventListener('click',()=>{
    if(!hasRolled||isRolling||!roundActive) return;
    selectedDice[i]=!selectedDice[i];
    el.classList.toggle('selected');
    const anySelected=selectedDice.some(v=>v);
    document.getElementById('rerollBtn').disabled=!anySelected||rerollsLeft<=0;
    if(selectedDice[i]) playSound('click');
  });
});

// ===== ОПРЕДЕЛЕНИЕ КОМБИНАЦИЙ =====
function getHandType(diceValues) {
  const counts={};
  for(const val of diceValues) counts[val]=(counts[val]||0)+1;
  const sorted=Object.values(counts).sort((a,b)=>b-a);
  const sortedVals=[...diceValues].sort((a,b)=>a-b);
  const isStraight=sortedVals.every((v,i)=>i===0||v===sortedVals[i-1]+1);
  const isBrokenStraight=(sortedVals.join(',')==='1,2,3,4,6'||sortedVals.join(',')==='1,3,4,5,6');
  const isRoyal=(sortedVals.join(',')==='1,2,3,4,5'||sortedVals.join(',')==='2,3,4,5,6');
  if(isRoyal) return 'royal';
  if(isBrokenStraight) return 'brokenStraight';
  if(sorted[0]===5) return 'five';
  if(sorted[0]===4) return 'four';
  if(sorted[0]===3&&sorted[1]===2) return 'fullHouse';
  if(isStraight) return 'straight';
  if(sorted[0]===3) return 'three';
  if(sorted[0]===2&&sorted[1]===2) return 'poker';
  if(sorted[0]===2) return 'pair';
  return 'high';
}

function getHandName(type) {
  const names={
    high:'Старшая карта', pair:'Пара', twoPair:'Две пары', three:'Тройка',
    straight:'Стрит', fullHouse:'Фулл-хаус', four:'Каре', five:'Пять одинаковых',
    brokenStraight:'Ломаный стрит', poker:'Покер', royal:'Рояль'
  };
  return names[type]||type;
}

// ===== СБРОС ИГРЫ (при поражении) =====
function resetGame() {
  level = 1;
  const handsBonus = Object.values(shopProgress)
    .filter(p => p.id && p.id.startsWith('shop_hand_'))
    .reduce((sum, p) => sum + p.value, 0);
  const rerollsBonus = Object.values(shopProgress)
    .filter(p => p.id && p.id.startsWith('shop_passive_rerolls_'))
    .reduce((sum, p) => sum + p.value, 0);
  const bonesBonus = Object.values(shopProgress)
    .filter(p => p.id && p.id.startsWith('shop_passive_bones_'))
    .reduce((sum, p) => sum + p.value, 0);
  const multBonus = Object.values(shopProgress)
    .filter(p => p.id && p.id.startsWith('shop_passive_mult_'))
    .reduce((sum, p) => sum + p.value, 0);
  const limitReduction = Object.values(shopProgress)
    .filter(p => p.id && p.id.startsWith('shop_passive_limit_'))
    .reduce((sum, p) => sum + p.value, 0);
  const extraLevelBonus = Object.values(shopProgress)
    .filter(p => p.id && p.id.startsWith('shop_passive_extra_level_'))
    .reduce((sum, p) => sum + p.value, 0);
  const comboBones = Object.values(shopProgress)
    .filter(p => p.id && p.id.startsWith('shop_combo_'))
    .reduce((sum, p) => sum + (p.value.bones || 0), 0);
  const comboMult = Object.values(shopProgress)
    .filter(p => p.id && p.id.startsWith('shop_combo_'))
    .reduce((sum, p) => sum + (p.value.mult || 0), 0);

  baseHands = 3 + handsBonus;
  passiveBonuses.rerolls = rerollsBonus;
  passiveBonuses.bones = bonesBonus + comboBones;
  passiveBonuses.mult = multBonus + comboMult;
  passiveBonuses.extra_hands = handsBonus;
  passiveBonuses.extra_level = extraLevelBonus;
  limit = 50 - limitReduction;
  if (limit < 10) limit = 10;

  inventory = [];
  handUpgrades = { high:0, pair:0, twoPair:0, three:0, straight:0, fullHouse:0, four:0, five:0, brokenStraight:0, poker:0, royal:0 };
  stats = { total_wins:0, total_games:0, current_streak:0, best_streak:0, pair_count:0, two_pair_count:0, three_count:0, straight_count:0, full_house_count:0, four_count:0, five_count:0, broken_straight_count:0, poker_count:0, royal_count:0 };
  document.getElementById('levelDisplay').textContent = level;
  document.getElementById('limitDisplay').textContent = limit;
  renderInventory();
  saveProgress();
  roundActive = false;
  setTimeout(() => startRound(), 500);
}

// ===== НАЧАЛО НОВОГО РАУНДА =====
function startRound() {
  roundActive = true;
  hasRolled = false;
  roundTotal = 0;
  const bonusHands = passiveBonuses.extra_hands || 0;
  totalHands = baseHands + bonusHands;
  handsLeft = totalHands;
  const bonusRerolls = passiveBonuses.rerolls || 0;
  rerollsLeft = 3 + bonusRerolls;
  selectedDice = [false,false,false,false,false];
  diceElements.forEach(el => el.classList.remove('selected'));
  document.getElementById('rerollBtn').disabled = true;
  document.getElementById('playBtn').disabled = false;

  document.getElementById('handCount').textContent = handsLeft;
  document.getElementById('rerollCount').textContent = rerollsLeft;
  document.getElementById('resultMessage').textContent = 'Новый раунд! Бросьте кубики.';
  document.getElementById('resultMessage').className = 'result info';
  updateStatsDisplay();
  firstRoll();
}

// ===== ПЕРВЫЙ БРОСОК В РАУНДЕ =====
function firstRoll() {
  for (let i=0; i<5; i++) dice[i] = Math.floor(Math.random()*6)+1;
  hasRolled = true;
  updateDiceDisplay(true);
  updateStatsDisplay();
  document.getElementById('rerollBtn').disabled = true;
  document.getElementById('playBtn').disabled = false;
}

// ===== ПЕРЕБРОС =====
function rerollSelected() {
  if (isRolling) return;
  if (rerollsLeft <= 0) { showMessage('Нет перебросов!','error'); return; }
  if (!hasRolled || !roundActive) return;
  let anySelected = false;
  for (let i=0; i<5; i++) {
    if (selectedDice[i]) {
      dice[i] = Math.floor(Math.random()*6)+1;
      anySelected = true;
      selectedDice[i] = false;
      diceElements[i].classList.remove('selected');
    }
  }
  if (!anySelected) { showMessage('Выберите кубики для переброса!','error'); return; }
  rerollsLeft--;
  playSound('roll');
  updateDiceDisplay(true);
  updateStatsDisplay();
  document.getElementById('rerollBtn').disabled = true;
  if (rerollsLeft <= 0) document.getElementById('rerollBtn').disabled = true;
  document.getElementById('rerollCount').textContent = rerollsLeft;
}

// ===== ИГРАТЬ РУКУ (ход) =====
function playHand() {
  if (isRolling) return;
  if (handsLeft <= 0) { showMessage('Нет ходов!','error'); return; }
  if (!hasRolled || !roundActive) return;
  document.getElementById('playBtn').disabled = true;
  document.getElementById('rerollBtn').disabled = true;
  playSound('click');

  let bone = dice.reduce((a,b)=>a+b,0) + (passiveBonuses.bones||0);
  if (passiveBonuses.combo_bones_mult) bone += passiveBonuses.combo_bones_mult.bones||0;
  const handType = getHandType(dice);
  currentHandType = handType;
  const baseMultiplier = BASE_MULTIPLIERS[handType]||1;
  let upgradeBonus = handUpgrades[handType]||0;
  let multBonus = passiveBonuses.mult||0;
  if (passiveBonuses.combo_bones_mult) multBonus += passiveBonuses.combo_bones_mult.mult||0;
  const multiplier = baseMultiplier + upgradeBonus + multBonus;
  const handTotal = Math.floor(bone * multiplier);

  roundTotal += handTotal;
  handsLeft--;

  document.getElementById('handCount').textContent = handsLeft;
  document.getElementById('totalDisplay').textContent = roundTotal;
  document.getElementById('resultMessage').textContent = `Ход: ${bone} × ${multiplier} = ${handTotal} (всего: ${roundTotal})`;
  document.getElementById('resultMessage').className = 'result info';

  updateStatsAfterGame(handType, false);
  // ВАЖНО: проверяем задания после каждого хода
  checkQuestProgress(handType, false, 0);

  if (handsLeft === 0) {
    const isWin = roundTotal >= limit;
    if (isWin) {
      document.getElementById('resultMessage').className = 'result win';
      document.getElementById('resultMessage').textContent = `🎉 Победа! ${roundTotal} ≥ ${limit}`;
      playSound('win');
      flashOverlay('win');
      spawnWinParticles();

      const levelGain = 1 + (passiveBonuses.extra_level || 0);
      level += levelGain;

      if (level % 10 === 0) {
        baseHands++;
        showMessage(`🎉 Уровень ${level}! +1 рука навсегда! (теперь ${baseHands})`,'success');
      }
      limit = Math.floor(limit * 1.3);
      if (passiveBonuses.extra_level) {
        showMessage(`✨ Дополнительный +${levelGain-1} уровень!`,'success');
      }
      document.getElementById('levelDisplay').textContent = level;
      document.getElementById('limitDisplay').textContent = limit;

      stats.total_wins++;
      stats.current_streak++;
      if (stats.current_streak > stats.best_streak) stats.best_streak = stats.current_streak;
      stats.total_games++;
      saveProgress();

      // Проверяем задания ещё раз с учётом победы и повышения уровня
      checkQuestProgress(handType, true, levelGain);

      showUpgradeModal();
    } else {
      document.getElementById('resultMessage').className = 'result lose';
      document.getElementById('resultMessage').textContent = `💀 Поражение! ${roundTotal} < ${limit}`;
      playSound('lose');
      flashOverlay('lose');
      spawnLoseParticles();
      stats.current_streak = 0;
      stats.total_games++;
      saveProgress();
      checkQuestProgress(handType, false, 0);
      resetGame();
    }
    roundActive = false;
  } else {
    hasRolled = false;
    rerollsLeft = 3 + (passiveBonuses.rerolls || 0);
    document.getElementById('rerollCount').textContent = rerollsLeft;
    document.getElementById('rerollBtn').disabled = true;
    document.getElementById('playBtn').disabled = true;
    setTimeout(() => {
      if (roundActive && handsLeft > 0) {
        for (let i=0; i<5; i++) dice[i] = Math.floor(Math.random()*6)+1;
        hasRolled = true;
        updateDiceDisplay(true);
        updateStatsDisplay();
        document.getElementById('rerollBtn').disabled = true;
        document.getElementById('playBtn').disabled = false;
        document.getElementById('resultMessage').textContent = `Ход ${totalHands - handsLeft + 1} из ${totalHands}`;
        document.getElementById('resultMessage').className = 'result info';
      }
    }, 800);
  }
}

// ===== ОТОБРАЖЕНИЕ СТАТИСТИКИ =====
function updateStatsDisplay() {
  let bone = dice.reduce((a,b)=>a+b,0) + (passiveBonuses.bones||0);
  if (passiveBonuses.combo_bones_mult) bone += passiveBonuses.combo_bones_mult.bones||0;
  const handType = getHandType(dice);
  currentHandType = handType;
  const baseMultiplier = BASE_MULTIPLIERS[handType]||1;
  let upgradeBonus = handUpgrades[handType]||0;
  let multBonus = passiveBonuses.mult||0;
  if (passiveBonuses.combo_bones_mult) multBonus += passiveBonuses.combo_bones_mult.mult||0;
  const multiplier = baseMultiplier + upgradeBonus + multBonus;
  const total = Math.floor(bone * multiplier);
  document.getElementById('boneDisplay').textContent = bone;
  document.getElementById('multiplierDisplay').textContent = multiplier;
  document.getElementById('totalDisplay').textContent = roundTotal;
  renderInventory();
}

// ===== СТАТИСТИКА =====
function updateStatsAfterGame(handType, win) {
  switch(handType) {
    case 'pair': stats.pair_count++; break;
    case 'twoPair': stats.two_pair_count++; break;
    case 'three': stats.three_count++; break;
    case 'straight': stats.straight_count++; break;
    case 'fullHouse': stats.full_house_count++; break;
    case 'four': stats.four_count++; break;
    case 'five': stats.five_count++; break;
    case 'brokenStraight': stats.broken_straight_count++; break;
    case 'poker': stats.poker_count++; break;
    case 'royal': stats.royal_count++; break;
    default: break;
  }
}

// ===== АЧИВКИ (ЗАДАНИЯ) – ИСПРАВЛЕННАЯ ЛОГИКА С ПОДРОБНЫМИ ЛОГАМИ =====
function checkQuestProgress(handType, win, levelGain = 0) {
  console.log('🔍 Проверка заданий...', { handType, win, levelGain });
  fetch('/quests')
    .then(res => res.json())
    .then(quests => {
      console.log('📋 Получены задания:', quests);
      quests.forEach(q => {
        if (q.completed) return;
        let increment = 0;
        const id = q.quest_id;
        console.log(`📌 Задание: ${q.desc}, id: ${id}, прогресс: ${q.progress}/${q.target}, handType: ${handType}`);
        
        // Обработка комбинаций
        if (id.startsWith('pair_') && handType === 'pair') {
          increment = 1;
          console.log('✅ ПАРА: подходит');
        } else if (id.startsWith('two_pair_') && (handType === 'twoPair' || handType === 'poker')) {
          increment = 1;
          console.log('✅ ДВЕ ПАРЫ/ПОКЕР: подходит');
        } else if (id.startsWith('three_') && handType === 'three') {
          increment = 1;
          console.log('✅ ТРОЙКА: подходит');
        } else if (id.startsWith('straight_') && handType === 'straight') {
          increment = 1;
          console.log('✅ СТРИТ: подходит');
        } else if (id.startsWith('full_house_') && handType === 'fullHouse') {
          increment = 1;
          console.log('✅ ФУЛЛ-ХАУС: подходит');
        } else if (id.startsWith('four_') && handType === 'four') {
          increment = 1;
          console.log('✅ КАРЕ: подходит');
        } else if (id.startsWith('five_') && handType === 'five') {
          increment = 1;
          console.log('✅ ПЯТЬ ОДИНАКОВЫХ: подходит');
        } else if (id.startsWith('broken_straight_') && handType === 'brokenStraight') {
          increment = 1;
          console.log('✅ ЛОМАНЫЙ СТРИТ: подходит');
        } else if (id.startsWith('poker_') && (handType === 'poker' || handType === 'twoPair')) {
          increment = 1;
          console.log('✅ ПОКЕР: подходит');
        } else if (id.startsWith('royal_') && handType === 'royal') {
          increment = 1;
          console.log('✅ РОЯЛЬ: подходит');
        } else if (id.startsWith('win_') && win) {
          increment = 1;
          console.log('✅ ПОБЕДА: подходит');
        } else if (id.startsWith('streak_') && win) {
          increment = stats.current_streak;
          console.log(`✅ СТРИК: текущий стрик ${stats.current_streak}, прирост ${increment}`);
        } else if (id.startsWith('total_games_')) {
          increment = 1;
          console.log('✅ ОБЩЕЕ КОЛИЧЕСТВО ИГР: подходит');
        } else if (id.startsWith('level_up_') && levelGain > 0) {
          increment = levelGain;
          console.log(`✅ ПОВЫШЕНИЕ УРОВНЯ: прирост ${increment}`);
        } else {
          console.log(`⏭️ Задание ${id} не подходит под текущие условия.`);
        }

        if (increment > 0) {
          console.log(`📈 Отправляем прирост ${increment} для задания ${id}`);
          fetch('/quest-progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ questId: q.quest_id, increment })
          })
          .then(res => res.json())
          .then(data => {
            if (data.completed) {
              showMessage(`🎉 Задание выполнено! +${q.reward} монет!`, 'success');
              spawnCoinParticles();
              loadCoins();
              // Обновляем модалку, если открыта
              if (questsModalOpen) loadQuestsForModal();
            }
          })
          .catch(err => console.error('Ошибка обновления задания:', err));
        } else {
          console.log(`⏭️ Задание ${id} не подходит под текущие условия.`);
        }
      });
    })
    .catch(err => console.error('Ошибка загрузки заданий:', err));
}

// ===== Загрузка заданий для модального окна =====
let questsModalOpen = false;

function loadQuestsForModal() {
  if (!questsModalOpen) return;
  const container = document.getElementById('questsList');
  if (!container) return;
  fetch('/quests')
    .then(res => res.json())
    .then(quests => {
      if (!quests || quests.length === 0) {
        container.innerHTML = '<div style="color:#aaa;padding:20px;text-align:center;">Нет заданий на сегодня</div>';
        return;
      }
      container.innerHTML = quests.map(q => `
        <div class="quest-item ${q.completed ? 'completed' : ''}" style="background:rgba(255,255,255,0.04);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.06);margin-bottom:10px;">
          <div class="desc">${q.desc}</div>
          <div class="progress" style="margin-top:6px;height:6px;background:#333;border-radius:3px;overflow:hidden;">
            <div class="progress-bar" style="width:${Math.min(100, (q.progress/q.target)*100)}%;height:100%;background:linear-gradient(90deg,#ffd700,#ff8c00);transition:width 0.3s;"></div>
          </div>
          <div class="reward" style="font-size:0.8rem;color:#aaa;margin-top:4px;">🎁 ${q.reward} монет</div>
        </div>
      `).join('');
    })
    .catch(err => console.error('Ошибка загрузки заданий для модалки:', err));
}

// ===== МОНЕТЫ =====
function loadCoins() {
  fetch('/user')
    .then(res => res.json())
    .then(data => {
      if (data.coins !== undefined) {
        coins = data.coins;
        document.getElementById('coinsDisplay').textContent = coins;
      }
    })
    .catch(err => console.error('Ошибка загрузки монет:', err));
}

// ===== УЛУЧШЕНИЯ (МОДАЛКА) =====
function showUpgradeModal(){
  const shuffled=[...ALL_UPGRADES].sort(()=>Math.random()-0.5);
  const selected=shuffled.slice(0,3);
  const modal=document.getElementById('upgradeModal');
  document.getElementById('upgradeLevel').textContent=level;
  const container=document.getElementById('upgradeOptions');
  container.innerHTML=selected.map((upgrade,index)=>`
    <div class="upgrade-option" data-index="${index}">
      <div class="upgrade-name">${upgrade.name}</div>
      <div class="upgrade-desc">${upgrade.desc}</div>
      <button class="upgrade-select-btn" onclick="applyUpgrade(${index})">Выбрать</button>
    </div>
  `).join('');
  window._currentUpgrades=selected;
  modal.style.display='flex';
  playSound('upgrade');
  setTimeout(spawnUpgradeParticles,300);
}

function applyUpgrade(index){
  const upgrade=window._currentUpgrades[index];
  if(!upgrade) return;
  if(upgrade.type==='hand'){
    handUpgrades[upgrade.hand]=(handUpgrades[upgrade.hand]||0)+upgrade.value;
    showMessage(`✅ Улучшена комбинация "${getHandName(upgrade.hand)}"! +${upgrade.value} к множителю`,'success');
  } else if(upgrade.type==='passive'){
    const bonus=upgrade.bonus, value=upgrade.value;
    if(bonus==='combo_bones_mult'){
      passiveBonuses.combo_bones_mult=value;
    } else {
      passiveBonuses[bonus]=(passiveBonuses[bonus]||0)+value;
    }
    const bonusNames={ bones:'костям', mult:'множителю', rerolls:'перебросам', extra_hands:'рукам', limit_reduce:'снижению лимита', combo_bones_mult:'комбо (кости+множ)', extra_level:'дополнительному уровню' };
    showMessage(`✅ Получен череп: +${value} к ${bonusNames[bonus]||bonus}!`,'success');
  }
  const inventoryItem={
    id:upgrade.id, name:upgrade.name, type:upgrade.type,
    hand:upgrade.hand||null, bonus:upgrade.bonus||null,
    value:upgrade.value, desc:upgrade.desc
  };
  inventory.push(inventoryItem);
  renderInventory();
  playSound('upgrade');
  spawnUpgradeParticles();
  document.getElementById('upgradeModal').style.display='none';
  saveProgress();
  setTimeout(()=>startRound(),500);
}

// ===== МАГАЗИН =====
async function showShop() {
  try {
    const res = await fetch('/shop-items');
    const items = await res.json();
    if (!items.length) return;
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'shopModal';
    modal.innerHTML = `
      <div class="modal-content shop-modal-content">
        <h2>🛒 Магазин вечных улучшений</h2>
        <p style="text-align:center;color:#aaa;margin-bottom:15px;">Цена увеличивается на 5 после каждой покупки</p>
        <div id="shopItems" style="display:flex;flex-direction:column;gap:12px;max-height:60vh;overflow-y:auto;">
          ${items.map(item => `
            <div class="shop-item" style="display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.04);border-radius:12px;padding:12px 16px;border:1px solid rgba(255,255,255,0.06);">
              <div>
                <div style="font-weight:600;color:#ffd700;">${item.name}</div>
                <div style="font-size:0.85rem;color:#aaa;">${item.desc}</div>
                <div style="font-size:0.75rem;color:#888;">Куплено: ${item.count || 0}</div>
              </div>
              <button class="buy-btn" data-id="${item.id}" style="padding:6px 18px;border:none;border-radius:20px;background:linear-gradient(135deg,#ffd700,#f0a500);color:#111;font-weight:bold;cursor:pointer;">Купить (${item.currentPrice}🪙)</button>
            </div>
          `).join('')}
        </div>
        <button onclick="closeShop()" class="close-btn" style="margin-top:15px;display:block;margin-left:auto;margin-right:auto;padding:10px 30px;border:none;border-radius:30px;background:#444;color:#fff;cursor:pointer;">Закрыть</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.id;
        buyPermanentUpgrade(itemId);
      });
    });
  } catch(e) {
    showMessage('Ошибка загрузки магазина','error');
  }
}

function closeShop() {
  const modal = document.getElementById('shopModal');
  if (modal) modal.remove();
}

async function buyPermanentUpgrade(itemId) {
  try {
    const res = await fetch('/buy-upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (data.success) {
      showMessage(`✅ Куплено вечное улучшение! Новая цена: ${data.newPrice} 🪙`,'success');
      coins = data.coins;
      document.getElementById('coinsDisplay').textContent = coins;
      shopProgress = data.shopProgress;
      resetGame();
      closeShop();
      showShop();
    } else {
      showMessage(data.error || 'Ошибка', 'error');
    }
  } catch(e) {
    showMessage('Ошибка соединения', 'error');
  }
}

// ===== ЗАДАНИЯ (МОДАЛКА) =====
async function showQuests() {
  questsModalOpen = true;
  try {
    const res = await fetch('/quests');
    const quests = await res.json();
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'questsModal';
    let content = '';
    if (!quests || quests.length === 0) {
      content = '<div style="color:#aaa;padding:20px;text-align:center;">Нет заданий на сегодня</div>';
    } else {
      content = quests.map(q => `
        <div class="quest-item ${q.completed ? 'completed' : ''}" style="background:rgba(255,255,255,0.04);border-radius:12px;padding:12px;border:1px solid rgba(255,255,255,0.06);margin-bottom:10px;">
          <div class="desc">${q.desc}</div>
          <div class="progress" style="margin-top:6px;height:6px;background:#333;border-radius:3px;overflow:hidden;">
            <div class="progress-bar" style="width:${Math.min(100, (q.progress/q.target)*100)}%;height:100%;background:linear-gradient(90deg,#ffd700,#ff8c00);transition:width 0.3s;"></div>
          </div>
          <div class="reward" style="font-size:0.8rem;color:#aaa;margin-top:4px;">🎁 ${q.reward} монет</div>
        </div>
      `).join('');
    }
    modal.innerHTML = `
      <div class="modal-content quest-modal-content">
        <h2>📋 Задания на сегодня</h2>
        <div id="questsList" style="max-height:60vh;overflow-y:auto;margin-top:15px;">
          ${content}
        </div>
        <button onclick="closeQuests()" class="close-btn" style="margin-top:15px;display:block;margin-left:auto;margin-right:auto;padding:10px 30px;border:none;border-radius:30px;background:#444;color:#fff;cursor:pointer;">Закрыть</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-btn').addEventListener('click', () => {
      questsModalOpen = false;
    });
  } catch(e) {
    showMessage('Ошибка загрузки заданий','error');
    questsModalOpen = false;
  }
}

function closeQuests() {
  const modal = document.getElementById('questsModal');
  if (modal) {
    modal.remove();
    questsModalOpen = false;
  }
}

// ===== ОТОБРАЖЕНИЕ =====
function updateDiceDisplay(animate=false){
  diceElements.forEach((el,i)=>{
    if(dice[i]>=1&&dice[i]<=6) el.textContent=DICE_FACES[dice[i]-1];
    else el.textContent='⚀';
    if(animate){ el.classList.remove('rolling'); void el.offsetWidth; el.classList.add('rolling'); }
  });
}

function renderInventory(){
  const container=document.getElementById('inventoryContainer');
  if(!inventory||inventory.length===0){
    container.innerHTML='<div style="color:#666;padding:10px;">Нет улучшений</div>';
    return;
  }
  let html='';
  const reversed=[...inventory].reverse();
  reversed.forEach(item=>{
    const isHand=item.type==='hand';
    const icon=isHand?'🎯':'💀';
    let valueText='';
    if(isHand) valueText=`+${item.value}x`;
    else if(typeof item.value==='object') valueText=`+${item.value.bones}к +${item.value.mult}м`;
    else valueText=`+${item.value}`;
    let activeClass='';
    if(isHand&&item.hand===currentHandType) activeClass=' active';
    html+=`
      <div class="inv-item${activeClass}">
        <div class="inv-name">${icon} ${escapeHtml(item.name)}</div>
        <div class="inv-level">${valueText}</div>
        <div class="inv-price">${escapeHtml(item.desc)}</div>
      </div>
    `;
  });
  container.innerHTML=html;
}

// ===== СОХРАНЕНИЕ =====
async function saveProgress(){
  try{
    await fetch('/update-progress',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        level, limit_score:limit, inventory,
        hand_upgrades:handUpgrades, passive_bonuses:passiveBonuses,
        permanent_upgrades:permanentUpgrades,
        shop_progress:shopProgress,
        stats, coins
      })
    });
  } catch(e){}
}

// ===== ЛИДЕРБОРД, ЧАТ =====
function loadLeaderboard(){
  fetch('/leaderboard')
    .then(res=>res.json())
    .then(data=>{
      const list=document.getElementById('leaderboardList');
      list.innerHTML=data.map((entry,idx)=>`
        <div class="leaderboard-entry">
          <span class="rank">#${idx+1}</span>
          <span class="name">${escapeHtml(entry.username)}</span>
          <span class="level">Ур. ${entry.level}</span>
          <span class="coins">🪙 ${entry.coins}</span>
        </div>
      `).join('');
    });
}

function loadChat(){
  fetch('/chat')
    .then(res=>res.json())
    .then(messages=>{
      const container=document.getElementById('chatMessages');
      container.innerHTML=messages.map(msg=>`
        <div class="chat-message">
          <span class="sender">${escapeHtml(msg.username)}</span>
          <span class="time">${new Date(msg.timestamp).toLocaleTimeString()}</span><br>
          ${escapeHtml(msg.message)}
        </div>
      `).join('');
      container.scrollTop=container.scrollHeight;
    });
}

function sendMessage(){
  const input=document.getElementById('chatInput');
  const text=input.value.trim();
  if(!text) return;
  fetch('/chat',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:text})
  }).then(()=>{ input.value=''; loadChat(); });
}

// ===== ПАНЕЛИ =====
function togglePanel(type) {
  const panels = {
    leaderboard: document.getElementById('leaderboardPanel'),
    chat: document.getElementById('chatPanel')
  };
  const panel = panels[type];
  if (!panel) return;
  if (panel.classList.contains('open')) {
    panel.classList.remove('open');
  } else {
    Object.values(panels).forEach(p => p && p.classList.remove('open'));
    panel.classList.add('open');
    if (type === 'leaderboard') loadLeaderboard();
    if (type === 'chat') loadChat();
  }
}

// ===== ОБУЧЕНИЕ =====
function showTutorial(){ document.getElementById('tutorialModal').classList.add('active'); }
function closeTutorial(){
  document.getElementById('tutorialModal').classList.remove('active');
  fetch('/tutorial-shown',{method:'POST'});
}

// ===== АВТОРИЗАЦИЯ =====
async function register(){
  const username=document.getElementById('loginUsername').value.trim();
  const password=document.getElementById('loginPassword').value.trim();
  if(!username||!password){ showMessage('Заполните все поля','error'); return; }
  try{
    const res=await fetch('/register',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username,password})
    });
    const data=await res.json();
    if(data.success) showMessage('Регистрация успешна! Теперь войдите.','success');
    else showMessage(data.error||'Ошибка','error');
  } catch(e){ showMessage('Ошибка соединения','error'); }
}

async function login(){
  const username=document.getElementById('loginUsername').value.trim();
  const password=document.getElementById('loginPassword').value.trim();
  if(!username||!password){ showMessage('Заполните все поля','error'); return; }
  try{
    const res=await fetch('/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username,password})
    });
    const data=await res.json();
    if(data.success){
      currentUser=data.username;
      document.getElementById('usernameDisplay').textContent=currentUser;
      document.getElementById('authSection').style.display='none';
      document.getElementById('gameSection').style.display='block';
      showMessage('Добро пожаловать!','success');
      loadGameData();
    } else showMessage(data.error||'Ошибка','error');
  } catch(e){ showMessage('Ошибка соединения','error'); }
}

async function logout(){
  await fetch('/logout');
  currentUser=null;
  document.getElementById('authSection').style.display='flex';
  document.getElementById('gameSection').style.display='none';
  showMessage('Вы вышли','success');
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadGameData(){
  try{
    const res=await fetch('/user');
    if(res.ok){
      const data=await res.json();
      level=data.level||1;
      limit=data.limit_score||50;
      coins=data.coins||0;
      inventory=data.inventory||[];
      handUpgrades=data.hand_upgrades||{ high:0, pair:0, twoPair:0, three:0, straight:0, fullHouse:0, four:0, five:0, brokenStraight:0, poker:0, royal:0 };
      passiveBonuses=data.passive_bonuses||{ bones:0, mult:0, rerolls:0, extra_hands:0, limit_reduce:0, combo_bones_mult:null, extra_level:0 };
      permanentUpgrades=data.permanent_upgrades||[];
      shopProgress=data.shop_progress||{};
      stats=data.stats||stats;
      const handsBonus = Object.values(shopProgress)
        .filter(p => p.id && p.id.startsWith('shop_hand_'))
        .reduce((sum, p) => sum + p.value, 0);
      baseHands = 3 + handsBonus;
      document.getElementById('levelDisplay').textContent=level;
      document.getElementById('limitDisplay').textContent=limit;
      document.getElementById('coinsDisplay').textContent=coins;
      renderInventory();
      if(!data.tutorial_shown) showTutorial();
      startRound();
      setInterval(loadChat,5000);
      setInterval(loadCoins,10000);
    }
  } catch(e){ showMessage('Ошибка загрузки данных','error'); }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ =====
function showMessage(text,type){
  const el=document.getElementById('message');
  el.textContent=text;
  el.className=type==='error'?'error-msg':(type==='info'?'result info':'success-msg');
  setTimeout(()=>{el.textContent=''; el.className='';},5000);
}

function escapeHtml(str){
  const div=document.createElement('div');
  div.textContent=str;
  return div.innerHTML;
}

// ===== ПРОВЕРКА СЕССИИ =====
async function fetchUser(){
  try{
    const res=await fetch('/user');
    if(res.ok){
      const data=await res.json();
      if(data.username){
        currentUser=data.username;
        document.getElementById('usernameDisplay').textContent=currentUser;
        document.getElementById('authSection').style.display='none';
        document.getElementById('gameSection').style.display='block';
        level=data.level||1;
        limit=data.limit_score||50;
        coins=data.coins||0;
        inventory=data.inventory||[];
        handUpgrades=data.hand_upgrades||{ high:0, pair:0, twoPair:0, three:0, straight:0, fullHouse:0, four:0, five:0, brokenStraight:0, poker:0, royal:0 };
        passiveBonuses=data.passive_bonuses||{ bones:0, mult:0, rerolls:0, extra_hands:0, limit_reduce:0, combo_bones_mult:null, extra_level:0 };
        permanentUpgrades=data.permanent_upgrades||[];
        shopProgress=data.shop_progress||{};
        stats=data.stats||stats;
        const handsBonus = Object.values(shopProgress)
          .filter(p => p.id && p.id.startsWith('shop_hand_'))
          .reduce((sum, p) => sum + p.value, 0);
        baseHands = 3 + handsBonus;
        document.getElementById('levelDisplay').textContent=level;
        document.getElementById('limitDisplay').textContent=limit;
        document.getElementById('coinsDisplay').textContent=coins;
        renderInventory();
        if(!data.tutorial_shown) showTutorial();
        startRound();
        setInterval(loadChat,5000);
        setInterval(loadCoins,10000);
      }
    }
  } catch(e){}
}
fetchUser();