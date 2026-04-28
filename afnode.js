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

const EMOJI_COIN = '<:futcoins:1493006805419294861>';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = '!';

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
  { id: 'play_friendly',  difficulty: 'easy',   desc: 'Juega 1 amistoso',             type: 'friendly_played',  target: 1, reward: { coins: 150 } },
  { id: 'open_any_pack',  difficulty: 'easy',   desc: 'Abre 1 pack',                  type: 'pack_opened',      target: 1, reward: { coins: 120 } },
  { id: 'visit_market',   difficulty: 'easy',   desc: 'Visita el market (!market)',    type: 'market_visited',   target: 1, reward: { coins: 100 } },
  { id: 'win_friendly',   difficulty: 'medium', desc: 'Gana 2 amistosos',             type: 'friendly_won',     target: 2, reward: { coins: 300 } },
  { id: 'sell_2cards',    difficulty: 'medium', desc: 'Vende 2 cartas en el market',  type: 'card_sold',        target: 2, reward: { coins: 250 } },
  { id: 'play_arena',     difficulty: 'medium', desc: 'Juega 1 partido de Arena',     type: 'arena_played',     target: 1, reward: { coins: 280 } },
  { id: 'win_arena_x2',   difficulty: 'hard',   desc: 'Gana 2 partidos de Arena',     type: 'arena_won',        target: 2, reward: { coins: 600 } },
  { id: 'open_gold_plus', difficulty: 'hard',   desc: 'Abre 1 pack Gold o superior',  type: 'gold_pack_opened', target: 1, reward: { coins: 500 } },
  { id: 'sell_epic_plus', difficulty: 'hard',   desc: 'Vende 1 carta Épica o mejor',  type: 'epic_sold',        target: 1, reward: { coins: 550 } },
];
const DIFF_EMOJI = { easy: '🟢', medium: '🟡', hard: '🔴' };
const DIFF_LABEL = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' };
 
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
  if (t.status === 'waiting')  return '🟡 Inscripción abierta';
  if (t.status === 'active')   return '🟢 En curso';
  if (t.status === 'finished') return '🏁 Finalizado';
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
    title: `🏆 ¡${t.name} ha comenzado!`,
    description: [
      mentions, '',
      `**${t.participants.length} jugadores** luchando por **${t.prizes.champion.toLocaleString()} 💰**!`,
      '', `**📋 Ronda 1:**`, matchupLines, '',
      `⚔️ Usa \`!torneo jugar ${tId}\` para jugar tu partido.`,
      `📊 Usa \`!torneo bracket ${tId}\` para ver el bracket.`,
    ].join('\n'),
    fields: [
      { name: '🥇 Campeón',        value: `${t.prizes.champion.toLocaleString()} 💰`,  inline: true },
      { name: '🥈 Finalista',      value: `${t.prizes.runnerUp.toLocaleString()} 💰`,  inline: true },
      { name: '🥉 Semifinalistas', value: `${t.prizes.semifinal.toLocaleString()} 💰`, inline: true },
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

  mkp("DIEGO",         99, "DM", "Icon", {PAC:99,SHO:99,PAS:99,DRI:99,DEF:99,PHY:99}),
  mkp("PANDA",         99, "ST", "Icon", {DIV:99,REF:99,HAN:99,KIC:99,POS:99}),
  mkp("REAL",         99, "ST", "Icon", {PAC:99,SHO:99,PAS:99,DRI:99,DEF:99,PHY:99}),
  mkp("RAD1",         99, "AM", "Icon", {PAC:99,SHO:99,PAS:99,DRI:99,DEF:99,PHY:99}),
  mkp("CHECO",         99, "AM", "Icon", {PAC:99,SHO:99,PAS:99,DRI:99,DEF:99,PHY:99}),
  mkp("Kyo",         98, "ST", "WorldCup", {PAC:96,SHO:90,PAS:97,DRI:97,DEF:99,PHY:97}),
  mkp("Vak",       94, "AM", "WorldCup", {PAC:96,SHO:98,PAS:90,DRI:97,DEF:70,PHY:94}),
  mkp("Sekai WC",       97, "DM", "WorldCup", {PAC:96,SHO:98,PAS:90,DRI:97,DEF:70,PHY:94}),
  mkp("Luntek WC",       96, "GK", "WorldCup", {DIV:97,REF:96,HAN:94,KIC:95,POS:96}),
  mkp("Pixel WC",       98, "ST", "WorldCup", {PAC:97,SHO:99,PAS:95,DRI:96,DEF:75,PHY:96}),
  mkp("Mazda",       96, "ST", "WorldCup", {PAC:95,SHO:91,PAS:96,DRI:94,DEF:96,PHY:96}),
  mkp("Facha",       95, "DM", "WorldCup", {PAC:95,SHO:97,PAS:92,DRI:94,DEF:68,PHY:93}),
  mkp("Compass WC",     98, "DM", "WorldCup", {PAC:98,SHO:93,PAS:97,DRI:98,DEF:99,PHY:98}),
  mkp("Father WC",      98, "GK", "WorldCup", {DIV:97,REF:99,HAN:97,KIC:96,POS:99}),
  mkp("Czerro WC",      98, "DM", "WorldCup", {PAC:98,SHO:93,PAS:98,DRI:98,DEF:99,PHY:97}),
  mkp("Fusion",      97, "DM", "WorldCup", {PAC:95,SHO:91,PAS:96,DRI:96,DEF:98,PHY:96}),
  mkp("Thunder",     97, "AM", "WorldCup", {PAC:96,SHO:95,PAS:97,DRI:98,DEF:78,PHY:94}),
  mkp("Shott",       97, "AM", "WorldCup", {PAC:95,SHO:96,PAS:97,DRI:98,DEF:76,PHY:93}),
  mkp("Cervi WC",       97, "ST", "WorldCup", {PAC:95,SHO:98,PAS:94,DRI:96,DEF:72,PHY:95}),
  mkp("Hitlerinho",  97, "AM", "WorldCup", {PAC:95,SHO:95,PAS:97,DRI:99,DEF:74,PHY:93}),
  mkp("Ken",         96, "AM", "WorldCup", {PAC:94,SHO:94,PAS:96,DRI:97,DEF:72,PHY:92}),
  mkp("Rodrigo",     96, "GK", "WorldCup", {DIV:95,REF:97,HAN:95,KIC:94,POS:97}),
  mkp("Murillo",     96, "ST", "WorldCup", {PAC:96,SHO:98,PAS:91,DRI:95,DEF:70,PHY:94}),
  mkp("Magico",      96, "ST", "WorldCup", {PAC:95,SHO:97,PAS:92,DRI:96,DEF:68,PHY:93}),
  mkp("N+23",        95, "GK", "WorldCup", {DIV:94,REF:96,HAN:94,KIC:93,POS:96}),
  mkp("Becken",      94, "GK", "WorldCup", {DIV:93,REF:95,HAN:93,KIC:92,POS:95}),


  mkp("Luntek",       93, "ST", "Legendario", {PAC:96,SHO:98,PAS:90,DRI:97,DEF:70,PHY:94}),
  mkp("Compass",       93, "DM", "Legendario", {PAC:97,SHO:91,PAS:93,DRI:98,DEF:98,PHY:97}),
  mkp("Veil",         93, "AM", "Legendario", {PAC:95,SHO:95,PAS:90,DRI:96,DEF:80,PHY:90}),
  mkp("Sekai",        93, "DM", "Legendario", {PAC:94,SHO:94,PAS:93,DRI:97,DEF:98,PHY:97}),
  mkp("Czerro",       93, "DM", "Legendario", {PAC:97,SHO:91,PAS:95,DRI:97,DEF:98,PHY:95}),
  mkp("Amp",          93, "ST", "Legendario", {PAC:95,SHO:93,PAS:92,DRI:95,DEF:72,PHY:92}),
  mkp("Cervi",        92, "ST", "Legendario", {PAC:91,SHO:92,PAS:93,DRI:90,DEF:73,PHY:92}),
  mkp("Levaldo",      92, "DM", "Legendario", {PAC:86,SHO:87,PAS:89,DRI:90,DEF:95,PHY:94}),
  mkp("Mirkoller",    92, "GK", "Legendario", {DIV:93,REF:98,HAN:94,KIC:94,POS:96}),
  mkp("Pixel",        92, "ST", "Legendario", {PAC:94,SHO:96,PAS:93,DRI:90,DEF:80,PHY:94}),
  mkp("Quesonub",     92, "DM", "Legendario", {PAC:90,SHO:89,PAS:94,DRI:90,DEF:96,PHY:93}),
  mkp("Aoi",          91, "DM", "Legendario", {PAC:90,SHO:88,PAS:91,DRI:94,DEF:94,PHY:94}),
  mkp("Father",       91, "GK", "Legendario", {DIV:90,REF:93,HAN:90,KIC:90,POS:91}),
  mkp("Kayn",         91, "AM", "Legendario", {PAC:90,SHO:93,PAS:93,DRI:95,DEF:80,PHY:91}),
  mkp("Lyreco",       92, "ST", "Legendario", {PAC:93,SHO:95,PAS:87,DRI:90,DEF:76,PHY:91}),
  mkp("Paul",         91, "AM", "Legendario", {PAC:92,SHO:92,PAS:93,DRI:95,DEF:77,PHY:92}),
  mkp("Dqvid",        89, "DM", "Legendario", {PAC:84,SHO:80,PAS:90,DRI:87,DEF:93,PHY:90}),
  mkp("Gerardosky",   89, "DM", "Legendario", {PAC:83,SHO:80,PAS:90,DRI:86,DEF:93,PHY:93}),
  mkp("Guns",         89, "ST", "Legendario", {PAC:90,SHO:94,PAS:87,DRI:88,DEF:73,PHY:92}),
  mkp("Zyros",        89, "AM", "Legendario", {PAC:91,SHO:90,PAS:91,DRI:95,DEF:76,PHY:92}),
  mkp("Dimiliano",    90, "ST", "Legendario", {PAC:91,SHO:90,PAS:87,DRI:94,DEF:70,PHY:90}),
  mkp("Kaiser",       90, "ST", "Legendario", {PAC:92,SHO:95,PAS:84,DRI:93,DEF:70,PHY:90}),
  mkp("Pechuga",      90, "AM", "Legendario", {PAC:90,SHO:87,PAS:92,DRI:89,DEF:80,PHY:92}),
  mkp("Shepard",      90, "ST", "Legendario", {PAC:91,SHO:97,PAS:85,DRI:87,DEF:70,PHY:92}),
  mkp("Zombot",       88, "GK", "Legendario", {DIV:88,REF:88,HAN:86,KIC:87,POS:87}),

  mkp("Bachira",      87, "AM", "Epico",      {PAC:83,SHO:85,PAS:89,DRI:96,DEF:60,PHY:85}),
  mkp("Fallen",       87, "DM", "Epico",      {PAC:82,SHO:80,PAS:85,DRI:86,DEF:87,PHY:86}),
  mkp("Roki",         87, "AM", "Epico",      {PAC:86,SHO:87,PAS:85,DRI:95,DEF:70,PHY:90}),
  mkp("Zae",          87, "AM", "Epico",      {PAC:83,SHO:85,PAS:89,DRI:87,DEF:67,PHY:84}),
  mkp("N+23",         87, "GK", "Epico",      {DIV:86,REF:89,HAN:85,KIC:81,POS:87}),
  mkp("Pain",         86, "DM", "Epico",      {PAC:81,SHO:70,PAS:82,DRI:88,DEF:90,PHY:86}),
  mkp("Pinotek",      86, "AM", "Epico",      {PAC:82,SHO:84,PAS:88,DRI:89,DEF:56,PHY:71}),
  mkp("Sixer",        86, "DM", "Epico",      {PAC:81,SHO:68,PAS:82,DRI:80,DEF:89,PHY:86}),
  mkp("Smurf",        86, "GK", "Epico",      {DIV:85,REF:88,HAN:84,KIC:80,POS:86}),
  mkp("Cosmik",       86, "ST", "Epico",      {PAC:80,SHO:94,PAS:75,DRI:84,DEF:64,PHY:87}),
  mkp("Usu",          86, "ST", "Epico",      {PAC:88,SHO:88,PAS:75,DRI:84,DEF:63,PHY:84}),
  mkp("Kermit",       85, "DM", "Epico",      {PAC:80,SHO:73,PAS:85,DRI:83,DEF:90,PHY:85}),
  mkp("Whoisalex",    85, "DM", "Epico",      {PAC:83,SHO:86,PAS:81,DRI:89,DEF:84,PHY:85}),
  mkp("Diseased",     85, "ST", "Epico",      {PAC:87,SHO:90,PAS:75,DRI:83,DEF:47,PHY:79}),
  mkp("Raz",          85, "ST", "Epico",      {PAC:87,SHO:90,PAS:74,DRI:83,DEF:53,PHY:86}),
  mkp("Allan Saint",  84, "DM", "Epico",      {PAC:79,SHO:66,PAS:80,DRI:78,DEF:87,PHY:84}),
  mkp("Korai",        84, "DM", "Epico",      {PAC:79,SHO:66,PAS:80,DRI:78,DEF:87,PHY:84}),
  mkp("Lawliet",      84, "AM", "Epico",      {PAC:80,SHO:80,PAS:83,DRI:83,DEF:53,PHY:74}),
  mkp("Metzi",        84, "DM", "Epico",      {PAC:80,SHO:82,PAS:86,DRI:87,DEF:56,PHY:70}),
  mkp("Nocke",        84, "AM", "Epico",      {PAC:80,SHO:82,PAS:86,DRI:87,DEF:56,PHY:75}),
  mkp("Saskee",       84, "ST", "Epico",      {PAC:80,SHO:82,PAS:86,DRI:89,DEF:65,PHY:70}),
  mkp("369",          84, "ST", "Epico",      {PAC:86,SHO:86,PAS:74,DRI:82,DEF:46,PHY:78}),
  mkp("Rose",         84, "ST", "Epico",      {PAC:86,SHO:88,PAS:74,DRI:79,DEF:46,PHY:87}),
  mkp("Anon",         83, "DM", "Raro",      {PAC:78,SHO:65,PAS:79,DRI:77,DEF:86,PHY:83}),
  mkp("Paloma",       82, "DM", "Raro",      {PAC:77,SHO:64,PAS:78,DRI:76,DEF:85,PHY:82}),

  mkp("Coutinho",     84, "GK", "Epico",       {DIV:83,REF:86,HAN:82,KIC:80,POS:84}),
  mkp("Lothar",       84, "GK", "Epico",       {DIV:83,REF:86,HAN:82,KIC:80,POS:84}),
  mkp("Cold",         84, "DM", "Epico",       {PAC:82,SHO:70,PAS:80,DRI:85,DEF:87,PHY:84}),
  mkp("Reckless",     85, "DM", "Epico",       {PAC:80,SHO:70,PAS:87,DRI:76,DEF:90,PHY:88}),
  mkp("Shadow",       85, "DM", "Epico",       {PAC:80,SHO:74,PAS:81,DRI:87,DEF:88,PHY:85}),
  mkp("V2",           84, "AM", "Epico",       {PAC:80,SHO:82,PAS:86,DRI:84,DEF:66,PHY:83}),
  mkp("Ratchet",      83, "DM", "Raro",       {PAC:78,SHO:65,PAS:79,DRI:77,DEF:87,PHY:83}),
  mkp("SK1N1",        83, "DM", "Raro",       {PAC:78,SHO:65,PAS:79,DRI:80,DEF:86,PHY:83}),
  mkp("Sqai",         83, "ST", "Raro",       {PAC:85,SHO:84,PAS:72,DRI:80,DEF:45,PHY:76}),
  mkp("Hog",          83, "GK", "Raro",       {DIV:82,REF:85,HAN:81,KIC:78,POS:83}),
  mkp("Dross",        82, "AM", "Raro",       {PAC:78,SHO:80,PAS:84,DRI:85,DEF:54,PHY:69}),
  mkp("Everest",      82, "GK", "Raro",       {DIV:81,REF:84,HAN:80,KIC:77,POS:82}),
  mkp("Hisoka",       82, "GK", "Raro",       {DIV:81,REF:84,HAN:80,KIC:77,POS:82}),
  mkp("Nizy",         82, "ST", "Raro",       {PAC:84,SHO:83,PAS:71,DRI:79,DEF:44,PHY:75}),
  mkp("Feeling Jrzz", 74, "ST", "Comun",       {PAC:79,SHO:78,PAS:66,DRI:74,DEF:42,PHY:70}),
  mkp("Ukz",          82, "DM", "Raro",       {PAC:77,SHO:64,PAS:78,DRI:76,DEF:85,PHY:82}),
  mkp("Apolo",        80, "AM", "Raro",       {PAC:76,SHO:78,PAS:82,DRI:83,DEF:52,PHY:68}),
  mkp("Birkir",       80, "DM", "Raro",       {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Burrito",      80, "DM", "Raro",       {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Culon",        80, "DM", "Raro",       {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Mr.Esperma",   80, "DM", "Raro",       {PAC:75,SHO:62,PAS:76,DRI:84,DEF:81,PHY:75}),
  mkp("Pianoplayer",  80, "AM", "Raro",       {PAC:76,SHO:78,PAS:82,DRI:83,DEF:52,PHY:68}),
  mkp("Second",       80, "DM", "Raro",       {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Shoe",         81, "AM", "Raro",       {PAC:77,SHO:79,PAS:83,DRI:84,DEF:53,PHY:68}),
  mkp("Strange",      80, "AM", "Raro",       {PAC:76,SHO:78,PAS:82,DRI:83,DEF:52,PHY:68}),
  mkp("Theandrex",    81, "ST", "Raro",       {PAC:83,SHO:82,PAS:70,DRI:78,DEF:44,PHY:74}),
  mkp("Vincenzo",     83, "AM", "Raro",       {PAC:79,SHO:81,PAS:85,DRI:86,DEF:54,PHY:69}),
  mkp("Walham",       81, "GK", "Raro",       {DIV:80,REF:83,HAN:79,KIC:76,POS:81}),
  mkp("Cat",          81, "GK", "Raro",       {DIV:80,REF:83,HAN:79,KIC:76,POS:81}),
  mkp("Bonice",       74, "DM", "Comun",       {PAC:69,SHO:58,PAS:72,DRI:70,DEF:78,PHY:75}),
  mkp("Dan1",         78, "AM", "Comun",       {PAC:74,SHO:76,PAS:80,DRI:81,DEF:50,PHY:66}),
  mkp("Faissal",      77, "ST", "Comun",       {PAC:79,SHO:78,PAS:66,DRI:74,DEF:42,PHY:70}),
  mkp("Kamui",        80, "ST", "Raro",       {PAC:84,SHO:86,PAS:78,DRI:81,DEF:43,PHY:72}),
  mkp("Mel",          78, "AM", "Comun",       {PAC:74,SHO:76,PAS:80,DRI:81,DEF:50,PHY:66}),
  mkp("Login",          78, "ST", "Comun",       {PAC:74,SHO:80,PAS:76,DRI:81,DEF:50,PHY:66}),

  mkp("Barita",       79, "GK", "Comun",      {DIV:78,REF:81,HAN:77,KIC:74,POS:79}),
  mkp("Dan",          79, "GK", "Comun",      {DIV:78,REF:81,HAN:77,KIC:74,POS:79}),
  mkp("Kantz",        79, "AM", "Comun",      {PAC:78,SHO:77,PAS:81,DRI:82,DEF:51,PHY:67}),
  mkp("Lxthomas",     79, "AM", "Comun",      {PAC:75,SHO:77,PAS:81,DRI:82,DEF:51,PHY:67}),
  mkp("Nunf",         79, "AM", "Comun",      {PAC:75,SHO:77,PAS:81,DRI:89,DEF:51,PHY:67}),
  mkp("Silva",        79, "GK", "Comun",      {DIV:78,REF:81,HAN:77,KIC:74,POS:79}),
  mkp("Slurpy",       79, "GK", "Comun",      {DIV:78,REF:81,HAN:77,KIC:74,POS:79}),
  mkp("Moonsky",      81, "ST", "Raro",      {PAC:83,SHO:82,PAS:70,DRI:78,DEF:44,PHY:74}),
  mkp("Frist",        79, "ST", "Comun",      {PAC:81,SHO:83,PAS:68,DRI:73,DEF:42,PHY:72}),
  mkp("Insane",       79, "ST", "Comun",      {PAC:81,SHO:80,PAS:68,DRI:76,DEF:42,PHY:72}),
  mkp("Nova",         79, "ST", "Comun",      {PAC:81,SHO:80,PAS:68,DRI:76,DEF:42,PHY:72}),
  mkp("Torrez",       79, "ST", "Comun",      {PAC:81,SHO:80,PAS:68,DRI:76,DEF:42,PHY:72}),
  mkp("Aj",           78, "ST", "Comun",      {PAC:80,SHO:79,PAS:67,DRI:75,DEF:42,PHY:71}),
  mkp("Barco",        78, "ST", "Comun",      {PAC:70,SHO:75,PAS:70,DRI:75,DEF:42,PHY:71}),
  mkp("Javi",         78, "ST", "Comun",      {PAC:80,SHO:79,PAS:67,DRI:75,DEF:42,PHY:71}),
  mkp("Mystic",       78, "ST", "Comun",      {PAC:80,SHO:79,PAS:67,DRI:75,DEF:42,PHY:71}),
  mkp("Base",         78, "DM", "Comun",      {PAC:73,SHO:60,PAS:74,DRI:72,DEF:81,PHY:78}),
  mkp("Ast",          78, "DM", "Comun",      {PAC:73,SHO:60,PAS:74,DRI:72,DEF:81,PHY:78}),
  mkp("Brekus",       78, "GK", "Comun",      {DIV:77,REF:80,HAN:76,KIC:73,POS:78}),
  mkp("Lucas Torreira",78,"AM", "Comun",      {PAC:74,SHO:76,PAS:80,DRI:81,DEF:50,PHY:66}),
  mkp("Rai",          78, "AM", "Comun",      {PAC:74,SHO:76,PAS:80,DRI:81,DEF:50,PHY:66}),
  mkp("Samx",         78, "DM", "Comun",      {PAC:73,SHO:60,PAS:74,DRI:72,DEF:81,PHY:78}),
  mkp("Xavi",         80, "DM", "Raro",      {PAC:75,SHO:62,PAS:76,DRI:74,DEF:83,PHY:80}),
  mkp("Amaterasu",    84, "DM", "Epico",      {PAC:84,SHO:83,PAS:82,DRI:84,DEF:84,PHY:81}),
  mkp("Chelo",        77, "AM", "Comun",      {PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("Faustino Asprilla",77,"AM","Comun",{PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("Iancillo",     77, "GK", "Comun",      {DIV:76,REF:79,HAN:75,KIC:72,POS:77}),
  mkp("Kanpur",       80, "ST", "Raro",      {PAC:83,SHO:82,PAS:70,DRI:78,DEF:44,PHY:74}),
  mkp("Loki",         77, "AM", "Comun",      {PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("Monarca",      77, "AM", "Comun",      {PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("Muñoz",        77, "ST", "Comun",      {PAC:79,SHO:78,PAS:66,DRI:74,DEF:42,PHY:70}),
  mkp("Rolando",      77, "GK", "Comun",      {DIV:76,REF:79,HAN:75,KIC:72,POS:77}),
  mkp("Wheezy",       77, "GK", "Comun",      {DIV:76,REF:79,HAN:75,KIC:72,POS:77}),
  mkp("Wilsinky",     77, "AM", "Comun",      {PAC:73,SHO:75,PAS:79,DRI:80,DEF:49,PHY:65}),
  mkp("30h",          75, "DM", "Comun",      {PAC:70,SHO:57,PAS:71,DRI:69,DEF:78,PHY:75}),
  mkp("Andrewj",      75, "GK", "Comun",      {DIV:74,REF:77,HAN:73,KIC:70,POS:75}),
  mkp("Chino Huerta", 76, "ST", "Comun",      {PAC:78,SHO:77,PAS:65,DRI:73,DEF:41,PHY:70}),
  mkp("Ian+",         76, "AM", "Comun",      {PAC:72,SHO:74,PAS:78,DRI:79,DEF:48,PHY:64}),
  mkp("Kripps",       76, "AM", "Comun",      {PAC:72,SHO:74,PAS:78,DRI:79,DEF:48,PHY:64}),
  mkp("L.Diaz",       75, "GK", "Comun",      {DIV:74,REF:77,HAN:73,KIC:70,POS:75}),
  mkp("LianMoon",     75, "AM", "Comun",      {PAC:71,SHO:73,PAS:77,DRI:78,DEF:48,PHY:63}),
  mkp("Ly.",          75, "AM", "Comun",      {PAC:71,SHO:73,PAS:77,DRI:78,DEF:48,PHY:63}),
  mkp("Montiel",      76, "ST", "Comun",      {PAC:78,SHO:77,PAS:65,DRI:73,DEF:41,PHY:70}),
  mkp("Patatahot",    75, "GK", "Comun",      {DIV:74,REF:77,HAN:73,KIC:70,POS:75}),
  mkp("Polmito",      76, "ST", "Comun",      {PAC:66,SHO:83,PAS:65,DRI:68,DEF:61,PHY:78}),
  mkp("Rambo",        75, "GK", "Comun",      {DIV:74,REF:77,HAN:73,KIC:70,POS:75}),
  mkp("Samuggs",      75, "ST", "Comun",      {PAC:77,SHO:76,PAS:64,DRI:72,DEF:40,PHY:69}),
  mkp("Santi",        76, "AM", "Comun",      {PAC:72,SHO:74,PAS:78,DRI:79,DEF:48,PHY:64}),
  mkp("Skira",        75, "AM", "Comun",      {PAC:71,SHO:73,PAS:77,DRI:78,DEF:48,PHY:63}),
  mkp("Swifw",        76, "AM", "Comun",      {PAC:72,SHO:74,PAS:78,DRI:79,DEF:48,PHY:64}),
  mkp("Theviruz",     76, "ST", "Comun",      {PAC:78,SHO:77,PAS:65,DRI:73,DEF:41,PHY:70}),
  mkp("Piedrahita",   74, "ST", "Comun",      {PAC:75,SHO:74,PAS:65,DRI:72,DEF:40,PHY:68}),
  mkp("Wervy",        76, "ST", "Comun",      {PAC:78,SHO:77,PAS:65,DRI:73,DEF:41,PHY:70}),
  mkp("Claxon",       74, "AM", "Comun",      {PAC:70,SHO:72,PAS:76,DRI:77,DEF:47,PHY:62}),
  mkp("Faryd",        74, "GK", "Comun",      {DIV:73,REF:76,HAN:72,KIC:69,POS:74}),
  mkp("Ghz",          74, "AM", "Comun",      {PAC:70,SHO:72,PAS:76,DRI:77,DEF:47,PHY:62}),
  mkp("Moore",        74, "AM", "Comun",      {PAC:70,SHO:72,PAS:76,DRI:77,DEF:47,PHY:62}),
  mkp("R10",          74, "GK", "Comun",      {DIV:73,REF:76,HAN:72,KIC:69,POS:74}),
  mkp("Valentino",    74, "AM", "Comun",      {PAC:70,SHO:72,PAS:76,DRI:77,DEF:47,PHY:62}),
  mkp("Gomez",        20, "GK", "Comun",      {DIV:20,REF:20,HAN:20,KIC:20,POS:20}),
  mkp("Kyx",          73, "ST", "Comun",      {PAC:75,SHO:74,PAS:65,DRI:72,DEF:40,PHY:68}),
  mkp("Luppo",        73, "DM", "Comun",      {PAC:68,SHO:56,PAS:70,DRI:68,DEF:76,PHY:73}),
  mkp("Rodrik",       73, "AM", "Comun",      {PAC:69,SHO:71,PAS:75,DRI:76,DEF:46,PHY:61}),
  mkp("Signal",       73, "AM", "Comun",      {PAC:69,SHO:71,PAS:75,DRI:76,DEF:46,PHY:61}),
  mkp("Davis",        72, "GK", "Comun",      {DIV:71,REF:74,HAN:70,KIC:67,POS:72}),
  mkp("Mike",         72, "DM", "Comun",      {PAC:67,SHO:55,PAS:69,DRI:67,DEF:75,PHY:72}),
  mkp("Sunny",        72, "GK", "Comun",      {DIV:71,REF:74,HAN:70,KIC:67,POS:72}),
  mkp("Nami",         67, "GK", "Comun",      {DIV:66,REF:69,HAN:65,KIC:62,POS:67}),
  mkp("France",         4, "ST", "Comun",    {PAC:4,SHO:4,PAS:4,DRI:4,DEF:4,PHY:4}),
];

// ─────────────────────────────────────────
// 🌍 NACIONALIDADES
// ─────────────────────────────────────────
const playerNationality = {
  "Kyo":        { flag: "🇵🇱", country: "Polonia"   },
  "Vak":       { flag: "🇵🇱", country: "Polonia"   },
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
  bronze: { price: 500,  label: 'Bronze',  emoji: '🥉', rarities: ['Comun']       },
  silver: { price: 2500,  label: 'Silver',  emoji: '🥈', rarities: ['Raro']      },
  gold:   { price: 7500, label: 'Gold',    emoji: '🥇', rarities: ['Epico']      },
  legend: { price: 15000, label: 'Legend',  emoji: '💎', rarities: ['Legendario'] },
 icon:   { price: 95000, label: 'Icon',    emoji: '⭐', rarities: ['Icono']       },
};

const SELL_PRICES = { "Comun": 230, "Raro": 1150, "Epico": 3650, "Legendario": 7250, "Icon": 40000  
};
const MARKET_MIN_PRICE = { "Comun": 300, "Raro": 1900, "Epico": 5000, "Legendario": 17000, "Icon": 100000 };
const MARKET_LISTING_TTL = 48 * 60 * 60 * 1000; // 24 horas en ms
const MATCH_REWARDS = {
  arena:    { win: 400, draw: 100, loss: 50 },
  friendly: { win: 100, draw: 50,  loss: 20 }
};
const DAILY_COOLDOWN_MS  = 24 * 60 * 60 * 1000;
const DAILY_BASE_REWARD  = 250;
const DAILY_STREAK_BONUS = 50;
const STREAK_MILESTONES = {
  3:  { coins: 150,  msg: '🔥 ¡3 días seguidos! Bonus especial'   },
  7:  { coins: 400,  msg: '⚡ ¡UNA SEMANA! Mega bonus'            },
  14: { coins: 900,  msg: '💎 ¡DOS SEMANAS! Bonus legendario'     },
  30: { coins: 2500, msg: '👑 ¡UN MES! Bonus supremo'             }
};
const CLAIM_MILESTONES = {
  7:  { pack: 'silver', amount: 2, msg: '🥉 2 Packs Silver por 7 días seguidos!'    },
  14: { pack: 'gold',   amount: 1, msg: '🥇 Pack GOLD gratis por 14 días seguidos!'   },
  30: { pack: 'legend', amount: 1, msg: '💎 Pack LEGEND gratis por 30 días seguidos!' }
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
  icon: { primary: '#C0C0C0', secondary: '#808080', accent: '#FFFFFF', glow: '#E8E8E8', shine: '#FFFFFF', dark: '#303030' },
};

// ─────────────────────────────────────────
// 🎨 COLORES POR RAREZA — paletas FIFA
// ─────────────────────────────────────────
function getRarityColors(rarity) {
  if (rarity === "Legendario") return {
    cardTop:    '#F0D060', cardMid:    '#D4A820', cardBot:    '#A07818',
    nameBar:    '#C89020', statsArea:  '#9A6E10', border:     '#FFE566',
    glow:       '#FFD700', ratingCol:  '#1A0E00', posCol:     '#2A1800',
    nameCol:    '#FFFFFF', statNum:    '#FFFFFF', statLabel:  '#C8A840', shine: '#FFF8C0',
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
  if (rarity === "Epico") return {
    cardTop:    '#C89AD8', cardMid:    '#9B59B6', cardBot:    '#5A2878',
    nameBar:    '#7A3090', statsArea:  '#5A1E70', border:     '#CC88EE',
    glow:       '#AA66DD', ratingCol:  '#F0E0FF', posCol:     '#E8D0FF',
    nameCol:    '#FFFFFF', statNum:    '#FFFFFF', statLabel:  '#CC99EE', shine: '#E8D5F5',
  };
  if (rarity === "Raro") return {
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
  ctx.save();
  // Borde redondeado de la bandera
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, h, 3);
  ctx.clip();

  if (country === 'Argentina') {
    // Celeste - Blanco - Celeste
    ctx.fillStyle = '#74ACDF'; ctx.fillRect(x, y, w, h / 3);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y + h / 3, w, h / 3);
    ctx.fillStyle = '#74ACDF'; ctx.fillRect(x, y + (h / 3) * 2, w, h / 3);
    // Sol simplificado
    ctx.fillStyle = '#F6B40E';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.22, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Polonia') {
    // Blanco arriba, Rojo abajo
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#DC143C'; ctx.fillRect(x, y + h / 2, w, h / 2);

  } else if (country === 'USA') {
    // Fondo rojo
    ctx.fillStyle = '#B22234'; ctx.fillRect(x, y, w, h);
    // Franjas blancas (7)
    ctx.fillStyle = '#FFFFFF';
    const stripeH = h / 13;
    for (let i = 1; i < 13; i += 2) ctx.fillRect(x, y + stripeH * i, w, stripeH);
    // Canton azul
    ctx.fillStyle = '#3C3B6E'; ctx.fillRect(x, y, w * 0.4, h * 0.54);

  } else if (country === 'Brasil') {
    // Verde
    ctx.fillStyle = '#009C3B'; ctx.fillRect(x, y, w, h);
    // Rombo amarillo
    ctx.fillStyle = '#FFDF00';
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.08);
    ctx.lineTo(x + w * 0.92, y + h / 2);
    ctx.lineTo(x + w / 2, y + h * 0.92);
    ctx.lineTo(x + w * 0.08, y + h / 2);
    ctx.closePath(); ctx.fill();
    // Círculo azul
    ctx.fillStyle = '#002776';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.28, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Uruguay') {
    // Blanco y azul franjas
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#0038A8';
    const uStripeH = h / 9;
    for (let i = 1; i < 9; i += 2) ctx.fillRect(x, y + uStripeH * i, w, uStripeH);
    // Sol amarillo
    ctx.fillStyle = '#F6B40E';
    ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.35, h * 0.2, 0, Math.PI * 2); ctx.fill();

  } else if (country === 'Canadá') {
    // Rojo - Blanco - Rojo
    ctx.fillStyle = '#FF0000'; ctx.fillRect(x, y, w * 0.25, h);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + w * 0.25, y, w * 0.5, h);
    ctx.fillStyle = '#FF0000'; ctx.fillRect(x + w * 0.75, y, w * 0.25, h);
    // Hoja de arce (simplificada como círculo rojo)
    ctx.fillStyle = '#FF0000';
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.22, 0, Math.PI * 2); ctx.fill();

  } else {
    // Fallback genérico si no hay bandera definida
    ctx.fillStyle = '#444444'; ctx.fillRect(x, y, w, h);
  }

  ctx.restore();

  // Borde de la bandera
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
  const isWC = player.rarity === 'WorldCup';
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
    ctx.fillText('✦  WORLD CUP CHAMPIONS  ✦', cx + CW / 2, cy + 18);
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

  // Rating y posición
  const topOffset = isWC ? 16 : 0;
  ctx.font = `bold 82px ${FIFA_FONT}`;
  ctx.fillStyle = c.ratingCol;
  ctx.textAlign = 'left';
  ctx.shadowColor = '#00000044';
  ctx.shadowBlur = 6;
  ctx.fillText(String(player.rating), cx + 16, cy + 84 + topOffset);
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
  ctx.font = `bold 40px ${FIFA_FONT}`;
  ctx.fillStyle = c.ratingCol;
  ctx.textAlign = 'left';
  ctx.shadowColor = '#00000033';
  ctx.shadowBlur = 4;
  ctx.fillText(String(player.rating), ox + 9, oy + 42);
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
      key: 'bronze', label: 'BRONZE', sublabel: 'Jugadores Comunes', price: '500', sellVal: '230', rarity: 'COMÚN', cmd: '!buy bronze',
      bg1: '#2a1a0a', bg2: '#1a0e04', topGlow: '#FF9944', accent: '#CD7F32', accentLight: '#FFD4A0',
      border1: '#8B4513', border2: '#FF9944', badgeBg: '#3a2010', badgeText: '#FFD4A0',
      priceColor: '#FFD4A0', particles: ['#FFD4A0', '#FF9944', '#CD7F32'],
    },

    {
      key: 'silver', label: 'SILVER', sublabel: 'Jugadores Raros', price: '2500', sellVal: '1150', rarity: 'SILVER', cmd: '!buy silver',
      bg1: '#2a2a3a', bg2: '#1a1a28', topGlow: '#e0e0e0', accent: '#C8C8D8', accentLight: '#f0f0ff',
      border1: '#9090a0', border2: '#c0c0d0', badgeBg: '#3a3a50', badgeText: '#d0d0e0',
      priceColor: '#e8e8ff', particles: ['#ffffff', '#c0c0d0', '#9090a0'],
    },
    {
      key: 'gold', label: 'GOLD', sublabel: 'Jugadores Épicos', price: '7500', sellVal: '3650', rarity: 'ÉPICO', cmd: '!buy gold',
      bg1: '#1e1800', bg2: '#120f00', topGlow: '#FFE066', accent: '#FFD700', accentLight: '#FFFACD',
      border1: '#B8860B', border2: '#FFE066', badgeBg: '#2a2000', badgeText: '#FFFACD',
      priceColor: '#FFE066', particles: ['#FFFACD', '#FFD700', '#B8860B'],
    },
    {
      key: 'legend', label: 'LEGEND', sublabel: 'Jugadores Legendarios', price: '15000', sellVal: '7250', rarity: 'LEGENDARIO', cmd: '!buy legend',
      bg1: '#150a20', bg2: '#0d0615', topGlow: '#CC88FF', accent: '#9B59B6', accentLight: '#E8D5F5',
      border1: '#4A235A', border2: '#CC88FF', badgeBg: '#200a30', badgeText: '#E8D5F5',
      priceColor: '#CC88FF', particles: ['#E8D5F5', '#CC88FF', '#9B59B6'],
    },

    {
  key: 'icon', label: 'ICON', sublabel: 'Jugadores Iconos',
  price: '95000', sellVal: '45000', rarity: 'ICONO', cmd: '!buy icon',
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
  ctx.fillText('Usa  !buy <tipo>  para comprar · También puedes comprar varios: !buy 5 silver · Ver inventario: !inventory', W / 2, H - 14);
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
    title: '📖 Ayuda — Página 1/5 · Economía & Packs',
    color: 0x1a56db,
    fields: [
      { name: '💰 `!bal`',           value: 'Ver tus monedas actuales', inline: false },
      { name: '🎁 `!daily`',         value: 'Recompensa diaria (cada 24h) — acumula racha', inline: false },
      { name: '🎖️ `!claim`',         value: 'Reclamar monedas cada **12h** + bonus de racha', inline: false },
      { name: '⏱️ `!cd`',            value: 'Ver el estado de todos tus cooldowns:\n**Daily · Claim · Friendly · Arena** con tiempo exacto o ✅ Ready', inline: false },
      { name: '⚽ `!penalty <cantidad>`', value: 'Apuesta monedas en el sistema de penales\n🎯 Elige 1 de 5 zonas — 2 ganadoras\n💰 Mínimo **50 💰** · Máximo **50,000 💰**\n🏆 Si aciertas ganas el **doble** de tu apuesta', inline: false },
      { name: '📦 `!packs`',         value: 'Ver la tienda de packs y sus precios', inline: false },
      { name: '🛒 `!buy <tipo>`', value: '🥉 Bronze **500 💰** → Comunes\n⚪ Silver **2500 💰** → Raros\n🥇 Gold **7500 💰** → Épicos\n💎 Legend **15000 💰** → Legendarios\n🏆 Icon **95000 💰** → World Cup Champions', inline: false },
      { name: '🎒 `!inventory`',     value: 'Ver cuántos packs tienes disponibles', inline: false },
      { name: '🎮 `!open <tipo>` / `!o <tipo>`', value: 'Abrir pack con animación en vivo paso a paso\n🥉 bronze · ⚪ silver · 🥇 gold · 💎 legend · 🏆 icono', inline: false },
    ],
    footer: '⬅️ Anterior  |  Siguiente ➡️  ·  Navega con los botones'
  },
  {
    title: '📖 Ayuda — Página 2/5 · Club, Equipo & Cartas',
    color: 0x00C851,
    fields: [
      { name: '📋 `!club`',                   value: `Ver tu plantilla completa (máx **${MAX_CLUB_SIZE} jugadores**)`, inline: false },
      { name: '✏️ `!club rename <nombre>`',   value: 'Cambiar el nombre de tu club', inline: false },
      { name: '🖼️ `!club logo <url>`',        value: 'Poner logo a tu club con una imagen PNG/JPG\n`!club logo remove` para eliminarlo', inline: false },
      { name: '🟢 `!team`',                   value: 'Ver tu equipo activo con imagen interactiva (4 jugadores)', inline: false },
      { name: '🖼️ `!show <nombre>`',          value: 'Ver la carta individual con estadísticas detalladas\n💡 También funciona con cartas que **no tienes** en tu club', inline: false },
      { name: '🎮 `!players [filtro]`',       value: 'Ver **todos** los jugadores disponibles en el juego, ordenados por OVR\n**Filtros:** `legendario` · `epico` · `raro` · `comun` · `gk` · `dm` · `am` · `st`\nBoton 🎲 Aleatorio para saltar a página random', inline: false },
      { name: '➕ `!add <nombre>`',           value: 'Añadir jugador de tu club al equipo activo', inline: false },
      { name: '❌ `!remove <nombre>`',        value: 'Quitar jugador del equipo activo (vuelve al club)', inline: false },
      { name: '🗑️ `!removeall <nombre>`',     value: 'Quitar todas las copias de un jugador del equipo', inline: false },
    ],
    footer: '⬅️ Anterior  |  Siguiente ➡️  ·  Navega con los botones'
  },
  {
    title: '📖 Ayuda — Página 3/5 · Market & Equipo',
    color: 0xFFD700,
    fields: [
      { name: '🔄 `!swap`',                      value: 'Intercambiar posiciones entre dos jugadores del equipo', inline: false },
      { name: '🏪 `!market`',                    value: 'Ver el market dinámico — cartas publicadas por otros jugadores', inline: false },
      { name: '🏪 `!market <nombre>`',           value: 'Comprar la carta más barata disponible de ese jugador\nEj: `!market Czerro`', inline: false },
      { name: '💸 `!sell <nombre> [precio]`',    value: 'Publicar una carta en el market con precio personalizado.\nSin precio = mínimo automático. Las cartas duran **24h**.', inline: false },
      { name: '❌ `!cancelar`',                  value: 'Ver tus listings activos en el market y **retirar** los que quieras.\nLa carta vuelve directo a tu club.', inline: false },
      { name: '💸 `!send @usuario <cantidad>`',  value: 'Transferir monedas a otro jugador\nMínimo **50 💰** · Requiere confirmación antes de enviar', inline: false },
{ name: '🔄 `!trade @usuario <tu carta> por <su carta>`',
  value: [
    'Intercambiá cartas con otro jugador.',
    '**Reglas:**',
    '• Solo cartas con el mismo OVR',
    '• No podés tradear contigo mismo',
    '• El rival tiene **120s** para aceptar o rechazar',
    '• Si alguna carta estaba en el equipo, se saca automáticamente',
    '💡 Ej: `!trade @Luntek Veil por Compass`',
  ].join('\n'),
  inline: false
},
      { name: '💡 Precios mínimos de venta',     value: '• Común: **300** 💰\n• Raro: **1900** 💰\n• Épico: **5000** 💰\n• Legendario: **17000** 💰\n• World Cup: **100000**💰', inline: false },
    ],
    footer: '⬅️ Anterior  |  Siguiente ➡️  ·  Navega con los botones'
  },
  {
    title: '📖 Ayuda — Página 4/5 · Arena & Partidos',
    color: 0xFF6B00,
    fields: [
      { name: '🤝 `!friendly @rival`', value: 'Partido amistoso\n💰 Victoria: **+100** · Empate: **+50** · Derrota: **+20**', inline: false },
      { name: '⚔️ `!arena`',           value: '**Matchmaking automático por ELO**\nEmparejas con alguien de ELO similar\n💰 Victoria: **+400** · Empate: **+250** · Derrota: **+50**\n⏱️ Cooldown de **15 minutos**', inline: false },
      { name: '📊 `!top`',             value: 'Top 10 global por puntuación ELO', inline: false },
      { name: '💡 Tips para ganar monedas', value: '• **!claim** cada **12h** → racha de 14 días = Pack Gold gratis\n• **!daily** cada día → racha 7 días = 2 packs silver\n• **!arena** diario → hasta **+400 💰** por victoria\n• Vende duplicados → Épico vale **7500 💰** en market\n• Compra en **!market** y vende más caro\n• 30 días de racha → pack **LEGEND gratis**', inline: false },
{ name: '🎯 `!quests` / `!misiones`',
    value: '3 misiones diarias (🟢 fácil · 🟡 media · 🔴 difícil)\nGana hasta **1.350 💰** por día completándolas\n`!quests reclamar <1|2|3>` para cobrar',
    inline: false },
  { name: '🏆 `!torneo`',
    value: 'Torneos eliminatorios con bracket visual\n`!torneo listar` · `!torneo jugar <id>` · `!torneo bracket <id>`\nAdmins crean torneos: `!torneo crear <nombre> <entrada> <jugadores>`',
    inline: false },
    ],
    footer: '⬅️ Anterior  |  Siguiente ➡️  ·  Navega con los botones'
  },
  {
    title: '📖 Ayuda — Página 5/5 · Admin',
    color: 0x9B59B6,
    fields: [
      { name: '👑 Comandos de Admin', value: 'Los siguientes comandos solo funcionan si eres admin:', inline: false },
      { name: '`!giveme <n>`',          value: 'Darte monedas a ti mismo',               inline: true },
      { name: '`!give @u <n>`',         value: 'Dar monedas a usuario',                  inline: true },
      { name: '`!take @u <n>`',         value: 'Quitar monedas a usuario',               inline: true },
      { name: '`!givecard @u <jug>`',   value: 'Dar carta específica',                   inline: true },
      { name: '`!givepack @u <t> [n]`', value: 'Dar pack(s) a usuario',                  inline: true },
      { name: '`!profile @u`',          value: 'Ver perfil completo',                    inline: true },
      { name: '`!resetuser @u`',        value: 'Resetear cuenta completa',               inline: true },
      { name: '`!setelo @u <n>`',       value: 'Ajustar ELO',                            inline: true },
      { name: '`!resetdaily @u`',       value: 'Resetear daily/racha',                   inline: true },
      { name: '`!clearteam @u`',        value: 'Limpiar equipo activo',                  inline: true },
      { name: '`!clearclub @u`',        value: 'Limpiar club y equipo completo',         inline: true },
      { name: '`!removelogo @u`',       value: 'Eliminar logo del club',                 inline: true },
      { name: '`!info`',                value: 'Estadísticas globales del bot',          inline: true },
      { name: '`!addadmin @u`',         value: 'Agregar admin (solo SuperAdmin)',         inline: true },
      { name: '`!removeadmin @u`',      value: 'Quitar admin (solo SuperAdmin)',          inline: true },
      { name: '`!admins`',              value: 'Ver lista de admins',                    inline: true },
      { name: '`!anuncio <msg>`',       value: 'Anuncio oficial en el canal',            inline: true },
      { name: '`!adminhelp`',           value: 'Ver panel expandido de admin',           inline: true },
    ],
    footer: '⬅️ Anterior  |  Fin  ·  Navega con los botones'
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
  if (!u.packs) u.packs = { silver:0, bronze:0, gold:0, legend:0, icono:0 };
  if (u.packs.silver === undefined)   u.packs.silver = 0;
  if (u.packs.legend === undefined)   u.packs.legend = 0;
  if (u.packs.icono === undefined) u.packs.icono = 0;
  saveData();

  const user = data[userId];
  const args = message.content.trim().split(/\s+/);
  const rawCmd = args[0].toLowerCase();
  const cmd = rawCmd === '!o' ? '!open' : rawCmd;

  // ─────────────────────────────────────────
  // ─────────────────────────────────────────
  // 💰 BALANCE — Estilo Soccer Guru
  // ─────────────────────────────────────────
  if (cmd === '!bal') {
    const tier = getEloTier(user.elo || 1000);
    const playersList = user.players || [];
    const totalSellValue = playersList.reduce((sum, p) => sum + (SELL_PRICES[p.rarity] || 90), 0);
    const totalMarketValue = playersList.reduce((sum, p) => {
      const MARKET_MULTIPLIER = { "Legendario": 18, "Epico": 10, "Raro": 5, "Comun": 2.5 };
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
  if (cmd === '!daily') {
    const nowTs = Date.now();
    const lastClaim = user.daily.lastClaim || 0;
    const elapsed = nowTs - lastClaim;

    if (elapsed < 24 * 60 * 60 * 1000) {
      const remaining = 24 * 60 * 60 * 1000 - elapsed;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      return message.reply(`⏰ Ya registraste tu asistencia hoy.\n⏳ Vuelve en **${hours}h ${minutes}m ${seconds}s**`);
    }

    const isStreak = lastClaim > 0 && elapsed < DAILY_COOLDOWN_MS * 2;
    const newStreak = isStreak ? (user.daily.streak || 0) + 1 : 1;

    user.daily.lastClaim = nowTs;
    user.daily.streak = newStreak;
    saveData();

    const nextMilestone = Object.keys(STREAK_MILESTONES).map(Number).sort((a,b)=>a-b).find(m => m > newStreak);
    const nextReward = DAILY_BASE_REWARD + (newStreak - 1) * DAILY_STREAK_BONUS;

    let streakBar = '';
    if (nextMilestone) {
      const filled = Math.floor(((newStreak % nextMilestone) / nextMilestone) * 10);
      streakBar = `\n🎯 Próximo hito: Día **${nextMilestone}** [${'█'.repeat(filled)}${'░'.repeat(10-filled)}]`;
    }

    let lines = [
      `🎁 **¡Asistencia registrada!**`, ``,
      `🔥 Racha actual: **${newStreak}** día${newStreak!==1?'s':''} consecutivo${newStreak!==1?'s':''}`,
      `💡 Usa \`!claim\` para recoger tus monedas del día`,
      `📅 Mañana podrás reclamar: **${nextReward}** 💰`,
    ];

    if (!isStreak && lastClaim > 0) lines.push(``, `💔 ¡Rompiste tu racha! Empieza de nuevo desde 1.`);

    const nextClaimMilestone = Object.keys(CLAIM_MILESTONES).map(Number).sort((a,b)=>a-b).find(m => !(user.daily.claimedMilestones||[]).includes(m));
    if (nextClaimMilestone) {
      const daysLeft = Math.max(0, nextClaimMilestone - newStreak);
      lines.push(``, `🎁 Próxima recompensa con \`!claim\`: Día **${nextClaimMilestone}** (faltan **${daysLeft}** día${daysLeft!==1?'s':''})`);
    }

    if (streakBar) lines.push(streakBar);
    lines.push(``, `💡 Usa \`!claim\` para recoger tus recompensas diarias de monedas.`);

    return message.reply(lines.join('\n'));
  }

  // ─────────────────────────────────────────
  // 🎖️ CLAIM — Recompensas cada 24h (monedas + bonos de racha)
  // ─────────────────────────────────────────
  if (cmd === '!claim') {
    const nowTs = Date.now();
    const lastClaimed = user.daily.lastCoinClaim || 0;
    const elapsed = nowTs - lastClaimed;

   const CLAIM_COOLDOWN_MS = 12 * 60 * 60 * 1000;
if (elapsed < CLAIM_COOLDOWN_MS) {
  const remaining = CLAIM_COOLDOWN_MS - elapsed;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      return message.reply(`⏰ Ya reclamaste tus monedas hoy.\n⏳ Vuelve en **${hours}h ${minutes}m ${seconds}s**`);
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

    const nextReward = DAILY_BASE_REWARD + streak * DAILY_STREAK_BONUS;
    const nextMilestone = Object.keys(STREAK_MILESTONES).map(Number).sort((a,b)=>a-b).find(m => m > streak);

    let streakBar = '';
    if (nextMilestone) {
      const filled = Math.floor(((streak % nextMilestone) / nextMilestone) * 10);
      streakBar = `\n🎯 Próximo hito de monedas: Día **${nextMilestone}** [${'█'.repeat(filled)}${'░'.repeat(10-filled)}]`;
    }

    let lines = [
      `🎁 **¡Recompensa diaria reclamada!**`, ``,
      `💰 Recibiste **+${reward}** monedas`,
      `💼 Balance actual: **${user.coins}** 💰`, ``,
      `🔥 Racha: **${streak}** día${streak!==1?'s':''} consecutivo${streak!==1?'s':''}`,
      `📅 Mañana recibirás: **${nextReward}** 💰`,
    ];

    if (bonusLines.length > 0) lines.push(``, ...bonusLines);
    if (packLines.length > 0) lines.push(``, `🎉 **¡Packs desbloqueados por racha!**`, ...packLines, ``, `📦 Revisa tu inventario con \`!inventory\``);
    if (streakBar) lines.push(streakBar);
    if (streak === 0) lines.push(``, `💡 Usa \`!daily\` cada día para acumular racha y desbloquear mejores recompensas.`);

    return message.reply(lines.join('\n'));
  }

  // ─────────────────────────────────────────
  // 🛒 TIENDA DE PACKS
  // ─────────────────────────────────────────
  if (cmd === '!packs') {
    const shopCanvas = await generatePackShopCanvas();  

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop_buy_bronze_${userId}`).setLabel('🥉 Bronze — 500 💰').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`shop_buy_silver_${userId}`).setLabel('🥈 Silver — 2500 💰').setStyle(ButtonStyle.Primary),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`shop_buy_gold_${userId}`).setLabel('🥇 Gold — 7500 💰').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`shop_buy_legend_${userId}`).setLabel('💎 Legend — 15000 💰').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`shop_info_${userId}`).setLabel('📊 Mi balance').setStyle(ButtonStyle.Secondary),
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
        author: { name: `🏪 Tienda de Packs · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        image: { url: 'attachment://shop.png' },
        footer: { text: `${EMOJI_COIN} Balance: ${user.coins} monedas  ·  Usa los botones para comprar rápido` },
        timestamp: new Date().toISOString()
      }],
      files: [{ attachment: shopCanvas.toBuffer(), name: 'shop.png' }],
      components: [row1, row2, row3]
    });

    const shopCollector = shopMsg.createMessageComponentCollector({ time: 120000 });
    shopCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ Esta tienda no es tuya.', ephemeral: true });

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
            title: `❌ Monedas insuficientes`,
            description: `Necesitas **${packs[packType].price} ${EMOJI_COIN}** para un pack **${packs[packType].label}**.\nTienes **${user.coins} ${EMOJI_COIN}**.`,
            footer: { text: 'Gana monedas con !daily, !arena y !friendly' }
          }],
          ephemeral: true
        });
      }

      if (user.players.length >= MAX_CLUB_SIZE) {
        return interaction.reply({
          content: `❌ Tu club está lleno (**${MAX_CLUB_SIZE}/${MAX_CLUB_SIZE}**). Vende jugadores con \`!sell <nombre>\`.`,
          ephemeral: true
        });
      }

      user.coins -= packs[packType].price;
      user.packs[packType] = (user.packs[packType] || 0) + 1;
      saveData();

      await interaction.update({
        embeds: [{
          color: 0x1a1a2e,
          author: { name: `🏪 Tienda de Packs · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          image: { url: 'attachment://shop.png' },
          footer: { text: `${EMOJI_COIN} Balance: ${user.coins} monedas  ·  Pack ${packs[packType].label} comprado ✅` },
          timestamp: new Date().toISOString()
        }],
        files: [{ attachment: shopCanvas.toBuffer(), name: 'shop.png' }],
        components: [row1, row2, row3]
      });
      await interaction.followUp({
        embeds: [{
          color: 0x00C851,
          title: `✅ Pack ${packs[packType].emoji} ${packs[packType].label} comprado`,
          description: `Ahora tienes **${user.packs[packType]}** pack(s) **${packs[packType].label}**.\nÚsalos con \`!open ${packType}\``,
          fields: [
            { name: `${EMOJI_COIN} Gastaste`, value: `${packs[packType].price} ${EMOJI_COIN}`, inline: true },
            { name: '💳 Balance', value: `${user.coins} ${EMOJI_COIN}`, inline: true },
            { name: '🎒 Packs', value: `🥈${user.packs.silver||0} 🥉${user.packs.bronze||0} 🥇${user.packs.gold||0} 💎${user.packs.legend||0} 🏆${user.packs.icon||0}`, inline: true },
          ],
          footer: { text: '¡Ábrelo con !open ' + packType + '!' }
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
  if (cmd === '!buy') {
    let amount = 1, type = '';
    if (!isNaN(args[1])) { amount = parseInt(args[1]); type = (args[2]||'').toLowerCase(); }
    else type = (args[1]||'').toLowerCase();
    if (!packs[type]) return message.reply('❌ Ese pack no existe. Usa `silver`, `bronze`, `gold` , `legend`o `Icon`.');
    if (amount < 1) return message.reply('❌ Cantidad inválida.');
    const totalPrice = packs[type].price * amount;
    if (user.coins < totalPrice) return message.reply(`❌ No tienes monedas suficientes. Necesitas **${totalPrice}** ${EMOJI_COIN} y tienes **${user.coins}** ${EMOJI_COIN}.`);
    user.coins -= totalPrice;
    user.packs[type] += amount;
    saveData();
    return message.reply(`✅ Compraste **${amount}** pack(s) **${packs[type].label}** por **${totalPrice}** ${EMOJI_COIN}`);
  }

  // ─────────────────────────────────────────
  // 🎒 INVENTARIO
  // ─────────────────────────────────────────
  if (cmd === '!inventory') {
    return message.reply(
      `🎒 **Tus packs:**\n` +
      `⚪ Silver: **${user.packs.silver||0}**\n` +
      `🥉 Bronze: **${user.packs.bronze||0}**\n` +
      `🥇 Gold: **${user.packs.gold||0}**\n` +
      `💎 Legend: **${user.packs.legend||0}**\n` +
      `⭐ Icono: **${user.packs.icono||0}**`
    );
  }

  // ─────────────────────────────────────────       
  // 🎮 ABRIR PACK
  // ─────────────────────────────────────────
  if (cmd === '!open') {
    let type = (args[1] || '').toLowerCase();
if (type === 'icon') type = 'icono';
    if (!packs[type]) {
      return message.reply({ embeds: [{ color: 0xFF4444, title: '❌ Pack inválido', description: 'Elige un tipo de pack válido:', fields: [
        { name: '🥉 `!open bronze`', value: 'Jugadores Comunes — **500 💰**', inline: true },
        { name: '⚪ `!open silver`', value: 'Jugadores Raros — **2500 💰**', inline: true },
        { name: '🥇 `!open gold`',   value: 'Jugadores Épicos — **7500 💰**', inline: true },
        { name: '💎 `!open legend`', value: 'Jugadores Legendarios — **15000 💰**', inline: true },
        { name: '💎 `!open icon`', value: 'Jugadores Iconos — **95000 💰**', inline: true },
      ], footer: { text: 'Compra packs con !buy · Ver tienda con !packs' } }] });
    }
    if ((user.packs[type] || 0) <= 0) {
      const pv = PACK_VISUAL[type];
      return message.reply({ embeds: [{ color: parseInt(pv.primary.replace('#',''), 16), title: `${packs[type].emoji} Sin packs ${packs[type].label}`, description: `No tienes packs **${packs[type].label}** disponibles.\nCómpralos con \`!buy ${type}\` por **${packs[type].price} 💰**`, fields: [
        { name: `${EMOJI_COIN} Tu balance`, value: `**${user.coins}** monedas`, inline: true },
        { name: '🎒 Inventario', value: `⚪${user.packs.silver||0} 🥉${user.packs.bronze||0} 🥇${user.packs.gold||0} 💎${user.packs.legend||0}`, inline: true }
      ], footer: { text: 'Usa !packs para ver la tienda completa' } }] });
    }
    if (user.players.length >= MAX_CLUB_SIZE) {
      return message.reply({ embeds: [{ color: 0xFF4444, title: '🏟️ Club lleno', description: `Tu club está al límite (**${MAX_CLUB_SIZE}/${MAX_CLUB_SIZE}** jugadores).\nVende con \`!sell <nombre>\` para hacer espacio.`, footer: { text: 'Usa !club para ver tu plantilla completa' } }] });
    }

    user.packs[type]--;
    const rarityUpChance = { bronze: 0.05, silver: 0.04, gold: 0.03, legend: 0.01, icon: 0.001 };
const upgradeRoll = Math.random();
let pool;
if (upgradeRoll < rarityUpChance[type]) {
  const rarityOrder = ['Comun', 'Raro', 'Epico', 'Legendario', 'Icon'];
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


progressQuest(userId, 'pack_opened', 1);
  if (['gold','legend','icon'].includes(type)) {
    progressQuest(userId, 'gold_pack_opened', 1);
  }

    const sellPrice = SELL_PRICES[newPlayer.rarity] || 90;
    const pv = PACK_VISUAL[type];
    const rarityColors = { 'Icon':0xFFFFFF, 'WorldCup':0xCC2200, 'Legendario':0xFFD700, 'Epico':0x9B59B6, 'Raro':0x5B9BD5, 'Comun':0x8B7355 };
    const rarityBadge  = { 'Icon':'⭐ ICON', 'WorldCup':'🏆 WORLD CUP', 'Legendario':'👑 LEGENDARIO', 'Epico':'💜 ÉPICO', 'Raro':'💙 RARO', 'Comun':'🤍 COMÚN' };
    const rarityEmojis = { 'Icon':'⭐', 'WorldCup':'🏆', 'Legendario':'✨', 'Epico':'💜', 'Raro':'💙', 'Comun':'⚪' };

    let shakeGif = null;
    try { shakeGif = await generatePackShakeGIF(type); } catch(e) { console.error('Error GIF shake:', e); }

    const phase1Embed = {
      color: parseInt(pv.primary.replace('#',''), 16),
      author: { name: `${packs[type].emoji} Pack ${packs[type].label} de ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      title: `🎁 ¡Tu pack está listo!`,
      description: `**${message.author.username}**, tienes un pack **${packs[type].label}** esperando.\n\n🔒 Adentro hay un jugador misterioso...\n⚡ Pulsa el botón para descubrir quién es.`,
      fields: [
        { name: '🎒 Packs restantes', value: `${packs[type].emoji} **${user.packs[type]}**`, inline: true },
        { name: '💰 Tu balance',      value: `**${user.coins}** monedas`,                    inline: true },
      ],
      image: shakeGif ? { url: 'attachment://pack-shake.gif' } : undefined,
      footer: { text: '⚡ ¡Pulsa ABRIR para descubrir tu carta!' },
      timestamp: new Date().toISOString()
    };
    const phase1Row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`open_reveal_${userId}`).setLabel(`⚡ ¡ABRIR PACK!`).setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`open_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)
    );
    const phase1Files = shakeGif ? [{ attachment: shakeGif, name: 'pack-shake.gif' }] : [];
    const packMsg = await message.reply({ embeds: [phase1Embed], files: phase1Files, components: [phase1Row] });
    const openCollector = packMsg.createMessageComponentCollector({ time: 120000 });

    openCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ Este pack no es tuyo.', ephemeral: true });
      if (interaction.customId === `open_cancel_${userId}`) {
        openCollector.stop('cancelled');
        return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Pack cancelado', description: `El pack fue cancelado. El jugador permanece en tu club.` }], files: [], components: [] });
      }
      if (interaction.customId === `open_reveal_${userId}`) {
        openCollector.stop('opened');
        await interaction.update({ embeds: [{ color: parseInt(pv.primary.replace('#',''), 16), title: '💥 ¡ABRIENDO PACK!', description: `⚡ **${message.author.username}** está abriendo su pack...\n\n🌟 _Generando la carta..._`, footer: { text: '✨ Un momento...' }, timestamp: new Date().toISOString() }], files: [], components: [] });

        let explosionGif = null;
        try { explosionGif = await generateExplosionGIF(type, newPlayer); } catch(e) { console.error('Error GIF explosion:', e); }

        await packMsg.edit({ embeds: [{ color: parseInt(pv.primary.replace('#',''), 16), title: '💥 ¡EL PACK SE ABRE!', description: `**${message.author.username}** abre su pack **${packs[type].label}**...\n\n✨ La carta está saliendo...\n🎭 ¿Quién será?`, image: explosionGif ? { url: 'attachment://explosion.gif' } : undefined, footer: { text: '🌟 Revelando en unos segundos...' }, timestamp: new Date().toISOString() }], files: explosionGif ? [{ attachment: explosionGif, name: 'explosion.gif' }] : [], components: [] });
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

        await packMsg.edit({ embeds: [{ color: rarityColors[newPlayer.rarity] || 0x888888, title: `${rarityEmojis[newPlayer.rarity]} ¡CARTA ${newPlayer.rarity.toUpperCase()}!`, description: `**${message.author.username}**, tu carta está casi aquí...\n\n🔮 Rareza detectada: **${rarityBadge[newPlayer.rarity]}**\n❓ Identidad: _???_\n\n_¿Quién será el jugador?_`, image: { url: 'attachment://silhouette.png' }, footer: { text: '🎭 Revelando identidad...' }, timestamp: new Date().toISOString() }], files: [{ attachment: silCanvas.toBuffer(), name: 'silhouette.png' }], components: [] });
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
          author: { name: `${packs[type].emoji} Pack ${packs[type].label} abierto por ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${rarityBadge[newPlayer.rarity]}  ·  ${newPlayer.name}  ·  ${newPlayer.rating} OVR`,
          description: `**Posición:** ${newPlayer.position}  ·  **Rareza:** ${newPlayer.rarity}\n\n${statLines}`,
          fields: [
          { name: '💸 Valor de venta',  value: `**${sellPrice}** ${EMOJI_COIN}`, inline: true },
            { name: '🏟️ En tu club',      value: `**${user.players.length}/${MAX_CLUB_SIZE}**`, inline: true },
            { name: '🎒 Packs restantes', value: `${packs[type].emoji} **${user.packs[type]}**`, inline: true },
          ],
          image: showcaseCanvas ? { url: 'attachment://reveal.png' } : undefined,
          footer: { text: '💡 Añade al equipo o vende con los botones de abajo' },
          timestamp: new Date().toISOString()
        };

        const phase4Row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`pack_add_${userId}`).setLabel('➕ Añadir al equipo').setStyle(ButtonStyle.Success).setDisabled(user.team.length >= 4),
          new ButtonBuilder().setCustomId(`pack_sell_${userId}`).setLabel(`💸 Vender · ${sellPrice} 💰`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`pack_show_${userId}`).setLabel('🖼️ Ver carta').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`pack_another_${userId}_${type}`).setLabel(`🎁 Abrir otro`).setStyle(ButtonStyle.Primary).setDisabled((user.packs[type] || 0) <= 0)
        );

        const revealFiles = showcaseCanvas ? [{ attachment: showcaseCanvas.toBuffer(), name: 'reveal.png' }] : [];
        await packMsg.edit({ content: `🎉 ¡**${newPlayer.name}** salió del pack! ${rarityBadge[newPlayer.rarity]}`, embeds: [phase4Embed], files: revealFiles, components: [phase4Row] });

        const revealCollector = packMsg.createMessageComponentCollector({ time: 90000 });
        revealCollector.on('collect', async btn => {
          if (btn.user.id !== userId) return btn.reply({ content: '❌ Este pack no es tuyo.', ephemeral: true });
          if (btn.customId === `pack_add_${userId}`) {
            if (user.team.length >= 4) return btn.reply({ content: '❌ Tu equipo ya tiene 4 jugadores.', ephemeral: true });
            if (user.team.some(p => p.name === newPlayer.name)) return btn.reply({ content: `❌ **${newPlayer.name}** ya está en tu equipo.`, ephemeral: true });
            user.team.push(deepCopyPlayer(newPlayer)); saveData();
            const updRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`pack_add_${userId}`).setLabel('✅ En el equipo').setStyle(ButtonStyle.Secondary).setDisabled(true),
              new ButtonBuilder().setCustomId(`pack_sell_${userId}`).setLabel(`💸 Vender · ${sellPrice} ${EMOJI_COIN}`).setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId(`pack_show_${userId}`).setLabel('🖼️ Ver carta').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`pack_another_${userId}_${type}`).setLabel(`🎁 Abrir otro`).setStyle(ButtonStyle.Primary).setDisabled((user.packs[type]||0)<=0)
            );
            return btn.update({ content: `✅ **${newPlayer.name}** añadido al equipo! (${user.team.length}/4)`, components: [updRow] });
          }
          if (btn.customId === `pack_sell_${userId}`) {
            const idx = user.players.findLastIndex(p => p.name === newPlayer.name);
            if (idx !== -1) user.players.splice(idx, 1);
            user.coins += sellPrice; saveData();
            const sellCanvas = await generateSellCanvas(newPlayer, sellPrice, user.coins, 1);
            await btn.update({
              content: null,
              embeds: [{ color: 0x00C851, author: { name: `💸 Venta · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) }, image: { url: 'attachment://sell.png' }, timestamp: new Date().toISOString() }],
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
            if ((user.packs[type] || 0) <= 0) return btn.reply({ content: `❌ No tienes más packs ${packs[type].label}.`, ephemeral: true });
            await btn.update({ content: `🎁 ¡Usa \`!o ${type}\` para abrir tu siguiente pack ${packs[type].emoji}!`, components: [] });
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
  if (cmd === '!show') {
    const playerName = args.slice(1).join(' ').trim();
    if (!playerName) return message.reply('❌ Escribe el nombre del jugador. Ej: `!show Veil`');
 
    // Buscar primero en el club del usuario
    const ownedPlayer = (user.players || []).find(p => p.name.toLowerCase() === playerName.toLowerCase());
 
    // Si no la tiene, buscar en el pool global
    const globalPlayer = !ownedPlayer
      ? players.find(p => p.name.toLowerCase() === playerName.toLowerCase())
      : null;
 
    const found = ownedPlayer || globalPlayer;
    const isOwned = !!ownedPlayer;
 
    if (!found) {
      return message.reply(
        `❌ No existe ningún jugador llamado **${playerName}**.\n` +
        `💡 Si lo tienes en tu club, usa \`!club\` para ver el nombre exacto.`
      );
    }
 
    const loadingMsg = await message.reply(`🖼️ Generando carta de **${found.name}**...`);
    let showcaseCanvas;
    try { showcaseCanvas = await drawShowcaseCard(found); }
    catch (e) { console.error('Error generando showcase:', e); return loadingMsg.edit('❌ Error generando la carta.'); }
 
    const tier = getEloTier(user.elo || 1000);
    const inTeam = isOwned && (user.team || []).some(p => p.name === found.name);
    const sellPrice = SELL_PRICES[found.rarity] || 90;
    const rarityColors = { 'Legendario': 0xFFD700, 'Epico': 0x9B59B6, 'Raro': 0x5B9BD5, 'Comun': 0x8B7355 };
    const stats = found.stats || {};
    const statVals = Object.values(stats);
    const avgStat = statVals.length ? Math.round(statVals.reduce((a, b) => a + b, 0) / statVals.length) : 0;
    const maxStat = statVals.length ? Math.max(...statVals) : 0;
    const maxStatKey = Object.keys(stats).find(k => stats[k] === maxStat) || '';
 
    // Fila de acciones — solo mostrar botones de equipo/vender si el usuario TIENE la carta
    let showRow;
    if (isOwned) {
      showRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`show_addteam_${userId}_${found.name}`)
          .setLabel(inTeam ? '✅ En equipo' : '➕ Añadir al equipo')
          .setStyle(inTeam ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setDisabled(inTeam || (user.team || []).length >= 4),
        new ButtonBuilder()
          .setCustomId(`show_sell_${userId}_${found.name}`)
          .setLabel(`💸 Vender (${sellPrice} 💰)`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`show_stats_${userId}_${found.name}`)
          .setLabel('📊 Stats detallados')
          .setStyle(ButtonStyle.Primary)
      );
    } else {
      // No la tiene — solo botón de stats
      showRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`show_stats_${userId}_${found.name}`)
          .setLabel('📊 Stats detallados')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`show_market_${userId}_${found.name}`)
          .setLabel('🏪 Buscar en market')
          .setStyle(ButtonStyle.Secondary)
      );
    }
 
    const ownedNote = isOwned
      ? `${inTeam ? '✅ En tu equipo' : '🔓 En tu plantilla'} · Valor de venta: ${sellPrice} ${EMOJI_COIN}`
      : `❌ No tienes esta carta · Puedes buscarla en \`!market ${found.name}\``;
 
    await loadingMsg.edit({
      content: '',
      embeds: [{
        color: rarityColors[found.rarity] || 0x888888,
        author: { name: `🖼️ Carta — ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `${found.name} — ${found.rarity}`,
        description: `**Posición:** ${found.position}  ·  **OVR:** ${found.rating}\n**Promedio stats:** ${avgStat}  ·  **Mejor stat:** ${maxStatKey} **${maxStat}**\n${ownedNote}`,
        image: { url: 'attachment://showcase.png' },
        footer: { text: `Club: ${user.teamName || message.author.username + "'s FC"}  ·  ELO: ${user.elo || 1000} ${tier.emoji}` },
        timestamp: new Date().toISOString()
      }],
      files: [{ attachment: showcaseCanvas.toBuffer(), name: 'showcase.png' }],
      components: [showRow]
    });
 
    const showCollector = loadingMsg.createMessageComponentCollector({ time: 60000 });
    showCollector.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ Esta carta no es tuya.', ephemeral: true });
 
      // Buscar en market
      if (interaction.customId === `show_market_${userId}_${found.name}`) {
        const marketMatch = marketListings
          .filter(l => l.player.name.toLowerCase() === found.name.toLowerCase() && l.sellerId !== userId)
          .sort((a, b) => a.price - b.price);
        if (!marketMatch.length) {
          return interaction.reply({ content: `❌ **${found.name}** no está en el market ahora mismo. Prueba \`!market\` para ver todo el catálogo.`, ephemeral: true });
        }
        const cheapest = marketMatch[0];
        return interaction.reply({
          content: `🏪 **${found.name}** está disponible en el market por **${cheapest.price.toLocaleString()} 💰** (vendedor: @${cheapest.sellerName}).\nUsa \`!market ${found.name}\` para comprarlo.`,
          ephemeral: true
        });
      }
 
      // Stats detallados
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
            title: `📊 Stats completos — ${found.name}`,
            description: statLines,
            footer: { text: `${found.rarity}  ·  ${found.position}  ·  ${found.rating} OVR` }
          }],
          ephemeral: true
        });
      }
 
      // Solo si la posee: añadir al equipo
      if (interaction.customId === `show_addteam_${userId}_${found.name}`) {
        if (!isOwned) return interaction.reply({ content: '❌ No tienes esta carta.', ephemeral: true });
        if ((user.team || []).length >= 4) return interaction.reply({ content: '❌ Equipo lleno.', ephemeral: true });
        if ((user.team || []).some(p => p.name === found.name)) return interaction.reply({ content: '❌ Ya está en el equipo.', ephemeral: true });
        user.team.push(deepCopyPlayer(found)); saveData();
        const newRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`show_addteam_${userId}_${found.name}`).setLabel('✅ En equipo').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`show_sell_${userId}_${found.name}`).setLabel(`💸 Vender (${sellPrice} 💰)`).setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`show_stats_${userId}_${found.name}`).setLabel('📊 Stats detallados').setStyle(ButtonStyle.Primary)
        );
        return interaction.update({ content: `✅ **${found.name}** añadido al equipo! (${user.team.length}/4)`, components: [newRow] });
      }
 
      // Solo si la posee: vender
      if (interaction.customId === `show_sell_${userId}_${found.name}`) {
        if (!isOwned) return interaction.reply({ content: '❌ No tienes esta carta.', ephemeral: true });
        const idx = (user.players || []).findLastIndex(p => p.name === found.name);
        if (idx === -1) return interaction.reply({ content: '❌ No encontrado en tu club.', ephemeral: true });
        const soldPlayer = user.players[idx];
        const sp = SELL_PRICES[soldPlayer.rarity] || 90;
        user.players.splice(idx, 1);
        user.team = user.team.filter(p => p.name !== found.name);
        user.coins += sp; saveData();
        const sellCanvas = await generateSellCanvas(soldPlayer, sp, user.coins, 1);
        await interaction.update({
          content: null,
          embeds: [{ color: 0x00C851, author: { name: `💸 Venta · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) }, image: { url: 'attachment://sell.png' }, timestamp: new Date().toISOString() }],
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
if (cmd === '!club' && args[1] && args[1].toLowerCase() === 'logo') {
  // Eliminar logo
  if (args[2] && args[2].toLowerCase() === 'remove') {
    if (!user.clubLogo) return message.reply('❌ Tu club no tiene logo actualmente.');
    user.clubLogo = null; saveData();
    return message.reply({ embeds: [{ color: 0xFF4444, title: '🗑️ Logo eliminado', description: 'El logo de tu club fue eliminado.' }] });
  }

  // Poner logo
  const url = args[2];
  if (!url) {
    return message.reply({
      embeds: [{
        color: 0x1a56db,
        title: '🖼️ Logo de club',
        description: [
          '**Uso:** `!club logo <url>`',
          '**Eliminar:** `!club logo remove`',
          '',
          '**Formatos aceptados:** PNG, JPG, JPEG, WEBP',
          '**Tips:**',
          '• Sube la imagen a [imgur.com](https://imgur.com) y copia el link directo',
          '• El link debe terminar en `.png` o `.jpg`',
          '• Ejemplo: `!club logo https://i.imgur.com/abc123.png`',
        ].join('\n'),
        footer: { text: 'El logo aparecerá en !team, !club, !bal y resultados de partidos' }
      }]
    });
  }

  const loadingMsg = await message.reply('⏳ Validando imagen...');
  const result = await fetchClubLogo(url);

  if (!result.ok) {
    return loadingMsg.edit({
      embeds: [{
        color: 0xFF4444,
        title: '❌ Logo inválido',
        description: result.reason,
        fields: [
          { name: '💡 Cómo hacerlo bien', value: '1. Sube tu imagen a **imgur.com**\n2. Abre la imagen sola\n3. Clic derecho → "Copiar dirección de imagen"\n4. Usa ese link con `!club logo <link>`' }
        ]
      }],
      content: ''
    });
  }

  // Guardar como base64 para persistencia
  user.clubLogo = result.buffer.toString('base64');
  saveData();

  return loadingMsg.edit({
    embeds: [{
      color: 0x00C851,
      title: '✅ Logo de club actualizado',
      description: `El logo de **${user.teamName || message.author.username + "'s FC"}** fue actualizado.\nAparece en \`!team\`, \`!club\`, \`!bal\` y partidos.`,
      thumbnail: { url },
      footer: { text: 'Usa !club logo remove para eliminarlo' }
    }],
    content: ''
  });
}


// ─────────────────────────────────────────
// ⚽ PENALTY — Sistema de penales con apuesta
// ─────────────────────────────────────────
if (cmd === '!penalty') {
  const bet = parseInt(args[1]);
  if (isNaN(bet) || bet <= 0) return message.reply('❌ Uso: `!penalty <cantidad>`\nEj: `!penalty 500`');
  if (bet < 50) return message.reply('❌ La apuesta mínima es **50 💰**.');
  if (bet > 50000) return message.reply('❌ La apuesta máxima es **50,000 💰**.');
  if (!isAdmin(userId)) {
  const lastPen = user.lastPenalty || 0;
  const penElapsed = Date.now() - lastPen;
  const PENALTY_CD = 10 * 60 * 1000;
  if (penElapsed < PENALTY_CD) {
    const remaining = PENALTY_CD - penElapsed;
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return message.reply(`⏱️ **Penalty en cooldown** — espera **${mins}m ${secs}s** para volver a jugar.`);
  }
}
  if (user.coins < bet) return message.reply(`❌ No tienes suficientes monedas.\nTienes **${user.coins.toLocaleString()} 💰** y quieres apostar **${bet.toLocaleString()} 💰**.`);

  // Generar zonas ganadoras aleatorias (2 de 5)
  const allZones = [1, 2, 3, 4, 5];
  const shuffled = allZones.sort(() => Math.random() - 0.5);
  const winZones = [shuffled[0], shuffled[1]];

  // Generar canvas del arco
  async function generatePenaltyCanvas() {
    const W = 540, H = 400;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Fondo campo de fútbol
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#1a472a');
    bgGrad.addColorStop(0.6, '#2d6a3f');
    bgGrad.addColorStop(1, '#1a472a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Líneas del campo
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

    // Césped más claro en el centro
    const fieldGrad = ctx.createRadialGradient(W/2, H*0.7, 0, W/2, H*0.7, W*0.8);
    fieldGrad.addColorStop(0, '#2ecc5533');
    fieldGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = fieldGrad;
    ctx.fillRect(0, 0, W, H);

    // ── ARCO ──
    const goalX = 80, goalY = 80;
    const goalW = W - 160, goalH = 180;

    // Sombra del arco
    ctx.save();
    ctx.shadowColor = '#00000088';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;

    // Red del arco (fondo)
    ctx.fillStyle = '#ffffff15';
    ctx.fillRect(goalX, goalY, goalW, goalH);

    // Red (líneas)
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

    // Postes del arco
    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 10;

    // Poste izquierdo
    const postGrad1 = ctx.createLinearGradient(goalX - 6, 0, goalX + 6, 0);
    postGrad1.addColorStop(0, '#888888');
    postGrad1.addColorStop(0.5, '#ffffff');
    postGrad1.addColorStop(1, '#888888');
    ctx.fillStyle = postGrad1;
    ctx.fillRect(goalX - 6, goalY - 4, 12, goalH + 8);

    // Poste derecho
    const postGrad2 = ctx.createLinearGradient(goalX + goalW - 6, 0, goalX + goalW + 6, 0);
    postGrad2.addColorStop(0, '#888888');
    postGrad2.addColorStop(0.5, '#ffffff');
    postGrad2.addColorStop(1, '#888888');
    ctx.fillStyle = postGrad2;
    ctx.fillRect(goalX + goalW - 6, goalY - 4, 12, goalH + 8);

    // Travesaño
    const crossGrad = ctx.createLinearGradient(0, goalY - 6, 0, goalY + 6);
    crossGrad.addColorStop(0, '#888888');
    crossGrad.addColorStop(0.5, '#ffffff');
    crossGrad.addColorStop(1, '#888888');
    ctx.fillStyle = crossGrad;
    ctx.fillRect(goalX - 6, goalY - 6, goalW + 12, 12);

    ctx.restore();

    // ── ZONAS NUMERADAS ──
    // Posiciones fijas de las 5 zonas en el arco
    const zonePositions = [
      { num: 1, x: goalX + goalW * 0.12, y: goalY + goalH * 0.25 },  // arriba izquierda
      { num: 2, x: goalX + goalW * 0.82, y: goalY + goalH * 0.25 },  // arriba derecha
      { num: 3, x: goalX + goalW * 0.12, y: goalY + goalH * 0.72 },  // abajo izquierda
      { num: 4, x: goalX + goalW * 0.82, y: goalY + goalH * 0.72 },  // abajo derecha
      { num: 5, x: goalX + goalW * 0.47, y: goalY + goalH * 0.50 },  // centro
    ];

    for (const zone of zonePositions) {
      // Círculo de fondo
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

      // Número
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

    // ── LÍNEA DE PENALTI ──
    ctx.save();
    ctx.strokeStyle = '#ffffffaa';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(goalX, goalY + goalH + 20);
    ctx.lineTo(goalX + goalW, goalY + goalH + 20);
    ctx.stroke();
    ctx.setLineDash([]);

    // Punto de penalti
    ctx.beginPath();
    ctx.arc(W/2, goalY + goalH + 50, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // ── HEADER ──
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

    // ── FOOTER con apuesta ──
    ctx.save();
    const footerGrad = ctx.createLinearGradient(0, H - 60, 0, H);
    footerGrad.addColorStop(0, '#00000000');
    footerGrad.addColorStop(1, '#000000cc');
    ctx.fillStyle = footerGrad;
    ctx.fillRect(0, H - 60, W, 60);

    ctx.font = `bold 14px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`💰 Apuesta: ${bet.toLocaleString()} 💰  ·  Premio: ${(bet * 2).toLocaleString()} 💰`, W/2, H - 28);
    ctx.font = `12px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff88';
    ctx.fillText('Elige una zona — 2 zonas ganadoras de 5', W/2, H - 10);
    ctx.restore();

    return canvas;
  }

  // Descontar apuesta
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
      footer: { text: `⏱️ Tienes 30 segundos para elegir · Apuesta: ${bet.toLocaleString()} 💰` },
      timestamp: new Date().toISOString()
    }],
    files: [{ attachment: penaltyCanvas.toBuffer(), name: 'penalty.png' }],
    components: [penRow]
  });

  const penCol = penMsg.createMessageComponentCollector({ time: 30000 });

  penCol.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ Este penalty no es tuyo.', ephemeral: true });

    penCol.stop();

    const chosen = parseInt(interaction.customId.replace(`penalty_pick_`, '').replace(`_${userId}`, ''));
    const isWin = winZones.includes(chosen);

    if (isWin) {
      user.coins += bet * 2;
    }
    saveData();

    // Canvas de resultado
    async function generateResultCanvas(won) {
      const W = 540, H = 400;
      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext('2d');

      // Fondo
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, won ? '#0d3320' : '#330d0d');
      bgGrad.addColorStop(0.6, won ? '#1a6b3a' : '#6b1a1a');
      bgGrad.addColorStop(1, won ? '#0d3320' : '#330d0d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Arco igual
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

      // Postes
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(goalX - 6, goalY - 4, 12, goalH + 8);
      ctx.fillRect(goalX + goalW - 6, goalY - 4, 12, goalH + 8);
      ctx.fillRect(goalX - 6, goalY - 6, goalW + 12, 12);

      // Zonas con colores de resultado
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

        // Número o emoji
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

      // Header resultado
      ctx.save();
      ctx.font = `bold 28px ${FIFA_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = won ? '#00ff88' : '#ff4444';
      ctx.shadowColor = won ? '#00ff88' : '#ff4444';
      ctx.shadowBlur = 20;
      ctx.fillText(won ? '⚽ ¡GOOOL! ¡GANASTE!' : '❌ ¡ATAJADO! PERDISTE', W/2, 35);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Footer
      ctx.save();
      ctx.font = `bold 16px ${FIFA_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      if (won) {
        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 10;
        ctx.fillText(`+${bet.toLocaleString()} 💰 ganados · Balance: ${user.coins.toLocaleString()} 💰`, W/2, H - 30);
      } else {
        ctx.fillStyle = '#ff8888';
        ctx.fillText(`-${bet.toLocaleString()} 💰 perdidos · Balance: ${user.coins.toLocaleString()} 💰`, W/2, H - 30);
      }
      ctx.shadowBlur = 0;
      ctx.font = `13px ${FIFA_FONT}`;
      ctx.fillStyle = '#ffffff66';
      ctx.fillText(`Zonas ganadoras: ${winZones.sort((a,b)=>a-b).join(' y ')}`, W/2, H - 10);
      ctx.restore();

      return canvas;
    }

    const resultCanvas = await generateResultCanvas(isWin);

    await interaction.update({
      embeds: [{
        color: isWin ? 0x00ff88 : 0xff4444,
        author: { name: `⚽ Penalty · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        image: { url: 'attachment://penalty-result.png' },
        footer: { text: isWin ? `🎉 ¡Ganaste ${bet.toLocaleString()} 💰!` : `💔 Perdiste ${bet.toLocaleString()} 💰` },
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
        embeds: [{ color: 0x555555, title: '⏱️ Penalty expirado', description: 'No elegiste a tiempo. Tu apuesta fue devuelta.' }],
        files: [], components: []
      }).catch(() => {});
    }
  });

  return;
}


  // ─────────────────────────────────────────
  // 📋 CLUB
  // ─────────────────────────────────────────
  if (cmd === '!club' && args[1] && args[1].toLowerCase() === 'rename') {
    const newName = args.slice(2).join(' ').trim();
    if (!newName) return message.reply('❌ Escribe el nuevo nombre. Ej: `!club rename FC Locos`');
    if (newName.length > 30) return message.reply('❌ El nombre no puede tener más de 30 caracteres.');
    const oldName = user.teamName || message.author.username + "'s FC";
    user.teamName = newName; saveData();
    return message.reply({ embeds:[{ color:0xFFD700, title:'✏️ Nombre de club actualizado', description:`**${oldName}** → **${newName}**`, footer:{text:`Cambiado por ${message.author.username}`}, timestamp:new Date().toISOString() }] });
  }

  if (cmd === '!club') {
    const clubName = user.teamName || message.author.username + "'s FC";
    const totalPlayers = user.players ? user.players.length : 0;
    let page = 0;
    const perPage = 6;
    const totalPages = Math.max(1, Math.ceil(totalPlayers / perPage));
    const rarityEmoji = { "Icon":"⚪", "WorldCup":"🔴","Legendario":"🟡","Epico":"🟣","Raro":"🔵","Comun":"⚪" };
    const posEmoji    = { "GK":"🧤","DM":"🛡️","AM":"🎯","ST":"⚽" };
    function buildClubEmbed(p) {
      const start = p * perPage;
      const slice = (user.players||[]).slice(start, start+perPage);
      const fields = slice.map((pl,i) => ({
        name: `${start+i+1}. ${rarityEmoji[pl.rarity]||'⚫'} ${posEmoji[pl.position]||'👤'} **${pl.name}**`,
        value: `\`${pl.rating} OVR\` · ${pl.position} · ${pl.rarity}${user.team&&user.team.some(t=>t.name===pl.name)?' · ✅ En equipo':''}`,
        inline: true
      }));
      if (fields.length === 0) fields.push({name:'😔 Sin jugadores', value:'Abre packs con `!open silver`', inline:false});
 return { embeds:[{ color:0x1a56db, author:{name:`🏟️  ${clubName}`,icon_url:message.author.displayAvatarURL({dynamic:true})}, thumbnail: user.clubLogo ? { url: 'attachment://club-logo.png' } : undefined, title:`📋 Club de ${message.author.username}`, description:`**${totalPlayers}/${MAX_CLUB_SIZE}** jugadores · Página **${p+1}/${totalPages}**`, fields, footer:{text:`${EMOJI_COIN} ${user.coins} monedas  ·  ELO ${user.elo||1000}`}, timestamp:new Date().toISOString() }] };
    }
    function buildRow(p) {
      const isFirst = p===0, isLast = p>=totalPages-1;
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`club_first_${userId}`).setLabel('⏮').setStyle(ButtonStyle.Secondary).setDisabled(isFirst),
        new ButtonBuilder().setCustomId(`club_prev_${userId}`).setLabel('◀  Anterior').setStyle(ButtonStyle.Primary).setDisabled(isFirst),
        new ButtonBuilder().setCustomId(`club_page_${userId}`).setLabel(`${p+1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`club_next_${userId}`).setLabel('Siguiente  ▶').setStyle(ButtonStyle.Primary).setDisabled(isLast),
        new ButtonBuilder().setCustomId(`club_last_${userId}`).setLabel('⏭').setStyle(ButtonStyle.Secondary).setDisabled(isLast)
      );
    }
    const clubLogoFiles = user.clubLogo ? [{ attachment: Buffer.from(user.clubLogo, 'base64'), name: 'club-logo.png' }] : [];
    const msg = await message.reply({ ...buildClubEmbed(page), files: clubLogoFiles, components: totalPages>1 ? [buildRow(page)] : [] });
    if (totalPages <= 1) return;
    const collector = msg.createMessageComponentCollector({ time:120000 });
    collector.on('collect', interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content:'❌ Este panel no es tuyo.', ephemeral:true });
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
  if (cmd === '!add') {
    const name = args.slice(1).join(' ');
    if (!name) return message.reply('❌ Escribe el nombre del jugador.');
    if (user.team.length >= 4) return message.reply('❌ Tu equipo ya tiene 4 jugadores. Usa `!remove <nombre>` para hacer espacio.');
    const index = user.players.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    if (index === -1) return message.reply(`❌ No tienes a **${name}** en tu club.`);
    if (user.team.some(p => p.name.toLowerCase() === name.toLowerCase())) return message.reply(`❌ **${name}** ya está en tu equipo.`);
    user.team.push(deepCopyPlayer(user.players[index])); saveData();
    return message.reply(`✅ **${user.players[index].name}** añadido al equipo. (${user.team.length}/4)`);
  }

  // ─────────────────────────────────────────
  // ❌ REMOVE
  // ─────────────────────────────────────────
  if (cmd === '!remove') {
    const sub = args.slice(1);
    if (!sub.length) return message.reply('❌ Escribe el nombre del jugador.');
    let cantidad=1, nombre='';
    if (!isNaN(sub[0]) && sub.length > 1) { cantidad=parseInt(sub[0]); nombre=sub.slice(1).join(' '); }
else nombre=sub.join(' ');
    if (!nombre) return message.reply('❌ Nombre inválido.');
    let removidos=0;
    for (let i=user.team.length-1;i>=0;i--) {
      if (user.team[i].name.toLowerCase()===nombre.toLowerCase()) { user.team.splice(i,1); removidos++; if(removidos>=cantidad) break; }
    }
    if (removidos===0) return message.reply(`❌ **${nombre}** no está en tu equipo.`);
    saveData();
    return message.reply(`✅ Quitaste **${removidos}x ${nombre}** del equipo.`);
  }

  // ─────────────────────────────────────────
  // 🗑️ REMOVEALL
  // ─────────────────────────────────────────
  if (cmd === '!removeall') {
    const nombre = args.slice(1).join(' ');
    if (!nombre) return message.reply('❌ Escribe el nombre.');
    const antes = user.team.length;
    user.team = user.team.filter(p => p.name.toLowerCase() !== nombre.toLowerCase());
    const eliminados = antes - user.team.length;
    if (eliminados===0) return message.reply(`❌ **${nombre}** no está en tu equipo.`);
    saveData();
    return message.reply(`✅ Eliminaste todos los **${nombre}** (${eliminados}) del equipo.`);
  }

  // ─────────────────────────────────────────
  // 🔄 SWAP
  // ─────────────────────────────────────────
if (cmd === '!swap') {
    if (!user.team || user.team.length < 2) return message.reply('❌ Necesitas al menos 2 jugadores en el equipo.');
    const posEmoji = { GK:'🧤', DM:'🛡️', AM:'🎯', ST:'⚽' };

    function buildSwapEmbed(selected) {
      const fields = user.team.map(p => ({
        name: `${selected === p.name ? '▶ ' : ''}${posEmoji[p.position]||'👤'} ${p.position}`,
        value: `**${p.name}** · ${p.rating} OVR`,
        inline: true
      }));
      return { embeds:[{ color: selected ? 0xFF6B00 : 0x5865F2,
        title: selected ? `🔄 Swap · Seleccionaste **${selected}** — elige el destino` : '🔄 Swap · Elige el primer jugador',
        fields, footer:{ text:'Intercambia posiciones en el lineup' } }] };
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
      if (interaction.user.id !== userId) return interaction.reply({ content:'❌ Este panel no es tuyo.', ephemeral:true });
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
          await interaction.update({ embeds:[{ color:0x00C851, title:'✅ Swap realizado',
            description:`**${swapSelected}** ↔ **${clickedName}**`, footer:{text:'Usa !team para ver tu equipo'} }], components:[] });
        }
      }
    });

    collector.on('end', (_,reason) => { if(reason !== 'done') swapMsg.edit({ components:[] }).catch(()=>{}); });
    return;
  }
  // ─────────────────────────────────────────
  // 🟢 VER EQUIPO
  // ─────────────────────────────────────────
  if (cmd === '!team') {
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

      // ── Slots fijos por índice: 0=GK, 1=DM, 2=AM, 3=ST ──
      // El canvas coloca al jugador según su POSICIÓN en el array,
      // nunca según su atributo p.position. Así el swap funciona correctamente.
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

      // ── Columna 0: logo + nombre jugador ──
      const displayUser = authorUsername.length>10 ? authorUsername.substring(0,9)+'…' : authorUsername;
      const logoBuffer = user.clubLogo ? Buffer.from(user.clubLogo, 'base64') : null;
      if (logoBuffer) {
        await drawClubLogo(ctx, logoBuffer, colW * 0 + 18, HH / 2, 18);
        ctx.textAlign = 'center';
        ctx.font = `bold 9px ${FIFA_FONT}`; ctx.fillStyle = '#888888';
        ctx.fillText('JUGADOR', colW * 0 + colW / 2, 18);
        ctx.font = `bold 18px ${FIFA_FONT}`; ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#FFD70066'; ctx.shadowBlur = 6;
        ctx.fillText(displayUser, colW * 0 + colW / 2 + 10, 52);
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; ctx.textAlign = 'left';
      } else {
        drawHeaderCol(0, 'jugador', displayUser, '#FFD700');
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
        new ButtonBuilder().setCustomId(`team_add_${uid}`).setLabel('➕ Añadir jugador').setStyle(ButtonStyle.Success).setDisabled(user.team.length>=4),
        new ButtonBuilder().setCustomId(`team_remove_${uid}`).setLabel('➖ Quitar jugador').setStyle(ButtonStyle.Danger).setDisabled(user.team.length===0),
        new ButtonBuilder().setCustomId(`team_swap_${uid}`).setLabel('🔄 Swap posición').setStyle(ButtonStyle.Primary).setDisabled(user.team.length<2),
        new ButtonBuilder().setCustomId(`team_refresh_${uid}`).setLabel('🔃 Actualizar').setStyle(ButtonStyle.Secondary)
      )];
    }

    function buildTeamEmbed() {
      const clubName = user.teamName || message.author.username+"'s FC";
      // Slot labels fijos para el embed, igual que el canvas
      const slotLabels = ['GK','DM','AM','ST'];
      const posEmoji={GK:'🧤',DM:'🛡️',AM:'🎯',ST:'⚽'};
      const rarityEmoji={"Legendario":"🟡","Epico":"🟣","Raro":"🔵","Comun":"⚪"};
      const teamInfo=(user.team||[]).map((p,i)=>{
        const slotLabel = slotLabels[i] || '?';
        return `${posEmoji[slotLabel]||'👤'} ${rarityEmoji[p.rarity]||'⚫'} **${p.name}** · ${p.rating} OVR · ${p.position} _(slot ${slotLabel})_`;
      }).join('\n')||'_Equipo vacío_';
      const avg=user.team.length>0?Math.round(user.team.reduce((s,p)=>s+p.rating,0)/user.team.length):0;
      const chemistry=user.team.length===4?Math.round(calculateTeam(user.team)):'—';
      return { embeds:[{ color:0x00C851, author:{name:`🏟️ ${clubName}`,icon_url:message.author.displayAvatarURL({dynamic:true})}, title:`📋 Equipo de ${message.author.username}`, description:teamInfo, fields:[
        {name:'⭐ OVR Promedio',value:`${avg}`,inline:true},{name:'⚗️ Rating Equipo',value:`${chemistry}`,inline:true},{name:'👥 Jugadores',value:`${user.team.length}/4`,inline:true},
        {name:'💰 Monedas',value:`${user.coins}`,inline:true},{name:'📊 ELO',value:`${user.elo||1000}`,inline:true},{name:'🎒 En plantilla',value:`${(user.players||[]).length}/${MAX_CLUB_SIZE}`,inline:true},
      ], footer:{text:'Usa los botones para gestionar tu equipo • 60s de timeout'}, timestamp:new Date().toISOString() }] };
    }

    const initialCanvas = await buildTeamCanvas(user.team, message.author.username);
    const teamMsg = await message.reply({ ...buildTeamEmbed(), files:[{attachment:initialCanvas.toBuffer(),name:'team.png'}], components:buildTeamButtons(userId) });
    const teamCollector = teamMsg.createMessageComponentCollector({ time:60000 });

    teamCollector.on('collect', async interaction => {
      if (interaction.user.id!==userId) return interaction.reply({content:'❌ Este panel no es tuyo.',ephemeral:true});

      if (interaction.customId===`team_refresh_${userId}`) {
        const c=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({...buildTeamEmbed(),files:[{attachment:c.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`team_add_${userId}`) {
        const available=(user.players||[]).filter(p=>!user.team.some(t=>t.name===p.name));
        if (!available.length) return interaction.reply({content:'❌ No tienes jugadores disponibles para añadir.',ephemeral:true});
        if (user.team.length>=4) return interaction.reply({content:'❌ Tu equipo ya tiene 4 jugadores.',ephemeral:true});
        const posEmoji={GK:'🧤',DM:'🛡️',AM:'🎯',ST:'⚽'};
        const rarityEmoji={"Legendario":"🟡","Epico":"🟣","Raro":"🔵","Comun":"⚪"};
        const addRows=[];
        for (let i=0;i<Math.min(available.length,16);i+=4) {
          addRows.push(new ActionRowBuilder().addComponents(
            available.slice(i,i+4).map(p=>new ButtonBuilder().setCustomId(`teamadd_pick_${p.name}_${userId}`).setLabel(`${posEmoji[p.position]||'👤'} ${p.name} (${p.rating})`).setStyle(p.rarity==='Legendario'||p.rarity==='Epico'?ButtonStyle.Primary:ButtonStyle.Secondary))
          ));
        }
        addRows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`teamadd_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)));
        return interaction.update({ embeds:[{color:0x00C851,title:'➕ Selecciona un jugador para añadir',description:available.slice(0,16).map(p=>`${posEmoji[p.position]||'👤'} ${rarityEmoji[p.rarity]||'⚫'} **${p.name}** · ${p.rating} OVR · ${p.position} · ${p.rarity}`).join('\n'),footer:{text:`${user.team.length}/4 en equipo`}}], files:[], components:addRows });
      }
      if (interaction.customId.startsWith('teamadd_pick_')&&interaction.customId.endsWith(`_${userId}`)) {
        const rawName=interaction.customId.replace('teamadd_pick_','').replace(`_${userId}`,'');
        const playerToAdd=(user.players||[]).find(p=>p.name===rawName);
        if (!playerToAdd) return interaction.reply({content:'❌ Jugador no encontrado.',ephemeral:true});
        if (user.team.length>=4) return interaction.reply({content:'❌ Tu equipo ya está lleno.',ephemeral:true});
        if (user.team.some(p=>p.name===rawName)) return interaction.reply({content:`❌ **${rawName}** ya está en el equipo.`,ephemeral:true});
        user.team.push(deepCopyPlayer(playerToAdd)); saveData();
        const nc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({content:`✅ **${playerToAdd.name}** añadido! (${user.team.length}/4)`,...buildTeamEmbed(),files:[{attachment:nc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`teamadd_cancel_${userId}`) {
        const cc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({...buildTeamEmbed(),files:[{attachment:cc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`team_remove_${userId}`) {
        if (!user.team.length) return interaction.reply({content:'❌ Tu equipo está vacío.',ephemeral:true});
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
        removeRows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`teamrem_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)));
        return interaction.update({ embeds:[{color:0xFF4444,title:'➖ Selecciona un jugador para quitar',description:user.team.map((p,i)=>`${posEmoji[slotLabels[i]]||'👤'} **${p.name}** · ${p.rating} OVR · slot ${slotLabels[i]}`).join('\n'),footer:{text:'El jugador vuelve a tu plantilla'}}], files:[], components:removeRows });
      }
      if (interaction.customId.startsWith('teamrem_pick_')&&interaction.customId.endsWith(`_${userId}`)) {
        const rawName=interaction.customId.replace('teamrem_pick_','').replace(`_${userId}`,'');
        const idx=user.team.findIndex(p=>p.name===rawName);
        if (idx===-1) return interaction.reply({content:'❌ Jugador no encontrado.',ephemeral:true});
        user.team.splice(idx,1); saveData();
        const nc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({content:`✅ **${rawName}** quitado del equipo.`,...buildTeamEmbed(),files:[{attachment:nc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`teamrem_cancel_${userId}`) {
        const cc=await buildTeamCanvas(user.team,message.author.username);
        return interaction.update({...buildTeamEmbed(),files:[{attachment:cc.toBuffer(),name:'team.png'}],components:buildTeamButtons(userId)});
      }
      if (interaction.customId===`team_swap_${userId}`) {
        if (user.team.length<2) return interaction.reply({content:'❌ Necesitas al menos 2 jugadores.',ephemeral:true});
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
        swapRows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`teamswap_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)));
        return interaction.update({ embeds:[{color:0x5865F2,title:'🔄 Swap · Elige el PRIMER jugador',description:user.team.map((p,i)=>`${posEmoji[slotLabels[i]]||'👤'} **${p.name}** en slot **${slotLabels[i]}** (su posición real: ${p.position})`).join('\n'),footer:{text:'Intercambia jugadores entre slots'}}], files:[], components:swapRows });
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
        swapRows2.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`teamswap_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)));
        return interaction.update({ embeds:[{color:0xFF6B00,title:`🔄 Swap · Seleccionaste **${firstPlayer.name}** (slot ${slotLabels[firstIdx]}) — elige el SEGUNDO`,description:user.team.map((p,i)=>`${posEmoji[slotLabels[i]]||'👤'} **${p.name}** en slot **${slotLabels[i]}**`).join('\n')}], files:[], components:swapRows2 });
      }
      if (interaction.customId.startsWith('teamswap2_')&&interaction.customId.endsWith(`_${userId}`)) {
        const parts=interaction.customId.replace('teamswap2_','').replace(`_${userId}`,'').split('_');
        const idxA=parseInt(parts[0]); const idxB=parseInt(parts[1]);
        if (isNaN(idxA)||isNaN(idxB)||!user.team[idxA]||!user.team[idxB]) return interaction.reply({content:'❌ Error al hacer swap.',ephemeral:true});
        const nameA=user.team[idxA].name; const nameB=user.team[idxB].name;
        // ✅ Intercambia jugadores en el array, nunca toca p.position
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
  if (cmd === '!sell') {
    const sub = args.slice(1);
    if (!sub.length) return message.reply(
      '❌ Uso: `!sell <nombre> [precio]`\n' +
      '💡 El precio mínimo por rareza:\n' +
      '• Común: **500** 💰 · Raro: **2.500** 💰 · Épico: **7.500** 💰 · Legendario: **17.000** · Icon: **100.000**💰\n' +
      '• Si no pones precio, se publica al mínimo automáticamente.\n' +
      '• Las cartas expiran del market en **24h** y regresan a tu club.'
    );

    // Detectar si el primer token es un precio (número)
    let nombre = '', precio = null;
    const lastToken = sub[sub.length - 1];
    if (!isNaN(lastToken) && sub.length > 1) {
      precio = parseInt(lastToken);
      nombre = sub.slice(0, -1).join(' ');
    } else {
      nombre = sub.join(' ');
    }

    if (!nombre) return message.reply('❌ Nombre de jugador inválido.');

    // Buscar jugador en el club (no en el equipo activo)
    const playerIdx = user.players.findIndex(p => p.name.toLowerCase() === nombre.toLowerCase());
    if (playerIdx === -1) return message.reply(`❌ No tienes a **${nombre}** en tu club.\n💡 Usa \`!club\` para ver tu plantilla.`);

    const playerToSell = user.players[playerIdx];
    const minPrice = MARKET_MIN_PRICE[playerToSell.rarity] || 500;

    // Validar precio
    if (precio === null) {
      precio = minPrice; // precio mínimo automático
    } else {
      if (isNaN(precio) || precio < minPrice) {
        return message.reply(
          `❌ El precio mínimo para una carta **${playerToSell.rarity}** es **${minPrice.toLocaleString()} 💰**.\n` +
          `💡 Usa \`!sell ${playerToSell.name} ${minPrice}\` para publicarla al mínimo.`
        );
      }
    }

    // Verificar que no tenga ya demasiados listings (máx 5)
    const myListings = marketListings.filter(l => l.sellerId === userId);
    if (myListings.length >= 5) {
      return message.reply('❌ Tienes **5 cartas** en el market. Espera a que se vendan o expiren (24h) antes de publicar más.');
    }

    // Quitar del club y del equipo activo
    user.players.splice(playerIdx, 1);
    user.team = user.team.filter(p => p.name !== playerToSell.name);

    // Crear listing
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

// ── Progreso de misiones ──
    progressQuest(userId, 'card_sold', 1);
    if (['Epico', 'Legendario', 'WorldCup'].includes(playerToSell.rarity)) {
      progressQuest(userId, 'epic_sold', 1);
    }

    const hoursLeft = 24;
    const rarityColors = { 'Legendario': 0xFFD700, 'Epico': 0x9B59B6, 'Raro': 0x5B9BD5, 'Comun': 0x8B7355 };

    return message.reply({
      embeds: [{
        color: rarityColors[playerToSell.rarity] || 0x00C851,
        author: { name: `🏪 Publicado en el Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `${playerToSell.name} — ${playerToSell.rarity} · ${playerToSell.rating} OVR`,
        description: [
          `**Posición:** ${playerToSell.position}`,
          `**Precio:** **${precio.toLocaleString()} 💰**`,
          ``,
          `✅ La carta fue publicada en el market.`,
          `⏱️ Expira en **${hoursLeft}h** — si no se vende, regresa a tu club.`,
          ``,
          `💡 Otros jugadores pueden comprarla con \`!market ${playerToSell.name}\`.`,
        ].join('\n'),
        fields: [
          { name: '🏟️ Club restante', value: `${user.players.length}/${MAX_CLUB_SIZE}`, inline: true },
          { name: '💳 Balance actual', value: `${user.coins.toLocaleString()} 💰`, inline: true },
          { name: '📋 Mis listings',  value: `${myListings.length + 1}/5`, inline: true },
        ],
        footer: { text: `ID listing: ${listingId}  ·  Usa !market para ver todos los jugadores en venta` },
        timestamp: new Date().toISOString()
      }]
    });
  }

   // ─────────────────────────────────────────
   //CANCEL❌
  // ─────────────────────────────────────────

if (cmd === '!cancelar' || cmd === '!cancel') {
    // Buscar los listings del usuario
    const myListings = marketListings.filter(l => l.sellerId === userId);
 
    if (myListings.length === 0) {
      return message.reply({
        embeds: [{
          color: 0xFF6600,
          title: '📋 Sin listings activos',
          description: 'No tienes cartas publicadas en el market ahora mismo.\n\nUsa `!sell <nombre> [precio]` para publicar una carta.',
          footer: { text: 'Usa !market para ver el catálogo completo' }
        }]
      });
    }
 
    const rarityColors = { 'Icon': '0xFFFFFF', 'WorldCup': '0xCC2200','Legendario': 0xFFD700, 'Epico': 0x9B59B6, 'Raro': 0x5B9BD5, 'Comun': 0x8B7355 };  
    const rarityEmoji  = { "Icon": "⭐", "WorldCup": "🏆","Legendario": "👑", "Epico": "💜", "Raro": "💙", "Comun": "⚪" };
    const posEmoji     = { GK: '🧤', DM: '🛡️', AM: '🎯', ST: '⚽' };
 
    // Construir botones (un botón por listing, máx 5)
    const cancelRow = new ActionRowBuilder().addComponents(
      myListings.slice(0, 5).map((l, i) =>
        new ButtonBuilder()
          .setCustomId(`cancelar_listing_${i}_${userId}`)
          .setLabel(`${rarityEmoji[l.player.rarity]} ${l.player.name} — ${l.price.toLocaleString()} 💰`)
          .setStyle(ButtonStyle.Danger)
      )
    );
 
    const now = Date.now();
    const lines = myListings.map((l, i) => {
      const msLeft = MARKET_LISTING_TTL - (now - l.listedAt);
      const hh = Math.max(0, Math.floor(msLeft / 3600000));
      const mm = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
      return `**${i + 1}.** ${posEmoji[l.player.position] || '👤'} ${rarityEmoji[l.player.rarity]} **${l.player.name}** · ${l.player.rarity} · ${l.player.rating} OVR\n💰 Precio: **${l.price.toLocaleString()}** · ⏱️ Expira en ${hh}h ${mm}m`;
    }).join('\n\n');
 
    const cancelMsg = await message.reply({
      embeds: [{
        color: 0xFF6600,
        author: { name: `📋 Mis listings en el market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `Tienes ${myListings.length} carta(s) publicada(s)`,
        description: lines + '\n\n⚠️ Pulsa el botón de la carta que quieres **retirar del market**.\nLa carta regresará inmediatamente a tu club.',
        footer: { text: 'Los listings sin vender regresan solos en 24h' },
        timestamp: new Date().toISOString()
      }],
      components: [cancelRow]
    });
 
    const cancelCol = cancelMsg.createMessageComponentCollector({ time: 60000 });
    cancelCol.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ Este panel no es tuyo.', ephemeral: true });
 
      const parts = interaction.customId.replace('cancelar_listing_', '').replace(`_${userId}`, '').split('_');
      const idx = parseInt(parts[0]);
      const myCurrentListings = marketListings.filter(l => l.sellerId === userId);
      const listing = myCurrentListings[idx];
 
      if (!listing) return interaction.reply({ content: '❌ Ese listing ya no existe. Puede que haya expirado o se haya vendido.', ephemeral: true });
 
      // Devolver carta al club
      if (!user.players) user.players = [];
      user.players.push({ ...listing.player });
 
      // Quitar del market
      marketListings = marketListings.filter(l => l.id !== listing.id);
      saveMarket();
      saveData();
 
      cancelCol.stop();
      await interaction.update({
        embeds: [{
          color: 0x00C851,
          author: { name: `✅ Listing cancelado · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${listing.player.name} de vuelta en tu club`,
          description: [
            `**${listing.player.name}** (${listing.player.rarity} · ${listing.player.rating} OVR · ${listing.player.position}) fue retirado del market.`,
            ``,
            `La carta está de vuelta en tu club. Puedes verla con \`!club\` o añadirla al equipo con \`!add ${listing.player.name}\`.`,
          ].join('\n'),
          fields: [
            { name: '🏟️ Club', value: `${user.players.length}/${MAX_CLUB_SIZE}`, inline: true },
            { name: '📋 Listings restantes', value: `${marketListings.filter(l => l.sellerId === userId).length}/5`, inline: true },
          ],
          footer: { text: 'Usa !sell <nombre> [precio] para volver a publicarla' },
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
if (cmd === '!trade') {
  const target = message.mentions.users.first();
  if (!target) return message.reply('❌ Uso: `!trade @usuario <tu carta> por <su carta>`\nEj: `!trade @Luntek Veil por Compass`');
  if (target.id === userId) return message.reply('❌ No puedes tradear contigo mismo.');
  if (target.bot) return message.reply('❌ No puedes tradear con un bot.');

  // Parsear argumentos: !trade @user MiCarta por SuCarta
  const mentionStr = args[1]; // el @mention
  const restArgs = args.slice(2).join(' '); // "MiCarta por SuCarta"
  const splitByPor = restArgs.split(/\s+por\s+/i);
  if (splitByPor.length < 2) {
    return message.reply(
      '❌ Formato incorrecto.\n' +
      '✅ Uso: `!trade @usuario <tu carta> por <su carta>`\n' +
      'Ej: `!trade @Luntek Veil por Compass`'
    );
  }

  const myCardName  = splitByPor[0].trim();
  const hisCardName = splitByPor[1].trim();

  if (!myCardName || !hisCardName)
    return message.reply('❌ Debes especificar ambas cartas.');

  // Buscar en clubs
  const myCardIdx  = (user.players || []).findIndex(p => p.name.toLowerCase() === myCardName.toLowerCase());
  if (myCardIdx === -1)
    return message.reply(`❌ No tienes a **${myCardName}** en tu club.\nUsa \`!club\` para ver tu plantilla.`);

  if (!data[target.id])
    return message.reply('❌ Ese usuario no tiene perfil registrado todavía.');

  const oppData = data[target.id];
  const hisCardIdx = (oppData.players || []).findIndex(p => p.name.toLowerCase() === hisCardName.toLowerCase());
  if (hisCardIdx === -1)
    return message.reply(`❌ **${target.username}** no tiene a **${hisCardName}** en su club.`);

  const myCard  = user.players[myCardIdx];
  const hisCard = oppData.players[hisCardIdx];

  // Validar misma rareza
  if (myCard.rarity !== hisCard.rarity) {
    return message.reply({
      embeds: [{
        color: 0xFF4444,
        title: '❌ Rareza incompatible',
        description: [
          `Las cartas deben tener la **misma rareza** para poder tradearse.`,
          ``,
          `🃏 **${myCard.name}** — ${myCard.rarity}`,
          `🃏 **${hisCard.name}** — ${hisCard.rarity}`,
          ``,
          `💡 Solo puedes tradear cartas de la misma rareza. Ej: Épico con Épico.`,
        ].join('\n'),
      }]
    });
  }

  // Verificar espacio en clubs (no debería ser problema ya que es 1x1, pero por si acaso)
  const rarityColors = { 'Legendario': 0xFFD700, 'Epico': 0x9B59B6, 'Raro': 0x5B9BD5, 'Comun': 0x8B7355 };
  const rarityEmoji  = { "Legendario": "👑", "Epico": "💜", "Raro": "💙", "Comun": "⚪" };
  const posEmoji     = { GK: '🧤', DM: '🛡️', AM: '🎯', ST: '⚽' };

  // Generar imágenes de ambas cartas
  let myCardCanvas = null, hisCardCanvas = null;
  try { myCardCanvas  = await drawShowcaseCard(myCard);  } catch(e) {}
  try { hisCardCanvas = await drawShowcaseCard(hisCard); } catch(e) {}

  // Embed de confirmación para el INICIADOR
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`trade_confirm_${userId}_${target.id}`)
      .setLabel('✅ Enviar propuesta')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`trade_cancel_${userId}`)
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Danger)
  );

  const myCardStats  = Object.entries(myCard.stats  || {}).map(([k,v]) => `${k}: **${v}**`).join(' · ');
  const hisCardStats = Object.entries(hisCard.stats || {}).map(([k,v]) => `${k}: **${v}**`).join(' · ');

  const proposalEmbed = {
    color: 0x5865F2,
    author: { name: `🔄 Trade — ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
    title: `${myCard.name} ↔ ${hisCard.name}`,
    description: [
      `¿Confirmas enviar esta propuesta de trade a <@${target.id}>?`,
      ``,
      `🏠 **Tú ofreces:** ${rarityEmoji[myCard.rarity]} **${myCard.name}** · ${myCard.rating} OVR · ${myCard.position} · ${myCard.rarity}`,
      `${myCardStats}`,
      ``,
      `✈️ **Pides a cambio:** ${rarityEmoji[hisCard.rarity]} **${hisCard.name}** · ${hisCard.rating} OVR · ${hisCard.position} · ${hisCard.rarity}`,
      `${hisCardStats}`,
    ].join('\n'),
    fields: [
      { name: '⚖️ Rareza', value: `Ambas cartas son **${myCard.rarity}** ✅`, inline: true },
      { name: '⏱️ Timeout', value: '**120 segundos** para que acepte', inline: true },
    ],
    footer: { text: 'El rival recibirá una notificación para aceptar o rechazar' },
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
      return interaction.reply({ content: '❌ Esta propuesta no es tuya.', ephemeral: true });

    if (interaction.customId === `trade_cancel_${userId}`) {
      initCollector.stop();
      return interaction.update({
        embeds: [{ color: 0x555555, title: '❌ Trade cancelado', description: 'Cancelaste la propuesta de trade.' }],
        files: [], components: []
      });
    }

    if (interaction.customId === `trade_confirm_${userId}_${target.id}`) {
      initCollector.stop();

      // Re-validar que ambos sigan teniendo las cartas
      const stillMyCard  = (user.players || []).find(p => p.name.toLowerCase() === myCard.name.toLowerCase());
      const stillHisCard = (oppData.players || []).find(p => p.name.toLowerCase() === hisCard.name.toLowerCase());

      if (!stillMyCard || !stillHisCard) {
        return interaction.update({
          embeds: [{ color: 0xFF4444, title: '❌ Trade inválido', description: 'Una de las cartas ya no está disponible.' }],
          files: [], components: []
        });
      }

      await interaction.update({
        embeds: [{
          color: 0xFFAA00,
          title: '⏳ Propuesta enviada...',
          description: `Esperando respuesta de <@${target.id}>...\n\n⏱️ Tiene **120 segundos** para aceptar o rechazar.`,
        }],
        files: [], components: []
      });

      // Notificar al rival
      const acceptRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade_accept_${userId}_${target.id}`)
          .setLabel('✅ Aceptar trade')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade_reject_${userId}_${target.id}`)
          .setLabel('❌ Rechazar')
          .setStyle(ButtonStyle.Danger)
      );

      const hisCardFiles = [];
      if (hisCardCanvas) hisCardFiles.push({ attachment: hisCardCanvas.toBuffer(), name: 'his-card.png' });

      const tradeNotif = await message.channel.send({
        content: `<@${target.id}> tienes una propuesta de trade de <@${userId}>!`,
        embeds: [{
          color: 0x5865F2,
          author: { name: `🔄 Trade recibido de ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${myCard.name} ↔ ${hisCard.name}`,
          description: [
            `**${message.author.username}** quiere tu carta y ofrece la suya a cambio:`,
            ``,
            `✈️ **Te piden:** ${rarityEmoji[hisCard.rarity]} **${hisCard.name}** · ${hisCard.rating} OVR · ${hisCard.position} · ${hisCard.rarity}`,
            `${hisCardStats}`,
            ``,
            `🏠 **Te ofrecen:** ${rarityEmoji[myCard.rarity]} **${myCard.name}** · ${myCard.rating} OVR · ${myCard.position} · ${myCard.rarity}`,
            `${myCardStats}`,
            ``,
            `⚖️ Ambas cartas son **${myCard.rating} OVR**`,
          ].join('\n'),
          image: hisCardCanvas ? { url: 'attachment://his-card.png' } : undefined,
          footer: { text: '⏱️ Tienes 120 segundos para responder' },
          timestamp: new Date().toISOString()
        }],
        files: hisCardFiles,
        components: [acceptRow]
      });

      const rivalCollector = tradeNotif.createMessageComponentCollector({ time: 120000 });
      rivalCollector.on('collect', async rivalInteraction => {
        if (rivalInteraction.user.id !== target.id) {
          return rivalInteraction.reply({ content: '❌ Esta propuesta no es para ti.', ephemeral: true });
        }

        rivalCollector.stop();

        if (rivalInteraction.customId === `trade_reject_${userId}_${target.id}`) {
          await rivalInteraction.update({
            embeds: [{ color: 0xFF4444, title: '❌ Trade rechazado', description: `**${target.username}** rechazó la propuesta.` }],
            files: [], components: []
          });
          // Notificar al iniciador
          await confirmMsg.edit({
            embeds: [{ color: 0xFF4444, title: '❌ Trade rechazado', description: `<@${target.id}> rechazó tu propuesta de trade.\n\nTu carta **${myCard.name}** sigue en tu club.` }],
            files: [], components: []
          }).catch(() => {});
          return;
        }

        if (rivalInteraction.customId === `trade_accept_${userId}_${target.id}`) {
          // Re-validar una última vez antes de ejecutar
          const finalMyIdx  = (user.players || []).findIndex(p => p.name.toLowerCase() === myCard.name.toLowerCase());
          const finalHisIdx = (oppData.players || []).findIndex(p => p.name.toLowerCase() === hisCard.name.toLowerCase());

          if (finalMyIdx === -1 || finalHisIdx === -1) {
            return rivalInteraction.update({
              embeds: [{ color: 0xFF4444, title: '❌ Trade inválido', description: 'Una de las cartas ya no está disponible (fue vendida o transferida).' }],
              files: [], components: []
            });
          }

          // ── EJECUTAR EL TRADE ──
          const tradedMyCard  = { ...user.players[finalMyIdx] };
          const tradedHisCard = { ...oppData.players[finalHisIdx] };

          // Quitar de cada club
          user.players.splice(finalMyIdx, 1);
          oppData.players.splice(finalHisIdx, 1);

          // Añadir al otro club
          user.players.push({ ...tradedHisCard });
          oppData.players.push({ ...tradedMyCard });

          // Actualizar equipos activos si alguna carta estaba en el team
          const myTeamIdx  = (user.team || []).findIndex(p => p.name.toLowerCase() === tradedMyCard.name.toLowerCase());
          const hisTeamIdx = (oppData.team || []).findIndex(p => p.name.toLowerCase() === tradedHisCard.name.toLowerCase());

          if (myTeamIdx !== -1)  user.team.splice(myTeamIdx, 1);
          if (hisTeamIdx !== -1) oppData.team.splice(hisTeamIdx, 1);

          saveData();

          // Imágenes finales
          let finalMyCanvas = null, finalHisCanvas = null;
          try { finalMyCanvas  = await drawShowcaseCard(tradedHisCard); } catch(e) {}
          try { finalHisCanvas = await drawShowcaseCard(tradedMyCard);  } catch(e) {}

          // Actualizar notificación del rival
          const rivalFiles = finalHisCanvas
            ? [{ attachment: finalHisCanvas.toBuffer(), name: 'traded-card.png' }]
            : [];

          await rivalInteraction.update({
            embeds: [{
              color: 0x00C851,
              author: { name: `✅ Trade completado` },
              title: `¡Recibiste a ${tradedMyCard.name}!`,
              description: [
                `El trade se realizó con éxito.`,
                ``,
                `📥 **Recibiste:** ${rarityEmoji[tradedMyCard.rarity]} **${tradedMyCard.name}** · ${tradedMyCard.rating} OVR · ${tradedMyCard.position} · ${tradedMyCard.rarity}`,
                `📤 **Entregaste:** ${rarityEmoji[tradedHisCard.rarity]} **${tradedHisCard.name}** · ${tradedHisCard.rating} OVR`,
                ``,
                `Usa \`!club\` para ver tu plantilla actualizada.`,
              ].join('\n'),
              image: finalHisCanvas ? { url: 'attachment://traded-card.png' } : undefined,
              footer: { text: `Club: ${oppData.players.length}/${MAX_CLUB_SIZE} jugadores` },
              timestamp: new Date().toISOString()
            }],
            files: rivalFiles,
            components: []
          });

          // Actualizar mensaje del iniciador
          const initiatorFiles = finalMyCanvas
            ? [{ attachment: finalMyCanvas.toBuffer(), name: 'received-card.png' }]
            : [];

          await confirmMsg.edit({
            embeds: [{
              color: 0x00C851,
              author: { name: `✅ Trade completado` },
              title: `¡Recibiste a ${tradedHisCard.name}!`,
              description: [
                `<@${target.id}> aceptó el trade.`,
                ``,
                `📥 **Recibiste:** ${rarityEmoji[tradedHisCard.rarity]} **${tradedHisCard.name}** · ${tradedHisCard.rating} OVR · ${tradedHisCard.position} · ${tradedHisCard.rarity}`,
                `📤 **Entregaste:** ${rarityEmoji[tradedMyCard.rarity]} **${tradedMyCard.name}** · ${tradedMyCard.rating} OVR`,
                ``,
                `Usa \`!club\` para ver tu plantilla actualizada.`,
              ].join('\n'),
              image: finalMyCanvas ? { url: 'attachment://received-card.png' } : undefined,
              footer: { text: `Club: ${user.players.length}/${MAX_CLUB_SIZE} jugadores` },
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
            embeds: [{ color: 0x555555, title: '⏱️ Trade expirado', description: `No respondió a tiempo. El trade fue cancelado.` }],
            files: [], components: []
          }).catch(() => {});
          confirmMsg.edit({
            embeds: [{ color: 0x555555, title: '⏱️ Trade expirado', description: `<@${target.id}> no respondió a tiempo.` }],
            files: [], components: []
          }).catch(() => {});
        }
      });
    }
  });

  initCollector.on('end', (_, reason) => {
    if (reason === 'time') {
      confirmMsg.edit({
        embeds: [{ color: 0x555555, title: '⏱️ Trade expirado', description: 'No confirmaste la propuesta a tiempo.' }],
        files: [], components: []
      }).catch(() => {});
    }
  });

  return;
}


// ─────────────────────────────────────────
  // 🏪 MERCADO — Compra directa de jugadores
  // ─────────────────────────────────────────
  if (cmd === '!market') {
    const playerName = args.slice(1).join(' ').trim();

    // Limpiar listings expirados antes de mostrar
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

    // ── Sin argumento → catálogo paginado ──
    if (!playerName) {
progressQuest(userId, 'market_visited', 1);
      if (marketListings.length === 0) {
        return message.reply({
          embeds: [{
            color: 0x1a1a2e,
            title: '🏪 Market — Sin listings',
            description: [
              '**No hay cartas en venta ahora mismo.**',
              '',
              '💡 Para vender una carta usa:',
              '`!sell <nombre> [precio]`',
              '',
              '• El precio mínimo es el precio del sobre correspondiente.',
              '• Las cartas duran **24h** en el market.',
            ].join('\n'),
            footer: { text: 'Sé el primero en publicar una carta' }
          }]
        });
      }

      const PAGE_SIZE = 8;
      // Ordenar: más baratos primero, luego por rating descendente
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

        // Fondo
        const bgGrad = ctx.createLinearGradient(0, 0, W, FULL_H);
        bgGrad.addColorStop(0, '#08080f');
        bgGrad.addColorStop(0.5, '#0e0e1c');
        bgGrad.addColorStop(1, '#08080f');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, FULL_H);

        // Puntos decorativos
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
        ctx.fillText('  MARKET DE JUGADORES', W / 2, 48);
        ctx.shadowBlur = 0;
        ctx.font = `13px ${FIFA_FONT}`;
        ctx.fillStyle = '#ffffff44';
        ctx.fillText(`${sorted.length} carta${sorted.length !== 1 ? 's' : ''} en venta  ·  Página ${page + 1} / ${totalPages}  ·  !market <nombre> para comprar`, W / 2, 68);
        ctx.restore();

        // Separador
        ctx.save();
        const lineGrad = ctx.createLinearGradient(40, 0, W - 40, 0);
        lineGrad.addColorStop(0, 'transparent');
        lineGrad.addColorStop(0.3, '#FFD700aa');
        lineGrad.addColorStop(0.7, '#FFD700aa');
        lineGrad.addColorStop(1, 'transparent');
        ctx.strokeStyle = lineGrad; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, 78); ctx.lineTo(W - 40, 78); ctx.stroke();
        ctx.restore();

        // Headers de columna
        const cols = { num: 42, name: 66, pos: 280, rarity: 360, ovr: 490, seller: 570, price: 700, ttl: 800 };
        ctx.save();
        ctx.font = `bold 11px ${FIFA_FONT}`;
        ctx.fillStyle = '#ffffff55';
        ctx.textAlign = 'left';
        ctx.fillText('#',       cols.num,    100);
        ctx.fillText('JUGADOR', cols.name,   100);
        ctx.fillText('POS',     cols.pos,    100);
        ctx.fillText('RAREZA',  cols.rarity, 100);
        ctx.fillText('OVR',     cols.ovr,    100);
        ctx.fillText('VENDEDOR',cols.seller, 100);
        ctx.fillText('PRECIO',  cols.price,  100);
        ctx.fillText('EXPIRA',  cols.ttl,    100);
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#ffffff15'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(40, 108); ctx.lineTo(W - 40, 108); ctx.stroke();
        ctx.restore();

        const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const rarityColor = { "Icon": '#FFFFFF', "WorldCup": '#CC2200',"Legendario": '#FFD700', "Epico": '#9B59B6', "Raro": '#5B9BD5', "Comun": '#A0836A' };
        const rarityEmoji = { "Icon": '⭐', "WorldCup": '🏆', "Legendario": '👑', "Epico": '💜', "Raro": '💙', "Comun": '⚪' };
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

          // Fondo de fila
          ctx.save();
          ctx.fillStyle = isMine ? '#ffffff05' : (i % 2 === 0 ? '#ffffff08' : '#00000020');
          roundRectPath(ctx, 30, rowY - 2, W - 60, 48, 8);
          ctx.fill();
          ctx.restore();

          // Barra de rareza
          ctx.save();
          ctx.fillStyle = rarityColor[p.rarity] || '#888888';
          ctx.globalAlpha = 0.8;
          roundRectPath(ctx, 30, rowY - 2, 4, 48, 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();

          // Número
          ctx.save();
          ctx.font = `11px ${FIFA_FONT}`;
          ctx.fillStyle = '#ffffff30';
          ctx.textAlign = 'right';
          ctx.fillText(`${page * PAGE_SIZE + i + 1}.`, cols.name - 6, rowY + 28);
          ctx.restore();

          // Nombre
          ctx.save();
          ctx.font = `bold 15px ${FIFA_FONT}`;
          ctx.fillStyle = isMine ? '#FFD70099' : '#ffffff';
          ctx.textAlign = 'left';
          ctx.fillText(p.name + (isMine ? ' (tuyo)' : ''), cols.name, rowY + 28);
          ctx.restore();

          // Posición
          ctx.save();
          ctx.font = `bold 12px ${FIFA_FONT}`;
          ctx.fillStyle = '#cccccc';
          ctx.fillText(`${posEmoji[p.position] || ''} ${p.position}`, cols.pos, rowY + 28);
          ctx.restore();

          // Rareza
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

          // Vendedor
          ctx.save();
          ctx.font = `12px ${FIFA_FONT}`;
          ctx.fillStyle = isMine ? '#FFD70099' : '#aaaaaa';
          const sellerDisplay = listing.sellerName.length > 10 ? listing.sellerName.slice(0, 9) + '…' : listing.sellerName;
          ctx.fillText(sellerDisplay, cols.seller, rowY + 28);
          ctx.restore();

          // Precio
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

          // Separador
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
        ctx.fillText(`💰 Tu balance: ${user.coins.toLocaleString()} monedas  ·  Usa !sell <nombre> [precio] para publicar`, W / 2, FULL_H - 14);
        ctx.restore();

        return canvas;
      }

      function buildNavRow(uid, page) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`mkt_prev_${uid}`).setLabel('◀ Anterior').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
          new ButtonBuilder().setCustomId(`mkt_page_${uid}`).setLabel(`${page + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`mkt_next_${uid}`).setLabel('Siguiente ▶').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
          new ButtonBuilder().setCustomId(`mkt_mylistings_${uid}`).setLabel('📋 Mis listings').setStyle(ButtonStyle.Secondary)
        );
      }

      const canvas0 = await buildMarketCanvas(mPage);
      const mktMsg = await message.reply({
        embeds: [{
          color: 0x1a1a2e,
          author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          image: { url: 'attachment://market.png' },
          footer: { text: `!market <nombre> para comprar directamente · !sell <nombre> [precio] para vender` },
          timestamp: new Date().toISOString()
        }],
        files: [{ attachment: canvas0.toBuffer(), name: 'market.png' }],
        components: [buildNavRow(userId, mPage)]
      });

      const col = mktMsg.createMessageComponentCollector({ time: 120000 });
      col.on('collect', async interaction => {
        if (interaction.user.id !== userId) return interaction.reply({ content: '❌ Este market no es tuyo.', ephemeral: true });

        if (interaction.customId === `mkt_mylistings_${userId}`) {
          const mine = marketListings.filter(l => l.sellerId === userId && l.price != null && l.player != null);
          if (!mine.length) return interaction.reply({ content: '❌ No tienes cartas en el market ahora mismo.', ephemeral: true });
          const lines = mine.map((l, i) => {
            const msLeft = MARKET_LISTING_TTL - (Date.now() - l.listedAt);
            const hh = Math.max(0, Math.floor(msLeft / 3600000));
            const mm = Math.max(0, Math.floor((msLeft % 3600000) / 60000));
            return `${i + 1}. **${l.player.name}** · ${l.player.rarity} · **${l.price.toLocaleString()} 💰** · expira en ${hh}h ${mm}m`;
          }).join('\n');
          return interaction.reply({
            embeds: [{
              color: 0xFFD700,
              title: `📋 Tus listings en el market (${mine.length}/5)`,
              description: lines,
              footer: { text: 'Las cartas regresan a tu club si expiran sin venderse' }
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
            footer: { text: `!market <nombre> para comprar directamente · !sell <nombre> [precio] para vender` },
            timestamp: new Date().toISOString()
          }],
          files: [{ attachment: nc.toBuffer(), name: 'market.png' }],
          components: [buildNavRow(userId, mPage)]
        });
      });
      col.on('end', () => mktMsg.edit({ components: [] }).catch(() => {}));
      return;
    }

    // ── Con argumento → comprar del market dinámico ──
    // Buscar listings que coincidan con el nombre (puede haber varios, mostrar el más barato)
    const matches = marketListings
      .filter(l => l.player.name.toLowerCase() === playerName.toLowerCase() && l.sellerId !== userId)
      .sort((a, b) => a.price - b.price);

    const myOwnListings = marketListings.filter(
      l => l.player.name.toLowerCase() === playerName.toLowerCase() && l.sellerId === userId
    );

    if (matches.length === 0 && myOwnListings.length === 0) {
      // Buscar si el nombre existe en algún listing aunque sea para darte info
      const anyMatch = marketListings.find(l => l.player.name.toLowerCase() === playerName.toLowerCase());
      return message.reply({
        embeds: [{
          color: 0xFF4444,
          title: '❌ No encontrado en el market',
          description: [
            `No hay cartas de **${playerName}** en venta ahora mismo.`,
            '',
            '💡 Usa `!market` para ver todas las cartas disponibles.',
            '💡 Usa `!sell <nombre> [precio]` para publicar la tuya.',
          ].join('\n')
        }]
      });
    }

    if (myOwnListings.length > 0 && matches.length === 0) {
      return message.reply({
        embeds: [{
          color: 0xFF6600,
          title: '⚠️ Es tu propia carta',
          description: `Tienes **${myOwnListings.length}** carta(s) de **${myOwnListings[0].player.name}** en el market pero no puedes comprarte a ti mismo.\n\nLas cartas expirarán y regresarán a tu club si nadie las compra.`
        }]
      });
    }

    const rarityColors = { 'Icon': 0xFFFFFF, 'WorldCup': 0xCC2200, 'Legendario': 0xFFD700, 'Epico': 0x9B59B6, 'Raro': 0x5B9BD5, 'Comun': 0x8B7355 };
    const rarityEmoji  = { "Icon": '⭐ ICON', "WorldCup": '🏆 WORLD CUP', "Legendario": '👑 LEGENDARIO', "Epico": '💜 ÉPICO', "Raro": '💙 RARO', "Comun": '⚪ COMÚN' };

    // ── Si hay un solo listing, ir directo a la confirmación ──
    // ── Si hay varios, mostrar selector de vendedor ──

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
      if (clubFull)        descExtra = `\n\n❌ **Tu club está lleno (${MAX_CLUB_SIZE}/${MAX_CLUB_SIZE}).** Vende jugadores primero.`;
      else if (!canAfford) descExtra = `\n\n❌ **Sin monedas suficientes.** Te faltan **${(listing.price - user.coins).toLocaleString()} 💰**.`;
      else                 descExtra = `\n\n✅ **Puedes comprar.** Te quedarán **${(user.coins - listing.price).toLocaleString()} 💰**.`;

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mktbuy_confirm_${userId}_${listing.id}`)
          .setLabel(`✅ Comprar — ${listing.price.toLocaleString()} 💰`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(!canAfford || clubFull),
        new ButtonBuilder()
          .setCustomId(`mktbuy_cancel_${userId}`)
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`mktbuy_back_${userId}`)
          .setLabel('⬅️ Volver')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(matches.length <= 1)
      );

      return {
        content: null,
        embeds: [{
          color: rarityColors[p.rarity] || 0x1a1a2e,
          author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${rarityEmoji[p.rarity]}  ·  ${p.name}  ·  ${p.rating} OVR`,
          description: `**Posición:** ${p.position}  ·  **Rareza:** ${p.rarity}\n\n${statLines}${descExtra}`,
          fields: [
            { name: '💸 Precio',       value: `**${listing.price.toLocaleString()}** 💰`,      inline: true },
            { name: '💰 Tu balance',   value: `**${user.coins.toLocaleString()}** 💰`,          inline: true },
            { name: '👤 Vendedor',     value: `@${listing.sellerName}`,                          inline: true },
            { name: '⏱️ Expira en',   value: `${hLeft}h ${mLeft}m`,                             inline: true },
            { name: '🏟️ Tu club',     value: `${(user.players || []).length}/${MAX_CLUB_SIZE}`, inline: true },
            { name: '📋 Disponibles', value: `${matches.length} listing(s)`,                    inline: true },
          ],
          image: showcaseCanvas ? { url: 'attachment://mkt-card.png' } : undefined,
          footer: { text: '⏱️ Tienes 60 segundos para confirmar' },
          timestamp: new Date().toISOString()
        }],
        files: showcaseCanvas ? [{ attachment: showcaseCanvas.toBuffer(), name: 'mkt-card.png' }] : [],
        components: [confirmRow]
      };
    }

    // ── Si hay múltiples listings, mostrar selector primero ──
    let selectedListing = matches[0];

    if (matches.length > 1) {
      // Mostrar lista de todos los vendedores disponibles con botones
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
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Danger)
      ));

      const listLines = matches.slice(0, 5).map((l, i) => {
        const msL = MARKET_LISTING_TTL - (now - l.listedAt);
        const hL  = Math.max(0, Math.floor(msL / 3600000));
        const mL  = Math.max(0, Math.floor((msL % 3600000) / 60000));
        const canAffordThis = user.coins >= l.price;
        const icon = canAffordThis ? '✅' : '❌';
        return `${icon} **${i + 1}.** @${l.sellerName} — **${l.price.toLocaleString()} 💰** · expira en ${hL}h ${mL}m`;
      }).join('\n');

      const selectorMsg = await message.reply({
        embeds: [{
          color: rarityColors[matches[0].player.rarity] || 0x1a1a2e,
          author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${matches[0].player.name} — ${matches[0].player.rarity} · ${matches[0].player.rating} OVR`,
          description: `Hay **${matches.length}** listing(s) disponibles. Elige a qué vendedor comprársela:\n\n${listLines}${matches.length > 5 ? `\n_...y ${matches.length - 5} más_` : ''}`,
          fields: [
            { name: '💰 Tu balance', value: `**${user.coins.toLocaleString()}** 💰`, inline: true },
            { name: '🏟️ Tu club',   value: `${(user.players || []).length}/${MAX_CLUB_SIZE}`, inline: true },
          ],
          footer: { text: 'Selecciona el vendedor al que quieres comprarle' },
          timestamp: new Date().toISOString()
        }],
        components: selectorRows
      });

      const selCol = selectorMsg.createMessageComponentCollector({ time: 60000 });
      selCol.on('collect', async interaction => {
        if (interaction.user.id !== userId) return interaction.reply({ content: '❌ No es tuyo.', ephemeral: true });

        if (interaction.customId === `mktsel_cancel_${userId}`) {
          selCol.stop();
          return interaction.update({
            embeds: [{ color: 0x555555, title: '❌ Compra cancelada', description: `Cancelaste la compra de **${matches[0].player.name}**.` }],
            files: [], components: []
          });
        }

        // Encontrar el listing seleccionado
        const listingId = interaction.customId.replace(`mktsel_${userId}_`, '');
        const chosenListing = matches.find(l => l.id === listingId);
        if (!chosenListing) return interaction.reply({ content: '❌ Ese listing ya no existe.', ephemeral: true });

        selectedListing = chosenListing;
        selCol.stop();

        // Mostrar confirmación de compra
        const confirmData = await showListingConfirm(selectedListing);
        await interaction.update(confirmData);

        // Collector para la confirmación
        const buyCol2 = selectorMsg.createMessageComponentCollector({ time: 60000 });
        buyCol2.on('collect', async btn => {
          if (btn.user.id !== userId) return btn.reply({ content: '❌ No es tuyo.', ephemeral: true });

          if (btn.customId === `mktbuy_cancel_${userId}`) {
            buyCol2.stop();
            return btn.update({ embeds: [{ color: 0x555555, title: '❌ Compra cancelada', description: `Cancelaste la compra de **${selectedListing.player.name}**.` }], files: [], components: [] });
          }

          if (btn.customId === `mktbuy_back_${userId}`) {
            buyCol2.stop();
            // Volver al selector
            await btn.update({
              embeds: [{
                color: rarityColors[matches[0].player.rarity] || 0x1a1a2e,
                author: { name: `🏪 Market · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
                title: `${matches[0].player.name} — ${matches[0].player.rarity} · ${matches[0].player.rating} OVR`,
                description: `Hay **${matches.length}** listing(s) disponibles. Elige a qué vendedor comprársela:\n\n${listLines}${matches.length > 5 ? `\n_...y ${matches.length - 5} más_` : ''}`,
                fields: [
                  { name: '💰 Tu balance', value: `**${user.coins.toLocaleString()}** 💰`, inline: true },
                  { name: '🏟️ Tu club',   value: `${(user.players || []).length}/${MAX_CLUB_SIZE}`, inline: true },
                ],
                footer: { text: 'Selecciona el vendedor al que quieres comprarle' },
                timestamp: new Date().toISOString()
              }],
              files: [],
              components: selectorRows
            });
            // Relanzar selector
            const selCol2 = selectorMsg.createMessageComponentCollector({ time: 60000 });
            selCol2.on('collect', async i2 => {
              if (i2.user.id !== userId) return i2.reply({ content: '❌', ephemeral: true });
              if (i2.customId === `mktsel_cancel_${userId}`) {
                selCol2.stop();
                return i2.update({ embeds: [{ color: 0x555555, title: '❌ Cancelado' }], files: [], components: [] });
              }
              const lid2 = i2.customId.replace(`mktsel_${userId}_`, '');
              const chosen2 = matches.find(l => l.id === lid2);
              if (!chosen2) return i2.reply({ content: '❌ Ya no existe.', ephemeral: true });
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
      // Un solo listing — comportamiento original
      const confirmData = await showListingConfirm(matches[0]);
      const buyMsg = await message.reply(confirmData);

      const buyCol = buyMsg.createMessageComponentCollector({ time: 60000 });
      buyCol.on('collect', async interaction => {
        if (interaction.user.id !== userId) return interaction.reply({ content: '❌ No es tuyo.', ephemeral: true });
        if (interaction.customId === `mktbuy_cancel_${userId}`) {
          buyCol.stop();
          return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Compra cancelada', description: `Cancelaste la compra de **${matches[0].player.name}**.` }], files: [], components: [] });
        }
        if (interaction.customId === `mktbuy_confirm_${userId}_${matches[0].id}`) {
          await executePurchase(interaction, buyMsg, matches[0]);
          buyCol.stop();
        }
      });
      buyCol.on('end', (_, reason) => { if (reason === 'time') buyMsg.edit({ components: [] }).catch(() => {}); });
    }

    // ── Función reutilizable para ejecutar la compra ──
    async function executePurchase(interaction, msgRef, listing) {
      const p = listing.player;
      const stillThere = marketListings.find(l => l.id === listing.id);
      if (!stillThere) return interaction.update({ embeds: [{ color: 0xFF4444, title: '❌ Ya no disponible', description: 'Esta carta ya fue vendida o expiró.' }], files: [], components: [] });
      if (user.coins < listing.price) return interaction.update({ embeds: [{ color: 0xFF4444, title: '❌ Sin monedas', description: 'Ya no tienes suficientes monedas.' }], files: [], components: [] });
      if ((user.players || []).length >= MAX_CLUB_SIZE) return interaction.update({ embeds: [{ color: 0xFF4444, title: '❌ Club lleno', description: 'Tu club está lleno.' }], files: [], components: [] });

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
          seller.send({ embeds: [{ color: 0x00C851, title: '💸 ¡Tu carta se vendió!', description: `**${p.name}** fue comprada por **@${message.author.username}**.\n\n💰 Recibiste **+${listing.price.toLocaleString()} 💰**.`, footer: { text: 'Usa !bal para ver tu balance' } }] }).catch(() => {});
        }
      } catch (e) {}

      let finalCanvas = null;
      try { finalCanvas = await drawShowcaseCard({ ...p }); } catch (e) {}

      const postRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mktpost_add_${userId}_${p.name}`).setLabel('➕ Añadir al equipo').setStyle(ButtonStyle.Success).setDisabled((user.team || []).length >= 4),
        new ButtonBuilder().setCustomId(`mktpost_sell_${userId}`).setLabel('💸 Vender de nuevo').setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({
        content: `🎉 ¡**${p.name}** es tuyo!`,
        embeds: [{
          color: rarityColors[p.rarity] || 0x00C851,
          author: { name: `✅ Compra exitosa · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `${p.name} — ${p.rarity}  ·  ${p.rating} OVR`,
          description: `**Posición:** ${p.position}  ·  Comprado a @${listing.sellerName}`,
          fields: [
            { name: '💸 Pagaste',       value: `**${listing.price.toLocaleString()}** 💰`, inline: true },
            { name: '💰 Nuevo balance', value: `**${user.coins.toLocaleString()}** 💰`,     inline: true },
            { name: '🏟️ Club',         value: `**${user.players.length}/${MAX_CLUB_SIZE}**`, inline: true },
          ],
          image: finalCanvas ? { url: 'attachment://bought.png' } : undefined,
          footer: { text: '¡Añádelo al equipo o vuélvelo a vender!' },
          timestamp: new Date().toISOString()
        }],
        files: finalCanvas ? [{ attachment: finalCanvas.toBuffer(), name: 'bought.png' }] : [],
        components: [postRow]
      });

      const postCol = msgRef.createMessageComponentCollector({ time: 60000 });
      postCol.on('collect', async btn => {
        if (btn.user.id !== userId) return btn.reply({ content: '❌ No es tuyo.', ephemeral: true });
        if (btn.customId === `mktpost_add_${userId}_${p.name}`) {
          if ((user.team || []).length >= 4) return btn.reply({ content: '❌ Equipo lleno.', ephemeral: true });
          if ((user.team || []).some(t => t.name === p.name)) return btn.reply({ content: `❌ **${p.name}** ya está en tu equipo.`, ephemeral: true });
          user.team.push({ ...p }); saveData();
          return btn.update({ content: `✅ **${p.name}** añadido al equipo! (${user.team.length}/4)`, components: [] });
        }
        if (btn.customId === `mktpost_sell_${userId}`) {
          return btn.reply({ content: `💡 Usa \`!sell ${p.name} <precio>\` para venderla de nuevo.`, ephemeral: true });
        }
      });
      postCol.on('end', () => msgRef.edit({ components: [] }).catch(() => {}));
    }

    return;
  }


  // ─────────────────────────────────────────
  // 🤝 FRIENDLY
  // ─────────────────────────────────────────
  if (cmd === '!friendly') {
  const opponent = message.mentions.users.first();
  if (!opponent) return message.reply('❌ Menciona a tu rival. Ej: `!friendly @usuario`');
  if (opponent.id===userId) return message.reply('❌ No puedes jugar contra ti mismo.');
  if (!data[opponent.id]||(data[opponent.id].team||[]).length<4) return message.reply('❌ El rival no tiene equipo armado (necesita 4 jugadores).');
  if (user.team.length<4) return message.reply('❌ Necesitas 4 jugadores en tu equipo.');

  if (!isAdmin(userId)) {
    const lastFriendly = Math.max(friendlyCooldowns.get(userId) || 0, user.lastFriendly || 0);
    const elapsed = Date.now() - lastFriendly;
    if (elapsed < FRIENDLY_COOLDOWN_MS) {
      const remaining = FRIENDLY_COOLDOWN_MS - elapsed;
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      return message.reply(`⏱️ **Friendly en cooldown** — espera **${mins}m ${secs}s** para volver a jugar.`);
    }
  }

  friendlyCooldowns.set(userId, Date.now());
  user.lastFriendly = Date.now();
  saveData();
  progressQuest(userId, 'friendly_played', 1);   // ← AGREGAR
  return playMatchEngine(userId, opponent.id, false, message, message.author.username);
}


  // ⚔️ ARENA
  // ─────────────────────────────────────────
  if (cmd === '!arena') {
    if ((user.team||[]).length < 4) return message.reply('❌ Necesitas **4 jugadores** en tu equipo para entrar a la Arena.\nUsa `!team` para armar tu equipo.');
    if (!isAdmin(userId)) {
  const lastArena = Math.max(arenaCooldowns.get(userId) || 0, user.lastArena || 0);
  const elapsed = Date.now() - lastArena;
  if (elapsed < ARENA_COOLDOWN_MS) {
        const remaining = ARENA_COOLDOWN_MS - elapsed;
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        return message.reply(`⏱️ **Arena en cooldown** — espera **${mins}m ${secs}s** para volver a jugar.`);
      }
    }

    // Buscar rival automático del ranking (sin cola)
    const userElo = user.elo || 1000;
    const userTier = getEloTier(userElo);

    // Obtener todos los jugadores con equipo completo excepto el usuario
    const candidates = Object.entries(data).filter(([id, d]) => {
      return id !== userId && (d.team||[]).length >= 4;
    });

    if (candidates.length === 0) {
      return message.reply(`❌ No hay rivales disponibles con equipo completo.\nPide a tus amigos que armen sus equipos con \`!team\`.`);
    }

    // Ordenar por ELO más cercano
    candidates.sort((a, b) => Math.abs((a[1].elo||1000) - userElo) - Math.abs((b[1].elo||1000) - userElo));

    // Elegir entre los 5 más cercanos aleatoriamente para variedad
    const pool = candidates.slice(0, Math.min(5, candidates.length));
    const [oppId, oppData] = pool[Math.floor(Math.random() * pool.length)];

    arenaCooldowns.set(userId, Date.now());
  user.lastArena = Date.now();
  saveData();
  progressQuest(userId, 'arena_played', 1);   // ← AGREGAR
  return playMatchEngine(userId, oppId, true, message, message.author.username);
  }

  // ─────────────────────────────────────────
  // 🏅 TOP
  // ─────────────────────────────────────────
  if (cmd === '!top') {
    const ranking = Object.entries(data)
      .sort((a, b) => (b[1].elo || 1000) - (a[1].elo || 1000))
      .slice(0, 10);

    const medals = ['🥇','🥈','🥉'];

    let description = '';
    ranking.forEach(([uid, udata], i) => {
      const elo = udata.elo || 1000;
      const tier = getEloTier(elo);
      const num = i < 3 ? medals[i] : `**${i+1}**`;
      description += `${num} <@${uid}> — **${elo}** ${tier.emoji}\n`;
    });

    return message.reply({ embeds: [{ 
      color: 0xFFD700,
      title: '🏆 Top 10 — Arena',
      description,
      footer: { text: `Jugadores registrados: ${Object.keys(data).length}` },
      timestamp: new Date().toISOString()
    }]});
  }


// ─────────────────────────────────────────
// 📊 STATS — Historial y estadísticas de partidos
// ─────────────────────────────────────────
if (cmd === '!stats') {
  const targetMention = message.mentions.users.first();
  const rivalArg = args.slice(targetMention ? 0 : 1).join(' ').trim();

  // ── !stats @usuario → enfrentamientos directos ──
  if (targetMention && targetMention.id !== userId) {
    const rivalId = targetMention.id;
    const myHistory = user.matchHistory || [];
    const vsMatches = myHistory.filter(m => m.oppId === rivalId);

    if (vsMatches.length === 0) {
      return message.reply({
        embeds: [{
          color: 0x2b2d31,
          title: `📊 Sin enfrentamientos`,
          description: `No tienes partidos registrados contra **${targetMention.username}**.`,
          footer: { text: 'El historial solo registra partidos jugados desde la última actualización' }
        }]
      });
    }

    const wins   = vsMatches.filter(m => m.result === 'win').length;
    const draws  = vsMatches.filter(m => m.result === 'draw').length;
    const losses = vsMatches.filter(m => m.result === 'loss').length;
    const goalsFor     = vsMatches.reduce((s, m) => s + m.myGoals, 0);
    const goalsAgainst = vsMatches.reduce((s, m) => s + m.oppGoals, 0);
    const arenaCount   = vsMatches.filter(m => m.type === 'arena').length;
    const friendlyCount = vsMatches.filter(m => m.type === 'friendly').length;

    const winRate = Math.round((wins / vsMatches.length) * 100);
    const dominance = wins > losses ? '🟢 Llevas ventaja' : wins < losses ? '🔴 Llevas desventaja' : '🟡 Igualados';

    // Últimos 5 enfrentamientos
    const last5 = vsMatches.slice(0, 5).map(m => {
      const icon = m.result === 'win' ? '✅' : m.result === 'draw' ? '🟡' : '❌';
      const date = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      const typeIcon = m.type === 'arena' ? '⚔️' : '🤝';
      return `${icon} ${typeIcon} **${m.myGoals}-${m.oppGoals}** · ${date}`;
    }).join('\n');

    // Barra de dominio visual
    const totalBars = 10;
    const winBars   = Math.round((wins  / vsMatches.length) * totalBars);
    const lossBars  = Math.round((losses / vsMatches.length) * totalBars);
    const drawBars  = totalBars - winBars - lossBars;
    const dominanceBar = '🟢'.repeat(winBars) + '🟡'.repeat(Math.max(0, drawBars)) + '🔴'.repeat(lossBars);

    const myClubName  = user.teamName || message.author.username + "'s FC";
    const rivalData   = data[rivalId];
    const rivalClub   = rivalData?.teamName || targetMention.username + "'s FC";

    return message.reply({
      embeds: [{
        color: wins > losses ? 0x00C851 : wins < losses ? 0xFF4444 : 0xFFAA00,
        author: {
          name: `⚔️ Enfrentamientos directos`,
          icon_url: message.author.displayAvatarURL({ dynamic: true })
        },
        title: `${myClubName}  vs  ${rivalClub}`,
        description: `${dominance}\n\n${dominanceBar}`,
        fields: [
          { name: '✅ Victorias',  value: `**${wins}**`,   inline: true },
          { name: '🟡 Empates',   value: `**${draws}**`,  inline: true },
          { name: '❌ Derrotas',  value: `**${losses}**`, inline: true },
          { name: '⚽ Goles a favor',  value: `**${goalsFor}**`,     inline: true },
          { name: '🥅 Goles en contra', value: `**${goalsAgainst}**`, inline: true },
          { name: '📈 % Victoria',  value: `**${winRate}%**`,        inline: true },
          { name: '🎮 Partidos',    value: `⚔️ Arena: **${arenaCount}** · 🤝 Friendly: **${friendlyCount}**`, inline: false },
          { name: `📋 Últimos ${Math.min(5, vsMatches.length)} enfrentamientos`, value: last5, inline: false },
        ],
        footer: { text: `Total: ${vsMatches.length} partido${vsMatches.length !== 1 ? 's' : ''} entre ambos` },
        timestamp: new Date().toISOString()
      }]
    });
  }

  // ── !stats → estadísticas propias ──
  const myHistory = user.matchHistory || [];

  if (myHistory.length === 0) {
    return message.reply({
      embeds: [{
        color: 0x2b2d31,
        title: `📊 Sin historial`,
        description: `No tienes partidos registrados aún.\n\nJuega con \`!arena\` o \`!friendly @rival\` para empezar.`,
        footer: { text: 'El historial registra todos tus partidos desde la última actualización' }
      }]
    });
  }

  // Estadísticas globales
  const totalGames = myHistory.length;
  const wins    = myHistory.filter(m => m.result === 'win').length;
  const draws   = myHistory.filter(m => m.result === 'draw').length;
  const losses  = myHistory.filter(m => m.result === 'loss').length;
  const goalsFor     = myHistory.reduce((s, m) => s + m.myGoals, 0);
  const goalsAgainst = myHistory.reduce((s, m) => s + m.oppGoals, 0);
  const totalReward  = myHistory.reduce((s, m) => s + (m.reward || 0), 0);

  // Por modo
  const arenaHistory    = myHistory.filter(m => m.type === 'arena');
  const friendlyHistory = myHistory.filter(m => m.type === 'friendly');
  const arenaWins   = arenaHistory.filter(m => m.result === 'win').length;
  const friendlyWins = friendlyHistory.filter(m => m.result === 'win').length;

  const winRate = Math.round((wins / totalGames) * 100);

  // Racha actual
  let currentStreak = 0, streakType = '';
  for (const m of myHistory) {
    if (currentStreak === 0) { currentStreak = 1; streakType = m.result; }
    else if (m.result === streakType) currentStreak++;
    else break;
  }
  const streakEmoji = streakType === 'win' ? '🔥' : streakType === 'draw' ? '🟡' : '❄️';
  const streakLabel = streakType === 'win' ? 'victorias' : streakType === 'draw' ? 'empates' : 'derrotas';
  const streakText  = currentStreak >= 2 ? `${streakEmoji} **${currentStreak}** ${streakLabel} seguidas` : 'Sin racha activa';

  // Rival más enfrentado
  const rivalCount = {};
  myHistory.forEach(m => {
    rivalCount[m.oppName] = (rivalCount[m.oppName] || 0) + 1;
  });
  const topRival = Object.entries(rivalCount).sort((a, b) => b[1] - a[1])[0];

  // Rival más derrotado
  const winsVsRival = {};
  myHistory.filter(m => m.result === 'win').forEach(m => {
    winsVsRival[m.oppName] = (winsVsRival[m.oppName] || 0) + 1;
  });
  const topVictimEntry = Object.entries(winsVsRival).sort((a, b) => b[1] - a[1])[0];
  const topVictim = topVictimEntry ? `@${topVictimEntry[0]} (${topVictimEntry[1]}V)` : '—';

  // Últimos 8 partidos — badges
  const last8 = myHistory.slice(0, 8).map(m => {
    const icon = m.result === 'win' ? '✅' : m.result === 'draw' ? '🟡' : '❌';
    const typeIcon = m.type === 'arena' ? '⚔️' : '🤝';
    const date = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    return `${icon}${typeIcon} **${m.myGoals}-${m.oppGoals}** vs @${m.oppName} · ${date}`;
  }).join('\n');

  // Forma (últimos 5) — W/D/L
  const form = myHistory.slice(0, 5).map(m =>
    m.result === 'win' ? '**W**' : m.result === 'draw' ? '**D**' : '**L**'
  ).join(' · ');

  const tier = getEloTier(user.elo || 1000);
  const clubName = user.teamName || message.author.username + "'s FC";

  // Construir embed con páginas si hay muchos partidos
  let page = 0;
  const showHistory = args[1] === 'history' || args[1] === 'h';

  if (showHistory) {
    // Mostrar historial paginado
    const PAGE_SIZE = 8;
    const totalPages = Math.ceil(myHistory.length / PAGE_SIZE);

    function buildHistoryEmbed(p) {
      const slice = myHistory.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
      const lines = slice.map((m, i) => {
        const icon = m.result === 'win' ? '✅' : m.result === 'draw' ? '🟡' : '❌';
        const typeIcon = m.type === 'arena' ? '⚔️ Arena' : '🤝 Friendly';
        const date = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const rewardStr = m.reward ? `+${m.reward} 💰` : '';
        return `${icon} **${m.myGoals}-${m.oppGoals}** vs @${m.oppName} · ${typeIcon} · ${date} · ${rewardStr}`;
      }).join('\n');

      return {
        embeds: [{
          color: 0x2b2d31,
          author: {
            name: `📋 Historial de partidos · ${message.author.username}`,
            icon_url: message.author.displayAvatarURL({ dynamic: true })
          },
          title: `${clubName} — ${totalGames} partidos jugados`,
          description: lines || '_Sin partidos_',
          fields: [
            { name: '✅ V', value: `**${wins}**`,  inline: true },
            { name: '🟡 E', value: `**${draws}**`, inline: true },
            { name: '❌ D', value: `**${losses}**`, inline: true },
          ],
          footer: { text: `Página ${p + 1}/${totalPages}  ·  !stats para resumen  ·  !stats @usuario para H2H` },
          timestamp: new Date().toISOString()
        }]
      };
    }

    function buildHistoryRow(p) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`stats_prev_${userId}`).setLabel('◀ Anterior').setStyle(ButtonStyle.Primary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId(`stats_page_${userId}`).setLabel(`${p + 1} / ${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`stats_next_${userId}`).setLabel('Siguiente ▶').setStyle(ButtonStyle.Primary).setDisabled(p >= totalPages - 1),
        new ButtonBuilder().setCustomId(`stats_back_${userId}`).setLabel('📊 Resumen').setStyle(ButtonStyle.Secondary)
      );
    }

    const histMsg = await message.reply({ ...buildHistoryEmbed(page), components: totalPages > 1 ? [buildHistoryRow(page)] : [] });
    if (totalPages <= 1) return;

    const histCol = histMsg.createMessageComponentCollector({ time: 120000 });
    histCol.on('collect', async interaction => {
      if (interaction.user.id !== userId) return interaction.reply({ content: '❌ No es tuyo.', ephemeral: true });
      if (interaction.customId === `stats_next_${userId}` && page < totalPages - 1) page++;
      if (interaction.customId === `stats_prev_${userId}` && page > 0) page--;
      if (interaction.customId === `stats_back_${userId}`) {
        histCol.stop();
        return interaction.update({ components: [] });
      }
      interaction.update({ ...buildHistoryEmbed(page), components: [buildHistoryRow(page)] });
    });
    histCol.on('end', () => histMsg.edit({ components: [] }).catch(() => {}));
    return;
  }

  // ── Vista resumen ──
  const statsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`stats_history_${userId}`).setLabel('📋 Ver historial completo').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`stats_arena_${userId}`).setLabel('⚔️ Solo Arena').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`stats_friendly_${userId}`).setLabel('🤝 Solo Friendly').setStyle(ButtonStyle.Secondary)
  );

  function buildStatsEmbed(mode) {
    const history = mode === 'arena' ? arenaHistory : mode === 'friendly' ? friendlyHistory : myHistory;
    const mWins   = history.filter(m => m.result === 'win').length;
    const mDraws  = history.filter(m => m.result === 'draw').length;
    const mLosses = history.filter(m => m.result === 'loss').length;
    const mFor    = history.reduce((s, m) => s + m.myGoals, 0);
    const mAgainst = history.reduce((s, m) => s + m.oppGoals, 0);
    const mRate   = history.length > 0 ? Math.round((mWins / history.length) * 100) : 0;
    const modeLabel = mode === 'arena' ? '⚔️ Arena' : mode === 'friendly' ? '🤝 Friendly' : '🌐 Global';

    const totalBars2 = 12;
    const wBars = history.length > 0 ? Math.round((mWins  / history.length) * totalBars2) : 0;
    const dBars = history.length > 0 ? Math.round((mDraws / history.length) * totalBars2) : 0;
    const lBars = Math.max(0, totalBars2 - wBars - dBars);
    const wdlBar = `\`${'█'.repeat(wBars)}${'▒'.repeat(dBars)}${'░'.repeat(lBars)}\` ${mRate}% wins`;

    return {
      embeds: [{
        color: mWins > mLosses ? 0x00C851 : mWins < mLosses ? 0xFF4444 : 0xFFAA00,
        author: {
          name: `📊 Estadísticas ${modeLabel} · ${message.author.username}`,
          icon_url: message.author.displayAvatarURL({ dynamic: true })
        },
        title: clubName,
        description: wdlBar,
        fields: [
          { name: '✅ Victorias',    value: `**${mWins}**`,            inline: true },
          { name: '🟡 Empates',      value: `**${mDraws}**`,           inline: true },
          { name: '❌ Derrotas',     value: `**${mLosses}**`,          inline: true },
          { name: '⚽ Goles favor',  value: `**${mFor}**`,             inline: true },
          { name: '🥅 Goles contra', value: `**${mAgainst}**`,         inline: true },
          { name: '🎮 Partidos',     value: `**${history.length}**`,   inline: true },
          ...(mode === 'all' ? [
            { name: '🔥 Forma (últ. 5)', value: form || '—',          inline: false },
            { name: '📈 Racha actual',   value: streakText,            inline: true  },
            { name: '💰 Monedas ganadas',value: `**${totalReward.toLocaleString()}** 💰`, inline: true },
            { name: '🥊 Rival frecuente',value: topRival ? `@${topRival[0]} (${topRival[1]} veces)` : '—', inline: true },
            { name: '🏆 Víctima fav.',   value: topVictim,            inline: true  },
            { name: `📋 Últimos ${Math.min(8, myHistory.length)}`, value: last8 || '—', inline: false },
          ] : [])
        ],
        footer: {
          text: `${tier.emoji} ${tier.name}  ·  ELO ${user.elo || 1000}  ·  !stats h para historial completo  ·  !stats @usuario para H2H`
        },
        timestamp: new Date().toISOString()
      }]
    };
  }

  const statsMsg = await message.reply({ ...buildStatsEmbed('all'), components: [statsRow] });

  const statsCol = statsMsg.createMessageComponentCollector({ time: 60000 });
  statsCol.on('collect', async interaction => {
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ No es tuyo.', ephemeral: true });

    if (interaction.customId === `stats_history_${userId}`) {
      statsCol.stop();
      // Relanzar historial paginado
      page = 0;
      const PAGE_SIZE = 8;
      const totalPages = Math.ceil(myHistory.length / PAGE_SIZE);
      function buildH(p) {
        const slice = myHistory.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE);
        const lines = slice.map(m => {
          const icon = m.result === 'win' ? '✅' : m.result === 'draw' ? '🟡' : '❌';
          const typeIcon = m.type === 'arena' ? '⚔️' : '🤝';
          const date = new Date(m.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
          return `${icon} **${m.myGoals}-${m.oppGoals}** vs @${m.oppName} · ${typeIcon} · ${date} · +${m.reward || 0} 💰`;
        }).join('\n');
        return { embeds: [{ color: 0x2b2d31, author: { name: `📋 Historial · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) }, description: lines || '—', footer: { text: `Página ${p+1}/${totalPages}` }, timestamp: new Date().toISOString() }] };
      }
      function buildHRow(p) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`sh_prev_${userId}`).setLabel('◀').setStyle(ButtonStyle.Primary).setDisabled(p === 0),
          new ButtonBuilder().setCustomId(`sh_page_${userId}`).setLabel(`${p+1}/${totalPages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId(`sh_next_${userId}`).setLabel('▶').setStyle(ButtonStyle.Primary).setDisabled(p >= totalPages - 1)
        );
      }
      await interaction.update({ ...buildH(page), components: totalPages > 1 ? [buildHRow(page)] : [] });
      const hCol2 = statsMsg.createMessageComponentCollector({ time: 120000 });
      hCol2.on('collect', async i2 => {
        if (i2.user.id !== userId) return i2.reply({ content: '❌', ephemeral: true });
        if (i2.customId === `sh_next_${userId}` && page < totalPages - 1) page++;
        if (i2.customId === `sh_prev_${userId}` && page > 0) page--;
        i2.update({ ...buildH(page), components: [buildHRow(page)] });
      });
      hCol2.on('end', () => statsMsg.edit({ components: [] }).catch(() => {}));
      return;
    }

    if (interaction.customId === `stats_arena_${userId}`) {
      return interaction.update({ ...buildStatsEmbed('arena'), components: [statsRow] });
    }
    if (interaction.customId === `stats_friendly_${userId}`) {
      return interaction.update({ ...buildStatsEmbed('friendly'), components: [statsRow] });
    }
  });
  statsCol.on('end', () => statsMsg.edit({ components: [] }).catch(() => {}));
  return;
}


// ─────────────────────────────────────────
// 🎮 PLAYERS — Ver todos los jugadores disponibles
// ─────────────────────────────────────────
if (cmd === '!players') {
  const filterArg = (args[1] || '').toLowerCase();

  // Filtros opcionales: rareza o posición
  const validRarities = ['legendario', 'epico', 'raro', 'comun'];
  const validPositions = ['gk', 'dm', 'am', 'st'];
  let filteredPlayers = [...players];

  if (validRarities.includes(filterArg)) {
    const rarityMap = { legendario: 'Legendario', epico: 'Epico', raro: 'Raro', comun: 'Comun' };
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

    // Fondo
    const bgGrad = ctx.createLinearGradient(0, 0, W, FULL_H);
    bgGrad.addColorStop(0, '#08080f');
    bgGrad.addColorStop(0.5, '#0e0e1c');
    bgGrad.addColorStop(1, '#08080f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, FULL_H);

    // Puntos decorativos
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
      ? ` · Filtro: ${args[1].toUpperCase()}`
      : '';
    ctx.save();
    ctx.font = `bold 32px ${FIFA_FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 18;
    ctx.fillText('🎮  JUGADORES DISPONIBLES', W / 2, 48);
    ctx.shadowBlur = 0;
    ctx.font = `13px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff44';
    ctx.fillText(`${filteredPlayers.length} jugador${filteredPlayers.length !== 1 ? 'es' : ''}${filterLabel}  ·  Página ${page + 1} / ${totalPages}  ·  !show <nombre> para ver la carta`, W / 2, 68);
    ctx.restore();

    // Separador
    ctx.save();
    const lineGrad = ctx.createLinearGradient(40, 0, W - 40, 0);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.3, '#FFD700aa');
    lineGrad.addColorStop(0.7, '#FFD700aa');
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 78); ctx.lineTo(W - 40, 78); ctx.stroke();
    ctx.restore();

    // Columnas
    const cols = { num: 42, name: 66, pos: 280, rarity: 360, ovr: 500, pac: 570, sho: 630, pas: 690, dri: 750, pack: 800 };
    ctx.save();
    ctx.font = `bold 11px ${FIFA_FONT}`;
    ctx.fillStyle = '#ffffff55';
    ctx.textAlign = 'left';
    ctx.fillText('#',       cols.num,  100);
    ctx.fillText('JUGADOR', cols.name, 100);
    ctx.fillText('POS',     cols.pos,  100);
    ctx.fillText('RAREZA',  cols.rarity, 100);
    ctx.fillText('OVR',     cols.ovr,  100);
    ctx.fillText('PAC',     cols.pac,  100);
    ctx.fillText('SHO',     cols.sho,  100);
    ctx.fillText('PAS',     cols.pas,  100);
    ctx.fillText('DRI',     cols.dri,  100);
    ctx.fillText('PACK',    cols.pack, 100);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#ffffff15'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 108); ctx.lineTo(W - 40, 108); ctx.stroke();
    ctx.restore();

    const rarityColor = { 'Icon': 0xFFFFFF, "WorldCup": '#CC2200', "Legendario": '#FFD700', "Epico": '#9B59B6', "Raro": '#5B9BD5', "Comun": '#A0836A' };
const rarityEmoji = { "Icon": '⭐', "WorldCup": '🏆', "Legendario": '👑', "Epico": '💜', "Raro": '💙', "Comun": '⚪' };
const posEmoji    = { GK: '🧤', DM: '🛡️', AM: '🎯', ST: '⚽' };
const packForRarity = { "Icon": '⭐ Icon', "WorldCup": '🏆 World Cup', "Legendario": '💎 Legend', "Epico": '🥇 Gold', "Raro": '🥈 Silver', "Comun": '🥉 Bronze' };

    slice.forEach((p, i) => {
      const rowY = 118 + i * 50;
      const globalIdx = page * PAGE_SIZE + i;

      // Fondo de fila
      ctx.save();
      ctx.fillStyle = i % 2 === 0 ? '#ffffff08' : '#00000020';
      roundRectPath(ctx, 30, rowY - 2, W - 60, 44, 8);
      ctx.fill();
      ctx.restore();

      // Barra de rareza
      ctx.save();
      ctx.fillStyle = rarityColor[p.rarity] || '#888888';
      ctx.globalAlpha = 0.8;
      roundRectPath(ctx, 30, rowY - 2, 4, 44, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Número
      ctx.save();
      ctx.font = `11px ${FIFA_FONT}`;
      ctx.fillStyle = '#ffffff30';
      ctx.textAlign = 'right';
      ctx.fillText(`${globalIdx + 1}.`, cols.name - 6, rowY + 26);
      ctx.restore();

      // Nombre
      ctx.save();
      ctx.font = `bold 15px ${FIFA_FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cols.name, rowY + 26);
      ctx.restore();

      // Posición
      ctx.save();
      ctx.font = `bold 12px ${FIFA_FONT}`;
      ctx.fillStyle = '#cccccc';
      ctx.fillText(`${posEmoji[p.position] || ''} ${p.position}`, cols.pos, rowY + 26);
      ctx.restore();

      // Rareza
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

      // Stats principales (o stats de GK)
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

      // Pack necesario
      ctx.save();
      ctx.font = `11px ${FIFA_FONT}`;
      ctx.fillStyle = '#888888';
      ctx.textAlign = 'left';
      ctx.fillText(packForRarity[p.rarity] || '—', cols.pack, rowY + 26);
      ctx.restore();

      // Separador
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
    ctx.fillText(`Filtros: !players legendario · !players epico · !players raro · !players comun · !players gk · !players st · !players am · !players dm`, W / 2, FULL_H - 14);
    ctx.restore();

    return canvas;
  }

  function buildPlayersNavRow(uid, page) {
    const filterLabel = filterArg ? ` [${args[1].toUpperCase()}]` : '';
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`players_prev_${uid}`).setLabel('◀ Anterior').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(`players_page_${uid}`).setLabel(`${page + 1} / ${totalPages}${filterLabel}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(`players_next_${uid}`).setLabel('Siguiente ▶').setStyle(ButtonStyle.Primary).setDisabled(page >= totalPages - 1),
      new ButtonBuilder().setCustomId(`players_random_${uid}`).setLabel('🎲 Aleatorio').setStyle(ButtonStyle.Secondary)
    );
  }

  if (filteredPlayers.length === 0) {
    return message.reply({ embeds: [{ color: 0xFF4444, title: '❌ Sin resultados', description: `No hay jugadores con el filtro **${args[1]}**.\n\n**Filtros válidos:** legendario · epico · raro · comun · gk · dm · am · st` }] });
  }

  const canvas0 = await buildPlayersCanvas(pPage);
  const playersMsg = await message.reply({
    embeds: [{
      color: 0x1a1a2e,
      author: { name: `🎮 Jugadores · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
      image: { url: 'attachment://players.png' },
      footer: { text: `Total: ${filteredPlayers.length} jugadores  ·  !show <nombre> para ver carta  ·  !market para comprar/vender` },
      timestamp: new Date().toISOString()
    }],
    files: [{ attachment: canvas0.toBuffer(), name: 'players.png' }],
    components: totalPages > 1 ? [buildPlayersNavRow(userId, pPage)] : []
  });

  if (totalPages <= 1) return;

  const col = playersMsg.createMessageComponentCollector({ time: 120000 });
  col.on('collect', async interaction => {
    if (interaction.user.id !== userId) return interaction.reply({ content: '❌ Este panel no es tuyo.', ephemeral: true });

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
        author: { name: `🎮 Jugadores · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        image: { url: 'attachment://players.png' },
        footer: { text: `Total: ${filteredPlayers.length} jugadores  ·  !show <nombre> para ver carta  ·  !market para comprar/vender` },
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
  // ❓ AYUDA
  // ─────────────────────────────────────────
  if (cmd === '!help') {
    let helpPage=0;
    const helpMsg=await message.reply({...buildHelpEmbed(helpPage),components:[buildHelpRow(userId,helpPage)]});
    const helpCollector=helpMsg.createMessageComponentCollector({time:120000});
    helpCollector.on('collect',async interaction=>{
      if (interaction.user.id!==userId) return interaction.reply({content:'❌ Este panel no es tuyo.',ephemeral:true});
      if (interaction.customId===`help_next_${userId}`&&helpPage<helpPages.length-1) helpPage++;
      if (interaction.customId===`help_prev_${userId}`&&helpPage>0) helpPage--;
      await interaction.update({...buildHelpEmbed(helpPage),components:[buildHelpRow(userId,helpPage)]});
    });
    helpCollector.on('end',()=>helpMsg.edit({components:[]}).catch(()=>{}));
    return;
  }

// ─────────────────────────────────────────
// 💸 SEND — Transferir monedas a otro usuario
// ─────────────────────────────────────────
if (cmd === '!send') {
  const target = message.mentions.users.first();
  const amount = parseInt(args[2]);

  if (!target) return message.reply('❌ Uso: `!send @usuario cantidad`\nEj: `!send @Luntek 500`');
  if (target.id === userId) return message.reply('❌ No puedes enviarte monedas a ti mismo.');
  if (target.bot) return message.reply('❌ No puedes enviar monedas a un bot.');
  if (isNaN(amount) || amount <= 0) return message.reply('❌ Escribe una cantidad válida mayor a 0.');
  if (amount < 50) return message.reply('❌ El mínimo para transferir es **50** 💰.');
  if (user.coins < amount) return message.reply(`❌ No tienes suficientes monedas.\nTienes **${user.coins.toLocaleString()}** 💰 y quieres enviar **${amount.toLocaleString()}** 💰.`);

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
      .setLabel(`✅ Confirmar envío de ${amount.toLocaleString()} 💰`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`send_cancel_${userId}`)
      .setLabel('❌ Cancelar')
      .setStyle(ButtonStyle.Danger)
  );

  const confirmMsg = await message.reply({
    embeds: [{
      color: 0x2b2d31,
      author: {
        name: `💸 Transferencia · ${message.author.username}`,
        icon_url: message.author.displayAvatarURL({ dynamic: true })
      },
      description: [
        `¿Confirmas el envío de **${amount.toLocaleString()} 💰** a <@${target.id}>?`,
        ``,
        `💰 Tu balance actual: **${user.coins.toLocaleString()}** 💰`,
        `💳 Tu balance después: **${(user.coins - amount).toLocaleString()}** 💰`,
      ].join('\n'),
      fields: [
        { name: '👤 Destinatario', value: `<@${target.id}>`,               inline: true },
        { name: '💸 Monto',        value: `${amount.toLocaleString()} 💰`,  inline: true },
      ],
      footer: { text: '⏱️ Tienes 30 segundos para confirmar' },
      timestamp: new Date().toISOString()
    }],
    components: [confirmRow]
  });

  const sendCollector = confirmMsg.createMessageComponentCollector({ time: 30000 });

  sendCollector.on('collect', async interaction => {
    if (interaction.user.id !== userId)
      return interaction.reply({ content: '❌ Esta transferencia no es tuya.', ephemeral: true });

    if (interaction.customId === `send_cancel_${userId}`) {
      sendCollector.stop();
      return interaction.update({
        embeds: [{
          color: 0x555555,
          title: '❌ Transferencia cancelada',
          description: 'No se enviaron monedas.'
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
            title: '❌ Saldo insuficiente',
            description: 'Ya no tienes suficientes monedas para esta transferencia.'
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
            name: `✅ Transferencia completada · ${message.author.username}`,
            icon_url: message.author.displayAvatarURL({ dynamic: true })
          },
          description: [
            `Enviaste **${amount.toLocaleString()} 💰** a <@${target.id}> con éxito.`,
            ``,
            `💳 Tu nuevo balance: **${user.coins.toLocaleString()}** 💰`,
          ].join('\n'),
          fields: [
            { name: '👤 Destinatario',   value: `<@${target.id}>`,               inline: true },
            { name: '💸 Enviado',        value: `${amount.toLocaleString()} 💰`,  inline: true },
            { name: '💰 Balance actual', value: `${user.coins.toLocaleString()} 💰`, inline: true },
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
          title: '⏱️ Transferencia expirada',
          description: 'No confirmaste a tiempo. No se enviaron monedas.'
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
if (cmd === '!cd') {
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
            ? `Usa \`!daily\` para registrar tu asistencia diaria\n🔥 Racha actual: **${user.daily?.streak || 0}** días`
            : `Vuelve en **${dailyHH}h ${dailyMM}m ${dailySS}s**\n🔥 Racha: **${user.daily?.streak || 0}** días`,
          inline: false
        },
        {
          name: `🎁 Claim — ${claimStr}`,
          value: claimReady
            ? `Usa \`!claim\` para recoger **${claimReward} 💰**`
            : `Próxima recompensa: **${claimReward} 💰** · Vuelve en **${claimHH}h ${claimMM}m ${claimSS}s**`,
          inline: false
        },
        {
          name: `🤝 Friendly — ${friendlyStr}`,
          value: friendlyReady
            ? `Usa \`!friendly @rival\` · Victoria: **+100 💰**`
            : `Vuelve en **${friendlyMM}m ${friendlySS}s**`,
          inline: false
        },
        {
          name: `⚔️ Arena — ${arenaStr}`,
          value: arenaReady
            ? `Usa \`!arena\` · Victoria: **+400 💰** · ELO en juego`
            : `Vuelve en **${arenaMM}m ${arenaSS}s**`,
          inline: false
        },
       {
  name: `⚽ Penalty — ${penaltyStr}`,
  value: penaltyReady
    ? `Usa \`!penalty <cantidad>\` · Gana el **doble**`
    : `Vuelve en **${penaltyMM}m ${penaltySS}s**`,
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
  if (cmd === '!quests' || cmd === '!misiones') {
    const quests = getOrCreateUserQuests(userId);
    const today  = getTodayKey();
 
    // Subcomando: !quests reclamar <1|2|3>
    if (args[1] === 'reclamar') {
      const idx = parseInt(args[2]) - 1;
      if (isNaN(idx) || idx < 0 || idx > 2)
        return message.reply('❌ Uso: `!quests reclamar <1|2|3>`');
      const q = quests[idx];
      if (!q.completed) return message.reply(`❌ La misión **"${q.desc}"** aún no está completa. Progreso: **${q.progress}/${q.target}**`);
      if (q.claimed)    return message.reply(`❌ La misión **"${q.desc}"** ya fue reclamada hoy.`);
      q.claimed = true; saveQuests();
      user.coins += q.reward.coins || 0; saveData();
      return message.reply({
        embeds: [{
          color: 0x00C851,
          title: `✅ Misión reclamada — ${DIFF_EMOJI[q.difficulty]} ${DIFF_LABEL[q.difficulty]}`,
          description: `**${q.desc}**\n\n💰 Recibiste **+${(q.reward.coins||0).toLocaleString()} 💰**\n💼 Balance: **${user.coins.toLocaleString()} 💰**`,
          footer: { text: 'Las misiones se renuevan cada día a medianoche' },
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
      const status = q.claimed ? '✅ Reclamada'
        : q.completed ? `🎁 **¡Lista!** — \`!quests reclamar ${i+1}\``
        : '⏳ En progreso';
      return {
        name: `${DIFF_EMOJI[q.difficulty]} Misión ${i+1} — ${DIFF_LABEL[q.difficulty]}`,
        value: [`📋 **${q.desc}**`, prog, `💰 **${(q.reward.coins||0).toLocaleString()} 💰**`, status].join('\n'),
        inline: false
      };
    });
 
    const btnRow = new ActionRowBuilder().addComponents(
      quests.map((q, i) =>
        new ButtonBuilder()
          .setCustomId(`qclaim_${userId}_${i}`)
          .setLabel(`${DIFF_EMOJI[q.difficulty]} Reclamar ${i+1}`)
          .setStyle(q.claimed ? ButtonStyle.Secondary : q.completed ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setDisabled(q.claimed || !q.completed)
      )
    );
 
    const qMsg = await message.reply({
      embeds: [{
        color: 0x5865F2,
        author: { name: `🎯 Misiones del día · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
        title: `📅 ${today}`,
        description: allClaimed
          ? `✨ **¡Completaste todas las misiones de hoy!** (+${earned.toLocaleString()} 💰)\nVuelve mañana para nuevas misiones.`
          : `Completa las 3 misiones para ganar hasta **${totalReward.toLocaleString()} 💰**\n💰 Ganado hoy: **${earned.toLocaleString()} / ${totalReward.toLocaleString()} 💰**`,
        fields,
        footer: { text: '!quests reclamar <1|2|3> · Misiones nuevas cada día' },
        timestamp: new Date().toISOString()
      }],
      components: [btnRow]
    });
 
    const qCol = qMsg.createMessageComponentCollector({ time: 60000 });
    qCol.on('collect', async interaction => {
      if (interaction.user.id !== userId)
        return interaction.reply({ content: '❌ Estas misiones no son tuyas.', ephemeral: true });
      const qIdx = parseInt(interaction.customId.replace(`qclaim_${userId}_`, ''));
      const q = quests[qIdx];
      if (!q || !q.completed || q.claimed)
        return interaction.reply({ content: '❌ No puedes reclamar esta misión ahora.', ephemeral: true });
      q.claimed = true; saveQuests();
      const coins = q.reward.coins || 0;
      user.coins += coins; saveData();
      const newEarned = quests.filter(qq => qq.claimed).reduce((s,qq) => s+(qq.reward.coins||0), 0);
      const newAllCl  = quests.every(qq => qq.claimed);
      const newBtnRow = new ActionRowBuilder().addComponents(
        quests.map((qq, i) =>
          new ButtonBuilder()
            .setCustomId(`qclaim_${userId}_${i}`)
            .setLabel(`${DIFF_EMOJI[qq.difficulty]} Reclamar ${i+1}`)
            .setStyle(qq.claimed ? ButtonStyle.Secondary : qq.completed ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(qq.claimed || !qq.completed)
        )
      );
      const newFields = quests.map((qq, i) => {
        const bar = Math.round((qq.progress / qq.target) * 10);
        const prog = `\`${'█'.repeat(bar)}${'░'.repeat(10-bar)}\` **${qq.progress}/${qq.target}**`;
        const status = qq.claimed ? '✅ Reclamada'
          : qq.completed ? `🎁 **¡Lista!** — \`!quests reclamar ${i+1}\``
          : '⏳ En progreso';
        return { name: `${DIFF_EMOJI[qq.difficulty]} Misión ${i+1} — ${DIFF_LABEL[qq.difficulty]}`,
          value: [`📋 **${qq.desc}**`, prog, `💰 **${(qq.reward.coins||0).toLocaleString()} 💰**`, status].join('\n'), inline: false };
      });
      await interaction.update({
        embeds: [{
          color: 0x5865F2,
          author: { name: `🎯 Misiones del día · ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `📅 ${today}`,
          description: newAllCl
            ? `✨ **¡Completaste todas las misiones!** (+${newEarned.toLocaleString()} 💰 total)\nVuelve mañana para nuevas misiones.`
            : `💰 Ganado hoy: **${newEarned.toLocaleString()} / ${totalReward.toLocaleString()} 💰**`,
          fields: newFields,
          footer: { text: `Reclamaste: ${q.desc} · +${coins.toLocaleString()} 💰` },
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
  if (cmd === '!torneo') {
    const sub = (args[1] || '').toLowerCase();
 
    // ── !torneo crear <nombre> <entrada> <maxJugadores> ──
    if (sub === 'crear') {
      if (!isAdmin(userId))
        return message.reply('❌ Solo los admins pueden crear torneos.\nPídele a un admin que use `!torneo crear <nombre> <entrada> <maxJugadores>`.');
      const maxPlayers = parseInt(args[args.length - 1]);
      const entryFee   = parseInt(args[args.length - 2]);
      const name       = args.slice(2, -2).join(' ').trim() || 'Torneo FIFA';
      if (isNaN(maxPlayers) || maxPlayers < 4 || maxPlayers > 32)
        return message.reply('❌ Uso: `!torneo crear <nombre> <entrada> <maxJugadores>`\nEj: `!torneo crear Copa Semanal 1000 8` (entre 4 y 32 jugadores)');
      if (isNaN(entryFee) || entryFee < 0)
        return message.reply('❌ La entrada debe ser 0 o más.');
 
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
        new ButtonBuilder().setCustomId(`tj_${tId}`).setLabel('✅ Inscribirme').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ts_${tId}`).setLabel('🚀 Iniciar torneo').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`tc_${tId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)
      );
 
      function buildTEmbed(t) {
        const estPrize = getTournamentPrizes(t.entryFee * t.maxPlayers);
        const pList = t.participants.map((p,i) => `${i+1}. @${p.username}`).join('\n') || '_Nadie aún_';
        return {
          color: 0xFFD700,
          author: { name: `🏆 Torneo creado por ${message.author.username}`, icon_url: message.author.displayAvatarURL({ dynamic: true }) },
          title: `🏆 ${t.name}`,
          description: [
            `¡Inscríbete con **✅ Inscribirme**!`,
            ``,
            `📋 **Formato:** Eliminación directa`,
            `💸 **Entrada:** ${t.entryFee.toLocaleString()} 💰`,
            `🏆 **Premio máximo:** ${(t.entryFee * t.maxPlayers).toLocaleString()} 💰`,
            ``,
            `🥇 Campeón: **${estPrize.champion.toLocaleString()} 💰**`,
            `🥈 Finalista: **${estPrize.runnerUp.toLocaleString()} 💰**`,
            `🥉 Semifinalistas: **${estPrize.semifinal.toLocaleString()} 💰**`,
          ].join('\n'),
          fields: [
            { name: `👥 Inscritos (${t.participants.length}/${t.maxPlayers})`, value: pList, inline: false },
          ],
          footer: { text: `ID: ${tId}  ·  Necesitas equipo de 4 para participar` },
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
          return interaction.reply({ content: '❌ Este torneo ya no está disponible.', ephemeral: true });
 
        if (interaction.customId === `tc_${tId}`) {
          if (interaction.user.id !== t.creatorId && !isAdmin(interaction.user.id))
            return interaction.reply({ content: '❌ Solo el creador puede cancelar.', ephemeral: true });
          for (const p of t.participants)
            if (data[p.id]) data[p.id].coins = (data[p.id].coins||0) + t.entryFee;
          delete tournaments[tId];
          saveTournaments(); saveData(); tCol.stop();
          return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Torneo cancelado', description: 'Las monedas de inscripción fueron devueltas.' }], components: [] });
        }
 
        if (interaction.customId === `tj_${tId}`) {
          const jId = interaction.user.id;
          if (t.participants.find(p => p.id === jId))
            return interaction.reply({ content: '❌ Ya estás inscrito.', ephemeral: true });
          if (t.participants.length >= t.maxPlayers)
            return interaction.reply({ content: '❌ El torneo está lleno.', ephemeral: true });
          if (!data[jId] || (data[jId].team||[]).length < 4)
            return interaction.reply({ content: '❌ Necesitas **4 jugadores en tu equipo** (`!team`).', ephemeral: true });
          if (t.entryFee > 0) {
            if ((data[jId]?.coins||0) < t.entryFee)
              return interaction.reply({ content: `❌ Necesitas **${t.entryFee.toLocaleString()} 💰**. Tienes **${(data[jId]?.coins||0).toLocaleString()} 💰**.`, ephemeral: true });
            data[jId].coins -= t.entryFee;
          }
          t.participants.push({ id: jId, username: interaction.user.username });
          t.prizePool = t.entryFee * t.participants.length;
          saveTournaments(); saveData();
          if (t.participants.length >= t.maxPlayers) {
            await interaction.update({ embeds: [buildTEmbed(t)], components: [tRow] });
            await interaction.followUp({ content: `🏆 **¡${t.name} está lleno! Iniciando torneo automáticamente...** ` });
            return startTournament(tId, null, tMsg, tCol);
          }
          return interaction.update({ embeds: [buildTEmbed(t)], components: [tRow] });
        }
 
        if (interaction.customId === `ts_${tId}`) {
          if (!isAdmin(interaction.user.id) && interaction.user.id !== t.creatorId)
            return interaction.reply({ content: '❌ Solo el creador puede iniciar.', ephemeral: true });
          if (t.participants.length < 2)
            return interaction.reply({ content: '❌ Necesitas al menos **2 jugadores** inscritos.', ephemeral: true });
          return startTournament(tId, interaction, tMsg, tCol);
        }
      });
      tCol.on('end', () => tMsg.edit({ components: [] }).catch(() => {}));
      return;
    }
 
    // ── !torneo listar ──
    if (sub === 'listar' || sub === 'lista') {
      const list = Object.values(tournaments).filter(t => t.status !== 'finished');
      if (!list.length)
        return message.reply({ embeds: [{ color: 0x2b2d31, title: '🏆 Sin torneos activos', description: 'No hay torneos en este momento.\n\nUsa `!torneo crear <nombre> <entrada> <jugadores>` para crear uno (admins).' }] });
      return message.reply({
        embeds: [{
          color: 0xFFD700,
          title: '🏆 Torneos activos',
          description: list.map(t =>
            `**${t.name}** \`${t.id}\`\n${getTournamentStatus(t)} · ${t.participants.length}/${t.maxPlayers} jugadores · Premio: ${t.prizePool.toLocaleString()} 💰`
          ).join('\n\n'),
          footer: { text: '!torneo jugar <id> · !torneo bracket <id>' },
          timestamp: new Date().toISOString()
        }]
      });
    }


// ── !torneo iniciar <id> ──
    if (sub === 'iniciar') {
      const tId = args[2];
      if (!tId) return message.reply('❌ Uso: `!torneo iniciar <id>`\nEj: `!torneo iniciar T1ABC123`');

      const t = tournaments[tId];
      if (!t) return message.reply('❌ Torneo no encontrado. Usa `!torneo listar` para ver los IDs.');
      if (t.status !== 'waiting') {
        if (t.status === 'active')   return message.reply('❌ El torneo ya está en curso.');
        if (t.status === 'finished') return message.reply('❌ El torneo ya terminó.');
        return message.reply('❌ El torneo no puede iniciarse en su estado actual.');
      }
      if (!isAdmin(userId) && userId !== t.creatorId)
        return message.reply('❌ Solo el creador del torneo o un admin puede iniciarlo.');
      if (t.participants.length < 2)
        return message.reply('❌ Necesitas al menos **2 jugadores inscritos** para iniciar el torneo.');

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
        if (m.winner) return `~~**Partido ${i+1}:** ${p1} vs ${p2}~~ (BYE)`;
        return `**Partido ${i+1}:** ${p1}  vs  ${p2}`;
      }).join('\n');

      const mentions = t.participants.map(p => `<@${p.id}>`).join(' ');

      return message.reply({
        content: mentions,
        embeds: [{
          color: 0x00C851,
          title: `🏆 ¡${t.name} ha comenzado!`,
          description: [
            `**${t.participants.length} jugadores** luchando por **${t.prizes.champion.toLocaleString()} 💰**!`,
            '',
            `**📋 Ronda 1:**`,
            matchupLines,
            '',
            `⚔️ Usa \`!torneo jugar ${tId}\` para jugar tu partido.`,
            `📊 Usa \`!torneo bracket ${tId}\` para ver el bracket.`,
          ].join('\n'),
          fields: [
            { name: '🥇 Campeón',        value: `${t.prizes.champion.toLocaleString()} 💰`,  inline: true },
            { name: '🥈 Finalista',      value: `${t.prizes.runnerUp.toLocaleString()} 💰`,  inline: true },
            { name: '🥉 Semifinalistas', value: `${t.prizes.semifinal.toLocaleString()} 💰`, inline: true },
          ],
          image: bracketCanvas ? { url: 'attachment://bracket.png' } : undefined,
          footer: { text: `ID del torneo: ${tId}  ·  Participantes: ${t.participants.length}` },
          timestamp: new Date().toISOString()
        }],
        files
      });
    }


// ── !torneo admin <id> ──
    if (sub === 'admin') {
      const tId = args[2];
      if (!tId) return message.reply('❌ Uso: `!torneo admin <id>`');

      const t = tournaments[tId];
      if (!t) return message.reply('❌ Torneo no encontrado. Usa `!torneo listar` para ver los IDs.');
      if (!isAdmin(userId) && userId !== t.creatorId)
        return message.reply('❌ Solo el creador del torneo o un admin puede administrar partidos.');
      if (t.status !== 'active')
        return message.reply('❌ El torneo debe estar en curso. Usa `!torneo iniciar <id>` si aún no empezó.');

      const curRound = t.rounds[t.currentRound];
      const pendingMatches = curRound.filter(m => m.winner === null && m.p1 && m.p2);

      if (pendingMatches.length === 0) {
        return message.reply('✅ No hay partidos pendientes en esta ronda. Todos ya tienen resultado.');
      }

      // Construir selector de partido
      function buildMatchSelectEmbed() {
        const lines = curRound.map((m, i) => {
          const p1 = m.p1 ? `@${m.p1.username}` : 'BYE';
          const p2 = m.p2 ? `@${m.p2.username}` : 'BYE';
          if (m.winner) {
            const winner = t.participants.find(p => p.id === m.winner);
            return `~~Partido ${i+1}: ${p1} vs ${p2}~~ ✅ Ganó **@${winner?.username || '?'}** ${m.score ? `(${m.score})` : ''}`;
          }
          if (!m.p1 || !m.p2) return `Partido ${i+1}: BYE automático`;
          return `**Partido ${i+1}:** ${p1} vs ${p2} ⏳ Pendiente`;
        }).join('\n');

        return {
          color: 0xFF6B00,
          title: `⚙️ Admin Torneo — ${t.name}`,
          description: [
            `**Ronda ${t.currentRound + 1} / ${t.rounds.length}**`,
            '',
            lines,
            '',
            '**Selecciona el partido que quieres resolver:**',
          ].join('\n'),
          footer: { text: `ID: ${tId}  ·  Solo puedes editar partidos pendientes` },
          timestamp: new Date().toISOString()
        };
      }

      // Botones de partidos pendientes (máx 5 por fila)
      function buildMatchSelectRow() {
        const btns = pendingMatches.map((m) => {
          const idx = curRound.indexOf(m);
          const p1 = m.p1?.username || 'BYE';
          const p2 = m.p2?.username || 'BYE';
          return new ButtonBuilder()
            .setCustomId(`tadmin_match_${tId}_${idx}_${userId}`)
            .setLabel(`Partido ${idx+1}: ${p1} vs ${p2}`)
            .setStyle(ButtonStyle.Primary);
        });

        const rows = [];
        for (let i = 0; i < btns.length; i += 4) {
          rows.push(new ActionRowBuilder().addComponents(btns.slice(i, i + 4)));
        }
        rows.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`tadmin_cancel_${userId}`)
            .setLabel('❌ Cancelar')
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
          return interaction.reply({ content: '❌ Este panel no es tuyo.', ephemeral: true });

        // Cancelar
        if (interaction.customId === `tadmin_cancel_${userId}`) {
          adminCol.stop();
          return interaction.update({
            embeds: [{ color: 0x555555, title: '❌ Administración cancelada' }],
            components: []
          });
        }

        // Seleccionó un partido
        if (interaction.customId.startsWith(`tadmin_match_${tId}_`)) {
          const parts = interaction.customId.replace(`tadmin_match_${tId}_`, '').replace(`_${userId}`, '').split('_');
          const matchIdx = parseInt(parts[0]);
          const match = curRound[matchIdx];

          if (!match || match.winner !== null)
            return interaction.reply({ content: '❌ Ese partido ya tiene resultado.', ephemeral: true });

          const p1 = match.p1;
          const p2 = match.p2;

          // Mostrar selector de ganador
          const winnerRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`tadmin_win_${tId}_${matchIdx}_${p1.id}_${userId}`)
              .setLabel(`🏆 Gana @${p1.username}`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`tadmin_win_${tId}_${matchIdx}_${p2.id}_${userId}`)
              .setLabel(`🏆 Gana @${p2.username}`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`tadmin_back_${userId}`)
              .setLabel('⬅️ Volver')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`tadmin_cancel_${userId}`)
              .setLabel('❌ Cancelar')
              .setStyle(ButtonStyle.Danger)
          );

          // Selector de score
          const p1Elo = data[p1.id]?.elo || 1000;
          const p2Elo = data[p2.id]?.elo || 1000;
          const t1 = getEloTier(p1Elo);
          const t2 = getEloTier(p2Elo);

          return interaction.update({
            embeds: [{
              color: 0xFF6B00,
              title: `⚙️ Partido ${matchIdx + 1} — Elige el ganador`,
              description: [
                `**@${p1.username}** ${t1.emoji} ${p1Elo} ELO`,
                `vs`,
                `**@${p2.username}** ${t2.emoji} ${p2Elo} ELO`,
                '',
                '¿Quién avanza a la siguiente ronda?',
              ].join('\n'),
              footer: { text: 'El resultado se registrará inmediatamente' }
            }],
            components: [winnerRow]
          });
        }

        // Volver al selector de partidos
        if (interaction.customId === `tadmin_back_${userId}`) {
          const stillPending = curRound.filter(m => m.winner === null && m.p1 && m.p2);
          if (stillPending.length === 0) {
            adminCol.stop();
            return interaction.update({
              embeds: [{ color: 0x00C851, title: '✅ Ronda completada', description: 'Todos los partidos de esta ronda tienen resultado.' }],
              components: []
            });
          }
          return interaction.update({
            embeds: [buildMatchSelectEmbed()],
            components: buildMatchSelectRow()
          });
        }

        // Asignar ganador
        if (interaction.customId.startsWith(`tadmin_win_${tId}_`)) {
          const raw = interaction.customId
            .replace(`tadmin_win_${tId}_`, '')
            .replace(`_${userId}`, '');
          const rawParts  = raw.split('_');
          const matchIdx2 = parseInt(rawParts[0]);
          const winnerId  = rawParts[1];
          const match2    = curRound[matchIdx2];

          if (!match2 || match2.winner !== null)
            return interaction.reply({ content: '❌ Ese partido ya tiene resultado.', ephemeral: true });

          const winnerParticipant = t.participants.find(p => p.id === winnerId);
          if (!winnerParticipant)
            return interaction.reply({ content: '❌ Jugador no encontrado en el torneo.', ephemeral: true });

          const loserParticipant = match2.p1?.id === winnerId ? match2.p2 : match2.p1;

          // Registrar resultado
          match2.winner = winnerId;
          match2.score  = 'ADM'; // marcado como resultado administrativo

          // Historial
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

          // Premios si terminó
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

          // Generar bracket actualizado
          const bracketCanvas = await drawBracketCanvas(t).catch(() => null);
          const bFiles = bracketCanvas ? [{ attachment: bracketCanvas.toBuffer(), name: 'bracket.png' }] : [];

          adminCol.stop();

          const stillPending2 = t.status === 'active'
            ? t.rounds[t.currentRound]?.filter(m => m.winner === null && m.p1 && m.p2).length || 0
            : 0;

          const finishedDesc = t.status === 'finished'
            ? `\n\n🏆 **¡El torneo terminó! Campeón: <@${t.champion}>** (+${t.prizes.champion.toLocaleString()} 💰)`
            : `\n\n⏳ Partidos pendientes en esta ronda: **${stillPending2}**\nUsa \`!torneo admin ${tId}\` para continuar.`;

          return interaction.update({
            embeds: [{
              color: 0x00C851,
              title: `✅ Resultado registrado`,
              description: [
                `**@${winnerParticipant.username}** avanza a la siguiente ronda.`,
                loserParticipant ? `**@${loserParticipant.username}** queda eliminado.` : '',
                `📝 Registrado como resultado administrativo (ADM).`,
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

// ── !torneo forzar <id> ──
    if (sub === 'forzar') {
      const tId = args[2];
      if (!isAdmin(userId)) return message.reply('❌ Solo admins.');
      const t = tournaments[tId];
      if (!t) return message.reply('❌ Torneo no encontrado.');
      if (t.status !== 'active') return message.reply('❌ El torneo no está activo.');

      const curRound = t.rounds[t.currentRound];
      
      // Verificar cuántos faltan
      const pending = curRound.filter(m => m.winner === null && m.p1 && m.p2);
      if (pending.length > 0) {
        const lines = pending.map((m, i) => 
          `⏳ **Partido pendiente:** @${m.p1.username} vs @${m.p2.username}`
        ).join('\n');
        return message.reply({
          embeds: [{
            color: 0xFF6600,
            title: '⚠️ Hay partidos sin resultado',
            description: `Aún faltan **${pending.length}** partido(s) por jugarse:\n\n${lines}\n\n¿Quieres forzar de todas formas? Usa \`!torneo admin ${tId}\` para asignar resultados primero.`,
          }]
        });
      }

      // Forzar avance manual
      const r = t.currentRound;
      const cur = t.rounds[r];

      // Marcar BYEs automáticos
      for (const m of cur) {
        if (m.winner === null) {
          if (!m.p1 && m.p2)  m.winner = m.p2.id;
          if (!m.p2 && m.p1)  m.winner = m.p1.id;
        }
      }

      // Propagar ganadores a la siguiente ronda manualmente
      if (r + 1 < t.rounds.length) {
        const next = t.rounds[r + 1];
        cur.forEach((m, i) => {
          const w = t.participants.find(p => p.id === m.winner) || null;
          if (i % 2 === 0) next[Math.floor(i/2)].p1 = w;
          else             next[Math.floor(i/2)].p2 = w;
        });
        t.currentRound = r + 1;
        // Resolver BYEs en la nueva ronda
        advanceBracket(t);
      } else {
        // Era la final
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
        if (m.winner) return `~~**Partido ${i+1}:** ${p1} vs ${p2}~~ ✅`;
        return `**Partido ${i+1}:** ${p1}  vs  ${p2}`;
      }).join('\n') : '—';

      return message.reply({
        embeds: [{
          color: t.status === 'finished' ? 0xFFD700 : 0x00C851,
          title: t.status === 'finished' 
            ? `🏆 ¡Torneo finalizado! Campeón: <@${t.champion}>`
            : `✅ Ronda avanzada — Ahora en Ronda ${t.currentRound + 1}`,
          description: t.status === 'finished'
            ? `<@${t.champion}> gana **${t.prizes.champion.toLocaleString()} 💰**!`
            : `**Partidos de esta ronda:**\n${matchupLines}\n\nUsa \`!torneo admin ${tId}\` para asignar resultados o \`!torneo jugar ${tId}\` para jugar.`,
          image: bracketCanvas ? { url: 'attachment://bracket.png' } : undefined,
          footer: { text: `ID: ${tId}` },
          timestamp: new Date().toISOString()
        }],
        files: bFiles
      });
    }
 
    // ── !torneo bracket <id> ──
    if (sub === 'bracket') {
      const tId2 = args[2];
      const t2 = tournaments[tId2];
      if (!t2) return message.reply('❌ Torneo no encontrado. Usa `!torneo listar` para ver los IDs.');
      if (t2.status === 'waiting') return message.reply('❌ El torneo aún no ha comenzado.');
      const canvas = await drawBracketCanvas(t2).catch(() => null);
      if (!canvas) return message.reply('❌ Error generando el bracket.');
      return message.reply({
        embeds: [{
          color: 0xFFD700,
          title: `🏆 Bracket — ${t2.name}`,
          description: `Ronda actual: **${Math.min(t2.currentRound+1, t2.rounds.length)} / ${t2.rounds.length}** · ${getTournamentStatus(t2)}`,
          image: { url: 'attachment://bracket.png' },
          footer: { text: `ID: ${tId2}  ·  !torneo jugar ${tId2} para jugar tu partido` },
          timestamp: new Date().toISOString()
        }],
        files: [{ attachment: canvas.toBuffer(), name: 'bracket.png' }]
      });
    }
 
    // ── !torneo jugar <id> ──
    if (sub === 'jugar') {
      const tId3 = args[2];
      const t3 = tournaments[tId3];
      if (!t3) return message.reply('❌ Torneo no encontrado.');
      if (t3.status !== 'active') return message.reply('❌ El torneo no está en curso.');
      const curMatches = t3.rounds[t3.currentRound];
      const myMatch = curMatches?.find(m => (m.p1?.id === userId || m.p2?.id === userId) && m.winner === null);
      if (!myMatch) return message.reply('❌ No tienes un partido pendiente en esta ronda, o ya fue jugado.\n💡 Usa `!torneo bracket ' + tId3 + '` para ver el estado.');
 
      const iAmP1 = myMatch.p1?.id === userId;
      const opp   = iAmP1 ? myMatch.p2 : myMatch.p1;
 
      if (!opp) {
        myMatch.winner = userId; myMatch.score = 'BYE';
        advanceBracket(t3); saveTournaments();
        const bCanvas = await drawBracketCanvas(t3).catch(() => null);
        const bFiles = bCanvas ? [{ attachment: bCanvas.toBuffer(), name: 'bracket.png' }] : [];
        return message.reply({
          embeds: [{ color: 0x00C851, title: '✅ BYE — Avanzas automáticamente', description: `¡Avanzas a la siguiente ronda del torneo **${t3.name}**!`, image: bCanvas ? { url: 'attachment://bracket.png' } : undefined }],
          files: bFiles
        });
      }
 
      if (!data[opp.id] || (data[opp.id].team||[]).length < 4)
        return message.reply(`❌ Tu rival **@${opp.username}** no tiene equipo completo (necesita `+"`!team`"+ ` con 4 jugadores).`);
      if ((user.team||[]).length < 4)
        return message.reply('❌ Necesitas **4 jugadores en tu equipo** para jugar.');
 
      const playRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tp_${tId3}_${userId}`).setLabel(`⚔️ Jugar vs @${opp.username}`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`tpc_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)
      );
 
      const pMsg = await message.reply({
        embeds: [{
          color: 0xFF6B00,
          title: `⚔️ Partido de torneo — ${t3.name}`,
          description: [
            `🏠 **${user.teamName || message.author.username + "'s FC"}** (tú)`,
            `vs`,
            `✈️ **${data[opp.id]?.teamName || opp.username + "'s FC"}** (@${opp.username})`,
            ``,
            `🎯 Ronda: **${t3.currentRound + 1} / ${t3.rounds.length}**`,
            `🏆 Premio campeón: **${t3.prizes.champion.toLocaleString()} 💰**`,
            ``,
            `⚠️ **El perdedor queda eliminado.**`,
          ].join('\n'),
          footer: { text: '30 segundos para confirmar' },
          timestamp: new Date().toISOString()
        }],
        components: [playRow]
      });
 
      const pCol = pMsg.createMessageComponentCollector({ time: 30000 });
      pCol.on('collect', async interaction => {
        if (interaction.user.id !== userId)
          return interaction.reply({ content: '❌ Este partido no es tuyo.', ephemeral: true });
        pCol.stop();
        if (interaction.customId === `tpc_${userId}`)
          return interaction.update({ embeds: [{ color: 0x555555, title: '❌ Partido cancelado' }], components: [] });
 
        await interaction.update({ embeds: [{ color: 0xFF6B00, title: '⚔️ Partido en curso...', description: '⏳ Simulando...' }], components: [] });
 
        // ── Motor de partido ──
        const SLOT_P = ['GK','DM','AM','ST'], PEN = 8;
        const RB = { Comun:0.00, Raro:0.05, Epico:0.10, Legendario:0.18, WorldCup:0.48, Icon:0.56 };
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
 
        // Historial
        if (!data[userId].matchHistory)  data[userId].matchHistory  = [];
        if (!data[opp.id].matchHistory)  data[opp.id].matchHistory  = [];
        data[userId].matchHistory.unshift({ type:'torneo', date:Date.now(), oppId:opp.id, oppName:opp.username, myGoals:myG, oppGoals:oppG, result:iWon?'win':'loss', reward:0 });
        data[opp.id].matchHistory.unshift({ type:'torneo', date:Date.now(), oppId:userId,  oppName:message.author.username, myGoals:oppG, oppGoals:myG, result:iWon?'loss':'win', reward:0 });
 
        advanceBracket(t3);
 
        // Premios si terminó
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
            embeds: [{ color:0xFFD700, title:`🏆 ¡CAMPEÓN DE "${t3.name}"!`,
              description:`<@${t3.champion}> es el **CAMPEÓN** y gana **${t3.prizes.champion.toLocaleString()} 💰**! 🎉`,
              timestamp: new Date().toISOString() }]
          }).catch(()=>{});
        }
        saveTournaments(); saveData();
 
        const bCanvas2 = await drawBracketCanvas(t3).catch(() => null);
        const bFiles2 = bCanvas2 ? [{ attachment: bCanvas2.toBuffer(), name:'bracket.png' }] : [];
        await pMsg.edit({
          embeds: [{
            color: iWon ? 0x00C851 : 0xFF4444,
            title: iWon ? `🏆 ¡VICTORIA! ${score}` : `💀 Eliminado — ${score}`,
            description: [
              `**${user.teamName||message.author.username+"'s FC"}** ${myG} - ${oppG} **${data[opp.id]?.teamName||opp.username+"'s FC"}**`,
              iWon ? `\n✅ ¡Avanzas a la siguiente ronda!` : `\n💔 Fuiste eliminado del torneo.`,
              t3.status==='finished' ? `\n🏆 **¡${t3.champion===userId?'¡ERES EL CAMPEÓN! 🎉':'El torneo terminó'}**` : ''
            ].join('\n'),
            image: bCanvas2 ? { url:'attachment://bracket.png' } : undefined,
            footer: { text:`!torneo bracket ${tId3} para ver el bracket` },
            timestamp: new Date().toISOString()
          }],
          files: bFiles2, components: []
        }).catch(()=>{});
      });
      pCol.on('end', (_, reason) => { if (reason==='time') pMsg.edit({ components:[] }).catch(()=>{}); });
      return;
    }
 
    // ── Ayuda ──
    return message.reply({
      embeds: [{
        color: 0xFFD700,
        title: '🏆 Torneos — Ayuda',
        fields: [
          { name: '`!torneo crear <nombre> <entrada> <maxJugadores>`', value: 'Crear torneo (solo admins)\nEj: `!torneo crear Copa Semanal 1000 8`', inline: false },
          { name: '`!torneo listar`',          value: 'Ver torneos activos',                    inline: false },
          { name: '`!torneo bracket <id>`',    value: 'Ver el bracket visual',                  inline: false },
          { name: '`!torneo jugar <id>`',      value: 'Jugar tu partido pendiente',             inline: false },
{ name: '`!torneo forzar <id>`', value: 'Fuerza el avance a la siguiente ronda si todos los partidos ya tienen resultado (solo admins)', inline: false },
{ name: '`!torneo admin <id>`', value: 'Administrar resultados manualmente — elige quién pasa (creador o admin)', inline: false },
{ name: '`!torneo iniciar <id>`', value: 'Iniciar un torneo manualmente (creador o admin)', inline: false },
        ],
        footer: { text: 'Los premios se reparten automáticamente · Necesitas equipo de 4 para participar' }
      }]
    });
  }


// ─────────────────────────────────────────
  // 👑 ADMIN
  // ─────────────────────────────────────────
  if (isAdmin(userId)) {

    if (cmd === '!giveme') {
      const amount = parseInt(args[1]);
      if (isNaN(amount)) return message.reply('❌ Pon una cantidad válida.');
      user.coins += amount; saveData();
      return message.reply(`✅ Te diste **${amount}** ${EMOJI_COIN}`);
    }

    if (cmd === '!give') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount)) return message.reply('❌ Uso: `!give @usuario cantidad`');
      if (!data[target.id]) data[target.id] = { coins: 0, players: [], team: [], packs: { silver: 0, bronze: 0, gold: 0, legend: 0 }, elo: 1000, daily: { lastClaim: 0, streak: 0 } };
      data[target.id].coins += amount; saveData();
      return message.reply(`✅ Le diste **${amount}** ${EMOJI_COIN} a **${target.username}**`);
    }

    if (cmd === '!givepack') {
      const target = message.mentions.users.first();
      const type   = (args[2] || '').toLowerCase();
      const amount = parseInt(args[3]) || 1;
      if (!target || !packs[type]) return message.reply('❌ Uso: `!givepack @usuario silver/bronze/gold/legend/worldcup/icon [cantidad]`');
      if (!data[target.id]) data[target.id] = { coins: 0, players: [], team: [], packs: { silver: 0, bronze: 0, gold: 0, legend: 0 }, elo: 1000, daily: { lastClaim: 0, streak: 0 } };
      if (!data[target.id].packs) data[target.id].packs = { silver: 0, bronze: 0, gold: 0, legend: 0 };
      data[target.id].packs[type] += amount; saveData();
      return message.reply(`✅ Le diste **${amount}** pack(s) **${packs[type].label}** a **${target.username}**`);
    }

    if (cmd === '!givecard') {
      const target   = message.mentions.users.first();
      const cardName = args.slice(2).join(' ').trim();
      if (!target || !cardName) return message.reply('❌ Uso: `!givecard @usuario NombreJugador`');
      const found = players.find(p => p.name.toLowerCase() === cardName.toLowerCase());
      if (!found) return message.reply(`❌ Jugador **${cardName}** no existe.`);
      if (!data[target.id]) data[target.id] = { coins: 1000, players: [], team: [], teamName: target.username + "'s FC", packs: { silver: 0, bronze: 0, gold: 0, legend: 0 }, elo: 1000, daily: { lastClaim: 0, streak: 0 } };
      if (!data[target.id].players) data[target.id].players = [];
      data[target.id].players.push({ ...found, stats: { ...found.stats } }); saveData();
      return message.reply(`✅ Le diste la carta **${found.name}** (${found.rarity} · ${found.rating} OVR · ${found.position}) a **${target.username}**`);
    }

    if (cmd === '!take') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount)) return message.reply('❌ Uso: `!take @usuario cantidad`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].coins = Math.max(0, (data[target.id].coins || 0) - amount); saveData();
      return message.reply(`✅ Le quitaste **${amount}** ${EMOJI_COIN} a **${target.username}** (saldo: **${data[target.id].coins}** ${EMOJI_COIN})`);
    }

    if (cmd === '!resetuser') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!resetuser @usuario`');
      data[target.id] = { coins: 1800, players: [], team: [], teamName: target.username + "'s FC", packs: { silver: 0, bronze: 0, gold: 0, legend: 0 }, elo: 1000, daily: { lastClaim: 0, streak: 0 } };
      saveData();
      return message.reply(`✅ Cuenta de **${target.username}** reseteada.`);
    }

    if (cmd === '!profile') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!profile @usuario`');
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

    if (cmd === '!setelo') {
      const target = message.mentions.users.first();
      const amount = parseInt(args[2]);
      if (!target || isNaN(amount)) return message.reply('❌ Uso: `!setelo @usuario cantidad`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].elo = amount; saveData();
      return message.reply(`✅ ELO de **${target.username}** establecido a **${amount}**`);
    }

    if (cmd === '!resetdaily') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!resetdaily @usuario`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].daily = { lastClaim: 0, streak: 0, claimedMilestones: [] }; saveData();
      return message.reply(`✅ Daily de **${target.username}** reseteado.`);
    }

    if (cmd === '!clearteam') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!clearteam @usuario`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].team = []; saveData();
      return message.reply(`✅ Equipo de **${target.username}** limpiado.`);
    }

    if (cmd === '!clearclub') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!clearclub @usuario`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      data[target.id].players = [];
      data[target.id].team    = []; saveData();
      return message.reply(`✅ Club y equipo de **${target.username}** limpiados completamente.`);
    }

    if (cmd === '!removelogo') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!removelogo @usuario`');
      if (!data[target.id]) return message.reply('❌ Ese usuario no tiene perfil.');
      if (!data[target.id].clubLogo) return message.reply(`❌ **${target.username}** no tiene logo.`);
      data[target.id].clubLogo = null; saveData();
      return message.reply(`✅ Logo de **${target.username}** eliminado.`);
    }

   

    // ─────────────────────────────────────────
    // 👑 ADMIN — VER CLUB DE USUARIO
    // ─────────────────────────────────────────
    if (cmd === '!adminclub') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!adminclub @usuario`');
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil.');

      const players_list = t.players || [];
      let page = 0;
      const totalPages = Math.max(1, Math.ceil(players_list.length / 8));
      const rarityEmoji = { "Legendario": "🟡", "Epico": "🟣", "Raro": "🔵", "Comun": "⚪" };
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
    if (cmd === '!adminteam') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!adminteam @usuario`');
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil.');

      const team        = t.team || [];
      const rarityEmoji = { "Legendario": "🟡", "Epico": "🟣", "Raro": "🔵", "Comun": "⚪" };
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
    if (cmd === '!adminremove') {
      const target     = message.mentions.users.first();
      const playerName = args.slice(2).join(' ').trim();
      if (!target || !playerName) return message.reply('❌ Uso: `!adminremove @usuario <nombre jugador>`');
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
    if (cmd === '!adminremoverarity') {
      const target        = message.mentions.users.first();
      const rarity        = args[2];
      const validRarities = ['Comun', 'Raro', 'Epico', 'Legendario'];
      if (!target || !rarity) return message.reply('❌ Uso: `!adminremoverarity @usuario <Comun/Raro/Epico/Legendario>`');
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
    // 👑 ADMIN — INFO COMPLETA DE USUARIO
    // ─────────────────────────────────────────
    if (cmd === '!admininfo') {
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!admininfo @usuario`');
      const t = data[target.id];
      if (!t) return message.reply('❌ Ese usuario no tiene perfil.');

      const players_list = t.players || [];
      const team         = t.team    || [];
      const tier         = getEloTier(t.elo || 1000);

      const MARKET_MULTIPLIER  = { "Legendario": 18, "Epico": 10, "Raro": 5, "Comun": 2.5 };
      const totalSellValue     = players_list.reduce((s, p) => s + (SELL_PRICES[p.rarity] || 90), 0);
      const totalMarketValue   = players_list.reduce((s, p) => s + Math.round(p.rating * p.rating * (MARKET_MULTIPLIER[p.rarity] || 2.5)), 0);

      const byRarity = { Legendario: 0, Epico: 0, Raro: 0, Comun: 0 };
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
            { name: '🃏 Por rareza',           value: `🟡${byRarity.Legendario} 🟣${byRarity.Epico} 🔵${byRarity.Raro} ⚪${byRarity.Comun}`, inline: true },
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
    if (cmd === '!info') {
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
    if (cmd === '!anuncio') {
      const texto = args.slice(1).join(' ');
      if (!texto) return message.reply('❌ Uso: `!anuncio <mensaje>`');
      return message.channel.send({ embeds: [{ color: 0xFF4500, title: '📢 ANUNCIO OFICIAL', description: texto, footer: { text: `Publicado por ${message.author.username}` }, timestamp: new Date().toISOString() }] });
    }

    // ─────────────────────────────────────────
    // 👑 ADMIN — GESTIÓN DE ADMINS
    // ─────────────────────────────────────────
    if (cmd === '!admins') {
      const lista = [...admins].map((id, i) => i === 0 ? `👑 <@${id}> (Super Admin)` : `🛡️ <@${id}>`).join('\n');
      return message.reply({ embeds: [{ color: 0xFFD700, title: '👑 Lista de Admins', description: lista || 'Sin admins.', footer: { text: `Total: ${admins.size} admin(s)` } }] });
    }

    if (cmd === '!addadmin') {
      if (userId !== superAdminId) return message.reply('❌ Solo el Super Admin puede agregar admins.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!addadmin @usuario`');
      if (admins.has(target.id)) return message.reply(`❌ **${target.username}** ya es admin.`);
      admins.add(target.id); saveAdmins();
      return message.reply(`✅ **${target.username}** ahora es admin. 🛡️`);
    }

    if (cmd === '!removeadmin') {
      if (userId !== superAdminId) return message.reply('❌ Solo el Super Admin puede quitar admins.');
      const target = message.mentions.users.first();
      if (!target) return message.reply('❌ Uso: `!removeadmin @usuario`');
      if (target.id === superAdminId) return message.reply('❌ No puedes quitarte a ti mismo como Super Admin.');
      if (!admins.has(target.id)) return message.reply(`❌ **${target.username}** no es admin.`);
      admins.delete(target.id); saveAdmins();
      return message.reply(`✅ **${target.username}** ya no es admin.`);
    }

    // ─────────────────────────────────────────
    // 👑 ADMIN — UPDATEPLAYERS
    // ─────────────────────────────────────────
    if (cmd === '!updateplayers') {
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
    if (cmd === '!adminhelp') {
      return message.reply({ embeds: [{ color: 0xFF6600, title: '👑 COMANDOS DE ADMIN', fields: [
        { name: '💰 Economía',            value: '`!giveme <n>` · `!give @u <n>` · `!take @u <n>`',                                                   inline: false },
        { name: '🃏 Cartas & Packs',      value: '`!givecard @u <jugador>` · `!givepack @u silver/bronze/gold/legend [n]`',                            inline: false },
        { name: '📊 Gestión de usuario',  value: '`!profile @u` · `!resetuser @u` · `!setelo @u <n>` · `!resetdaily @u`',                             inline: false },
        { name: '🔍 Inspección',          value: '`!adminclub @u` · `!adminteam @u` · `!admininfo @u`',                                                inline: false },
        { name: '🗑️ Quitar jugadores',   value: '`!adminremove @u <jugador>` · `!adminremoverarity @u <Comun/Raro/Epico/Legendario>`',                 inline: false },
        { name: '🧹 Limpieza',            value: '`!clearteam @u` · `!clearclub @u` · `!removelogo @u`',                                               inline: false },
        { name: '📈 Bot',                 value: '`!info` · `!updateplayers`',                                                                          inline: false },
        { name: '👑 Admins (SuperAdmin)', value: '`!addadmin @u` · `!removeadmin @u` · `!admins`',                                                     inline: false },
        { name: '📢 Misc',                value: '`!anuncio <mensaje>`',                                                                                inline: false },
      ], footer: { text: 'Cooldown desactivado para admins' } }] });
    }


// ─────────────────────────────────────────
// 👑 ADMIN — BAN / UNBAN
// ─────────────────────────────────────────
if (cmd === '!adminban') {
  const subCmd = (args[1] || '').toLowerCase();
  const target = message.mentions.users.first();

  // Listar baneados
  if (subCmd === 'list') {
    if (bannedUsers.size === 0) {
      return message.reply({ embeds: [{ color: 0x00C851, title: '✅ Sin usuarios baneados', description: 'No hay ningún usuario baneado actualmente.' }] });
    }
    const lista = [...bannedUsers].map((id, i) => `**${i + 1}.** <@${id}> (\`${id}\`)`).join('\n');
    return message.reply({ embeds: [{ color: 0xFF4444, title: `🔨 Usuarios baneados (${bannedUsers.size})`, description: lista, footer: { text: '!adminban unban @usuario para desbanear' } }] });
  }

  // Desbanear
  if (subCmd === 'unban') {
    if (!target) return message.reply('❌ Uso: `!adminban unban @usuario`');
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
          { name: '`!adminban @usuario [razón]`',  value: 'Banear un usuario del bot',       inline: false },
          { name: '`!adminban unban @usuario`',     value: 'Desbanear un usuario',            inline: false },
          { name: '`!adminban list`',               value: 'Ver todos los usuarios baneados', inline: false },
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
      footer: { text: '!adminban unban @usuario para desbanear  ·  !adminban list para ver todos' },
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
  "Comun": 0.00, "Raro": 0.05, "Epico": 0.10, "Legendario": 0.18, "WorldCup": 0.48, "Icon": 0.56,
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