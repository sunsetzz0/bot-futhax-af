require('dotenv').config();
const GIFEncoder = require('gifencoder');
const { createCanvas, loadImage, registerFont } = require('canvas');
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const EMOJI_COIN = '<:futcoins:1503819954846437406>';

const ACHIEVEMENTS_DEF = [
  // ── Partidos ──
  { id: 'first_win',   emoji: '🏆', nombre: 'First Victory',      desc: 'Win your first Arena match',               tipo: 'arena_win',     objetivo: 1,     reward: { coins: 200  } },
  { id: 'win_10',      emoji: '⚔️', nombre: 'Warrior',            desc: 'Win 10 Arena matches',                     tipo: 'arena_win',     objetivo: 10,    reward: { coins: 500  } },
  { id: 'win_50',      emoji: '🔥', nombre: 'Arena Legend',       desc: 'Win 50 Arena matches',                     tipo: 'arena_win',     objetivo: 50,    reward: { coins: 2000 } },
  { id: 'friendly_10', emoji: '🤝', nombre: 'Social Player',      desc: 'Play 10 friendly matches',                 tipo: 'friendly_play', objetivo: 10,    reward: { coins: 300  } },
  // ── Constancia ──
  { id: 'streak_3',   emoji: '🔥', nombre: 'On Fire',             desc: 'Reach a 3 day streak on !daily',           tipo: 'daily_streak',  objetivo: 3,     reward: { coins: 150  } },
  { id: 'streak_7',   emoji: '⚡', nombre: 'Perfect Week',        desc: 'Reach a 7 day streak on !daily',           tipo: 'daily_streak',  objetivo: 7,     reward: { coins: 400  } },
  { id: 'streak_30',  emoji: '👑', nombre: 'Month on Fire',       desc: 'Reach a 30 day streak on !daily',          tipo: 'daily_streak',  objetivo: 30,    reward: { coins: 2000 } },
  // ── Colección ──
  { id: 'first_pack', emoji: '📦', nombre: 'First Pack',          desc: 'Open your first pack',                     tipo: 'packs_opened',  objetivo: 1,     reward: { coins: 100  } },
  { id: 'packs_10',   emoji: '🎁', nombre: 'Collector',           desc: 'Open 10 packs',                            tipo: 'packs_opened',  objetivo: 10,    reward: { coins: 400  } },
  { id: 'packs_50',   emoji: '🌟', nombre: 'Pack Addict',         desc: 'Open 50 packs',                            tipo: 'packs_opened',  objetivo: 50,    reward: { coins: 1500 } },
  { id: 'legend_card',emoji: '💎', nombre: 'Legendary',           desc: 'Get your first Legendary card',            tipo: 'rarity_owned',  objetivo: 'Legendary', reward: { coins: 800  } },
  { id: 'icon_card',  emoji: '⭐', nombre: 'The Chosen One',      desc: 'Get your first Icon card',                 tipo: 'rarity_owned',  objetivo: 'Icon',       reward: { coins: 3000 } },
  { id: 'full_club',  emoji: '🏟️', nombre: 'Full Squad',          desc: 'Fill your club with 20 players',           tipo: 'club_full',     objetivo: 1,     reward: { coins: 600  } },
  // ── Economía ──
  { id: 'rich_1k',    emoji: '💰', nombre: 'First Savings',       desc: 'Accumulate 1,000 coins',                   tipo: 'coins_total',   objetivo: 1000,  reward: { coins: 0    } },
  { id: 'rich_10k',   emoji: '💵', nombre: 'Junior Millionaire',  desc: 'Accumulate 10,000 coins',                  tipo: 'coins_total',   objetivo: 10000, reward: { coins: 500  } },
  { id: 'rich_50k',   emoji: '🤑', nombre: 'Tycoon',              desc: 'Accumulate 50,000 coins',                  tipo: 'coins_total',   objetivo: 50000, reward: { coins: 2500 } },
  { id: 'sell_10',    emoji: '🏪', nombre: 'Trader',              desc: 'Sell 10 cards on the market',              tipo: 'cards_sold',    objetivo: 10,    reward: { coins: 350  } },
  // ── ELO ──
  { id: 'elo_1200',   emoji: '🔷', nombre: 'Platinum',            desc: 'Reach 1,200 ELO',                          tipo: 'elo_reached',   objetivo: 1200,  reward: { coins: 600  } },
  { id: 'elo_1500',   emoji: '💎', nombre: 'Diamond',             desc: 'Reach 1,500 ELO',                          tipo: 'elo_reached',   objetivo: 1500,  reward: { coins: 1500 } },
  { id: 'elo_1800',   emoji: '👑', nombre: 'Supreme Champion',    desc: 'Reach 1,800 ELO',                          tipo: 'elo_reached',   objetivo: 1800,  reward: { coins: 4000 } },
  // ── Duelos ──
  { id: 'first_duel', emoji: '🥊', nombre: 'First Duel',          desc: 'Participate in your first wagered duel',   tipo: 'duels_played',  objetivo: 1,     reward: { coins: 100  } },
  { id: 'duel_win_5', emoji: '💸', nombre: 'Born Gambler',        desc: 'Win 5 wagered duels',                      tipo: 'duels_won',     objetivo: 5,     reward: { coins: 800  } },
];

// ── Motor de logros ──
// Llama esto después de cualquier acción relevante
function checkLogros(uid, eventType, value = 1) {
  if (!uid) return [];
  const u = data[uid];
  if (!u) return [];
  if (!u.achievements)      u.achievements      = {};
  if (!u.achievementsStats) u.achievementsStats = {};

  const newlyUnlocked = [];

  for (const logro of ACHIEVEMENTS_DEF) {
    if (u.achievements[logro.id]?.unlocked) continue;
    if (logro.tipo !== eventType) continue;
    if (!u.achievementsStats[logro.id]) u.achievementsStats[logro.id] = 0;

    let meetsCondition = false;

    if (logro.tipo === 'rarity_owned') {
      meetsCondition = String(value) === String(logro.objetivo);
    } else if (['coins_total', 'elo_reached', 'daily_streak', 'club_full'].includes(logro.tipo)) {
      meetsCondition = value >= logro.objetivo;
    } else {
      u.achievementsStats[logro.id] += value;
      meetsCondition = u.achievementsStats[logro.id] >= logro.objetivo;
    }

    if (meetsCondition) {
      u.achievements[logro.id] = { unlocked: true, date: Date.now() };
      if (logro.reward?.coins) u.coins = (u.coins || 0) + logro.reward.coins;
      newlyUnlocked.push(logro);
    }
  }

  if (newlyUnlocked.length) saveData();
  return newlyUnlocked;
}

// Helper para anunciar logros desbloqueados en el canal
// Úsalo así: await announceLogros(message, logrosArray);
async function announceLogros(message, logros) {
  for (const l of logros) {
    await message.channel.send({
      embeds: [{
        color: 0xFFD700,
        title: `🏆 ¡Achievement unlocked!`,
        description: [
          `${l.emoji} **${l.nombre}**`,
          `_${l.desc}_`,
          ``,
          l.reward?.coins > 0
            ? `💰 **+${l.reward.coins.toLocaleString()} 💰** added to your balance.`
            : `✅ Recorded achievement.`,
        ].join('\n'),
        footer: { text: 'Use !achievements to see all your achievements' },
        timestamp: new Date().toISOString()
      }]
    }).catch(() => {});
  }
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = '.';

process.on('unhandledRejection', (error) => {
  console.error('[UnhandledRejection]', error);
});

process.on('uncaughtException', (error) => {
  console.error('[UncaughtException]', error);
});

// ─────────────────────────────────────────
// 🔤 FUENTE FIFA
// ─────────────────────────────────────────
let FIFA_FONT = 'Arial';
const fontPaths = [
  { file: './assets/Rajdhani-Bold.ttf',     family: 'Rajdhani'  },
  { file: './assets/Exo2-Bold.ttf',         family: 'Exo2'      },
  { file: './assets/BebasNeue-Regular.ttf', family: 'BebasNeue' },
];
for (const fp of fontPaths) {
  if (fs.existsSync(fp.file)) {
    try { registerFont(fp.file, { family: fp.family }); FIFA_FONT = fp.family; break; } catch {}
  }
}

// ─────────────────────────────────────────
// 👑 SISTEMA MULTI-ADMIN
// ─────────────────────────────────────────
const superAdminId = "470690716755165194";
let admins = new Set([superAdminId]);
if (fs.existsSync('/app/data/admins.json')) {
  const loaded = JSON.parse(fs.readFileSync('/app/data/admins.json'));
  loaded.forEach(id => admins.add(id));
}
function saveAdmins() { fs.writeFileSync('/app/data/admins.json', JSON.stringify([...admins], null, 2)); }
function isAdmin(userId) { return admins.has(userId); }

// ─────────────────────────────────────────
// 🔨 SISTEMA DE BANS
// ─────────────────────────────────────────
let bannedUsers = new Set();
if (fs.existsSync('/app/data/bans.json')) {
  const loadedBans = JSON.parse(fs.readFileSync('/app/data/bans.json'));
  loadedBans.forEach(id => bannedUsers.add(id));
}
function saveBans() { fs.writeFileSync('/app/data/bans.json', JSON.stringify([...bannedUsers], null, 2)); }
function isBanned(userId) { return bannedUsers.has(userId); }

// ─────────────────────────────────────────
// ⏱️ COOLDOWNS
// ─────────────────────────────────────────
const cooldowns = new Map();
const COOLDOWN_MS = 2000;
const arenaCooldowns = new Map();
const ARENA_COOLDOWN_MS = 15 * 60 * 1000;
const friendlyCooldowns = new Map();
const FRIENDLY_COOLDOWN_MS = 3 * 60 * 1000;


let forcedResult = null;
let forcedForUser = null;

// ─────────────────────────────────────────
// 🏟️ COLA DE ARENA
// ─────────────────────────────────────────
const arenaQueue = new Map();
const ARENA_QUEUE_TIMEOUT = 5 * 60 * 1000;

// ─────────────────────────────────────────
// 📁 DATOS
// ─────────────────────────────────────────
let data = {};
if (fs.existsSync('/app/data/data.json')) data = JSON.parse(fs.readFileSync('/app/data/data.json'));
function saveData() { fs.writeFileSync('/app/data/data.json', JSON.stringify(data, null, 2)); }

// ─── MARKET DINÁMICO ───
// Estructura de cada listing:
// { id, sellerId, sellerName, player, price, listedAt }
let marketListings = [];
if (fs.existsSync('/app/data/market.json')) {
  marketListings = JSON.parse(fs.readFileSync('/app/data/market.json'));
}
function saveMarket() { fs.writeFileSync('/app/data/market.json', JSON.stringify(marketListings, null, 2)); }

// Expirar listings cada 10 minutos
setInterval(() => {
  const now = Date.now();
  const expired = marketListings.filter(l => now - l.listedAt > MARKET_LISTING_TTL);
  for (const listing of expired) {
    // Devolver carta al dueño
    if (data[listing.sellerId]) {
      if (!data[listing.sellerId].players) data[listing.sellerId].players = [];
      data[listing.sellerId].players.push(listing.player);
    }
  }
  if (expired.length > 0) {
    marketListings = marketListings.filter(l => now - l.listedAt <= MARKET_LISTING_TTL);
    saveMarket();
    saveData();
    console.log(`[Market] ${expired.length} listing(s) expirados y devueltos a sus dueños.`);
  }
}, 10 * 60 * 1000);



let tournaments = {};
if (fs.existsSync('/app/data/tournaments.json')) {
  try { tournaments = JSON.parse(fs.readFileSync('/app/data/tournaments.json')); } catch {}
}
function saveTournaments() {
  fs.writeFileSync('/app/data/tournaments.json', JSON.stringify(tournaments, null, 2));
}
 
let questsData = {};
if (fs.existsSync('/app/data/quests.json')) {
  try { questsData = JSON.parse(fs.readFileSync('/app/data/quests.json')); } catch {}
}
function saveQuests() {
  fs.writeFileSync('/app/data/quests.json', JSON.stringify(questsData, null, 2));
}
 
// ── Pool de misiones ──
const QUEST_POOL = [
{ id: 'play_friendly',  difficulty: 'easy',   desc: 'Play 1 friendly match',          type: 'friendly_played',  target: 1, reward: { coins: 150 } },
  { id: 'open_any_pack',  difficulty: 'easy',   desc: 'Open 1 pack',                    type: 'pack_opened',      target: 1, reward: { coins: 120 } },
  { id: 'visit_market',   difficulty: 'easy',   desc: 'Visit the market (!market)',      type: 'market_visited',   target: 1, reward: { coins: 100 } },
  { id: 'win_friendly',   difficulty: 'medium', desc: 'Win 2 friendly matches',          type: 'friendly_won',     target: 2, reward: { coins: 300 } },
  { id: 'sell_2cards',    difficulty: 'medium', desc: 'Sell 2 cards on the market',      type: 'card_sold',        target: 2, reward: { coins: 250 } },
  { id: 'play_arena',     difficulty: 'medium', desc: 'Play 1 Arena match',              type: 'arena_played',     target: 1, reward: { coins: 280 } },
  { id: 'win_arena_x2',   difficulty: 'hard',   desc: 'Win 2 Arena matches',             type: 'arena_won',        target: 2, reward: { coins: 600 } },
  { id: 'open_gold_plus', difficulty: 'hard',   desc: 'Open 1 Gold pack or higher',      type: 'gold_pack_opened', target: 1, reward: { coins: 500 } },
  { id: 'sell_epic_plus', difficulty: 'hard',   desc: 'Sell 1 Epic card or better',      type: 'epic_sold',        target: 1, reward: { coins: 550 } },
];
const DIFF_EMOJI = { easy: '🟢', medium: '🟡', hard: '🔴' };
const DIFF_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
 
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
 
function getOrCreateUserQuests(uid) {
  const today = getTodayKey();
  if (!questsData[uid] || questsData[uid].date !== today) {
    const pick = arr => ({ ...arr[Math.floor(Math.random() * arr.length)], progress: 0, completed: false, claimed: false });
    questsData[uid] = {
      date: today,
      quests: [
        pick(QUEST_POOL.filter(q => q.difficulty === 'easy')),
        pick(QUEST_POOL.filter(q => q.difficulty === 'medium')),
        pick(QUEST_POOL.filter(q => q.difficulty === 'hard')),
      ]
    };
    saveQuests();
  }
  return questsData[uid].quests;
}
 
function progressQuest(uid, eventType, amount = 1) {
  if (!uid) return;
  const quests = getOrCreateUserQuests(uid);
  let changed = false;
  for (const q of quests) {
    if (q.type === eventType && !q.completed) {
      q.progress = Math.min(q.target, q.progress + amount);
      if (q.progress >= q.target) q.completed = true;
      changed = true;
    }
  }
  if (changed) saveQuests();
}
 
// ── Tournament helpers ──
function mkTournamentId() { return 'T' + Date.now().toString(36).toUpperCase(); }
 
function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
 
function buildBracket(participants) {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(participants.length, 2))));
  const seeded = shuffleArr([...participants]);
  while (seeded.length < size) seeded.push(null);
  const rounds = [];
  let current = seeded;
  while (current.length > 1) {
    const matches = [];
    for (let i = 0; i < current.length; i += 2)
      matches.push({ p1: current[i], p2: current[i+1], winner: null, score: null });
    rounds.push(matches);
    current = new Array(matches.length).fill(null);
  }
  return rounds;
}
 
function advanceBracket(t) {
  const r = t.currentRound;
  if (r >= t.rounds.length) return;
  const cur = t.rounds[r];
  for (const m of cur) {
    if (m.winner === null) {
      if (!m.p1 && m.p2)  m.winner = m.p2.id;
      if (!m.p2 && m.p1)  m.winner = m.p1.id;
    }
  }
  const allDone = cur.every(m => m.winner !== null);
  if (allDone && r + 1 < t.rounds.length) {
    const next = t.rounds[r + 1];
    cur.forEach((m, i) => {
      const w = t.participants.find(p => p.id === m.winner) || null;
      if (i % 2 === 0) next[Math.floor(i/2)].p1 = w;
      else             next[Math.floor(i/2)].p2 = w;
    });
    t.currentRound = r + 1;
    advanceBracket(t); // recursivo para BYEs
  } else if (allDone && r + 1 >= t.rounds.length) {
    t.champion = cur[0].winner;
    t.status = 'finished';
  }
}
 
function getTournamentStatus(t) {
  if (t.status === 'waiting')  return '🟡 Open registration';
  if (t.status === 'active')   return '🟢 In progress';
  if (t.status === 'finished') return '🏁 Finalized';
  return '❓';
}
 
function getTournamentPrizes(pool) {
  return {
    champion:  Math.round(pool * 0.50),
    runnerUp:  Math.round(pool * 0.25),
    semifinal: Math.round(pool * 0.125),
  };
}
 
async function drawBracketCanvas(t) {
  const rounds = t.rounds;
  const numR = rounds.length;
  if (!numR) return null;
  const maxM = rounds[0].length;
  const MH = 64, MW = 195, CGAP = 52, PAD_X = 30, PAD_Y = 72;
  const slotH = 86;
  const TW = numR * (MW + CGAP) + PAD_X * 2;
  const TH = maxM * slotH + PAD_Y * 2;
  const canvas = createCanvas(Math.max(TW, 500), Math.max(TH, 300));
  const ctx = canvas.getContext('2d');
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, '#08080f'); bg.addColorStop(1, '#101025');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.globalAlpha = 0.05;
  for (let x = 20; x < canvas.width; x += 25)
    for (let y = 20; y < canvas.height; y += 25) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2);
      ctx.fillStyle = '#fff'; ctx.fill();
    }
  ctx.restore();
  ctx.save();
  ctx.font = `bold 22px Arial`; ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700'; ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 14;
  ctx.fillText(`🏆  ${t.name}`, canvas.width/2, 38);
  ctx.shadowBlur = 0;
  ctx.font = `12px Arial`; ctx.fillStyle = '#ffffff55';
  ctx.fillText(`${t.participants.length} participantes  ·  ${getTournamentStatus(t)}`, canvas.width/2, 56);
  ctx.restore();
  const RN = ['FINAL','SEMIFINAL','CUARTOS','OCTAVOS','R16','R32'];
  rounds.forEach((matches, ri) => {
    const colX = PAD_X + ri * (MW + CGAP);
    const spm = maxM / matches.length;
    const rName = RN[numR - 1 - ri] || `R${ri+1}`;
    ctx.save(); ctx.font = `bold 10px Arial`; ctx.fillStyle = '#FFD700BB';
    ctx.textAlign = 'center'; ctx.fillText(rName, colX + MW/2, PAD_Y - 14); ctx.restore();
    matches.forEach((match, mi) => {
      const mY = PAD_Y + (mi * spm + spm/2) * slotH / (maxM / maxM) - MH/2 + mi * (slotH - MH);
      const centerY = PAD_Y + mi * (TH - PAD_Y*2) / maxM + (TH - PAD_Y*2) / maxM / 2;
      const drawY = PAD_Y + mi * ((TH - PAD_Y*2) / matches.length) + ((TH - PAD_Y*2) / matches.length - MH) / 2;
      const p1 = match.p1, p2 = match.p2;
      const done = match.winner !== null;
      const p1Won = done && match.winner === p1?.id;
      const p2Won = done && match.winner === p2?.id;
      ctx.save();
      ctx.shadowColor = done ? '#00C851' : '#FFD700'; ctx.shadowBlur = done ? 8 : 4;
      ctx.beginPath(); ctx.roundRect(colX, drawY, MW, MH, 8);
      ctx.fillStyle = done ? '#0d1f10' : '#10101e'; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = done ? '#00C85155' : '#FFD70033'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(colX+8, drawY+MH/2); ctx.lineTo(colX+MW-8, drawY+MH/2); ctx.stroke(); ctx.restore();
      const name1 = p1 ? (p1.username||p1.id).substring(0,15) : 'BYE';
      const name2 = p2 ? (p2.username||p2.id).substring(0,15) : 'BYE';
      const elo1 = p1 ? `${getEloTier(data[p1.id]?.elo||1000).emoji} ${data[p1.id]?.elo||1000}` : '';
      const elo2 = p2 ? `${getEloTier(data[p2.id]?.elo||1000).emoji} ${data[p2.id]?.elo||1000}` : '';
      ctx.save();
      ctx.font = `bold 12px Arial`; ctx.textAlign = 'left';
      ctx.fillStyle = p1Won ? '#00ff88' : p1 ? '#ffffff' : '#444444';
      if (p1Won) { ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 7; }
      ctx.fillText((p1Won?'👑 ':'')+name1, colX+8, drawY+MH/2-9); ctx.shadowBlur=0;
      ctx.font = `10px Arial`; ctx.fillStyle = '#777777'; ctx.fillText(elo1, colX+8, drawY+MH/2+2);
      ctx.font = `bold 12px Arial`;
      ctx.fillStyle = p2Won ? '#00ff88' : p2 ? '#ffffffcc' : '#444444';
      if (p2Won) { ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 7; }
      ctx.fillText((p2Won?'👑 ':'')+name2, colX+8, drawY+MH/2+17); ctx.shadowBlur=0;
      ctx.font = `10px Arial`; ctx.fillStyle = '#777777'; ctx.fillText(elo2, colX+8, drawY+MH/2+28);
      if (match.score) {
        ctx.font = `bold 11px Arial`; ctx.fillStyle = '#FFD700'; ctx.textAlign = 'right';
        ctx.fillText(match.score, colX+MW-8, drawY+MH/2+4);
      }
      ctx.restore();
      if (ri < numR - 1) {
        const nextSpm = maxM / (matches.length/2);
        const nextMi = Math.floor(mi/2);
        const nextDrawY = PAD_Y + nextMi * ((TH-PAD_Y*2)/(matches.length/2)) + ((TH-PAD_Y*2)/(matches.length/2)-MH)/2;
        const targetY = nextDrawY + (mi%2===0 ? MH/4 : MH*3/4);
        const midX = colX + MW + CGAP/2;
        ctx.save(); ctx.strokeStyle = done ? '#00C85133':'#ffffff15'; ctx.lineWidth=1.5; ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(colX+MW, drawY+MH/2); ctx.lineTo(midX, drawY+MH/2);
        ctx.lineTo(midX, targetY); ctx.lineTo(colX+MW+CGAP, targetY); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
    });
  });
  return canvas;
}
 
// ── startTournament — función suelta (pegar junto a playMatchEngine) ──
async function startTournament(tId, interaction, tMsg, tCol) {
  const t = tournaments[tId];
  if (!t || t.status !== 'waiting') return;
  t.status = 'active';
  t.rounds = buildBracket(t.participants);
  t.currentRound = 0;
  advanceBracket(t);
  saveTournaments();
  if (tCol) tCol.stop();
  const bracketCanvas = await drawBracketCanvas(t).catch(() => null);
  const files = bracketCanvas ? [{ attachment: bracketCanvas.toBuffer(), name: 'bracket.png' }] : [];
  const r = t.rounds[t.currentRound];
  const matchupLines = r.map((m, i) => {
    const p1 = m.p1 ? `@${m.p1.username}` : 'BYE';
    const p2 = m.p2 ? `@${m.p2.username}` : 'BYE';
    if (m.winner) return `~~**Partido ${i+1}:** ${p1} vs ${p2}~~ (BYE)`;
    return `**Partido ${i+1}:** ${p1}  vs  ${p2}`;
  }).join('\n');
  const mentions = t.participants.map(p => `<@${p.id}>`).join(' ');
  const embed = {
    color: 0x00C851,
    title: `🏆 ¡${t.name} has started!`,
    description: [
      mentions, '',
      `**${t.participants.length} jugadores** luchando por **${t.prizes.champion.toLocaleString()} 💰**!`,
      '', `**📋 Round 1:**`, matchupLines, '',
      `⚔️ Use \`.tournament play ${tId}\` to play your game.`,
      `📊 Use \`.tournament bracket ${tId}\` to see the bracket.`,
    ].join('\n'),
    fields: [
      { name: '🥇 Champion',        value: `${t.prizes.champion.toLocaleString()} 💰`,  inline: true },
      { name: '🥈 Finalist',      value: `${t.prizes.runnerUp.toLocaleString()} 💰`,  inline: true },
      { name: '🥉 Semifinalists', value: `${t.prizes.semifinal.toLocaleString()} 💰`, inline: true },
    ],
    image: bracketCanvas ? { url: 'attachment://bracket.png' } : undefined,
    footer: { text: `ID del torneo: ${tId}` },
    timestamp: new Date().toISOString()
  };
  if (interaction?.update) {
    await interaction.update({ embeds: [embed], files, components: [] }).catch(e => console.error('[startTournament]', e));
  } else if (tMsg) {
    await tMsg.edit({ embeds: [embed], files, components: [] }).catch(e => console.error('[startTournament]', e));
  }
}


// ─────────────────────────────────────────
// 🧩 JUGADORES
// ─────────────────────────────────────────
function mkp(name, rating, position, rarity, stats) {
  return { name, rating, rarity, position, stats: stats || {} };
}

const players = [


mkp("Feeling", 84, "ST", "Especial", {PAC:87,SHO:88,PAS:72,DRI:83,DEF:45,PHY:82}),



mkp("DIEGO",      96, "ST", "Icon", {PAC:95,SHO:97,PAS:95,DRI:98,DEF:72,PHY:97}),
mkp("Panda",      96, "GK", "Icon", {DIV:96,REF:98,HAN:96,KIC:97,POS:95}),
mkp("Caslu",      95, "DM", "Icon", {PAC:92,SHO:90,PAS:96,DRI:97,DEF:64,PHY:87}),
mkp("Hardem",     93, "ST", "Icon", {PAC:91,SHO:94,PAS:89,DRI:96,DEF:61,PHY:86}),
mkp("Zarco",      93, "AM", "Icon", {PAC:93,SHO:91,PAS:96,DRI:97,DEF:65,PHY:88}),
mkp("Kermit ICON",94, "DM", "Icon", {PAC:92,SHO:90,PAS:96,DRI:97,DEF:64,PHY:87}),
mkp("Real",       95, "ST", "Icon", {PAC:96,SHO:97,PAS:93,DRI:95,DEF:68,PHY:94}),
mkp("Rad1",       93, "AM", "Icon", {PAC:93,SHO:91,PAS:96,DRI:97,DEF:65,PHY:88}),
mkp("Checo",      94, "DM", "Icon", {PAC:94,SHO:87,PAS:95,DRI:95,DEF:97,PHY:96}),
mkp("Mondaman",   93, "AM", "Icon", {PAC:92,SHO:90,PAS:96,DRI:97,DEF:64,PHY:87}),
mkp("Zyros ICON", 94, "AM", "Icon", {PAC:93,SHO:91,PAS:95,DRI:97,DEF:63,PHY:88}),
mkp("P4er",       96, "AM", "Icon", {PAC:96,SHO:95,PAS:99,DRI:99,DEF:70,PHY:91}),
mkp("Lorenzi",    94, "AM", "Icon", {PAC:91,SHO:89,PAS:95,DRI:96,DEF:62,PHY:86}),
mkp("Pardo",      94, "DM", "Icon", {PAC:93,SHO:85,PAS:94,DRI:93,DEF:96,PHY:95}),
mkp("BryanCisf",  93, "ST", "Icon", {PAC:91,SHO:94,PAS:89,DRI:96,DEF:61,PHY:86}),
mkp("RX",         93, "ST", "Icon", {PAC:94,SHO:95,PAS:90,DRI:93,DEF:65,PHY:92}),
mkp("Mecha",      93, "GK", "Icon", {DIV:92,REF:94,HAN:91,KIC:92,POS:93}),
mkp("Zombot ICON",94, "GK", "Icon", {DIV:94,REF:96,HAN:93,KIC:94,POS:95}),
mkp("Disk",       92, "AM", "Icon", {PAC:90,SHO:88,PAS:93,DRI:95,DEF:60,PHY:85}),
mkp("P1nguano",   93, "DM", "Icon", {PAC:92,SHO:90,PAS:96,DRI:97,DEF:64,PHY:87}),
mkp("Doxing",     95, "AM", "Icon", {PAC:93,SHO:91,PAS:97,DRI:98,DEF:65,PHY:89}),

  mkp("Kyo",         93, "ST", "WorldCup", {PAC:96,SHO:90,PAS:97,DRI:97,DEF:99,PHY:97}),
  mkp("Vak",         93, "AM", "WorldCup", {PAC:96,SHO:98,PAS:90,DRI:97,DEF:70,PHY:94}),
  mkp("Sekai WC",    93, "DM", "WorldCup", {PAC:96,SHO:98,PAS:90,DRI:97,DEF:70,PHY:94}),
  mkp("Luntek WC",   93, "GK", "WorldCup", {DIV:97,REF:96,HAN:94,KIC:95,POS:96}),
  mkp("Pixel WC",    94, "ST", "WorldCup", {PAC:97,SHO:99,PAS:95,DRI:96,DEF:75,PHY:96}),
  mkp("Mazda",       93, "ST", "WorldCup", {PAC:95,SHO:91,PAS:96,DRI:94,DEF:96,PHY:96}),
  mkp("Facha",       92, "DM", "WorldCup", {PAC:95,SHO:97,PAS:92,DRI:94,DEF:68,PHY:93}),
  mkp("Compass WC",  94, "DM", "WorldCup", {PAC:98,SHO:93,PAS:97,DRI:98,DEF:99,PHY:98}),
  mkp("Father WC",   94, "GK", "WorldCup", {DIV:97,REF:99,HAN:97,KIC:96,POS:99}),
  mkp("Czerro WC",   94, "DM", "WorldCup", {PAC:98,SHO:93,PAS:98,DRI:98,DEF:99,PHY:97}),
  mkp("Fusion",      92, "DM", "WorldCup", {PAC:95,SHO:91,PAS:96,DRI:96,DEF:98,PHY:96}),
  mkp("Thunder",     92, "AM", "WorldCup", {PAC:96,SHO:95,PAS:97,DRI:98,DEF:78,PHY:94}),
  mkp("Shott",       92, "AM", "WorldCup", {PAC:95,SHO:96,PAS:97,DRI:98,DEF:76,PHY:93}),
  mkp("Cervi WC",    93, "ST", "WorldCup", {PAC:95,SHO:98,PAS:94,DRI:96,DEF:72,PHY:95}),
  mkp("Hitlerinho",  93, "AM", "WorldCup", {PAC:95,SHO:95,PAS:97,DRI:99,DEF:74,PHY:93}),
  mkp("Ken",         92, "AM", "WorldCup", {PAC:94,SHO:94,PAS:96,DRI:97,DEF:72,PHY:92}),
  mkp("Rodrigo",     92, "GK", "WorldCup", {DIV:95,REF:97,HAN:95,KIC:94,POS:97}),
  mkp("Murillo",     93, "ST", "WorldCup", {PAC:96,SHO:98,PAS:91,DRI:95,DEF:70,PHY:94}),
  mkp("Magico",      93, "ST", "WorldCup", {PAC:95,SHO:97,PAS:92,DRI:96,DEF:68,PHY:93}),
  mkp("N+23",        93, "GK", "WorldCup", {DIV:94,REF:96,HAN:94,KIC:93,POS:96}),
  mkp("Becken",      91, "GK", "WorldCup", {DIV:93,REF:95,HAN:93,KIC:92,POS:95}),


  mkp("Luntek",       91, "ST", "Legendary", {PAC:96,SHO:98,PAS:90,DRI:97,DEF:70,PHY:94}),
  mkp("Compass",      92, "DM", "Legendary", {PAC:97,SHO:91,PAS:93,DRI:98,DEF:98,PHY:97}),
  mkp("Veil",         91, "AM", "Legendary", {PAC:95,SHO:95,PAS:90,DRI:96,DEF:80,PHY:90}),
  mkp("Sekai",        90, "DM", "Legendary", {PAC:94,SHO:94,PAS:93,DRI:97,DEF:98,PHY:97}),
  mkp("Czerro",       91, "DM", "Legendary", {PAC:97,SHO:91,PAS:95,DRI:97,DEF:98,PHY:95}),
  mkp("Amp",          91, "ST", "Legendary", {PAC:95,SHO:93,PAS:92,DRI:95,DEF:72,PHY:92}),
  mkp("Cervi",        90, "ST", "Legendary", {PAC:91,SHO:92,PAS:93,DRI:90,DEF:73,PHY:92}),
  mkp("Levaldo",      89, "DM", "Legendary", {PAC:86,SHO:87,PAS:89,DRI:90,DEF:95,PHY:94}),
  mkp("Mirkoller",    90, "GK", "Legendary", {DIV:93,REF:98,HAN:94,KIC:94,POS:96}),
  mkp("Pixel",        91, "ST", "Legendary", {PAC:94,SHO:96,PAS:93,DRI:90,DEF:80,PHY:94}),
  mkp("Quesonub",     89, "DM", "Legendary", {PAC:90,SHO:89,PAS:94,DRI:90,DEF:96,PHY:93}),
  mkp("Aoi",          89, "DM", "Legendary", {PAC:90,SHO:88,PAS:91,DRI:94,DEF:94,PHY:94}),
  mkp("Father",       89, "GK", "Legendary", {DIV:90,REF:93,HAN:90,KIC:90,POS:91}),
  mkp("Kayn",         91, "AM", "Legendary", {PAC:90,SHO:93,PAS:93,DRI:95,DEF:80,PHY:91}),
  mkp("Lyreco",       91, "ST", "Legendary", {PAC:93,SHO:95,PAS:87,DRI:90,DEF:76,PHY:91}),
  mkp("Paul",         90, "AM", "Legendary", {PAC:92,SHO:92,PAS:93,DRI:95,DEF:77,PHY:92}),
  mkp("Dqvid",        86, "DM", "Legendary", {PAC:84,SHO:80,PAS:90,DRI:87,DEF:93,PHY:90}),
  mkp("Gerardosky",   87, "DM", "Legendary", {PAC:83,SHO:80,PAS:90,DRI:86,DEF:93,PHY:93}),
  mkp("Guns",         87, "ST", "Legendary", {PAC:90,SHO:94,PAS:87,DRI:88,DEF:73,PHY:92}),
  mkp("Zyros",        87, "AM", "Legendary", {PAC:91,SHO:90,PAS:91,DRI:95,DEF:76,PHY:92}),
  mkp("Dimiliano",    89, "ST", "Legendary", {PAC:91,SHO:90,PAS:87,DRI:94,DEF:70,PHY:90}),
  mkp("Kaiser",       88, "ST", "Legendary", {PAC:92,SHO:95,PAS:84,DRI:93,DEF:70,PHY:90}),
  mkp("Pechuga",      87, "AM", "Legendary", {PAC:90,SHO:87,PAS:92,DRI:89,DEF:80,PHY:92}),
  mkp("Shepard",      88, "ST", "Legendary", {PAC:91,SHO:97,PAS:85,DRI:87,DEF:70,PHY:92}),
  mkp("Zombot",       87, "GK", "Legendary", {DIV:88,REF:88,HAN:86,KIC:87,POS:87}),
  

  mkp("Bachira",      84, "AM", "Epic",      {PAC:83,SHO:85,PAS:89,DRI:96,DEF:60,PHY:85}),
  mkp("Fallen",       85, "DM", "Epic",      {PAC:82,SHO:80,PAS:85,DRI:86,DEF:87,PHY:86}),
  mkp("Roki",         85, "AM", "Epic",      {PAC:86,SHO:87,PAS:85,DRI:95,DEF:70,PHY:90}),
  mkp("Zae",          85, "AM", "Epic",      {PAC:83,SHO:85,PAS:89,DRI:87,DEF:67,PHY:84}),
  mkp("N+23",         85, "GK", "Epic",      {DIV:86,REF:89,HAN:85,KIC:81,POS:87}),
  mkp("Pain",         84, "DM", "Epic",      {PAC:81,SHO:70,PAS:82,DRI:88,DEF:90,PHY:86}),
  mkp("Pinotek",      84, "AM", "Epic",      {PAC:82,SHO:84,PAS:88,DRI:89,DEF:56,PHY:71}),
  mkp("Sixer",        84, "DM", "Epic",      {PAC:81,SHO:68,PAS:82,DRI:80,DEF:89,PHY:86}),
  mkp("Smurf",        84, "GK", "Epic",      {DIV:85,REF:88,HAN:84,KIC:80,POS:86}),
  mkp("Cosmik",       84, "ST", "Epic",      {PAC:80,SHO:94,PAS:75,DRI:84,DEF:64,PHY:87}),
  mkp("Usu",          85, "ST", "Epic",      {PAC:88,SHO:88,PAS:75,DRI:84,DEF:63,PHY:84}),
  mkp("Kermit",       84, "DM", "Epic",      {PAC:80,SHO:73,PAS:85,DRI:83,DEF:90,PHY:85}),
  mkp("Whoisalex",    84, "DM", "Epic",      {PAC:83,SHO:86,PAS:81,DRI:89,DEF:84,PHY:85}),
  mkp("Diseased",     84, "ST", "Epic",      {PAC:87,SHO:90,PAS:75,DRI:83,DEF:47,PHY:79}),
  mkp("Raz",          84, "ST", "Epic",      {PAC:87,SHO:90,PAS:74,DRI:83,DEF:53,PHY:86}),
  mkp("Allan Saint",  82, "DM", "Epic",      {PAC:79,SHO:66,PAS:80,DRI:78,DEF:87,PHY:84}),
  mkp("Korai",        82, "DM", "Epic",      {PAC:79,SHO:66,PAS:80,DRI:78,DEF:87,PHY:84}),
  mkp("Lawliet",      83, "AM", "Epic",      {PAC:80,SHO:80,PAS:83,DRI:83,DEF:53,PHY:74}),
  mkp("Metzi",        83, "DM", "Epic",      {PAC:80,SHO:82,PAS:86,DRI:87,DEF:56,PHY:70}),
  mkp("Nocke",        82, "AM", "Epic",      {PAC:80,SHO:82,PAS:86,DRI:87,DEF:56,PHY:75}),
  mkp("Saskee",       82, "ST", "Epic",      {PAC:80,SHO:82,PAS:86,DRI:89,DEF:65,PHY:70}),
  mkp("369",          82, "ST", "Epic",      {PAC:86,SHO:86,PAS:74,DRI:82,DEF:46,PHY:78}),
  mkp("Rose",         81, "ST", "Epic",      {PAC:86,SHO:88,PAS:74,DRI:79,DEF:46,PHY:87}),
  mkp("Anon",         81, "DM", "Rare",      {PAC:78,SHO:65,PAS:79,DRI:77,DEF:86,PHY:83}),
  mkp("Paloma",       80, "DM", "Rare",      {PAC:77,SHO:64,PAS:78,DRI:76,DEF:85,PHY:82}),

  mkp("Coutinho",     83, "GK", "Epic",       {DIV:83,REF:86,HAN:82,KIC:80,POS:84}),
  mkp("Lothar",       83, "GK", "Epic",       {DIV:83,REF:86,HAN:82,KIC:80,POS:84}),
  mkp("Cold",         83, "DM", "Epic",       {PAC:82,SHO:70,PAS:80,DRI:85,DEF:87,PHY:84}),
  mkp("Reckless",     84, "DM", "Epic",       {PAC:80,SHO:70,PAS:87,DRI:76,DEF:90,PHY:88}),
  mkp("Shadow",       84, "DM", "Epic",       {PAC:80,SHO:74,PAS:81,DRI:87,DEF:88,PHY:85}),
  mkp("V2",           83, "AM", "Epic",       {PAC:80,SHO:82,PAS:86,DRI:84,DEF:66,PHY:83}),
  mkp("Ratchet",      82, "DM", "Rare",       {PAC:78,SHO:65,PAS:79,DRI:77,DEF:87,PHY:83}),
  mkp("SK1N1",        82, "DM", "Rare",       {PAC:78,SHO:65,PAS:79,DRI:80,DEF:86,PHY:83}),
  mkp("Sqai",         82, "ST", "Rare",       {PAC:85,SHO:84,PAS:72,DRI:80,DEF:45,PHY:76}),
  mkp("Hog",          82, "GK", "Rare",       {DIV:82,REF:85,HAN:81,KIC:78,POS:83}),
  mkp("Dross",        81, "AM", "Rare",       {PAC:78,SHO:80,PAS:84,DRI:85,DEF:54,PHY:69}),
  mkp("Everest",      81, "GK", "Rare",       {DIV:81,REF:84,HAN:80,KIC:77,POS:82}),
  mkp("Hisoka",       81, "GK", "Rare",       {DIV:81,REF:84,HAN:80,KIC:77,POS:82}),
  mkp("Nizy",         81, "ST", "Rare",       {PAC:84,SHO:83,PAS:71,DRI:79,DEF:44,PHY:75}),
  mkp("Feeling Jrzz", 73, "ST", "Common",       {PAC:79,SHO:78,PAS:66,DRI:74,DEF:42,PHY:70}),
  mkp("Ukz",          81, "DM", "Rare",       {PAC:77,SHO:64,PAS:78,DRI:76,DEF:85,PHY:82}),
  mkp("Apolo",        80, "AM", "Rare",       {PAC:76,SHO:78,PAS:82,DRI:83,DEF:52,PHY:68}),
  mkp("Birkir",       80, "DM", "Rare",       {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Burrito",      80, "DM", "Rare",       {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Culon",        80, "DM", "Rare",       {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Mr.Esperma",   80, "DM", "Rare",       {PAC:75,SHO:62,PAS:76,DRI:84,DEF:81,PHY:75}),
  mkp("Pianoplayer",  80, "AM", "Rare",       {PAC:76,SHO:78,PAS:82,DRI:83,DEF:52,PHY:68}),
  mkp("Second",       80, "DM", "Rare",       {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Shoe",         81, "AM", "Rare",       {PAC:77,SHO:79,PAS:83,DRI:84,DEF:53,PHY:68}),
  mkp("Strange",      80, "AM", "Rare",       {PAC:76,SHO:78,PAS:82,DRI:83,DEF:52,PHY:68}),
  mkp("Theandrex",    81, "ST", "Rare",       {PAC:83,SHO:82,PAS:70,DRI:78,DEF:44,PHY:74}),
  mkp("Vincenzo",     84, "AM", "Rare",       {PAC:79,SHO:81,PAS:85,DRI:86,DEF:54,PHY:69}),
  mkp("Walham",       80, "GK", "Rare",       {DIV:80,REF:83,HAN:79,KIC:76,POS:81}),
  mkp("Cat",          80, "GK", "Rare",       {DIV:80,REF:83,HAN:79,KIC:76,POS:81}),
  mkp("Bonice",       74, "DM", "Common",       {PAC:69,SHO:58,PAS:72,DRI:70,DEF:78,PHY:75}),
  mkp("Dan1",         78, "AM", "Common",       {PAC:74,SHO:76,PAS:80,DRI:81,DEF:50,PHY:66}),
  mkp("Faissal",      77, "ST", "Common",       {PAC:79,SHO:78,PAS:66,DRI:74,DEF:42,PHY:70}),
  mkp("Kamui",        80, "ST", "Rare",       {PAC:84,SHO:86,PAS:78,DRI:81,DEF:43,PHY:72}),
  mkp("Mel",          78, "AM", "Common",       {PAC:74,SHO:76,PAS:80,DRI:81,DEF:50,PHY:66}),
  mkp("Login",          78, "ST", "Common",       {PAC:74,SHO:80,PAS:76,DRI:81,DEF:50,PHY:66}),

  mkp("Barita",       77, "GK", "Common",      {DIV:78,REF:81,HAN:77,KIC:74,POS:79}),
  mkp("Dan",          77, "GK", "Common",      {DIV:78,REF:81,HAN:77,KIC:74,POS:79}),
  mkp("Kantz",        77, "AM", "Common",      {PAC:78,SHO:77,PAS:81,DRI:82,DEF:51,PHY:67}),
  mkp("Lxthomas",     77, "AM", "Common",      {PAC:75,SHO:77,PAS:81,DRI:82,DEF:51,PHY:67}),
  mkp("Nunf",         77, "AM", "Common",      {PAC:75,SHO:77,PAS:81,DRI:89,DEF:51,PHY:67}),
  mkp("Silva",        77, "GK", "Common",      {DIV:78,REF:81,HAN:77,KIC:74,POS:79}),
  mkp("Slurpy",       81, "GK", "Rare",      {DIV:78,REF:81,HAN:77,KIC:74,POS:79}),
  mkp("Moonsky",      81, "ST", "Rare",      {PAC:83,SHO:82,PAS:70,DRI:78,DEF:44,PHY:74}),
  mkp("Frist",        77, "ST", "Common",      {PAC:81,SHO:83,PAS:68,DRI:73,DEF:42,PHY:72}),
  mkp("Insane",       77, "ST", "Common",      {PAC:81,SHO:80,PAS:68,DRI:76,DEF:42,PHY:72}),
  mkp("Nova",         77, "ST", "Common",      {PAC:81,SHO:80,PAS:68,DRI:76,DEF:42,PHY:72}),
  mkp("Torrez",       77, "ST", "Common",      {PAC:81,SHO:80,PAS:68,DRI:76,DEF:42,PHY:72}),
  mkp("Aj",           77, "ST", "Common",      {PAC:80,SHO:79,PAS:67,DRI:75,DEF:42,PHY:71}),
  mkp("Barco",        77, "ST", "Common",      {PAC:70,SHO:75,PAS:70,DRI:75,DEF:42,PHY:71}),
  mkp("Javi",         78, "ST", "Common",      {PAC:80,SHO:79,PAS:67,DRI:75,DEF:42,PHY:71}),
  mkp("Mystic",       78, "ST", "Common",      {PAC:80,SHO:79,PAS:67,DRI:75,DEF:42,PHY:71}),
  mkp("Base",         78, "DM", "Common",      {PAC:73,SHO:60,PAS:74,DRI:72,DEF:81,PHY:78}),
  mkp("Ast",          78, "DM", "Common",      {PAC:73,SHO:60,PAS:74,DRI:72,DEF:81,PHY:78}),
  mkp("Brekus",       78, "GK", "Common",      {DIV:77,REF:80,HAN:76,KIC:73,POS:78}),
  mkp("Lucas Torreira",78,"AM", "Common",      {PAC:74,SHO:76,PAS:80,DRI:81,DEF:50,PHY:66}),
  mkp("Rai",          78, "AM", "Common",      {PAC:74,SHO:76,PAS:80,DRI:81,DEF:50,PHY:66}),
  mkp("Samx",         78, "DM", "Common",      {PAC:73,SHO:60,PAS:74,DRI:72,DEF:81,PHY:78}),
  mkp("Xavi",         80, "DM", "Rare",      {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Amaterasu",    82, "DM", "Rare",      {PAC:84,SHO:83,PAS:82,DRI:84,DEF:84,PHY:81}),
  mkp("Chelo",        78, "AM", "Common",      {PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("Faustino Asprilla",77,"AM","Common",{PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("Iancillo",     76, "GK", "Common",      {DIV:76,REF:79,HAN:75,KIC:72,POS:77}),
  mkp("Kanpur",       80, "ST", "Rare",      {PAC:83,SHO:82,PAS:70,DRI:78,DEF:44,PHY:74}),
  mkp("Loki",         77, "AM", "Common",      {PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("Monarca",      77, "AM", "Common",      {PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("Muñoz",        77, "ST", "Common",      {PAC:79,SHO:78,PAS:66,DRI:74,DEF:42,PHY:70}),
  mkp("Rolando",      77, "GK", "Common",      {DIV:76,REF:79,HAN:75,KIC:72,POS:77}),
  mkp("Wheezy",       76, "GK", "Common",      {DIV:76,REF:79,HAN:75,KIC:72,POS:77}),
  mkp("Wilsinky",     77, "AM", "Common",      {PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("30h",          75, "DM", "Common",      {PAC:70,SHO:57,PAS:71,DRI:69,DEF:78,PHY:75}),
  mkp("Andrewj",      75, "GK", "Common",      {DIV:74,REF:77,HAN:73,KIC:70,POS:75}),
  mkp("Chino Huerta", 74, "ST", "Common",      {PAC:78,SHO:77,PAS:65,DRI:73,DEF:41,PHY:70}),
  mkp("Ian+",         74, "AM", "Common",      {PAC:72,SHO:74,PAS:78,DRI:79,DEF:48,PHY:64}),
  mkp("Kripps",       74, "AM", "Common",      {PAC:72,SHO:74,PAS:78,DRI:79,DEF:48,PHY:64}),
  mkp("L.Diaz",       74, "GK", "Common",      {DIV:74,REF:77,HAN:73,KIC:70,POS:75}),
  mkp("LianMoon",     74, "AM", "Common",      {PAC:71,SHO:73,PAS:77,DRI:78,DEF:48,PHY:63}),
  mkp("Ly.",          74, "AM", "Common",      {PAC:71,SHO:73,PAS:77,DRI:78,DEF:48,PHY:63}),
  mkp("Montiel",      75, "ST", "Common",      {PAC:78,SHO:77,PAS:65,DRI:73,DEF:41,PHY:70}),
  mkp("Patatahot",    74, "GK", "Common",      {DIV:74,REF:77,HAN:73,KIC:70,POS:75}),
  mkp("Polmito",      74, "ST", "Common",      {PAC:66,SHO:83,PAS:65,DRI:68,DEF:61,PHY:78}),
  mkp("Rambo",        74, "GK", "Common",      {DIV:74,REF:77,HAN:73,KIC:70,POS:75}),
  mkp("Samuggs",      75, "ST", "Common",      {PAC:77,SHO:76,PAS:64,DRI:72,DEF:40,PHY:69}),
  mkp("Santi",        76, "AM", "Common",      {PAC:72,SHO:74,PAS:78,DRI:79,DEF:48,PHY:64}),
  mkp("Skira",        75, "AM", "Common",      {PAC:71,SHO:73,PAS:77,DRI:78,DEF:48,PHY:63}),
  mkp("Swifw",        76, "AM", "Common",      {PAC:72,SHO:74,PAS:78,DRI:79,DEF:48,PHY:64}),
  mkp("Theviruz",     76, "ST", "Common",      {PAC:78,SHO:77,PAS:65,DRI:73,DEF:41,PHY:70}),
  mkp("Piedrahita",   74, "ST", "Common",      {PAC:75,SHO:74,PAS:65,DRI:72,DEF:40,PHY:68}),
  mkp("Wervy",        76, "ST", "Common",      {PAC:78,SHO:77,PAS:65,DRI:73,DEF:41,PHY:70}),
  mkp("Claxon",       74, "AM", "Common",      {PAC:70,SHO:72,PAS:76,DRI:77,DEF:47,PHY:62}),
  mkp("Faryd",        74, "GK", "Common",      {DIV:73,REF:76,HAN:72,KIC:69,POS:74}),
  mkp("Ghz",          74, "AM", "Common",      {PAC:70,SHO:72,PAS:76,DRI:77,DEF:47,PHY:62}),
  mkp("Moore",        74, "AM", "Common",      {PAC:70,SHO:72,PAS:76,DRI:77,DEF:47,PHY:62}),
  mkp("R10",          74, "GK", "Common",      {DIV:73,REF:76,HAN:72,KIC:69,POS:74}),
  mkp("Valentino",    74, "AM", "Common",      {PAC:70,SHO:72,PAS:76,DRI:77,DEF:47,PHY:62}),
  mkp("Gomez",        20, "GK", "Common",      {DIV:20,REF:20,HAN:20,KIC:20,POS:20}),
  mkp("Kyx",          73, "ST", "Common",      {PAC:75,SHO:74,PAS:65,DRI:72,DEF:40,PHY:68}),
  mkp("Luppo",        73, "DM", "Common",      {PAC:68,SHO:56,PAS:70,DRI:68,DEF:76,PHY:73}),
  mkp("Rodrik",       73, "AM", "Common",      {PAC:69,SHO:71,PAS:75,DRI:76,DEF:46,PHY:61}),
  mkp("Signal",       73, "AM", "Common",      {PAC:69,SHO:71,PAS:75,DRI:76,DEF:46,PHY:61}),
  mkp("Davis",        72, "GK", "Common",      {DIV:71,REF:74,HAN:70,KIC:67,POS:72}),
  mkp("Mike",         72, "DM", "Common",      {PAC:67,SHO:55,PAS:69,DRI:67,DEF:75,PHY:72}),
  mkp("Sunny",        72, "GK", "Common",      {DIV:71,REF:74,HAN:70,KIC:67,POS:72}),
  mkp("Nami",         67, "GK", "Common",      {DIV:66,REF:69,HAN:65,KIC:62,POS:67}),
  mkp("France",         4, "ST", "Common",    {PAC:4,SHO:4,PAS:4,DRI:4,DEF:4,PHY:4}),
];

// ─────────────────────────────────────────
// 🌍 NACIONALIDADES
// ─────────────────────────────────────────
const playerNationality = {
  
  "DIEGO":        { flag: "🇨🇴", country: "Colombia"   },
  "Kermit ICON":        { flag: "🇨🇴", country: "Colombia"   },
  "Panda":        { flag: "🇨🇴", country: "Colombia"   },
  "Real":         { flag: "🇨🇴", country: "Colombia"   },
  "Rad1":         { flag: "🇨🇴", country: "Colombia"   },
  "Checo":        { flag: "🇨🇴", country: "Colombia"   },
  "Mondaman":     { flag: "🇨🇴", country: "Colombia"   },
  "Zyros ICON":        { flag: "🇨🇴", country: "Colombia"   },
"Caslu":        { flag: "🇨🇴", country: "Colombia"   },
  "P4er":         { flag: "🇮🇱", country: "Israel" },
"Hardem":        { flag: "🇨🇴", country: "Colombia"   },
"Zarco":        { flag: "🇨🇴", country: "Colombia"   },
  "Lorenzi":      { flag: "🇨🇴", country: "Colombia"   },
  "Pardo":        { flag: "🇨🇴", country: "Colombia"   },
  "BryanCisf":    { flag: "🇨🇴", country: "Colombia"   },
  "RX":           { flag: "🇨🇴", country: "Colombia"   },
  "Mecha": { flag: "🇵🇦", country: "Panamá" },
  "Zombot ICON":       { flag: "🇨🇴", country: "Colombia"   },
  "Disk":         { flag: "🇨🇴", country: "Colombia"   },
  "P1nguano":     { flag: "🇨🇴", country: "Colombia"   },
  "Doxing":       { flag: "🇨🇴", country: "Colombia"   },


  "Kyo":        { flag: "🇵🇱", country: "Polonia"   },
  "Vak":        { flag: "🇵🇱", country: "Polonia"   },
  "Luntek WC":  { flag: "🇵🇱", country: "Polonia"   },
  "Sekai WC":   { flag: "🇵🇱", country: "Polonia"   },
  "Pixel WC":   { flag: "🇺🇸", country: "USA"       },
  "Compass WC": { flag: "🇺🇸", country: "USA"       },
  "Father WC":  { flag: "🇺🇸", country: "USA"       },
  "Czerro WC":  { flag: "🇦🇷", country: "Argentina" },
  "Facha":      { flag: "🇺🇾", country: "Argentina" },
  "Mazda":      { flag: "🇦🇷", country: "Argentina" },
  "Fusion":     { flag: "🇧🇷", country: "Brasil"    },
  "Thunder":    { flag: "🇺🇸", country: "USA"       },
  "Shott":      { flag: "🇺🇸", country: "USA"       },
  "Cervi WC":   { flag: "🇦🇷", country: "Argentina" },
  "Hitlerinho": { flag: "🇦🇷", country: "Argentina" },
  "Ken":        { flag: "🇨🇦", country: "Canadá"    },
  "Rodrigo":    { flag: "🇺🇾", country: "Uruguay"   },
  "Murillo":    { flag: "🇺🇾", country: "Uruguay"   },
  "Magico":     { flag: "🇦🇷", country: "Argentina" },
  "N+23":       { flag: "🇦🇷", country: "Argentina" },
  "Becken":     { flag: "🇦🇷", country: "Argentina" },
};

// ─────────────────────────────────────────
// 📦 PACKS
// ─────────────────────────────────────────
const packs = {
  bronze: { price: 500,  label: 'Bronze',  emoji: '🥉', rarities: ['Common']       },
  silver: { price: 2500,  label: 'Silver',  emoji: '🥈', rarities: ['Rare']      },
  gold:   { price: 7500, label: 'Gold',    emoji: '🥇', rarities: ['Epic']      },
  legend: { price: 15000, label: 'Legend',  emoji: '💎', rarities: ['Legendary'] },
 icon:   { price: 95000, label: 'Icon',    emoji: '⭐', rarities: ['Icon']       },
};

const SELL_PRICES = { "Common": 230, "Rare": 1150, "Epic": 3650, "Legendary": 7250, "Icon": 40000  
};
const MARKET_MIN_PRICE = { "Common": 300, "Rare": 1900, "Epic": 5000, "Legendary": 17000, "Icon": 100000 };
const MARKET_LISTING_TTL = 48 * 60 * 60 * 1000; // 24 horas en ms
const MATCH_REWARDS = {
  arena:    { win: 400, draw: 100, loss: 50 },
  friendly: { win: 100, draw: 50,  loss: 20 }
};
const DAILY_COOLDOWN_MS  = 24 * 60 * 60 * 1000;
const DAILY_BASE_REWARD  = 250;
const DAILY_STREAK_BONUS = 50;
const STREAK_MILESTONES = {
3:  { coins: 150,  msg: '🔥 3 days in a row! Special bonus'   },
  7:  { coins: 400,  msg: '⚡ ONE WEEK! Mega bonus'            },
  14: { coins: 900,  msg: '💎 TWO WEEKS! Legendary bonus'     },
  30: { coins: 2500, msg: '👑 ONE MONTH! Supreme bonus'       }
};
const CLAIM_MILESTONES = {
  7:  { pack: 'silver', amount: 2, msg: '🥉 2 Silver Packs for 7 days in a row!'    },
  14: { pack: 'gold',   amount: 1, msg: '🥇 Free GOLD Pack for 14 days in a row!'   },
  30: { pack: 'legend', amount: 1, msg: '💎 Free LEGEND Pack for 30 days in a row!' }
};
const MAX_CLUB_SIZE = 20;

// ─────────────────────────────────────────
// 🎨 COLORES PACK VISUAL
// ─────────────────────────────────────────
const PACK_VISUAL = {
  silver: { primary: '#C8C8C8', secondary: '#888888', accent: '#FFFFFF',  glow: '#E8E8E8', shine: '#F5F5F5', dark: '#404040' },
  bronze: { primary: '#CD7F32', secondary: '#8B4513', accent: '#FFD4A0',  glow: '#FF9944', shine: '#FFE0B0', dark: '#3A1A00' },
  gold:   { primary: '#FFD700', secondary: '#B8860B', accent: '#FFFACD',  glow: '#FFE066', shine: '#FFFFF0', dark: '#2A1A00' },
  legend: { primary: '#9B59B6', secondary: '#4A235A', accent: '#E8D5F5',  glow: '#CC88FF', shine: '#F0E0FF', dark: '#1A0028' },
  icon: { primary: '#C0C0C0', secondary: '#808080', accent: '#C0C0C0', glow: '#E8E8E8', shine: '#C0C0C0', dark: '#303030' },
};

// ─────────────────────────────────────────
// 🎨 COLORES POR RAREZA — paletas FIFA
// ─────────────────────────────────────────
function getRarityColors(rarity) {
  if (rarity === "Legendary") return {
    cardTop:    '#F0D060', cardMid:    '#D4A820', cardBot:    '#A07818',
    nameBar:    '#C89020', statsArea:  '#9A6E10', border:     '#FFE566',
    glow:       '#FFD700', ratingCol:  '#1A0E00', posCol:     '#2A1800',
    nameCol:    '#FFFFFF', statNum:    '#FFFFFF', statLabel:  '#C8A840', shine: '#FFF8C0',
  };

if (rarity === "Especial") return {
  cardTop:    '#000820', cardMid:    '#0022AA', cardBot:    '#001133',
  nameBar:    '#001577', statsArea:  '#000C3D', border:     '#00AAFF',
  glow:       '#0066FF', ratingCol:  '#FFFFFF', posCol:     '#99CCFF',
  nameCol:    '#FFFFFF', statNum:    '#FFFFFF', statLabel:  '#6699FF', shine: '#0044CC',
};

 if (rarity === "Icon") return {
  cardTop:    '#E8E8E8', cardMid:    '#C0C0C0', cardBot:    '#909090',
  nameBar:    '#B0B0B0', statsArea:  '#787878', border:     '#FFFFFF',
  glow:       '#FFFFFF', ratingCol:  '#1A1A1A', posCol:     '#2A2A2A',
  nameCol:    '#1A1A1A', statNum:    '#1A1A1A', statLabel:  '#555555', shine: '#FFFFFF',
};

if (rarity === "WorldCup") return {
  cardTop:    '#CC2200', cardMid:    '#AA1100', cardBot:    '#7A0000',
  nameBar:    '#991100', statsArea:  '#6A0000', border:     '#FFD700',
  glow:       '#FF3300', ratingCol:  '#FFFFFF', posCol:     '#FFE0B0',
  nameCol:    '#FFFFFF', statNum:    '#FFFFFF', statLabel:  '#FFD700', shine: '#FFE0B0',
};
  if (rarity === "Epic") return {
    cardTop:    '#C89AD8', cardMid:    '#9B59B6', cardBot:    '#5A2878',
    nameBar:    '#7A3090', statsArea:  '#5A1E70', border:     '#CC88EE',
    glow:       '#AA66DD', ratingCol:  '#F0E0FF', posCol:     '#E8D0FF',
    nameCol:    '#FFFFFF', statNum:    '#FFFFFF', statLabel:  '#CC99EE', shine: '#E8D5F5',
  };
  if (rarity === "Rare") return {
    cardTop:    '#90B8E8', cardMid:    '#5880C0', cardBot:    '#2A4880',
    nameBar:    '#3A5898', statsArea:  '#2A3E70', border:     '#88AADD',
    glow:       '#6699CC', ratingCol:  '#E0EEFF', posCol:     '#D0E4FF',
    nameCol:    '#FFFFFF', statNum:    '#FFFFFF', statLabel:  '#99BBDD', shine: '#D0E8FF',
  };
  return {
    cardTop:    '#B09060', cardMid:    '#886040', cardBot:    '#5A3820',
    nameBar:    '#7A5030', statsArea:  '#5A3818', border:     '#C0A070',
    glow:       '#A08050', ratingCol:  '#FFF0D8', posCol:     '#F0E0C0',
    nameCol:    '#FFFFFF', statNum:    '#FFFFFF', statLabel:  '#C8A878', shine: '#D8C0A0',
  };
}

// ─────────────────────────────────────────
// 🔲 FORMA DE CARTA FIFA
// ─────────────────────────────────────────
function drawFIFACardPath(ctx, x, y, W, H, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + W - r, y);
  ctx.quadraticCurveTo(x + W, y, x + W, y + r);
  ctx.lineTo(x + W, y + H * 0.80);
  ctx.quadraticCurveTo(x + W, y + H * 0.93, x + W / 2, y + H);
  ctx.quadraticCurveTo(x, y + H * 0.93, x, y + H * 0.80);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─────────────────────────────────────────
// ✨ PATRÓN GEOMÉTRICO FIFA
// ─────────────────────────────────────────
function drawFIFAPattern(ctx, x, y, W, H, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.18;
  const spacing = 28;
  for (let i = -H; i < W + H; i += spacing) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i - H * 0.5, y + H);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.10;
  const hexR = 22;
  for (let hx = x + hexR; hx < x + W; hx += hexR * 2.8) {
    for (let hy = y + hexR; hy < y + H * 0.65; hy += hexR * 2.4) {
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const angle = (Math.PI / 3) * s - Math.PI / 6;
        const px = hx + hexR * Math.cos(angle);
        const py = hy + hexR * Math.sin(angle);
        s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}


// ─────────────────────────────────────────
// 🎴 CARTA GRANDE — drawShowcaseCard
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// 🌍 BANDERAS MANUALES POR PAÍS
// ─────────────────────────────────────────
function drawManualFlag(ctx, country, x, y, w, h) {
  // Fondo base
  ctx.save();
  ctx.fillStyle = '#444444';
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 3);
  ctx.fill();
  ctx.restore();

  // Clip para el contenido de la bandera
  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 3);
  ctx.clip();

  if (country === 'Argentina') {
    ctx.fillStyle = '#74ACDF'; ctx.fillRect(x, y, w, h / 3);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y + h / 3, w, h / 3);
    ctx.fillStyle = '#74ACDF'; ctx.fillRect(x, y + (h / 3) * 2, w, h / 3);
    ctx.fillStyle = '#F6B40E';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.22, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Israel') {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#0038B8'; ctx.fillRect(x, y + h * 0.1, w, h * 0.15);
    ctx.fillStyle = '#0038B8'; ctx.fillRect(x, y + h * 0.75, w, h * 0.15);
    const cx2 = x + w / 2, cy2 = y + h / 2;
    const r = h * 0.18;
    ctx.fillStyle = '#0038B8';
    ctx.beginPath();
    ctx.moveTo(cx2, cy2 - r);
    ctx.lineTo(cx2 + r * 0.87, cy2 + r * 0.5);
    ctx.lineTo(cx2 - r * 0.87, cy2 + r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx2, cy2 + r);
    ctx.lineTo(cx2 + r * 0.87, cy2 - r * 0.5);
    ctx.lineTo(cx2 - r * 0.87, cy2 - r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx2, cy2, r * 0.38, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Polonia') {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#DC143C'; ctx.fillRect(x, y + h / 2, w, h / 2);

  } else if (country === 'USA') {
    ctx.fillStyle = '#B22234'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFFFFF';
    const stripeH = h / 13;
    for (let i = 1; i < 13; i += 2) ctx.fillRect(x, y + stripeH * i, w, stripeH);
    ctx.fillStyle = '#3C3B6E'; ctx.fillRect(x, y, w * 0.4, h * 0.54);

  } else if (country === 'Brasil') {
    ctx.fillStyle = '#009C3B'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FFDF00';
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.08);
    ctx.lineTo(x + w * 0.92, y + h / 2);
    ctx.lineTo(x + w / 2, y + h * 0.92);
    ctx.lineTo(x + w * 0.08, y + h / 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#002776';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.28, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Uruguay') {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#0038A8';
    const uStripeH = h / 9;
    for (let i = 1; i < 9; i += 2) ctx.fillRect(x, y + uStripeH * i, w, uStripeH);
    ctx.fillStyle = '#F6B40E';
    ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.35, h * 0.2, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Canadá') {
    ctx.fillStyle = '#FF0000'; ctx.fillRect(x, y, w * 0.25, h);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + w * 0.25, y, w * 0.5, h);
    ctx.fillStyle = '#FF0000'; ctx.fillRect(x + w * 0.75, y, w * 0.25, h);
    ctx.fillStyle = '#FF0000';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.22, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Panamá') {
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w / 2, h / 2);
    ctx.fillStyle = '#D21034'; ctx.fillRect(x + w / 2, y, w / 2, h / 2);
    ctx.fillStyle = '#003087'; ctx.fillRect(x, y + h / 2, w / 2, h / 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + w / 2, y + h / 2, w / 2, h / 2);
    // Estrella roja en cuadrante blanco (arriba izq)
    ctx.fillStyle = '#D21034';
    ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.25, h * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.25, h * 0.10, 0, Math.PI * 2); ctx.fill();
    // Estrella azul en cuadrante blanco (abajo der)
    ctx.fillStyle = '#003087';
    ctx.beginPath(); ctx.arc(x + w * 0.75, y + h * 0.75, h * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(x + w * 0.75, y + h * 0.75, h * 0.10, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Colombia') {
    ctx.fillStyle = '#FCD116'; ctx.fillRect(x, y, w, h * 0.5);
    ctx.fillStyle = '#003087'; ctx.fillRect(x, y + h * 0.5, w, h * 0.25);
    ctx.fillStyle = '#CE1126'; ctx.fillRect(x, y + h * 0.75, w, h * 0.25);

  } else {
    ctx.fillStyle = '#444444'; ctx.fillRect(x, y, w, h);
  }

  ctx.restore();

  // Borde dorado (fuera del clip)
  ctx.save();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 3);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────
// 🎴 drawShowcaseCard COMPLETA
// ─────────────────────────────────────────
async function drawShowcaseCard(player) {
  const CW = 320, CH = 460;
  const PAD = 60;
  const canvas = createCanvas(CW + PAD * 2, CH + PAD * 2);
  const ctx = canvas.getContext('2d');
  const c = getRarityColors(player.rarity);
  const isWC = player.rarity === 'WorldCup' || player.rarity === 'Icon';
  const nationality = playerNationality[player.name] || null;

  ctx.fillStyle = '#080810';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 4; i >= 1; i--) {
    ctx.save();
    ctx.globalAlpha = 0.07 * i;
    ctx.shadowColor = c.glow;
    ctx.shadowBlur = 25 * i;
    drawFIFACardPath(ctx, PAD + i * 2, PAD + i * 2, CW - i * 4, CH - i * 4, 14);
    ctx.fillStyle = c.glow;
    ctx.fill();
    ctx.restore();
  }

  const cx = PAD, cy = PAD;
  ctx.save();
  drawFIFACardPath(ctx, cx, cy, CW, CH, 14);
  ctx.clip();

  const topH = CH * 0.58;

  const topGrad = ctx.createLinearGradient(cx, cy, cx, cy + topH);
  topGrad.addColorStop(0, c.cardTop);
  topGrad.addColorStop(0.55, c.cardMid);
  topGrad.addColorStop(1, c.cardMid);
  ctx.fillStyle = topGrad;
  ctx.fillRect(cx, cy, CW, topH);

  const shineGrad = ctx.createLinearGradient(cx, cy, cx + CW * 0.7, cy + topH * 0.6);
  shineGrad.addColorStop(0, c.shine + '55');
  shineGrad.addColorStop(0.4, c.shine + '20');
  shineGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = shineGrad;
  ctx.fillRect(cx, cy, CW, topH);

  drawFIFAPattern(ctx, cx, cy, CW, topH, c.shine);

  // ── BADGE "WORLD CUP CHAMPIONS" — solo texto elegante sin fondo amarillo ──
  if (isWC) {
    ctx.save();
    ctx.font = `bold 9px ${FIFA_FONT}`;
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 8;
    const badgeText = player.rarity === 'Icon' ? '✦  ICON  ✦' : '✦  WORLD CUP CHAMPIONS  ✦';
    ctx.fillText(badgeText, cx + CW / 2, cy + 18);
    ctx.shadowBlur = 0;
    // Línea fina dorada debajo del texto
    ctx.strokeStyle = '#FFD70066';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + 30, cy + 22);
    ctx.lineTo(cx + CW - 30, cy + 22);
    ctx.stroke();
    ctx.restore();
  }

const topOffset = isWC ? 16 : 0;

  // Rating y posición
ctx.font = `bold 64px ${FIFA_FONT}`;
ctx.fillStyle = c.ratingCol;
ctx.textAlign = 'left';
ctx.shadowColor = '#00000044';
ctx.shadowBlur = 6;
ctx.fillText(String(player.rating), cx + 8, cy + 72 + topOffset);
ctx.shadowBlur = 0;

ctx.font = `bold 22px ${FIFA_FONT}`;
ctx.fillStyle = c.posCol;
ctx.textAlign = 'left';
ctx.fillText(player.position, cx + 20, cy + 110 + topOffset);

  // ── BANDERA manual esquina superior derecha (solo WC) ──
  if (isWC && nationality) {
    const flagW = 48, flagH = 32;
    const flagX = cx + CW - flagW - 14;
    const flagY = cy + 12;
    drawManualFlag(ctx, nationality.country, flagX, flagY, flagW, flagH);
    // País debajo
    ctx.save();
    ctx.font = `bold 9px ${FIFA_FONT}`;
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00000066';
    ctx.shadowBlur = 4;
    ctx.fillText(nationality.country.toUpperCase(), flagX + flagW / 2, flagY + flagH + 13);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── AVATAR círculo con iniciales ──
  const avatarCX = cx + CW / 2;
  const avatarCY = cy + topH * 0.52;
  const avatarR = 62;

  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = c.statsArea;
  ctx.fill();
  ctx.restore();

  const avatarGrad = ctx.createRadialGradient(avatarCX - 12, avatarCY - 12, 4, avatarCX, avatarCY, avatarR);
  avatarGrad.addColorStop(0, c.cardTop + 'ee');
  avatarGrad.addColorStop(0.6, c.cardMid + 'cc');
  avatarGrad.addColorStop(1, c.statsArea + 'aa');
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = avatarGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.strokeStyle = c.shine + 'aa';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const initials = player.name.substring(0, 2).toUpperCase();
  ctx.font = `bold 52px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#00000066';
  ctx.shadowBlur = 8;
  ctx.fillText(initials, avatarCX, avatarCY + 2);
  ctx.shadowBlur = 0;
  ctx.textBaseline = 'alphabetic';

  // Barra del nombre
  const nameBarY = cy + topH;
  const nameBarH = 38;
  ctx.fillStyle = c.nameBar;
  ctx.fillRect(cx, nameBarY, CW, nameBarH);

  ctx.beginPath();
  ctx.moveTo(cx, nameBarY);
  ctx.lineTo(cx + CW, nameBarY);
  ctx.strokeStyle = c.shine + '66';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const nameStr = player.name.toUpperCase();
  let nameFontSize = 20;
  if (nameStr.length > 12) nameFontSize = 16;
  if (nameStr.length > 16) nameFontSize = 14;
  ctx.font = `bold ${nameFontSize}px ${FIFA_FONT}`;
  ctx.fillStyle = c.nameCol;
  ctx.textAlign = 'center';
  ctx.shadowColor = '#00000066';
  ctx.shadowBlur = 4;
  ctx.fillText(nameStr, cx + CW / 2, nameBarY + nameBarH * 0.68);
  ctx.shadowBlur = 0;

  // Área de stats
  const statsY = nameBarY + nameBarH;
  const statsH = CH - (statsY - cy);
  ctx.fillStyle = c.statsArea;
  ctx.fillRect(cx, statsY, CW, statsH);

  const midX = cx + CW / 2;
  ctx.beginPath();
  ctx.moveTo(midX, statsY + 8);
  ctx.lineTo(midX, statsY + statsH - 8);
  ctx.strokeStyle = c.shine + '30';
  ctx.lineWidth = 1;
  ctx.stroke();

  const stats = player.stats || {};
  const keys = Object.keys(stats);
  const col1 = keys.slice(0, 3);
  const col2 = keys.slice(3, 6);
  const rowH = (statsH - 10) / 3;
  const startY = statsY + rowH * 0.75;

  col1.forEach((key, i) => {
    const sy = startY + i * rowH;
    const colCenter = cx + CW / 4;
    ctx.font = `bold 26px ${FIFA_FONT}`;
    ctx.fillStyle = c.statNum;
    ctx.textAlign = 'right';
    ctx.shadowColor = '#00000055';
    ctx.shadowBlur = 3;
    ctx.fillText(String(stats[key]), colCenter - 4, sy);
    ctx.font = `bold 13px ${FIFA_FONT}`;
    ctx.fillStyle = c.statLabel;
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
    ctx.fillText(key, colCenter + 4, sy);
  });

  col2.forEach((key, i) => {
    const sy = startY + i * rowH;
    const colCenter = cx + CW * 3 / 4;
    ctx.font = `bold 26px ${FIFA_FONT}`;
    ctx.fillStyle = c.statNum;
    ctx.textAlign = 'right';
    ctx.shadowColor = '#00000055';
    ctx.shadowBlur = 3;
    ctx.fillText(String(stats[key]), colCenter - 4, sy);
    ctx.font = `bold 13px ${FIFA_FONT}`;
    ctx.fillStyle = c.statLabel;
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
    ctx.fillText(key, colCenter + 4, sy);
  });

  ctx.restore();

  ctx.save();
  drawFIFACardPath(ctx, cx, cy, CW, CH, 14);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 3;
  ctx.stroke();
  drawFIFACardPath(ctx, cx + 4, cy + 4, CW - 8, CH - 8, 11);
  ctx.strokeStyle = c.shine + '50';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  return canvas;
}


// ─────────────────────────────────────────
// 🃏 CARTA PEQUEÑA PARA !team
// ─────────────────────────────────────────
async function drawCard(ctx, ox, oy, player) {
  const CW = 160, CH = 228, r = 10;
  const c = getRarityColors(player.rarity);

  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 12;
  drawFIFACardPath(ctx, ox, oy, CW, CH, r);
  ctx.fillStyle = c.cardBot;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.save();
  drawFIFACardPath(ctx, ox, oy, CW, CH, r);
  ctx.clip();

  const topH = CH * 0.56;
  const topGrad = ctx.createLinearGradient(ox, oy, ox, oy + topH);
  topGrad.addColorStop(0, c.cardTop);
  topGrad.addColorStop(0.55, c.cardMid);
  topGrad.addColorStop(1, c.cardMid);
  ctx.fillStyle = topGrad;
  ctx.fillRect(ox, oy, CW, topH);

  const shine = ctx.createLinearGradient(ox, oy, ox + CW * 0.6, oy + topH * 0.5);
  shine.addColorStop(0, c.shine + '44');
  shine.addColorStop(1, 'transparent');
  ctx.fillStyle = shine;
  ctx.fillRect(ox, oy, CW, topH);

  drawFIFAPattern(ctx, ox, oy, CW, topH, c.shine);

  // Rating y posición
  ctx.font = `bold 35px ${FIFA_FONT}`;
  ctx.fillStyle = c.ratingCol;
  ctx.textAlign = 'left';
  ctx.shadowColor = '#00000033';
  ctx.shadowBlur = 4;
  ctx.fillText(String(player.rating), ox + 4, oy + 42);
  ctx.shadowBlur = 0;

  ctx.font = `bold 12px ${FIFA_FONT}`;
  ctx.fillStyle = c.posCol;
  ctx.fillText(player.position, ox + 11, oy + 56);

  // ── BADGE WC pequeño (solo WorldCup) ──
  if (player.rarity === 'WorldCup') {
    ctx.save();
    ctx.font = `bold 6px ${FIFA_FONT}`;
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 4;
    ctx.fillText('WC', ox + CW - 14, oy + 14);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── AVATAR círculo con iniciales ──
  const avatarCX = ox + CW / 2;
  const avatarCY = oy + topH * 0.52;
  const avatarR = 30;

  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 14;
  const avatarGrad = ctx.createRadialGradient(avatarCX - 6, avatarCY - 6, 2, avatarCX, avatarCY, avatarR);
  avatarGrad.addColorStop(0, c.cardTop + 'ee');
  avatarGrad.addColorStop(0.6, c.cardMid + 'cc');
  avatarGrad.addColorStop(1, c.statsArea + 'aa');
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = avatarGrad;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
  ctx.strokeStyle = c.shine + '99';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const initials = player.name.substring(0, 2).toUpperCase();
  ctx.font = `bold 24px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#00000066';
  ctx.shadowBlur = 5;
  ctx.fillText(initials, avatarCX, avatarCY + 1);
  ctx.shadowBlur = 0;
  ctx.textBaseline = 'alphabetic';

  // Barra del nombre
  const nameBarY = oy + topH;
  const nameBarH = 22;
  ctx.fillStyle = c.nameBar;
  ctx.fillRect(ox, nameBarY, CW, nameBarH);

  ctx.beginPath();
  ctx.moveTo(ox, nameBarY);
  ctx.lineTo(ox + CW, nameBarY);
  ctx.strokeStyle = c.shine + '55';
  ctx.lineWidth = 1;
  ctx.stroke();

  const nameStr = player.name.toUpperCase();
  let fs2 = 11;
  if (nameStr.length > 14) fs2 = 9;
  ctx.font = `bold ${fs2}px ${FIFA_FONT}`;
  ctx.fillStyle = c.nameCol;
  ctx.textAlign = 'center';
  ctx.shadowColor = '#00000066';
  ctx.shadowBlur = 2;
  ctx.fillText(nameStr, ox + CW / 2, nameBarY + nameBarH * 0.72);
  ctx.shadowBlur = 0;

  // Área de stats
  const statsY = nameBarY + nameBarH;
  const statsH = CH - (statsY - oy);
  ctx.fillStyle = c.statsArea;
  ctx.fillRect(ox, statsY, CW, statsH);

  const midX = ox + CW / 2;
  ctx.beginPath();
  ctx.moveTo(midX, statsY + 4);
  ctx.lineTo(midX, statsY + statsH - 4);
  ctx.strokeStyle = c.shine + '28';
  ctx.lineWidth = 1;
  ctx.stroke();

  const stats = player.stats || {};
  const keys = Object.keys(stats);
  const col1 = keys.slice(0, 3);
  const col2 = keys.slice(3, 6);
  const rowH = (statsH - 6) / 3;
  const startY = statsY + rowH * 0.78;

  col1.forEach((key, i) => {
    const sy = startY + i * rowH;
    const colCenter = ox + CW / 4;
    ctx.font = `bold 15px ${FIFA_FONT}`;
    ctx.fillStyle = c.statNum;
    ctx.textAlign = 'right';
    ctx.shadowColor = '#00000044';
    ctx.shadowBlur = 2;
    ctx.fillText(String(stats[key]), colCenter - 3, sy);
    ctx.font = `bold 9px ${FIFA_FONT}`;
    ctx.fillStyle = c.statLabel;
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
    ctx.fillText(key, colCenter + 3, sy);
  });

  col2.forEach((key, i) => {
    const sy = startY + i * rowH;
    const colCenter = ox + CW * 3 / 4;
    ctx.font = `bold 15px ${FIFA_FONT}`;
    ctx.fillStyle = c.statNum;
    ctx.textAlign = 'right';
    ctx.shadowColor = '#00000044';
    ctx.shadowBlur = 2;
    ctx.fillText(String(stats[key]), colCenter - 3, sy);
    ctx.font = `bold 9px ${FIFA_FONT}`;
    ctx.fillStyle = c.statLabel;
    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
    ctx.fillText(key, colCenter + 3, sy);
  });

  ctx.restore();

  // Bordes
  ctx.save();
  drawFIFACardPath(ctx, ox, oy, CW, CH, r);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  drawFIFACardPath(ctx, ox + 3, oy + 3, CW - 6, CH - 6, r - 2);
  ctx.strokeStyle = c.shine + '44';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────
// 🕳️ SLOT VACÍO
// ─────────────────────────────────────────
function drawEmptySlot(ctx, x, y, posLabel) {
  const W = 160, H = 228, r = 10;
  ctx.save();
  drawFIFACardPath(ctx, x, y, W, H, r);
  ctx.clip();
  ctx.fillStyle = '#0a0a1a88';
  ctx.fillRect(x, y, W, H);
  ctx.restore();
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff33';
  drawFIFACardPath(ctx, x + 4, y + 4, W - 8, H - 8, r - 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  const cx = x + W / 2, cy = y + H / 2 - 20;
  ctx.save();
  ctx.strokeStyle = '#ffffff33';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.font = `bold 14px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff44';
  ctx.textAlign = 'center';
  ctx.fillText(posLabel, cx, cy + 45);
  ctx.font = `11px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff28';
  ctx.fillText('VACÍO', cx, cy + 60);
  ctx.restore();
}

// ─────────────────────────────────────────
// 🎞️ HELPERS CANVAS
// ─────────────────────────────────────────
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─────────────────────────────────────────
// 🎞️ GIF PACK CERRADO
// ─────────────────────────────────────────
async function generatePackShakeGIF(packType) {
  const W = 420, H = 420;
  const pv = PACK_VISUAL[packType] || PACK_VISUAL.silver;
  const encoder = new GIFEncoder(W, H);
  const gifStream = encoder.createReadStream();
  const chunks = [];
  gifStream.on('data', chunk => chunks.push(chunk));
  encoder.start(); encoder.setRepeat(0); encoder.setDelay(55); encoder.setQuality(6);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  for (let f = 0; f <= 9; f++) {
    const prog = f / 9;
    ctx.clearRect(0, 0, W, H);
    const bgr = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, W*0.85);
    bgr.addColorStop(0, '#10102a'); bgr.addColorStop(1, '#000005');
    ctx.fillStyle = bgr; ctx.fillRect(0, 0, W, H);
    const scale = 0.25 + prog * 0.75;
    const packW = 180*scale, packH = 250*scale;
    const px = W/2 - packW/2, py = H/2 - packH/2 - 10;
    ctx.save(); ctx.globalAlpha = prog;
    ctx.shadowColor = pv.glow; ctx.shadowBlur = 25*prog;
    const pg = ctx.createLinearGradient(px, py, px+packW, py+packH);
    pg.addColorStop(0, pv.shine); pg.addColorStop(0.3, pv.primary);
    pg.addColorStop(0.7, pv.secondary); pg.addColorStop(1, pv.dark);
    roundRectPath(ctx, px, py, packW, packH, 12*scale);
    ctx.fillStyle = pg; ctx.fill();
    roundRectPath(ctx, px, py, packW, packH, 12*scale);
    ctx.strokeStyle = pv.accent+'BB'; ctx.lineWidth = 2*scale; ctx.stroke();
    const lineY = py + packH * 0.42;
    ctx.fillStyle = pv.dark; ctx.font = `bold ${Math.round(20*scale)}px ${FIFA_FONT}`;
    ctx.textAlign = 'center'; ctx.shadowColor = pv.glow; ctx.shadowBlur = 6;
    ctx.fillText((packs[packType]?.label||packType).toUpperCase(), W/2, lineY - 8*scale);
    ctx.restore();
    encoder.setDelay(f===0?80:45);
    encoder.addFrame(ctx);
  }

  for (let f = 0; f <= 19; f++) {
    const pulse = Math.sin(f * 0.65) * 0.045;
    const scale = 1.0 + pulse;
    const shakeX = (Math.random()-0.5)*5;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0f0f24'; ctx.fillRect(0, 0, W, H);
    for (let ring = 0; ring < 4; ring++) {
      const rp = ((f*0.5 + ring*4.5)%18)/17;
      ctx.beginPath(); ctx.arc(W/2, H/2, 55+rp*190, 0, Math.PI*2);
      const alpha = Math.round((1-rp)*55).toString(16).padStart(2,'0');
      ctx.strokeStyle = pv.glow+alpha; ctx.lineWidth=1.5; ctx.stroke();
    }
    const packW = 180*scale, packH = 250*scale;
    const px = W/2-packW/2+shakeX, py = H/2-packH/2-10;
    ctx.save(); ctx.shadowColor=pv.glow; ctx.shadowBlur=35+pulse*180;
    const pg2 = ctx.createLinearGradient(px,py,px+packW,py+packH);
    pg2.addColorStop(0,pv.shine); pg2.addColorStop(0.3,pv.primary);
    pg2.addColorStop(0.7,pv.secondary); pg2.addColorStop(1,pv.dark);
    roundRectPath(ctx,px,py,packW,packH,12*scale);
    ctx.fillStyle=pg2; ctx.fill();
    roundRectPath(ctx,px,py,packW,packH,12*scale);
    ctx.strokeStyle=pv.accent; ctx.lineWidth=2.5*scale; ctx.stroke();
    ctx.restore();
    if (f%4<2) {
      ctx.save(); ctx.globalAlpha=0.85;
      ctx.font=`bold 16px ${FIFA_FONT}`; ctx.fillStyle=pv.accent;
      ctx.textAlign='center'; ctx.shadowColor=pv.glow; ctx.shadowBlur=12;
      ctx.fillText('⚡  LISTO PARA ABRIR  ⚡', W/2, H-30); ctx.restore();
    }
    encoder.setDelay(55); encoder.addFrame(ctx);
  }
  encoder.finish();
  return new Promise(resolve => { gifStream.on('end', () => resolve(Buffer.concat(chunks))); });
}

// ─────────────────────────────────────────
// 🎞️ GIF EXPLOSIÓN
// ─────────────────────────────────────────
async function generateExplosionGIF(packType, player) {
  const W = 420, H = 420;
  const pv = PACK_VISUAL[packType] || PACK_VISUAL.silver;
  const c = getRarityColors(player.rarity);
  const encoder = new GIFEncoder(W, H);
  const gifStream = encoder.createReadStream();
  const chunks = [];
  gifStream.on('data', chunk => chunks.push(chunk));
  encoder.start(); encoder.setRepeat(0); encoder.setDelay(60); encoder.setQuality(6);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  for (let f = 0; f <= 13; f++) {
    const prog = f/13;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#0a0a18'; ctx.globalAlpha=prog*0.95; ctx.fillRect(0,0,W,H);
    const flashAlpha = f<3?1-(f/3)*0.75:0;
    if (flashAlpha>0){ctx.fillStyle='#FFFFFF';ctx.globalAlpha=flashAlpha;ctx.fillRect(0,0,W,H);}
    ctx.globalAlpha=1;
    ctx.save(); ctx.translate(W/2,H/2);
    for (let r=0;r<18;r++){
      const angle=(r/18)*Math.PI*2+prog*0.3;
      const rayLen=(70+(r%3)*30)*(1+prog*2.2);
      ctx.save(); ctx.rotate(angle); ctx.globalAlpha=(1-prog)*0.9;
      const rg=ctx.createLinearGradient(15,0,rayLen,0);
      rg.addColorStop(0,pv.glow+'FF');rg.addColorStop(0.5,pv.glow+'66');rg.addColorStop(1,pv.glow+'00');
      ctx.beginPath();ctx.moveTo(15,-(2+r%2));ctx.lineTo(rayLen,0);ctx.lineTo(15,(2+r%2));
      ctx.fillStyle=rg;ctx.fill();ctx.restore();
    }
    ctx.restore();
    const numP=Math.round(prog*35);
    for (let i=0;i<numP;i++){
      const seed=i*113.5;
      const px=W/2+Math.cos(seed)*(55+i*11)*prog;
      const py=H/2+Math.sin(seed*0.7)*(40+i*9)*prog-prog*40;
      const ps=Math.max(0.5,4-i*0.1);
      ctx.beginPath();ctx.arc(px,py,ps,0,Math.PI*2);
      const pColors=[pv.glow,'#FFFFFF',c.shine,pv.accent,c.glow];
      ctx.fillStyle=pColors[i%pColors.length];
      ctx.globalAlpha=(1-prog*0.5)*(1-i/(numP+1)*0.4);ctx.fill();
    }
    ctx.globalAlpha=1;
    const topFly=prog*prog*200;
    const openScale=1+prog*0.1;
    const packW=180*openScale,packH=250*openScale;
    const bpx=W/2-packW/2,baseY=H/2-packH/2-10;
    const halfH=packH*0.5;
    const pg3=ctx.createLinearGradient(bpx,baseY,bpx+packW,baseY+packH);
    pg3.addColorStop(0,pv.shine);pg3.addColorStop(0.4,pv.primary);pg3.addColorStop(1,pv.dark);
    ctx.save();ctx.globalAlpha=1-prog*0.7;ctx.shadowColor=pv.glow;ctx.shadowBlur=22;
    ctx.beginPath();ctx.rect(bpx,baseY+halfH,packW,halfH);ctx.clip();
    roundRectPath(ctx,bpx,baseY,packW,packH,12);ctx.fillStyle=pg3;ctx.fill();ctx.restore();
    ctx.save();ctx.globalAlpha=1-prog*0.9;ctx.shadowColor=pv.glow;ctx.shadowBlur=22;
    ctx.beginPath();ctx.rect(bpx,baseY-topFly,packW,halfH+4);ctx.clip();
    const pg4=ctx.createLinearGradient(bpx,baseY-topFly,bpx+packW,baseY-topFly+packH);
    pg4.addColorStop(0,pv.shine);pg4.addColorStop(0.5,pv.primary);pg4.addColorStop(1,pv.dark);
    roundRectPath(ctx,bpx,baseY-topFly,packW,packH,12);ctx.fillStyle=pg4;ctx.fill();ctx.restore();
    encoder.setDelay(f<2?100:50);encoder.addFrame(ctx);
  }
  encoder.finish();
  return new Promise(resolve=>{gifStream.on('end',()=>resolve(Buffer.concat(chunks)));});
}

// ─────────────────────────────────────────
// 🏪 TIENDA DE PACKS
// ─────────────────────────────────────────
async function generatePackShopCanvas() {
  const W = 1130, H = 560;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#08080f');
  bgGrad.addColorStop(0.5, '#0e0e1c');
  bgGrad.addColorStop(1, '#08080f');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let x = 20; x < W; x += 28) {
    for (let y = 20; y < H; y += 28) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#ffffff12';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, 40); ctx.lineTo(16, 16); ctx.lineTo(40, 16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W-40, 16); ctx.lineTo(W-16, 16); ctx.lineTo(W-16, 40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, H-40); ctx.lineTo(16, H-16); ctx.lineTo(40, H-16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W-40, H-16); ctx.lineTo(W-16, H-16); ctx.lineTo(W-16, H-40); ctx.stroke();
  ctx.restore();

  const titleY = 58;
  ctx.save();
  ctx.strokeStyle = '#ffffff20';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, titleY - 10); ctx.lineTo(230, titleY - 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W - 30, titleY - 10); ctx.lineTo(W - 230, titleY - 10); ctx.stroke();
  ctx.font = `bold 36px ${FIFA_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 20;
  ctx.fillText('TIENDA DE PACKS', W / 2, titleY);
  ctx.shadowBlur = 0;
  ctx.font = `14px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff44';
  ctx.fillText('ELIGE TU PACK · ABRE JUGADORES · CONSTRUYE TU EQUIPO', W / 2, titleY + 22);
  ctx.restore();

  const packDefs = [
    {
      key: 'bronze', label: 'BRONZE', sublabel: 'Common Players', price: '500', sellVal: '230', rarity: 'COMMON', cmd: '.buy bronze',
      bg1: '#2a1a0a', bg2: '#1a0e04', topGlow: '#FF9944', accent: '#CD7F32', accentLight: '#FFD4A0',
      border1: '#8B4513', border2: '#FF9944', badgeBg: '#3a2010', badgeText: '#FFD4A0',
      priceColor: '#FFD4A0', particles: ['#FFD4A0', '#FF9944', '#CD7F32'],
    },

    {
      key: 'silver', label: 'SILVER', sublabel: 'Rare Players', price: '2500', sellVal: '1150', rarity: 'SILVER', cmd: '.buy silver',
      bg1: '#2a2a3a', bg2: '#1a1a28', topGlow: '#e0e0e0', accent: '#C8C8D8', accentLight: '#f0f0ff',
      border1: '#9090a0', border2: '#c0c0d0', badgeBg: '#3a3a50', badgeText: '#d0d0e0',
      priceColor: '#e8e8ff', particles: ['#ffffff', '#c0c0d0', '#9090a0'],
    },
    {
      key: 'gold', label: 'GOLD', sublabel: 'Epic Players', price: '7500', sellVal: '3650', rarity: 'EPIC', cmd: '.buy gold',
      bg1: '#1e1800', bg2: '#120f00', topGlow: '#FFE066', accent: '#FFD700', accentLight: '#FFFACD',
      border1: '#B8860B', border2: '#FFE066', badgeBg: '#2a2000', badgeText: '#FFFACD',
      priceColor: '#FFE066', particles: ['#FFFACD', '#FFD700', '#B8860B'],
    },
    {
      key: 'legend', label: 'LEGEND', sublabel: 'Legendary Players', price: '15000', sellVal: '7250', rarity: 'LEGENDARY', cmd: '.buy legend',
      bg1: '#150a20', bg2: '#0d0615', topGlow: '#CC88FF', accent: '#9B59B6', accentLight: '#E8D5F5',
      border1: '#4A235A', border2: '#CC88FF', badgeBg: '#200a30', badgeText: '#E8D5F5',
      priceColor: '#CC88FF', particles: ['#E8D5F5', '#CC88FF', '#9B59B6'],
    },

    {
  key: 'icon', label: 'ICON', sublabel: 'Icon Players',
  price: '95000', sellVal: '45000', rarity: 'ICON', cmd: '.buy icon',
  bg1: '#1a1a1a', bg2: '#0d0d0d', topGlow: '#E8E8E8', accent: '#C0C0C0',
  accentLight: '#FFFFFF', border1: '#808080', border2: '#E8E8E8',
  badgeBg: '#2a2a2a', badgeText: '#FFFFFF',
  priceColor: '#FFFFFF', particles: ['#FFFFFF', '#C0C0C0', '#808080'],
},
  ];

  const cardW = 175, cardH = 400;
  const startX = (W - (cardW * 5 + 30 * 4)) / 2;
  const cardY = 95;

  for (let pi = 0; pi < packDefs.length; pi++) {
    const pd = packDefs[pi];
    const cx = startX + pi * (cardW + 30);
    const cy = cardY;

    ctx.save();
    ctx.shadowColor = pd.topGlow;
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    roundRectPath(ctx, cx, cy, cardW, cardH, 14);
    ctx.fillStyle = pd.accent;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, cx, cy, cardW, cardH, 14);
    ctx.clip();

    const bgG = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
    bgG.addColorStop(0, pd.bg1);
    bgG.addColorStop(1, pd.bg2);
    ctx.fillStyle = bgG;
    ctx.fillRect(cx, cy, cardW, cardH);

    const diag = ctx.createLinearGradient(cx, cy, cx + cardW * 0.7, cy + cardH * 0.4);
    diag.addColorStop(0, pd.accentLight + '15');
    diag.addColorStop(0.5, pd.accentLight + '08');
    diag.addColorStop(1, 'transparent');
    ctx.fillStyle = diag;
    ctx.fillRect(cx, cy, cardW, cardH);

    for (let p = 0; p < 12; p++) {
      const px2 = cx + 10 + (p * 47) % (cardW - 20);
      const py2 = cy + 20 + (p * 83) % (cardH * 0.55);
      const pr = 1 + (p % 3) * 0.5;
      ctx.beginPath();
      ctx.arc(px2, py2, pr, 0, Math.PI * 2);
      ctx.fillStyle = pd.particles[p % pd.particles.length] + '50';
      ctx.fill();
    }

    for (let li = 0; li < 6; li++) {
      const ly = cy + cardH * 0.15 + li * (cardH * 0.12);
      ctx.beginPath();
      ctx.moveTo(cx + 8, ly);
      ctx.lineTo(cx + cardW - 8, ly);
      ctx.strokeStyle = pd.accent + '18';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const glowY = cy + 72;
    const glowR = 38;
    const radGrad = ctx.createRadialGradient(cx + cardW/2, glowY, 0, cx + cardW/2, glowY, glowR);
    radGrad.addColorStop(0, pd.accentLight + 'cc');
    radGrad.addColorStop(0.5, pd.accent + '88');
    radGrad.addColorStop(1, pd.accent + '00');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx + cardW/2, glowY, glowR, 0, Math.PI * 2);
    ctx.fill();

    const innerRad = ctx.createRadialGradient(cx + cardW/2 - 6, glowY - 6, 2, cx + cardW/2, glowY, glowR * 0.65);
    innerRad.addColorStop(0, pd.accentLight);
    innerRad.addColorStop(0.5, pd.accent);
    innerRad.addColorStop(1, pd.border1);
    ctx.fillStyle = innerRad;
    ctx.beginPath();
    ctx.arc(cx + cardW/2, glowY, glowR * 0.65, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = `bold 22px ${FIFA_FONT}`;
    ctx.fillStyle = pd.accentLight;
    ctx.textAlign = 'center';
    ctx.shadowColor = pd.topGlow;
    ctx.shadowBlur = 12;
    ctx.fillText(pd.label, cx + cardW / 2, cy + 132);
    ctx.shadowBlur = 0;

    ctx.font = `12px ${FIFA_FONT}`;
    ctx.fillStyle = pd.accent + 'bb';
    ctx.fillText(pd.sublabel, cx + cardW / 2, cy + 152);

    ctx.beginPath();
    ctx.moveTo(cx + 16, cy + 164);
    ctx.lineTo(cx + cardW - 16, cy + 164);
    const sepGrad = ctx.createLinearGradient(cx + 16, 0, cx + cardW - 16, 0);
    sepGrad.addColorStop(0, 'transparent');
    sepGrad.addColorStop(0.5, pd.accent + '88');
    sepGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = sepGrad;
    ctx.lineWidth = 1;
    ctx.stroke();

    const badgeX = cx + 20, badgeY = cy + 178, badgeW = cardW - 40, badgeH = 26;
    ctx.beginPath();
    roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fillStyle = pd.badgeBg;
    ctx.fill();
    ctx.strokeStyle = pd.accent + '55';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `bold 11px ${FIFA_FONT}`;
    ctx.fillStyle = pd.badgeText;
    ctx.textAlign = 'center';
    ctx.fillText(`✦ ${pd.rarity} ✦`, cx + cardW / 2, badgeY + 17);

    ctx.font = `11px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff40';
    ctx.fillText('PRECIO DE VENTA', cx + cardW / 2, cy + 228);
    ctx.font = `bold 14px ${FIFA_FONT}`;
    ctx.fillStyle = pd.accent;
    ctx.fillText(`${pd.sellVal} 💰`, cx + cardW / 2, cy + 248);

    ctx.beginPath();
    ctx.moveTo(cx + 16, cy + 262);
    ctx.lineTo(cx + cardW - 16, cy + 262);
    ctx.strokeStyle = pd.accent + '30';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = `11px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff40';
    ctx.fillText('PRECIO', cx + cardW / 2, cy + 282);

    ctx.font = `bold 30px ${FIFA_FONT}`;
    ctx.fillStyle = pd.priceColor;
    ctx.shadowColor = pd.topGlow;
    ctx.shadowBlur = 15;
    ctx.fillText(`${pd.price}`, cx + cardW / 2, cy + 316);
    ctx.shadowBlur = 0;
    ctx.font = `bold 14px ${FIFA_FONT}`;
    ctx.fillStyle = pd.priceColor + 'aa';
    ctx.fillText('monedas', cx + cardW / 2, cy + 335);

    const btnX = cx + 14, btnY = cy + 352, btnW = cardW - 28, btnH = 30;
    const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
    btnGrad.addColorStop(0, pd.accent + 'dd');
    btnGrad.addColorStop(1, pd.border1 + 'cc');
    ctx.beginPath();
    roundRectPath(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.fillStyle = btnGrad;
    ctx.fill();
    ctx.strokeStyle = pd.accentLight + '66';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = `bold 12px ${FIFA_FONT}`;
    ctx.fillStyle = '#000000cc';
    ctx.shadowColor = pd.accentLight;
    ctx.shadowBlur = 4;
    ctx.fillText(pd.cmd, cx + cardW / 2, btnY + 20);
    ctx.shadowBlur = 0;

    ctx.restore();

    ctx.save();
    ctx.beginPath();
    roundRectPath(ctx, cx, cy, cardW, cardH, 14);
    ctx.strokeStyle = pd.border2 + 'aa';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    roundRectPath(ctx, cx + 2, cy + 2, cardW - 4, cardH - 4, 13);
    ctx.strokeStyle = pd.accentLight + '22';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.font = `12px ${FIFA_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff25';
  ctx.fillText('Usa  !buy <tipo>  para comprar · También puedes comprar varios: !buy 5 silver · Ver inventario: !mypacks', W / 2, H - 14);
  ctx.restore();

  return canvas;
}

// ─────────────────────────────────────────
// 💰 CANVAS DE BALANCE — Estilo Soccer Guru
// ─────────────────────────────────────────
async function generateBalanceCanvas(user, username) {
  // Calculamos el valor total de venta de todos los jugadores del club
  const players_list = user.players || [];
  const totalSellValue = players_list.reduce((sum, p) => sum + (SELL_PRICES[p.rarity] || 90), 0);
  const coins = user.coins || 0;

  // Las dos filas que queremos mostrar
  const rows = [
    { icon: '💰', label: 'Balance',          value: coins.toLocaleString()          },
    { icon: '💸', label: 'Players Sell Value', value: totalSellValue.toLocaleString() },
  ];

  const W = 420;
  const HEADER_H = 52;
  const ROW_H = 54;
  const PADDING = 18;
  const H = HEADER_H + rows.length * ROW_H + PADDING;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Fondo oscuro con borde redondeado ──
  ctx.fillStyle = '#1e1f22';
  roundRectPath(ctx, 0, 0, W, H, 12);
  ctx.fill();

  // ── Borde sutil ──
  ctx.save();
  ctx.strokeStyle = '#3a3b40';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, 0, 0, W, H, 12);
  ctx.stroke();
  ctx.restore();

  // ── Header: "@username has a balance of X 💰" ──
  const tier = getEloTier(user.elo || 1000);
  ctx.save();
  ctx.font = `bold 15px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  const headerText = `@${username} tiene un balance de  ${coins.toLocaleString()} 💰`;
  // Fondo del header ligeramente más claro
  ctx.fillStyle = '#2b2d31';
  roundRectPath(ctx, 0, 0, W, HEADER_H, 12);
  ctx.fill();
  // Solo esquinas superiores redondeadas — rellenar las inferiores
  ctx.fillRect(0, HEADER_H / 2, W, HEADER_H / 2);
  ctx.restore();

  // Texto del header
  ctx.save();
  ctx.font = `bold 14px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`@${username}`, PADDING, 22);
  ctx.font = `13px ${FIFA_FONT}`;
  ctx.fillStyle = '#b5bac1';
  ctx.fillText(`tiene un balance de  ${coins.toLocaleString()} 💰  ·  ${tier.emoji} ${tier.name}`, PADDING, 40);
  ctx.restore();

  // ── Filas de datos ──
  rows.forEach((row, i) => {
    const rowY = HEADER_H + i * ROW_H;

    // Fondo alternado
    ctx.save();
    ctx.fillStyle = i % 2 === 0 ? '#25262b' : '#1e1f22';
    ctx.fillRect(0, rowY, W, ROW_H);

    // Línea separadora superior
    ctx.strokeStyle = '#3a3b40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rowY);
    ctx.lineTo(W, rowY);
    ctx.stroke();
    ctx.restore();

    // Icono (círculo de fondo)
    const iconCX = PADDING + 18;
    const iconCY = rowY + ROW_H / 2;
    ctx.save();
    ctx.fillStyle = '#313338';
    ctx.beginPath();
    ctx.arc(iconCX, iconCY, 18, 0, Math.PI * 2);
    ctx.fill();

    // Emoji del icono
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(row.icon, iconCX, iconCY + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();

    // Label
    ctx.save();
    ctx.font = `14px ${FIFA_FONT}`;
    ctx.fillStyle = '#b5bac1';
    ctx.textAlign = 'left';
    ctx.fillText(row.label, PADDING + 44, rowY + ROW_H / 2 + 5);
    ctx.restore();

    // Valor (alineado a la derecha)
    ctx.save();
    ctx.font = `bold 16px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(row.value, W - PADDING, rowY + ROW_H / 2 + 5);
    ctx.restore();
  });

  // Redondear esquinas inferiores (clip)
  // Re-aplicamos el clip general para las esquinas inferiores
  const finalCanvas = createCanvas(W, H);
  const fCtx = finalCanvas.getContext('2d');
  fCtx.save();
  roundRectPath(fCtx, 0, 0, W, H, 12);
  fCtx.clip();
  fCtx.drawImage(canvas, 0, 0);
  fCtx.restore();

  return finalCanvas;
}

// ─────────────────────────────────────────
// 💸 CANVAS DE VENTA
// ─────────────────────────────────────────
async function generateSellCanvas(player, coinsEarned, newBalance, quantity) {
  const W = 480, H = 180;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const c = getRarityColors(player.rarity);

  const bgG = ctx.createLinearGradient(0, 0, W, H);
  bgG.addColorStop(0, '#07070f');
  bgG.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = bgG;
  ctx.fillRect(0, 0, W, H);

  const sideGlow = ctx.createLinearGradient(0, 0, 80, 0);
  sideGlow.addColorStop(0, c.glow + '33');
  sideGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = sideGlow;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = c.border + '66';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRectPath(ctx, 2, 2, W - 4, H - 4, 12);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  const barGrad = ctx.createLinearGradient(0, 0, 0, H);
  barGrad.addColorStop(0, c.cardTop);
  barGrad.addColorStop(1, c.cardBot);
  ctx.fillStyle = barGrad;
  ctx.beginPath();
  roundRectPath(ctx, 0, 16, 5, H - 32, 3);
  ctx.fill();

  const miniW = 80, miniH = 110;
  const miniX = 18, miniY = (H - miniH) / 2;
  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 15;
  drawFIFACardPath(ctx, miniX, miniY, miniW, miniH, 7);
  const miniGrad = ctx.createLinearGradient(miniX, miniY, miniX + miniW, miniY + miniH);
  miniGrad.addColorStop(0, c.cardTop);
  miniGrad.addColorStop(0.6, c.cardMid);
  miniGrad.addColorStop(1, c.cardBot);
  ctx.fillStyle = miniGrad;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  drawFIFACardPath(ctx, miniX, miniY, miniW, miniH, 7);
  ctx.clip();
  drawFIFAPattern(ctx, miniX, miniY, miniW, miniH * 0.6, c.shine);
  ctx.font = `bold 22px ${FIFA_FONT}`;
  ctx.fillStyle = c.ratingCol;
  ctx.textAlign = 'center';
  ctx.fillText(String(player.rating), miniX + miniW / 2, miniY + 26);
  ctx.font = `bold 8px ${FIFA_FONT}`;
  ctx.fillStyle = c.posCol;
  ctx.fillText(player.position, miniX + miniW / 2, miniY + 38);
  ctx.fillStyle = c.nameBar;
  ctx.fillRect(miniX, miniY + miniH * 0.56, miniW, 18);
  ctx.font = `bold 7px ${FIFA_FONT}`;
  ctx.fillStyle = c.nameCol;
  ctx.fillText(player.name.toUpperCase().substring(0, 10), miniX + miniW / 2, miniY + miniH * 0.56 + 12);
  ctx.fillStyle = c.statsArea;
  ctx.fillRect(miniX, miniY + miniH * 0.56 + 18, miniW, miniH - (miniH * 0.56 + 18));
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  drawFIFACardPath(ctx, miniX, miniY, miniW, miniH, 7);
  ctx.stroke();
  ctx.restore();

  const textX = miniX + miniW + 18;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = `11px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff30';
  ctx.fillText('VENTA COMPLETADA', textX, 30);
  const displayName = (quantity > 1 ? `${quantity}x ` : '') + player.name;
  ctx.font = `bold 22px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = c.glow + '44';
  ctx.shadowBlur = 5;
  ctx.fillText(displayName, textX, 56);
  ctx.shadowBlur = 0;
  ctx.font = `bold 11px ${FIFA_FONT}`;
  ctx.fillStyle = c.shine;
  ctx.fillText(`${player.rarity.toUpperCase()}  ·  ${player.position}  ·  ${player.rating} OVR`, textX, 74);
  ctx.beginPath();
  ctx.moveTo(textX, 84);
  ctx.lineTo(W - 18, 84);
  ctx.strokeStyle = '#ffffff15';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `11px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff35';
  ctx.fillText('RECIBISTE', textX, 102);
  ctx.font = `bold 28px ${FIFA_FONT}`;
  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 14;
  ctx.fillText(`+${coinsEarned.toLocaleString()} 💰`, textX, 130);
  ctx.shadowBlur = 0;
  ctx.font = `12px ${FIFA_FONT}`;
  ctx.fillStyle = '#ffffff40';
  ctx.fillText(`Balance actual: ${newBalance.toLocaleString()} monedas`, textX, 154);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let x = 110; x < W; x += 24) {
    for (let y = 10; y < H; y += 24) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  return canvas;
}

// ─────────────────────────────────────────
// 📄 AYUDA
// ─────────────────────────────────────────
const helpPages = [
  {
    title: '📖 Help — Page 1/6 · Economy & Packs',
    color: 0x1a56db,
    fields: [
      { name: '💰 `.bal`',           value: 'Check your current coins', inline: false },
      { name: '🎁 `.daily`',         value: 'Daily reward (every 24h) — builds streak', inline: false },
      { name: '🎖️ `.claim`',         value: 'Claim coins every **12h** + streak bonus', inline: false },
      { name: '⏱️ `.cd`',            value: 'Check all your cooldowns:\n**Daily · Claim · Friendly · Arena** with exact time or ✅ Ready', inline: false },
      { name: '⚽ `.penalty <amount>`', value: 'Bet coins on the penalty system\n🎯 Pick 1 of 5 zones — 2 winners\n💰 Minimum **50 💰** · Maximum **50,000 💰**\n🏆 If you win you get **double** your bet', inline: false },
      { name: '📦 `.packs`',         value: 'View the pack shop and prices', inline: false },
      { name: '🛒 `.buy <type>`', value: '🥉 Bronze **500 💰** → Common\n⚪ Silver **2500 💰** → Rare\n🥇 Gold **7500 💰** → Epic\n💎 Legend **15000 💰** → Legendary\n🏆 Icon **95000 💰** → World Cup Champions', inline: false },
      { name: '🎒 `.mypacks`',     value: 'Check how many packs you have available', inline: false },
      { name: '🎮 `.open <type>` / `.o <type>`', value: 'Open pack with live step-by-step animation\n🥉 bronze · ⚪ silver · 🥇 gold · 💎 legend · 🏆 icon', inline: false },
    ],
    footer: '⬅️ Previous  |  Next ➡️  ·  Navigate with the buttons'
  },
  {
    title: '📖 Help — Page 2/6 · Club, Squad & Cards',
    color: 0x00C851,
    fields: [
      { name: '📋 `.club`',                   value: `View your full squad (max **${MAX_CLUB_SIZE} players**)`, inline: false },
      { name: '✏️ `.club rename <name>`',      value: 'Change your club name', inline: false },
      { name: '🖼️ `.club logo <url>`',         value: 'Set a logo for your club with a PNG/JPG image\n`.club logo remove` to remove it', inline: false },
      { name: '🟢 `.team`',                    value: 'View your active squad with interactive image (4 players)', inline: false },
      { name: '🖼️ `.show <name>`',             value: 'View an individual card with detailed stats\n💡 Also works with cards you **don\'t have** in your club', inline: false },
      { name: '🎮 `.players [filter]`',        value: 'View **all** available players in the game, sorted by OVR\n**Filters:** `legendary` · `epic` · `rare` · `common` · `gk` · `dm` · `am` · `st`\n🎲 Random button to jump to a random page', inline: false },
      { name: '➕ `.add <name>`',              value: 'Add a player from your club to the active squad', inline: false },
      { name: '❌ `.remove <name>`',           value: 'Remove a player from the active squad (returns to club)', inline: false },
      { name: '🗑️ `.removeall <name>`',        value: 'Remove all copies of a player from the squad', inline: false },
    ],
    footer: '⬅️ Previous  |  Next ➡️  ·  Navigate with the buttons'
  },
  {
    title: '📖 Help — Page 3/6 · Market & Squad',
    color: 0xFFD700,
    fields: [
      { name: '🔄 `.swap`',                         value: 'Swap positions between two players in the squad', inline: false },
      { name: '🏪 `.market`',                       value: 'View the dynamic market — cards listed by other players', inline: false },
      { name: '🏪 `.market <name>`',                value: 'Buy the cheapest available card of that player\nEx: `.market Czerro`', inline: false },
      { name: '💸 `.sell <name> [price]`',           value: 'List a card on the market with a custom price.\nNo price = automatic minimum. Cards last **24h**.', inline: false },
      { name: '❌ `.cancel`',                     value: 'View your active market listings and **withdraw** any you want.\nThe card goes straight back to your club.', inline: false },
      { name: '💸 `.send @user <amount>`',           value: 'Transfer coins to another player\nMinimum **50 💰** · Requires confirmation before sending', inline: false },
      { name: '🔄 `.trade @user <your card> for <their card>`',
        value: [
          'Trade cards with another player.',
          '**Rules:**',
          '• Only cards with the same OVR',
          '• You can\'t trade with yourself',
          '• The rival has **120s** to accept or reject',
          '• If any card was in the squad, it gets removed automatically',
          '💡 Ex: `.trade @Luntek Veil for Compass`',
        ].join('\n'),
        inline: false
      },
      { name: '💡 Minimum sell prices', value: '• Common: **300** 💰\n• Rare: **1900** 💰\n• Epic: **5000** 💰\n• Legendary: **17000** 💰\n• World Cup: **100000** 💰', inline: false },
    ],
    footer: '⬅️ Previous  |  Next ➡️  ·  Navigate with the buttons'
  },
  {
    title: '📖 Help — Page 4/6 · Arena & Matches',
    color: 0xFF6B00,
    fields: [
      { name: '🤝 `.friendly @rival`', value: 'Friendly match\n💰 Win: **+100** · Draw: **+50** · Loss: **+20**', inline: false },
      { name: '⚔️ `.arena`',           value: '**Automatic ELO-based matchmaking**\nYou get matched with someone of similar ELO\n💰 Win: **+400** · Draw: **+250** · Loss: **+50**\n⏱️ **15 minute** cooldown', inline: false },
      { name: '📊 `.top`',             value: 'Global top 10 by ELO score', inline: false },
      { name: '⚔️ `.duels @user <bet>`', value: 'Challenge someone with coins on the line\nWinner takes all · Min **100 💰** · 5 min cooldown', inline: false },
      { name: '🏆 `.achievements`',          value: 'View your achievements and progress · Rewards unlock automatically', inline: false },
      { name: '📊 `.collect`',       value: 'See what % of cards you own, breakdown by rarity and your best cards', inline: false },
      { name: '💡 Tips to earn coins', value: '• **!claim** every **12h** → 14 day streak = free Gold Pack\n• **!daily** every day → 7 day streak = 2 silver packs\n• **!arena** daily → up to **+400 💰** per win\n• Sell duplicates → Epic worth **7500 💰** on market\n• Buy on **!market** and sell higher\n• 30 day streak → free **LEGEND pack**', inline: false },
      { name: '🎯 `.quests`',
        value: '3 daily quests (🟢 easy · 🟡 medium · 🔴 hard)\nEarn up to **1,350 💰** per day completing them\n`.quests reclamar <1|2|3>` to claim',
        inline: false },
      { name: '🏆 `.tournament`',
        value: 'Elimination tournaments with visual bracket\n`.torneo listar` · `.torneo jugar <id>` · `.torneo bracket <id>`\nAdmins create tournaments: `.torneo crear <name> <entry> <players>`',
        inline: false },
    ],
    footer: '⬅️ Previous  |  Next ➡️  ·  Navigate with the buttons'
  },
  {
    title: '📖 Help — Page 5/6 · Clans & Minigames',
    color: 0x5865F2,
    fields: [
      { name: '👥 Clans', value: 'Clan system to play as a team:', inline: false },
      { name: '`.clan create <name>`',        value: `Create your own clan · Costs **2,000 💰**`, inline: false },
      { name: '`.clan invite @user`',       value: 'Invite someone to your clan (leader only)', inline: false },
      { name: '`.clan info [name]`',         value: 'View your clan info or search one by name', inline: false },
      { name: '`.clan top`',                 value: 'Global clan ranking by total ELO', inline: false },
      { name: '`.clan war`',              value: 'Automatic war against another clan · Sums everyone\'s ELO\n💰 Each winning member receives **+200 💰** · **6h** cooldown', inline: false },
      { name: '`.clan description <text>`',  value: 'Edit clan description (leader only · max 100 chars)', inline: false },
      { name: '`.clan kick @user`',      value: 'Kick a member (leader only)', inline: false },
      { name: '`.clan leader @user`',         value: 'Transfer leadership to another member', inline: false },
      { name: '`.clan leave`',               value: 'Leave your current clan', inline: false },
      { name: '`.clan disband`',             value: 'Permanently dissolve the clan (leader only)', inline: false },
      { name: '🎮 Minigames', value: 'Games with bets or fixed rewards:', inline: false },
      { name: '`.trivia`',                   value: 'Football question with 4 options · **20 seconds** to answer\n💰 Prize: up to **250 💰** · **15 min** cooldown', inline: false },
      { name: '`.scrape`',                   value: 'Scratch card · Cost: **200 💰** · **8 min** cooldown\n🎯 Triple → full prize · Pair → 30% of prize · 2+ rares → **350 💰**', inline: false },
      { name: '`.penalty <amount>`',         value: 'Penalty bet · Pick 1 of 5 zones · 2 winning zones\n💰 Min **50** · Max **50,000** · Win **double** · **10 min** cooldown', inline: false },
      { name: '`.rul <amount> <option>`',    value: 'Roulette · Pick color or number\n🔴 Black/Red **x2** · 🟢 Green **x35** · 🎯 Exact number **x35** · **10 min** cooldown', inline: false },
      { name: '`.dice <amount>`',           value: 'Roll 2 dice vs the bot · Higher total wins **x2** · Tie returns bet\n💰 Min **50** · Max **50,000** · **10 min** cooldown', inline: false },
    ],
    footer: '⬅️ Previous  |  End  ·  Navigate with the buttons'
  },
  {
    title: '📖 Help — Page 6/6 · Admin',
    color: 0x9B59B6,
    fields: [
      { name: '👑 Admin Commands', value: 'The following commands only work if you are an admin:', inline: false },
      { name: '`.giveme <n>`',          value: 'Give yourself coins',                inline: true },
      { name: '`.give @u <n>`',         value: 'Give coins to a user',               inline: true },
      { name: '`.take @u <n>`',         value: 'Take coins from a user',             inline: true },
      { name: '`.givecard @u <player>`',value: 'Give a specific card',               inline: true },
      { name: '`.givepack @u <t> [n]`', value: 'Give pack(s) to a user',             inline: true },
      { name: '`.profile @u`',          value: 'View full profile',                  inline: true },
      { name: '`.resetuser @u`',        value: 'Reset full account',                 inline: true },
      { name: '`.setelo @u <n>`',       value: 'Adjust ELO',                         inline: true },
      { name: '`.resetdaily @u`',       value: 'Reset daily/streak',                 inline: true },
      { name: '`.clearteam @u`',        value: 'Clear active squad',                 inline: true },
      { name: '`.clearclub @u`',        value: 'Clear full club and squad',          inline: true },
      { name: '`.removelogo @u`',       value: 'Remove club logo',                   inline: true },
      { name: '`.info`',                value: 'Global bot statistics',              inline: true },
      { name: '`.addadmin @u`',         value: 'Add admin (SuperAdmin only)',         inline: true },
      { name: '`.removeadmin @u`',      value: 'Remove admin (SuperAdmin only)',      inline: true },
      { name: '`.admins`',              value: 'View admin list',                    inline: true },
      { name: '`.anuncio <msg>`',       value: 'Official announcement in channel',   inline: true },
      { name: '`.adminhelp`',           value: 'View expanded admin panel',          inline: true },
    ],
    footer: '⬅️ Previous  |  End  ·  Navigate with the buttons'
  }
];

function buildHelpEmbed(page) {
  const p = helpPages[page];
  return { embeds: [{ color: p.color, title: p.title, fields: p.fields, footer: { text: p.footer }, timestamp: new Date().toISOString() }] };
}
function buildHelpRow(uid, page) {
  const total = helpPages.length;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`help_prev_${uid}`).setLabel('⬅️ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(page===0),
    new ButtonBuilder().setCustomId(`help_page_${uid}`).setLabel(`${page+1} / ${total}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`help_next_${uid}`).setLabel('Siguiente ➡️').setStyle(ButtonStyle.Primary).setDisabled(page===total-1)
  );
}

// ─────────────────────────────────────────
// 🎭 ARENA HELPERS
// ─────────────────────────────────────────
function getEloTier(elo) {
  if (elo >= 1800) return { name: 'CAMPEÓN',  emoji: '👑', color: '#FFD700' };
  if (elo >= 1500) return { name: 'DIAMANTE', emoji: '💎', color: '#b9f2ff' };
  if (elo >= 1200) return { name: 'PLATINO',  emoji: '🔷', color: '#00cfff' };
  if (elo >= 1000) return { name: 'ORO',      emoji: '🥇', color: '#ffd700' };
  if (elo >= 800)  return { name: 'PLATA',    emoji: '🥈', color: '#c0c0c0' };
  return                  { name: 'BRONCE',   emoji: '🥉', color: '#cd7f32' };
}
function findArenaMatch(userId, userElo) {
  const now = Date.now();
  for (const [qId, qData] of arenaQueue.entries()) {
    if (now - qData.timestamp > ARENA_QUEUE_TIMEOUT) arenaQueue.delete(qId);
  }
  const userTime = arenaQueue.has(userId) ? now - arenaQueue.get(userId).timestamp : 0;
  const eloRange = userTime > 120000 ? 400 : 200;
  let bestMatch = null, bestDiff = Infinity;
  for (const [qId, qData] of arenaQueue.entries()) {
    if (qId === userId) continue;
    const diff = Math.abs(qData.elo - userElo);
    if (diff <= eloRange && diff < bestDiff) { bestDiff = diff; bestMatch = { id: qId, ...qData }; }
  }
  return bestMatch;
}

// ─────────────────────────────────────────
// 🖼️ HELPER: Descargar y validar logo de club
// ─────────────────────────────────────────
async function fetchClubLogo(url) {
  const cleanUrl = url.split('?')[0].toLowerCase();
  if (!cleanUrl.endsWith('.png') && !cleanUrl.endsWith('.jpg') && !cleanUrl.endsWith('.jpeg') && !cleanUrl.endsWith('.webp')) {
    return { ok: false, reason: 'El URL debe terminar en `.png`, `.jpg`, `.jpeg` o `.webp`.' };
  }
  let buffer;
  try {
    const https = require('https');
    const http  = require('http');
    const lib   = url.startsWith('https') ? https : http;
    buffer = await new Promise((resolve, reject) => {
      lib.get(url, { timeout: 8000 }, res => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
    });
  } catch (e) {
    return { ok: false, reason: `No se pudo descargar la imagen. ¿El URL es público y directo? (${e.message})` };
  }
  try {
    await loadImage(buffer);
  } catch {
    return { ok: false, reason: 'El archivo descargado no es una imagen válida.' };
  }
  return { ok: true, buffer };
}

// Dibuja el logo del club en canvas (círculo recortado con borde)
async function drawClubLogo(ctx, logoBuffer, cx, cy, radius) {
  if (!logoBuffer) return;
  try {
    const img = await loadImage(logoBuffer);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFD70088';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  } catch { /* silencioso si falla al dibujar */ }
}


// ─────────────────────────────────────────
// 👥 CLANES
// ─────────────────────────────────────────
let clansData = {};
if (fs.existsSync('/app/data/clans.json')) {
  try { clansData = JSON.parse(fs.readFileSync('/app/data/clans.json')); } catch {}
}
function saveClans() { fs.writeFileSync('/app/data/clans.json', JSON.stringify(clansData, null, 2)); }

const CLAN_MAX_MEMBERS = 3;
const CLAN_CREATE_COST = 2000;
const CLAN_WAR_COOLDOWN = 6 * 60 * 60 * 1000;

function getClanOfUser(uid) {
  return Object.values(clansData).find(c => c.members.includes(uid)) || null;
}
function getClanIdOfUser(uid) {
  return Object.keys(clansData).find(k => clansData[k].members.includes(uid)) || null;
}


// ─────────────────────────────────────────
// 🏆 ADMINS DE TORNEO
// ─────────────────────────────────────────
let tournamentAdmins = new Set();
if (fs.existsSync('/app/data/tournadmins.json')) {
  const loaded = JSON.parse(fs.readFileSync('/app/data/tournadmins.json'));
  loaded.forEach(id => tournamentAdmins.add(id));
}
function saveTournamentAdmins() { fs.writeFileSync('/app/data/tournadmins.json', JSON.stringify([...tournamentAdmins], null, 2)); }
function isTournamentAdmin(userId) { return admins.has(userId) || tournamentAdmins.has(userId); }

// ─────────────────────────────────────────
// 🔧 HELPERS
// ─────────────────────────────────────────
function deepCopyPlayer(p) {
  return { ...p, stats: { ...p.stats } };
}

// ─────────────────────────────────────────
// 🤖 EVENTO PRINCIPAL
// ─────────────────────────────────────────
client.on('messageCreate', async message => {
  if (message.author.bot) return;
if (!message.content.startsWith(prefix)) return;

// ── Verificar ban ANTES de cualquier procesamiento ──
if (isBanned(message.author.id)) {
  // Silencioso: no responder nada, o puedes activar el reply:
  // return message.reply('🚫 Has sido baneado del bot.');
  return;
}

  const userId = message.author.id;
  const now = Date.now();

  if (!isAdmin(userId)) {
    const lastUsed = cooldowns.get(userId) || 0;
    const remaining = COOLDOWN_MS - (now - lastUsed);
    if (remaining > 0) return message.reply(`⏳ Espera **${(remaining/1000).toFixed(1)}s** antes de usar otro comando.`);
    cooldowns.set(userId, now);
  }

 if (!data[userId]) {
    data[userId] = { coins: 1800, players: [], team: [], teamName: message.author.username + "'s FC", packs: { silver:0, bronze:0, gold:0, legend:0 }, elo: 1000, daily: { lastClaim:0, streak:0 }, clubLogo: null };
    saveData();
  }

  const u = data[userId];
  if (!u.coins && u.coins !== 0) u.coins = 1000;
  if (!u.players) u.players = [];
  if (!u.team) u.team = [];
  if (!u.packs) u.packs = { silver:0, bronze:0, gold:0, legend:0, icon:0 };
  if (u.packs.silver === undefined)   u.packs.silver = 0;
  if (u.packs.legend === undefined)   u.packs.legend = 0;
  if (u.packs.icon === undefined) u.packs.icon = 0;
  saveData();

  const user = data[userId];
  const args = message.content.trim().split(/\s+/);
  const rawCmd = args[0].toLowerCase();
  const cmd = rawCmd === '.o' ? '.open' : rawCmd;

  // ─────────────────────────────────────────
  // ─────────────────────────────────────────
  // 💰 BALANCE — Estilo Soccer Guru
  // ─────────────────────────────────────────
  if (cmd === '.bal') {
    const tier = getEloTier(user.elo || 1000);
    const playersList = user.players || [];
    const totalSellValue = playersList.reduce((sum, p) => sum + (SELL_PRICES[p.rarity] || 90), 0);
    const totalMarketValue = playersList.reduce((sum, p) => {
      const MARKET_MULTIPLIER = { "Legendary": 18, "Epic": 10, "Rare": 5, "Common": 2.5 };
      return sum + Math.round(p.rating * p.rating * (MARKET_MULTIPLIER[p.rarity] || 2.5));
    }, 0);
    const coins = user.coins || 0;
    const clubName = user.teamName || message.author.username + "'s FC";
    const balFiles = user.clubLogo
      ? [{ attachment: Buffer.from(user.clubLogo, 'base64'), name: 'club-logo.png' }]
      : [];

    return message.reply({
      embeds: [{
        color: 0x2b2d31,
        description: `<@${userId}> has a transfer budget of **${coins.toLocaleString()}** ${EMOJI_COIN}`,
        thumbnail: user.clubLogo ? { url: 'attachment://club-logo.png' } : undefined,
        fields: [
          {
            name: '',
            value: [
              `👥  **Players Value:**　　　　${totalMarketValue.toLocaleString()}`,
              `💸  **Players Sell Value:**　　${totalSellValue.toLocaleString()}`,
              `🏦  **Club Resources:**　　　　${(coins + totalSellValue).toLocaleString()}`,
            ].join('\n'),
            inline: false
          }
        ],
        footer: {
          text: `${clubName}  ·  ${tier.emoji} ${tier.name}  ·  ELO ${user.elo || 1000}`
        },
        timestamp: new Date().toISOString()
      }],
      files: balFiles
    });
  }

  // ─────────────────────────────────────────
  // ─────────────────────────────────────────
  // 🎁 DAILY — Solo acumula racha
  // ─────────────────────────────────────────
  if (cmd === '.daily') {
    const nowTs = Date.now();
    const lastClaim = user.daily.lastClaim || 0;
    const elapsed = nowTs - lastClaim;

    if (elapsed < 24 * 60 * 60 * 1000) {
      const remaining = 24 * 60 * 60 * 1000 - elapsed;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      return message.reply(`⏰ You already registered your attendance today.\n⏳ Come back in **${hours}h ${minutes}m ${seconds}s**`);
    }

    const isStreak = lastClaim > 0 && elapsed < DAILY_COOLDOWN_MS * 2;
    const newStreak = isStreak ? (user.daily.streak || 0) + 1 : 1;

    user.daily.lastClaim = nowTs;
    user.daily.streak = newStreak;
    saveData();

    const nextMilestone = Object.keys(STREAK_MILESTONES).map(Number).sort((a,b)=>a-b).find(m => m > newStreak);
    const nextReward = DAILY_BASE_REWARD + (newStreak - 1) * DAILY_STREAK_BONUS;

   const _lDly = checkLogros(userId, 'daily_streak', user.daily.streak);
   await announceLogros(message, _lDly);

    let streakBar = '';
    if (nextMilestone) {
      const filled = Math.floor(((newStreak % nextMilestone) / nextMilestone) * 10);
      streakBar = `\n🎯 Next milestone: Day **${nextMilestone}** [${'█'.repeat(filled)}${'░'.repeat(10-filled)}]`;
    }

    let lines = [
      `🎁 **¡Asistencia registrada!**`, ``,
      `🔥 Current streak: **${newStreak}** day${newStreak!==1?'s':''} consecutive${newStreak!==1?'s':''}`,
      `💡 Use `.claim` to collect your coins for the day`,
      `📅 Tomorrow you can claim: **${nextReward}** 💰`,
    ];

    if (!isStreak && lastClaim > 0) lines.push(``, `💔 ¡You broke your streak! Start again from 1.`);

    const nextClaimMilestone = Object.keys(CLAIM_MILESTONES).map(Number).sort((a,b)=>a-b).find(m => !(user.daily.claimedMilestones||[]).includes(m));
    if (nextClaimMilestone) {
      const daysLeft = Math.max(0, nextClaimMilestone - newStreak);
      lines.push(``, `🎁 Next reward with \`.claim\`: Day **${nextClaimMilestone}** (are missing **${daysLeft}** day${daysLeft!==1?'s':''})`);
    }

    if (streakBar) lines.push(streakBar);
    lines.push(``, `💡 Use `.claim` to collect your daily coin rewards.`);

    return message.reply(lines.join('\n'));
  }

  // ─────────────────────────────────────────
  // 🎖️ CLAIM — Recompensas cada 24h (monedas + bonos de racha)
  // ─────────────────────────────────────────
  if (cmd === '.claim') {
    const nowTs = Date.now();
    const lastClaimed = user.daily.lastCoinClaim || 0;
    const elapsed = nowTs - lastClaimed;

   const CLAIM_COOLDOWN_MS = 12 * 60 * 60 * 1000;
if (elapsed < CLAIM_COOLDOWN_MS) {
  const remaining = CLAIM_COOLDOWN_MS - elapsed;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      return message.reply(`⏰ You already claimed your coins today.\n⏳ Come back in **${hours}h ${minutes}m ${seconds}s**`);
    }

    const streak = user.daily.streak || 0;
    let reward = DAILY_BASE_REWARD + (streak > 0 ? (streak - 1) * DAILY_STREAK_BONUS : 0);
    let bonusLines = [];

    if (STREAK_MILESTONES[streak]) {
      const m = STREAK_MILESTONES[streak];
      reward += m.coins;
      bonusLines.push(`${m.msg} **+${m.coins}** 💰`);
    }

    // Packs por hitos de racha
    if (!user.daily.claimedMilestones) user.daily.claimedMilestones = [];
    const available = Object.keys(CLAIM_MILESTONES).map(Number).filter(m => streak >= m && !user.daily.claimedMilestones.includes(m));
    let packLines = [];
    for (const milestone of available) {
      const packReward = CLAIM_MILESTONES[milestone];
      user.packs[packReward.pack] = (user.packs[packReward.pack] || 0) + packReward.amount;
      user.daily.claimedMilestones.push(milestone);
      packLines.push(`${packReward.msg}`);
    }

    user.daily.lastCoinClaim = nowTs;
    user.coins += reward;
    saveData();

      checkLogros(userId, 'coins_total', user.coins);

    const nextReward = DAILY_BASE_REWARD + streak * DAILY_STREAK_BONUS;
    const nextMilestone = Object.keys(STREAK_MILESTONES).map(Number).sort((a,b)=>a-b).find(m => m > streak);

    let streakBar = '';
    if (nextMilestone) {
      const filled = Math.floor(((streak % nextMilestone) / nextMilestone) * 10);
      streakBar = `\n🎯 Next coin milestone: Day **${nextMilestone}** [${'█'.repeat(filled)}${'░'.repeat(10-filled)}]`;
    }

    let lines = [
      `🎁 **¡Daily reward claimed!**`, ``,
      `💰 You received **+${reward}** coins`,
      `💼 Current balance: **${user.coins}** 💰`, ``,
      `🔥 Streak: **${streak}** day${streak!==1?'s':''} consecutive${streak!==1?'s':''}`,
      `📅 Tomorrow you will receive: **${nextReward}** 💰`,
    ];

    if (bonusLines.length > 0) lines.push(``, ...bonusLines);
    if (packLines.length > 0) lines.push(``, `🎉 **¡Packs unlocked by streak!**`, ...packLines, ``, `📦 Check your inventory with \`.mypacks\``);
    if (streakBar) lines.push(streakBar);
    if (streak === 0) lines.push(``, `💡 Use `.daily` every day to build streaks and unlock better rewards.`);

    return message.reply(lines.join('\n'));
  }

  // ─────────────────────────────────────────
  // 🛒 TIENDA DE PACKS
  // ─────────────────────────────────────────
  if (cmd === '.packs') {
    const shopCanvas = await generatePackShopCanvas();  

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop_buy_bronze_${userId}`).setLabel('🥉 Bronze — 500 💰').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shop_buy_silver_${userId}`).setLabel('🥈 Silver — 2500 💰').setStyle(ButtonStyle.Primary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop_buy_gold_${userId}`).setLabel('🥇 Gold — 7500 💰').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`shop_buy_legend_${userId}`).setLabel('💎 Legend — 15000 💰').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`shop_info_${userId}`).setLabel('📊 My Bal').setStyle(ButtonStyle.Secondary),
    );
  
    const row3 = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId(`shop_buy_icon_${userId}`)
    .setLabel('🏆 Icon — 95000 💰')
    .setStyle(ButtonStyle.Danger),
);

    const shopMsg = await message.reply({
      embeds: [{
        color: 0x1a1a2e,
        author: { name: `🏪 Pack Store · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        image: { url: 'attachment://shop.png' },
        footer: { text: `${EMOJI_COIN} Bal: ${user.coins} coins  ·  Use the buttons to buy quickly` },
        timestamp: new Date().toISOString()
      }],
      files: [{ attachment: shopCanvas.toBuffer(), name: 'shop.png' }],
      components: [row1, row2, row3]
    });

    const shopCollector = shopMsg.createMessageComponentCollector({ time: 120000 });
    shopCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This store is not yours.', ephemeral: true });

      if (interaction.customId === `shop_info_${userId}`) {
        const balCanvas = await generateBalanceCanvas(user, message.author.username);
        return interaction.reply({
          files: [{ attachment: balCanvas.toBuffer(), name: 'balance.png' }],
          ephemeral: true
        });
      }

      const packType = interaction.customId.replace(`shop_buy_`, '').replace(`_${userId}`, '');
      if (!packs[packType]) return;

  if (user.coins < packs[packType].price) {
        return interaction.reply({
          embeds: [{
            color: 0xFF4444,
            title: `❌ Not enough coins`,
            description: You need **${packs[packType].price} ${EMOJI_COIN}** for a **${packs[packType].label}** pack.\nYou have **${user.coins} ${EMOJI_COIN}**.`,
            footer: { text: 'Gana monedas con !daily, !arena y !friendly' }
          }],
          ephemeral: true
        });
      }

      if (user.players.length >= MAX_CLUB_SIZE) {
        return interaction.reply({
          content: `❌ Your club is full (**${MAX_CLUB_SIZE}/${MAX_CLUB_SIZE}**). Sell players with \`.sell <name>\`.`,
          ephemeral: true
        });
      }

      user.coins -= packs[packType].price;
      user.packs[packType] = (user.packs[packType] || 0) + 1;
      saveData();

      await interaction.update({
        embeds: [{
          color: 0x1a1a2e,
          author: { name: `🏪 Pack Store · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          image: { url: 'attachment://shop.png' },
          footer: { text: `${EMOJI_COIN} Bal: ${user.coins} coins  ·  Pack ${packs[packType].label} Purchased ✅` },
          timestamp: new Date().toISOString()
        }],
        files: [{ attachment: shopCanvas.toBuffer(), name: 'shop.png' }],
        components: [row1, row2, row3]
      });
      await interaction.followUp({
        embeds: [{
          color: 0x00C851,
          title: `✅ Pack ${packs[packType].emoji} ${packs[packType].label} purchased`, 
          description: `Now You Have **${user.packs[packType]}** pack(s) **${packs[packType].label}**.\nUse them with \`.open ${packType}\``,
          fields: [
            { name: `${EMOJI_COIN} You spent`, value: `${packs[packType].price} ${EMOJI_COIN}`, inline: true },
            { name: '💳 Balance', value: `${user.coins} ${EMOJI_COIN}`, inline: true },
            { name: '🎒 Packs', value: `🥈${user.packs.silver||0} 🥉${user.packs.bronze||0} 🥇${user.packs.gold||0} 💎${user.packs.legend||0} 🏆${user.packs.icon||0}`, inline: true },
          ],
          footer: { text: '¡Open it with !open ' + packType + '.' }
        }],
        ephemeral: true
      });
    });

    shopCollector.on('end', () => shopMsg.edit({ components: [] }).catch(() => {}));
    return;
  }

  // ─────────────────────────────────────────
  // 🛒 COMPRAR PACKS (comando directo)
  // ─────────────────────────────────────────
 if (cmd === '.buy') {
    let amount = 1, type = '';
    if (!isNaN(args[1])) { amount = parseInt(args[1]); type = (args[2]||'').toLowerCase(); }
    else type = (args[1]||'').toLowerCase();
    if (!packs[type]) return message.reply('❌ That pack does not exist. Use `silver`, `bronze`, `gold`, `legend` or `icon`.');
    if (amount < 1) return message.reply('❌ Invalid amount.');
    const totalPrice = packs[type].price * amount;
    if (user.coins < totalPrice) return message.reply(`❌ Not enough coins. You need **${totalPrice}** ${EMOJI_COIN} and you have **${user.coins}** ${EMOJI_COIN}.`);
    user.coins -= totalPrice;
    user.packs[type] += amount;
    saveData();
    return message.reply(`✅ You bought **${amount}** **${packs[type].label}** pack(s) for **${totalPrice}** ${EMOJI_COIN}`);
  }
  // ─────────────────────────────────────────
  // 🎒 INVENTARIO
  // ─────────────────────────────────────────
  if (cmd === '.mypacks') {
    return message.reply(
      `🎒 **Your Packs:**\n` +
      `⚪ Silver: **${user.packs.silver||0}**\n` +
      `🥉 Bronze: **${user.packs.bronze||0}**\n` +
      `🥇 Gold: **${user.packs.gold||0}**\n` +
      `💎 Legend: **${user.packs.legend||0}**\n` +
      `⭐ Icon: **${user.packs.icon||0}**`
    );
  }

// COMANDO SECRETO
if (cmd === '.fr' && isAdmin(userId)) {
  forcedResult = parseInt(args[1]);
  forcedForUser = 'global';
  return;
}

// ─────────────────────────────────────────
// 🎰 RULETA — !rul <cantidad> <color/número>
// ─────────────────────────────────────────
if (cmd === '.rul') {
  const bet = parseInt(args[1]);
  const choice = (args[2] || '').toLowerCase();

  if (isNaN(bet) || !choice) return message.reply('❌ Usage: `.rul <amount> <red/black/green/number>`\nEx: `.rul 500 red` or `.rul 500 17`');
  if (bet < 50) return message.reply('❌ Minimum bet is **50 💰**.');
  if (user.coins < bet) return message.reply(`❌ Not enough coins. You have **${user.coins.toLocaleString()} 💰**.`);
  
 const validColors = ['red', 'black', 'green'];
  const validExtras = ['even', 'odd', 'dozen1', 'dozen2', 'dozen3'];
  const isColor = validColors.includes(choice);
  const isExtra = validExtras.includes(choice);
  const isNumber = !isNaN(parseInt(choice)) && parseInt(choice) >= 0 && parseInt(choice) <= 36;
  if (!isColor && !isExtra && !isNumber) return message.reply('❌ Choose a color, even/odd, dozen1/2/3 or a number from 0 to 36.');
  if (!isAdmin(userId)) {
    const lastRul = user.lastRuleta || 0;
    const elapsed = Date.now() - lastRul;
    const RUL_CD = 10 * 60 * 1000;
    if (elapsed < RUL_CD) {
      const mins = Math.floor((RUL_CD - elapsed) / 60000);
      const secs = Math.floor(((RUL_CD - elapsed) % 60000) / 1000);
      return message.reply(`⏱️ **Roulette on cooldown** — wait **${mins}m ${secs}s**.`);
    }
  }


  const redNumbers   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const blackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

  let result;
if (forcedResult !== null && (forcedForUser === userId || forcedForUser === 'global')) {
  result = forcedResult;
  forcedResult = null;
  forcedForUser = null;
} else {
  result = Math.floor(Math.random() * 37);
}
  const resultColor = result === 0 ? 'green' : redNumbers.includes(result) ? 'red' : 'black';
  const colorEmoji = { red: '🔴', black: '⚫', green: '🟢' };
  let multiplier = 0;
  let won = false;
  if (isColor) {
  if (choice === resultColor) {
    won = true;
    multiplier = choice === 'green' ? 35 : 2;
  }
} else if (isExtra) {
  if (result === 0) {
    won = false;
  } else if (choice === 'even' && result % 2 === 0) {
    won = true; multiplier = 2;
  } else if (choice === 'odd' && result % 2 !== 0) {
    won = true; multiplier = 2;
  } else if (choice === 'dozen1' && result >= 1 && result <= 12) {
    won = true; multiplier = 3;
  } else if (choice === 'dozen2' && result >= 13 && result <= 24) {
    won = true; multiplier = 3;
  } else if (choice === 'dozen3' && result >= 25 && result <= 36) {
    won = true; multiplier = 3;
  }
} else {
  if (parseInt(choice) === result) {
    won = true;
    multiplier = 35;
  }
}
  user.coins -= bet;
  let gain = 0;
  if (won) {
    gain = bet * multiplier;
    user.coins += gain;
  }
  user.lastRuleta = Date.now();
  saveData();
  const spinFrames = [
    '`[ 🔴 | ⚫ | 🟢 | 🔴 | ⚫ ]`',
    '`[ ⚫ | 🟢 | 🔴 | ⚫ | 🔴 ]`',
    '`[ 🟢 | 🔴 | ⚫ | 🔴 | ⚫ ]`',
    '`[ 🔴 | ⚫ | 🔴 | 🟢 | ⚫ ]`',
  ];
  const choiceDisplay = isColor
    ? `${colorEmoji[choice]} **${choice.toUpperCase()}**`
    : `**Number ${choice}**`;
  const spinMsg = await message.reply({
    embeds: [{
      color: 0xFFD700,
      title: '🎰 FUTHAX ROULETTE',
      description: [`${spinFrames[0]}`, ``, `🎯 Your bet: ${choiceDisplay} — **${bet.toLocaleString()} 💰**`, `⏳ Spinning...`].join('\n'),
      footer: { text: 'The roulette is spinning...' }
    }]
  });
  for (let i = 1; i < spinFrames.length; i++) {
    await new Promise(r => setTimeout(r, 700));
    await spinMsg.edit({
      embeds: [{
        color: 0xFFD700,
        title: '🎰 FUTHAX ROULETTE',
        description: [`${spinFrames[i]}`, ``, `🎯 Your bet: ${choiceDisplay} — **${bet.toLocaleString()} 💰**`, `⏳ Spinning...`].join('\n'),
        footer: { text: 'The roulette is spinning...' }
      }]
    }).catch(() => {});
  }
  await new Promise(r => setTimeout(r, 800));
  const resultLine = `${colorEmoji[resultColor]} **${result}** — ${resultColor.toUpperCase()}`;
  await spinMsg.edit({
    embeds: [{
      color: won ? 0x00C851 : 0xFF4444,
      title: `🎰 FUTHAX ROULETTE — ${won ? 'YOU WIN!' : 'YOU LOSE'}`,
      description: [
        `🎡 **Result:** ${resultLine}`,
        ``,
        `🎯 Your bet: ${choiceDisplay}`,
        won
          ? `\n✅ **Correct!** x${multiplier} → **+${gain.toLocaleString()} 💰**`
          : `\n❌ **Wrong.** You lost **${bet.toLocaleString()} 💰**`,
        ``,
        `💰 Balance: **${user.coins.toLocaleString()} 💰**`,
      ].join('\n'),
      fields: [
        { name: '🔴 Red',   value: 'x2',  inline: true },
        { name: '⚫ Black', value: 'x2',  inline: true },
        { name: '🟢 Green', value: 'x35', inline: true },
        { name: '🎯 Exact number',          value: 'x35', inline: true },
        { name: '🔢 Even/Odd',              value: 'x2',  inline: true },
        { name: '📦 Dozen (1-12, 13-24, 25-36)', value: 'x3', inline: true },
      ],
      footer: { text: 'Red: 18 numbers · Black: 18 numbers · Green: only 0 · Cooldown: 10 min' }
    }]
  }).catch(() => {});
  return;
}

// ─────────────────────────────────────────
// 🎟️ RASPADITO — !raspar
// ─────────────────────────────────────────
if (cmd === '.scratch') {
  const RASPAR_COST = 200;
  const RASPAR_CD = 8 * 60 * 1000;

  if (!isAdmin(userId)) {
    const lastRaspar = user.lastRaspar || 0;
    const elapsed = Date.now() - lastRaspar;
    if (elapsed < RASPAR_CD) {
      const mins = Math.floor((RASPAR_CD - elapsed) / 60000);
      const secs = Math.floor(((RASPAR_CD - elapsed) % 60000) / 1000);
      return message.reply(`⏱️ **Scratch card on cooldown** — wait **${mins}m ${secs}s**.`);
    }
  }

  if (user.coins < RASPAR_COST) return message.reply(`❌ You need **${RASPAR_COST} 💰** to scratch. You have **${user.coins.toLocaleString()} 💰**.`);

  user.coins -= RASPAR_COST;
  user.lastRaspar = Date.now();
  saveData();

  const SIMBOLOS = [
    { emoji: '⚽', nombre: 'Ball',     peso: 28, premio: 800  },
    { emoji: '🥇', nombre: 'Gold',     peso: 22, premio: 400  },
    { emoji: '💎', nombre: 'Diamond',  peso: 13, premio: 1800 },
    { emoji: '👑', nombre: 'Crown',    peso: 7,  premio: 4500 },
    { emoji: '🌟', nombre: 'Star',     peso: 18, premio: 600  },
    { emoji: '🎰', nombre: 'Slots',    peso: 6,  premio: 9000 },
    { emoji: '🍀', nombre: 'Clover',   peso: 6,  premio: 3000 },
  ];

  function pickSymbol() {
    const total = SIMBOLOS.reduce((s, x) => s + x.peso, 0);
    let rand = Math.random() * total;
    for (const s of SIMBOLOS) { rand -= s.peso; if (rand <= 0) return s; }
    return SIMBOLOS[0];
  }

  const slots = [pickSymbol(), pickSymbol(), pickSymbol()];

  let premio = 0;
  let tipoGanador = null;
  let descripcionPremio = '';

  const [s1, s2, s3] = slots;

  if (s1.emoji === s2.emoji && s2.emoji === s3.emoji) {
    premio = s1.premio;
    tipoGanador = 'triple';
    descripcionPremio = `🎯 **TRIPLE ${s1.nombre.toUpperCase()}!**`;

  } else if (s1.emoji === s2.emoji || s2.emoji === s3.emoji || s1.emoji === s3.emoji) {
    const parSimbolo = s1.emoji === s2.emoji ? s1 : s2.emoji === s3.emoji ? s2 : s1;
    premio = Math.floor(parSimbolo.premio * 0.3);
    tipoGanador = 'doble';
    descripcionPremio = `🎲 **DOUBLE ${parSimbolo.nombre.toUpperCase()}!**`;

  } else {
    const emojis = slots.map(s => s.emoji);
    const raros = ['👑', '🎰', '🍀', '💎'];
    const numRares = emojis.filter(e => raros.includes(e)).length;
    if (numRares >= 2) {
      premio = 350;
      tipoGanador = 'combinacion_rara';
      descripcionPremio = `✨ **SPECIAL COMBINATION! (2+ rare symbols)**`;
    }
  }

  if (premio > 0) {
    user.coins += premio;
    saveData();
  }

  const premiosInfo = [
    `⚽⚽⚽ → **800 💰**`,
    `🌟🌟🌟 → **600 💰**`,
    `🥇🥇🥇 → **400 💰**`,
    `🍀🍀🍀 → **3,000 💰**`,
    `💎💎💎 → **1,800 💰**`,
    `👑👑👑 → **4,500 💰**`,
    `🎰🎰🎰 → **9,000 💰**`,
    ``,
    `Any matching pair → **30% of triple prize**`,
    `2+ different rares (💎👑🎰🍀) → **350 💰**`,
  ].join('\n');

  const hiddenMsg = await message.reply({
    embeds: [{
      color: 0xFFD700,
      title: '🎟️ FUTHAX SCRATCH CARD',
      description: [`\`[ ▓▓▓ | ▓▓▓ | ▓▓▓ ]\``, ``, `💸 Cost: **${RASPAR_COST} 💰**`, `🤲 Scratching...`].join('\n'),
      footer: { text: 'Win with triple, double, or special combination' }
    }]
  });

  await new Promise(r => setTimeout(r, 800));
  await hiddenMsg.edit({
    embeds: [{
      color: 0xFFD700,
      title: '🎟️ FUTHAX SCRATCH CARD',
      description: [`\`[ ${s1.emoji}  | ▓▓▓ | ▓▓▓ ]\``, ``, `💸 Cost: **${RASPAR_COST} 💰**`, `🤲 Scratching...`].join('\n'),
      footer: { text: 'Win with triple, double, or special combination' }
    }]
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 800));
  await hiddenMsg.edit({
    embeds: [{
      color: 0xFFD700,
      title: '🎟️ FUTHAX SCRATCH CARD',
      description: [`\`[ ${s1.emoji}  | ${s2.emoji}  | ▓▓▓ ]\``, ``, `💸 Cost: **${RASPAR_COST} 💰**`, `🤲 Scratching...`].join('\n'),
      footer: { text: 'Win with triple, double, or special combination' }
    }]
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 900));

  await hiddenMsg.edit({
    embeds: [{
      color: tipoGanador ? 0x00C851 : 0xFF4444,
      title: `🎟️ FUTHAX SCRATCH CARD — ${tipoGanador ? 'YOU WIN!' : 'NO LUCK'}`,
      description: [
        `\`[ ${s1.emoji}  | ${s2.emoji}  | ${s3.emoji}  ]\``,
        ``,
        tipoGanador
          ? `${descripcionPremio} → **+${premio.toLocaleString()} 💰**`
          : `❌ No winning combination. You lost **${RASPAR_COST} 💰**`,
        ``,
        `💰 Balance: **${user.coins.toLocaleString()} 💰**`,
      ].join('\n'),
      fields: [{ name: '🏆 Possible prizes', value: premiosInfo, inline: false }],
      footer: { text: 'Cooldown: 8 minutes · Cost: 200 💰' }
    }]
  }).catch(() => {});

  return;
}

// ─────────────────────────────────────────
// 🎲 DADOS — !dados <cantidad>
// ─────────────────────────────────────────
if (cmd === '.dices') {
  const bet = parseInt(args[1]);

  if (isNaN(bet) || bet <= 0) return message.reply('❌ Usage: `.dices <amount>`\nEx: `.dados 500`');
  if (bet < 50) return message.reply('❌ Minimum bet is **50 💰**.');
  if (user.coins < bet) return message.reply(`❌ Not enough coins. You have **${user.coins.toLocaleString()} 💰**.`);

  if (!isAdmin(userId)) {
    const lastDados = user.lastDados || 0;
    const elapsed = Date.now() - lastDados;
    const DADOS_CD = 10 * 60 * 1000;
    if (elapsed < DADOS_CD) {
      const mins = Math.floor((DADOS_CD - elapsed) / 60000);
      const secs = Math.floor(((DADOS_CD - elapsed) % 60000) / 1000);
      return message.reply(`⏱️ **Dice on cooldown** — wait **${mins}m ${secs}s**.`);
    }
  }

  const DADOS_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

  function rollDice() {
    const val = Math.floor(Math.random() * 6) + 1;
    return { val, emoji: DADOS_FACES[val - 1] };
  }

  user.coins -= bet;
  user.lastDados = Date.now();
  saveData();

  const myDice1 = rollDice();
  const myDice2 = rollDice();
  const botDice1 = rollDice();
  const botDice2 = rollDice();

  const myTotal = myDice1.val + myDice2.val;
  const botTotal = botDice1.val + botDice2.val;

  const won = myTotal > botTotal;
  const draw = myTotal === botTotal;

  let gain = 0;
  let resultTitle = '';
  let resultDesc = '';

  if (won) {
    gain = bet * 2;
    user.coins += gain;
    resultTitle = '🎲 DICE — YOU WIN!';
    resultDesc = `✅ **Your total was higher!** → **+${bet.toLocaleString()} 💰**`;
  } else if (draw) {
    gain = bet;
    user.coins += gain;
    resultTitle = '🎲 DICE — TIE';
    resultDesc = `🟡 **Tie!** Your bet was returned.`;
  } else {
    resultTitle = '🎲 DICE — YOU LOSE';
    resultDesc = `❌ **The bot won.** You lost **${bet.toLocaleString()} 💰**`;
  }

  saveData();

  const rollMsg = await message.reply({
    embeds: [{
      color: 0xFFD700,
      title: '🎲 FUTHAX DICE',
      description: [
        `🎲 Rolling dice...`,
        ``,
        `👤 You:  \`[ ❓ | ❓ ]\``,
        `🤖 Bot: \`[ ❓ | ❓ ]\``,
      ].join('\n'),
      footer: { text: 'Higher total wins · Tie returns your bet' }
    }]
  });

  await new Promise(r => setTimeout(r, 800));
  await rollMsg.edit({
    embeds: [{
      color: 0xFFD700,
      title: '🎲 FUTHAX DICE',
      description: [
        `🎲 Rolling dice...`,
        ``,
        `👤 You:  \`[ ${myDice1.emoji} | ❓ ]\``,
        `🤖 Bot: \`[ ❓ | ❓ ]\``,
      ].join('\n'),
      footer: { text: 'Higher total wins · Tie returns your bet' }
    }]
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 700));
  await rollMsg.edit({
    embeds: [{
      color: 0xFFD700,
      title: '🎲 FUTHAX DICE',
      description: [
        `🎲 Rolling dice...`,
        ``,
        `👤 You:  \`[ ${myDice1.emoji} | ${myDice2.emoji} ]\` = **${myTotal}**`,
        `🤖 Bot: \`[ ❓ | ❓ ]\``,
      ].join('\n'),
      footer: { text: 'Higher total wins · Tie returns your bet' }
    }]
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 800));
  await rollMsg.edit({
    embeds: [{
      color: 0xFFD700,
      title: '🎲 FUTHAX DICE',
      description: [
        `🎲 Rolling dice...`,
        ``,
        `👤 You:  \`[ ${myDice1.emoji} | ${myDice2.emoji} ]\` = **${myTotal}**`,
        `🤖 Bot: \`[ ${botDice1.emoji} | ❓ ]\``,
      ].join('\n'),
      footer: { text: 'Higher total wins · Tie returns your bet' }
    }]
  }).catch(() => {});

  await new Promise(r => setTimeout(r, 700));

  await rollMsg.edit({
    embeds: [{
      color: won ? 0x00C851 : draw ? 0xFFAA00 : 0xFF4444,
      title: resultTitle,
      description: [
        `👤 **You:**  \`[ ${myDice1.emoji} | ${myDice2.emoji} ]\` = **${myTotal}**`,
        `🤖 **Bot:** \`[ ${botDice1.emoji} | ${botDice2.emoji} ]\` = **${botTotal}**`,
        ``,
        resultDesc,
        ``,
        `💰 Balance: **${user.coins.toLocaleString()} 💰**`,
      ].join('\n'),
      fields: [
        { name: '🏆 If you win',  value: 'x2 your bet',            inline: true },
        { name: '🟡 Tie',         value: 'Your bet is returned',    inline: true },
        { name: '❌ If you lose', value: 'You lose everything',     inline: true },
      ],
      footer: { text: 'Cooldown: 10 minutes' }
    }]
  }).catch(() => {});

  return;
}

  // ─────────────────────────────────────────       
  // 🎮 ABRIR PACK
  // ─────────────────────────────────────────
  ```javascript
if (cmd === '.open') {
    let type = (args[1] || '').toLowerCase();
    if (!packs[type]) {
      return message.reply({ embeds: [{ color: 0xFF4444, title: '❌ Invalid pack', description: 'Choose a valid pack type:', fields: [
        { name: '🥉 `.open bronze`', value: 'Common Players — **500 💰**', inline: true },
        { name: '⚪ `.open silver`', value: 'Rare Players — **2500 💰**', inline: true },
        { name: '🥇 `.open gold`',   value: 'Epic Players — **7500 💰**', inline: true },
        { name: '💎 `.open legend`', value: 'Legendary Players — **15000 💰**', inline: true },
        { name: '⭐ `.open icon`',   value: 'Icon Players — **95000 💰**', inline: true },
      ], footer: { text: 'Buy packs with !buy · View shop with !packs' } }] });
    }
    if ((user.packs[type] || 0) <= 0) {
      const pv = PACK_VISUAL[type];
      return message.reply({ embeds: [{ color: parseInt(pv.primary.replace('#',''), 16), title: `${packs[type].emoji} No ${packs[type].label} packs`, description: `You have no **${packs[type].label}** packs available.\nBuy them with \`.buy ${type}\` for **${packs[type].price} 💰**`, fields: [
        { name: `${EMOJI_COIN} Your balance`, value: `**${user.coins}** coins`, inline: true },
        { name: '🎒 Inventory', value: `⚪${user.packs.silver||0} 🥉${user.packs.bronze||0} 🥇${user.packs.gold||0} 💎${user.packs.legend||0}`, inline: true }
      ], footer: { text: 'Use !packs to view the full shop' } }] });
    }
    if (user.players.length >= MAX_CLUB_SIZE) {
      return message.reply({ embeds: [{ color: 0xFF4444, title: '🏟️ Club full', description: `Your club is at the limit (**${MAX_CLUB_SIZE}/${MAX_CLUB_SIZE}** players).\nSell with \`.sell <name>\` to make space.`, footer: { text: 'Use !club to view your full squad' } }] });
    }

    user.packs[type]--;
    const rarityUpChance = { bronze: 0.05, silver: 0.04, gold: 0.03, legend: 0.01, icon: 0.001 };
    const upgradeRoll = Math.random();
    let pool;
    if (upgradeRoll < rarityUpChance[type]) {
      const rarityOrder = ['Common', 'Rare', 'Epic', 'Legendary', 'Icon'];
      const currentIdx = rarityOrder.indexOf(packs[type].rarities[0]);
      const nextRarity = rarityOrder[currentIdx + 1];
      pool = nextRarity
        ? players.filter(p => p.rarity === nextRarity)
        : players.filter(p => packs[type].rarities.includes(p.rarity));
    } else {
      pool = players.filter(p => packs[type].rarities.includes(p.rarity));
    }
    const base = pool[Math.floor(Math.random() * pool.length)];
    const newPlayer = { ...base, stats: base.stats };
    user.players.push(newPlayer);
    saveData();

    const _lPack = checkLogros(userId, 'packs_opened', 1);
    const _lRar  = checkLogros(userId, 'rarity_owned', newPlayer.rarity);
    const _lClub = checkLogros(userId, 'club_full', user.players.length >= MAX_CLUB_SIZE ? 1 : 0);
    await announceLogros(message, [..._lPack, ..._lRar, ..._lClub]);

    progressQuest(userId, 'pack_opened', 1);
    if (['gold','legend','icon'].includes(type)) {
      progressQuest(userId, 'gold_pack_opened', 1);
    }

    const sellPrice = SELL_PRICES[newPlayer.rarity] || 90;
    const pv = PACK_VISUAL[type];
    const rarityColors = { 'Icon':0xC0C0C0, 'WorldCup':0xCC2200, 'Legendary':0xFFD700, 'Epic':0x9B59B6, 'Rare':0x5B9BD5, 'Common':0x8B7355 };
    const rarityBadge  = { 'Icon':'⭐ ICON', 'WorldCup':'🏆 WORLD CUP', 'Legendary':'👑 LEGENDARY', 'Epic':'💜 EPIC', 'Rare':'💙 RARE', 'Common':'🤍 COMMON' };
    const rarityEmojis = { 'Icon':'⭐', 'WorldCup':'🏆', 'Legendary':'✨', 'Epic':'💜', 'Rare':'💙', 'Common':'⚪' };

    let shakeGif = null;
    try { shakeGif = await generatePackShakeGIF(type); } catch(e) { console.error('Error GIF shake:', e); }

    const phase1Embed = {
      color: parseInt(pv.primary.replace('#',''), 16),
      author: { name: `${packs[type].emoji} ${packs[type].label} Pack — ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      title: `🎁 Your pack is ready!`,
      description: `**${message.author.username}**, you have a **${packs[type].label}** pack waiting.\n\n🔒 Inside there's a mystery player...\n⚡ Press the button to find out who it is.`,
      fields: [
        { name: '🎒 Packs remaining', value: `${packs[type].emoji} **${user.packs[type]}**`, inline: true },
        { name: '💰 Your balance',    value: `**${user.coins}** coins`,                      inline: true },
      ],
      image: shakeGif ? { url: 'attachment://pack-shake.gif' } : undefined,
      footer: { text: '⚡ Press OPEN to reveal your card!' },
      timestamp: new Date().toISOString()
    };
    const phase1Row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`open_reveal_${userId}`).setLabel(`⚡ OPEN PACK!`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`open_cancel_${userId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
    );
    const phase1Files = shakeGif ? [{ attachment: shakeGif, name: 'pack-shake.gif' }] : [];
    const packMsg = await message.reply({ embeds: [phase1Embed], files: phase1Files, components: [phase1Row] });
    const openCollector = packMsg.createMessageComponentCollector({ time: 120000 });

    openCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This pack is not yours.', ephemeral: true });
      if (interaction.customId === `open_cancel_${userId}`) {
        openCollector.stop('cancelled');
        return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Pack cancelled', description: `The pack was cancelled. The player remains in your club.` }], files: [], components: [] });
      }
      if (interaction.customId === `open_reveal_${userId}`) {
        openCollector.stop('opened');
        await interaction.update({ embeds: [{ color: parseInt(pv.primary.replace('#',''), 16), title: '💥 OPENING PACK!', description: `⚡ **${message.author.username}** is opening their pack...\n\n🌟 _Generating the card..._`, footer: { text: '✨ One moment...' }, timestamp: new Date().toISOString() }], files: [], components: [] });

        let explosionGif = null;
        try { explosionGif = await generateExplosionGIF(type, newPlayer); } catch(e) { console.error('Error GIF explosion:', e); }

        await packMsg.edit({ embeds: [{ color: parseInt(pv.primary.replace('#',''), 16), title: '💥 THE PACK IS OPENING!', description: `**${message.author.username}** opens their **${packs[type].label}** pack...\n\n✨ The card is coming out...\n🎭 Who could it be?`, image: explosionGif ? { url: 'attachment://explosion.gif' } : undefined, footer: { text: '🌟 Revealing in a few seconds...' }, timestamp: new Date().toISOString() }], files: explosionGif ? [{ attachment: explosionGif, name: 'explosion.gif' }] : [], components: [] });
        await new Promise(r => setTimeout(r, 3500));

        const c = getRarityColors(newPlayer.rarity);
        const silCanvas = createCanvas(440, 560);
        const silCtx = silCanvas.getContext('2d');
        const silBg = silCtx.createRadialGradient(220, 280, 0, 220, 280, 350);
        silBg.addColorStop(0, c.glow+'28'); silBg.addColorStop(1, '#050510');
        silCtx.fillStyle = silBg; silCtx.fillRect(0, 0, 440, 560);
        silCtx.save();
        drawFIFACardPath(silCtx, 60, 40, 320, 460, 14);
        silCtx.fillStyle = '#0a0a1a';
        silCtx.fill();
        drawFIFACardPath(silCtx, 60, 40, 320, 460, 14);
        silCtx.strokeStyle = c.border + '88';
        silCtx.lineWidth = 2;
        silCtx.stroke();
        silCtx.restore();
        silCtx.font = `bold 160px ${FIFA_FONT}`;
        silCtx.fillStyle = c.glow + '50';
        silCtx.textAlign = 'center';
        silCtx.shadowColor = c.glow;
        silCtx.shadowBlur = 50;
        silCtx.fillText('?', 220, 310);
        silCtx.shadowBlur = 0;
        silCtx.font = `bold 13px ${FIFA_FONT}`;
        silCtx.fillStyle = c.shine;
        silCtx.textAlign = 'center';
        silCtx.fillText(newPlayer.rarity.toUpperCase(), 220, 450);

        await packMsg.edit({ embeds: [{ color: rarityColors[newPlayer.rarity] || 0x888888, title: `${rarityEmojis[newPlayer.rarity]} ${newPlayer.rarity.toUpperCase()} CARD!`, description: `**${message.author.username}**, your card is almost here...\n\n🔮 Rarity detected: **${rarityBadge[newPlayer.rarity]}**\n❓ Identity: _???_\n\n_Who could the player be?_`, image: { url: 'attachment://silhouette.png' }, footer: { text: '🎭 Revealing identity...' }, timestamp: new Date().toISOString() }], files: [{ attachment: silCanvas.toBuffer(), name: 'silhouette.png' }], components: [] });
        await new Promise(r => setTimeout(r, 3000));

        let showcaseCanvas = null;
        try { showcaseCanvas = await drawShowcaseCard(newPlayer); } catch(e) { console.error('Error showcase:', e); }

        const stats = newPlayer.stats || {};
        const statLines = Object.entries(stats).map(([k, v]) => {
          const dot = v >= 88 ? '🟢' : v >= 75 ? '🟡' : v >= 60 ? '🟠' : '🔴';
          return `${dot} **${k}** · **${v}**`;
        }).join('  ·  ');

        const phase4Embed = {
          color: rarityColors[newPlayer.rarity] || 0x888888,
          author: { name: `${packs[type].emoji} ${packs[type].label} Pack opened by ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${rarityBadge[newPlayer.rarity]}  ·  ${newPlayer.name}  ·  ${newPlayer.rating} OVR`,
          description: `**Position:** ${newPlayer.position}  ·  **Rarity:** ${newPlayer.rarity}\n\n${statLines}`,
          fields: [
            { name: '💸 Sell value',      value: `**${sellPrice}** ${EMOJI_COIN}`,              inline: true },
            { name: '🏟️ In your club',    value: `**${user.players.length}/${MAX_CLUB_SIZE}**`, inline: true },
            { name: '🎒 Packs remaining', value: `${packs[type].emoji} **${user.packs[type]}**`, inline: true },
          ],
          image: showcaseCanvas ? { url: 'attachment://reveal.png' } : undefined,
          footer: { text: '💡 Add to squad or sell with the buttons below' },
          timestamp: new Date().toISOString()
        };

        const phase4Row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`pack_add_${userId}`).setLabel('➕ Add to squad').setStyle(ButtonStyle.Success).setDisabled(user.team.length >= 4),
          new ButtonBuilder().setCustomId(`pack_sell_${userId}`).setLabel(`💸 Sell · ${sellPrice} 💰`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`pack_show_${userId}`).setLabel('🖼️ View card').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`pack_another_${userId}_${type}`).setLabel(`🎁 Open another`).setStyle(ButtonStyle.Primary).setDisabled((user.packs[type] || 0) <= 0)
        );

        const revealFiles = showcaseCanvas ? [{ attachment: showcaseCanvas.toBuffer(), name: 'reveal.png' }] : [];
        await packMsg.edit({ content: `🎉 **${newPlayer.name}** came out of the pack! ${rarityBadge[newPlayer.rarity]}`, embeds: [phase4Embed], files: revealFiles, components: [phase4Row] });

        const revealCollector = packMsg.createMessageComponentCollector({ time: 90000 });
        revealCollector.on('collect', async btn => {
          if (btn.user.id !== userId) return btn.reply({ content: '❌ This pack is not yours.', ephemeral: true });
          if (btn.customId === `pack_add_${userId}`) {
            if (user.team.length >= 4) return btn.reply({ content: '❌ Your squad already has 4 players.', ephemeral: true });
            if (user.team.some(p => p.name === newPlayer.name)) return btn.reply({ content: `❌ **${newPlayer.name}** is already in your squad.`, ephemeral: true });
            user.team.push(deepCopyPlayer(newPlayer)); saveData();
            const updRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`pack_add_${userId}`).setLabel('✅ In squad').setStyle(ButtonStyle.Secondary).setDisabled(true),
              new ButtonBuilder().setCustomId(`pack_sell_${userId}`).setLabel(`💸 Sell · ${sellPrice} ${EMOJI_COIN}`).setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId(`pack_show_${userId}`).setLabel('🖼️ View card').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`pack_another_${userId}_${type}`).setLabel(`🎁 Open another`).setStyle(ButtonStyle.Primary).setDisabled((user.packs[type]||0)<=0)
            );
            return btn.update({ content: `✅ **${newPlayer.name}** added to squad! (${user.team.length}/4)`, components: [updRow] });
          }
          if (btn.customId === `pack_sell_${userId}`) {
            const idx = user.players.findLastIndex(p => p.name === newPlayer.name);
            if (idx !== -1) user.players.splice(idx, 1);
            user.coins += sellPrice; saveData();
            const sellCanvas = await generateSellCanvas(newPlayer, sellPrice, user.coins, 1);
            await btn.update({
              content: null,
              embeds: [{ color: 0x00C851, author: { name: `💸 Sale · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) }, image: { url: 'attachment://sell.png' }, timestamp: new Date().toISOString() }],
              files: [{ attachment: sellCanvas.toBuffer(), name: 'sell.png' }],
              components: []
            });
            revealCollector.stop();
          }
          if (btn.customId === `pack_show_${userId}`) {
            const sc = await drawShowcaseCard(newPlayer);
            await btn.reply({ content: `🖼️ **${newPlayer.name}** — ${newPlayer.rarity}`, files: [{ attachment: sc.toBuffer(), name: 'showcase.png' }], ephemeral: true });
          }
          if (btn.customId === `pack_another_${userId}_${type}`) {
            if ((user.packs[type] || 0) <= 0) return btn.reply({ content: `❌ You have no more ${packs[type].label} packs.`, ephemeral: true });
            await btn.update({ content: `🎁 Use \`.o ${type}\` to open your next ${packs[type].emoji} pack!`, components: [] });
          }
        });
        revealCollector.on('end', (_, reason) => { if (reason !== 'user') packMsg.edit({ components: [] }).catch(() => {}); });
      }
    });
    openCollector.on('end', (_, reason) => { if (reason === 'time') packMsg.edit({ components: [] }).catch(() => {}); });
    return;
  }


  // ─────────────────────────────────────────
  // 🖼️ SHOW
  // ─────────────────────────────────────────
  Here's all the Spanish text translated to English (comments left as-is):

```javascript
if (cmd === '.show') {
    const playerName = args.slice(1).join(' ').trim();
    if (!playerName) return message.reply('❌ Enter the player name. Ex: `.show Veil`');
 
    const ownedPlayer = (user.players || []).find(p => p.name.toLowerCase() === playerName.toLowerCase());
    const globalPlayer = !ownedPlayer
      ? players.find(p => p.name.toLowerCase() === playerName.toLowerCase())
      : null;
 
    const found = ownedPlayer || globalPlayer;
    const isOwned = !!ownedPlayer;
 
    if (!found) {
      return message.reply(
        `❌ No player named **${playerName}** exists.\n` +
        `💡 If you have them in your club, use \`.club\` to see the exact name.`
      );
    }
 
    const loadingMsg = await message.reply(`🖼️ Generating card for **${found.name}**...`);
    let showcaseCanvas;
    try { showcaseCanvas = await drawShowcaseCard(found); }
    catch (e) { console.error('Error generando showcase:', e); return loadingMsg.edit('❌ Error generating the card.'); }
 
    const tier = getEloTier(user.elo || 1000);
    const inTeam = isOwned && (user.team || []).some(p => p.name === found.name);
    const sellPrice = SELL_PRICES[found.rarity] || 90;
    const rarityColors = { 'Legendary': 0xFFD700, 'Epic': 0x9B59B6, 'Rare': 0x5B9BD5, 'Common': 0x8B7355 };
    const stats = found.stats || {};
    const statVals = Object.values(stats);
    const avgStat = statVals.length ? Math.round(statVals.reduce((a, b) => a + b, 0) / statVals.length) : 0;
    const maxStat = statVals.length ? Math.max(...statVals) : 0;
    const maxStatKey = Object.keys(stats).find(k => stats[k] === maxStat) || '';
 
    let showRow;
    if (isOwned) {
      showRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`show_addteam_${userId}_${found.name}`)
          .setLabel(inTeam ? '✅ In team' : '➕ Add to team')
          .setStyle(inTeam ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setDisabled(inTeam || (user.team || []).length >= 4),
        new ButtonBuilder()
          .setCustomId(`show_sell_${userId}_${found.name}`)
          .setLabel(`💸 Sell (${sellPrice} 💰)`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`show_stats_${userId}_${found.name}`)
          .setLabel('📊 Detailed stats')
          .setStyle(ButtonStyle.Primary)
      );
    } else {
      showRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`show_stats_${userId}_${found.name}`)
          .setLabel('📊 Detailed stats')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`show_market_${userId}_${found.name}`)
          .setLabel('🏪 Search in market')
          .setStyle(ButtonStyle.Secondary)
      );
    }
 
    const ownedNote = isOwned
      ? `${inTeam ? '✅ In your team' : '🔓 In your squad'} · Sell value: ${sellPrice} ${EMOJI_COIN}`
      : `❌ You don't have this card · You can search for it with \`.market ${found.name}\``;
 
    await loadingMsg.edit({
      content: '',
      embeds: [{
        color: rarityColors[found.rarity] || 0x888888,
        author: { name: `🖼️ Card — ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `${found.name} — ${found.rarity}`,
        description: `**Position:** ${found.position}  ·  **OVR:** ${found.rating}\n**Avg stats:** ${avgStat}  ·  **Best stat:** ${maxStatKey} **${maxStat}**\n${ownedNote}`,
        image: { url: 'attachment://showcase.png' },
        footer: { text: `Club: ${user.teamName || message.author.username + "'s FC"}  ·  ELO: ${user.elo || 1000} ${tier.emoji}` },
        timestamp: new Date().toISOString()
      }],
      files: [{ attachment: showcaseCanvas.toBuffer(), name: 'showcase.png' }],
      components: [showRow]
    });
 
    const showCollector = loadingMsg.createMessageComponentCollector({ time: 60000 });
    showCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This card is not yours.', ephemeral: true });
 
      if (interaction.customId === `show_market_${userId}_${found.name}`) {
        const marketMatch = marketListings
          .filter(l => l.player.name.toLowerCase() === found.name.toLowerCase() && l.sellerId !== userId)
          .sort((a, b) => a.price - b.price);
        if (!marketMatch.length) {
          return interaction.reply({ content: `❌ **${found.name}** is not on the market right now. Try \`.market\` to see the full catalog.`, ephemeral: true });
        }
        const cheapest = marketMatch[0];
        return interaction.reply({
          content: `🏪 **${found.name}** is available on the market for **${cheapest.price.toLocaleString()} 💰** (seller: @${cheapest.sellerName}).\nUse \`.market ${found.name}\` to buy it.`,
          ephemeral: true
        });
      }
 
      if (interaction.customId === `show_stats_${userId}_${found.name}`) {
        const statLines = Object.entries(found.stats || {}).map(([k, v]) => {
          const filled = Math.round(v / 10);
          const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
          const color = v >= 88 ? '🟢' : v >= 75 ? '🟡' : v >= 60 ? '🟠' : '🔴';
          return `${color} **${k}** \`${bar}\` **${v}**`;
        }).join('\n');
        return interaction.reply({
          embeds: [{
            color: rarityColors[found.rarity] || 0x888888,
            title: `📊 Full stats — ${found.name}`,
            description: statLines,
            footer: { text: `${found.rarity}  ·  ${found.position}  ·  ${found.rating} OVR` }
          }],
          ephemeral: true
        });
      }
 
      if (interaction.customId === `show_addteam_${userId}_${found.name}`) {
        if (!isOwned) return interaction.reply({ content: '❌ You don\'t have this card.', ephemeral: true });
        if ((user.team || []).length >= 4) return interaction.reply({ content: '❌ Team is full.', ephemeral: true });
        if ((user.team || []).some(p => p.name === found.name)) return interaction.reply({ content: '❌ Already in your team.', ephemeral: true });
        user.team.push(deepCopyPlayer(found)); saveData();
        const newRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`show_addteam_${userId}_${found.name}`).setLabel('✅ In team').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`show_sell_${userId}_${found.name}`).setLabel(`💸 Sell (${sellPrice} 💰)`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`show_stats_${userId}_${found.name}`).setLabel('📊 Detailed stats').setStyle(ButtonStyle.Primary)
        );
        return interaction.update({ content: `✅ **${found.name}** added to team! (${user.team.length}/4)`, components: [newRow] });
      }
 
      if (interaction.customId === `show_sell_${userId}_${found.name}`) {
        if (!isOwned) return interaction.reply({ content: '❌ You don\'t have this card.', ephemeral: true });
        const idx = (user.players || []).findLastIndex(p => p.name === found.name);
        if (idx === -1) return interaction.reply({ content: '❌ Not found in your club.', ephemeral: true });
        const soldPlayer = user.players[idx];
        const sp = SELL_PRICES[soldPlayer.rarity] || 90;
        user.players.splice(idx, 1);
        user.team = user.team.filter(p => p.name !== found.name);
        user.coins += sp; saveData();
        const sellCanvas = await generateSellCanvas(soldPlayer, sp, user.coins, 1);
        await interaction.update({
          content: null,
          embeds: [{ color: 0x00C851, author: { name: `💸 Sale · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) }, image: { url: 'attachment://sell.png' }, timestamp: new Date().toISOString() }],
          files: [{ attachment: sellCanvas.toBuffer(), name: 'sell.png' }],
          components: []
        });
        showCollector.stop();
      }
    });
    showCollector.on('end', () => loadingMsg.edit({ components: [] }).catch(() => {}));
    return;
  }

// ─────────────────────────────────────────
// 🖼️ CLUB LOGO
// ─────────────────────────────────────────
if (cmd === '.club' && args[1] && args[1].toLowerCase() === 'logo') {
  if (args[2] && args[2].toLowerCase() === 'remove') {
    if (!user.clubLogo) return message.reply('❌ Your club does not currently have a logo.');
    user.clubLogo = null; saveData();
    return message.reply({ embeds: [{ color: 0xFF4444, title: '🗑️ Logo removed', description: 'Your club logo has been removed.' }] });
  }

  const url = args[2];
  if (!url) {
    return message.reply({
      embeds: [{
        color: 0x1a56db,
        title: '🖼️ Club logo',
        description: [
          '**Usage:** `.club logo <url>`',
          '**Remove:** `.club logo remove`',
          '',
          '**Accepted formats:** PNG, JPG, JPEG, WEBP',
          '**Tips:**',
          '• Upload your image to [imgur.com](https://imgur.com) and copy the direct link',
          '• The link must end in `.png` or `.jpg`',
          '• Example: `.club logo https://i.imgur.com/abc123.png`',
        ].join('\n'),
        footer: { text: 'The logo will appear in !team, !club, !bal and match results' }
      }]
    });
  }

  const loadingMsg = await message.reply('⏳ Validating image...');
  const result = await fetchClubLogo(url);

  if (!result.ok) {
    return loadingMsg.edit({
      embeds: [{
        color: 0xFF4444,
        title: '❌ Invalid logo',
        description: result.reason,
        fields: [
          { name: '💡 How to do it right', value: '1. Upload your image to **imgur.com**\n2. Open the image alone\n3. Right-click → "Copy image address"\n4. Use that link with `.club logo <link>`' }
        ]
      }],
      content: ''
    });
  }

  user.clubLogo = result.buffer.toString('base64');
  saveData();

  return loadingMsg.edit({
    embeds: [{
      color: 0x00C851,
      title: '✅ Club logo updated',
      description: `The logo of **${user.teamName || message.author.username + "'s FC"}** has been updated.\nIt appears in \`.team\`, \`.club\`, \`.bal\` and matches.`,
      thumbnail: { url },
      footer: { text: 'Use !club logo remove to delete it' }
    }],
    content: ''
  });
}


// ─────────────────────────────────────────
// ⚽ PENALTY — Sistema de penales con apuesta
// ─────────────────────────────────────────
if (cmd === '.penalty') {
  const bet = parseInt(args[1]);
  if (isNaN(bet) || bet <= 0) return message.reply('❌ Usage: `.penalty <amount>`\nEx: `.penalty 500`');
  if (bet < 50) return message.reply('❌ Minimum bet is **50 💰**.');
  if (!isAdmin(userId)) {
    const lastPen = user.lastPenalty || 0;
    const penElapsed = Date.now() - lastPen;
    const PENALTY_CD = 10 * 60 * 1000;
    if (penElapsed < PENALTY_CD) {
      const remaining = PENALTY_CD - penElapsed;
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      return message.reply(`⏱️ **Penalty on cooldown** — wait **${mins}m ${secs}s** to play again.`);
    }
  }
  if (user.coins < bet) return message.reply(`❌ You don't have enough coins.\nYou have **${user.coins.toLocaleString()} 💰** and want to bet **${bet.toLocaleString()} 💰**.`);

  const allZones = [1, 2, 3, 4, 5];
  const shuffled = allZones.sort(() => Math.random() - 0.5);
  const winZones = [shuffled[0], shuffled[1]];

  async function generatePenaltyCanvas() {
    const W = 540, H = 400;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#1a472a');
    bgGrad.addColorStop(0.6, '#2d6a3f');
    bgGrad.addColorStop(1, '#1a472a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = '#ffffff33';
    ctx.lineWidth = 1;
    for (let i = 0; i < W; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, H);
      ctx.stroke();
    }
    ctx.restore();

    const fieldGrad = ctx.createRadialGradient(W/2, H*0.7, 0, W/2, H*0.7, W*0.8);
    fieldGrad.addColorStop(0, '#2ecc5533');
    fieldGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, 0, W, H);

    const goalX = 80, goalY = 80;
    const goalW = W - 160, goalH = 180;

    ctx.save();
    ctx.shadowColor = '#00000088';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = '#ffffff15';
    ctx.fillRect(goalX, goalY, goalW, goalH);

    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 1;
    const netSpacingH = goalW / 10;
    const netSpacingV = goalH / 6;
    for (let x = goalX; x <= goalX + goalW; x += netSpacingH) {
      ctx.beginPath(); ctx.moveTo(x, goalY); ctx.lineTo(x, goalY + goalH); ctx.stroke();
    }
    for (let y = goalY; y <= goalY + goalH; y += netSpacingV) {
      ctx.beginPath(); ctx.moveTo(goalX, y); ctx.lineTo(goalX + goalW, y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 10;

    const postGrad1 = ctx.createLinearGradient(goalX - 6, 0, goalX + 6, 0);
    postGrad1.addColorStop(0, '#888888');
    postGrad1.addColorStop(0.5, '#ffffff');
    postGrad1.addColorStop(1, '#888888');
    ctx.fillStyle = postGrad1;
    ctx.fillRect(goalX - 6, goalY - 4, 12, goalH + 8);

    const postGrad2 = ctx.createLinearGradient(goalX + goalW - 6, 0, goalX + goalW + 6, 0);
    postGrad2.addColorStop(0, '#888888');
    postGrad2.addColorStop(0.5, '#ffffff');
    postGrad2.addColorStop(1, '#888888');
    ctx.fillStyle = postGrad2;
    ctx.fillRect(goalX + goalW - 6, goalY - 4, 12, goalH + 8);

    const crossGrad = ctx.createLinearGradient(0, goalY - 6, 0, goalY + 6);
    crossGrad.addColorStop(0, '#888888');
    crossGrad.addColorStop(0.5, '#ffffff');
    crossGrad.addColorStop(1, '#888888');
    ctx.fillStyle = crossGrad;
    ctx.fillRect(goalX - 6, goalY - 6, goalW + 12, 12);
    ctx.restore();

    const zonePositions = [
      { num: 1, x: goalX + goalW * 0.12, y: goalY + goalH * 0.25 },
      { num: 2, x: goalX + goalW * 0.82, y: goalY + goalH * 0.25 },
      { num: 3, x: goalX + goalW * 0.12, y: goalY + goalH * 0.72 },
      { num: 4, x: goalX + goalW * 0.82, y: goalY + goalH * 0.72 },
      { num: 5, x: goalX + goalW * 0.47, y: goalY + goalH * 0.50 },
    ];

    for (const zone of zonePositions) {
      ctx.save();
      ctx.shadowColor = '#00000066';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, 26, 0, Math.PI * 2);
      ctx.fillStyle = '#00000055';
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(zone.x, zone.y, 24, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff22';
      ctx.fill();
      ctx.strokeStyle = '#ffffff88';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `bold 28px ${FIFA_FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(String(zone.num), zone.x, zone.y + 1);
      ctx.shadowBlur = 0;
      ctx.textBaseline = 'alphabetic';
    }

    ctx.save();
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(goalX, goalY + goalH + 20);
    ctx.lineTo(goalX + goalW, goalY + goalH + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(W/2, goalY + goalH + 50, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.save();
    const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
    headerGrad.addColorStop(0, '#00000000');
    headerGrad.addColorStop(0.3, '#000000cc');
    headerGrad.addColorStop(0.7, '#000000cc');
    headerGrad.addColorStop(1, '#00000000');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, W, 50);

    ctx.font = `bold 22px ${FIFA_FONT}`;
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 12;
    ctx.fillText('⚽  FUTHAX PENALTY', W/2, 32);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.save();
    const footerGrad = ctx.createLinearGradient(0, H - 60, 0, H);
    footerGrad.addColorStop(0, '#00000000');
    footerGrad.addColorStop(1, '#000000cc');
    ctx.fillStyle = footerGrad;
    ctx.fillRect(0, H - 60, W, 60);

    ctx.font = `bold 14px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`💰 Bet: ${bet.toLocaleString()} 💰  ·  Prize: ${(bet * 2).toLocaleString()} 💰`, W/2, H - 28);
    ctx.font = `12px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff88';
    ctx.fillText('Choose a zone — 2 winning zones out of 5', W/2, H - 10);
    ctx.restore();

    return canvas;
  }

  user.coins -= bet;
  user.lastPenalty = Date.now();
  saveData();

  const penaltyCanvas = await generatePenaltyCanvas();

  const penRow = new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map(n =>
      new ButtonBuilder()
        .setCustomId(`penalty_pick_${n}_${userId}`)
        .setLabel(String(n))
        .setStyle(ButtonStyle.Primary)
    )
  );

  const penMsg = await message.reply({
    embeds: [{
      color: 0x2ecc71,
      author: { name: `⚽ Penalty · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      image: { url: 'attachment://penalty.png' },
      footer: { text: `⏱️ You have 30 seconds to choose · Bet: ${bet.toLocaleString()} 💰` },
      timestamp: new Date().toISOString()
    }],
    files: [{ attachment: penaltyCanvas.toBuffer(), name: 'penalty.png' }],
    components: [penRow]
  });

  const penCol = penMsg.createMessageComponentCollector({ time: 30000 });

  penCol.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ This penalty is not yours.', ephemeral: true });

    penCol.stop();

    const chosen = parseInt(interaction.customId.replace(`penalty_pick_`, '').replace(`_${userId}`, ''));
    const isWin = winZones.includes(chosen);

    if (isWin) {
      user.coins += bet * 2;
    }
    saveData();

    async function generateResultCanvas(won) {
      const W = 540, H = 400;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');

      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, won ? '#0d3320' : '#330d0d');
      bgGrad.addColorStop(0.6, won ? '#1a6b3a' : '#6b1a1a');
      bgGrad.addColorStop(1, won ? '#0d3320' : '#330d0d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      const goalX = 80, goalY = 80;
      const goalW = W - 160, goalH = 180;

      ctx.fillStyle = '#ffffff10';
      ctx.fillRect(goalX, goalY, goalW, goalH);

      ctx.strokeStyle = '#ffffff20';
      ctx.lineWidth = 1;
      const netSpacingH = goalW / 10;
      const netSpacingV = goalH / 6;
      for (let x = goalX; x <= goalX + goalW; x += netSpacingH) {
        ctx.beginPath(); ctx.moveTo(x, goalY); ctx.lineTo(x, goalY + goalH); ctx.stroke();
      }
      for (let y = goalY; y <= goalY + goalH; y += netSpacingV) {
        ctx.beginPath(); ctx.moveTo(goalX, y); ctx.lineTo(goalX + goalW, y); ctx.stroke();
      }

      ctx.fillStyle = '#cccccc';
      ctx.fillRect(goalX - 6, goalY - 4, 12, goalH + 8);
      ctx.fillRect(goalX + goalW - 6, goalY - 4, 12, goalH + 8);
      ctx.fillRect(goalX - 6, goalY - 6, goalW + 12, 12);

      const zonePositions = [
        { num: 1, x: goalX + goalW * 0.12, y: goalY + goalH * 0.25 },
        { num: 2, x: goalX + goalW * 0.82, y: goalY + goalH * 0.25 },
        { num: 3, x: goalX + goalW * 0.12, y: goalY + goalH * 0.72 },
        { num: 4, x: goalX + goalW * 0.82, y: goalY + goalH * 0.72 },
        { num: 5, x: goalX + goalW * 0.47, y: goalY + goalH * 0.50 },
      ];

      for (const zone of zonePositions) {
        const isWinZone = winZones.includes(zone.num);
        const isChosen = zone.num === chosen;

        ctx.save();
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, 26, 0, Math.PI * 2);

        if (isChosen && isWinZone) {
          ctx.fillStyle = '#00ff8866';
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 20;
        } else if (isChosen && !isWinZone) {
          ctx.fillStyle = '#ff444466';
          ctx.shadowColor = '#ff4444';
          ctx.shadowBlur = 20;
        } else if (isWinZone) {
          ctx.fillStyle = '#00ff8833';
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 10;
        } else {
          ctx.fillStyle = '#ffffff11';
        }
        ctx.fill();

        ctx.strokeStyle = isWinZone ? '#00ff88' : (isChosen ? '#ff4444' : '#ffffff55');
        ctx.lineWidth = isChosen ? 3 : 1.5;
        ctx.stroke();
        ctx.restore();

        ctx.font = `bold 24px ${FIFA_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isChosen) {
          ctx.fillStyle = isWinZone ? '#00ff88' : '#ff4444';
          ctx.shadowColor = isWinZone ? '#00ff88' : '#ff4444';
          ctx.shadowBlur = 10;
          ctx.fillText(isWinZone ? '✓' : '✗', zone.x, zone.y + 1);
        } else {
          ctx.fillStyle = isWinZone ? '#00ff88aa' : '#ffffff66';
          ctx.shadowBlur = 0;
          ctx.fillText(String(zone.num), zone.x, zone.y + 1);
        }
        ctx.shadowBlur = 0;
        ctx.textBaseline = 'alphabetic';
      }

      ctx.save();
      ctx.font = `bold 28px ${FIFA_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = won ? '#00ff88' : '#ff4444';
      ctx.shadowColor = won ? '#00ff88' : '#ff4444';
      ctx.shadowBlur = 20;
      ctx.fillText(won ? '⚽ GOOOAL! YOU WIN!' : '❌ SAVED! YOU LOSE!', W/2, 35);
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save();
      ctx.font = `bold 16px ${FIFA_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      if (won) {
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 10;
        ctx.fillText(`+${bet.toLocaleString()} 💰 won · Balance: ${user.coins.toLocaleString()} 💰`, W/2, H - 30);
      } else {
        ctx.fillStyle = '#ff8888';
        ctx.fillText(`-${bet.toLocaleString()} 💰 lost · Balance: ${user.coins.toLocaleString()} 💰`, W/2, H - 30);
      }
      ctx.shadowBlur = 0;
      ctx.font = `13px ${FIFA_FONT}`;
      ctx.fillStyle = '#ffffff66';
      ctx.fillText(`Winning zones: ${winZones.sort((a,b)=>a-b).join(' and ')}`, W/2, H - 10);
      ctx.restore();

      return canvas;
    }

    const resultCanvas = await generateResultCanvas(isWin);

    await interaction.update({
      embeds: [{
        color: isWin ? 0x00ff88 : 0xff4444,
        author: { name: `⚽ Penalty · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        image: { url: 'attachment://penalty-result.png' },
        footer: { text: isWin ? `🎉 You won ${bet.toLocaleString()} 💰!` : `💔 You lost ${bet.toLocaleString()} 💰` },
        timestamp: new Date().toISOString()
      }],
      files: [{ attachment: resultCanvas.toBuffer(), name: 'penalty-result.png' }],
      components: []
    });
  });

  penCol.on('end', (_, reason) => {
    if (reason === 'time') {
      user.coins += bet;
      saveData();
      penMsg.edit({
        embeds: [{ color: 0x555555, title: '⏱️ Penalty expired', description: 'You did not choose in time. Your bet has been refunded.' }],
        files: [], components: []
      }).catch(() => {});
    }
  });

  return;
}


  // ─────────────────────────────────────────
  // 📋 CLUB
  // ─────────────────────────────────────────
  if (cmd === '.club' && args[1] && args[1].toLowerCase() === 'rename') {
    const newName = args.slice(2).join(' ').trim();
    if (!newName) return message.reply('❌ Enter the new name. Ex: `.club rename FC Crazy`');
    if (newName.length > 30) return message.reply('❌ The name cannot be longer than 30 characters.');
    const oldName = user.teamName || message.author.username + "'s FC";
    user.teamName = newName; saveData();
    return message.reply({ embeds:[{ color:0xFFD700, title:'✏️ Club name updated', description:`**${oldName}** → **${newName}**`, footer:{text:`Changed by ${message.author.username}`}, timestamp:new Date().toISOString() }] });
  }

  if (cmd === '.club') {
    const clubName = user.teamName || message.author.username + "'s FC";
    const totalPlayers = user.players ? user.players.length : 0;
    let page = 0;
    const perPage = 6;
    const totalPages = Math.max(1, Math.ceil(totalPlayers / perPage));
    const rarityEmoji = { "Icon":"⚪", "WorldCup":"🔴","Legendary":"🟡","Epic":"🟣","Rare":"🔵","Common":"⚪" };
    const posEmoji    = { "GK":"🧤","DM":"🛡️","AM":"🎯","ST":"⚽" };
    function buildClubEmbed(p) {
      const start = p * perPage;
      const slice = (user.players||[]).slice(start, start+perPage);
      const fields = slice.map((pl,i) => ({
        name: `${start+i+1}. ${rarityEmoji[pl.rarity]||'⚫'} ${posEmoji[pl.position]||'👤'} **${pl.name}**`,
        value: `\`${pl.rating} OVR\` · ${pl.position} · ${pl.rarity}${user.team&&user.team.some(t=>t.name===pl.name)?' · ✅ In team':''}`,
        inline: true
      }));
      if (fields.length === 0) fields.push({name:'😔 No players', value:'Open packs with `.open silver`', inline:false});
      return { embeds:[{ color:0x1a56db, author:{name:`🏟️  ${clubName}`,icon_url:message.author.displayAvatarURL({dynamic:true})}, thumbnail: user.clubLogo ? { url: 'attachment://club-logo.png' } : undefined, title:`📋 ${message.author.username}'s Club`, description:`**${totalPlayers}/${MAX_CLUB_SIZE}** players · Page **${p+1}/${totalPages}**`, fields, footer:{text:`${EMOJI_COIN} ${user.coins} coins  ·  ELO ${user.elo||1000}`}, timestamp:new Date().toISOString() }] };
    }
    function buildRow(p) {
      const isFirst = p===0, isLast = p>=totalPages-1;
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`club_first_${userId}`).setLabel('⏮').setStyle(ButtonStyle.Secondary).setDisabled(isFirst),
        new ButtonBuilder().setCustomId(`club_prev_${userId}`).setLabel('◀  Previous').setStyle(ButtonStyle.Primary).setDisabled(isFirst),
        new ButtonBuilder().setCustomId(`club_page_${userId}`).setLabel(`${p+1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`club_next_${userId}`).setLabel('Next  ▶').setStyle(ButtonStyle.Primary).setDisabled(isLast),
        new ButtonBuilder().setCustomId(`club_last_${userId}`).setLabel('⏭').setStyle(ButtonStyle.Secondary).setDisabled(isLast)
      );
    }
    const clubLogoFiles = user.clubLogo ? [{ attachment: Buffer.from(user.clubLogo, 'base64'), name: 'club-logo.png' }] : [];
    const msg = await message.reply({ ...buildClubEmbed(page), files: clubLogoFiles, components: totalPages>1 ? [buildRow(page)] : [] });
    if (totalPages <= 1) return;
    const collector = msg.createMessageComponentCollector({ time:120000 });
    collector.on('collect', interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content:'❌ This panel is not yours.', ephemeral:true });
      if (interaction.customId===`club_next_${userId}`&&page<totalPages-1) page++;
      if (interaction.customId===`club_prev_${userId}`&&page>0) page--;
      if (interaction.customId===`club_first_${userId}`) page=0;
      if (interaction.customId===`club_last_${userId}`) page=totalPages-1;
      interaction.update({ ...buildClubEmbed(page), components:[buildRow(page)] });
    });
    collector.on('end', () => msg.edit({components:[]}).catch(()=>{}));
  }

  // ─────────────────────────────────────────
  // ➕ ADD
  // ─────────────────────────────────────────
  if (cmd === '.add') {
    const name = args.slice(1).join(' ');
    if (!name) return message.reply('❌ Enter the player name.');
    if (user.team.length >= 4) return message.reply('❌ Your team already has 4 players. Use `.remove <name>` to make room.');
    const index = user.players.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    if (index === -1) return message.reply(`❌ You don't have **${name}** in your club.`);
    if (user.team.some(p => p.name.toLowerCase() === name.toLowerCase())) return message.reply(`❌ **${name}** is already in your team.`);
    user.team.push(deepCopyPlayer(user.players[index])); saveData();
    return message.reply(`✅ **${user.players[index].name}** added to team. (${user.team.length}/4)`);
  }

  // ─────────────────────────────────────────
  // ❌ REMOVE
  // ─────────────────────────────────────────
  if (cmd === '.remove') {
    const sub = args.slice(1);
    if (!sub.length) return message.reply('❌ Enter the player name.');
    let cantidad=1, nombre='';
    if (!isNaN(sub[0]) && sub.length > 1) { cantidad=parseInt(sub[0]); nombre=sub.slice(1).join(' '); }
    else nombre=sub.join(' ');
    if (!nombre) return message.reply('❌ Invalid name.');
    let removidos=0;
    for (let i=user.team.length-1;i>=0;i--) {
      if (user.team[i].name.toLowerCase()===nombre.toLowerCase()) { user.team.splice(i,1); removidos++; if(removidos>=cantidad) break; }
    }
    if (removidos===0) return message.reply(`❌ **${nombre}** is not in your team.`);
    saveData();
    return message.reply(`✅ Removed **${removidos}x ${nombre}** from team.`);
  }

  // ─────────────────────────────────────────
  // 🗑️ REMOVEALL
  // ─────────────────────────────────────────
  if (cmd === '.removeall') {
    const nombre = args.slice(1).join(' ');
    if (!nombre) return message.reply('❌ Enter the name.');
    const antes = user.team.length;
    user.team = user.team.filter(p => p.name.toLowerCase() !== nombre.toLowerCase());
    const eliminados = antes - user.team.length;
    if (eliminados===0) return message.reply(`❌ **${nombre}** is not in your team.`);
    saveData();
    return message.reply(`✅ Removed all **${nombre}** (${eliminados}) from team.`);
  }

// ─────────────────────────────────────────
// 🔨 !mejorar <jugador> — Subir OVR de una carta (máx +2, coste escalado)
// ─────────────────────────────────────────
if (cmd === '.upgrade') {
  const playerName = args.slice(1).join(' ').trim();
  if (!playerName) return message.reply(
    '❌ Usage: `.mejorar <name>`\n' +
    '💡 Increase a card\'s OVR by spending coins.\n' +
    '• Maximum **+2 OVR** per card\n' +
    '• Cost: **1st upgrade** = 500 × current OVR · **2nd upgrade** = 1000 × current OVR'
  );

  const idx = (user.players || []).findIndex(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (idx === -1) return message.reply(`❌ You don't have **${playerName}** in your club.\nUse \`.club\` to see your squad.`);

  const card = user.players[idx];
  if (!card.upgrades) card.upgrades = 0;

  const MAX_UPGRADES = 2;
  if (card.upgrades >= MAX_UPGRADES) {
    return message.reply({
      embeds: [{
        color: 0xFF4444,
        title: '❌ Card at maximum',
        description: `**${card.name}** has already reached the upgrade limit (+${MAX_UPGRADES} OVR).\nIt cannot be upgraded further.`,
        footer: { text: `Current OVR: ${card.rating}` }
      }]
    });
  }

  const UPGRADE_COST_MULTIPLIER = [500, 1000];
  const cost = UPGRADE_COST_MULTIPLIER[card.upgrades] * card.rating;

  if (user.coins < cost) {
    return message.reply({
      embeds: [{
        color: 0xFF4444,
        title: '❌ Not enough coins',
        description: [
          `To upgrade **${card.name}** you need **${cost.toLocaleString()} 💰**.`,
          `You have **${user.coins.toLocaleString()} 💰**.`,
          ``,
          `You are missing **${(cost - user.coins).toLocaleString()} 💰**.`
        ].join('\n'),
        footer: { text: 'Earn coins with !arena, !daily and !claim' }
      }]
    });
  }

  const rarityColors = { 'Icon': 0xC0C0C0, 'WorldCup': 0xCC2200, 'Legendary': 0xFFD700, 'Epic': 0x9B59B6, 'Rare': 0x5B9BD5, 'Common': 0x8B7355 };
  const rarityEmoji  = { 'Icon': '⭐', 'WorldCup': '🏆', 'Legendary': '👑', 'Epic': '💜', 'Rare': '💙', 'Common': '⚪' };

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mejorar_confirm_${userId}`)
      .setLabel(`✅ Confirm — ${cost.toLocaleString()} 💰`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mejorar_cancel_${userId}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  const oldRating = card.rating;
  const newRating = card.rating + 1;
  const upgradeNum = card.upgrades + 1;

  const confirmMsg = await message.reply({
    embeds: [{
      color: rarityColors[card.rarity] || 0x5865F2,
      author: { name: `🔨 Upgrade card · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      title: `${rarityEmoji[card.rarity]} ${card.name} — Upgrade #${upgradeNum}`,
      description: [
        `Do you confirm upgrading **${card.name}**?`,
        ``,
        `📈 OVR: **${oldRating}** → **${newRating}**`,
        `💰 Cost: **${cost.toLocaleString()} 💰**`,
        `💳 Balance after: **${(user.coins - cost).toLocaleString()} 💰**`,
        ``,
        `⚠️ Upgrades remaining after this: **${MAX_UPGRADES - upgradeNum}/${MAX_UPGRADES}**`
      ].join('\n'),
      fields: [
        { name: '📦 Rarity', value: card.rarity, inline: true },
        { name: '🎯 Position', value: card.position, inline: true },
        { name: '🔢 Upgrade', value: `${upgradeNum} of ${MAX_UPGRADES}`, inline: true }
      ],
      footer: { text: '⏱️ 30 seconds to confirm' },
      timestamp: new Date().toISOString()
    }],
    components: [confirmRow]
  });

  const mejCol = confirmMsg.createMessageComponentCollector({ time: 30000 });
  mejCol.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ This upgrade is not yours.', ephemeral: true });

    mejCol.stop();

    if (interaction.customId === `mejorar_cancel_${userId}`) {
      return interaction.update({
        embeds: [{ color: 0x555555, title: '❌ Upgrade cancelled', description: 'No changes were made.' }],
        components: []
      });
    }

    if (interaction.customId === `mejorar_confirm_${userId}`) {
      const freshIdx = (user.players || []).findIndex(p => p.name.toLowerCase() === playerName.toLowerCase());
      if (freshIdx === -1) return interaction.update({ embeds: [{ color: 0xFF4444, title: '❌ Error', description: 'The card is no longer in your club.' }], components: [] });

      if (user.coins < cost) return interaction.update({ embeds: [{ color: 0xFF4444, title: '❌ Not enough coins', description: 'You no longer have enough coins.' }], components: [] });

      user.coins -= cost;
      user.players[freshIdx].rating = (user.players[freshIdx].rating || oldRating) + 1;
      if (!user.players[freshIdx].upgrades) user.players[freshIdx].upgrades = 0;
      user.players[freshIdx].upgrades += 1;

      const teamIdx = (user.team || []).findIndex(p => p.name.toLowerCase() === playerName.toLowerCase());
      if (teamIdx !== -1) {
        user.team[teamIdx].rating = user.players[freshIdx].rating;
        user.team[teamIdx].upgrades = user.players[freshIdx].upgrades;
      }

      saveData();

      const maxed = user.players[freshIdx].upgrades >= MAX_UPGRADES;

      await interaction.update({
        embeds: [{
          color: 0x00C851,
          author: { name: `✅ Card upgraded! · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${rarityEmoji[card.rarity]} ${card.name}`,
          description: [
            `🎉 **Upgrade successful!**`,
            ``,
            `📈 OVR: **${oldRating}** → **${user.players[freshIdx].rating}** (+1)`,
            `💰 Spent: **${cost.toLocaleString()} 💰**`,
            `💳 Current balance: **${user.coins.toLocaleString()} 💰**`,
            ``,
            maxed
              ? `🔒 **This card has reached the maximum upgrades (+${MAX_UPGRADES} OVR total).**`
              : `🔨 You can still do **${MAX_UPGRADES - user.players[freshIdx].upgrades}** more upgrade(s).`
          ].join('\n'),
          fields: [
            { name: '⭐ Upgrades applied', value: `${user.players[freshIdx].upgrades}/${MAX_UPGRADES}`, inline: true },
            { name: '📦 Rarity', value: card.rarity, inline: true },
            { name: '🎯 Position', value: card.position, inline: true }
          ],
          footer: { text: maxed ? '🔒 Card fully upgraded' : `Next upgrade will cost ${(UPGRADE_COST_MULTIPLIER[1] * user.players[freshIdx].rating).toLocaleString()} 💰` },
          timestamp: new Date().toISOString()
        }],
        components: []
      });
    }
  });

  mejCol.on('end', (_, reason) => {
    if (reason === 'time') confirmMsg.edit({ embeds: [{ color: 0x555555, title: '⏱️ Upgrade expired', description: 'You did not confirm in time.' }], components: [] }).catch(() => {});
  });

  return;
}

// ─────────────────────────────────────────
// 🏷️ !subasta <jugador> <precio_inicial> — Subasta pública de cartas
// ─────────────────────────────────────────
if (cmd === '.auction') {
  const lastArg   = args[args.length - 1];
  const startBid  = parseInt(lastArg);
  const playerName = args.slice(1, -1).join(' ').trim();

  if (!playerName || isNaN(startBid) || startBid <= 0) {
    return message.reply(
      '❌ Usage: `.auction <name> <starting_price>`\n' +
      'Ex: `.auction Veil 5000`\n\n' +
      '• The auction lasts **90 seconds**\n' +
      '• Each bid must be higher than the previous\n' +
      '• If nobody bids, the card returns to your club'
    );
  }

  const SUBASTA_MIN = 200;
  if (startBid < SUBASTA_MIN) return message.reply(`❌ Minimum starting price is **${SUBASTA_MIN} 💰**.`);

  const playerIdx = (user.players || []).findIndex(p => p.name.toLowerCase() === playerName.toLowerCase());
  if (playerIdx === -1) return message.reply(`❌ You don't have **${playerName}** in your club.\nUse \`.club\` to see your squad.`);

  const auctionCard = { ...user.players[playerIdx] };
  const rarityColors = { 'Icon': 0xC0C0C0, 'WorldCup': 0xCC2200, 'Legendary': 0xFFD700, 'Epic': 0x9B59B6, 'Rare': 0x5B9BD5, 'Common': 0x8B7355 };
  const rarityEmoji  = { 'Icon': '⭐', 'WorldCup': '🏆', 'Legendary': '👑', 'Epic': '💜', 'Rare': '💙', 'Common': '⚪' };

  user.players.splice(playerIdx, 1);
  user.team = (user.team || []).filter(p => p.name !== auctionCard.name);
  saveData();

  const AUCTION_DURATION = 90000;
  const auctionEnd = Date.now() + AUCTION_DURATION;

  let currentBid    = startBid;
  let currentBidder = null;
  let currentBidderName = null;
  let bidCount = 0;

  function buildAuctionEmbed(timeLeft) {
    const secs = Math.max(0, Math.floor(timeLeft / 1000));
    const bar  = '█'.repeat(Math.round((secs / 90) * 10)) + '░'.repeat(10 - Math.round((secs / 90) * 10));

    return {
      color: currentBidder ? 0x00C851 : rarityColors[auctionCard.rarity] || 0x5865F2,
      author: { name: `🏷️ Auction · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      title: `${rarityEmoji[auctionCard.rarity]} ${auctionCard.name} — ${auctionCard.rarity} · ${auctionCard.rating} OVR`,
      description: [
        `**Position:** ${auctionCard.position}`,
        ``,
        currentBidder
          ? `🏆 **Current bid:** **${currentBid.toLocaleString()} 💰** — @${currentBidderName}`
          : `💰 **Starting price:** **${currentBid.toLocaleString()} 💰** — No bids yet`,
        ``,
        `📊 Bids received: **${bidCount}**`,
        `⏱️ Time remaining: **${secs}s** \`${bar}\``,
        ``,
        `💡 Press **Bid!** to make a higher offer.`
      ].join('\n'),
      fields: [
        { name: '🏷️ Seller', value: `<@${userId}>`, inline: true },
        { name: '💸 Min. sell', value: `${(SELL_PRICES[auctionCard.rarity] || 90).toLocaleString()} 💰`, inline: true },
        { name: '⏳ Ends', value: `<t:${Math.floor(auctionEnd / 1000)}:R>`, inline: true }
      ],
      footer: { text: 'Each bid must exceed the previous · Card goes to the highest bidder' },
      timestamp: new Date().toISOString()
    };
  }

  function buildBidRow(disabled = false) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bid_place_${userId}`)
        .setLabel(`💰 Bid! (min. ${(currentBid + 1).toLocaleString()} 💰)`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`bid_info_${userId}`)
        .setLabel('📊 View stats')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
  }

  const auctionMsg = await message.reply({
    embeds: [buildAuctionEmbed(AUCTION_DURATION)],
    components: [buildBidRow()]
  });

  const intervals = [75000, 60000, 45000, 30000, 15000, 5000].filter(t => t < AUCTION_DURATION);
  const updateTimers = intervals.map(t =>
    setTimeout(async () => {
      const timeLeft = auctionEnd - Date.now();
      await auctionMsg.edit({ embeds: [buildAuctionEmbed(timeLeft)], components: [buildBidRow()] }).catch(() => {});
    }, AUCTION_DURATION - t)
  );

  const bidCollector = auctionMsg.createMessageComponentCollector({ time: AUCTION_DURATION });

  bidCollector.on('collect', async interaction => {
    if (interaction.customId === `bid_info_${userId}`) {
      const statLines = Object.entries(auctionCard.stats || {}).map(([k, v]) => {
        const filled = Math.round(v / 10);
        const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
        const col = v >= 88 ? '🟢' : v >= 75 ? '🟡' : v >= 60 ? '🟠' : '🔴';
        return `${col} **${k}** \`${bar}\` **${v}**`;
      }).join('\n');
      return interaction.reply({
        embeds: [{ color: rarityColors[auctionCard.rarity] || 0x888888, title: `📊 Stats — ${auctionCard.name}`, description: statLines || '_No stats_', footer: { text: `${auctionCard.rarity} · ${auctionCard.position} · ${auctionCard.rating} OVR` } }],
        ephemeral: true
      });
    }

    if (interaction.customId === `bid_place_${userId}`) {
      const bidderId = interaction.user.id;

      if (bidderId === userId) return interaction.reply({ content: '❌ You cannot bid on your own auction.', ephemeral: true });

      if (!data[bidderId]) return interaction.reply({ content: '❌ You don\'t have a registered profile. Use any command first.', ephemeral: true });

      const bidder = data[bidderId];
      const minBid = currentBid + Math.max(1, Math.floor(currentBid * 0.05));

      if (bidder.coins < minBid) {
        return interaction.reply({
          content: `❌ You need at least **${minBid.toLocaleString()} 💰** to bid. You have **${(bidder.coins || 0).toLocaleString()} 💰**.`,
          ephemeral: true
        });
      }

      if ((bidder.players || []).length >= MAX_CLUB_SIZE) {
        return interaction.reply({ content: `❌ Your club is full (${MAX_CLUB_SIZE}/${MAX_CLUB_SIZE}). Sell players before buying more.`, ephemeral: true });
      }

      if (currentBidder && currentBidder !== bidderId) {
        if (!data[currentBidder]) data[currentBidder] = {};
        data[currentBidder].coins = (data[currentBidder].coins || 0) + currentBid;
      }

      bidder.coins -= minBid;
      currentBid = minBid;
      currentBidder = bidderId;
      currentBidderName = interaction.user.username;
      bidCount++;
      saveData();

      const timeLeft = auctionEnd - Date.now();
      await interaction.update({
        embeds: [buildAuctionEmbed(timeLeft)],
        components: [buildBidRow()]
      });
    }
  });

  bidCollector.on('end', async () => {
    updateTimers.forEach(t => clearTimeout(t));

    if (!currentBidder) {
      if (!user.players) user.players = [];
      user.players.push({ ...auctionCard });
      saveData();

      await auctionMsg.edit({
        embeds: [{
          color: 0x555555,
          author: { name: `🏷️ Auction ended · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${rarityEmoji[auctionCard.rarity]} ${auctionCard.name} — No bids`,
          description: [
            `❌ **Nobody bid.** The card has returned to your club.`,
            ``,
            `💡 Try with a lower starting price or list it on \`.market\`.`
          ].join('\n'),
          footer: { text: 'Use !sell <name> to sell on the market' },
          timestamp: new Date().toISOString()
        }],
        components: []
      }).catch(() => {});
      return;
    }

    if (!data[currentBidder].players) data[currentBidder].players = [];
    data[currentBidder].players.push({ ...auctionCard });

    user.coins = (user.coins || 0) + currentBid;
    saveData();

    try {
      const winner = await client.users.fetch(currentBidder);
      winner.send({
        embeds: [{
          color: 0x00C851,
          title: `🏆 You won the auction!`,
          description: `You got **${auctionCard.name}** (${auctionCard.rarity} · ${auctionCard.rating} OVR) for **${currentBid.toLocaleString()} 💰**.\n\nCheck your club with \`.club\`.`
        }]
      }).catch(() => {});
    } catch {}

    await auctionMsg.edit({
      embeds: [{
        color: 0xFFD700,
        author: { name: `🏷️ Auction ended · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `🏆 ${rarityEmoji[auctionCard.rarity]} ${auctionCard.name} — Sold!`,
        description: [
          `✅ **Auction closed with ${bidCount} bid(s).**`,
          ``,
          `🏆 **Winner:** <@${currentBidder}>`,
          `💰 **Final price:** **${currentBid.toLocaleString()} 💰**`,
          `💸 **Seller received:** **+${currentBid.toLocaleString()} 💰**`
        ].join('\n'),
        fields: [
          { name: `${rarityEmoji[auctionCard.rarity]} Card`, value: `${auctionCard.name} · ${auctionCard.rating} OVR · ${auctionCard.position}`, inline: false },
          { name: '💳 Seller balance', value: `${user.coins.toLocaleString()} 💰`, inline: true },
          { name: '📊 Total bids', value: `${bidCount}`, inline: true }
        ],
        footer: { text: 'Thanks for using the auction system' },
        timestamp: new Date().toISOString()
      }],
      components: []
    }).catch(() => {});
  });

  return;
}

// ─────────────────────────────────────────
// 💼 !trabajo — Ingresos pasivos cada 4h basados en ELO y colección
// ─────────────────────────────────────────
if (cmd === '.work') {
  const TRABAJO_CD = 4 * 60 * 60 * 1000;
  const lastTrabajo = user.lastTrabajo || 0;
  const elapsed = Date.now() - lastTrabajo;

  if (!isAdmin(userId) && elapsed < TRABAJO_CD) {
    const remaining = TRABAJO_CD - elapsed;
    const hh = Math.floor(remaining / 3600000);
    const mm = Math.floor((remaining % 3600000) / 60000);
    const ss = Math.floor((remaining % 60000) / 1000);
    return message.reply({
      embeds: [{
        color: 0x2b2d31,
        title: '⏱️ You already worked recently',
        description: `Come back in **${hh}h ${mm}m ${ss}s** to collect your next salary.`,
        footer: { text: 'Work resets every 4 hours' }
      }]
    });
  }

  const elo         = user.elo || 1000;
  const tier        = getEloTier(elo);
  const clubSize    = (user.players || []).length;
  const teamFull    = (user.team || []).length === 4;
  const avgOvr      = clubSize > 0 ? Math.round((user.players || []).reduce((s, p) => s + p.rating, 0) / clubSize) : 0;

  const eloBonus = Math.floor(elo / 20);

  const tierBonus = { 'BRONCE': 50, 'PLATA': 100, 'ORO': 180, 'PLATINO': 300, 'DIAMANTE': 800, 'CAMPEÓN': 1000 };
  const tierPay = tierBonus[tier.name] || 50;

  const collectionBonus = Math.floor(clubSize * 15);
  const ovrBonus = avgOvr > 0 ? Math.floor(avgOvr * 2.5) : 0;
  const teamBonus = teamFull ? 100 : 0;
  const streakBonus = Math.min(200, (user.daily?.streak || 0) * 10);

  const total = eloBonus + tierPay + collectionBonus + ovrBonus + teamBonus + streakBonus;

  user.coins += total;
  user.lastTrabajo = Date.now();
  saveData();

  const breakdown = [
    { label: `${tier.emoji} Tier ${tier.name}`,           value: tierPay         },
    { label: `📊 ELO (${elo} pts)`,                       value: eloBonus        },
    { label: `🃏 Collection (${clubSize} players)`,       value: collectionBonus },
    { label: `⭐ Avg OVR (${avgOvr})`,                    value: ovrBonus        },
    { label: `👥 Full team`,                               value: teamBonus       },
    { label: `🔥 Streak (${user.daily?.streak || 0}d)`,   value: streakBonus     },
  ].filter(b => b.value > 0);

  const breakdownText = breakdown.map(b => `• ${b.label}: **+${b.value} 💰**`).join('\n');

  const nextWork = new Date(Date.now() + TRABAJO_CD);
  const nextHH   = nextWork.getHours().toString().padStart(2, '0');
  const nextMM   = nextWork.getMinutes().toString().padStart(2, '0');

  return message.reply({
    embeds: [{
      color: 0x00C851,
      author: { name: `💼 Work · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      title: `💼 Salary collected! +${total.toLocaleString()} 💰`,
      description: [
        `**${message.author.username}** collected their salary of **${total.toLocaleString()} 💰**.`,
        ``,
        `**📋 Breakdown:**`,
        breakdownText,
      ].join('\n'),
      fields: [
        { name: '💰 Total collected',  value: `**${total.toLocaleString()} 💰**`,      inline: true },
        { name: '💳 Current balance',  value: `**${user.coins.toLocaleString()} 💰**`, inline: true },
        { name: '⏰ Next work',        value: `Available at **${nextHH}:${nextMM}**`,  inline: true },
      ],
      footer: { text: 'Improve your ELO, expand your club and keep your streak to earn more 💰' },
      timestamp: new Date().toISOString()
    }]
  });
}
```

// ═══════════════════════════════════
// 🏆 !logros
// ═══════════════════════════════════
if (cmd === '.achievements') {
  const u = data[userId];
  if (!u.achievements)      u.achievements      = {};
  if (!u.achievementsStats) u.achievementsStats = {};
 
  const total        = ACHIEVEMENTS_DEF.length;
  const unlocked = ACHIEVEMENTS_DEF.filter(l => u.achievements[l.id]?.unlocked).length;
  const percentage   = Math.round((unlocked / total) * 100);
  const totalCoins   = ACHIEVEMENTS_DEF.filter(l => u.achievements[l.id]?.unlocked)
                                  .reduce((s, l) => s + (l.reward?.coins || 0), 0);
 
  // Global progress bar
  const barFilled = Math.round((unlocked / total) * 15);
  const barEmpty  = 15 - barFilled;
  const globalBar = `\`${'█'.repeat(barFilled)}${'░'.repeat(barEmpty)}\` **${unlocked}/${total}** (${percentage}%)`;
 
  // Group by category
  const categories = [
    { label: '⚔️ Matches & Arena',  tipos: ['arena_win', 'friendly_play'] },
    { label: '📅 Consistency',      tipos: ['daily_streak'] },
    { label: '📦 Collection',       tipos: ['packs_opened', 'rarity_owned', 'club_full'] },
    { label: '💰 Economy',          tipos: ['coins_total', 'cards_sold'] },
    { label: '📊 ELO',              tipos: ['elo_reached'] },
    { label: '🥊 Duels',            tipos: ['duels_played', 'duels_won'] },
  ];
 
  // Pages: one per category
  let currentPage = 0;
  const totalPages = categories.length;
 
  function buildAchievementsEmbed(page) {
    const cat = categories[page];
    const catAchievements = ACHIEVEMENTS_DEF.filter(l => cat.tipos.includes(l.tipo));
 
    const lines = catAchievements.map(l => {
      const isUnlocked = !!u.achievements[l.id]?.unlocked;
      const progress = u.achievementsStats?.[l.id] || 0;
      const objNum   = typeof l.objetivo === 'number' ? l.objetivo : 1;
 
      if (isUnlocked) {
        const date = new Date(u.achievements[l.id].date).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' });
        return `${l.emoji} ~~**${l.nombre}**~~ ✅ _${date}_ · +${(l.reward?.coins || 0).toLocaleString()} 💰`;
      }
 
      // Individual progress bar (accumulative achievements only)
      let progressLine = '';
      if (typeof l.objetivo === 'number') {
        const pct    = Math.min(1, progress / objNum);
        const filled = Math.round(pct * 10);
        const empty  = 10 - filled;
        progressLine = ` \`${'█'.repeat(filled)}${'░'.repeat(empty)}\` ${Math.min(progress, objNum)}/${objNum}`;
      }
 
      return `${l.emoji} **${l.nombre}** — _${l.desc}_\n　　💰 +${(l.reward?.coins || 0).toLocaleString()}${progressLine}`;
    }).join('\n\n');
 
    const unlockedCat = catAchievements.filter(l => u.achievements[l.id]?.unlocked).length;
 
    return {
      embeds: [{
        color: unlockedCat === catAchievements.length ? 0x00C851 : 0x2b2d31,
        author: {
          name: `🏆 Achievements of ${message.author.username}`,
          icon_url: message.author.displayAvatarURL({ dynamic: true })
        },
        title: `${cat.label}  ·  ${unlockedCat}/${catAchievements.length}`,
        description: lines || '_No achievements in this category._',
        fields: [
          {
            name: '📊 Global Progress',
            value: globalBar,
            inline: false
          },
          {
            name: '💰 Coins earned from achievements',
            value: `**${totalCoins.toLocaleString()} 💰**`,
            inline: true
          },
          {
            name: '🏅 Unlocked',
            value: `**${unlocked} / ${total}**`,
            inline: true
          }
        ],
        footer: { text: `Page ${page + 1}/${totalPages}  ·  Navigate with the buttons  ·  Rewards are claimed automatically` },
        timestamp: new Date().toISOString()
      }]
    };
  }
 
  function buildAchievementsRow(uid, page) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`achievements_prev_${uid}`)
        .setLabel('⬅️ Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`achievements_page_${uid}`)
        .setLabel(`${page + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`achievements_next_${uid}`)
        .setLabel('Next ➡️')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page >= totalPages - 1)
    );
  }
 
  const achievementsMsg = await message.reply({
    ...buildAchievementsEmbed(currentPage),
    components: [buildAchievementsRow(userId, currentPage)]
  });
 
  const collector = achievementsMsg.createMessageComponentCollector({ time: 120000 });
  collector.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ This panel is not yours.', ephemeral: true });
    if (interaction.customId === `achievements_next_${userId}` && currentPage < totalPages - 1) currentPage++;
    else if (interaction.customId === `achievements_prev_${userId}` && currentPage > 0) currentPage--;
    await interaction.update({ ...buildAchievementsEmbed(currentPage), components: [buildAchievementsRow(userId, currentPage)] });
  });
  collector.on('end', () => achievementsMsg.edit({ components: [] }).catch(() => {}));
  return;
}
 
 
// ═══════════════════════════════════
// 📊 !collection
// ═══════════════════════════════════
if (cmd === '.collection') {
  const myPlayers  = user.players || [];
  const ownedNames = new Set(myPlayers.map(p => p.name.toLowerCase()));
 
  const rarities = ['Icon', 'WorldCup', 'Legendary', 'Epic', 'Rare', 'Common'];
  const rarityEmoji = {
    'Icon': '⭐', 'WorldCup': '🏆', 'Legendary': '👑',
    'Epic': '💜', 'Rare': '💙', 'Common': '⚪'
  };
 
  const stats = {};
  for (const r of rarities) {
    const totalR = players.filter(p => p.rarity === r).length;
    const ownedR = players.filter(p => p.rarity === r && ownedNames.has(p.name.toLowerCase())).length;
    const pct    = totalR > 0 ? Math.round((ownedR / totalR) * 100) : 0;
    const filled = Math.round(pct / 10);
    const empty  = 10 - filled;
    stats[r] = { total: totalR, owned: ownedR, pct, bar: `\`${'█'.repeat(filled)}${'░'.repeat(empty)}\`` };
  }
 
  const totalAll = players.length;
  const ownedAll = players.filter(p => ownedNames.has(p.name.toLowerCase())).length;
  const pctAll   = Math.round((ownedAll / totalAll) * 100);
  const filledG  = Math.round(pctAll / 10);
  const emptyG   = 10 - filledG;
  const globalBar = `\`${'█'.repeat(filledG)}${'░'.repeat(emptyG)}\` **${ownedAll}/${totalAll}** — **${pctAll}%**`;
 
  // Top owned unique cards by rating
  const topCards = [...myPlayers]
    .sort((a, b) => b.rating - a.rating)
    .filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i) // deduplicate
    .slice(0, 5)
    .map(p => `${rarityEmoji[p.rarity]} **${p.name}** · ${p.rating} OVR`)
    .join('\n');
 
  const rarityLines = rarities.map(r => {
    const s = stats[r];
    return `${rarityEmoji[r]} **${r}** ${s.bar} ${s.owned}/${s.total} (${s.pct}%)`;
  }).join('\n');
 
  return message.reply({
    embeds: [{
      color: pctAll >= 75 ? 0xFFD700 : pctAll >= 40 ? 0x5865F2 : 0x2b2d31,
      author: {
        name: `📊 Collection of ${message.author.username}`,
        icon_url: message.author.displayAvatarURL({ dynamic: true })
      },
      title: `${user.teamName || message.author.username + "'s FC"}`,
      description: [
        `**Total Progress**`,
        globalBar,
      ].join('\n'),
      fields: [
        {
          name: '📦 Breakdown by rarity',
          value: rarityLines,
          inline: false
        },
        {
          name: '⭐ Your top 5 unique cards',
          value: topCards || '_No players in the club_',
          inline: false
        },
        {
          name: '🃏 Cards in club',
          value: `**${myPlayers.length}** (with duplicates)`,
          inline: true
        },
        {
          name: '🔑 Unique cards',
          value: `**${ownedAll}** of **${totalAll}**`,
          inline: true
        },
        {
          name: '📈 Completed',
          value: `**${pctAll}%**`,
          inline: true
        }
      ],
      footer: { text: '.players to see the full catalogue  ·  !market to get missing cards' },
      timestamp: new Date().toISOString()
    }]
  });
}
 
 
// ═══════════════════════════════════
// ⚔️ !duelo @usuario <apuesta>
// ═══════════════════════════════════
if (cmd === '.duelo') {
  const target = message.mentions.users.first();
  const bet    = parseInt(args[2]);
 
  if (!target)
    return message.reply('❌ Uso: `.duelo @usuario <apuesta>`\nEj: `.duelo @Luntek 500`');
  if (target.id === userId)
    return message.reply('❌ No puedes duelarte contigo mismo.');
  if (target.bot)
    return message.reply('❌ No puedes duelarte con un bot.');
  if (isNaN(bet) || bet < 100)
    return message.reply('❌ La apuesta mínima es **100 💰**.\nEj: `.duelo @Luntek 500`');
  if (user.coins < bet)
    return message.reply(`❌ No tienes suficientes monedas.\nTienes **${user.coins.toLocaleString()} 💰** y quieres apostar **${bet.toLocaleString()} 💰**.`);
  if ((user.team || []).length < 4)
    return message.reply('❌ Necesitas **4 jugadores en tu equipo** para duelos.\nUsa `.team` para armar tu equipo.');
  if (!data[target.id])
    return message.reply('❌ Ese usuario no tiene perfil registrado todavía.');
  if ((data[target.id].team || []).length < 4)
    return message.reply(`❌ **${target.username}** no tiene equipo armado (necesita 4 jugadores con \`.team\`).`);
  if ((data[target.id].coins || 0) < bet)
    return message.reply(`❌ **${target.username}** no tiene suficientes monedas (**${(data[target.id].coins || 0).toLocaleString()} 💰** disponibles).`);
 
  const DUELO_COOLDOWN_MS = 5 * 60 * 1000;
  if (!isAdmin(userId)) {
    const elapsed = Date.now() - (user.lastDuelo || 0);
    if (elapsed < DUELO_COOLDOWN_MS) {
      const mins = Math.floor((DUELO_COOLDOWN_MS - elapsed) / 60000);
      const secs = Math.floor(((DUELO_COOLDOWN_MS - elapsed) % 60000) / 1000);
      return message.reply(`⏱️ **Duelo en cooldown** — espera **${mins}m ${secs}s**.`);
    }
  }
 
  const myClub   = user.teamName || message.author.username + "'s FC";
  const oppClub  = data[target.id].teamName || target.username + "'s FC";
  const myTier   = getEloTier(user.elo || 1000);
  const oppTier  = getEloTier(data[target.id].elo || 1000);
 
  // Lineup del usuario (para mostrarlo en el desafío)
  const posEmoji = { GK: '🧤', DM: '🛡️', AM: '🎯', ST: '⚽' };
  const slotLabels = ['GK', 'DM', 'AM', 'ST'];
  const myLineup  = (user.team || []).map((p, i) => `${posEmoji[slotLabels[i]] || '👤'} **${p.name}** · ${p.rating} OVR`).join('\n');
  const oppLineup = (data[target.id].team || []).map((p, i) => `${posEmoji[slotLabels[i]] || '👤'} **${p.name}** · ${p.rating} OVR`).join('\n');
 
  const challengeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`duelo_accept_${userId}_${target.id}_${bet}`)
      .setLabel(`✅ Aceptar — ${bet.toLocaleString()} 💰`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`duelo_reject_${userId}_${target.id}`)
      .setLabel('❌ Rechazar')
      .setStyle(ButtonStyle.Danger)
  );
 
  const challengeMsg = await message.reply({
    content: `<@${target.id}> ¡te han retado a un duelo!`,
    embeds: [{
      color: 0xFF6B00,
      author: {
        name: `⚔️ Desafío de ${message.author.username}`,
        icon_url: message.author.displayAvatarURL({ dynamic: true })
      },
      title: `${myClub}  ⚔️  ${oppClub}`,
      description: [
        `💰 **Apuesta:** ${bet.toLocaleString()} 💰 de cada lado`,
        `🏆 **Premio al ganador:** ${(bet * 2).toLocaleString()} 💰`,
      ].join('\n'),
      fields: [
        {
          name: `🏠 ${myClub} — ${myTier.emoji} ${user.elo || 1000} ELO`,
          value: myLineup || '_Sin equipo_',
          inline: true
        },
        {
          name: `✈️ ${oppClub} — ${oppTier.emoji} ${data[target.id].elo || 1000} ELO`,
          value: oppLineup || '_Sin equipo_',
          inline: true
        }
      ],
      footer: { text: '⏱️ Tienes 60 segundos para responder' },
      timestamp: new Date().toISOString()
    }],
    components: [challengeRow]
  });
 
  const duelCol = challengeMsg.createMessageComponentCollector({ time: 60000 });
 
  duelCol.on('collect', async interaction => {
    if (interaction.user.id !== target.id)
      return interaction.reply({ content: '❌ Este desafío no es para ti.', ephemeral: true });
 
    duelCol.stop();
 
    // ── Rechazar ──
    if (interaction.customId === `duelo_reject_${userId}_${target.id}`) {
      return interaction.update({
        content: null,
        embeds: [{
          color: 0x555555,
          title: '❌ Duelo rechazado',
          description: `**${target.username}** rechazó el desafío de **${message.author.username}**.`
        }],
        components: []
      });
    }
 
    // ── Aceptar ──
    if (interaction.customId === `duelo_accept_${userId}_${target.id}_${bet}`) {
      // Re-validar monedas
      if (user.coins < bet)
        return interaction.update({ content: null, embeds: [{ color: 0xFF4444, title: '❌ Duelo inválido', description: `**${message.author.username}** ya no tiene suficientes monedas.` }], components: [] });
      if ((data[target.id].coins || 0) < bet)
        return interaction.update({ content: null, embeds: [{ color: 0xFF4444, title: '❌ Duelo inválido', description: `**${target.username}** ya no tiene suficientes monedas.` }], components: [] });
 
      // Descontar apuestas
      user.coins -= bet;
      data[target.id].coins -= bet;
      user.lastDuelo = Date.now();
      saveData();
 
      await interaction.update({
        content: null,
        embeds: [{
          color: 0xFF6B00,
          title: '⚔️ ¡Duelo en curso!',
          description: `**${myClub}** vs **${oppClub}**\n\n⏳ Simulando el partido...`,
          footer: { text: `Apuesta: ${bet.toLocaleString()} 💰 cada uno · Premio: ${(bet * 2).toLocaleString()} 💰` }
        }],
        components: []
      });
 
      await new Promise(r => setTimeout(r, 3000));
 
      // ── Motor de partido ──
      const RARITY_BONUS = {
        "Common": 0.00, "Rare": 0.05, "Epic": 0.10,
        "Legendary": 0.18, "WorldCup": 0.48, "Icon": 0.56,
      };
      const SLOT_POS = ['GK', 'DM', 'AM', 'ST'];
      const PEN      = 8;
 
      const myOvr  = (user.team || []).reduce((s, p, i) => s + (p.rating - (p.position !== SLOT_POS[i] ? PEN : 0)), 0) / 4;
      const oppOvr = (data[target.id].team || []).reduce((s, p, i) => s + (p.rating - (p.position !== SLOT_POS[i] ? PEN : 0)), 0) / 4;
 
      let myRarB = 0, oppRarB = 0;
      for (const p of user.team)             myRarB  += RARITY_BONUS[p.rarity]  || 0;
      for (const p of data[target.id].team)  oppRarB += RARITY_BONUS[p.rarity] || 0;
      const rarDiff = myRarB - oppRarB;
 
      const ovrW = myOvr / (myOvr + oppOvr);
      const myW  = Math.max(0.25, Math.min(0.85, 0.70 * ovrW + 0.30 * (0.5 + rarDiff)));
 
      // Generar goles
      const numEv = 2 + Math.floor(Math.random() * 7);
      const usedM = new Set(), evMins = [];
      while (evMins.length < numEv) {
        const m = 1 + Math.floor(Math.random() * 90);
        if (!usedM.has(m)) { usedM.add(m); evMins.push(m); }
      }
      evMins.sort((a, b) => a - b);
 
      let myG = 0, oppG = 0;
      const myGoalLog = [], oppGoalLog = [];
 
      for (const min of evMins) {
        const isMe   = Math.random() < myW;
        const pool   = isMe ? user.team : data[target.id].team;
        const atk    = pool.filter(p => ['ST', 'AM'].includes(p.position));
        const scorer = atk.length > 0 ? atk[Math.floor(Math.random() * atk.length)] : pool[Math.floor(Math.random() * pool.length)];
        const others = pool.filter(p => p.name !== scorer.name);
        const assist = others.length > 0 && Math.random() > 0.45 ? others[Math.floor(Math.random() * others.length)] : null;
        const line   = `⚽ **${min}'** ${scorer.name}${assist ? ` _(ass. ${assist.name})_` : ''}`;
        if (isMe) { myG++; myGoalLog.push(line); }
        else      { oppG++; oppGoalLog.push(line); }
      }
 
      // Evitar empates
      if (myG === oppG) {
        if (myOvr >= oppOvr) { myG++; myGoalLog.push(`⚽ **90+3'** _Gol de presión_`); }
        else                  { oppG++; oppGoalLog.push(`⚽ **90+3'** _Gol de presión_`); }
      }
 
      const iWon  = myG > oppG;
      const winner = iWon ? userId : target.id;
      const loser  = iWon ? target.id : userId;
 
      // Transferir monedas al ganador
      data[winner].coins = (data[winner].coins || 0) + bet * 2;
 
      // ELO (k=20, más suave que arena)
      const K       = 20;
      const expMe   = 1 / (1 + Math.pow(10, ((data[target.id].elo || 1000) - (user.elo || 1000)) / 400));
      const scoreMe = iWon ? 1 : 0;
      const oldMyE  = user.elo || 1000;
      const oldOppE = data[target.id].elo || 1000;
      user.elo            = Math.max(100, Math.round(oldMyE  + K * (scoreMe - expMe)));
      data[target.id].elo = Math.max(100, Math.round(oldOppE + K * ((1 - scoreMe) - (1 - expMe))));
      const myEloDiff  = user.elo - oldMyE;
      const oppEloDiff = data[target.id].elo - oldOppE;
 
      // Historial
      if (!user.matchHistory)            user.matchHistory            = [];
      if (!data[target.id].matchHistory) data[target.id].matchHistory = [];
      user.matchHistory.unshift({
        type: 'duelo', date: Date.now(), oppId: target.id, oppName: target.username,
        myGoals: myG, oppGoals: oppG, result: iWon ? 'win' : 'loss', reward: iWon ? bet : -bet
      });
      data[target.id].matchHistory.unshift({
        type: 'duelo', date: Date.now(), oppId: userId, oppName: message.author.username,
        myGoals: oppG, oppGoals: myG, result: iWon ? 'loss' : 'win', reward: iWon ? -bet : bet
      });
 
      // Logros
      const logrosMe  = [
        ...checkLogros(userId,    'duels_played', 1),
        ...(iWon ? checkLogros(userId,    'duels_won', 1) : []),
        ...(iWon ? checkLogros(userId,    'arena_win', 1) : []),
        ...checkLogros(userId,    'elo_reached', user.elo),
      ];
      const logrosOpp = [
        ...checkLogros(target.id, 'duels_played', 1),
        ...(!iWon ? checkLogros(target.id, 'duels_won', 1) : []),
        ...(!iWon ? checkLogros(target.id, 'arena_win', 1) : []),
        ...checkLogros(target.id, 'elo_reached', data[target.id].elo),
      ];
 
      saveData();
 
      const newMyTier  = getEloTier(user.elo);
      const newOppTier = getEloTier(data[target.id].elo);
 
      // Embed de resultado
      await challengeMsg.edit({
        content: iWon
          ? `🏆 <@${userId}> ¡ganaste el duelo y te llevas **${(bet * 2).toLocaleString()} 💰**!`
          : `🏆 <@${target.id}> ¡ganaste el duelo y te llevas **${(bet * 2).toLocaleString()} 💰**!`,
        embeds: [{
          color: iWon ? 0x00C851 : 0xFF4444,
          author: {
            name: '⚔️ Resultado del Duelo',
            icon_url: message.author.displayAvatarURL({ dynamic: true })
          },
          title: `${myClub}  ${myG} — ${oppG}  ${oppClub}`,
          description: iWon
            ? `🏆 **${myClub}** gana el duelo`
            : `🏆 **${oppClub}** gana el duelo`,
          fields: [
            {
              name: `🏠 ${myClub} (${myG} goles)`,
              value: myGoalLog.join('\n') || '_Sin goles_',
              inline: true
            },
            {
              name: `✈️ ${oppClub} (${oppG} goles)`,
              value: oppGoalLog.join('\n') || '_Sin goles_',
              inline: true
            },
            {
              name: '💰 Monedas',
              value: [
                `🏆 <@${winner}> **+${(bet * 2).toLocaleString()} 💰**`,
                `💸 <@${loser}> **-${bet.toLocaleString()} 💰**`,
              ].join('\n'),
              inline: false
            },
            {
              name: '📊 ELO',
              value: [
                `${newMyTier.emoji} <@${userId}>: ${oldMyE} → **${user.elo}** (${myEloDiff >= 0 ? '+' : ''}${myEloDiff})`,
                `${newOppTier.emoji} <@${target.id}>: ${oldOppE} → **${data[target.id].elo}** (${oppEloDiff >= 0 ? '+' : ''}${oppEloDiff})`,
              ].join('\n'),
              inline: false
            }
          ],
          footer: { text: '⚔️ Duelo  ·  Cooldown 5 min  ·  !duelo @usuario <apuesta> para otro' },
          timestamp: new Date().toISOString()
        }],
        components: []
      }).catch(() => {});
 
      // Anunciar logros desbloqueados
      await announceLogros(message, logrosMe);
      await announceLogros(message, logrosOpp);
    }
  });
 
  duelCol.on('end', (_, reason) => {
    if (reason === 'time') {
      challengeMsg.edit({
        content: null,
        embeds: [{
          color: 0x555555,
          title: '⏱️ Duelo expirado',
          description: `**${target.username}** no respondió a tiempo. No se descontaron monedas.`
        }],
        components: []
      }).catch(() => {});
    }
  });
 
  return;
}

  // ─────────────────────────────────────────
  // 🔄 SWAP
  // ─────────────────────────────────────────
if (cmd === '.swap') {
    if (!user.team || user.team.length < 2) return message.reply('❌ You need at least 2 players in your team.');
    const posEmoji = { GK:'🧤', DM:'🛡️', AM:'🎯', ST:'⚽' };

    function buildSwapEmbed(selected) {
      const fields = user.team.map(p => ({
        name: `${selected === p.name ? '▶ ' : ''}${posEmoji[p.position]||'👤'} ${p.position}`,
        value: `**${p.name}** · ${p.rating} OVR`,
        inline: true
      }));
      return { embeds:[{ color: selected ? 0xFF6B00 : 0x5865F2,
        title: selected ? `🔄 Swap · You selected **${selected}** — choose the target` : '🔄 Swap · Choose the first player',
        fields, footer:{ text:'Swap positions in the lineup' } }] };
    }

    function buildSwapRow(selected) {
      return new ActionRowBuilder().addComponents(
        user.team.map((p, idx) => new ButtonBuilder()
          .setCustomId(`swap_${idx}_${userId}`)
          .setLabel(`${posEmoji[p.position]||''} ${p.name} (${p.position})`)
          .setStyle(selected === p.name ? ButtonStyle.Danger : ButtonStyle.Primary)
        )
      );
    }

    let swapSelected = null;
    const swapMsg = await message.reply({ ...buildSwapEmbed(null), components:[buildSwapRow(null)] });
    const collector = swapMsg.createMessageComponentCollector({ time:30000 });

    collector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content:'❌ This panel is not yours.', ephemeral:true });
      const clickedIdx = parseInt(interaction.customId.replace(`swap_`, '').replace(`_${userId}`, ''));
      const clickedPlayer = user.team[clickedIdx];
      if (!clickedPlayer) return;
      const clickedName = clickedPlayer.name;

      if (!swapSelected) {
        swapSelected = clickedName;
        await interaction.update({ ...buildSwapEmbed(swapSelected), components:[buildSwapRow(swapSelected)] });
      } else if (swapSelected === clickedName) {
        swapSelected = null;
        await interaction.update({ ...buildSwapEmbed(null), components:[buildSwapRow(null)] });
      } else {
        const idxA = user.team.findIndex(p => p.name === swapSelected);
        const idxB = user.team.findIndex(p => p.name === clickedName);
        if (idxA !== -1 && idxB !== -1) {
          const tmp = deepCopyPlayer(user.team[idxA]);
          user.team[idxA] = deepCopyPlayer(user.team[idxB]);
          user.team[idxB] = tmp;
          saveData();
          collector.stop('done');
          await interaction.update({ embeds:[{ color:0x00C851, title:'✅ Swap completed',
            description:`**${swapSelected}** ↔ **${clickedName}**`, footer:{text:'Use !team to view your team'} }], components:[] });
        }
      }
    });

    collector.on('end', (_,reason) => { if(reason !== 'done') swapMsg.edit({ components:[] }).catch(()=>{}); });
    return;
  }
  // ─────────────────────────────────────────
  // 🟢 VIEW TEAM
  // ─────────────────────────────────────────
  if (cmd === '.team') {
    async function buildTeamCanvas(teamData, authorUsername) {
      const canvas = createCanvas(620, 860);
      const ctx = canvas.getContext('2d');

      try {
        const bg = await loadImage('./assets/cancha.png');
        ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
      } catch {
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#0d5c1e'); grad.addColorStop(.5, '#1a8a2e'); grad.addColorStop(1, '#0d5c1e');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#ffffff33'; ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
        ctx.beginPath(); ctx.moveTo(40, canvas.height/2); ctx.lineTo(canvas.width-40, canvas.height/2); ctx.stroke();
        ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2, 60, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = '#00000055'; ctx.fillRect(0, 0, canvas.width, canvas.height);

      // ── Fixed slots by index: 0=GK, 1=DM, 2=AM, 3=ST ──
      // The canvas places the player according to their POSITION in the array,
      // never based on p.position attribute. This way swap works correctly.
      const slotPositions = [
        { label: 'GK', x: 230, y: 600 },
        { label: 'DM', x: 230, y: 370 },
        { label: 'AM', x:  50, y: 100 },
        { label: 'ST', x: 410, y: 100 },
      ];

      for (let i = 0; i < 4; i++) {
        const slot = slotPositions[i];
        const p = (teamData || [])[i];
        if (p) await drawCard(ctx, slot.x, slot.y, p);
        else drawEmptySlot(ctx, slot.x, slot.y, slot.label);
      }

      const clubName = user.teamName || authorUsername + "'s FC";
      const avg = teamData && teamData.length > 0 ? Math.round(teamData.reduce((s,p)=>s+p.rating,0)/teamData.length) : 0;
      const teamRating = teamData && teamData.length > 0 ? Math.round(calculateTeam(teamData)) : 0;
      const HH = 68;
      const hGrad = ctx.createLinearGradient(0, 0, 0, HH);
      hGrad.addColorStop(0, '#000000f0'); hGrad.addColorStop(1, '#000000b0');
      ctx.fillStyle = hGrad; ctx.fillRect(0, 0, canvas.width, HH);
      const lineGrad = ctx.createLinearGradient(0, HH-2, canvas.width, HH-2);
      lineGrad.addColorStop(0, '#FFD70000'); lineGrad.addColorStop(.3, '#FFD700cc');
      lineGrad.addColorStop(.7, '#FFD700cc'); lineGrad.addColorStop(1, '#FFD70000');
      ctx.fillStyle = lineGrad; ctx.fillRect(0, HH-2, canvas.width, 2);
      const colW = canvas.width / 5;
      ctx.strokeStyle = '#ffffff20'; ctx.lineWidth = 1;
      for (let ci = 1; ci < 5; ci++) { ctx.beginPath(); ctx.moveTo(colW*ci, 8); ctx.lineTo(colW*ci, HH-8); ctx.stroke(); }

      function drawHeaderCol(colIndex, label, value, valueColor) {
        const cx = colW*colIndex + colW/2; ctx.textAlign = 'center';
        ctx.font = `bold 9px ${FIFA_FONT}`; ctx.fillStyle = '#888888'; ctx.fillText(label.toUpperCase(), cx, 18);
        ctx.font = `bold 24px ${FIFA_FONT}`; ctx.fillStyle = valueColor || '#ffffff';
        ctx.shadowColor = valueColor ? valueColor+'66' : '#00000066'; ctx.shadowBlur = 6;
        ctx.fillText(value, cx, 52); ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.textAlign = 'left';
      }

      // ── Column 0: logo + player name ──
      const displayUser = authorUsername.length>10 ? authorUsername.substring(0,9)+'…' : authorUsername;
      const logoBuffer = user.clubLogo ? Buffer.from(user.clubLogo, 'base64') : null;
      if (logoBuffer) {
        await drawClubLogo(ctx, logoBuffer, colW * 0 + 18, HH / 2, 18);
        ctx.textAlign = 'center';
        ctx.font = `bold 9px ${FIFA_FONT}`; ctx.fillStyle = '#888888';
        ctx.fillText('PLAYER', colW * 0 + colW / 2, 18);
        ctx.font = `bold 18px ${FIFA_FONT}`; ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD70066'; ctx.shadowBlur = 6;
        ctx.fillText(displayUser, colW * 0 + colW / 2 + 10, 52);
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.textAlign = 'left';
      } else {
        drawHeaderCol(0, 'player', displayUser, '#FFD700');
      }

      drawHeaderCol(1, 'OVR Value', `${teamData&&teamData.length>0?teamData.reduce((s,p)=>s+p.rating,0):0}.0`, '#ffffff');
      const clubDisplay = clubName.length>13 ? clubName.substring(0,12)+'…' : clubName;
      ctx.textAlign='center'; ctx.font=`bold 9px ${FIFA_FONT}`; ctx.fillStyle='#888888'; ctx.fillText('CLUB',colW*2+colW/2,18);
      ctx.font=`bold ${clubDisplay.length>9?15:20}px ${FIFA_FONT}`; ctx.fillStyle='#ffffff';
      ctx.shadowColor='#ffffff33'; ctx.shadowBlur=4; ctx.fillText(clubDisplay,colW*2+colW/2,52); ctx.shadowBlur=0; ctx.shadowColor='transparent'; ctx.textAlign='left';
      drawHeaderCol(3, 'OVR Rating', avg ? String(avg*10+teamRating) : '—', '#ffffff');
      const hasFullTeam = teamData && teamData.length === 4;
      const chemColor = !hasFullTeam?'#555555':teamRating>=80?'#00ff88':teamRating>=60?'#FFD700':'#ff4444';
      const chemCx = colW*4+colW/2;
      ctx.textAlign='center'; ctx.font=`bold 9px ${FIFA_FONT}`; ctx.fillStyle='#888888'; ctx.fillText('CHEMISTRY',chemCx,18);
      ctx.save(); ctx.shadowColor=chemColor; ctx.shadowBlur=18;
      ctx.beginPath(); ctx.arc(chemCx,42,13,0,Math.PI*2); ctx.fillStyle=chemColor+'33'; ctx.fill(); ctx.restore();
      ctx.beginPath(); ctx.arc(chemCx,42,10,0,Math.PI*2); ctx.fillStyle=chemColor; ctx.fill();
      ctx.textAlign='left';
      return canvas;
    }

    function buildTeamButtons(uid) {
      return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`team_add_${uid}`).setLabel('➕ Add player').setStyle(ButtonStyle.Success).setDisabled(user.team.length>=4),
        new ButtonBuilder().setCustomId(`team_remove_${uid}`).setLabel('➖ Remove player').setStyle(ButtonStyle.Danger).setDisabled(user.team.length===0),
        new ButtonBuilder().setCustomId(`team_swap_${uid}`).setLabel('🔄 Swap position').setStyle(ButtonStyle.Primary).setDisabled(user.team.length<2),
        new ButtonBuilder().setCustomId(`team_refresh_${uid}`).setLabel('🔃 Refresh').setStyle(ButtonStyle.Secondary)
      )];
    }

    function buildTeamEmbed() {
      const clubName = user.teamName || message.author.username+"'s FC";
      // Fixed slot labels for the embed, same as the canvas
      const slotLabels = ['GK','DM','AM','ST'];
      const posEmoji={GK:'🧤',DM:'🛡️',AM:'🎯',ST:'⚽'};
      const rarityEmoji={"Icon":"⚪", "WorldCup":"🔴", "Legendary":"🟡","Epic":"🟣","Rare":"🔵","Common":"⚪"};
      const teamInfo=(user.team||[]).map((p,i)=>{
        const slotLabel = slotLabels[i] || '?';
        return `${posEmoji[slotLabel]||'👤'} ${rarityEmoji[p.rarity]||'⚫'} **${p.name}** · ${p.rating} OVR · ${p.position} _(slot ${slotLabel})_`;
      }).join('\n')||'_Empty team_';
      const avg=user.team.length>0?Math.round(user.team.reduce((s,p)=>s+p.rating,0)/user.team.length):0;
      const chemistry=user.team.length===4?Math.round(calculateTeam(user.team)):'—';
      return { embeds:[{ color:0x00C851, author:{name:`🏟️ ${clubName}`,icon_url:message.author.displayAvatarURL({dynamic:true})}, title:`📋 ${message.author.username}'s Team`, description:teamInfo, fields:[
        {name:'⭐ Avg OVR',value:`${avg}`,inline:true},{name:'⚗️ Team Rating',value:`${chemistry}`,inline:true},{name:'👥 Players',value:`${user.team.length}/4`,inline:true},
        {name:'💰 Coins',value:`${user.coins}`,inline:true},{name:'📊 ELO',value:`${user.elo||1000}`,inline:true},{name:'🎒 In squad',value:`${(user.players||[]).length}/${MAX_CLUB_SIZE}`,inline:true},
      ], footer:{text:'Use the buttons to manage your team • 60s timeout'}, timestamp:new Date().toISOString() }] };
    }

    const initialCanvas = await buildTeamCanvas(user.team, message.author.username);
    const teamMsg = await message.reply({ ...buildTeamEmbed(), files:[{attachment:initialCanvas.toBuffer(),name:'team.png'}], components:buildTeamButtons(userId) });
    const teamCollector = teamMsg.createMessageComponentCollector({ time:60000 });

    teamCollector.on('collect', async interaction => {
      if (interaction.user.id!==userId) return interaction.reply({content:'❌ This panel is not yours.',ephemeral:true});

      if (interaction.customId===`team_refresh_${userId}`) {
        const c=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({...buildTeamEmbed(),files:[{attachment:c.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`team_add_${userId}`) {
        const available=(user.players||[]).filter(p=>!user.team.some(t=>t.name===p.name));
        if (!available.length) return interaction.reply({content:'❌ You have no available players to add.',ephemeral:true});
        if (user.team.length>=4) return interaction.reply({content:'❌ Your team already has 4 players.',ephemeral:true});
        const posEmoji={GK:'🧤',DM:'🛡️',AM:'🎯',ST:'⚽'};
        const rarityEmoji={"Legendary":"🟡","Epic":"🟣","Rare":"🔵","Common":"⚪"};
        const addRows=[];
        for (let i=0;i<Math.min(available.length,16);i+=4) {
          addRows.push(new ActionRowBuilder().addComponents(
            available.slice(i,i+4).map(p=>new ButtonBuilder().setCustomId(`teamadd_pick_${p.name}_${userId}`).setLabel(`${posEmoji[p.position]||'👤'} ${p.name} (${p.rating})`).setStyle(p.rarity==='Legendary'||p.rarity==='Epic'?ButtonStyle.Primary:ButtonStyle.Secondary))
          ));
        }
        addRows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`teamadd_cancel_${userId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)));
        return interaction.update({ embeds:[{color:0x00C851,title:'➕ Select a player to add',description:available.slice(0,16).map(p=>`${posEmoji[p.position]||'👤'} ${rarityEmoji[p.rarity]||'⚫'} **${p.name}** · ${p.rating} OVR · ${p.position} · ${p.rarity}`).join('\n'),footer:{text:`${user.team.length}/4 in team`}}], files:[], components:addRows });
      }
      if (interaction.customId.startsWith('teamadd_pick_')&&interaction.customId.endsWith(`_${userId}`)) {
        const rawName=interaction.customId.replace('teamadd_pick_','').replace(`_${userId}`,'');
        const playerToAdd=(user.players||[]).find(p=>p.name===rawName);
        if (!playerToAdd) return interaction.reply({content:'❌ Player not found.',ephemeral:true});
        if (user.team.length>=4) return interaction.reply({content:'❌ Your team is already full.',ephemeral:true});
        if (user.team.some(p=>p.name===rawName)) return interaction.reply({content:`❌ **${rawName}** is already in the team.`,ephemeral:true});
        user.team.push(deepCopyPlayer(playerToAdd)); saveData();
        const nc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({content:`✅ **${playerToAdd.name}** added! (${user.team.length}/4)`,...buildTeamEmbed(),files:[{attachment:nc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`teamadd_cancel_${userId}`) {
        const cc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({...buildTeamEmbed(),files:[{attachment:cc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`team_remove_${userId}`) {
        if (!user.team.length) return interaction.reply({content:'❌ Your team is empty.',ephemeral:true});
        const posEmoji={GK:'🧤',DM:'🛡️',AM:'🎯',ST:'⚽'};
        const slotLabels=['GK','DM','AM','ST'];
        const removeRows=[];
        for (let i=0;i<user.team.length;i+=4) {
          removeRows.push(new ActionRowBuilder().addComponents(
            user.team.slice(i,i+4).map((p,j)=>{
              const slotLabel=slotLabels[i+j]||'?';
              return new ButtonBuilder().setCustomId(`teamrem_pick_${p.name}_${userId}`).setLabel(`${posEmoji[slotLabel]||'👤'} ${p.name} (${p.rating})`).setStyle(ButtonStyle.Danger);
            })
          ));
        }
        removeRows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`teamrem_cancel_${userId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)));
        return interaction.update({ embeds:[{color:0xFF4444,title:'➖ Select a player to remove',description:user.team.map((p,i)=>`${posEmoji[slotLabels[i]]||'👤'} **${p.name}** · ${p.rating} OVR · slot ${slotLabels[i]}`).join('\n'),footer:{text:'The player returns to your squad'}}], files:[], components:removeRows });
      }
      if (interaction.customId.startsWith('teamrem_pick_')&&interaction.customId.endsWith(`_${userId}`)) {
        const rawName=interaction.customId.replace('teamrem_pick_','').replace(`_${userId}`,'');
        const idx=user.team.findIndex(p=>p.name===rawName);
        if (idx===-1) return interaction.reply({content:'❌ Player not found.',ephemeral:true});
        user.team.splice(idx,1); saveData();
        const nc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({content:`✅ **${rawName}** removed from the team.`,...buildTeamEmbed(),files:[{attachment:nc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`teamrem_cancel_${userId}`) {
        const cc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({...buildTeamEmbed(),files:[{attachment:cc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`team_swap_${userId}`) {
        if (user.team.length<2) return interaction.reply({content:'❌ You need at least 2 players.',ephemeral:true});
        const slotLabels=['GK','DM','AM','ST'];
        const posEmoji={GK:'🧤',DM:'🛡️',AM:'🎯',ST:'⚽'};
        const swapRows=[];
        for (let i=0;i<user.team.length;i+=4) {
          swapRows.push(new ActionRowBuilder().addComponents(
            user.team.slice(i,i+4).map((p,j)=>new ButtonBuilder()
              .setCustomId(`teamswap1_${i+j}_${userId}`)
              .setLabel(`${posEmoji[slotLabels[i+j]]||'👤'} ${p.name} (slot ${slotLabels[i+j]||'?'})`)
              .setStyle(ButtonStyle.Primary))
          ));
        }
        swapRows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`teamswap_cancel_${userId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)));
        return interaction.update({ embeds:[{color:0x5865F2,title:'🔄 Swap · Choose the FIRST player',description:user.team.map((p,i)=>`${posEmoji[slotLabels[i]]||'👤'} **${p.name}** in slot **${slotLabels[i]}** (actual position: ${p.position})`).join('\n'),footer:{text:'Swap players between slots'}}], files:[], components:swapRows });
      }
      if (interaction.customId.startsWith('teamswap1_')&&interaction.customId.endsWith(`_${userId}`)) {
        const firstIdx=parseInt(interaction.customId.replace('teamswap1_','').replace(`_${userId}`,''));
        const firstPlayer=user.team[firstIdx];
        if (!firstPlayer) return;
        const slotLabels=['GK','DM','AM','ST'];
        const posEmoji={GK:'🧤',DM:'🛡️',AM:'🎯',ST:'⚽'};
        const swapRows2=[];
        const others=user.team.map((p,i)=>({p,i})).filter(({i})=>i!==firstIdx);
        for (let i=0;i<others.length;i+=4) {
          swapRows2.push(new ActionRowBuilder().addComponents(
            others.slice(i,i+4).map(({p,i:origIdx})=>new ButtonBuilder()
              .setCustomId(`teamswap2_${firstIdx}_${origIdx}_${userId}`)
              .setLabel(`${posEmoji[slotLabels[origIdx]]||'👤'} ${p.name} (slot ${slotLabels[origIdx]||'?'})`)
              .setStyle(ButtonStyle.Danger))
          ));
        }
        swapRows2.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`teamswap_cancel_${userId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)));
        return interaction.update({ embeds:[{color:0xFF6B00,title:`🔄 Swap · You selected **${firstPlayer.name}** (slot ${slotLabels[firstIdx]}) — choose the SECOND`,description:user.team.map((p,i)=>`${posEmoji[slotLabels[i]]||'👤'} **${p.name}** in slot **${slotLabels[i]}**`).join('\n')}], files:[], components:swapRows2 });
      }
      if (interaction.customId.startsWith('teamswap2_')&&interaction.customId.endsWith(`_${userId}`)) {
        const parts=interaction.customId.replace('teamswap2_','').replace(`_${userId}`,'').split('_');
        const idxA=parseInt(parts[0]); const idxB=parseInt(parts[1]);
        if (isNaN(idxA)||isNaN(idxB)||!user.team[idxA]||!user.team[idxB]) return interaction.reply({content:'❌ Error performing swap.',ephemeral:true});
        const nameA=user.team[idxA].name; const nameB=user.team[idxB].name;
        // ✅ Swaps players in the array, never touches p.position
        const tmp=deepCopyPlayer(user.team[idxA]); user.team[idxA]=deepCopyPlayer(user.team[idxB]); user.team[idxB]=tmp; saveData();
        const sc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({content:`✅ Swap: **${nameA}** ↔ **${nameB}**`,...buildTeamEmbed(),files:[{attachment:sc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`teamswap_cancel_${userId}`) {
        const cc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({...buildTeamEmbed(),files:[{attachment:cc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
    });
    teamCollector.on('end', () => teamMsg.edit({components:[]}).catch(()=>{}));
    return;
  }

  // ─────────────────────────────────────────
  // 💸 VENDER → va al market dinámico
  // ─────────────────────────────────────────
 if (cmd === '.sell') {
    const sub = args.slice(1);
    if (!sub.length) return message.reply(
      '❌ Usage: `.sell <name> [price]`\n' +
      '💡 Minimum price by rarity:\n' +
      '• Common: **500** 💰 · Rare: **2,500** 💰 · Epic: **7,500** 💰 · Legendary: **17,000** · Icon: **100,000** 💰\n' +
      '• If no price is set, it will be listed at the minimum automatically.\n' +
      '• Cards expire from the market in **24h** and return to your club.'
    );

    // Detect if the first token is a price (number)
    let nombre = '', precio = null;
    const lastToken = sub[sub.length - 1];
    if (!isNaN(lastToken) && sub.length > 1) {
      precio = parseInt(lastToken);
      nombre = sub.slice(0, -1).join(' ');
    } else {
      nombre = sub.join(' ');
    }

    if (!nombre) return message.reply('❌ Invalid player name.');

    // Find player in the club (not in the active team)
    const playerIdx = user.players.findIndex(p => p.name.toLowerCase() === nombre.toLowerCase());
    if (playerIdx === -1) return message.reply(`❌ You don't have **${nombre}** in your club.\n💡 Use \`.club\` to view your squad.`);

    const playerToSell = user.players[playerIdx];
    const minPrice = MARKET_MIN_PRICE[playerToSell.rarity] || 500;

    // Validate price
    if (precio === null) {
      precio = minPrice; // automatic minimum price
    } else {
      if (isNaN(precio) || precio < minPrice) {
        return message.reply(
          `❌ The minimum price for a **${playerToSell.rarity}** card is **${minPrice.toLocaleString()} 💰**.\n` +
          `💡 Use \`.sell ${playerToSell.name} ${minPrice}\` to list it at the minimum.`
        );
      }
    }

    // Check that the user doesn't already have too many listings (max 5)
    const myListings = marketListings.filter(l => l.sellerId === userId);
    if (myListings.length >= 5) {
      return message.reply('❌ You have **5 cards** on the market. Wait for them to sell or expire (24h) before listing more.');
    }

    // Remove from club and active team
    user.players.splice(playerIdx, 1);
    user.team = user.team.filter(p => p.name !== playerToSell.name);

    // Create listing
    const listingId = `${userId}_${Date.now()}`;
    const listing = {
      id: listingId,
      sellerId: userId,
      sellerName: message.author.username,
      player: playerToSell,
      price: precio,
      listedAt: Date.now()
    };
    marketListings.push(listing);
    saveMarket();
    saveData();

    const _lSell = checkLogros(userId, 'cards_sold', 1);
    await announceLogros(message, _lSell);

    // ── Quest progress ──
    progressQuest(userId, 'card_sold', 1);
    if (['Epic', 'Legendary', 'WorldCup'].includes(playerToSell.rarity)) {
      progressQuest(userId, 'epic_sold', 1);
    }

    const hoursLeft = 24;
    const rarityColors = { 'Legendary': 0xFFD700, 'Epic': 0x9B59B6, 'Rare': 0x5B9BD5, 'Common': 0x8B7355 };

    return message.reply({
      embeds: [{
        color: rarityColors[playerToSell.rarity] || 0x00C851,
        author: { name: `🏪 Listed on the Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `${playerToSell.name} — ${playerToSell.rarity} · ${playerToSell.rating} OVR`,
        description: [
          `**Position:** ${playerToSell.position}`,
          `**Price:** **${precio.toLocaleString()} 💰**`,
          ``,
          `✅ The card has been listed on the market.`,
          `⏱️ Expires in **${hoursLeft}h** — if unsold, it returns to your club.`,
          ``,
          `💡 Other players can buy it with \`.market ${playerToSell.name}\`.`,
        ].join('\n'),
        fields: [
          { name: '🏟️ Club remaining', value: `${user.players.length}/${MAX_CLUB_SIZE}`, inline: true },
          { name: '💳 Current balance', value: `${user.coins.toLocaleString()} 💰`, inline: true },
          { name: '📋 My listings',     value: `${myListings.length + 1}/5`, inline: true },
        ],
        footer: { text: `Listing ID: ${listingId}  ·  Use !market to see all players for sale` },
        timestamp: new Date().toISOString()
      }]
    });
  }

  // ─────────────────────────────────────────
  // CANCEL ❌
  // ─────────────────────────────────────────

  if (cmd === '.cancel') {
    // Find the user's listings
    const myListings = marketListings.filter(l => l.sellerId === userId);

    if (myListings.length === 0) {
      return message.reply({
        embeds: [{
          color: 0xFF6600,
          title: '📋 No active listings',
          description: 'You have no cards listed on the market right now.\n\nUse `.sell <name> [price]` to list a card.',
          footer: { text: 'Use !market to view the full catalog' }
        }]
      });
    }

    const rarityColors = { 'Icon': '0xC0C0C0', 'WorldCup': '0xCC2200', 'Legendary': 0xFFD700, 'Epic': 0x9B59B6, 'Rare': 0x5B9BD5, 'Common': 0x8B7355 };
    const rarityEmoji  = { "Icon": "⭐", "WorldCup": "🏆", "Legendary": "👑", "Epic": "💜", "Rare": "💙", "Common": "⚪" };
    const posEmoji     = { GK: '🧤', DM: '🛡️', AM: '🎯', ST: '⚽' };

    // Build buttons (one button per listing, max 5)
    const cancelRow = new ActionRowBuilder().addComponents(
      myListings.slice(0, 5).map((l, i) =>
        new ButtonBuilder()
          .setCustomId(`cancel_listing_${i}_${userId}`)
          .setLabel(`${rarityEmoji[l.player.rarity]} ${l.player.name} — ${l.price.toLocaleString()} 💰`)
          .setStyle(ButtonStyle.Danger)
      )
    );

    const now = Date.now();
    const lines = myListings.map((l, i) => {
      const msLeft = MARKET_LISTING_TTL - (now - l.listedAt);
      const hh = Math.max(0, Math.floor(msLeft / 3600000));
      const mm = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
      return `**${i + 1}.** ${posEmoji[l.player.position] || '👤'} ${rarityEmoji[l.player.rarity]} **${l.player.name}** · ${l.player.rarity} · ${l.player.rating} OVR\n💰 Price: **${l.price.toLocaleString()}** · ⏱️ Expires in ${hh}h ${mm}m`;
    }).join('\n\n');

    const cancelMsg = await message.reply({
      embeds: [{
        color: 0xFF6600,
        author: { name: `📋 My market listings · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `You have ${myListings.length} card(s) listed`,
        description: lines + '\n\n⚠️ Press the button of the card you want to **remove from the market**.\nThe card will return to your club immediately.',
        footer: { text: 'Unsold listings return automatically after 24h' },
        timestamp: new Date().toISOString()
      }],
      components: [cancelRow]
    });

    const cancelCol = cancelMsg.createMessageComponentCollector({ time: 60000 });
    cancelCol.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This panel is not yours.', ephemeral: true });

      const parts = interaction.customId.replace('cancel_listing_', '').replace(`_${userId}`, '').split('_');
      const idx = parseInt(parts[0]);
      const myCurrentListings = marketListings.filter(l => l.sellerId === userId);
      const listing = myCurrentListings[idx];

      if (!listing) return interaction.reply({ content: '❌ That listing no longer exists. It may have expired or been sold.', ephemeral: true });

      // Return card to club
      if (!user.players) user.players = [];
      user.players.push({ ...listing.player });

      // Remove from market
      marketListings = marketListings.filter(l => l.id !== listing.id);
      saveMarket();
      saveData();

      cancelCol.stop();
      await interaction.update({
        embeds: [{
          color: 0x00C851,
          author: { name: `✅ Listing cancelled · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${listing.player.name} is back in your club`,
          description: [
            `**${listing.player.name}** (${listing.player.rarity} · ${listing.player.rating} OVR · ${listing.player.position}) has been removed from the market.`,
            ``,
            `The card is back in your club. You can view it with \`.club\` or add it to your team with \`.add ${listing.player.name}\`.`,
          ].join('\n'),
          fields: [
            { name: '🏟️ Club', value: `${user.players.length}/${MAX_CLUB_SIZE}`, inline: true },
            { name: '📋 Remaining listings', value: `${marketListings.filter(l => l.sellerId === userId).length}/5`, inline: true },
          ],
          footer: { text: 'Use !sell <name> [price] to list it again' },
          timestamp: new Date().toISOString()
        }],
        components: []
      });
    });

    cancelCol.on('end', (_, reason) => {
      if (reason !== 'idle' && reason !== 'user') cancelMsg.edit({ components: [] }).catch(() => {});
    });

    return;
  }


// ─────────────────────────────────────────
// 🔄 TRADE — Intercambio de cartas entre jugadores
// ─────────────────────────────────────────
if (cmd === '.trade') {
  const target = message.mentions.users.first();
  if (!target) return message.reply('❌ Usage: `.trade @user <your card> for <their card>`\nEx: `.trade @Luntek Veil for Compass`');
  if (target.id === userId) return message.reply('❌ You cannot trade with yourself.');
  if (target.bot) return message.reply('❌ You cannot trade with a bot.');

  // Parse arguments: !trade @user MyCard for TheirCard
  const mentionStr = args[1]; // the @mention
  const restArgs = args.slice(2).join(' '); // "MyCard for TheirCard"
  const splitByFor = restArgs.split(/\s+for\s+/i);
  if (splitByFor.length < 2) {
    return message.reply(
      '❌ Incorrect format.\n' +
      '✅ Usage: `.trade @user <your card> for <their card>`\n' +
      'Ex: `.trade @Luntek Veil for Compass`'
    );
  }

  const myCardName  = splitByFor[0].trim();
  const hisCardName = splitByFor[1].trim();

  if (!myCardName || !hisCardName)
    return message.reply('❌ You must specify both cards.');

  // Search in clubs
  const myCardIdx  = (user.players || []).findIndex(p => p.name.toLowerCase() === myCardName.toLowerCase());
  if (myCardIdx === -1)
    return message.reply(`❌ You don't have **${myCardName}** in your club.\nUse \`.club\` to view your squad.`);

  if (!data[target.id])
    return message.reply('❌ That user does not have a registered profile yet.');

  const oppData = data[target.id];
  const hisCardIdx = (oppData.players || []).findIndex(p => p.name.toLowerCase() === hisCardName.toLowerCase());
  if (hisCardIdx === -1)
    return message.reply(`❌ **${target.username}** doesn't have **${hisCardName}** in their club.`);

  const myCard  = user.players[myCardIdx];
  const hisCard = oppData.players[hisCardIdx];

  // Validate same rarity
  if (myCard.rarity !== hisCard.rarity) {
    return message.reply({
      embeds: [{
        color: 0xFF4444,
        title: '❌ Incompatible rarity',
        description: [
          `Cards must have the **same rarity** to be traded.`,
          ``,
          `🃏 **${myCard.name}** — ${myCard.rarity}`,
          `🃏 **${hisCard.name}** — ${hisCard.rarity}`,
          ``,
          `💡 You can only trade cards of the same rarity. Ex: Epic with Epic.`,
        ].join('\n'),
      }]
    });
  }

  // Verify space in clubs (shouldn't be an issue since it's 1x1, but just in case)
  const rarityColors = { 'Legendary': 0xFFD700, 'Epic': 0x9B59B6, 'Rare': 0x5B9BD5, 'Common': 0x8B7355 };
  const rarityEmoji  = { "Legendary": "👑", "Epic": "💜", "Rare": "💙", "Common": "⚪" };
  const posEmoji     = { GK: '🧤', DM: '🛡️', AM: '🎯', ST: '⚽' };

  // Generate images for both cards
  let myCardCanvas = null, hisCardCanvas = null;
  try { myCardCanvas  = await drawShowcaseCard(myCard);  } catch(e) {}
  try { hisCardCanvas = await drawShowcaseCard(hisCard); } catch(e) {}

  // Confirmation embed for the INITIATOR
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`trade_confirm_${userId}_${target.id}`)
      .setLabel('✅ Send proposal')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`trade_cancel_${userId}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  const myCardStats  = Object.entries(myCard.stats  || {}).map(([k,v]) => `${k}: **${v}**`).join(' · ');
  const hisCardStats = Object.entries(hisCard.stats || {}).map(([k,v]) => `${k}: **${v}**`).join(' · ');

  const proposalEmbed = {
    color: 0x5865F2,
    author: { name: `🔄 Trade — ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
    title: `${myCard.name} ↔ ${hisCard.name}`,
    description: [
      `Do you confirm sending this trade proposal to <@${target.id}>?`,
      ``,
      `🏠 **You offer:** ${rarityEmoji[myCard.rarity]} **${myCard.name}** · ${myCard.rating} OVR · ${myCard.position} · ${myCard.rarity}`,
      `${myCardStats}`,
      ``,
      `✈️ **You request:** ${rarityEmoji[hisCard.rarity]} **${hisCard.name}** · ${hisCard.rating} OVR · ${hisCard.position} · ${hisCard.rarity}`,
      `${hisCardStats}`,
    ].join('\n'),
    fields: [
      { name: '⚖️ Rarity', value: `Both cards are **${myCard.rarity}** ✅`, inline: true },
      { name: '⏱️ Timeout', value: '**120 seconds** for them to accept', inline: true },
    ],
    footer: { text: 'The other player will receive a notification to accept or reject' },
    timestamp: new Date().toISOString()
  };

  const confirmFiles = [];
  if (myCardCanvas) confirmFiles.push({ attachment: myCardCanvas.toBuffer(), name: 'my-card.png' });

  const confirmMsg = await message.reply({
    embeds: [{ ...proposalEmbed, image: myCardCanvas ? { url: 'attachment://my-card.png' } : undefined }],
    files: confirmFiles,
    components: [confirmRow]
  });

  const initCollector = confirmMsg.createMessageComponentCollector({ time: 60000 });
  initCollector.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ This proposal is not yours.', ephemeral: true });

    if (interaction.customId === `trade_cancel_${userId}`) {
      initCollector.stop();
      return interaction.update({
        embeds: [{ color: 0x555555, title: '❌ Trade cancelled', description: 'You cancelled the trade proposal.' }],
        files: [], components: []
      });
    }

    if (interaction.customId === `trade_confirm_${userId}_${target.id}`) {
      initCollector.stop();

      // Re-validate that both still have the cards
      const stillMyCard  = (user.players || []).find(p => p.name.toLowerCase() === myCard.name.toLowerCase());
      const stillHisCard = (oppData.players || []).find(p => p.name.toLowerCase() === hisCard.name.toLowerCase());

      if (!stillMyCard || !stillHisCard) {
        return interaction.update({
          embeds: [{ color: 0xFF4444, title: '❌ Invalid trade', description: 'One of the cards is no longer available.' }],
          files: [], components: []
        });
      }

      await interaction.update({
        embeds: [{
          color: 0xFFAA00,
          title: '⏳ Proposal sent...',
          description: `Waiting for <@${target.id}>'s response...\n\n⏱️ They have **120 seconds** to accept or reject.`,
        }],
        files: [], components: []
      });

      // Notify the other player
      const acceptRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade_accept_${userId}_${target.id}`)
          .setLabel('✅ Accept trade')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade_reject_${userId}_${target.id}`)
          .setLabel('❌ Reject')
          .setStyle(ButtonStyle.Danger)
      );

      const hisCardFiles = [];
      if (hisCardCanvas) hisCardFiles.push({ attachment: hisCardCanvas.toBuffer(), name: 'his-card.png' });

      const tradeNotif = await message.channel.send({
        content: `<@${target.id}> you have a trade proposal from <@${userId}>!`,
        embeds: [{
          color: 0x5865F2,
          author: { name: `🔄 Trade received from ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${myCard.name} ↔ ${hisCard.name}`,
          description: [
            `**${message.author.username}** wants your card and offers theirs in return:`,
            ``,
            `✈️ **They want:** ${rarityEmoji[hisCard.rarity]} **${hisCard.name}** · ${hisCard.rating} OVR · ${hisCard.position} · ${hisCard.rarity}`,
            `${hisCardStats}`,
            ``,
            `🏠 **They offer:** ${rarityEmoji[myCard.rarity]} **${myCard.name}** · ${myCard.rating} OVR · ${myCard.position} · ${myCard.rarity}`,
            `${myCardStats}`,
            ``,
            `⚖️ Both cards are **${myCard.rating} OVR**`,
          ].join('\n'),
          image: hisCardCanvas ? { url: 'attachment://his-card.png' } : undefined,
          footer: { text: '⏱️ You have 120 seconds to respond' },
          timestamp: new Date().toISOString()
        }],
        files: hisCardFiles,
        components: [acceptRow]
      });

      const rivalCollector = tradeNotif.createMessageComponentCollector({ time: 120000 });
      rivalCollector.on('collect', async rivalInteraction => {
        if (rivalInteraction.user.id !== target.id) {
          return rivalInteraction.reply({ content: '❌ This proposal is not for you.', ephemeral: true });
        }

        rivalCollector.stop();

        if (rivalInteraction.customId === `trade_reject_${userId}_${target.id}`) {
          await rivalInteraction.update({
            embeds: [{ color: 0xFF4444, title: '❌ Trade rejected', description: `**${target.username}** rejected the proposal.` }],
            files: [], components: []
          });
          // Notify the initiator
          await confirmMsg.edit({
            embeds: [{ color: 0xFF4444, title: '❌ Trade rejected', description: `<@${target.id}> rejected your trade proposal.\n\nYour card **${myCard.name}** is still in your club.` }],
            files: [], components: []
          }).catch(() => {});
          return;
        }

        if (rivalInteraction.customId === `trade_accept_${userId}_${target.id}`) {
          // Re-validate one last time before executing
          const finalMyIdx  = (user.players || []).findIndex(p => p.name.toLowerCase() === myCard.name.toLowerCase());
          const finalHisIdx = (oppData.players || []).findIndex(p => p.name.toLowerCase() === hisCard.name.toLowerCase());

          if (finalMyIdx === -1 || finalHisIdx === -1) {
            return rivalInteraction.update({
              embeds: [{ color: 0xFF4444, title: '❌ Invalid trade', description: 'One of the cards is no longer available (it was sold or transferred).' }],
              files: [], components: []
            });
          }

          // ── EXECUTE THE TRADE ──
          const tradedMyCard  = { ...user.players[finalMyIdx] };
          const tradedHisCard = { ...oppData.players[finalHisIdx] };

          // Remove from each club
          user.players.splice(finalMyIdx, 1);
          oppData.players.splice(finalHisIdx, 1);

          // Add to the other club
          user.players.push({ ...tradedHisCard });
          oppData.players.push({ ...tradedMyCard });

          // Update active teams if any card was in the team
          const myTeamIdx  = (user.team || []).findIndex(p => p.name.toLowerCase() === tradedMyCard.name.toLowerCase());
          const hisTeamIdx = (oppData.team || []).findIndex(p => p.name.toLowerCase() === tradedHisCard.name.toLowerCase());

          if (myTeamIdx !== -1)  user.team.splice(myTeamIdx, 1);
          if (hisTeamIdx !== -1) oppData.team.splice(hisTeamIdx, 1);

          saveData();

          // Final images
          let finalMyCanvas = null, finalHisCanvas = null;
          try { finalMyCanvas  = await drawShowcaseCard(tradedHisCard); } catch(e) {}
          try { finalHisCanvas = await drawShowcaseCard(tradedMyCard);  } catch(e) {}

          // Update rival's notification
          const rivalFiles = finalHisCanvas
            ? [{ attachment: finalHisCanvas.toBuffer(), name: 'traded-card.png' }]
            : [];

          await rivalInteraction.update({
            embeds: [{
              color: 0x00C851,
              author: { name: `✅ Trade completed` },
              title: `You received ${tradedMyCard.name}!`,
              description: [
                `The trade was completed successfully.`,
                ``,
                `📥 **Received:** ${rarityEmoji[tradedMyCard.rarity]} **${tradedMyCard.name}** · ${tradedMyCard.rating} OVR · ${tradedMyCard.position} · ${tradedMyCard.rarity}`,
                `📤 **Given away:** ${rarityEmoji[tradedHisCard.rarity]} **${tradedHisCard.name}** · ${tradedHisCard.rating} OVR`,
                ``,
                `Use \`.club\` to view your updated squad.`,
              ].join('\n'),
              image: finalHisCanvas ? { url: 'attachment://traded-card.png' } : undefined,
              footer: { text: `Club: ${oppData.players.length}/${MAX_CLUB_SIZE} players` },
              timestamp: new Date().toISOString()
            }],
            files: rivalFiles,
            components: []
          });

          // Update initiator's message
          const initiatorFiles = finalMyCanvas
            ? [{ attachment: finalMyCanvas.toBuffer(), name: 'received-card.png' }]
            : [];

          await confirmMsg.edit({
            embeds: [{
              color: 0x00C851,
              author: { name: `✅ Trade completed` },
              title: `You received ${tradedHisCard.name}!`,
              description: [
                `<@${target.id}> accepted the trade.`,
                ``,
                `📥 **Received:** ${rarityEmoji[tradedHisCard.rarity]} **${tradedHisCard.name}** · ${tradedHisCard.rating} OVR · ${tradedHisCard.position} · ${tradedHisCard.rarity}`,
                `📤 **Given away:** ${rarityEmoji[tradedMyCard.rarity]} **${tradedMyCard.name}** · ${tradedMyCard.rating} OVR`,
                ``,
                `Use \`.club\` to view your updated squad.`,
              ].join('\n'),
              image: finalMyCanvas ? { url: 'attachment://received-card.png' } : undefined,
              footer: { text: `Club: ${user.players.length}/${MAX_CLUB_SIZE} players` },
              timestamp: new Date().toISOString()
            }],
            files: initiatorFiles,
            components: []
          }).catch(() => {});
        }
      });

      rivalCollector.on('end', (_, reason) => {
        if (reason === 'time') {
          tradeNotif.edit({
            embeds: [{ color: 0x555555, title: '⏱️ Trade expired', description: `They did not respond in time. The trade was cancelled.` }],
            files: [], components: []
          }).catch(() => {});
          confirmMsg.edit({
            embeds: [{ color: 0x555555, title: '⏱️ Trade expired', description: `<@${target.id}> did not respond in time.` }],
            files: [], components: []
          }).catch(() => {});
        }
      });
    }
  });

  initCollector.on('end', (_, reason) => {
    if (reason === 'time') {
      confirmMsg.edit({
        embeds: [{ color: 0x555555, title: '⏱️ Trade expired', description: 'You did not confirm the proposal in time.' }],
        files: [], components: []
      }).catch(() => {});
    }
  });

  return;
}

// ─────────────────────────────────────────
  // 🏪 MERCADO — Compra directa de jugadores
  // ─────────────────────────────────────────
  if (cmd === '.market') {
    const playerName = args.slice(1).join(' ').trim();

    // Clean expired listings before displaying
    const now = Date.now();
    const expired = marketListings.filter(l => now - l.listedAt > MARKET_LISTING_TTL);
    for (const ex of expired) {
      if (data[ex.sellerId]) {
        if (!data[ex.sellerId].players) data[ex.sellerId].players = [];
        data[ex.sellerId].players.push(ex.player);
      }
    }
    if (expired.length > 0) {
      marketListings = marketListings.filter(l => now - l.listedAt <= MARKET_LISTING_TTL);
      saveMarket();
      saveData();
    }

    // ── No argument → paginated catalog ──
    if (!playerName) {
      progressQuest(userId, 'market_visited', 1);
      if (marketListings.length === 0) {
        return message.reply({
          embeds: [{
            color: 0x1a1a2e,
            title: '🏪 Market — No listings',
            description: [
              '**There are no cards for sale right now.**',
              '',
              '💡 To sell a card use:',
              '`.sell <name> [price]`',
              '',
              '• The minimum price is the price of the corresponding pack.',
              '• Cards stay on the market for **24h**.',
            ].join('\n'),
            footer: { text: 'Be the first to list a card' }
          }]
        });
      }

      const PAGE_SIZE = 8;
      // Sort: cheapest first, then by rating descending
      const sorted = [...marketListings]
        .filter(l => l.price != null && l.player != null)
        .sort((a, b) => a.price - b.price);
      let mPage = 0;
      const totalPages = Math.ceil(sorted.length / PAGE_SIZE);

      async function buildMarketCanvas(page) {
        const W = 860, H = 120 + Math.min(PAGE_SIZE, sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).length) * 54 + 30;
        const FULL_H = 620;
        const canvas = createCanvas(W, FULL_H);
        const ctx = canvas.getContext('2d');

        // Background
        const bgGrad = ctx.createLinearGradient(0, 0, W, FULL_H);
        bgGrad.addColorStop(0, '#08080f');
        bgGrad.addColorStop(0.5, '#0e0e1c');
        bgGrad.addColorStop(1, '#08080f');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, FULL_H);

        // Decorative dots
        ctx.save();
        ctx.globalAlpha = 0.05;
        for (let x = 20; x < W; x += 28) {
          for (let y = 20; y < FULL_H; y += 28) {
            ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
          }
        }
        ctx.globalAlpha = 1; ctx.restore();

        // Header
        ctx.save();
        ctx.font = `bold 32px ${FIFA_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 18;
        ctx.fillText('  PLAYER MARKET', W / 2, 48);
        ctx.shadowBlur = 0;
        ctx.font = `13px ${FIFA_FONT}`;
        ctx.fillStyle = '#ffffff44';
        ctx.fillText(`${sorted.length} card${sorted.length !== 1 ? 's' : ''} for sale  ·  Page ${page + 1} / ${totalPages}  ·  !market <name> to buy`, W / 2, 68);
        ctx.restore();

        // Divider
        ctx.save();
        const lineGrad = ctx.createLinearGradient(40, 0, W - 40, 0);
        lineGrad.addColorStop(0, 'transparent');
        lineGrad.addColorStop(0.3, '#FFD700aa');
        lineGrad.addColorStop(0.7, '#FFD700aa');
        lineGrad.addColorStop(1, 'transparent');
        ctx.strokeStyle = lineGrad; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, 78); ctx.lineTo(W - 40, 78); ctx.stroke();
        ctx.restore();

        // Column headers
        const cols = { num: 42, name: 66, pos: 280, rarity: 360, ovr: 490, seller: 570, price: 700, ttl: 800 };
        ctx.save();
        ctx.font = `bold 11px ${FIFA_FONT}`;
        ctx.fillStyle = '#ffffff55';
        ctx.textAlign = 'left';
        ctx.fillText('#',       cols.num,    100);
        ctx.fillText('PLAYER',  cols.name,   100);
        ctx.fillText('POS',     cols.pos,    100);
        ctx.fillText('RARITY',  cols.rarity, 100);
        ctx.fillText('OVR',     cols.ovr,    100);
        ctx.fillText('SELLER',  cols.seller, 100);
        ctx.fillText('PRICE',   cols.price,  100);
        ctx.fillText('EXPIRES', cols.ttl,    100);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#ffffff15'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, 108); ctx.lineTo(W - 40, 108); ctx.stroke();
        ctx.restore();

        const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const rarityColor = { "Icon": '#FFFFFF', "WorldCup": '#CC2200', "Legendary": '#FFD700', "Epic": '#9B59B6', "Rare": '#5B9BD5', "Common": '#A0836A' };
        const rarityEmoji = { "Icon": '⭐', "WorldCup": '🏆', "Legendary": '👑', "Epic": '💜', "Rare": '💙', "Common": '⚪' };
        const posEmoji    = { GK: '🧤', DM: '🛡️', AM: '🎯', ST: '⚽' };

        slice.forEach((listing, i) => {
          const rowY = 118 + i * 54;
          const p = listing.player;
          const isMine = listing.sellerId === userId;
          const canAfford = listing.price != null && user.coins >= listing.price;
          const msLeft = MARKET_LISTING_TTL - (now - listing.listedAt);
          const hLeft  = Math.max(0, Math.floor(msLeft / 3600000));
          const mLeft  = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
          const ttlStr = hLeft > 0 ? `${hLeft}h ${mLeft}m` : `${mLeft}m`;

          // Row background
          ctx.save();
          ctx.fillStyle = isMine ? '#ffffff05' : (i % 2 === 0 ? '#ffffff08' : '#00000020');
          roundRectPath(ctx, 30, rowY - 2, W - 60, 48, 8);
          ctx.fill();
          ctx.restore();

          // Rarity bar
          ctx.save();
          ctx.fillStyle = rarityColor[p.rarity] || '#888888';
          ctx.globalAlpha = 0.8;
          roundRectPath(ctx, 30, rowY - 2, 4, 48, 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();

          // Number
          ctx.save();
          ctx.font = `11px ${FIFA_FONT}`;
          ctx.fillStyle = '#ffffff30';
          ctx.textAlign = 'right';
          ctx.fillText(`${page * PAGE_SIZE + i + 1}.`, cols.name - 6, rowY + 28);
          ctx.restore();

          // Name
          ctx.save();
          ctx.font = `bold 15px ${FIFA_FONT}`;
          ctx.fillStyle = isMine ? '#FFD70099' : '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(p.name + (isMine ? ' (yours)' : ''), cols.name, rowY + 28);
          ctx.restore();

          // Position
          ctx.save();
          ctx.font = `bold 12px ${FIFA_FONT}`;
          ctx.fillStyle = '#cccccc';
          ctx.fillText(`${posEmoji[p.position] || ''} ${p.position}`, cols.pos, rowY + 28);
          ctx.restore();

          // Rarity
          ctx.save();
          ctx.font = `bold 12px ${FIFA_FONT}`;
          ctx.fillStyle = rarityColor[p.rarity] || '#888888';
          ctx.shadowColor = rarityColor[p.rarity] || '#888888';
          ctx.shadowBlur = 6;
          ctx.fillText(`${rarityEmoji[p.rarity]} ${p.rarity}`, cols.rarity, rowY + 28);
          ctx.shadowBlur = 0;
          ctx.restore();

          // OVR
          ctx.save();
          ctx.font = `bold 16px ${FIFA_FONT}`;
          ctx.fillStyle = p.rating >= 90 ? '#FFD700' : p.rating >= 80 ? '#ffffff' : '#aaaaaa';
          ctx.fillText(String(p.rating), cols.ovr, rowY + 28);
          ctx.restore();

          // Seller
          ctx.save();
          ctx.font = `12px ${FIFA_FONT}`;
          ctx.fillStyle = isMine ? '#FFD70099' : '#aaaaaa';
          const sellerDisplay = listing.sellerName.length > 10 ? listing.sellerName.slice(0, 9) + '…' : listing.sellerName;
          ctx.fillText(sellerDisplay, cols.seller, rowY + 28);
          ctx.restore();

          // Price
          ctx.save();
          ctx.font = `bold 14px ${FIFA_FONT}`;
          ctx.fillStyle = isMine ? '#FFD700' : (canAfford ? '#00ff88' : '#ff4444');
          ctx.fillText(`${(listing.price ?? 0).toLocaleString()} 💰`, cols.price, rowY + 28);
          ctx.restore();

          // TTL
          ctx.save();
          ctx.font = `11px ${FIFA_FONT}`;
          ctx.fillStyle = hLeft < 2 ? '#ff6644' : '#888888';
          ctx.fillText(`⏱ ${ttlStr}`, cols.ttl, rowY + 28);
          ctx.restore();

          // Separator
          if (i < slice.length - 1) {
            ctx.save();
            ctx.strokeStyle = '#ffffff10'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(40, rowY + 46); ctx.lineTo(W - 40, rowY + 46); ctx.stroke();
            ctx.restore();
          }
        });

        // Footer
        ctx.save();
        ctx.font = `12px ${FIFA_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff25';
        ctx.fillText(`💰 Your balance: ${user.coins.toLocaleString()} coins  ·  Use !sell <name> [price] to list`, W / 2, FULL_H - 14);
        ctx.restore();

        return canvas;
      }

      function buildNavRow(uid, page) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`mkt_prev_${uid}`).setLabel('◀ Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
          new ButtonBuilder().setCustomId(`mkt_page_${uid}`).setLabel(`${page + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`mkt_next_${uid}`).setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
          new ButtonBuilder().setCustomId(`mkt_mylistings_${uid}`).setLabel('📋 My listings').setStyle(ButtonStyle.Secondary)
        );
      }

      const canvas0 = await buildMarketCanvas(mPage);
      const mktMsg = await message.reply({
        embeds: [{
          color: 0x1a1a2e,
          author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          image: { url: 'attachment://market.png' },
          footer: { text: `.market <name> to buy directly · !sell <name> [price] to sell` },
          timestamp: new Date().toISOString()
        }],
        files: [{ attachment: canvas0.toBuffer(), name: 'market.png' }],
        components: [buildNavRow(userId, mPage)]
      });

      const col = mktMsg.createMessageComponentCollector({ time: 120000 });
      col.on('collect', async interaction => {
        if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This market panel is not yours.', ephemeral: true });

        if (interaction.customId === `mkt_mylistings_${userId}`) {
          const mine = marketListings.filter(l => l.sellerId === userId && l.price != null && l.player != null);
          if (!mine.length) return interaction.reply({ content: '❌ You have no cards listed on the market right now.', ephemeral: true });
          const lines = mine.map((l, i) => {
            const msLeft = MARKET_LISTING_TTL - (Date.now() - l.listedAt);
            const hh = Math.max(0, Math.floor(msLeft / 3600000));
            const mm = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
            return `${i + 1}. **${l.player.name}** · ${l.player.rarity} · **${l.price.toLocaleString()} 💰** · expires in ${hh}h ${mm}m`;
          }).join('\n');
          return interaction.reply({
            embeds: [{
              color: 0xFFD700,
              title: `📋 Your market listings (${mine.length}/5)`,
              description: lines,
              footer: { text: 'Cards return to your club if they expire unsold' }
            }],
            ephemeral: true
          });
        }

        if (interaction.customId === `mkt_next_${userId}` && mPage < totalPages - 1) mPage++;
        if (interaction.customId === `mkt_prev_${userId}` && mPage > 0) mPage--;

        const nc = await buildMarketCanvas(mPage);
        await interaction.update({
          embeds: [{
            color: 0x1a1a2e,
            author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
            image: { url: 'attachment://market.png' },
            footer: { text: `.market <name> to buy directly · !sell <name> [price] to sell` },
            timestamp: new Date().toISOString()
          }],
          files: [{ attachment: nc.toBuffer(), name: 'market.png' }],
          components: [buildNavRow(userId, mPage)]
        });
      });
      col.on('end', () => mktMsg.edit({ components: [] }).catch(() => {}));
      return;
    }

    // ── With argument → buy from dynamic market ──
    // Find listings matching the name (there may be several, show the cheapest)
    const matches = marketListings
      .filter(l => l.player.name.toLowerCase() === playerName.toLowerCase() && l.sellerId !== userId)
      .sort((a, b) => a.price - b.price);

    const myOwnListings = marketListings.filter(
      l => l.player.name.toLowerCase() === playerName.toLowerCase() && l.sellerId === userId
    );

    if (matches.length === 0 && myOwnListings.length === 0) {
      return message.reply({
        embeds: [{
          color: 0xFF4444,
          title: '❌ Not found on the market',
          description: [
            `There are no **${playerName}** cards for sale right now.`,
            '',
            '💡 Use `.market` to see all available cards.',
            '💡 Use `.sell <name> [price]` to list yours.',
          ].join('\n')
        }]
      });
    }

    if (myOwnListings.length > 0 && matches.length === 0) {
      return message.reply({
        embeds: [{
          color: 0xFF6600,
          title: '⚠️ This is your own card',
          description: `You have **${myOwnListings.length}** card(s) of **${myOwnListings[0].player.name}** on the market but you cannot buy from yourself.\n\nThe cards will expire and return to your club if nobody buys them.`
        }]
      });
    }

    const rarityColors = { 'Icon': 0xC0C0C0, 'WorldCup': 0xCC2200, 'Legendary': 0xFFD700, 'Epic': 0x9B59B6, 'Rare': 0x5B9BD5, 'Common': 0x8B7355 };
    const rarityEmoji  = { "Icon": '⭐ ICON', "WorldCup": '🏆 WORLD CUP', "Legendary": '👑 LEGENDARY', "Epic": '💜 EPIC', "Rare": '💙 RARE', "Common": '⚪ COMMON' };

    // ── If there is one listing, go directly to confirmation ──
    // ── If there are several, show seller selector ──

    async function showListingConfirm(listing) {
      const p = listing.player;
      const canAfford = listing.price != null && user.coins >= listing.price;
      const clubFull  = (user.players || []).length >= MAX_CLUB_SIZE;
      const msLeft    = MARKET_LISTING_TTL - (now - listing.listedAt);
      const hLeft     = Math.max(0, Math.floor(msLeft / 3600000));
      const mLeft     = Math.max(0, Math.floor((msLeft % 3600000) / 60000));

      let showcaseCanvas = null;
      try { showcaseCanvas = await drawShowcaseCard(p); } catch (e) {}

      const stats = p.stats || {};
      const statLines = Object.entries(stats).map(([k, v]) => {
        const dot = v >= 88 ? '🟢' : v >= 75 ? '🟡' : v >= 60 ? '🟠' : '🔴';
        return `${dot} **${k}** · **${v}**`;
      }).join('  ·  ');

      let descExtra = '';
      if (clubFull)        descExtra = `\n\n❌ **Your club is full (${MAX_CLUB_SIZE}/${MAX_CLUB_SIZE}).** Sell players first.`;
      else if (!canAfford) descExtra = `\n\n❌ **Not enough coins.** You need **${(listing.price - user.coins).toLocaleString()} 💰** more.`;
      else                 descExtra = `\n\n✅ **You can buy this.** You'll have **${(user.coins - listing.price).toLocaleString()} 💰** left.`;

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mktbuy_confirm_${userId}_${listing.id}`)
          .setLabel(`✅ Buy — ${listing.price.toLocaleString()} 💰`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(!canAfford || clubFull),
        new ButtonBuilder()
          .setCustomId(`mktbuy_cancel_${userId}`)
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`mktbuy_back_${userId}`)
          .setLabel('⬅️ Back')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(matches.length <= 1)
      );

      return {
        content: null,
        embeds: [{
          color: rarityColors[p.rarity] || 0x1a1a2e,
          author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${rarityEmoji[p.rarity]}  ·  ${p.name}  ·  ${p.rating} OVR`,
          description: `**Position:** ${p.position}  ·  **Rarity:** ${p.rarity}\n\n${statLines}${descExtra}`,
          fields: [
            { name: '💸 Price',         value: `**${listing.price.toLocaleString()}** 💰`,      inline: true },
            { name: '💰 Your balance',  value: `**${user.coins.toLocaleString()}** 💰`,          inline: true },
            { name: '👤 Seller',        value: `@${listing.sellerName}`,                          inline: true },
            { name: '⏱️ Expires in',   value: `${hLeft}h ${mLeft}m`,                             inline: true },
            { name: '🏟️ Your club',    value: `${(user.players || []).length}/${MAX_CLUB_SIZE}`, inline: true },
            { name: '📋 Available',     value: `${matches.length} listing(s)`,                    inline: true },
          ],
          image: showcaseCanvas ? { url: 'attachment://mkt-card.png' } : undefined,
          footer: { text: '⏱️ You have 60 seconds to confirm' },
          timestamp: new Date().toISOString()
        }],
        files: showcaseCanvas ? [{ attachment: showcaseCanvas.toBuffer(), name: 'mkt-card.png' }] : [],
        components: [confirmRow]
      };
    }

    // ── If multiple listings, show selector first ──
    let selectedListing = matches[0];

    if (matches.length > 1) {
      // Show list of all available sellers with buttons
      const selectorRows = [];
      for (let i = 0; i < Math.min(matches.length, 5); i += 5) {
        const chunk = matches.slice(i, i + 5);
        selectorRows.push(new ActionRowBuilder().addComponents(
          chunk.map((l, idx) => {
            const msL = MARKET_LISTING_TTL - (now - l.listedAt);
            const hL  = Math.max(0, Math.floor(msL / 3600000));
            const mL  = Math.max(0, Math.floor((msL % 3600000) / 60000));
            const canAffordThis = user.coins >= l.price;
            return new ButtonBuilder()
              .setCustomId(`mktsel_${userId}_${l.id}`)
              .setLabel(`@${l.sellerName} — ${l.price.toLocaleString()} 💰`)
              .setStyle(canAffordThis ? ButtonStyle.Success : ButtonStyle.Secondary);
          })
        ));
      }
      selectorRows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mktsel_cancel_${userId}`)
          .setLabel('❌ Cancel')
          .setStyle(ButtonStyle.Danger)
      ));

      const listLines = matches.slice(0, 5).map((l, i) => {
        const msL = MARKET_LISTING_TTL - (now - l.listedAt);
        const hL  = Math.max(0, Math.floor(msL / 3600000));
        const mL  = Math.max(0, Math.floor((msL % 3600000) / 60000));
        const canAffordThis = user.coins >= l.price;
        const icon = canAffordThis ? '✅' : '❌';
        return `${icon} **${i + 1}.** @${l.sellerName} — **${l.price.toLocaleString()} 💰** · expires in ${hL}h ${mL}m`;
      }).join('\n');

      const selectorMsg = await message.reply({
        embeds: [{
          color: rarityColors[matches[0].player.rarity] || 0x1a1a2e,
          author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${matches[0].player.name} — ${matches[0].player.rarity} · ${matches[0].player.rating} OVR`,
          description: `There are **${matches.length}** listing(s) available. Choose which seller to buy from:\n\n${listLines}${matches.length > 5 ? `\n_...and ${matches.length - 5} more_` : ''}`,
          fields: [
            { name: '💰 Your balance', value: `**${user.coins.toLocaleString()}** 💰`, inline: true },
            { name: '🏟️ Your club',   value: `${(user.players || []).length}/${MAX_CLUB_SIZE}`, inline: true },
          ],
          footer: { text: 'Select the seller you want to buy from' },
          timestamp: new Date().toISOString()
        }],
        components: selectorRows
      });

      const selCol = selectorMsg.createMessageComponentCollector({ time: 60000 });
      selCol.on('collect', async interaction => {
        if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This panel is not yours.', ephemeral: true });

        if (interaction.customId === `mktsel_cancel_${userId}`) {
          selCol.stop();
          return interaction.update({
            embeds: [{ color: 0x555555, title: '❌ Purchase cancelled', description: `You cancelled the purchase of **${matches[0].player.name}**.` }],
            files: [], components: []
          });
        }

        // Find selected listing
        const listingId = interaction.customId.replace(`mktsel_${userId}_`, '');
        const chosenListing = matches.find(l => l.id === listingId);
        if (!chosenListing) return interaction.reply({ content: '❌ That listing no longer exists.', ephemeral: true });

        selectedListing = chosenListing;
        selCol.stop();

        // Show purchase confirmation
        const confirmData = await showListingConfirm(selectedListing);
        await interaction.update(confirmData);

        // Collector for confirmation
        const buyCol2 = selectorMsg.createMessageComponentCollector({ time: 60000 });
        buyCol2.on('collect', async btn => {
          if (btn.user.id !== userId) return btn.reply({ content: '❌ This panel is not yours.', ephemeral: true });

          if (btn.customId === `mktbuy_cancel_${userId}`) {
            buyCol2.stop();
            return btn.update({ embeds: [{ color: 0x555555, title: '❌ Purchase cancelled', description: `You cancelled the purchase of **${selectedListing.player.name}**.` }], files: [], components: [] });
          }

          if (btn.customId === `mktbuy_back_${userId}`) {
            buyCol2.stop();
            // Go back to selector
            await btn.update({
              embeds: [{
                color: rarityColors[matches[0].player.rarity] || 0x1a1a2e,
                author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
                title: `${matches[0].player.name} — ${matches[0].player.rarity} · ${matches[0].player.rating} OVR`,
                description: `There are **${matches.length}** listing(s) available. Choose which seller to buy from:\n\n${listLines}${matches.length > 5 ? `\n_...and ${matches.length - 5} more_` : ''}`,
                fields: [
                  { name: '💰 Your balance', value: `**${user.coins.toLocaleString()}** 💰`, inline: true },
                  { name: '🏟️ Your club',   value: `${(user.players || []).length}/${MAX_CLUB_SIZE}`, inline: true },
                ],
                footer: { text: 'Select the seller you want to buy from' },
                timestamp: new Date().toISOString()
              }],
              files: [],
              components: selectorRows
            });
            // Re-launch selector
            const selCol2 = selectorMsg.createMessageComponentCollector({ time: 60000 });
            selCol2.on('collect', async i2 => {
              if (i2.user.id !== userId) return i2.reply({ content: '❌', ephemeral: true });
              if (i2.customId === `mktsel_cancel_${userId}`) {
                selCol2.stop();
                return i2.update({ embeds: [{ color: 0x555555, title: '❌ Cancelled' }], files: [], components: [] });
              }
              const lid2 = i2.customId.replace(`mktsel_${userId}_`, '');
              const chosen2 = matches.find(l => l.id === lid2);
              if (!chosen2) return i2.reply({ content: '❌ No longer exists.', ephemeral: true });
              selectedListing = chosen2;
              selCol2.stop();
              const cd2 = await showListingConfirm(selectedListing);
              await i2.update(cd2);
            });
            selCol2.on('end', () => selectorMsg.edit({ components: [] }).catch(() => {}));
            return;
          }

          if (btn.customId === `mktbuy_confirm_${userId}_${selectedListing.id}`) {
            await executePurchase(btn, selectorMsg, selectedListing);
            buyCol2.stop();
          }
        });
        buyCol2.on('end', (_, reason) => { if (reason === 'time') selectorMsg.edit({ components: [] }).catch(() => {}); });
      });
      selCol.on('end', (_, reason) => { if (reason === 'time') selectorMsg.edit({ components: [] }).catch(() => {}); });

    } else {
      // Single listing — original behavior
      const confirmData = await showListingConfirm(matches[0]);
      const buyMsg = await message.reply(confirmData);

      const buyCol = buyMsg.createMessageComponentCollector({ time: 60000 });
      buyCol.on('collect', async interaction => {
        if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This panel is not yours.', ephemeral: true });
        if (interaction.customId === `mktbuy_cancel_${userId}`) {
          buyCol.stop();
          return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Purchase cancelled', description: `You cancelled the purchase of **${matches[0].player.name}**.` }], files: [], components: [] });
        }
        if (interaction.customId === `mktbuy_confirm_${userId}_${matches[0].id}`) {
          await executePurchase(interaction, buyMsg, matches[0]);
          buyCol.stop();
        }
      });
      buyCol.on('end', (_, reason) => { if (reason === 'time') buyMsg.edit({ components: [] }).catch(() => {}); });
    }

    // ── Reusable function to execute the purchase ──
    async function executePurchase(interaction, msgRef, listing) {
      const p = listing.player;
      const stillThere = marketListings.find(l => l.id === listing.id);
      if (!stillThere) return interaction.update({ embeds: [{ color: 0xFF4444, title: '❌ No longer available', description: 'This card has already been sold or expired.' }], files: [], components: [] });
      if (user.coins < listing.price) return interaction.update({ embeds: [{ color: 0xFF4444, title: '❌ Not enough coins', description: 'You no longer have enough coins.' }], files: [], components: [] });
      if ((user.players || []).length >= MAX_CLUB_SIZE) return interaction.update({ embeds: [{ color: 0xFF4444, title: '❌ Club full', description: 'Your club is full.' }], files: [], components: [] });

      user.coins -= listing.price;
      user.players.push({ ...p });
      if (data[listing.sellerId]) {
        data[listing.sellerId].coins = (data[listing.sellerId].coins || 0) + listing.price;
      }
      marketListings = marketListings.filter(l => l.id !== listing.id);
      saveMarket();
      saveData();

      try {
        const seller = await client.users.fetch(listing.sellerId);
        if (seller) {
          seller.send({ embeds: [{ color: 0x00C851, title: '💸 Your card was sold!', description: `**${p.name}** was bought by **@${message.author.username}**.\n\n💰 You received **+${listing.price.toLocaleString()} 💰**.`, footer: { text: 'Use !bal to check your balance' } }] }).catch(() => {});
        }
      } catch (e) {}

      let finalCanvas = null;
      try { finalCanvas = await drawShowcaseCard({ ...p }); } catch (e) {}

      const postRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mktpost_add_${userId}_${p.name}`).setLabel('➕ Add to team').setStyle(ButtonStyle.Success).setDisabled((user.team || []).length >= 4),
        new ButtonBuilder().setCustomId(`mktpost_sell_${userId}`).setLabel('💸 Sell again').setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({
        content: `🎉 **${p.name}** is yours!`,
        embeds: [{
          color: rarityColors[p.rarity] || 0x00C851,
          author: { name: `✅ Purchase successful · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${p.name} — ${p.rarity}  ·  ${p.rating} OVR`,
          description: `**Position:** ${p.position}  ·  Bought from @${listing.sellerName}`,
          fields: [
            { name: '💸 You paid',       value: `**${listing.price.toLocaleString()}** 💰`, inline: true },
            { name: '💰 New balance',    value: `**${user.coins.toLocaleString()}** 💰`,     inline: true },
            { name: '🏟️ Club',          value: `**${user.players.length}/${MAX_CLUB_SIZE}**`, inline: true },
          ],
          image: finalCanvas ? { url: 'attachment://bought.png' } : undefined,
          footer: { text: 'Add it to your team or sell it again!' },
          timestamp: new Date().toISOString()
        }],
        files: finalCanvas ? [{ attachment: finalCanvas.toBuffer(), name: 'bought.png' }] : [],
        components: [postRow]
      });

      const postCol = msgRef.createMessageComponentCollector({ time: 60000 });
      postCol.on('collect', async btn => {
        if (btn.user.id !== userId) return btn.reply({ content: '❌ This panel is not yours.', ephemeral: true });
        if (btn.customId === `mktpost_add_${userId}_${p.name}`) {
          if ((user.team || []).length >= 4) return btn.reply({ content: '❌ Team is full.', ephemeral: true });
          if ((user.team || []).some(t => t.name === p.name)) return btn.reply({ content: `❌ **${p.name}** is already in your team.`, ephemeral: true });
          user.team.push({ ...p }); saveData();
          return btn.update({ content: `✅ **${p.name}** added to the team! (${user.team.length}/4)`, components: [] });
        }
        if (btn.customId === `mktpost_sell_${userId}`) {
          return btn.reply({ content: `💡 Use \`.sell ${p.name} <price>\` to list it again.`, ephemeral: true });
        }
      });
      postCol.on('end', () => msgRef.edit({ components: [] }).catch(() => {}));
    }

    return;
  }


  // ─────────────────────────────────────────
  // 🤝 FRIENDLY
  // ─────────────────────────────────────────
  

// ─────────────────────────────────────────
// 👥 CLAN
// ─────────────────────────────────────────
if (cmd === '.clan') {
  const sub = (args[1] || '').toLowerCase();

  // ── !clan create <name> ──
  if (sub === 'create') {
    const nombre = args.slice(2).join(' ').trim();
    if (!nombre) return message.reply('❌ Usage: `.clan create <name>`\nEx: `.clan create The Cracks`');
    if (nombre.length > 24) return message.reply('❌ The clan name cannot exceed 24 characters.');
    if (getClanOfUser(userId)) return message.reply('❌ You already belong to a clan. Use `.clan leave` before creating a new one.');
    const yaExiste = Object.values(clansData).find(c => c.name.toLowerCase() === nombre.toLowerCase());
    if (yaExiste) return message.reply(`❌ A clan named **${nombre}** already exists. Choose another name.`);
    if (user.coins < CLAN_CREATE_COST) return message.reply(`❌ Creating a clan costs **${CLAN_CREATE_COST} 💰**. You have **${user.coins.toLocaleString()} 💰**.`);

    user.coins -= CLAN_CREATE_COST;
    const clanId = `C${Date.now().toString(36).toUpperCase()}`;
    clansData[clanId] = {
      id: clanId,
      name: nombre,
      leaderId: userId,
      members: [userId],
      createdAt: Date.now(),
      warWins: 0,
      warLosses: 0,
      lastWar: 0,
      description: '',
      invites: [],
      elo: 1000,
    };
    saveClans();
    saveData();

    return message.reply({
      embeds: [{
        color: 0xFFD700,
        author: { name: `👥 Clan created by ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `🏰 ${nombre}`,
        description: [
          `Your clan was created successfully!`,
          ``,
          `💸 Cost: **${CLAN_CREATE_COST} 💰**`,
          `💰 Remaining balance: **${user.coins.toLocaleString()} 💰**`,
          ``,
          `**Clan commands:**`,
          `\`.clan invite @user\` — Invite members`,
          `\`.clan info\` — View your clan`,
          `\`.clan war\` — Start a war`,
        ].join('\n'),
        fields: [
          { name: '👑 Leader', value: `<@${userId}>`, inline: true },
          { name: '👥 Members', value: `1/${CLAN_MAX_MEMBERS}`, inline: true },
          { name: '🆔 ID', value: clanId, inline: true },
        ],
        footer: { text: 'Invite up to 9 more players with !clan invite @user' },
        timestamp: new Date().toISOString()
      }]
    });
  }

  // ── !clan invite @user ──
  if (sub === 'invite') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Usage: `.clan invite @user`');
    if (target.bot) return message.reply('❌ You cannot invite a bot.');
    if (target.id === userId) return message.reply('❌ You cannot invite yourself.');

    const myClanId = getClanIdOfUser(userId);
    const myClan = myClanId ? clansData[myClanId] : null;
    if (!myClan) return message.reply('❌ You do not belong to any clan. Create one with `.clan create <name>`.');
    if (myClan.leaderId !== userId) return message.reply('❌ Only the **leader** of the clan can invite members.');
    if (myClan.members.length >= CLAN_MAX_MEMBERS) return message.reply(`❌ Your clan is full (**${CLAN_MAX_MEMBERS}/${CLAN_MAX_MEMBERS}** members).`);
    if (getClanOfUser(target.id)) return message.reply(`❌ **${target.username}** already belongs to a clan.`);
    if (myClan.invites.includes(target.id)) return message.reply(`❌ You already sent an invitation to **${target.username}**.`);

    myClan.invites.push(target.id);
    saveClans();

    const acceptRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`clan_accept_${myClanId}_${target.id}`)
        .setLabel('✅ Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`clan_reject_${myClanId}_${target.id}`)
        .setLabel('❌ Decline')
        .setStyle(ButtonStyle.Danger)
    );

    const clanTier = getEloTier(myClan.elo || 1000);

    const inviteMsg = await message.reply({
      content: `<@${target.id}> you have an invitation to the clan **${myClan.name}**!`,
      embeds: [{
        color: 0x5865F2,
        author: { name: `👥 Clan invitation — ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `🏰 ${myClan.name}`,
        description: [
          `**${message.author.username}** is inviting you to join their clan.`,
          ``,
          `👥 Members: **${myClan.members.length}/${CLAN_MAX_MEMBERS}**`,
          `⚔️ Wars won: **${myClan.warWins}**`,
          `📊 Clan ELO: ${clanTier.emoji} **${myClan.elo || 1000}**`,
        ].join('\n'),
        footer: { text: '⏱️ You have 120 seconds to respond' },
        timestamp: new Date().toISOString()
      }],
      components: [acceptRow]
    });

    const invCol = inviteMsg.createMessageComponentCollector({ time: 120000 });
    invCol.on('collect', async interaction => {
      if (interaction.user.id !== target.id)
        return interaction.reply({ content: '❌ This invitation is not for you.', ephemeral: true });

      invCol.stop();
      const clan = clansData[myClanId];
      clan.invites = clan.invites.filter(id => id !== target.id);

      if (interaction.customId === `clan_reject_${myClanId}_${target.id}`) {
        saveClans();
        return interaction.update({
          content: null,
          embeds: [{ color: 0xFF4444, title: '❌ Invitation declined', description: `**${target.username}** declined the invitation to clan **${clan.name}**.` }],
          components: []
        });
      }

      if (interaction.customId === `clan_accept_${myClanId}_${target.id}`) {
        if (getClanOfUser(target.id)) {
          saveClans();
          return interaction.update({
            content: null,
            embeds: [{ color: 0xFF4444, title: '❌ Already in a clan', description: `**${target.username}** already belongs to another clan.` }],
            components: []
          });
        }
        if (clan.members.length >= CLAN_MAX_MEMBERS) {
          saveClans();
          return interaction.update({
            content: null,
            embeds: [{ color: 0xFF4444, title: '❌ Clan full', description: `The clan **${clan.name}** is already full.` }],
            components: []
          });
        }

        clan.members.push(target.id);
        saveClans();

        return interaction.update({
          content: null,
          embeds: [{
            color: 0x00C851,
            title: `✅ ${target.username} joined ${clan.name}!`,
            description: [
              `<@${target.id}> is now a member of **${clan.name}**.`,
              ``,
              `👥 Members: **${clan.members.length}/${CLAN_MAX_MEMBERS}**`,
            ].join('\n'),
            footer: { text: 'Use !clan info to see the full clan' },
            timestamp: new Date().toISOString()
          }],
          components: []
        });
      }
    });

    invCol.on('end', (_, reason) => {
      if (reason === 'time') {
        const clan = clansData[myClanId];
        if (clan) clan.invites = clan.invites.filter(id => id !== target.id);
        saveClans();
        inviteMsg.edit({ components: [] }).catch(() => {});
      }
    });
    return;
  }

  // ── !clan info [name] ──
  if (sub === 'info' || sub === '') {
    let targetClan = null;
    let targetClanId = null;

    if (args[2]) {
      const searchName = args.slice(2).join(' ').toLowerCase();
      targetClanId = Object.keys(clansData).find(k => clansData[k].name.toLowerCase() === searchName);
      targetClan = targetClanId ? clansData[targetClanId] : null;
      if (!targetClan) return message.reply(`❌ No clan named **${args.slice(2).join(' ')}** exists.`);
    } else {
      targetClanId = getClanIdOfUser(userId);
      targetClan = targetClanId ? clansData[targetClanId] : null;
      if (!targetClan) return message.reply('❌ You do not belong to any clan.\n💡 Create one with `.clan create <name>` or ask to be invited.');
    }

    const memberLines = targetClan.members.map(mid => {
      const mData = data[mid];
      const tier = getEloTier(mData?.elo || 1000);
      const isLeader = mid === targetClan.leaderId;
      return `${isLeader ? '👑' : '👤'} <@${mid}> — ${tier.emoji} **${mData?.elo || 1000}** ELO`;
    }).join('\n');

    const totalElo = targetClan.members.reduce((s, id) => s + (data[id]?.elo || 1000), 0);
    const avgElo = Math.round(totalElo / targetClan.members.length);
    const clanTier = getEloTier(avgElo);
    const totalPlayers = targetClan.members.reduce((s, id) => s + (data[id]?.players || []).length, 0);

    return message.reply({
      embeds: [{
        color: 0xFFD700,
        author: { name: `👥 Clan Information` },
        title: `🏰 ${targetClan.name}`,
        description: targetClan.description || '_No description_',
        fields: [
          { name: '👥 Members', value: memberLines || '_No members_', inline: false },
          { name: '📊 Clan ELO', value: `${getEloTier(targetClan.elo || 1000).emoji} **${targetClan.elo || 1000}**`, inline: true },
          { name: '⚔️ Wars', value: `✅ ${targetClan.warWins}W · ❌ ${targetClan.warLosses}L`, inline: true },
          { name: '🃏 Total players', value: `**${totalPlayers}**`, inline: true },
          { name: '📅 Founded', value: `<t:${Math.floor(targetClan.createdAt / 1000)}:R>`, inline: true },
          { name: '🆔 ID', value: targetClanId, inline: true },
        ],
        footer: { text: `.clan war — Challenge  ·  !clan top — Clan ranking` },
        timestamp: new Date().toISOString()
      }]
    });
  }

  // ── !clan top ──
  if (sub === 'top') {
    const ranking = Object.entries(clansData)
      .map(([id, c]) => ({ id, clan: c, elo: c.elo || 1000 }))
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 10);

    if (!ranking.length) return message.reply('❌ No clans registered yet.');

    const medals = ['🥇', '🥈', '🥉'];
    const lines = ranking.map((r, i) => {
      const tier = getEloTier(r.elo);
      const num = i < 3 ? medals[i] : `**${i + 1}.**`;
      return `${num} **${r.clan.name}** — ${tier.emoji} **${r.elo}** ELO · ${r.clan.members.length} members · ✅${r.clan.warWins}W ❌${r.clan.warLosses}L`;
    }).join('\n');

    return message.reply({
      embeds: [{
        color: 0xFFD700,
        title: '🏆 Top 10 Clans — Total ELO',
        description: lines,
        footer: { text: '.clan info <name> to view clan details' },
        timestamp: new Date().toISOString()
      }]
    });
  }

  // ── !clan description <text> ──
  if (sub === 'description') {
    const desc = args.slice(2).join(' ').trim();
    const myClanId = getClanIdOfUser(userId);
    const myClan = myClanId ? clansData[myClanId] : null;
    if (!myClan) return message.reply('❌ You do not belong to any clan.');
    if (myClan.leaderId !== userId) return message.reply('❌ Only the leader can change the description.');
    if (!desc) return message.reply('❌ Usage: `.clan description <text>`');
    if (desc.length > 100) return message.reply('❌ Maximum 100 characters.');
    myClan.description = desc;
    saveClans();
    return message.reply(`✅ Description of clan **${myClan.name}** updated.`);
  }

  // ── !clan leave ──
  if (sub === 'leave') {
    const myClanId = getClanIdOfUser(userId);
    const myClan = myClanId ? clansData[myClanId] : null;
    if (!myClan) return message.reply('❌ You do not belong to any clan.');
    if (myClan.leaderId === userId && myClan.members.length > 1)
      return message.reply('❌ You are the leader. First transfer leadership with `.clan leader @user` or disband the clan with `.clan disband`.');

    if (myClan.leaderId === userId && myClan.members.length === 1) {
      delete clansData[myClanId];
      saveClans();
      return message.reply('✅ You left and the clan was dissolved (you were alone).');
    }

    myClan.members = myClan.members.filter(id => id !== userId);
    saveClans();
    return message.reply(`✅ You left the clan **${myClan.name}**.`);
  }

  // ── !clan kick @user ──
  if (sub === 'kick') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Usage: `.clan kick @user`');
    const myClanId = getClanIdOfUser(userId);
    const myClan = myClanId ? clansData[myClanId] : null;
    if (!myClan) return message.reply('❌ You do not belong to any clan.');
    if (myClan.leaderId !== userId) return message.reply('❌ Only the leader can kick members.');
    if (target.id === userId) return message.reply('❌ You cannot kick yourself.');
    if (!myClan.members.includes(target.id)) return message.reply(`❌ **${target.username}** is not in your clan.`);
    myClan.members = myClan.members.filter(id => id !== target.id);
    saveClans();
    return message.reply(`✅ **${target.username}** was kicked from clan **${myClan.name}**.`);
  }

  // ── !clan leader @user ──
  if (sub === 'leader') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Usage: `.clan leader @user`');
    const myClanId = getClanIdOfUser(userId);
    const myClan = myClanId ? clansData[myClanId] : null;
    if (!myClan) return message.reply('❌ You do not belong to any clan.');
    if (myClan.leaderId !== userId) return message.reply('❌ Only the current leader can transfer leadership.');
    if (!myClan.members.includes(target.id)) return message.reply(`❌ **${target.username}** is not in your clan.`);
    myClan.leaderId = target.id;
    saveClans();
    return message.reply(`✅ **${target.username}** is now the new leader of **${myClan.name}**. 👑`);
  }

  // ── !clan disband ──
  if (sub === 'disband') {
    const myClanId = getClanIdOfUser(userId);
    const myClan = myClanId ? clansData[myClanId] : null;
    if (!myClan) return message.reply('❌ You do not belong to any clan.');
    if (myClan.leaderId !== userId) return message.reply('❌ Only the leader can disband the clan.');

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`disband_confirm_${userId}`).setLabel('💀 Disband clan').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`disband_cancel_${userId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
    );

    const disbMsg = await message.reply({
      embeds: [{
        color: 0xFF4444,
        title: `⚠️ Disband ${myClan.name}?`,
        description: `This will remove **${myClan.members.length}** member(s) and permanently delete the clan.\n\n⚠️ **This action cannot be undone.**`,
        footer: { text: '30 seconds to confirm' }
      }],
      components: [confirmRow]
    });

    const disbCol = disbMsg.createMessageComponentCollector({ time: 30000 });
    disbCol.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌', ephemeral: true });
      disbCol.stop();
      if (interaction.customId === `disband_cancel_${userId}`)
        return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Cancelled', description: 'The clan was not disbanded.' }], components: [] });
      delete clansData[myClanId];
      saveClans();
      return interaction.update({ embeds: [{ color: 0xFF4444, title: `💀 ${myClan.name} was disbanded`, description: 'The clan and all its records have been deleted.' }], components: [] });
    });
    disbCol.on('end', (_, r) => { if (r === 'time') disbMsg.edit({ components: [] }).catch(() => {}); });
    return;
  }

  // ── !clan war ──
  if (sub === 'war') {
    const myClanId = getClanIdOfUser(userId);
    const myClan = myClanId ? clansData[myClanId] : null;
    if (!myClan) return message.reply('❌ You do not belong to any clan.');
    if (myClan.leaderId !== userId) return message.reply('❌ Only the **leader** can declare a war.');
    if (myClan.members.length < 2) return message.reply('❌ You need at least **2 members** in the clan to start a war.');

    const now = Date.now();
    if (now - myClan.lastWar < CLAN_WAR_COOLDOWN) {
      const remaining = CLAN_WAR_COOLDOWN - (now - myClan.lastWar);
      const hh = Math.floor(remaining / 3600000);
      const mm = Math.floor((remaining % 3600000) / 60000);
      return message.reply(`⏱️ Your clan can go to war again in **${hh}h ${mm}m**.`);
    }

    // Find rival: another clan with similar size, different from yours
    const candidates = Object.entries(clansData).filter(([id, c]) =>
      id !== myClanId && c.members.length >= 1
    );

    if (!candidates.length) return message.reply('❌ No other clans are available to fight.');

    const myElo = myClan.elo || 1000;

    // Find rival by closest clan ELO
    candidates.sort((a, b) => {
      const aElo = a[1].elo || 1000;
      const bElo = b[1].elo || 1000;
      return Math.abs(aElo - myElo) - Math.abs(bElo - myElo);
    });
    const pool = candidates.slice(0, Math.min(3, candidates.length));
    const [rivalId, rivalClan] = pool[Math.floor(Math.random() * pool.length)];
    const rivalElo = rivalClan.elo || 1000;

    // Win probability based on clan ELO
    const myWinProb = Math.max(0.2, Math.min(0.8, 1 / (1 + Math.pow(10, (rivalElo - myElo) / 400))));
    const myWon = Math.random() < myWinProb;

    // Clan ELO goes up or down (K=32 system)
    const K = 32;
    const expected = 1 / (1 + Math.pow(10, (rivalElo - myElo) / 400));
    const score = myWon ? 1 : 0;
    const myEloChange  = Math.round(K * (score - expected));
    const rivEloChange = Math.round(K * ((1 - score) - (1 - expected)));

    myClan.elo  = Math.max(100, (myClan.elo  || 1000) + myEloChange);
    rivalClan.elo = Math.max(100, (rivalClan.elo || 1000) + rivEloChange);

    // Reward: 200 coins per winning member
    const GUERRA_REWARD = 200;
    if (myWon) {
      myClan.warWins++;
      for (const mid of myClan.members) {
        if (data[mid]) data[mid].coins = (data[mid].coins || 0) + GUERRA_REWARD;
      }
    } else {
      myClan.warLosses++;
      rivalClan.warWins++;
      for (const mid of rivalClan.members) {
        if (data[mid]) data[mid].coins = (data[mid].coins || 0) + GUERRA_REWARD;
      }
    }

    myClan.lastWar = now;
    saveClans();
    saveData();

    // Member detail
    const buildMemberLines = (clan) =>
      clan.members.slice(0, 5).map(mid => {
        const tier = getEloTier(data[mid]?.elo || 1000);
        return `${tier.emoji} <@${mid}> — **${data[mid]?.elo || 1000}** ELO`;
      }).join('\n') + (clan.members.length > 5 ? `\n_...and ${clan.members.length - 5} more_` : '');

    const myNewTier  = getEloTier(myClan.elo);
    const rivNewTier = getEloTier(rivalClan.elo);

    return message.reply({
      embeds: [{
        color: myWon ? 0x00C851 : 0xFF4444,
        author: { name: `⚔️ Clan War`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: myWon
          ? `🏆 ${myClan.name} WINS THE WAR!`
          : `💀 ${rivalClan.name} wins the war`,
        description: [
          `**${myClan.name}** vs **${rivalClan.name}**`,
          ``,
          myWon
            ? `✅ Each member of **${myClan.name}** receives **+${GUERRA_REWARD} 💰**!`
            : `❌ **${rivalClan.name}** was stronger. Each of their members receives **+${GUERRA_REWARD} 💰**.`,
        ].join('\n'),
        fields: [
          {
            name: `🏠 ${myClan.name} ${myWon ? '🏆' : ''}`,
            value: `ELO: ${myNewTier.emoji} **${myClan.elo}** (${myEloChange >= 0 ? '+' : ''}${myEloChange})\n${buildMemberLines(myClan)}`,
            inline: true
          },
          {
            name: `✈️ ${rivalClan.name} ${!myWon ? '🏆' : ''}`,
            value: `ELO: ${rivNewTier.emoji} **${rivalClan.elo}** (${rivEloChange >= 0 ? '+' : ''}${rivEloChange})\n${buildMemberLines(rivalClan)}`,
            inline: true
          },
        ],
        footer: { text: `Cooldown: 6h · Record: ✅${myClan.warWins}W ❌${myClan.warLosses}L` },
        timestamp: new Date().toISOString()
      }]
    });
  }

  // ── Help ──
  return message.reply({
    embeds: [{
      color: 0x5865F2,
      title: '👥 Clan Commands',
      fields: [
        { name: '`.clan create <name>`',       value: `Create a clan · Costs **${CLAN_CREATE_COST} 💰**`,  inline: false },
        { name: '`.clan invite @user`',        value: 'Invite a member (leader only)',                     inline: false },
        { name: '`.clan info [name]`',         value: 'View your clan or another clan\'s info',            inline: false },
        { name: '`.clan top`',                 value: 'Clan ranking by total ELO',                         inline: false },
        { name: '`.clan war`',                 value: 'Start an automatic war · 6h cooldown',              inline: false },
        { name: '`.clan description <text>`',  value: 'Edit clan description (leader only)',               inline: false },
        { name: '`.clan kick @user`',          value: 'Kick a member (leader only)',                       inline: false },
        { name: '`.clan leader @user`',        value: 'Transfer leadership',                               inline: false },
        { name: '`.clan leave`',               value: 'Leave the clan',                                    inline: false },
        { name: '`.clan disband`',             value: 'Disband the clan (leader only)',                    inline: false },
      ],
      footer: { text: `Maximum ${CLAN_MAX_MEMBERS} members per clan` }
    }]
  });
}


// ─────────────────────────────────────────
// ❓ TRIVIA
// ─────────────────────────────────────────
const TRIVIA_QUESTIONS = [
  { q: 'In what exact year was FIFA founded?', options: ['1900', '1904', '1906', '1908'], answer: 1, reward: 150 },
  { q: 'How many goals did Pelé score throughout his entire official career?', options: ['1000', '1078', '767', '892'], answer: 3, reward: 200 },
  { q: 'Which national team won the first World Cup in 1930?', options: ['Argentina', 'Brazil', 'Uruguay', 'Italy'], answer: 2, reward: 150 },
  { q: 'How many Ballon d\'Or awards did Ronaldo Nazário "the Phenomenon" win?', options: ['1', '2', '3', '0'], answer: 1, reward: 160 },
  { q: 'Which country hosted the World Cup where Maradona scored "The Hand of God"?', options: ['Argentina', 'Spain', 'Mexico', 'Italy'], answer: 2, reward: 150 },
  { q: 'Who was the all-time top scorer in the Champions League before Cristiano Ronaldo?', options: ['Raúl', 'Van Nistelrooy', 'Messi', 'Benzema'], answer: 0, reward: 200 },
  { q: 'In what year did Colombia win their only Copa América?', options: ['2001', '1999', '2004', '1995'], answer: 0, reward: 180 },
  { q: 'How many goals did Gerd Müller score at the 1970 World Cup?', options: ['8', '10', '7', '9'], answer: 1, reward: 220 },
  { q: 'In which city was the 2006 World Cup final played?', options: ['Munich', 'Berlin', 'Hamburg', 'Dortmund'], answer: 1, reward: 170 },
  { q: 'Which referee officiated the 1998 World Cup final?', options: ['Collina', 'Belqola', 'Moreno', 'Melo'], answer: 1, reward: 250 },
  { q: 'How many goals did Just Fontaine score at the 1958 World Cup, a historical record?', options: ['11', '13', '10', '12'], answer: 1, reward: 230 },
  { q: 'Which player scored the golden goal at Euro 1996?', options: ['Bierhoff', 'Shearer', 'Klinsmann', 'Zidane'], answer: 0, reward: 220 },
  { q: 'In what year did Messi make his debut with the Argentine senior national team?', options: ['2004', '2005', '2006', '2007'], answer: 1, reward: 180 },
  { q: 'How many consecutive World Cups did Italy win between 1934 and 1938?', options: ['1', '2', '3', '4'], answer: 1, reward: 160 },
  { q: 'Which team eliminated Spain in the Round of 16 at the 2022 World Cup?', options: ['France', 'Morocco', 'Portugal', 'Croatia'], answer: 1, reward: 150 },
  { q: 'How many goals did Miroslav Klose score across all World Cups?', options: ['14', '15', '16', '13'], answer: 2, reward: 180 },
  { q: 'Who was coaching France when they won the 1998 World Cup?', options: ['Houllier', 'Deschamps', 'Jacquet', 'Blanc'], answer: 2, reward: 200 },
  { q: 'In what minute did Iniesta score the winning goal at the 2010 World Cup final?', options: ['116', '119', '113', '110'], answer: 0, reward: 220 },
  { q: 'Which club developed Ronaldinho before he joined Barcelona?', options: ['Flamengo', 'Cruzeiro', 'Grêmio', 'Santos'], answer: 2, reward: 200 },
  { q: 'How many consecutive European Cups did Real Madrid win between 1956 and 1960?', options: ['4', '5', '6', '3'], answer: 1, reward: 180 },
  { q: 'Which goalkeeper saved France\'s penalties in the 2006 World Cup semi-finals?', options: ['Buffon', 'Casillas', 'Toldo', 'Peruzzi'], answer: 0, reward: 220 },
  { q: 'How many goals did Colombia score against Brazil at the 2014 World Cup?', options: ['1', '2', '3', '0'], answer: 0, reward: 170 },
  { q: 'Which player scored a hat-trick in the 1997 Cup Winners\' Cup final for Chelsea?', options: ['Zola', 'Di Matteo', 'Vialli', 'Hughes'], answer: 2, reward: 250 },
  { q: 'In what year did Boca Juniors win their last Copa Libertadores?', options: ['2000', '2003', '2007', '2001'], answer: 1, reward: 200 },
  { q: 'How many minutes did Maradona play in the match against England in 1986?', options: ['90', '85', '80', '88'], answer: 0, reward: 220 },
  { q: 'Which striker scored the decisive goal in the 1999 Champions League final for Manchester United?', options: ['Sheringham', 'Solskjaer', 'Cole', 'Yorke'], answer: 1, reward: 230 },
  { q: 'How many penalties did Italy miss in the 1994 World Cup final?', options: ['2', '3', '1', '4'], answer: 0, reward: 200 },
  { q: 'Which Dutch player was sent off in the 2010 World Cup final?', options: ['Van Bommel', 'De Jong', 'Robben', 'Heitinga'], answer: 3, reward: 230 },
  { q: 'In which season did Leicester City win the Premier League?', options: ['2014-15', '2015-16', '2016-17', '2013-14'], answer: 1, reward: 170 },
  { q: 'How many goals did Cristiano Ronaldo score in his first season at Juventus?', options: ['26', '28', '21', '30'], answer: 2, reward: 200 },
  { q: 'Who was awarded the MVP (Golden Ball) at the 2014 World Cup?', options: ['Müller', 'Neuer', 'Messi', 'Götze'], answer: 2, reward: 170 },
  { q: 'Which referee sent off Zidane in the 2006 World Cup final?', options: ['Elizondo', 'Archundia', 'Melo', 'Rosetti'], answer: 0, reward: 230 },
  { q: 'How many goals did Romário score at the 1994 World Cup?', options: ['4', '5', '6', '3'], answer: 1, reward: 200 },
  { q: 'Has Atlético de Madrid ever won the Champions League?', options: ['Never', '1974', '1996', '2014'], answer: 0, reward: 220 },
  { q: 'How many African players participated in the first World Cup in 1930?', options: ['0', '1', '2', '4'], answer: 0, reward: 210 },
  { q: 'Who scored the most famous Olympic goal (direct from corner) in a Clásico?', options: ['Messi', 'Ronaldinho', 'Rivaldo', 'Ronaldo'], answer: 1, reward: 240 },
  { q: 'Did Ronaldo play in the 1998 World Cup despite doubts over his fitness before the final?', options: ['Yes, he played', 'Never played', 'Only the final', 'The whole tournament'], answer: 0, reward: 220 },
  { q: 'Which team won the first two editions of the Copa América (1916 and 1917)?', options: ['Brazil', 'Argentina', 'Uruguay', 'Chile'], answer: 2, reward: 220 },
  { q: 'In what minute did Sergio Ramos score his equalizer in the 2014 Champions League final?', options: ['90+3', '90+1', '88', '93'], answer: 0, reward: 240 },
  { q: 'How many goals did Ronaldo "the Phenomenon" score at the 2002 World Cup?', options: ['6', '7', '8', '5'], answer: 2, reward: 200 },
  { q: 'Which manager led Greece to win Euro 2004?', options: ['Rehhagel', 'Clough', 'Hiddink', 'Eriksson'], answer: 0, reward: 230 },
  { q: 'What was the result of the famous "Battle of Santiago" at the 1962 World Cup?', options: ['Chile 2-0 Italy', 'Chile 2-1 Italy', 'Italy 2-0 Chile', 'Chile 3-0 Italy'], answer: 0, reward: 250 },
  { q: 'How many goals did Eusébio score at the 1966 World Cup?', options: ['7', '9', '8', '6'], answer: 1, reward: 220 },
  { q: 'Which club won the first Copa Libertadores in history?', options: ['Peñarol', 'Santos', 'Olimpia', 'River Plate'], answer: 0, reward: 230 },
  { q: 'In what year was the modern offside rule (1 defender) introduced?', options: ['1990', '1995', '2005', '2000'], answer: 0, reward: 210 },
  { q: 'How many World Cups did Lothar Matthäus play in?', options: ['4', '5', '3', '6'], answer: 1, reward: 200 },
  { q: 'Which player has the most appearances in Premier League history?', options: ['Giggs', 'James', 'Barry', 'Heskey'], answer: 2, reward: 240 },
  { q: 'In what year did Napoli win their first Scudetto with Maradona?', options: ['1985', '1987', '1989', '1986'], answer: 1, reward: 200 },
  { q: 'How many penalties did Jerzy Dudek save in the 2005 Champions League final?', options: ['1', '2', '3', '4'], answer: 1, reward: 230 },
  { q: 'Which team topped Group F at the 2022 World Cup ahead of Belgium?', options: ['Canada', 'Morocco', 'Croatia', 'Japan'], answer: 2, reward: 200 },

  // ── 20 NEW QUESTIONS ──
  { q: 'Who scored the winning penalty for England in the Euro 2020 semi-final against Denmark?', options: ['Kane', 'Rashford', 'Trippier', 'Sterling'], answer: 0, reward: 180 },
  { q: 'How many times has Brazil won the FIFA World Cup?', options: ['4', '5', '6', '3'], answer: 1, reward: 150 },
  { q: 'Which club did David Beckham join after leaving Real Madrid in 2007?', options: ['LA Galaxy', 'Inter Milan', 'PSG', 'New York City FC'], answer: 0, reward: 160 },
  { q: 'Who scored the famous "ghost goal" for England against Germany at the 2010 World Cup?', options: ['Rooney', 'Gerrard', 'Lampard', 'Terry'], answer: 2, reward: 200 },
  { q: 'Which country hosted the 2002 FIFA World Cup alongside South Korea?', options: ['China', 'Japan', 'Australia', 'Thailand'], answer: 1, reward: 150 },
  { q: 'How many goals did Harry Kane score in the 2018 World Cup, winning the Golden Boot?', options: ['5', '6', '7', '8'], answer: 1, reward: 180 },
  { q: 'Which African nation became the first to reach a World Cup semi-final in 2022?', options: ['Senegal', 'Cameroon', 'Ghana', 'Morocco'], answer: 3, reward: 170 },
  { q: 'In what year did the UEFA Champions League replace the European Cup?', options: ['1990', '1991', '1992', '1993'], answer: 2, reward: 190 },
  { q: 'Who won the Golden Glove (best goalkeeper) at the 2018 World Cup?', options: ['De Gea', 'Lloris', 'Courtois', 'Pickford'], answer: 2, reward: 180 },
  { q: 'Which club has won the most UEFA Champions League titles in history?', options: ['Barcelona', 'Bayern Munich', 'Real Madrid', 'AC Milan'], answer: 2, reward: 150 },
  { q: 'How old was Pelé when he won his first World Cup in 1958?', options: ['16', '17', '18', '19'], answer: 1, reward: 180 },
  { q: 'Which player scored a hat-trick for Portugal against Spain at the 2018 World Cup?', options: ['Quaresma', 'Gonçalo Guedes', 'Cristiano Ronaldo', 'Joao Moutinho'], answer: 2, reward: 160 },
  { q: 'Who was the top scorer at the 2006 World Cup in Germany?', options: ['Zidane', 'Klose', 'Ronaldo', 'Villa'], answer: 1, reward: 170 },
  { q: 'Which English club won the first ever Premier League title in 1992-93?', options: ['Arsenal', 'Liverpool', 'Manchester United', 'Blackburn Rovers'], answer: 2, reward: 160 },
  { q: 'How many caps did Kristine Lilly earn for the USA women\'s national team, a world record?', options: ['340', '354', '352', '328'], answer: 2, reward: 230 },
  { q: 'Which stadium hosted the 2016 Champions League final between Real Madrid and Atlético?', options: ['Wembley', 'San Siro', 'San Mamés', 'Giuseppe Meazza'], answer: 3, reward: 210 },
  { q: 'Who scored the winning goal in the 2019 Copa América final for Brazil?', options: ['Neymar', 'Firmino', 'Gabriel Jesus', 'Everton'], answer: 3, reward: 200 },
  { q: 'In what year did Zinedine Zidane retire from professional football?', options: ['2004', '2005', '2006', '2007'], answer: 2, reward: 170 },
  { q: 'Which goalkeeper won the 2022 World Cup Golden Glove award?', options: ['Lloris', 'Bounou', 'Emiliano Martínez', 'Alisson'], answer: 2, reward: 180 },
  { q: 'How many times did Lionel Messi win the FIFA World Cup before 2022?', options: ['0', '1', '2', '3'], answer: 0, reward: 150 },
];

const triviaCooldowns = new Map();
const TRIVIA_COOLDOWN = 15 * 60 * 1000;

if (cmd === '.trivia') {
  if (!isAdmin(userId)) {
    const lastTrivia = Math.max(triviaCooldowns.get(userId) || 0, user.lastTrivia || 0);
    const elapsed = Date.now() - lastTrivia;
    if (elapsed < TRIVIA_COOLDOWN) {
      const mins = Math.floor((TRIVIA_COOLDOWN - elapsed) / 60000);
      const secs = Math.floor(((TRIVIA_COOLDOWN - elapsed) % 60000) / 1000);
      return message.reply(`⏱️ **Trivia en cooldown** — espera **${mins}m ${secs}s**.`);
    }
  }

  const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
  const letters = ['🅰️', '🅱️', '🇨', '🇩'];
  const TRIVIA_TIME = 20000;

  triviaCooldowns.set(userId, Date.now());
  user.lastTrivia = Date.now();
  saveData();

  const triviaRow = new ActionRowBuilder().addComponents(
    q.options.map((opt, i) =>
      new ButtonBuilder()
        .setCustomId(`trivia_${i}_${userId}`)
        .setLabel(`${['A', 'B', 'C', 'D'][i]}. ${opt}`)
        .setStyle(ButtonStyle.Primary)
    )
  );

  const triviaMsg = await message.reply({
    embeds: [{
      color: 0x5865F2,
      author: { name: `❓ Trivia · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      title: q.q,
      description: q.options.map((opt, i) => `${letters[i]} ${opt}`).join('\n'),
      fields: [
        { name: '💰 Reward', value: `**${q.reward} 💰**`, inline: true },
        { name: '⏱️ Time', value: '**20 seconds**', inline: true },
      ],
      footer: { text: 'Choose the correct answer' },
      timestamp: new Date().toISOString()
    }],
    components: [triviaRow]
  });

  const triviaCol = triviaMsg.createMessageComponentCollector({ time: TRIVIA_TIME });

  triviaCol.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ This trivia is not yours.', ephemeral: true });

    triviaCol.stop();
    const chosen = parseInt(interaction.customId.replace(`trivia_`, '').replace(`_${userId}`, ''));
    const correct = chosen === q.answer;

    if (correct) {
      user.coins += q.reward;
      saveData();
    }

    const resultOptions = q.options.map((opt, i) => {
      const isCorrect = i === q.answer;
      const isChosen = i === chosen;
      const prefix = isCorrect ? '✅' : isChosen ? '❌' : '⬜';
      return `${prefix} ${['A', 'B', 'C', 'D'][i]}. ${opt}`;
    }).join('\n');

    await interaction.update({
      embeds: [{
        color: correct ? 0x00C851 : 0xFF4444,
        author: { name: `❓ Trivia · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: q.q,
        description: resultOptions,
        fields: [
          correct
            ? { name: '✅ Correct!', value: `**+${q.reward} 💰**`, inline: true }
            : { name: '❌ Incorrect', value: `The answer was **${q.options[q.answer]}**`, inline: true },
          { name: '💰 Balance', value: `**${user.coins.toLocaleString()} 💰**`, inline: true },
        ],
        footer: { text: 'Cooldown: 5 minutes · !trivia to play again' },
        timestamp: new Date().toISOString()
      }],
      components: []
    });
  });

  triviaCol.on('end', (_, reason) => {
    if (reason === 'time') {
      triviaMsg.edit({
        embeds: [{
          color: 0x555555,
          title: `⏱️ Time's up — ${q.q}`,
          description: q.options.map((opt, i) => {
            const isCorrect = i === q.answer;
            return `${isCorrect ? '✅' : '⬜'} ${['A', 'B', 'C', 'D'][i]}. ${opt}`;
          }).join('\n'),
          fields: [{ name: '⏱️ Time ran out', value: `The answer was **${q.options[q.answer]}**`, inline: false }],
          footer: { text: 'Cooldown: 5 minutes' }
        }],
        components: []
      }).catch(() => {});
    }
  });

  return;
}


// ─────────────────────────────────────────
// 🎮 PLAYERS — View all available players
// ─────────────────────────────────────────
if (cmd === '.players') {
  const filterArg = (args[1] || '').toLowerCase();

  const validRarities = ['legendary', 'epic', 'rare', 'common'];
  const validPositions = ['gk', 'dm', 'am', 'st'];
  let filteredPlayers = [...players].filter(p => p.rarity !== 'WorldCup' && p.rarity !== 'Special');

  if (validRarities.includes(filterArg)) {
    const rarityMap = { legendary: 'Legendary', epic: 'Epic', rare: 'Rare', common: 'Common' };
    filteredPlayers = players.filter(p => p.rarity === rarityMap[filterArg]);
  } else if (validPositions.includes(filterArg)) {
    filteredPlayers = players.filter(p => p.position.toLowerCase() === filterArg);
  }

  filteredPlayers.sort((a, b) => b.rating - a.rating);

  const PAGE_SIZE = 10;
  let pPage = 0;
  const totalPages = Math.ceil(filteredPlayers.length / PAGE_SIZE);

  async function buildPlayersCanvas(page) {
    const slice = filteredPlayers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const W = 860, FULL_H = 640;
    const canvas = createCanvas(W, FULL_H);
    const ctx = canvas.getContext('2d');

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, W, FULL_H);
    bgGrad.addColorStop(0, '#08080f');
    bgGrad.addColorStop(0.5, '#0e0e1c');
    bgGrad.addColorStop(1, '#08080f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, FULL_H);

    // Decorative dots
    ctx.save();
    ctx.globalAlpha = 0.05;
    for (let x = 20; x < W; x += 28) {
      for (let y = 20; y < FULL_H; y += 28) {
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff'; ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.restore();

    // Header
    const filterLabel = filterArg
      ? ` · Filter: ${args[1].toUpperCase()}`
      : '';
    ctx.save();
    ctx.font = `bold 32px ${FIFA_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 18;
    ctx.fillText('🎮  AVAILABLE PLAYERS', W / 2, 48);
    ctx.shadowBlur = 0;
    ctx.font = `13px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff44';
    ctx.fillText(`${filteredPlayers.length} player${filteredPlayers.length !== 1 ? 's' : ''}${filterLabel}  ·  Page ${page + 1} / ${totalPages}  ·  !show <name> to view card`, W / 2, 68);
    ctx.restore();

    // Divider
    ctx.save();
    const lineGrad = ctx.createLinearGradient(40, 0, W - 40, 0);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.3, '#FFD700aa');
    lineGrad.addColorStop(0.7, '#FFD700aa');
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 78); ctx.lineTo(W - 40, 78); ctx.stroke();
    ctx.restore();

    // Column headers
    const cols = { num: 42, name: 66, pos: 280, rarity: 360, ovr: 500, pac: 570, sho: 630, pas: 690, dri: 750, pack: 800 };
    ctx.save();
    ctx.font = `bold 11px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff55';
    ctx.textAlign = 'left';
    ctx.fillText('#',        cols.num,    100);
    ctx.fillText('PLAYER',  cols.name,   100);
    ctx.fillText('POS',     cols.pos,    100);
    ctx.fillText('RARITY',  cols.rarity, 100);
    ctx.fillText('OVR',     cols.ovr,    100);
    ctx.fillText('PAC',     cols.pac,    100);
    ctx.fillText('SHO',     cols.sho,    100);
    ctx.fillText('PAS',     cols.pas,    100);
    ctx.fillText('DRI',     cols.dri,    100);
    ctx.fillText('PACK',    cols.pack,   100);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#ffffff15'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 108); ctx.lineTo(W - 40, 108); ctx.stroke();
    ctx.restore();

    const rarityColor = { 'Icon': '#C0C0C0', "WorldCup": '#CC2200', "Legendary": '#FFD700', "Epic": '#9B59B6', "Rare": '#5B9BD5', "Common": '#A0836A' };
    const rarityEmoji = { "Icon": '⭐', "WorldCup": '🏆', "Legendary": '👑', "Epic": '💜', "Rare": '💙', "Common": '⚪' };
    const posEmoji    = { GK: '🧤', DM: '🛡️', AM: '🎯', ST: '⚽' };
    const packForRarity = { "Icon": '⭐ Icon', "WorldCup": '🏆 World Cup', "Legendary": '💎 Legend', "Epic": '🥇 Gold', "Rare": '🥈 Silver', "Common": '🥉 Bronze' };

    slice.forEach((p, i) => {
      const rowY = 118 + i * 50;
      const globalIdx = page * PAGE_SIZE + i;

      // Row background
      ctx.save();
      ctx.fillStyle = i % 2 === 0 ? '#ffffff08' : '#00000020';
      roundRectPath(ctx, 30, rowY - 2, W - 60, 44, 8);
      ctx.fill();
      ctx.restore();

      // Rarity bar
      ctx.save();
      ctx.fillStyle = rarityColor[p.rarity] || '#888888';
      ctx.globalAlpha = 0.8;
      roundRectPath(ctx, 30, rowY - 2, 4, 44, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Number
      ctx.save();
      ctx.font = `11px ${FIFA_FONT}`;
      ctx.fillStyle = '#ffffff30';
      ctx.textAlign = 'right';
      ctx.fillText(`${globalIdx + 1}.`, cols.name - 6, rowY + 26);
      ctx.restore();

      // Name
      ctx.save();
      ctx.font = `bold 15px ${FIFA_FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cols.name, rowY + 26);
      ctx.restore();

      // Position
      ctx.save();
      ctx.font = `bold 12px ${FIFA_FONT}`;
      ctx.fillStyle = '#cccccc';
      ctx.fillText(`${posEmoji[p.position] || ''} ${p.position}`, cols.pos, rowY + 26);
      ctx.restore();

      // Rarity
      ctx.save();
      ctx.font = `bold 12px ${FIFA_FONT}`;
      ctx.fillStyle = rarityColor[p.rarity] || '#888888';
      ctx.shadowColor = rarityColor[p.rarity] || '#888888';
      ctx.shadowBlur = 6;
      ctx.fillText(`${rarityEmoji[p.rarity]} ${p.rarity}`, cols.rarity, rowY + 26);
      ctx.shadowBlur = 0;
      ctx.restore();

      // OVR
      ctx.save();
      ctx.font = `bold 16px ${FIFA_FONT}`;
      ctx.fillStyle = p.rating >= 90 ? '#FFD700' : p.rating >= 80 ? '#ffffff' : '#aaaaaa';
      ctx.fillText(String(p.rating), cols.ovr, rowY + 26);
      ctx.restore();

      // Main stats (or GK stats)
      const stats = p.stats || {};
      const isGK = p.position === 'GK';
      const statKeys = isGK
        ? ['DIV', 'REF', 'HAN', 'KIC']
        : ['PAC', 'SHO', 'PAS', 'DRI'];
      const statCols = [cols.pac, cols.sho, cols.pas, cols.dri];

      statKeys.forEach((key, si) => {
        const val = stats[key];
        if (val === undefined) return;
        ctx.save();
        ctx.font = `bold 13px ${FIFA_FONT}`;
        const statColor = val >= 88 ? '#00ff88' : val >= 75 ? '#FFD700' : val >= 60 ? '#ffaa44' : '#ff6666';
        ctx.fillStyle = statColor;
        ctx.textAlign = 'left';
        ctx.fillText(String(val), statCols[si], rowY + 26);
        ctx.restore();
      });

      // Required pack
      ctx.save();
      ctx.font = `11px ${FIFA_FONT}`;
      ctx.fillStyle = '#888888';
      ctx.textAlign = 'left';
      ctx.fillText(packForRarity[p.rarity] || '—', cols.pack, rowY + 26);
      ctx.restore();

      // Row separator
      if (i < slice.length - 1) {
        ctx.save();
        ctx.strokeStyle = '#ffffff10'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, rowY + 42); ctx.lineTo(W - 40, rowY + 42); ctx.stroke();
        ctx.restore();
      }
    });

    // Footer
    ctx.save();
    ctx.font = `12px ${FIFA_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff25';
    ctx.fillText(`Filters: !players legendary · !players epic · !players rare · !players common · !players gk · !players st · !players am · !players dm`, W / 2, FULL_H - 14);
    ctx.restore();

    return canvas;
  }

  function buildPlayersNavRow(uid, page) {
    const filterLabel = filterArg ? ` [${args[1].toUpperCase()}]` : '';
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`players_prev_${uid}`).setLabel('◀ Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(`players_page_${uid}`).setLabel(`${page + 1} / ${totalPages}${filterLabel}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`players_next_${uid}`).setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
      new ButtonBuilder().setCustomId(`players_random_${uid}`).setLabel('🎲 Random').setStyle(ButtonStyle.Secondary)
    );
  }

  if (filteredPlayers.length === 0) {
    return message.reply({ embeds: [{ color: 0xFF4444, title: '❌ No results', description: `No players found with filter **${args[1]}**.\n\n**Valid filters:** legendary · epic · rare · common · gk · dm · am · st` }] });
  }

  const canvas0 = await buildPlayersCanvas(pPage);
  const playersMsg = await message.reply({
    embeds: [{
      color: 0x1a1a2e,
      author: { name: `🎮 Players · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      image: { url: 'attachment://players.png' },
      footer: { text: `Total: ${filteredPlayers.length} players  ·  !show <name> to view card  ·  !market to buy/sell` },
      timestamp: new Date().toISOString()
    }],
    files: [{ attachment: canvas0.toBuffer(), name: 'players.png' }],
    components: totalPages > 1 ? [buildPlayersNavRow(userId, pPage)] : []
  });

  if (totalPages <= 1) return;

  const col = playersMsg.createMessageComponentCollector({ time: 120000 });
  col.on('collect', async interaction => {
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This panel is not yours.', ephemeral: true });

    if (interaction.customId === `players_random_${userId}`) {
      pPage = Math.floor(Math.random() * totalPages);
    } else if (interaction.customId === `players_next_${userId}` && pPage < totalPages - 1) {
      pPage++;
    } else if (interaction.customId === `players_prev_${userId}` && pPage > 0) {
      pPage--;
    }

    const nc = await buildPlayersCanvas(pPage);
    await interaction.update({
      embeds: [{
        color: 0x1a1a2e,
        author: { name: `🎮 Players · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        image: { url: 'attachment://players.png' },
        footer: { text: `Total: ${filteredPlayers.length} players  ·  !show <name> to view card  ·  !market to buy/sell` },
        timestamp: new Date().toISOString()
      }],
      files: [{ attachment: nc.toBuffer(), name: 'players.png' }],
      components: [buildPlayersNavRow(userId, pPage)]
    });
  });
  col.on('end', () => playersMsg.edit({ components: [] }).catch(() => {}));
  return;
}

  // ─────────────────────────────────────────
  // ❓ HELP
  // ─────────────────────────────────────────
  if (cmd === '.help') {
    let helpPage = 0;
    const helpMsg = await message.reply({ ...buildHelpEmbed(helpPage), components: [buildHelpRow(userId, helpPage)] });
    const helpCollector = helpMsg.createMessageComponentCollector({ time: 120000 });
    helpCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ This panel is not yours.', ephemeral: true });
      if (interaction.customId === `help_next_${userId}` && helpPage < helpPages.length - 1) helpPage++;
      if (interaction.customId === `help_prev_${userId}` && helpPage > 0) helpPage--;
      await interaction.update({ ...buildHelpEmbed(helpPage), components: [buildHelpRow(userId, helpPage)] });
    });
    helpCollector.on('end', () => helpMsg.edit({ components: [] }).catch(() => {}));
    return;
  }

// ─────────────────────────────────────────
// 💸 SEND — Transfer coins to another user
// ─────────────────────────────────────────
if (cmd === '.send') {
  const target = message.mentions.users.first();
  const amount = parseInt(args[2]);

  if (!target) return message.reply('❌ Usage: `.send @user amount`\nEx: `.send @Luntek 500`');
  if (target.id === userId) return message.reply('❌ You cannot send coins to yourself.');
  if (target.bot) return message.reply('❌ You cannot send coins to a bot.');
  if (isNaN(amount) || amount <= 0) return message.reply('❌ Enter a valid amount greater than 0.');
  if (amount < 50) return message.reply('❌ The minimum transfer amount is **50** 💰.');
  if (user.coins < amount) return message.reply(`❌ You don't have enough coins.\nYou have **${user.coins.toLocaleString()}** 💰 and want to send **${amount.toLocaleString()}** 💰.`);

  if (!data[target.id]) {
    data[target.id] = {
      coins: 1800, players: [], team: [],
      teamName: target.username + "'s FC",
      packs: { silver: 0, bronze: 0, gold: 0, legend: 0 },
      elo: 1000, daily: { lastClaim: 0, streak: 0 }, clubLogo: null
    };
  }

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`send_confirm_${userId}_${target.id}_${amount}`)
      .setLabel(`✅ Confirm sending ${amount.toLocaleString()} 💰`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`send_cancel_${userId}`)
      .setLabel('❌ Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  const confirmMsg = await message.reply({
    embeds: [{
      color: 0x2b2d31,
      author: {
        name: `💸 Transfer · ${message.author.username}`,
        icon_url: message.author.displayAvatarURL({ dynamic: true })
      },
      description: [
        `Do you confirm sending **${amount.toLocaleString()} 💰** to <@${target.id}>?`,
        ``,
        `💰 Your current balance: **${user.coins.toLocaleString()}** 💰`,
        `💳 Your balance after: **${(user.coins - amount).toLocaleString()}** 💰`,
      ].join('\n'),
      fields: [
        { name: '👤 Recipient', value: `<@${target.id}>`,              inline: true },
        { name: '💸 Amount',   value: `${amount.toLocaleString()} 💰`, inline: true },
      ],
      footer: { text: '⏱️ You have 30 seconds to confirm' },
      timestamp: new Date().toISOString()
    }],
    components: [confirmRow]
  });

  const sendCollector = confirmMsg.createMessageComponentCollector({ time: 30000 });

  sendCollector.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ This transfer is not yours.', ephemeral: true });

    if (interaction.customId === `send_cancel_${userId}`) {
      sendCollector.stop();
      return interaction.update({
        embeds: [{
          color: 0x555555,
          title: '❌ Transfer cancelled',
          description: 'No coins were sent.'
        }],
        components: []
      });
    }

    if (interaction.customId === `send_confirm_${userId}_${target.id}_${amount}`) {
      if (user.coins < amount) {
        sendCollector.stop();
        return interaction.update({
          embeds: [{
            color: 0xFF4444,
            title: '❌ Insufficient balance',
            description: 'You no longer have enough coins for this transfer.'
          }],
          components: []
        });
      }

      user.coins -= amount;
      data[target.id].coins = (data[target.id].coins || 0) + amount;
      saveData();
      sendCollector.stop();

      return interaction.update({
        embeds: [{
          color: 0x00C851,
          author: {
            name: `✅ Transfer completed · ${message.author.username}`,
            icon_url: message.author.displayAvatarURL({ dynamic: true })
          },
          description: [
            `You sent **${amount.toLocaleString()} 💰** to <@${target.id}> successfully.`,
            ``,
            `💳 Your new balance: **${user.coins.toLocaleString()}** 💰`,
          ].join('\n'),
          fields: [
            { name: '👤 Recipient',      value: `<@${target.id}>`,                  inline: true },
            { name: '💸 Sent',           value: `${amount.toLocaleString()} 💰`,    inline: true },
            { name: '💰 Current balance',value: `${user.coins.toLocaleString()} 💰`, inline: true },
          ],
          timestamp: new Date().toISOString()
        }],
        components: []
      });
    }
  });

  sendCollector.on('end', (_, reason) => {
    if (reason === 'time') {
      confirmMsg.edit({
        embeds: [{
          color: 0x555555,
          title: '⏱️ Transfer expired',
          description: 'You did not confirm in time. No coins were sent.'
        }],
        components: []
      }).catch(() => {});
    }
  });

  return;
}


// ─────────────────────────────────────────
// ⏱️ COOLDOWNS — !cd
// ─────────────────────────────────────────
if (cmd === '.cd') {
  const nowTs = Date.now();

  // --- Daily ---
  const lastDaily = user.daily?.lastClaim || 0;
  const dailyElapsed = nowTs - lastDaily;
  const dailyReady = dailyElapsed >= DAILY_COOLDOWN_MS;
  const dailyRemaining = DAILY_COOLDOWN_MS - dailyElapsed;
  const dailyHH = Math.floor(dailyRemaining / 3600000);
  const dailyMM = Math.floor((dailyRemaining % 3600000) / 60000);
  const dailySS = Math.floor((dailyRemaining % 60000) / 1000);
  const dailyStr = dailyReady ? '✅ Ready' : `⏳ ${dailyHH}h ${dailyMM}m ${dailySS}s`;
  const nextDailyReward = DAILY_BASE_REWARD + ((user.daily?.streak || 0)) * DAILY_STREAK_BONUS;

  // --- Claim (12h) ---
  const CLAIM_CD = 12 * 60 * 60 * 1000;
  const lastClaim = user.daily?.lastCoinClaim || 0;
  const claimElapsed = nowTs - lastClaim;
  const claimReady = claimElapsed >= CLAIM_CD;
  const claimRemaining = CLAIM_CD - claimElapsed;
  const claimHH = Math.floor(claimRemaining / 3600000);
  const claimMM = Math.floor((claimRemaining % 3600000) / 60000);
  const claimSS = Math.floor((claimRemaining % 60000) / 1000);
  const claimStr = claimReady ? '✅ Ready' : `⏳ ${claimHH}h ${claimMM}m ${claimSS}s`;
  const streak = user.daily?.streak || 0;
  const claimReward = DAILY_BASE_REWARD + (streak > 0 ? (streak - 1) * DAILY_STREAK_BONUS : 0);

  // --- Friendly ---
  const lastFriendly = Math.max(friendlyCooldowns.get(userId) || 0, user.lastFriendly || 0);
  const friendlyElapsed = nowTs - lastFriendly;
  const friendlyReady = isAdmin(userId) || friendlyElapsed >= FRIENDLY_COOLDOWN_MS;
  const friendlyRemaining = FRIENDLY_COOLDOWN_MS - friendlyElapsed;
  const friendlyMM = Math.floor(friendlyRemaining / 60000);
  const friendlySS = Math.floor((friendlyRemaining % 60000) / 1000);
  const friendlyStr = friendlyReady ? '✅ Ready' : `⏳ ${friendlyMM}m ${friendlySS}s`;

  // --- Penalty ---
const PENALTY_COOLDOWN_MS = 10 * 60 * 1000;
const lastPenalty = user.lastPenalty || 0;
const penaltyElapsed = nowTs - lastPenalty;
const penaltyReady = isAdmin(userId) || penaltyElapsed >= PENALTY_COOLDOWN_MS;
const penaltyRemaining = PENALTY_COOLDOWN_MS - penaltyElapsed;
const penaltyMM = Math.floor(penaltyRemaining / 60000);
const penaltySS = Math.floor((penaltyRemaining % 60000) / 1000);
const penaltyStr = penaltyReady ? '✅ Ready' : `⏳ ${penaltyMM}m ${penaltySS}s`;

  // --- Arena ---
  const lastArena = Math.max(arenaCooldowns.get(userId) || 0, user.lastArena || 0);
  const arenaElapsed = nowTs - lastArena;
  const arenaReady = isAdmin(userId) || arenaElapsed >= ARENA_COOLDOWN_MS;
  const arenaRemaining = ARENA_COOLDOWN_MS - arenaElapsed;
  const arenaMM = Math.floor(arenaRemaining / 60000);
  const arenaSS = Math.floor((arenaRemaining % 60000) / 1000);
  const arenaStr = arenaReady ? '✅ Ready' : `⏳ ${arenaMM}m ${arenaSS}s`;
  const tier = getEloTier(user.elo || 1000);

// --- Ruleta ---
const RUL_CD_MS = 10 * 60 * 1000;
const lastRul = user.lastRuleta || 0;
const rulElapsed = nowTs - lastRul;
const rulReady = isAdmin(userId) || rulElapsed >= RUL_CD_MS;
const rulRemaining = RUL_CD_MS - rulElapsed;
const rulMM = Math.floor(rulRemaining / 60000);
const rulSS = Math.floor((rulRemaining % 60000) / 1000);
const rulStr = rulReady ? '✅ Ready' : `⏳ ${rulMM}m ${rulSS}s`;

// --- Raspadito ---
const RASPAR_CD_MS = 10 * 60 * 1000;
const lastRaspar = user.lastRaspar || 0;
const rasparElapsed = nowTs - lastRaspar;
const rasparReady = isAdmin(userId) || rasparElapsed >= RASPAR_CD_MS;
const rasparRemaining = RASPAR_CD_MS - rasparElapsed;
const rasparMM = Math.floor(rasparRemaining / 60000);
const rasparSS = Math.floor((rasparRemaining % 60000) / 1000);
const rasparStr = rasparReady ? '✅ Ready' : `⏳ ${rasparMM}m ${rasparSS}s`;

// --- Dados ---
const DADOS_CD_MS = 10 * 60 * 1000;
const lastDados = user.lastDados || 0;
const dadosElapsed = nowTs - lastDados;
const dadosReady = isAdmin(userId) || dadosElapsed >= DADOS_CD_MS;
const dadosRemaining = DADOS_CD_MS - dadosElapsed;
const dadosMM = Math.floor(dadosRemaining / 60000);
const dadosSS = Math.floor((dadosRemaining % 60000) / 1000);
const dadosStr = dadosReady ? '✅ Ready' : `⏳ ${dadosMM}m ${dadosSS}s`;

  return message.reply({
    embeds: [{
      color: 0x2b2d31,
      author: {
        name: `⏱️ Cooldowns · ${message.author.username}`,
        icon_url: message.author.displayAvatarURL({ dynamic: true })
      },
      fields: [
        {
          name: `📅 Daily — ${dailyStr}`,
          value: dailyReady
            ? `Use \`.daily\` to register your daily attendance\n🔥 Current streak: **${user.daily?.streak || 0}** days`
            : `Come back in **${dailyHH}h ${dailyMM}m ${dailySS}s**\n🔥 Streak: **${user.daily?.streak || 0}** days`,
          inline: false
        },
        {
          name: `🎁 Claim — ${claimStr}`,
          value: claimReady
            ? `Use \`.claim\` to collect **${claimReward} 💰**`
            : `Next reward: **${claimReward} 💰** · Come back in **${claimHH}h ${claimMM}m ${claimSS}s**`,
          inline: false
        },
{
     name: `⚔️ Duel — ${(() => {
       const ld = user.lastDuelo || 0;
       const e  = Date.now() - ld;
       const CD = 5 * 60 * 1000;
       if (isAdmin(userId) || e >= CD) return '✅ Ready';
       const r = CD - e;
       return '⏳ ' + Math.floor(r/60000) + 'm ' + Math.floor((r%60000)/1000) + 's';
     })()}`,
     value: 'Use `.duel @user <bet>` · Min **100 💰** · Cooldown 5 min',
     inline: false
   },
{
  name: `❓ Trivia — ${(() => {
    const lastT = Math.max(triviaCooldowns.get(userId) || 0, user.lastTrivia || 0);
    const e = Date.now() - lastT;
    const ready = isAdmin(userId) || e >= TRIVIA_COOLDOWN;
    if (ready) return '✅ Ready';
    const r = TRIVIA_COOLDOWN - e;
    return `⏳ ${Math.floor(r/60000)}m ${Math.floor((r%60000)/1000)}s`;
  })()}`,
  value: 'Use `.trivia` · Prize up to **250 💰** · Cooldown 15 min',
  inline: false
},
        {
  name: `🎰 Roulette — ${rulStr}`,
  value: rulReady ? `Use \`.rul <amount> <color/number>\`` : `Come back in **${rulMM}m ${rulSS}s**`,
  inline: false
},
{
  name: `🎟️ Scratchcard — ${rasparStr}`,
  value: rasparReady ? `Use \`.raspar\` · Cost: **200 💰**` : `Come back in **${rasparMM}m ${rasparSS}s**`,
  inline: false
},
{
  name: `🎲 Dice — ${dadosStr}`,
  value: dadosReady ? `Use \`.dados <amount>\` · Win x2` : `Come back in **${dadosMM}m ${dadosSS}s**`,
  inline: false
},    
        {
          name: `🤝 Friendly — ${friendlyStr}`,
          value: friendlyReady
            ? `Use \`.friendly @rival\` · Victory: **+100 💰**`
            : `Come back in **${friendlyMM}m ${friendlySS}s**`,
          inline: false
        },
        {
          name: `⚔️ Arena — ${arenaStr}`,
          value: arenaReady
            ? `Use \`.arena\` · Victory: **+400 💰** · ELO at stake`
            : `Come back in **${arenaMM}m ${arenaSS}s**`,
          inline: false
        },
       {
  name: `⚽ Penalty — ${penaltyStr}`,
  value: penaltyReady
    ? `Use \`.penalty <amount>\` · Win **double**`
    : `Come back in **${penaltyMM}m ${penaltySS}s**`,
  inline: false
},
      ],
      footer: {
        text: `💰 Balance: ${(user.coins || 0).toLocaleString()}  ·  ${tier.emoji} ${tier.name}  ·  ELO ${user.elo || 1000}`
      },
      timestamp: new Date().toISOString()
    }]
  });
}


// ─────────────────────────────────────────
  // 🎯 QUESTS — !quests / !misiones
  // ─────────────────────────────────────────
  if (cmd === '.quests' || cmd === '.misiones') {
    const quests = getOrCreateUserQuests(userId);
    const today  = getTodayKey();
 
    Here's the full code with all Spanish text translated to English (comments left as-is):

```javascript
// Subcomando: !quests claim <1|2|3>
    if (args[1] === 'claim') {
      const idx = parseInt(args[2]) - 1;
      if (isNaN(idx) || idx < 0 || idx > 2)
        return message.reply('❌ Usage: `.quests claim <1|2|3>`');
      const q = quests[idx];
      if (!q.completed) return message.reply(`❌ The quest **"${q.desc}"** is not complete yet. Progress: **${q.progress}/${q.target}**`);
      if (q.claimed)    return message.reply(`❌ The quest **"${q.desc}"** has already been claimed today.`);
      q.claimed = true; saveQuests();
      user.coins += q.reward.coins || 0; saveData();
      return message.reply({
        embeds: [{
          color: 0x00C851,
          title: `✅ Quest claimed — ${DIFF_EMOJI[q.difficulty]} ${DIFF_LABEL[q.difficulty]}`,
          description: `**${q.desc}**\n\n💰 You received **+${(q.reward.coins||0).toLocaleString()} 💰**\n💼 Balance: **${user.coins.toLocaleString()} 💰**`,
          footer: { text: 'Quests reset every day at midnight' },
          timestamp: new Date().toISOString()
        }]
      });
    }
 
    // Vista principal
    const totalReward = quests.reduce((s, q) => s + (q.reward.coins||0), 0);
    const earned      = quests.filter(q => q.claimed).reduce((s, q) => s + (q.reward.coins||0), 0);
    const allClaimed  = quests.every(q => q.claimed);
 
    const fields = quests.map((q, i) => {
      const bar = Math.round((q.progress / q.target) * 10);
      const prog = `\`${'█'.repeat(bar)}${'░'.repeat(10-bar)}\` **${q.progress}/${q.target}**`;
      const status = q.claimed ? '✅ Claimed'
        : q.completed ? `🎁 **Ready!** — \`.quests claim ${i+1}\``
        : '⏳ In progress';
      return {
        name: `${DIFF_EMOJI[q.difficulty]} Quest ${i+1} — ${DIFF_LABEL[q.difficulty]}`,
        value: [`📋 **${q.desc}**`, prog, `💰 **${(q.reward.coins||0).toLocaleString()} 💰**`, status].join('\n'),
        inline: false
      };
    });
 
    const btnRow = new ActionRowBuilder().addComponents(
      quests.map((q, i) =>
        new ButtonBuilder()
          .setCustomId(`qclaim_${userId}_${i}`)
          .setLabel(`${DIFF_EMOJI[q.difficulty]} Claim ${i+1}`)
          .setStyle(q.claimed ? ButtonStyle.Secondary : q.completed ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(q.claimed || !q.completed)
      )
    );
 
    const qMsg = await message.reply({
      embeds: [{
        color: 0x5865F2,
        author: { name: `🎯 Daily Quests · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `📅 ${today}`,
        description: allClaimed
          ? `✨ **You completed all today's quests!** (+${earned.toLocaleString()} 💰)\nCome back tomorrow for new quests.`
          : `Complete all 3 quests to earn up to **${totalReward.toLocaleString()} 💰**\n💰 Earned today: **${earned.toLocaleString()} / ${totalReward.toLocaleString()} 💰**`,
        fields,
        footer: { text: '.quests claim <1|2|3> · New quests every day' },
        timestamp: new Date().toISOString()
      }],
      components: [btnRow]
    });
 
    const qCol = qMsg.createMessageComponentCollector({ time: 60000 });
    qCol.on('collect', async interaction => {
      if (interaction.user.id !== userId)
        return interaction.reply({ content: '❌ These quests are not yours.', ephemeral: true });
      const qIdx = parseInt(interaction.customId.replace(`qclaim_${userId}_`, ''));
      const q = quests[qIdx];
      if (!q || !q.completed || q.claimed)
        return interaction.reply({ content: '❌ You cannot claim this quest right now.', ephemeral: true });
      q.claimed = true; saveQuests();
      const coins = q.reward.coins || 0;
      user.coins += coins; saveData();
      const newEarned = quests.filter(qq => qq.claimed).reduce((s,qq) => s+(qq.reward.coins||0), 0);
      const newAllCl  = quests.every(qq => qq.claimed);
      const newBtnRow = new ActionRowBuilder().addComponents(
        quests.map((qq, i) =>
          new ButtonBuilder()
            .setCustomId(`qclaim_${userId}_${i}`)
            .setLabel(`${DIFF_EMOJI[qq.difficulty]} Claim ${i+1}`)
            .setStyle(qq.claimed ? ButtonStyle.Secondary : qq.completed ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(qq.claimed || !qq.completed)
        )
      );
      const newFields = quests.map((qq, i) => {
        const bar = Math.round((qq.progress / qq.target) * 10);
        const prog = `\`${'█'.repeat(bar)}${'░'.repeat(10-bar)}\` **${qq.progress}/${qq.target}**`;
        const status = qq.claimed ? '✅ Claimed'
          : qq.completed ? `🎁 **Ready!** — \`.quests claim ${i+1}\``
          : '⏳ In progress';
        return { name: `${DIFF_EMOJI[qq.difficulty]} Quest ${i+1} — ${DIFF_LABEL[qq.difficulty]}`,
          value: [`📋 **${qq.desc}**`, prog, `💰 **${(qq.reward.coins||0).toLocaleString()} 💰**`, status].join('\n'), inline: false };
      });
      await interaction.update({
        embeds: [{
          color: 0x5865F2,
          author: { name: `🎯 Daily Quests · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `📅 ${today}`,
          description: newAllCl
            ? `✨ **You completed all quests!** (+${newEarned.toLocaleString()} 💰 total)\nCome back tomorrow for new quests.`
            : `💰 Earned today: **${newEarned.toLocaleString()} / ${totalReward.toLocaleString()} 💰**`,
          fields: newFields,
          footer: { text: `Claimed: ${q.desc} · +${coins.toLocaleString()} 💰` },
          timestamp: new Date().toISOString()
        }],
        components: [newBtnRow]
      });
    });
    qCol.on('end', () => qMsg.edit({ components: [] }).catch(() => {}));
    return;
  }
 
  // ─────────────────────────────────────────
  // 🏆 TORNEOS — !torneo
  // ─────────────────────────────────────────
  No worries! Here's just the tournament section with all subcommands translated:

**Mapping:**
- `.torneo` → `.tournament`
- `crear` → `create`
- `listar` / `lista` → `list`
- `jugar` → `play`
- `iniciar` → `start`
- `forzar` → `force`
- `bracket` → `bracket` *(same)*
- `admin` → `admin` *(same)*

```javascript
  if (cmd === '.tournament') {
    const sub = (args[1] || '').toLowerCase();
 
    // ── !tournament create <name> <entry> <maxPlayers> ──
    if (sub === 'create') {
      if (!isTournamentAdmin(userId))
        return message.reply('❌ Only admins can create tournaments.\nAsk an admin to use `.tournament create <name> <entry> <maxPlayers>`.');
      const maxPlayers = parseInt(args[args.length - 1]);
      const entryFee   = parseInt(args[args.length - 2]);
      const name       = args.slice(2, -2).join(' ').trim() || 'FIFA Tournament';
      if (isNaN(maxPlayers) || maxPlayers < 4 || maxPlayers > 32)
        return message.reply('❌ Usage: `.tournament create <name> <entry> <maxPlayers>`\nEx: `.tournament create Weekly Cup 1000 8` (between 4 and 32 players)');
      if (isNaN(entryFee) || entryFee < 0)
        return message.reply('❌ Entry fee must be 0 or more.');
 
      const tId = mkTournamentId();
      const prizes = getTournamentPrizes(entryFee * maxPlayers);
      tournaments[tId] = {
        id: tId, name, creatorId: userId, channelId: message.channel.id,
        status: 'waiting', maxPlayers, entryFee,
        prizePool: 0, prizes,
        participants: [], rounds: [], currentRound: 0,
        champion: null, createdAt: Date.now(), messageId: null,
      };
      saveTournaments();
 
      const tRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tj_${tId}`).setLabel('✅ Join').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ts_${tId}`).setLabel('🚀 Start tournament').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`tc_${tId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
      );
 
      function buildTEmbed(t) {
        const estPrize = getTournamentPrizes(t.entryFee * t.maxPlayers);
        const pList = t.participants.map((p,i) => `${i+1}. @${p.username}`).join('\n') || '_Nobody yet_';
        return {
          color: 0xFFD700,
          author: { name: `🏆 Tournament created by ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `🏆 ${t.name}`,
          description: [
            `Join with **✅ Join**!`,
            ``,
            `📋 **Format:** Single elimination`,
            `💸 **Entry:** ${t.entryFee.toLocaleString()} 💰`,
            `🏆 **Max prize:** ${(t.entryFee * t.maxPlayers).toLocaleString()} 💰`,
            ``,
            `🥇 Champion: **${estPrize.champion.toLocaleString()} 💰**`,
            `🥈 Runner-up: **${estPrize.runnerUp.toLocaleString()} 💰**`,
            `🥉 Semifinalists: **${estPrize.semifinal.toLocaleString()} 💰**`,
          ].join('\n'),
          fields: [
            { name: `👥 Registered (${t.participants.length}/${t.maxPlayers})`, value: pList, inline: false },
          ],
          footer: { text: `ID: ${tId}  ·  You need a team of 4 to participate` },
          timestamp: new Date().toISOString()
        };
      }
 
      const tMsg = await message.reply({ embeds: [buildTEmbed(tournaments[tId])], components: [tRow] });
      tournaments[tId].messageId = tMsg.id;
      saveTournaments();
 
      const tCol = tMsg.createMessageComponentCollector({ time: 3 * 60 * 60 * 1000 });
      tCol.on('collect', async interaction => {
        const t = tournaments[tId];
        if (!t || t.status !== 'waiting')
          return interaction.reply({ content: '❌ This tournament is no longer available.', ephemeral: true });
 
        if (interaction.customId === `tc_${tId}`) {
          if (interaction.user.id !== t.creatorId && !isAdmin(interaction.user.id))
            return interaction.reply({ content: '❌ Only the creator can cancel.', ephemeral: true });
          for (const p of t.participants)
            if (data[p.id]) data[p.id].coins = (data[p.id].coins||0) + t.entryFee;
          delete tournaments[tId];
          saveTournaments(); saveData(); tCol.stop();
          return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Tournament cancelled', description: 'Entry fees have been refunded.' }], components: [] });
        }
 
        if (interaction.customId === `tj_${tId}`) {
          const jId = interaction.user.id;
          if (t.participants.find(p => p.id === jId))
            return interaction.reply({ content: '❌ You are already registered.', ephemeral: true });
          if (t.participants.length >= t.maxPlayers)
            return interaction.reply({ content: '❌ The tournament is full.', ephemeral: true });
          if (!data[jId] || (data[jId].team||[]).length < 4)
            return interaction.reply({ content: '❌ You need **4 players in your team** (`.team`).', ephemeral: true });
          if (t.entryFee > 0) {
            if ((data[jId]?.coins||0) < t.entryFee)
              return interaction.reply({ content: `❌ You need **${t.entryFee.toLocaleString()} 💰**. You have **${(data[jId]?.coins||0).toLocaleString()} 💰**.`, ephemeral: true });
            data[jId].coins -= t.entryFee;
          }
          t.participants.push({ id: jId, username: interaction.user.username });
          t.prizePool = t.entryFee * t.participants.length;
          saveTournaments(); saveData();
          if (t.participants.length >= t.maxPlayers) {
            await interaction.update({ embeds: [buildTEmbed(t)], components: [tRow] });
            await interaction.followUp({ content: `🏆 **${t.name} is full! Starting tournament automatically...** ` });
            return startTournament(tId, null, tMsg, tCol);
          }
          return interaction.update({ embeds: [buildTEmbed(t)], components: [tRow] });
        }
 
        if (interaction.customId === `ts_${tId}`) {
          if (!isTournamentAdmin(interaction.user.id) && interaction.user.id !== t.creatorId)
            return interaction.reply({ content: '❌ Only the creator can start.', ephemeral: true });
          if (t.participants.length < 2)
            return interaction.reply({ content: '❌ You need at least **2 players** registered.', ephemeral: true });
          return startTournament(tId, interaction, tMsg, tCol);
        }
      });
      tCol.on('end', () => tMsg.edit({ components: [] }).catch(() => {}));
      return;
    }
 
    // ── !tournament list ──
    if (sub === 'list') {
      const list = Object.values(tournaments).filter(t => t.status !== 'finished');
      if (!list.length)
        return message.reply({ embeds: [{ color: 0x2b2d31, title: '🏆 No active tournaments', description: 'There are no tournaments at the moment.\n\nUse `.tournament create <name> <entry> <players>` to create one (admins).' }] });
      return message.reply({
        embeds: [{
          color: 0xFFD700,
          title: '🏆 Active tournaments',
          description: list.map(t =>
            `**${t.name}** \`${t.id}\`\n${getTournamentStatus(t)} · ${t.participants.length}/${t.maxPlayers} players · Prize: ${t.prizePool.toLocaleString()} 💰`
          ).join('\n\n'),
          footer: { text: '.tournament play <id> · !tournament bracket <id>' },
          timestamp: new Date().toISOString()
        }]
      });
    }

    // ── !tournament start <id> ──
    if (sub === 'start') {
      const tId = args[2];
      if (!tId) return message.reply('❌ Usage: `.tournament start <id>`\nEx: `.tournament start T1ABC123`');

      const t = tournaments[tId];
      if (!t) return message.reply('❌ Tournament not found. Use `.tournament list` to see IDs.');
      if (t.status !== 'waiting') {
        if (t.status === 'active')   return message.reply('❌ The tournament is already underway.');
        if (t.status === 'finished') return message.reply('❌ The tournament has already ended.');
        return message.reply('❌ The tournament cannot be started in its current state.');
      }
      if (!isTournamentAdmin(userId) && userId !== t.creatorId)
        return message.reply('❌ Only the tournament creator or an admin can start it.');
      if (t.participants.length < 2)
        return message.reply('❌ You need at least **2 registered players** to start the tournament.');

      // Iniciar el torneo directamente desde el canal (sin editar el mensaje antiguo)
      t.status = 'active';
      t.rounds = buildBracket(t.participants);
      t.currentRound = 0;
      advanceBracket(t);
      saveTournaments();

      const bracketCanvas = await drawBracketCanvas(t).catch(() => null);
      const files = bracketCanvas ? [{ attachment: bracketCanvas.toBuffer(), name: 'bracket.png' }] : [];

      const r = t.rounds[t.currentRound];
      const matchupLines = r.map((m, i) => {
        const p1 = m.p1 ? `@${m.p1.username}` : 'BYE';
        const p2 = m.p2 ? `@${m.p2.username}` : 'BYE';
        if (m.winner) return `~~**Match ${i+1}:** ${p1} vs ${p2}~~ (BYE)`;
        return `**Match ${i+1}:** ${p1}  vs  ${p2}`;
      }).join('\n');

      const mentions = t.participants.map(p => `<@${p.id}>`).join(' ');

      return message.reply({
        content: mentions,
        embeds: [{
          color: 0x00C851,
          title: `🏆 ${t.name} has started!`,
          description: [
            `**${t.participants.length} players** fighting for **${t.prizes.champion.toLocaleString()} 💰**!`,
            '',
            `**📋 Round 1:**`,
            matchupLines,
            '',
            `⚔️ Use \`.tournament play ${tId}\` to play your match.`,
            `📊 Use \`.tournament bracket ${tId}\` to view the bracket.`,
          ].join('\n'),
          fields: [
            { name: '🥇 Champion',      value: `${t.prizes.champion.toLocaleString()} 💰`,  inline: true },
            { name: '🥈 Runner-up',     value: `${t.prizes.runnerUp.toLocaleString()} 💰`,  inline: true },
            { name: '🥉 Semifinalists', value: `${t.prizes.semifinal.toLocaleString()} 💰`, inline: true },
          ],
          image: bracketCanvas ? { url: 'attachment://bracket.png' } : undefined,
          footer: { text: `Tournament ID: ${tId}  ·  Participants: ${t.participants.length}` },
          timestamp: new Date().toISOString()
        }],
        files
      });
    }

    // ── !tournament admin <id> ──
    if (sub === 'admin') {
      const tId = args[2];
      if (!tId) return message.reply('❌ Usage: `.tournament admin <id>`');

      const t = tournaments[tId];
      if (!t) return message.reply('❌ Tournament not found. Use `.tournament list` to see IDs.');
      if (!isTournamentAdmin(userId) && userId !== t.creatorId)
        return message.reply('❌ Only the tournament creator or an admin can manage matches.');
      if (t.status !== 'active')
        return message.reply('❌ The tournament must be active. Use `.tournament start <id>` if it has not started yet.');

      const curRound = t.rounds[t.currentRound];
      const pendingMatches = curRound.filter(m => m.winner === null && m.p1 && m.p2);

      if (pendingMatches.length === 0) {
        return message.reply('✅ No pending matches in this round. All have results.');
      }

      function buildMatchSelectEmbed() {
        const lines = curRound.map((m, i) => {
          const p1 = m.p1 ? `@${m.p1.username}` : 'BYE';
          const p2 = m.p2 ? `@${m.p2.username}` : 'BYE';
          if (m.winner) {
            const winner = t.participants.find(p => p.id === m.winner);
            return `~~Match ${i+1}: ${p1} vs ${p2}~~ ✅ **@${winner?.username || '?'}** won ${m.score ? `(${m.score})` : ''}`;
          }
          if (!m.p1 || !m.p2) return `Match ${i+1}: Automatic BYE`;
          return `**Match ${i+1}:** ${p1} vs ${p2} ⏳ Pending`;
        }).join('\n');

        return {
          color: 0xFF6B00,
          title: `⚙️ Tournament Admin — ${t.name}`,
          description: [
            `**Round ${t.currentRound + 1} / ${t.rounds.length}**`,
            '',
            lines,
            '',
            '**Select the match you want to resolve:**',
          ].join('\n'),
          footer: { text: `ID: ${tId}  ·  You can only edit pending matches` },
          timestamp: new Date().toISOString()
        };
      }

      function buildMatchSelectRow() {
        const btns = pendingMatches.map((m) => {
          const idx = curRound.indexOf(m);
          const p1 = m.p1?.username || 'BYE';
          const p2 = m.p2?.username || 'BYE';
          return new ButtonBuilder()
            .setCustomId(`tadmin_match_${tId}_${idx}_${userId}`)
            .setLabel(`Match ${idx+1}: ${p1} vs ${p2}`)
            .setStyle(ButtonStyle.Primary);
        });

        const rows = [];
        for (let i = 0; i < btns.length; i += 4) {
          rows.push(new ActionRowBuilder().addComponents(btns.slice(i, i + 4)));
        }
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`tadmin_cancel_${userId}`)
            .setLabel('❌ Cancel')
            .setStyle(ButtonStyle.Danger)
        ));
        return rows;
      }

      const adminMsg = await message.reply({
        embeds: [buildMatchSelectEmbed()],
        components: buildMatchSelectRow()
      });

      const adminCol = adminMsg.createMessageComponentCollector({ time: 120000 });

      adminCol.on('collect', async interaction => {
        if (interaction.user.id !== userId)
          return interaction.reply({ content: '❌ This panel is not yours.', ephemeral: true });

        if (interaction.customId === `tadmin_cancel_${userId}`) {
          adminCol.stop();
          return interaction.update({
            embeds: [{ color: 0x555555, title: '❌ Administration cancelled' }],
            components: []
          });
        }

        if (interaction.customId.startsWith(`tadmin_match_${tId}_`)) {
          const parts = interaction.customId.replace(`tadmin_match_${tId}_`, '').replace(`_${userId}`, '').split('_');
          const matchIdx = parseInt(parts[0]);
          const match = curRound[matchIdx];

          if (!match || match.winner !== null)
            return interaction.reply({ content: '❌ That match already has a result.', ephemeral: true });

          const p1 = match.p1;
          const p2 = match.p2;

          const winnerRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`tadmin_win_${tId}_${matchIdx}_${p1.id}_${userId}`)
              .setLabel(`🏆 @${p1.username} wins`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`tadmin_win_${tId}_${matchIdx}_${p2.id}_${userId}`)
              .setLabel(`🏆 @${p2.username} wins`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`tadmin_back_${userId}`)
              .setLabel('⬅️ Back')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`tadmin_cancel_${userId}`)
              .setLabel('❌ Cancel')
              .setStyle(ButtonStyle.Danger)
          );

          const p1Elo = data[p1.id]?.elo || 1000;
          const p2Elo = data[p2.id]?.elo || 1000;
          const t1 = getEloTier(p1Elo);
          const t2 = getEloTier(p2Elo);

          return interaction.update({
            embeds: [{
              color: 0xFF6B00,
              title: `⚙️ Match ${matchIdx + 1} — Choose the winner`,
              description: [
                `**@${p1.username}** ${t1.emoji} ${p1Elo} ELO`,
                `vs`,
                `**@${p2.username}** ${t2.emoji} ${p2Elo} ELO`,
                '',
                'Who advances to the next round?',
              ].join('\n'),
              footer: { text: 'The result will be recorded immediately' }
            }],
            components: [winnerRow]
          });
        }

        if (interaction.customId === `tadmin_back_${userId}`) {
          const stillPending = curRound.filter(m => m.winner === null && m.p1 && m.p2);
          if (stillPending.length === 0) {
            adminCol.stop();
            return interaction.update({
              embeds: [{ color: 0x00C851, title: '✅ Round completed', description: 'All matches in this round have results.' }],
              components: []
            });
          }
          return interaction.update({
            embeds: [buildMatchSelectEmbed()],
            components: buildMatchSelectRow()
          });
        }

        if (interaction.customId.startsWith(`tadmin_win_${tId}_`)) {
          const raw = interaction.customId
            .replace(`tadmin_win_${tId}_`, '')
            .replace(`_${userId}`, '');
          const rawParts  = raw.split('_');
          const matchIdx2 = parseInt(rawParts[0]);
          const winnerId  = rawParts[1];
          const match2    = curRound[matchIdx2];

          if (!match2 || match2.winner !== null)
            return interaction.reply({ content: '❌ That match already has a result.', ephemeral: true });

          const winnerParticipant = t.participants.find(p => p.id === winnerId);
          if (!winnerParticipant)
            return interaction.reply({ content: '❌ Player not found in the tournament.', ephemeral: true });

          const loserParticipant = match2.p1?.id === winnerId ? match2.p2 : match2.p1;

          match2.winner = winnerId;
          match2.score  = 'ADM'; // marcado como resultado administrativo

          if (!data[winnerId])  data[winnerId]  = {};
          if (!data[loserParticipant?.id]) data[loserParticipant?.id] = {};
          if (!data[winnerId].matchHistory)              data[winnerId].matchHistory              = [];
          if (!data[loserParticipant?.id].matchHistory)  data[loserParticipant?.id].matchHistory  = [];

          data[winnerId].matchHistory.unshift({
            type: 'torneo', date: Date.now(),
            oppId: loserParticipant?.id, oppName: loserParticipant?.username,
            myGoals: 1, oppGoals: 0, result: 'win', reward: 0
          });
          if (loserParticipant?.id) {
            data[loserParticipant.id].matchHistory.unshift({
              type: 'torneo', date: Date.now(),
              oppId: winnerId, oppName: winnerParticipant.username,
              myGoals: 0, oppGoals: 1, result: 'loss', reward: 0
            });
          }

          advanceBracket(t);

          if (t.status === 'finished') {
            const champD = data[t.champion];
            if (champD) champD.coins = (champD.coins || 0) + t.prizes.champion;
            if (t.rounds.length >= 2) {
              const sfRound = t.rounds[t.rounds.length - 2];
              const losers = sfRound.flatMap(m => {
                const loser = m.winner === m.p1?.id ? m.p2 : m.p1;
                return loser ? [loser.id] : [];
              });
              for (const lid of new Set(losers)) {
                if (data[lid]) data[lid].coins = (data[lid].coins || 0) + t.prizes.semifinal;
              }
            }
          }

          saveTournaments();
          saveData();

          const bracketCanvas = await drawBracketCanvas(t).catch(() => null);
          const bFiles = bracketCanvas ? [{ attachment: bracketCanvas.toBuffer(), name: 'bracket.png' }] : [];

          adminCol.stop();

          const stillPending2 = t.status === 'active'
            ? t.rounds[t.currentRound]?.filter(m => m.winner === null && m.p1 && m.p2).length || 0
            : 0;

          const finishedDesc = t.status === 'finished'
            ? `\n\n🏆 **The tournament is over! Champion: <@${t.champion}>** (+${t.prizes.champion.toLocaleString()} 💰)`
            : `\n\n⏳ Pending matches in this round: **${stillPending2}**\nUse \`.tournament admin ${tId}\` to continue.`;

          return interaction.update({
            embeds: [{
              color: 0x00C851,
              title: `✅ Result recorded`,
              description: [
                `**@${winnerParticipant.username}** advances to the next round.`,
                loserParticipant ? `**@${loserParticipant.username}** has been eliminated.` : '',
                `📝 Recorded as administrative result (ADM).`,
                finishedDesc,
              ].join('\n'),
              image: bracketCanvas ? { url: 'attachment://bracket.png' } : undefined,
              footer: { text: `ID: ${tId}  ·  Admin: ${message.author.username}` },
              timestamp: new Date().toISOString()
            }],
            files: bFiles,
            components: []
          });
        }
      });

      adminCol.on('end', (_, reason) => {
        if (reason === 'time') adminMsg.edit({ components: [] }).catch(() => {});
      });

      return;
    }

    // ── !tournament force <id> ──
    if (sub === 'force') {
      const tId = args[2];
      if (!isTournamentAdmin(userId)) return message.reply('❌ Admins only.');
      const t = tournaments[tId];
      if (!t) return message.reply('❌ Tournament not found.');
      if (t.status !== 'active') return message.reply('❌ The tournament is not active.');

      const curRound = t.rounds[t.currentRound];
      
      const pending = curRound.filter(m => m.winner === null && m.p1 && m.p2);
      if (pending.length > 0) {
        const lines = pending.map((m) => 
          `⏳ **Pending match:** @${m.p1.username} vs @${m.p2.username}`
        ).join('\n');
        return message.reply({
          embeds: [{
            color: 0xFF6600,
            title: '⚠️ There are matches without a result',
            description: `There are still **${pending.length}** match(es) to be played:\n\n${lines}\n\nDo you still want to force? Use \`.tournament admin ${tId}\` to assign results first.`,
          }]
        });
      }

      const r = t.currentRound;
      const cur = t.rounds[r];

      for (const m of cur) {
        if (m.winner === null) {
          if (!m.p1 && m.p2)  m.winner = m.p2.id;
          if (!m.p2 && m.p1)  m.winner = m.p1.id;
        }
      }

      if (r + 1 < t.rounds.length) {
        const next = t.rounds[r + 1];
        cur.forEach((m, i) => {
          const w = t.participants.find(p => p.id === m.winner) || null;
          if (i % 2 === 0) next[Math.floor(i/2)].p1 = w;
          else             next[Math.floor(i/2)].p2 = w;
        });
        t.currentRound = r + 1;
        advanceBracket(t);
      } else {
        t.champion = cur[0].winner;
        t.status = 'finished';
        const champD = data[t.champion];
        if (champD) champD.coins = (champD.coins || 0) + t.prizes.champion;
      }

      saveTournaments();
      saveData();

      const bracketCanvas = await drawBracketCanvas(t).catch(() => null);
      const bFiles = bracketCanvas ? [{ attachment: bracketCanvas.toBuffer(), name: 'bracket.png' }] : [];

      const r2 = t.rounds[t.currentRound];
      const matchupLines = r2 ? r2.map((m, i) => {
        const p1 = m.p1 ? `@${m.p1.username}` : 'BYE';
        const p2 = m.p2 ? `@${m.p2.username}` : 'BYE';
        if (m.winner) return `~~**Match ${i+1}:** ${p1} vs ${p2}~~ ✅`;
        return `**Match ${i+1}:** ${p1}  vs  ${p2}`;
      }).join('\n') : '—';

      return message.reply({
        embeds: [{
          color: t.status === 'finished' ? 0xFFD700 : 0x00C851,
          title: t.status === 'finished' 
            ? `🏆 Tournament finished! Champion: <@${t.champion}>`
            : `✅ Round advanced — Now on Round ${t.currentRound + 1}`,
          description: t.status === 'finished'
            ? `<@${t.champion}> wins **${t.prizes.champion.toLocaleString()} 💰**!`
            : `**Matches this round:**\n${matchupLines}\n\nUse \`.tournament admin ${tId}\` to assign results or \`.tournament play ${tId}\` to play.`,
          image: bracketCanvas ? { url: 'attachment://bracket.png' } : undefined,
          footer: { text: `ID: ${tId}` },
          timestamp: new Date().toISOString()
        }],
        files: bFiles
      });
    }
 
    // ── !tournament bracket <id> ──
    if (sub === 'bracket') {
      const tId2 = args[2];
      const t2 = tournaments[tId2];
      if (!t2) return message.reply('❌ Tournament not found. Use `.tournament list` to see IDs.');
      if (t2.status === 'waiting') return message.reply('❌ The tournament has not started yet.');
      const canvas = await drawBracketCanvas(t2).catch(() => null);
      if (!canvas) return message.reply('❌ Error generating the bracket.');
      return message.reply({
        embeds: [{
          color: 0xFFD700,
          title: `🏆 Bracket — ${t2.name}`,
          description: `Current round: **${Math.min(t2.currentRound+1, t2.rounds.length)} / ${t2.rounds.length}** · ${getTournamentStatus(t2)}`,
          image: { url: 'attachment://bracket.png' },
          footer: { text: `ID: ${tId2}  ·  !tournament play ${tId2} to play your match` },
          timestamp: new Date().toISOString()
        }],
        files: [{ attachment: canvas.toBuffer(), name: 'bracket.png' }]
      });
    }
 
    // ── !tournament play <id> ──
    if (sub === 'play') {
      const tId3 = args[2];
      const t3 = tournaments[tId3];
      if (!t3) return message.reply('❌ Tournament not found.');
      if (t3.status !== 'active') return message.reply('❌ The tournament is not active.');
      const curMatches = t3.rounds[t3.currentRound];
      const myMatch = curMatches?.find(m => (m.p1?.id === userId || m.p2?.id === userId) && m.winner === null);
      if (!myMatch) return message.reply('❌ You have no pending match in this round, or it has already been played.\n💡 Use `.tournament bracket ' + tId3 + '` to see the status.');
 
      const iAmP1 = myMatch.p1?.id === userId;
      const opp   = iAmP1 ? myMatch.p2 : myMatch.p1;
 
      if (!opp) {
        myMatch.winner = userId; myMatch.score = 'BYE';
        advanceBracket(t3); saveTournaments();
        const bCanvas = await drawBracketCanvas(t3).catch(() => null);
        const bFiles = bCanvas ? [{ attachment: bCanvas.toBuffer(), name: 'bracket.png' }] : [];
        return message.reply({
          embeds: [{ color: 0x00C851, title: '✅ BYE — You advance automatically', description: `You advance to the next round of **${t3.name}**!`, image: bCanvas ? { url: 'attachment://bracket.png' } : undefined }],
          files: bFiles
        });
      }
 
      if (!data[opp.id] || (data[opp.id].team||[]).length < 4)
        return message.reply(`❌ Your opponent **@${opp.username}** does not have a complete team (needs `+"`.team`"+ ` with 4 players).`);
      if ((user.team||[]).length < 4)
        return message.reply('❌ You need **4 players in your team** to play.');
 
      const playRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tp_${tId3}_${userId}`).setLabel(`⚔️ Play vs @${opp.username}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`tpc_${userId}`).setLabel('❌ Cancel').setStyle(ButtonStyle.Secondary)
      );
 
      const pMsg = await message.reply({
        embeds: [{
          color: 0xFF6B00,
          title: `⚔️ Tournament match — ${t3.name}`,
          description: [
            `🏠 **${user.teamName || message.author.username + "'s FC"}** (you)`,
            `vs`,
            `✈️ **${data[opp.id]?.teamName || opp.username + "'s FC"}** (@${opp.username})`,
            ``,
            `🎯 Round: **${t3.currentRound + 1} / ${t3.rounds.length}**`,
            `🏆 Champion prize: **${t3.prizes.champion.toLocaleString()} 💰**`,
            ``,
            `⚠️ **The loser is eliminated.**`,
          ].join('\n'),
          footer: { text: '30 seconds to confirm' },
          timestamp: new Date().toISOString()
        }],
        components: [playRow]
      });
 
      const pCol = pMsg.createMessageComponentCollector({ time: 30000 });
      pCol.on('collect', async interaction => {
        if (interaction.user.id !== userId)
          return interaction.reply({ content: '❌ This match is not yours.', ephemeral: true });
        pCol.stop();
        if (interaction.customId === `tpc_${userId}`)
          return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Match cancelled' }], components: [] });
 
        await interaction.update({ embeds: [{ color: 0xFF6B00, title: '⚔️ Match in progress...', description: '⏳ Simulating...' }], components: [] });
 
        // ── Motor de partido ──
        const SLOT_P = ['GK','DM','AM','ST'], PEN = 8;
        const RB = { Common:0.00, Rare:0.05, Epic:0.10, Legendary:0.18, WorldCup:0.48, Icon:0.56 };
        function calcOvr2(team) { return team.reduce((s,p,i) => s+(p.rating-(p.position!==SLOT_P[i]?PEN:0)),0)/team.length; }
        const myO  = calcOvr2(data[userId].team);
        const oppO = calcOvr2(data[opp.id].team);
        let rb = 0;
        for (const p of data[userId].team)  rb += RB[p.rarity]||0;
        for (const p of data[opp.id].team)  rb -= RB[p.rarity]||0;
        const myW = Math.max(0.25, Math.min(0.85, 0.65*(myO/(myO+oppO)) + 0.35*(0.5+rb)));
        let myG=0, oppG=0;
        for (let i=0; i<3+Math.floor(Math.random()*5); i++) Math.random()<myW ? myG++ : oppG++;
        if (myG===oppG) { myG+=Math.random()<myW?1:0; oppG+=Math.random()<(1-myW)?1:0; }
        if (myG===oppG) myG++;
        const iWon = myG > oppG;
        const score = `${myG}-${oppG}`;
        myMatch.winner = iWon ? userId : opp.id;
        myMatch.score  = score;
 
        if (!data[userId].matchHistory)  data[userId].matchHistory  = [];
        if (!data[opp.id].matchHistory)  data[opp.id].matchHistory  = [];
        data[userId].matchHistory.unshift({ type:'torneo', date:Date.now(), oppId:opp.id, oppName:opp.username, myGoals:myG, oppGoals:oppG, result:iWon?'win':'loss', reward:0 });
        data[opp.id].matchHistory.unshift({ type:'torneo', date:Date.now(), oppId:userId,  oppName:message.author.username, myGoals:oppG, oppGoals:myG, result:iWon?'loss':'win', reward:0 });
 
        advanceBracket(t3);
 
        if (t3.status === 'finished') {
          const champD = data[t3.champion];
          if (champD) { champD.coins = (champD.coins||0) + t3.prizes.champion; }
          if (t3.rounds.length >= 2) {
            const sfRound = t3.rounds[t3.rounds.length - 2];
            const losers = sfRound.flatMap(m => {
              const loser = m.winner === m.p1?.id ? m.p2 : m.p1;
              return loser ? [loser.id] : [];
            });
            for (const lid of new Set(losers)) {
              if (data[lid]) data[lid].coins = (data[lid].coins||0) + t3.prizes.semifinal;
            }
          }
          await message.channel.send({
            embeds: [{ color:0xFFD700, title:`🏆 CHAMPION OF "${t3.name}"!`,
              description:`<@${t3.champion}> is the **CHAMPION** and wins **${t3.prizes.champion.toLocaleString()} 💰**! 🎉`,
              timestamp: new Date().toISOString() }]
          }).catch(()=>{});
        }
        saveTournaments(); saveData();
 
        const bCanvas2 = await drawBracketCanvas(t3).catch(() => null);
        const bFiles2 = bCanvas2 ? [{ attachment: bCanvas2.toBuffer(), name:'bracket.png' }] : [];
        await pMsg.edit({
          embeds: [{
            color: iWon ? 0x00C851 : 0xFF4444,
            title: iWon ? `🏆 VICTORY! ${score}` : `💀 Eliminated — ${score}`,
            description: [
              `**${user.teamName||message.author.username+"'s FC"}** ${myG} - ${oppG} **${data[opp.id]?.teamName||opp.username+"'s FC"}**`,
              iWon ? `\n✅ You advance to the next round!` : `\n💔 You have been eliminated from the tournament.`,
              t3.status==='finished' ? `\n🏆 **${t3.champion===userId?'YOU ARE THE CHAMPION! 🎉':'The tournament is over'}**` : ''
            ].join('\n'),
            image: bCanvas2 ? { url:'attachment://bracket.png' } : undefined,
            footer: { text:`.tournament bracket ${tId3} to see the bracket` },
            timestamp: new Date().toISOString()
          }],
          files: bFiles2, components: []
        }).catch(()=>{});
      });
      pCol.on('end', (_, reason) => { if (reason==='time') pMsg.edit({ components:[] }).catch(()=>{}); });
      return;
    }
 
    // ── Help ──
    return message.reply({
      embeds: [{
        color: 0xFFD700,
        title: '🏆 Tournaments — Help',
        fields: [
          { name: '`.tournament create <name> <entry> <maxPlayers>`', value: 'Create tournament (admins only)\nEx: `.tournament create Weekly Cup 1000 8`', inline: false },
          { name: '`.tournament list`',            value: 'View active tournaments',                                                                     inline: false },
          { name: '`.tournament bracket <id>`',    value: 'View the visual bracket',                                                                     inline: false },
          { name: '`.tournament play <id>`',       value: 'Play your pending match',                                                                     inline: false },
          { name: '`.tournament force <id>`',      value: 'Force advance to the next round if all matches have results (admins only)',                   inline: false },
          { name: '`.tournament admin <id>`',      value: 'Manually manage results — choose who advances (creator or admin)',                            inline: false },
          { name: '`.tournament start <id>`',      value: 'Manually start a tournament (creator or admin)',                                              inline: false },
        ],
        footer: { text: 'Prizes are distributed automatically · You need a team of 4 to participate' }
      }]
    });
  }
```
```


// ─────────────────────────────────────────
  // 👑 ADMIN
  // ─────────────────────────────────────────
  if (isAdmin(userId)) {

    if (cmd === '.giveme') {
      const amount = parseInt(args[1]);
      if (isNaN(amount)) return message.reply('❌ Pon una cantidad válida.');
      user.coins += amount; saveData();
      return message.reply(`✅ Te diste **${amount}** ${EMOJI_COIN}`);
    }

    if (cmd === '.give') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount)) return message.reply('❌ Uso: `.give @usuario cantidad`');
      if (!data[target.id]) data[target.id] = { coins: 0, players: [], team: [], packs: { silver: 0, bronze: 0, gold: 0, legend: 0 }, elo: 1000, daily: { lastClaim: 0, streak: 0 } };
      data[target.id].coins += amount; saveData();
      return message.reply(`✅ Le diste **${amount}** ${EMOJI_COIN} a **${target.username}**`);
    }

    if (cmd === '.givepack') {
      const target = message.mentions.users.first();
      const type   = (args[2] || '').toLowerCase();
      const amount = parseInt(args[3]) || 1;
      if (!target || !packs[type]) return message.reply('❌ Uso: `.givepack @usuario silver/bronze/gold/legend/worldcup/icon [cantidad]`');
      if (!data[target.id]) data[target.id] = { coins: 0, players: [], team: [], packs: { silver: 0, bronze: 0, gold: 0, legend: 0 }, elo: 1000, daily: { lastClaim: 0, streak: 0 } };
      if (!data[target.id].packs) data[target.id].packs = { silver: 0, bronze: 0, gold: 0, legend: 0 };
      data[target.id].packs[type] += amount; saveData();
      return message.reply(`✅ Le diste **${amount}** pack(s) **${packs[type].label}** a **${target.username}**`);
    }


if (cmd === '.resetelo') {
  if (!isAdmin(userId)) return message.reply('❌ Solo admins.');
  
  const target = args[1]?.toLowerCase();
  if (target !== 'all') return message.reply('❌ Uso: `.resetelo all` para resetear el ELO de todos los jugadores.');

  const totalUsers = Object.keys(data).length;
  
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`resetelo_confirm_${userId}`)
      .setLabel(`⚠️ Confirmar — Resetear ${totalUsers} jugadores`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`resetelo_cancel_${userId}`)
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmMsg = await message.reply({
    embeds: [{
      color: 0xFF4444,
      title: '⚠️ Confirmar Reset de ELO Global',
      description: [
        `Estás a punto de **resetear el ELO de TODOS los jugadores** a **1000**.`,
        ``,
        `👥 Jugadores afectados: **${totalUsers}**`,
        `📊 ELO nuevo: **1000** (Oro 🥇)`,
        ``,
        `⚠️ **Esta acción no se puede deshacer.**`,
      ].join('\n'),
      footer: { text: '⏱️ Tienes 30 segundos para confirmar' },
      timestamp: new Date().toISOString()
    }],
    components: [confirmRow]
  });

  const col = confirmMsg.createMessageComponentCollector({ time: 30000 });
  col.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ Este panel no es tuyo.', ephemeral: true });

    col.stop();

    if (interaction.customId === `resetelo_cancel_${userId}`) {
      return interaction.update({
        embeds: [{ color: 0x555555, title: '❌ Reset cancelado', description: 'No se modificó ningún ELO.' }],
        components: []
      });
    }

    if (interaction.customId === `resetelo_confirm_${userId}`) {
      let count = 0;
      for (const uid of Object.keys(data)) {
        data[uid].elo = 1000;
        count++;
      }
      saveData();

      return interaction.update({
        embeds: [{
          color: 0x00C851,
          title: '✅ ELO reseteado globalmente',
          description: [
            `El ELO de **${count} jugadores** fue reseteado a **1000**.`,
            ``,
            `📊 Todos los jugadores están ahora en **Oro 🥇**`,
          ].join('\n'),
          footer: { text: `Ejecutado por ${message.author.username}` },
          timestamp: new Date().toISOString()
        }],
        components: []
      });
    }
  });

  col.on('end', (_, reason) => {
    if (reason === 'time') {
      confirmMsg.edit({
        embeds: [{ color: 0x555555, title: '⏱️ Expirado', description: 'No confirmaste a tiempo. No se modificó ningún ELO.' }],
        components: []
      }).catch(() => {});
    }
  });

  return;
}

    if (cmd === '.givecard') {
      const target   = message.mentions.users.first();
      const cardName = args.slice(2).join(' ').trim();
      if (!target || !cardName) return message.reply('❌ Uso: `.givecard @usuario NombreJugador`');
      const found = players.find(p => p.name.toLowerCase() === cardName.toLowerCase());
      if (!found) return message.reply(`❌ Jugador **${cardName}** no existe.`);
      if (!data[target.id]) data[target.id] = { coins: 1000, players: [], team: [], teamName: target.username + "'s FC", packs: { silver: 0, bronze: 0, gold: 0, legend: 0 }, elo: 1000, daily: { lastClaim: 0, streak: 0 } };
      if (!data[target.id].players) data[target.id].players = [];
      data[target.id].players.push({ ...found, stats: { ...found.stats } }); saveData();
      return message.reply(`✅ Le diste la carta **${found.name}** (${found.rarity} · ${found.rating} OVR · ${found.position}) a **${target.username}**`);
    }

    if (cmd === '.take') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount)) return message.reply('❌ Uso: `.take @usuario cantidad`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].coins = Math.max(0, (data[target.id].coins || 0) - amount); saveData();
      return message.reply(`✅ Le quitaste **${amount}** ${EMOJI_COIN} a **${target.username}** (saldo: **${data[target.id].coins}** ${EMOJI_COIN})`);
    }

    if (cmd === '.resetuser') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.resetuser @usuario`');
      data[target.id] = { coins: 1800, players: [], team: [], teamName: target.username + "'s FC", packs: { silver: 0, bronze: 0, gold: 0, legend: 0 }, elo: 1000, daily: { lastClaim: 0, streak: 0 } };
      saveData();
      return message.reply(`✅ Cuenta de **${target.username}** reseteada.`);
    }

    if (cmd === '.profile') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.profile @usuario`');
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil todavía.');
      const tier = getEloTier(t.elo || 1000);
      return message.reply({ embeds: [{ color: 0x9B59B6, title: `🔍 Perfil de ${target.username}`, fields: [
        { name: '💰 Monedas',     value: `${t.coins || 0}`,                                  inline: true },
        { name: `📊 ELO ${tier.emoji}`, value: `${t.elo || 1000} (${tier.name})`,            inline: true },
        { name: '🃏 Club',        value: `${(t.players || []).length}/${MAX_CLUB_SIZE}`,      inline: true },
        { name: '👥 Equipo',      value: `${(t.team || []).length}/4`,                        inline: true },
        { name: '📦 Packs', value: `⚪${(t.packs || {}).silver || 0} 🥉${(t.packs || {}).bronze || 0} 🥇${(t.packs || {}).gold || 0} 💎${(t.packs || {}).legend || 0} 🏆${(t.packs || {}).worldcup || 0} ⭐${(t.packs || {}).icon || 0}`, inline: true },
        { name: '🔥 Racha',       value: `${(t.daily || {}).streak || 0} días`,               inline: true },
        { name: '🏟️ Club',        value: t.teamName || `${target.username}'s FC`,             inline: false },
      ], footer: { text: `ID: ${target.id}  ·  ${isAdmin(target.id) ? '👑 Es admin' : 'Usuario normal'}` }, timestamp: new Date().toISOString() }] });
    }

    if (cmd === '.setelo') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount)) return message.reply('❌ Uso: `.setelo @usuario cantidad`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].elo = amount; saveData();
      return message.reply(`✅ ELO de **${target.username}** establecido a **${amount}**`);
    }

    if (cmd === '.resetdaily') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.resetdaily @usuario`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].daily = { lastClaim: 0, streak: 0, claimedMilestones: [] }; saveData();
      return message.reply(`✅ Daily de **${target.username}** reseteado.`);
    }

    if (cmd === '.clearteam') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.clearteam @usuario`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].team = []; saveData();
      return message.reply(`✅ Equipo de **${target.username}** limpiado.`);
    }

    if (cmd === '.clearclub') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.clearclub @usuario`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].players = [];
      data[target.id].team    = []; saveData();
      return message.reply(`✅ Club y equipo de **${target.username}** limpiados completamente.`);
    }

    if (cmd === '.removelogo') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.removelogo @usuario`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      if (!data[target.id].clubLogo) return message.reply(`❌ **${target.username}** no tiene logo.`);
      data[target.id].clubLogo = null; saveData();
      return message.reply(`✅ Logo de **${target.username}** eliminado.`);
    }

   

    // ─────────────────────────────────────────
    // 👑 ADMIN — VER CLUB DE USUARIO
    // ─────────────────────────────────────────
    if (cmd === '.adminclub') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.adminclub @usuario`');
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil.');

      const players_list = t.players || [];
      let page = 0;
      const totalPages = Math.max(1, Math.ceil(players_list.length / 8));
      const rarityEmoji = { "Legendary": "🟡", "Epic": "🟣", "Rare": "🔵", "Common": "⚪" };
      const posEmoji    = { "GK": "🧤", "DM": "🛡️", "AM": "🎯", "ST": "⚽" };

      function buildAdminClubEmbed(p) {
        const start = p * 8;
        const slice = players_list.slice(start, start + 8);
        const totalSellValue = players_list.reduce((s, pl) => s + (SELL_PRICES[pl.rarity] || 90), 0);
        const fields = slice.map((pl, i) => ({
          name: `${start + i + 1}. ${rarityEmoji[pl.rarity] || '⚫'} ${posEmoji[pl.position] || '👤'} **${pl.name}**`,
          value: `\`${pl.rating} OVR\` · ${pl.position} · ${pl.rarity}${(t.team || []).some(tp => tp.name === pl.name) ? ' · ✅ En equipo' : ''}`,
          inline: true
        }));
        if (!fields.length) fields.push({ name: '😔 Sin jugadores', value: 'Club vacío', inline: false });
        return {
          embeds: [{
            color: 0x9B59B6,
            author: { name: `👑 Admin · Club de ${target.username}` },
            title: `🏟️ ${t.teamName || target.username + "'s FC"}`,
            description: `**${players_list.length}/${MAX_CLUB_SIZE}** jugadores · Página **${p + 1}/${totalPages}**\n💰 Coins: **${(t.coins || 0).toLocaleString()}** · 💸 Sell value: **${totalSellValue.toLocaleString()}** · 📊 ELO: **${t.elo || 1000}**`,
            fields,
            footer: { text: `ID: ${target.id}` },
            timestamp: new Date().toISOString()
          }]
        };
      }

      function buildAdminClubRow(p) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`aclub_prev_${userId}`).setLabel('◀ Anterior').setStyle(ButtonStyle.Primary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`aclub_page_${userId}`).setLabel(`${p + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`aclub_next_${userId}`).setLabel('Siguiente ▶').setStyle(ButtonStyle.Primary).setDisabled(p >= totalPages - 1)
        );
      }

      const clubMsg = await message.reply({ ...buildAdminClubEmbed(page), components: totalPages > 1 ? [buildAdminClubRow(page)] : [] });
      if (totalPages <= 1) return;

      const col = clubMsg.createMessageComponentCollector({ time: 120000 });
      col.on('collect', interaction => {
        if (interaction.user.id !== userId) return interaction.reply({ content: '❌ No es tuyo.', ephemeral: true });
        if (interaction.customId === `aclub_next_${userId}` && page < totalPages - 1) page++;
        if (interaction.customId === `aclub_prev_${userId}` && page > 0) page--;
        interaction.update({ ...buildAdminClubEmbed(page), components: [buildAdminClubRow(page)] });
      });
      col.on('end', () => clubMsg.edit({ components: [] }).catch(() => {}));
      return;
    }

    // ─────────────────────────────────────────
    // 👑 ADMIN — VER TEAM DE USUARIO
    // ─────────────────────────────────────────
    if (cmd === '.adminteam') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.adminteam @usuario`');
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil.');

      const team        = t.team || [];
      const rarityEmoji = { "Legendary": "🟡", "Epic": "🟣", "Rare": "🔵", "Common": "⚪" };
      const posEmoji    = { "GK": "🧤", "DM": "🛡️", "AM": "🎯", "ST": "⚽" };
      const slotLabels  = ['GK', 'DM', 'AM', 'ST'];
      const tier        = getEloTier(t.elo || 1000);

      const teamInfo = team.map((p, i) =>
        `${posEmoji[slotLabels[i]] || '👤'} ${rarityEmoji[p.rarity] || '⚫'} **${p.name}** · ${p.rating} OVR · ${p.position} _(slot ${slotLabels[i]})_`
      ).join('\n') || '_Equipo vacío_';

      const avg = team.length > 0
        ? Math.round(team.reduce((s, p) => s + p.rating, 0) / team.length)
        : 0;

      return message.reply({
        embeds: [{
          color: 0x9B59B6,
          author: { name: `👑 Admin · Equipo de ${target.username}` },
          title: `⚽ ${t.teamName || target.username + "'s FC"}`,
          description: teamInfo,
          fields: [
            { name: '⭐ OVR Promedio',      value: `${avg}`,                                    inline: true },
            { name: '👥 Jugadores',          value: `${team.length}/4`,                          inline: true },
            { name: `📊 ELO ${tier.emoji}`, value: `${t.elo || 1000} (${tier.name})`,            inline: true },
            { name: '💰 Coins',              value: `${(t.coins || 0).toLocaleString()}`,         inline: true },
            { name: '🎒 Packs',              value: `⚪${(t.packs || {}).silver || 0} 🥉${(t.packs || {}).bronze || 0} 🥇${(t.packs || {}).gold || 0} 💎${(t.packs || {}).legend || 0} 🏆${(t.packs || {}).worldcup || 0} ⭐${(t.packs || {}).icon || 0}`, inline: true },
            { name: '🏟️ Club size',          value: `${(t.players || []).length}/${MAX_CLUB_SIZE}`, inline: true },
          ],
          footer: { text: `ID: ${target.id}  ·  Racha: ${(t.daily || {}).streak || 0} días` },
          timestamp: new Date().toISOString()
        }]
      });
    }

    // ─────────────────────────────────────────
    // 👑 ADMIN — QUITAR JUGADOR DEL CLUB
    // ─────────────────────────────────────────
    if (cmd === '.adminremove') {
      const target     = message.mentions.users.first();
      const playerName = args.slice(2).join(' ').trim();
      if (!target || !playerName) return message.reply('❌ Uso: `.adminremove @usuario <nombre jugador>`');
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil.');

      const idx = (t.players || []).findLastIndex(p => p.name.toLowerCase() === playerName.toLowerCase());
      if (idx === -1) return message.reply(`❌ **${playerName}** no está en el club de **${target.username}**.`);

      const removed = t.players[idx];
      t.players.splice(idx, 1);
      t.team = (t.team || []).filter(p => p.name.toLowerCase() !== playerName.toLowerCase());
      saveData();

      return message.reply({
        embeds: [{
          color: 0xFF4444,
          title: '🗑️ Jugador eliminado del club',
          description: `**${removed.name}** (${removed.rarity} · ${removed.rating} OVR · ${removed.position}) fue eliminado del club de **${target.username}**.`,
          fields: [
            { name: '🏟️ Club restante',   value: `${t.players.length}/${MAX_CLUB_SIZE} jugadores`, inline: true },
            { name: '👥 Equipo restante', value: `${(t.team || []).length}/4 jugadores`,            inline: true },
          ],
          footer: { text: `Admin: ${message.author.username}  ·  ID target: ${target.id}` },
          timestamp: new Date().toISOString()
        }]
      });
    }

    // ─────────────────────────────────────────
    // 👑 ADMIN — QUITAR TODOS POR RAREZA
    // ─────────────────────────────────────────
    if (cmd === '.adminremoverarity') {
      const target        = message.mentions.users.first();
      const rarity        = args[2];
      const validRarities = ['Common', 'Rare', 'Epic', 'Legendary'];
      if (!target || !rarity) return message.reply('❌ Uso: `.adminremoverarity @usuario <Common/Rare/Epic/Legendary>`');
      if (!validRarities.includes(rarity)) return message.reply(`❌ Rareza inválida. Usa: ${validRarities.join(', ')}`);
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil.');

      const removed = (t.players || []).filter(p => p.rarity === rarity);
      t.players = (t.players || []).filter(p => p.rarity !== rarity);
      t.team    = (t.team    || []).filter(p => p.rarity !== rarity);
      saveData();

      return message.reply({
        embeds: [{
          color: 0xFF6600,
          title: `🗑️ Jugadores ${rarity} eliminados`,
          description: `Se eliminaron **${removed.length}** jugadores de rareza **${rarity}** del club de **${target.username}**.`,
          fields: [
            { name: '🏟️ Club restante', value: `${t.players.length}/${MAX_CLUB_SIZE}`,                              inline: true },
            { name: '📦 Eliminados',     value: removed.length ? removed.map(p => p.name).join(', ') : 'Ninguno', inline: false },
          ],
          footer: { text: `Admin: ${message.author.username}` },
          timestamp: new Date().toISOString()
        }]
      });
    }

// ─────────────────────────────────────────
 // 👑 ADMIN — QUITAR TODOS LOS CLANES
if (cmd === '.adminclans') {
  const totalClans = Object.keys(clansData).length;
  const totalMembers = Object.values(clansData).reduce((s, c) => s + c.members.length, 0);

  if (totalClans === 0) return message.reply('❌ No hay ningún clan registrado actualmente.');

  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`adminclans_confirm_${userId}`)
      .setLabel(`💀 Eliminar ${totalClans} clan(es)`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`adminclans_cancel_${userId}`)
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmMsg = await message.reply({
    embeds: [{
      color: 0xFF4444,
      title: '⚠️ Eliminar todos los clanes',
      description: [
        `Estás a punto de **eliminar TODOS los clanes** del servidor.`,
        ``,
        `🏰 Clanes registrados: **${totalClans}**`,
        `👥 Miembros afectados: **${totalMembers}**`,
        ``,
        `⚠️ **Esta acción no se puede deshacer.**`,
        `Los jugadores quedarán sin clan y podrán crear uno nuevo.`,
      ].join('\n'),
      footer: { text: '⏱️ Tienes 30 segundos para confirmar' },
      timestamp: new Date().toISOString()
    }],
    components: [confirmRow]
  });

  const col = confirmMsg.createMessageComponentCollector({ time: 30000 });
  col.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ Este panel no es tuyo.', ephemeral: true });

    col.stop();

    if (interaction.customId === `adminclans_cancel_${userId}`) {
      return interaction.update({
        embeds: [{ color: 0x555555, title: '❌ Cancelado', description: 'No se eliminó ningún clan.' }],
        components: []
      });
    }

    if (interaction.customId === `adminclans_confirm_${userId}`) {
      const names = Object.values(clansData).map(c => `• **${c.name}** (${c.members.length} miembros)`).join('\n');
      clansData = {};
      saveClans();

      return interaction.update({
        embeds: [{
          color: 0xFF4444,
          title: '💀 Todos los clanes eliminados',
          description: [
            `Se eliminaron **${totalClans}** clan(es) y **${totalMembers}** miembro(s) fueron liberados.`,
            ``,
            `**Clanes eliminados:**`,
            names,
          ].join('\n'),
          footer: { text: `Ejecutado por ${message.author.username}` },
          timestamp: new Date().toISOString()
        }],
        components: []
      });
    }
  });

  col.on('end', (_, reason) => {
    if (reason === 'time') {
      confirmMsg.edit({
        embeds: [{ color: 0x555555, title: '⏱️ Expirado', description: 'No confirmaste a tiempo. No se eliminó ningún clan.' }],
        components: []
      }).catch(() => {});
    }
  });

  return;
}

    // ─────────────────────────────────────────
    // 👑 ADMIN — INFO COMPLETA DE USUARIO
    // ─────────────────────────────────────────
    if (cmd === '.admininfo') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.admininfo @usuario`');
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil.');

      const players_list = t.players || [];
      const team         = t.team    || [];
      const tier         = getEloTier(t.elo || 1000);

      const MARKET_MULTIPLIER  = { "Legendary": 18, "Epic": 10, "Rare": 5, "Common": 2.5 };
      const totalSellValue     = players_list.reduce((s, p) => s + (SELL_PRICES[p.rarity] || 90), 0);
      const totalMarketValue   = players_list.reduce((s, p) => s + Math.round(p.rating * p.rating * (MARKET_MULTIPLIER[p.rarity] || 2.5)), 0);

      const byRarity = { Legendary: 0, Epic: 0, Rare: 0, Common: 0 };
      players_list.forEach(p => { if (byRarity[p.rarity] !== undefined) byRarity[p.rarity]++; });

      const sorted    = [...players_list].sort((a, b) => b.rating - a.rating);
      const topPlayer = sorted[0];
      const avgOvr    = players_list.length > 0
        ? Math.round(players_list.reduce((s, p) => s + p.rating, 0) / players_list.length)
        : 0;

      const lastDaily = t.daily?.lastClaim
        ? `<t:${Math.floor(t.daily.lastClaim / 1000)}:R>`
        : 'Nunca';

      return message.reply({
        embeds: [{
          color: 0x9B59B6,
          author: { name: `👑 Admin · Info completa de ${target.username}` },
          thumbnail: { url: target.displayAvatarURL({ dynamic: true }) },
          fields: [
            { name: '💰 Coins',              value: `${(t.coins || 0).toLocaleString()}`,           inline: true },
            { name: `📊 ELO ${tier.emoji}`,  value: `**${t.elo || 1000}** (${tier.name})`,          inline: true },
            { name: '🔥 Racha daily',         value: `${(t.daily || {}).streak || 0} días`,          inline: true },
            { name: '🏟️ Club',               value: `${players_list.length}/${MAX_CLUB_SIZE}`,       inline: true },
            { name: '👥 Equipo',              value: `${team.length}/4`,                              inline: true },
            { name: '⭐ OVR Promedio',        value: `${avgOvr}`,                                    inline: true },
            { name: '📦 Packs',               value: `⚪${(t.packs || {}).silver || 0} 🥉${(t.packs || {}).bronze || 0} 🥇${(t.packs || {}).gold || 0} 💎${(t.packs || {}).legend || 0} 🏆${(t.packs || {}).worldcup || 0} ⭐${(t.packs || {}).icon || 0}`, inline: true },
            { name: '🃏 Por rareza',           value: `🟡${byRarity.Legendary} 🟣${byRarity.Epic} 🔵${byRarity.Rare} ⚪${byRarity.Common}`, inline: true },
            { name: '🖼️ Logo de club',        value: t.clubLogo ? '✅ Tiene logo' : '❌ Sin logo',   inline: true },
            { name: '💸 Sell value',           value: `${totalSellValue.toLocaleString()} 💰`,        inline: true },
            { name: '📈 Market value',         value: `${totalMarketValue.toLocaleString()} 💰`,      inline: true },
            { name: '🏦 Recursos totales',     value: `${((t.coins || 0) + totalSellValue).toLocaleString()} 💰`, inline: true },
            { name: '👑 Mejor jugador',        value: topPlayer ? `**${topPlayer.name}** (${topPlayer.rating} OVR · ${topPlayer.rarity})` : 'Ninguno', inline: false },
            { name: '📅 Último daily',         value: lastDaily,                                      inline: true },
            { name: '🏟️ Nombre del club',     value: t.teamName || target.username + "'s FC",        inline: true },
          ],
          footer: { text: `ID: ${target.id}  ·  ${isAdmin(target.id) ? '👑 Es admin' : 'Usuario normal'}` },
          timestamp: new Date().toISOString()
        }]
      });
    }

    // ─────────────────────────────────────────
    // 👑 ADMIN — ESTADÍSTICAS GLOBALES
    // ─────────────────────────────────────────
    if (cmd === '.info') {
      const totalUsers    = Object.keys(data).length;
      const totalPlayers  = Object.values(data).reduce((s, u) => s + (u.players || []).length, 0);
      const totalCoins    = Object.values(data).reduce((s, u) => s + (u.coins || 0), 0);
      const usersWithTeam = Object.values(data).filter(u => (u.team || []).length === 4).length;
      const usersWithLogo = Object.values(data).filter(u => u.clubLogo).length;
      const topUser       = Object.entries(data).sort((a, b) => (b[1].elo || 1000) - (a[1].elo || 1000))[0];
      return message.reply({ embeds: [{
        color: 0x9B59B6,
        title: '📊 Estadísticas globales del bot',
        fields: [
          { name: '👥 Usuarios registrados',      value: `**${totalUsers}**`,                  inline: true },
          { name: '🃏 Jugadores en circulación',  value: `**${totalPlayers}**`,                 inline: true },
          { name: '💰 Monedas en circulación',    value: `**${totalCoins.toLocaleString()}**`,  inline: true },
          { name: '⚽ Equipos completos',          value: `**${usersWithTeam}**`,                inline: true },
          { name: '🖼️ Clubs con logo',            value: `**${usersWithLogo}**`,                inline: true },
          { name: '👑 Líder ELO',                  value: topUser ? `<@${topUser[0]}> — **${topUser[1].elo || 1000}** ELO` : '—', inline: true },
        ],
        footer: { text: `Solicitado por ${message.author.username}` },
        timestamp: new Date().toISOString()
      }]});
    }

    // ─────────────────────────────────────────
    // 👑 ADMIN — ANUNCIO
    // ─────────────────────────────────────────
    if (cmd === '.anuncio') {
      const texto = args.slice(1).join(' ');
      if (!texto) return message.reply('❌ Uso: `.anuncio <mensaje>`');
      return message.channel.send({ embeds: [{ color: 0xFF4500, title: '📢 ANUNCIO OFICIAL', description: texto, footer: { text: `Publicado por ${message.author.username}` }, timestamp: new Date().toISOString() }] });
    }

    // ─────────────────────────────────────────
    // 👑 ADMIN — GESTIÓN DE ADMINS
    // ─────────────────────────────────────────
    if (cmd === '.admins') {
      const lista = [...admins].map((id, i) => i === 0 ? `👑 <@${id}> (Super Admin)` : `🛡️ <@${id}>`).join('\n');
      return message.reply({ embeds: [{ color: 0xFFD700, title: '👑 Lista de Admins', description: lista || 'Sin admins.', footer: { text: `Total: ${admins.size} admin(s)` } }] });
    }

    if (cmd === '.addadmin') {
      if (userId !== superAdminId) return message.reply('❌ Solo el Super Admin puede agregar admins.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.addadmin @usuario`');
      if (admins.has(target.id)) return message.reply(`❌ **${target.username}** ya es admin.`);
      admins.add(target.id); saveAdmins();
      return message.reply(`✅ **${target.username}** ahora es admin. 🛡️`);
    }

    if (cmd === '.removeadmin') {
      if (userId !== superAdminId) return message.reply('❌ Solo el Super Admin puede quitar admins.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `.removeadmin @usuario`');
      if (target.id === superAdminId) return message.reply('❌ No puedes quitarte a ti mismo como Super Admin.');
      if (!admins.has(target.id)) return message.reply(`❌ **${target.username}** no es admin.`);
      admins.delete(target.id); saveAdmins();
      return message.reply(`✅ **${target.username}** ya no es admin.`);
    }

 // ─────────────────────────────────────────
 // 👑 ADMIN — GESTIÓN DE ADMINS TORNEO
 // ─────────────────────────────────────────
if (cmd === '.addtadmin') {
  if (userId !== superAdminId) return message.reply('❌ Solo el Super Admin puede agregar admins de torneo.');
  const target = message.mentions.users.first();
  if (!target) return message.reply('❌ Uso: `.addtadmin @usuario`');
  if (tournamentAdmins.has(target.id)) return message.reply(`❌ **${target.username}** ya es admin de torneo.`);
  if (admins.has(target.id)) return message.reply(`❌ **${target.username}** ya es admin general, tiene permisos de torneo incluidos.`);
  tournamentAdmins.add(target.id);
  saveTournamentAdmins();
  return message.reply({
    embeds: [{
      color: 0xFFD700,
      title: '🏆 Admin de torneo agregado',
      description: `**${target.username}** ahora puede crear y gestionar torneos.`,
      fields: [
        { name: '✅ Puede usar', value: '`.torneo crear` · `.torneo iniciar` · `.torneo admin` · `.torneo forzar`', inline: false },
        { name: '❌ No puede usar', value: 'Comandos de admin general (`.give`, `.givecard`, etc.)', inline: false },
      ],
      footer: { text: `Agregado por ${message.author.username}` },
      timestamp: new Date().toISOString()
    }]
  });
}

if (cmd === '.removetadmin') {
  if (userId !== superAdminId) return message.reply('❌ Solo el Super Admin puede quitar admins de torneo.');
  const target = message.mentions.users.first();
  if (!target) return message.reply('❌ Uso: `.removetadmin @usuario`');
  if (!tournamentAdmins.has(target.id)) return message.reply(`❌ **${target.username}** no es admin de torneo.`);
  tournamentAdmins.delete(target.id);
  saveTournamentAdmins();
  return message.reply(`✅ **${target.username}** ya no es admin de torneo.`);
}

if (cmd === '.tadmins') {
  const lista = [...tournamentAdmins].map((id, i) => `🏆 <@${id}>`).join('\n');
  return message.reply({
    embeds: [{
      color: 0xFFD700,
      title: '🏆 Admins de Torneo',
      description: lista || '_Sin admins de torneo registrados._',
      footer: { text: `Total: ${tournamentAdmins.size} · Los admins generales también tienen estos permisos` }
    }]
  });
}

    // ─────────────────────────────────────────
    // 👑 ADMIN — UPDATEPLAYERS
    // ─────────────────────────────────────────
    if (cmd === '.updateplayers') {
  let updated = 0;
  for (const uid of Object.keys(data)) {
    const u = data[uid];
    for (const p of (u.players || [])) {
      const base = players.find(b => b.name === p.name);
      if (base) {
        p.rating   = base.rating;
        p.rarity   = base.rarity;
        p.position = base.position;
        p.stats    = { ...base.stats };  // ← esta línea faltaba
        updated++;
      }
    }
    for (const p of (u.team || [])) {
      const base = players.find(b => b.name === p.name);
      if (base) {
        p.rating   = base.rating;
        p.rarity   = base.rarity;
        p.position = base.position;
        p.stats    = { ...base.stats };  // ← también en el equipo activo
      }
    }
  }
  saveData();
  return message.reply(`✅ **${updated}** jugadores actualizados en todos los clubs.`);
}

    // ─────────────────────────────────────────
    // 👑 ADMIN — AYUDA EXPANDIDA
    // ─────────────────────────────────────────
    if (cmd === '.adminhelp') {
      return message.reply({ embeds: [{ color: 0xFF6600, title: '👑 COMANDOS DE ADMIN', fields: [
        { name: '💰 Economía',            value: '`.giveme <n>` · `.give @u <n>` · `.take @u <n>`',                                                   inline: false },
        { name: '🃏 Cartas & Packs',      value: '`.givecard @u <jugador>` · `.givepack @u silver/bronze/gold/legend [n]`',                            inline: false },
        { name: '📊 Gestión de usuario',  value: '`.profile @u` · `.resetuser @u` · `.setelo @u <n>` · `.resetdaily @u`',                             inline: false },
        { name: '🔍 Inspección',          value: '`.adminclub @u` · `.adminteam @u` · `.admininfo @u`',                                                inline: false },
        { name: '🗑️ Quitar jugadores',   value: '`.adminremove @u <jugador>` · `.adminremoverarity @u <Common/Rare/Epic/Legendary>`',                 inline: false },
        { name: '🧹 Limpieza',            value: '`.clearteam @u` · `.clearclub @u` · `.removelogo @u`',                                               inline: false },
        { name: '📈 Bot',                 value: '`.info` · `.updateplayers`',                                                                          inline: false },
        { name: '👑 Admins (SuperAdmin)', value: '`.addadmin @u` · `.removeadmin @u` · `.admins`',                                                     inline: false },
        { name: '📢 Misc',                value: '`.anuncio <mensaje>`',                                                                                inline: false },
      ], footer: { text: 'Cooldown desactivado para admins' } }] });
    }


// ─────────────────────────────────────────
// 👑 ADMIN — BAN / UNBAN
// ─────────────────────────────────────────
if (cmd === '.adminban') {
  const subCmd = (args[1] || '').toLowerCase();
  const target = message.mentions.users.first();

  // Listar baneados
  if (subCmd === 'list') {
    if (bannedUsers.size === 0) {
      return message.reply({ embeds: [{ color: 0x00C851, title: '✅ Sin usuarios baneados', description: 'No hay ningún usuario baneado actualmente.' }] });
    }
    const lista = [...bannedUsers].map((id, i) => `**${i + 1}.** <@${id}> (\`${id}\`)`).join('\n');
    return message.reply({ embeds: [{ color: 0xFF4444, title: `🔨 Usuarios baneados (${bannedUsers.size})`, description: lista, footer: { text: '.adminban unban @usuario para desbanear' } }] });
  }

  // Desbanear
  if (subCmd === 'unban') {
    if (!target) return message.reply('❌ Uso: `.adminban unban @usuario`');
    if (!bannedUsers.has(target.id)) return message.reply(`❌ **${target.username}** no está baneado.`);
    bannedUsers.delete(target.id);
    saveBans();
    return message.reply({ embeds: [{ color: 0x00C851, title: '✅ Usuario desbaneado', description: `**${target.username}** puede volver a usar el bot.`, footer: { text: `Desbaneado por ${message.author.username}` }, timestamp: new Date().toISOString() }] });
  }

  // Banear (default)
  if (!target) {
    return message.reply({
      embeds: [{
        color: 0xFF4444,
        title: '🔨 Admin Ban — Uso',
        fields: [
          { name: '`.adminban @usuario [razón]`',  value: 'Banear un usuario del bot',       inline: false },
          { name: '`.adminban unban @usuario`',     value: 'Desbanear un usuario',            inline: false },
          { name: '`.adminban list`',               value: 'Ver todos los usuarios baneados', inline: false },
        ],
        footer: { text: 'Los baneados no pueden usar ningún comando del bot' }
      }]
    });
  }

  if (target.id === superAdminId) return message.reply('❌ No puedes banear al Super Admin.');
  if (isAdmin(target.id) && userId !== superAdminId) return message.reply('❌ Solo el Super Admin puede banear a otros admins.');
  if (bannedUsers.has(target.id)) return message.reply(`❌ **${target.username}** ya está baneado.`);

  const reason = args.slice(target ? 2 : 1).join(' ') || 'Sin razón especificada';
  bannedUsers.add(target.id);
  saveBans();

  return message.reply({
    embeds: [{
      color: 0xFF4444,
      author: { name: `🔨 Usuario baneado · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      title: `${target.username} fue baneado`,
      fields: [
        { name: '👤 Usuario',   value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
        { name: '⚖️ Razón',    value: reason,                                inline: true },
        { name: '👑 Admin',    value: message.author.username,               inline: true },
      ],
      footer: { text: '.adminban unban @usuario para desbanear  ·  !adminban list para ver todos' },
      timestamp: new Date().toISOString()
    }]
  });
}

  }  // ← cierre del if (isAdmin(userId))
}); // ← cierre del client.on('messageCreate', async message => {

// ─────────────────────────────────────────
// 🧠 CALCULAR RATING DEL EQUIPO
// ─────────────────────────────────────────
function calculateTeam(team) {
  const requiredPositions = ["GK", "DM", "AM", "ST"];
  let total = 0, chemistry = 0, usedPositions = [];
  team.forEach((p, i) => {
    let rating = p.rating;
    if (p.position === requiredPositions[i]) chemistry += 10;
    else rating -= 15;
    usedPositions.push(p.position);
    total += rating;
  });
  const unique = new Set(usedPositions);
  if (unique.size < 4) total -= 20;
  return (total / 4) + (chemistry / 10);
}

// ─────────────────────────────────────────
// 🎮 MOTOR DE PARTIDO — Estilo Soccer Guru
// ─────────────────────────────────────────
async function playMatchEngine(myId, oppId, isArena, message, myUsername) {
  const myData  = data[myId];
  const oppData = data[oppId];
  if (!myData || !oppData) return message.reply('❌ Error cargando datos del partido.');

  const myClub  = myData.teamName  || 'Mi equipo';
  const oppUser = await client.users.fetch(oppId).catch(() => null);
  const oppName = oppUser ? oppUser.username : 'Rival';
  const oppClub = oppData.teamName || oppName + "'s FC";

  if (!myData.elo)  myData.elo  = 1000;
  if (!oppData.elo) oppData.elo = 1000;

  const RARITY_BONUS = {
  "Common": 0.00, "Rare": 0.05, "Epic": 0.10, "Legendary": 0.18, "WorldCup": 0.48, "Icon": 0.56,
};

  function calcRarityBonus(myTeam, oppTeam) {
    let myBonus = 0, oppBonus = 0;
    for (const p of myTeam)  myBonus  += RARITY_BONUS[p.rarity]  || 0;
    for (const p of oppTeam) oppBonus += RARITY_BONUS[p.rarity] || 0;
    return myBonus - oppBonus;
  }

  const SLOT_POSITIONS = ['GK', 'DM', 'AM', 'ST'];
const POSITION_PENALTY = 8; // moderada

function calcEffectiveOvr(team) {
  return team.reduce((s, p, i) => {
    const expected = SLOT_POSITIONS[i];
    const penalty  = p.position !== expected ? POSITION_PENALTY : 0;
    return s + (p.rating - penalty);
  }, 0) / team.length;
}

const myOvr  = calcEffectiveOvr(myData.team);
const oppOvr = calcEffectiveOvr(oppData.team);
  const ovrWeight   = myOvr / (myOvr + oppOvr);
  const rarityBonus = calcRarityBonus(myData.team, oppData.team);

  let myWeight;
if (isArena) {
  const eloProb = 1 / (1 + Math.pow(10, (oppData.elo - myData.elo) / 400));
  myWeight = Math.max(0.25, Math.min(0.85, 0.35 * eloProb + 0.45 * ovrWeight + 0.20 * (0.5 + rarityBonus)));
} else {
  myWeight = Math.max(0.25, Math.min(0.85, 0.70 * ovrWeight + 0.30 * (0.5 + rarityBonus)));
}

  // Generar todos los eventos AL INICIO para evitar indeterminismo durante los edits
  const usedMins = new Set(), eventMinutes = [];
  const numEvents = 2 + Math.floor(Math.random() * 8);
  while (eventMinutes.length < numEvents) {
    const m = 1 + Math.floor(Math.random() * 90);
    if (!usedMins.has(m)) { usedMins.add(m); eventMinutes.push(m); }
  }
  eventMinutes.sort((a, b) => a - b);

  const goalEvents = eventMinutes.map(min => {
    const scorer = Math.random() < myWeight ? 'me' : 'opp';
    const allPlayers = scorer === 'me' ? myData.team : oppData.team;
    const attackers  = allPlayers.filter(p => ['ST', 'AM'].includes(p.position));
    const scorerPlayer = attackers.length > 0
      ? attackers[Math.floor(Math.random() * attackers.length)]
      : allPlayers[Math.floor(Math.random() * allPlayers.length)];
    const others = allPlayers.filter(p => p.name !== scorerPlayer.name);
    const assistPlayer = others.length > 0 && Math.random() > 0.4
      ? others[Math.floor(Math.random() * others.length)]
      : null;
    return { min, scorer, player: scorerPlayer.name, assist: assistPlayer?.name || null };
  });

  const myTier  = getEloTier(myData.elo);
  const oppTier = getEloTier(oppData.elo);
  const modeLabel = isArena ? '⚔️ ARENA' : '🤝 AMISTOSO';

  let myGoals = 0, oppGoals = 0;
  let myEvents = [], oppEvents = [];

  // ── buildMatchEmbed: NO adjunta archivos (los logos solo van en el mensaje inicial) ──
  function buildMatchEmbed(status) {
    const allEvts = [
      ...myEvents.map(e => ({ ...e, side: 'home' })),
      ...oppEvents.map(e => ({ ...e, side: 'away' }))
    ].sort((a, b) => a.min - b.min);

    const firstHalf  = allEvts.filter(e => e.min <= 45);
    const secondHalf = allEvts.filter(e => e.min > 45);

    const formatEvent = (e) => {
      const assist = e.assist ? `\nL 👟 ${e.assist}` : '';
      return `**${e.min}'** ⚽ ${e.player}${assist}`;
    };

    let homeCol = '';
    let awayCol = '';
    firstHalf.forEach(e => {
      if (e.side === 'home') homeCol += formatEvent(e) + '\n\n';
      else awayCol += formatEvent(e) + '\n\n';
    });
    homeCol += '`---------- HT ----------`\n\n';
    awayCol += '`---------- HT ----------`\n\n';
    secondHalf.forEach(e => {
      if (e.side === 'home') homeCol += formatEvent(e) + '\n\n';
      else awayCol += formatEvent(e) + '\n\n';
    });

    const scoreColor = status === 'finished'
      ? (myGoals > oppGoals ? 0x00C851 : myGoals < oppGoals ? 0xFF4444 : 0xFFAA00)
      : 0x2b2d31;

    const statusText = status === 'live_first'  ? 'En vivo — Primera mitad' :
                       status === 'ht'           ? 'Medio tiempo' :
                       status === 'live_second'  ? 'En vivo — Segunda mitad' :
                                                   'Full-time';
    return {
      embeds: [{
        color: scoreColor,
        // ✅ NUNCA poner author con icon_url de archivo adjunto en los edits — causa fallo
        author: { name: myClub },
        description: [``, `● **${myClub}** ${myGoals}-${oppGoals} **${oppClub}** ●`, `Estado - **${statusText}**`, ``].join('\n'),
        fields: [
          { name: `🏠 Home\nManager: @${myUsername} [${myClub}]`, value: homeCol.trim() || '_ _', inline: true },
          { name: `✈️ Away\nManager: @${oppName} [${oppClub}]`, value: awayCol.trim() || '_ _', inline: true }
        ],
        footer: { text: `${modeLabel}  ·  ${myTier.emoji} ${myData.elo} ELO vs ${oppTier.emoji} ${oppData.elo} ELO` },
        timestamp: new Date().toISOString()
      }]
    };
  }

  // ── Helper seguro para editar: nunca adjunta archivos, nunca lanza ──
  async function safeEdit(embed) {
    try {
      await matchMsg.edit({ ...embed, files: [], attachments: [] });
    } catch (e) {
      console.error('[Match] Edit falló:', e.message);
      // Continuar el partido aunque el edit falle
    }
  }

  // ── Helper para procesar una ventana de minutos ──
  function processMinutes(from, to, processedMins) {
    for (const ev of goalEvents) {
      if (ev.min >= from && ev.min <= to && !processedMins.has(ev.min)) {
        processedMins.add(ev.min);
        if (ev.scorer === 'me') {
          myGoals++;
          myEvents.push({ min: ev.min, player: ev.player, assist: ev.assist });
        } else {
          oppGoals++;
          oppEvents.push({ min: ev.min, player: ev.player, assist: ev.assist });
        }
      }
    }
  }

  // ── Mensaje inicial con logos (única vez que se adjuntan archivos) ──
  const matchFiles = [];
  if (myData.clubLogo)  matchFiles.push({ attachment: Buffer.from(myData.clubLogo,  'base64'), name: 'home-logo.png' });
  if (oppData.clubLogo) matchFiles.push({ attachment: Buffer.from(oppData.clubLogo, 'base64'), name: 'away-logo.png' });

  const initialEmbed = {
    embeds: [{
      color: 0x2b2d31,
      author: myData.clubLogo
        ? { name: myClub, icon_url: 'attachment://home-logo.png' }
        : { name: myClub },
      thumbnail: oppData.clubLogo ? { url: 'attachment://away-logo.png' } : undefined,
      description: [``, `● **${myClub}** 0-0 **${oppClub}** ●`, `Estado - **En vivo — Primera mitad**`, ``].join('\n'),
      fields: [
        { name: `🏠 Home\nManager: <@${myId}> [${myClub}]`,                              value: '_ _', inline: true },
        { name: `✈️ Away\nManager: ${oppUser ? `<@${oppId}>` : oppName} [${oppClub}]`, value: '_ _', inline: true }
      ],
      footer: { text: `${modeLabel}  ·  ${myTier.emoji} ${myData.elo} ELO vs ${oppTier.emoji} ${oppData.elo} ELO` },
      timestamp: new Date().toISOString()
    }],
    files: matchFiles
  };

  const matchMsg = await message.reply(initialEmbed);
  const processedMins = new Set();
  const MERCY_DIFF = 7;
  function mercyActive() { return Math.abs(myGoals - oppGoals) >= MERCY_DIFF; }

  // ── Fases del partido ──
  await new Promise(r => setTimeout(r, 5000));
  processMinutes(1, 30, processedMins);
  await safeEdit(buildMatchEmbed('live_first'));
  if (mercyActive()) { await safeEdit(buildMatchEmbed('finished')); return await applyMatchRewards(); }

  await new Promise(r => setTimeout(r, 5000));
  processMinutes(31, 45, processedMins);
  await safeEdit(buildMatchEmbed('ht'));
  if (mercyActive()) { await safeEdit(buildMatchEmbed('finished')); return await applyMatchRewards(); }

  await new Promise(r => setTimeout(r, 4000));
  await safeEdit(buildMatchEmbed('live_second'));
  if (mercyActive()) { await safeEdit(buildMatchEmbed('finished')); return await applyMatchRewards(); }

  await new Promise(r => setTimeout(r, 5000));
  processMinutes(46, 70, processedMins);
  await safeEdit(buildMatchEmbed('live_second'));
  if (mercyActive()) { await safeEdit(buildMatchEmbed('finished')); return await applyMatchRewards(); }

  await new Promise(r => setTimeout(r, 5000));
  processMinutes(71, 90, processedMins);

  await new Promise(r => setTimeout(r, 3000));
  await safeEdit(buildMatchEmbed('finished'));

  // ── PENALES (solo Arena, solo si empate) ──
  let penaltyWinner = null;
  let penaltyDetails = '';

  if (isArena && myGoals === oppGoals) {
    const PENALTY_KICKS = 5;
    let myPens = 0, oppPens = 0;
    const myPenLog = [], oppPenLog = [];
    const myPenProb  = Math.min(0.85, Math.max(0.55, 0.70 + (myOvr  - 75) * 0.005));
    const oppPenProb = Math.min(0.85, Math.max(0.55, 0.70 + (oppOvr - 75) * 0.005));
    for (let k = 0; k < PENALTY_KICKS; k++) {
      const myScored  = Math.random() < myPenProb;
      const oppScored = Math.random() < oppPenProb;
      myPens  += myScored  ? 1 : 0;
      oppPens += oppScored ? 1 : 0;
      myPenLog .push(myScored  ? '✅' : '❌');
      oppPenLog.push(oppScored ? '✅' : '❌');
    }
    let extraRound = 0;
    while (myPens === oppPens && extraRound < 20) {
      extraRound++;
      const myS  = Math.random() < myPenProb;
      const oppS = Math.random() < oppPenProb;
      myPens  += myS  ? 1 : 0;
      oppPens += oppS ? 1 : 0;
      myPenLog .push(myS  ? '✅' : '❌');
      oppPenLog.push(oppS ? '✅' : '❌');
    }
    penaltyWinner = myPens > oppPens ? 'me' : 'opp';
    const myPenStr  = myPenLog.join(' ');
    const oppPenStr = oppPenLog.join(' ');
    const penScore  = `${myPens}-${oppPens}`;
    const penEmbed = {
      embeds: [{
        color: 0xFFAA00,
        author: { name: myClub },
        description: [
          ``, `🥅 **TANDA DE PENALES**`,
          `● **${myClub}** ${myGoals}-${oppGoals} **${oppClub}** *(después de 90')*`,
          ``, `🏠 **${myClub}:** ${myPenStr}`,
          `✈️ **${oppClub}:** ${oppPenStr}`,
          ``, `**Resultado penales: ${penScore}**`,
          penaltyWinner === 'me' ? `🏆 **¡${myClub} gana la tanda!**` : `💀 **${oppClub} gana la tanda**`,
          ``
        ].join('\n'),
        footer: { text: `⚔️ ARENA  ·  ${myTier.emoji} ${myData.elo} ELO vs ${oppTier.emoji} ${oppData.elo} ELO` },
        timestamp: new Date().toISOString()
      }],
      files: [], attachments: []
    };
    await new Promise(r => setTimeout(r, 2500));
    try { await message.reply(penEmbed); } catch(e) { console.error('[Penales] Reply falló:', e.message); }
    await new Promise(r => setTimeout(r, 3000));
    penaltyDetails = ` | Penales: ${penScore} (${penaltyWinner === 'me' ? myClub : oppClub} gana la tanda)`;
  }

  await applyMatchRewards();

  // ── FUNCIÓN INTERNA: aplica recompensas, ELO e historial ──
  async function applyMatchRewards() {
    const rewards = MATCH_REWARDS[isArena ? 'arena' : 'friendly'];
    let myResult, oppResult;
    if (penaltyWinner === 'me') {
      myResult  = 'win';
      oppResult = 'loss';
    } else if (penaltyWinner === 'opp') {
      myResult  = 'loss';
      oppResult = 'win';
    } else {
      myResult  = myGoals > oppGoals ? 'win' : myGoals < oppGoals ? 'loss' : 'draw';
      oppResult = myGoals < oppGoals ? 'win' : myGoals > oppGoals ? 'loss' : 'draw';
    }
    const reward    = myResult  === 'win' ? rewards.win  : myResult  === 'loss' ? rewards.loss : rewards.draw;
    const oppReward = isArena
  ? (oppResult === 'win' ? 200 : oppResult === 'draw' ? 50 : 0)
  : (oppResult === 'win' ? Math.round(rewards.win / 2) : oppResult === 'loss' ? 0 : Math.round(rewards.draw / 2));
    oppData.coins = (oppData.coins || 0) + oppReward;
    myData.coins += reward;
    let eloChange = '';
    if (isArena) {
      const K          = 32;
      const expectedMe = 1 / (1 + Math.pow(10, (oppData.elo - myData.elo) / 400));
      const scoreMe    = myResult === 'win' ? 1 : myResult === 'loss' ? 0 : 0.5;
      const oldMe      = myData.elo, oldOpp = oppData.elo;
      myData.elo       = Math.round(oldMe  + K * (scoreMe - expectedMe));
      oppData.elo      = Math.round(oldOpp + K * ((1 - scoreMe) - (1 - expectedMe)));
      const myDiff     = myData.elo  - oldMe;
      const oppDiff    = oppData.elo - oldOpp;
      const newMyTier  = getEloTier(myData.elo);
      const newOppTier = getEloTier(oppData.elo);
      eloChange = `\n📊 **ELO:** ${myClub} ${oldMe}→**${myData.elo}** (${myDiff >= 0 ? '+' : ''}${myDiff}) ${newMyTier.emoji} | ${oppClub} ${oldOpp}→**${oppData.elo}** (${oppDiff >= 0 ? '+' : ''}${oppDiff}) ${newOppTier.emoji}`;
    }
    if (!myData.matchHistory)  myData.matchHistory  = [];
    if (!oppData.matchHistory) oppData.matchHistory = [];
    const matchRecord = {
      type: isArena ? 'arena' : 'friendly', date: Date.now(),
      oppId, oppName, oppClub, myGoals, oppGoals, result: myResult, reward
    };
    const oppMatchRecord = {
      type: isArena ? 'arena' : 'friendly', date: Date.now(),
      oppId: myId, oppName: myUsername, oppClub: myClub,
      myGoals: oppGoals, oppGoals: myGoals, result: oppResult, reward: oppReward
    };
    myData.matchHistory.unshift(matchRecord);
    oppData.matchHistory.unshift(oppMatchRecord);
    if (myData.matchHistory.length  > 50) myData.matchHistory  = myData.matchHistory.slice(0, 50);
    if (oppData.matchHistory.length > 50) oppData.matchHistory = oppData.matchHistory.slice(0, 50);
    saveData();

 if (myResult === 'win' && isArena) {
     const _lW = checkLogros(myId, 'arena_win', 1);
     await announceLogros(message, _lW);
   }
   if (myResult === 'win' && !isArena) {
     const _lF = checkLogros(myId, 'friendly_play', 1);
     await announceLogros(message, _lF);
   }
   if (isArena) {
     const _lE = checkLogros(myId, 'elo_reached', myData.elo);
     await announceLogros(message, _lE);
   }

// Quests de partidos
  if (!isArena) {
    if (myResult === 'win') progressQuest(myId, 'friendly_won', 1);
  } else {
    if (myResult === 'win') progressQuest(myId, 'arena_won', 1);
  }

    const resultText = myResult === 'win'
      ? `🏆 **¡${myClub} GANA!**${penaltyWinner ? ' *(en penales)*' : ''}`
      : myResult === 'loss'
      ? `💀 **${oppClub} gana**${penaltyWinner ? ' *(en penales)*' : ''}`
      : `🤝 **EMPATE**`;
    const rewardText = myResult === 'win'
      ? `🏆 +${reward} ${EMOJI_COIN} por victoria`
      : myResult === 'loss'
      ? `📉 +${reward} ${EMOJI_COIN} por participar`
      : `🤝 +${reward} ${EMOJI_COIN} por empate`;
    const resultFiles = myData.clubLogo
      ? [{ attachment: Buffer.from(myData.clubLogo, 'base64'), name: 'club-logo.png' }]
      : [];
    await message.reply({
      content: `${resultText}\n${rewardText} para <@${myId}>${eloChange}${!isArena && oppReward > 0 ? `\n💰 +${oppReward} ${EMOJI_COIN} para <@${oppId}> por ${myGoals === oppGoals ? 'empatar' : 'ganar'}` : ''}`,
      embeds: myData.clubLogo ? [{ color: myGoals > oppGoals ? 0x00C851 : myGoals < oppGoals ? 0xFF4444 : 0xFFAA00, thumbnail: { url: 'attachment://club-logo.png' } }] : [],
      files: resultFiles
    });
  }
}


async function finishMatch() {}

// ─────────────────────────────────────────
// 🚀 LOGIN
// ─────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
  console.log(`⚔️ Arena cooldown: ${ARENA_COOLDOWN_MS/60000} min`);
  console.log(`💰 Precios: Silver ${packs.silver.price} | Gold ${packs.gold.price} | Legend ${packs.legend.price}`);
  console.log(`🎮 Pack opening: EN VIVO (paso a paso)`);
  console.log(`🎴 Cards: FIFA clásico estructura`);
  console.log(`🏪 Tienda: Rediseñada con canvas 900x560`);
  console.log(`💸 Sell: Canvas con mini carta y stats`);
  console.log(`💰 Balance: Estilo Soccer Guru (filas limpias)`);
});
client.login(process.env.DISCORD_TOKEN);