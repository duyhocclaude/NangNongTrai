'use strict';
/* =========================================================
   NÀNG NÔNG TRẠI — game nông trại 2D (HTML5 Canvas)
   ========================================================= */

// Phiên bản hiển thị trong Menu — nhớ đổi cùng số ?v= trong index.html
const GAME_VERSION = '1.6.0';

// ---------- Hằng số thời gian ----------
const W = 1280, H = 720;
const DAY_START_HOUR = 7;           // 7h sáng
const DAY_MIN = 11 * 60;            // làm việc 7h -> 18h = 660 phút game
const REAL_SEC_PER_DAY = 600;       // 10 phút thật = 1 ngày
const GM_PER_SEC = DAY_MIN / REAL_SEC_PER_DAY; // 1.1 phút game / giây thật

// ---------- Dữ liệu ----------
const PARTNERS = ['Em Hà Đan Phượng', 'Anh Duy Ô Diên', 'Chị Trang', 'Đàm Vy', 'Đàm Huy', 'My', 'Duy Anh', 'Tuấn', 'Công ty TNHH Hà Duy'];

const OUTFITS = [
  'Trang phục mặc định', 'Trang phục làm vườn', 'Váy hoa nhẹ nhàng', 'Thư giãn thường ngày',
  'Dịu dàng tiểu thư', 'Năng động', 'Đi chơi / hẹn hò'
];
// Tạm thời chỉ cho chọn trang phục có đủ hoạt ảnh (4 hướng + gieo hạt + tưới cây).
// Thêm số thứ tự vào đây để mở lại các bộ khác.
const ENABLED_OUTFITS = [0];

// ---------- Hoạt ảnh nhân vật ----------
// Sprite sheet: assets/anim/outfitN_sheet.png, ô 128x128, mỗi hàng là một animation [hàng, số frame].
// Bộ mặc định có đủ 4 hướng + gieo hạt + tưới cây; các bộ khác có đứng và đi (hướng xuống).
const CELL = 128, FEET_Y = 125.5, CHAR_SIZE = 118;
const ANIM_FULL = {
  idle_down: [0, 4], idle_left: [1, 4], idle_right: [2, 4], idle_up: [3, 4],
  walk_down: [4, 8], walk_left: [5, 8], walk_right: [6, 8], walk_up: [7, 8],
  plant_left: [8, 14], plant_right: [9, 14], water_left: [10, 8], water_right: [11, 8],
};
const ANIM_LITE = { idle_down: [0, 4], walk_down: [1, 8] };
// tâm thân theo chiều ngang trong ô (đo từ frame) để nhân vật đứng đúng vị trí, không lệch khi đổi bộ
const OUTFIT_ANIM = [{ full: true, cx: 64 }, { cx: 73.7 }, { cx: 64.6 }, { cx: 63.8 }, { cx: 60.5 }, { cx: 62.5 }, { cx: 60.2 }];
const STRIDE_PX = 13;                 // đi được 13px thì sang frame bước tiếp -> chân không bị trượt
const IDLE_SEQ = [0, 1, 2, 3, 2, 1];  // thở nhẹ qua lại, không bị giật từ frame cuối về đầu
const IDLE_FPS = 6;
const ACT_FPS = { plant: 20, water: 12 };

// grow: phút game (1 phút game ≈ 0.9 giây thật)
const CROPS = {
  luami:    { name: 'Lúa mì',    icon: '🌾', lv: 1,  seed: 1000,  grow: 20,  sell: 2500,   xp: 1,  leaf: '#d9b84a', yield: 2, note: 'Thức ăn cho gà' },
  cai:     { name: 'Cải xanh',  icon: '🥬', lv: 1,  seed: 2000,  grow: 30,  sell: 5000,   xp: 2,  leaf: '#4caf50' },
  carot:    { name: 'Cà rốt',    icon: '🥕', lv: 1,  seed: 3000,  grow: 45,  sell: 7500,   xp: 3,  leaf: '#66bb6a' },
  duachuot: { name: 'Dưa chuột', icon: '🥒', lv: 2,  seed: 5000,  grow: 75,  sell: 13000,  xp: 5,  leaf: '#43a047' },
  ngo:      { name: 'Ngô',       icon: '🌽', lv: 3,  seed: 7000,  grow: 120, sell: 19000,  xp: 7,  leaf: '#8bc34a' },
  cachua:   { name: 'Cà chua',   icon: '🍅', lv: 4,  seed: 9000,  grow: 150, sell: 25000,  xp: 9,  leaf: '#388e3c' },
  bingo:    { name: 'Bí ngô',    icon: '🎃', lv: 5,  seed: 14000, grow: 210, sell: 38000,  xp: 12, leaf: '#558b2f' },
  dau:      { name: 'Dâu tây',   icon: '🍓', lv: 7,  seed: 20000, grow: 270, sell: 52000,  xp: 15, leaf: '#2e7d32' },
  hoahong:  { name: 'Hoa hồng',  icon: '🌹', lv: 9,  seed: 28000, grow: 360, sell: 75000,  xp: 19, leaf: '#33691e' },
  duahau:   { name: 'Dưa hấu',   icon: '🍉', lv: 11, seed: 38000, grow: 480, sell: 104000, xp: 25, leaf: '#1b5e20' },
};

const ANIMALS = {
  // gà ăn lúa mì trong kho (feedItem) thay vì trả tiền thức ăn
  ga:  { name: 'Gà',     icon: '🐔', lv: 2,  price: 25000,  product: 'trungga', time: 60,  feed: 0, feedItem: 'luami', feedQty: 1, xp: 2,  snd: 'cluck' },
  vit: { name: 'Vịt',    icon: '🦆', lv: 4,  price: 40000,  product: 'trungvit', time: 90, feed: 1500, xp: 3,  snd: 'quack' },
  de:  { name: 'Dê',     icon: '🐐', lv: 6,  price: 90000,  product: 'suade',   time: 150, feed: 4000, xp: 6,  snd: 'baa' },
  bo:  { name: 'Bò sữa', icon: '🐄', lv: 8,  price: 150000, product: 'suabo',   time: 180, feed: 5000, xp: 8,  snd: 'moo' },
  cuu: { name: 'Cừu',    icon: '🐑', lv: 10, price: 200000, product: 'longcuu', time: 240, feed: 6000, xp: 11, snd: 'baa' },
};

const PRODUCTS = {
  trungga:  { name: 'Trứng gà',  icon: '🥚', sell: 5500,  from: 'ga' },
  trungvit: { name: 'Trứng vịt', icon: '🥚', sell: 6500,  from: 'vit' },
  suade:    { name: 'Sữa dê',    icon: '🍼', sell: 16000, from: 'de' },
  suabo:    { name: 'Sữa bò',    icon: '🥛', sell: 22000, from: 'bo' },
  longcuu:  { name: 'Lông cừu',  icon: '🧶', sell: 32000, from: 'cuu' },
};

// Bảng vật phẩm chung (nông sản + sản phẩm gia súc)
const ITEMS = {};
for (const k in CROPS) ITEMS[k] = { name: CROPS[k].name, icon: CROPS[k].icon, sell: CROPS[k].sell, xp: CROPS[k].xp, time: CROPS[k].grow };
for (const k in PRODUCTS) {
  const a = ANIMALS[PRODUCTS[k].from];
  ITEMS[k] = { name: PRODUCTS[k].name, icon: PRODUCTS[k].icon, sell: PRODUCTS[k].sell, xp: a.xp, time: a.time };
}

const FERTS = {
  f2: { name: 'Phân bón x2', short: 'x2', mult: 2, price: 5000,  lv: 1, color: '#8bc34a' },
  f3: { name: 'Phân bón x3', short: 'x3', mult: 3, price: 12000, lv: 3, color: '#ffb300' },
  f5: { name: 'Phân bón x5', short: 'x5', mult: 5, price: 25000, lv: 5, color: '#e53935' },
};

// ---------- Câu cá ở ao ----------
// w = độ phổ biến (càng lớn càng dễ câu). Cân đối: cần câu tre ở cấp 1 trung bình ~1.900đ/lượt (trừ mồi còn ~1.400đ),
// mỗi ngày tối đa FISH_PER_DAY lượt -> câu cá là nguồn tiền phụ, không thay được trồng trọt.
const FISH = {
  ca_ro:       { name: 'Cá rô',       icon: '🐟', lv: 1, w: 40, sell: 1500,  xp: 1 },
  ca_chep:     { name: 'Cá chép',     icon: '🎏', lv: 1, w: 26, sell: 3000,  xp: 2 },
  giay_cu:     { name: 'Giày cũ',     icon: '👢', lv: 1, w: 6,  sell: 200,   xp: 0 },
  tom:         { name: 'Tôm càng',    icon: '🦐', lv: 2, w: 18, sell: 4500,  xp: 2 },
  ca_tram:     { name: 'Cá trắm',     icon: '🐟', lv: 3, w: 14, sell: 6000,  xp: 3 },
  cua:         { name: 'Cua đồng',    icon: '🦀', lv: 4, w: 10, sell: 8000,  xp: 3 },
  ca_loc:      { name: 'Cá lóc',      icon: '🐟', lv: 5, w: 7,  sell: 12000, xp: 4 },
  ca_koi:      { name: 'Cá koi',      icon: '🐠', lv: 7, w: 3,  sell: 35000, xp: 8 },
  ca_than_tai: { name: 'Cá thần tài', icon: '🐡', lv: 9, w: 1,  sell: 90000, xp: 15 },
};
// window = số giây để giật câu khi phao chìm; rare = nhân độ dễ câu loài quý (giá >= 8.000đ)
const RODS = [null,
  { name: 'Cần câu tre',    price: 20000,  lv: 1, window: 1.0, rare: 1 },
  { name: 'Cần câu carbon', price: 100000, lv: 5, window: 1.5, rare: 1.8 },
];
const BAIT_PRICE = 500;      // mỗi mồi câu
const FISH_PER_DAY = 15;     // ao chỉ có chừng ấy cá mỗi ngày
for (const k in FISH) ITEMS[k] = { name: FISH[k].name, icon: FISH[k].icon, sell: FISH[k].sell, xp: FISH[k].xp, time: 9999, fish: true };

// Nước (đơn vị m³ = khối)
const WATER = {
  cap: 2.0,          // dung tích bể
  plant: 0.015,      // mỗi lần tưới 1 ô = 15 lít
  animal: 0.01,      // mỗi lần cho gia súc uống = 10 lít
  price: 18000,      // đ / m³
  low: 0.5,          // dưới mức này là "mức cạn" -> tính thêm phí bơm gấp
  surcharge: 10000,  // phí bơm gấp khi để bể xuống dưới mức cạn
};

const VAT = 0.15;
const LATE_STEP = 0.05;      // phạt 5% cho mỗi giờ game trễ
const LATE_MAX = 0.40;       // tối đa 40%
const LATE_GRACE = 240;      // trễ quá 4 giờ game -> huỷ đơn
const CANCEL_FEE = 0.10;     // phí phạt huỷ hợp đồng 10% giá trị đơn
const MAX_OFFERS = 4, MAX_ORDERS = 3;

const xpNeed = lv => 40 + 15 * lv * (lv - 1);
// Số ô đất tối đa được phép mua theo cấp; ô ngoài 6 ô ban đầu phải bỏ tiền mua (mua lần lượt)
const START_PLOTS = 6;
const plotCount = lv => Math.min(24, START_PLOTS + 2 * (lv - 1));
const plotPrice = i => 20000 + (i - START_PLOTS) * 10000;   // 20.000đ, 30.000đ, ... 190.000đ
const penCap = lv => Math.min(6, 2 + Math.floor(lv / 3));

// ---------- Bố cục bản đồ ----------
const FIELD = { x: 648, y: 184, cols: 8, rows: 3, w: 70, h: 64, gap: 5 };
const PENS = {
  ga:  { x: 24,  y: 466, w: 248, h: 112, ground: '#e9d79c' },
  vit: { x: 290, y: 466, w: 252, h: 112, ground: '#9fd2e6' },
  de:  { x: 24,  y: 594, w: 248, h: 112, ground: '#b5d77a' },
  bo:  { x: 290, y: 594, w: 252, h: 112, ground: '#a9d06c' },
  cuu: { x: 652, y: 466, w: 262, h: 116, ground: '#c4e08a' },
};
const BUILD = {
  house:   { x: 22,  y: 178, w: 180, h: 150, label: 'Kho' },
  well:    { x: 222, y: 262, w: 70,  h: 80,  label: 'Bể nước' },
  mailbox: { x: 448, y: 312, w: 46,  h: 66,  label: 'Hộp thư' },
  market:  { x: 664, y: 600, w: 236, h: 112, label: 'Chợ' },
};
const POND = { x: 1095, y: 592, rx: 150, ry: 92 };

function plotRect(i) {
  const c = i % FIELD.cols, r = Math.floor(i / FIELD.cols);
  return { x: FIELD.x + c * (FIELD.w + FIELD.gap), y: FIELD.y + r * (FIELD.h + FIELD.gap), w: FIELD.w, h: FIELD.h };
}

// ---------- Tiện ích ----------
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const money = n => Math.round(n).toLocaleString('vi-VN') + 'đ';
const pad = n => String(n).padStart(2, '0');
function clock(min) { const t = Math.floor(min) + DAY_START_HOUR * 60; return pad(Math.floor(t / 60)) + ':' + pad(t % 60); }
function absLabel(abs) {
  let d = Math.floor(abs / DAY_MIN), m = abs - d * DAY_MIN;
  if (m === 0 && d > 0) { d -= 1; m = DAY_MIN; }
  return clock(m) + ' ngày ' + (d + 1);
}
function gameDur(min) { min = Math.max(0, Math.ceil(min)); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h${pad(m)}` : `${m} phút`; }
function realDur(gameMin) { const s = Math.max(0, Math.ceil(gameMin / GM_PER_SEC)); return Math.floor(s / 60) + ':' + pad(s % 60); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Trạng thái ----------
let S = null;                 // trạng thái được lưu
const R = {                   // trạng thái runtime
  char: { x: 520, y: 430, tx: null, ty: null, dir: 1, face: 'down', moving: false, phase: 0, act: 0, actIcon: '', anim: null, animT: 0 },
  queue: [], keys: {}, floaters: [], clouds: [], birds: [], ripples: [],
  animPos: {}, dog: { x: 120, y: 370, tx: 160, ty: 370, dir: 1, t: 0 },
  hover: null, paused: true, started: false, modal: null, pendingPlot: -1,
  birdT: 5, animalSndT: 12, nextOfferT: 0, hudT: 0, saveT: 0, time: 0,
  imgs: [], bg: null,
  cam: { z: 1, x: 0, y: 0 },  // camera: z = độ phóng, (x, y) = góc trên trái vùng nhìn
};
const ZOOM_MIN = 1, ZOOM_MAX = 2.5;

function newState(name, outfit) {
  return {
    v: 1, name, outfit, money: 150000, xp: 0, lv: 1, water: WATER.cap,
    day: 1, min: 0, dayOver: false,
    plots: Array.from({ length: 24 }, () => ({ crop: null, prog: 0, wet: false, w2: false, fert: 1 })),
    animals: { ga: [], vit: [], de: [], bo: [], cuu: [] },
    plotsOwned: START_PLOTS,
    inv: {}, ferts: { f2: 1, f3: 0, f5: 0 },
    rod: 0, bait: 0, fishLeft: FISH_PER_DAY,
    offers: [], orders: [], nextId: 1, invoiceNo: 1, nextOfferAt: 20,
    tool: 'hand', seed: 'cai', fert: 'f2',
    stats: { income: 0, expense: 0, harvest: 0, delivered: 0 },
    settings: { music: true, sfx: true },
    ui: { trk: { x: null, y: null, scale: 1, folded: false }, zoom: 1 },
  };
}
const nowAbs = () => (S.day - 1) * DAY_MIN + S.min;

// ---------- Lưu / tải ----------
let SAVE_KEY = 'nangnongtrai_save_v1';
function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* bỏ qua */ } }
function loadGame() { try { const t = localStorage.getItem(SAVE_KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
// ---------- Sao lưu ra file / khôi phục từ file ----------
const BACKUP_TAG = 'NangNongTrai';
function backupToFile() {
  saveGame();
  const d = new Date(), stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const blob = new Blob([JSON.stringify({ game: BACKUP_TAG, savedAt: d.toISOString(), data: S }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${BACKUP_TAG}_${S.name.replace(/[^\p{L}\p{N}]+/gu, '-')}_Lv${S.lv}_ngay${S.day}_${stamp}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('📥 Đã tải file sao lưu — hãy cất file này cẩn thận', 'good');
}
// nhận cả file sao lưu của game lẫn chuỗi JSON chép từ localStorage
function parseBackup(text) {
  let o; try { o = JSON.parse(text.trim()); } catch (e) { return null; }
  const d = o && o.game === BACKUP_TAG && o.data ? o.data : o;
  const ok = d && typeof d.name === 'string' && d.name && typeof d.money === 'number' && typeof d.lv === 'number' && Array.isArray(d.plots) && d.animals;
  return ok ? d : null;
}
$('#restoreFile').addEventListener('change', e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    const d = parseBackup(String(rd.result));
    if (!d) { toast('File không phải dữ liệu sao lưu của Nàng Nông Trại', 'bad'); SND.error(); return; }
    const cur = S && R.started ? `\n\nTiến trình hiện tại (${S.name} · Lv ${S.lv} · Ngày ${S.day}) sẽ bị thay thế.` : '';
    if (!confirm(`Khôi phục nhân vật "${d.name}" · Lv ${d.lv} · Ngày ${d.day} · ${money(d.money)}?${cur}`)) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (err) { /* vẫn chơi được, chỉ không lưu */ }
    $('#modalBg').classList.add('hidden'); R.modal = null; R.queue = []; R.char.tx = null;
    startGame(d);
    toast(`📂 Đã khôi phục dữ liệu của ${d.name}!`, 'good');
  };
  rd.readAsText(f);
});
$('#btnRestoreStart').onclick = () => $('#restoreFile').click();

function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* bỏ qua */ } }

/* =========================================================
   ÂM THANH (Web Audio, tự tổng hợp — không cần file)
   ========================================================= */
const SND = {
  ctx: null, master: null, music: null, sfx: null, amb: null, noise: null, nextNote: 0, step: 0,
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.amb = c.createGain(); this.amb.gain.value = 0; this.amb.connect(this.master);
    this.apply();
    // bộ đệm tiếng ồn trắng
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // tiếng nước chảy của ao (âm lượng theo khoảng cách)
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
    const lfo = c.createOscillator(), lg = c.createGain(), mod = c.createGain();
    lfo.frequency.value = 0.35; lg.gain.value = 0.35; mod.gain.value = 0.65;
    lfo.connect(lg); lg.connect(mod.gain); lfo.start();
    src.connect(lp); lp.connect(mod); mod.connect(this.amb); src.start();
    this.nextNote = c.currentTime + 0.2;
    setInterval(() => this.schedule(), 30);
  },
  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(S && S.settings.music ? 0.16 : 0, t, 0.1);
    this.sfx.gain.setTargetAtTime(S && S.settings.sfx ? 0.55 : 0, t, 0.05);
  },
  // ---- Nhạc nền: vòng hợp âm C – Am – F – G, giai điệu ngũ cung nhẹ nhàng ----
  MEL: [72,0,76,0,79,0,76,74, 72,0,69,0,72,74,76,0, 77,0,76,0,74,0,72,0, 74,0,79,0,74,72,71,0,
        76,0,79,81,79,0,76,0, 81,0,79,76,74,0,72,0, 72,74,76,0,77,76,74,0, 74,0,71,0,72,0,0,0],
  ROOT: [48, 45, 41, 43],
  schedule() {
    const c = this.ctx; if (!c) return;
    const stepDur = 0.3;
    while (this.nextNote < c.currentTime + 0.15) {
      const t = this.nextNote, s = this.step;
      if (S && S.settings.music) {
        const n = this.MEL[s];
        if (n) this.note(n, t, 0.55, 'triangle', 0.22, this.music);
        const bar = Math.floor(s / 8) % 4, root = this.ROOT[bar];
        if (s % 8 === 0) { this.note(root, t, 1.1, 'sine', 0.35, this.music); this.pad(root + 12, t, this.music); }
        if (s % 8 === 4) this.note(root + 7, t, 0.9, 'sine', 0.22, this.music);
      }
      this.nextNote += stepDur; this.step = (s + 1) % this.MEL.length;
    }
  },
  mf: m => 440 * Math.pow(2, (m - 69) / 12),
  note(m, t, dur, type, vol, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = this.mf(m);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  pad(m, t, dest) {
    const minor = (m % 12) === 9; // Am
    [0, minor ? 3 : 4, 7].forEach(iv => {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = this.mf(m + iv);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.3); g.gain.linearRampToValueAtTime(0, t + 2.3);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 2.4);
    });
  },
  ok() { return this.ctx && S && S.settings.sfx; },
  sweep(f0, f1, dur, type, vol, t0 = 0, filt) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = o;
    if (filt) { const f = c.createBiquadFilter(); f.type = filt.type; f.frequency.value = filt.f; f.Q.value = filt.q || 1; o.connect(f); node = f; }
    node.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  noiseBurst(dur, f, q, vol, t0 = 0) {
    if (!this.ok()) return;
    const c = this.ctx, t = c.currentTime + t0, s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.08); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  // ---- Hiệu ứng ----
  click() { this.sweep(900, 600, 0.06, 'square', 0.08); },
  coin() { this.sweep(1318, 1318, 0.09, 'square', 0.12); this.sweep(1760, 1760, 0.25, 'square', 0.12, 0.08); },
  pop() { this.sweep(500, 1300, 0.12, 'sine', 0.35); },
  plant() { this.sweep(300, 180, 0.12, 'triangle', 0.3); this.noiseBurst(0.12, 400, 1, 0.2); },
  error() { this.sweep(220, 160, 0.25, 'square', 0.12); },
  water() {
    this.noiseBurst(1.0, 1600, 0.8, 0.35);
    for (let i = 0; i < 7; i++) { const f = rand(500, 1100); this.sweep(f, f * 1.6, 0.06, 'sine', 0.15, 0.1 + i * 0.12); }
  },
  refill() { this.noiseBurst(2.0, 700, 0.5, 0.4); for (let i = 0; i < 10; i++) this.sweep(rand(300, 600), rand(700, 1000), 0.08, 'sine', 0.12, i * 0.17); },
  levelup() { [72, 76, 79, 84, 88].forEach((m, i) => { if (this.ok()) this.note(m, this.ctx.currentTime + i * 0.11, 0.4, 'square', 0.12); }); },
  rooster() { // ò ó o o...
    if (!this.ok()) return;
    const seg = [[480, 720, 0.16], [700, 660, 0.14], [640, 960, 0.22], [920, 560, 0.62]];
    let t0 = 0;
    seg.forEach(([a, b, d]) => { this.sweep(a, b, d, 'sawtooth', 0.22, t0, { type: 'bandpass', f: 1500, q: 2 }); this.sweep(a * 2, b * 2, d, 'sine', 0.05, t0); t0 += d + 0.03; });
  },
  bird() { // chim hót líu lo
    if (!this.ok()) return;
    const n = randInt(3, 6), base = rand(2600, 3600);
    for (let i = 0; i < n; i++) {
      const t0 = i * rand(0.09, 0.16);
      this.sweep(base, base * rand(1.2, 1.5), 0.06, 'sine', 0.09, t0);
      this.sweep(base * 1.4, base * 0.9, 0.05, 'sine', 0.07, t0 + 0.06);
    }
  },
  cluck() { this.sweep(700, 420, 0.07, 'square', 0.1, 0, { type: 'lowpass', f: 1800 }); this.sweep(760, 450, 0.09, 'square', 0.1, 0.12, { type: 'lowpass', f: 1800 }); },
  quack() { this.sweep(520, 380, 0.16, 'sawtooth', 0.12, 0, { type: 'bandpass', f: 1100, q: 3 }); this.sweep(500, 360, 0.16, 'sawtooth', 0.1, 0.22, { type: 'bandpass', f: 1100, q: 3 }); },
  moo() { this.sweep(150, 110, 1.1, 'sawtooth', 0.22, 0, { type: 'lowpass', f: 600 }); },
  baa() { if (!this.ok()) return; for (let i = 0; i < 6; i++) this.sweep(420 + (i % 2) * 40, 400, 0.09, 'sawtooth', 0.1, i * 0.08, { type: 'bandpass', f: 1200, q: 2 }); },
  setPond(v) { if (this.ctx) this.amb.gain.setTargetAtTime(S && S.settings.sfx ? v : 0, this.ctx.currentTime, 0.3); },
};

/* =========================================================
   KHỞI TẠO, MÀN HÌNH BẮT ĐẦU
   ========================================================= */
const cv = $('#game'), ctx = cv.getContext('2d');
const stage = $('#stage');
let startOutfit = 0;

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
function fitStage() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  R.stageScale = s;
  stage.style.transform = `scale(${s})`;
  stage.style.left = (innerWidth - W * s) / 2 + 'px';
  stage.style.top = (innerHeight - H * s) / 2 + 'px';
  // màn hình nhỏ -> phóng to các nút & bảng cho dễ bấm
  document.body.classList.toggle('mobile', s < 0.75 || (isTouch && Math.min(innerWidth, innerHeight) < 600));
  R.portrait = isTouch && innerHeight > innerWidth * 1.05;
  $('#rotate').classList.toggle('hidden', !R.portrait);
  if (S) applyTracker();
}
addEventListener('resize', fitStage);
addEventListener('orientationchange', () => setTimeout(fitStage, 200));

function goFullscreen() {
  const el = document.documentElement, req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) { toast('Trình duyệt này không hỗ trợ toàn màn hình — hãy xoay ngang điện thoại'); return; }
  Promise.resolve(req.call(el)).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {})).catch(() => {});
}
$('#btnFullscreen').onclick = goFullscreen;

function loadImages() {
  const load = (src, store, i) => new Promise(res => {
    const im = new Image(); im.onload = () => res(im); im.onerror = () => { store[i] = null; res(null); }; im.src = src; store[i] = im;
  });
  R.sheets = [];
  return Promise.all(OUTFITS.flatMap((_, i) => [load(`assets/outfit${i}.png`, R.imgs, i), load(`assets/anim/outfit${i}_sheet.png`, R.sheets, i)]));
}

function buildOutfitPicker(container, selected, onPick) {
  container.style.gridTemplateColumns = `repeat(${ENABLED_OUTFITS.length}, minmax(0, ${ENABLED_OUTFITS.length < 4 ? '180px' : '1fr'}))`;
  container.style.justifyContent = 'center';
  container.innerHTML = ENABLED_OUTFITS.map(i =>
    `<div class="outfit${i === selected ? ' sel' : ''}" data-i="${i}"><img src="assets/outfit${i}.png" alt=""><span>${OUTFITS[i]}</span></div>`).join('');
  container.querySelectorAll('.outfit').forEach(el => el.addEventListener('click', () => {
    container.querySelectorAll('.outfit').forEach(e => e.classList.remove('sel'));
    el.classList.add('sel'); onPick(+el.dataset.i); SND.click();
  }));
}

function showStart() {
  $('#start').classList.remove('hidden');
  const saved = loadGame();
  const box = $('#continueBox');
  if (saved && saved.name) {
    box.innerHTML = `<button class="big alt" id="btnContinue">▶ Tiếp tục: ${esc(saved.name)} · Lv ${saved.lv} · Ngày ${saved.day}</button>
      <div class="muted" style="margin-top:6px">— hoặc tạo nhân vật mới —</div>`;
    $('#btnContinue').onclick = () => startGame(saved);
  } else box.innerHTML = '';
  buildOutfitPicker($('#startOutfits'), startOutfit, i => startOutfit = i);
  $('#startName').focus();
}

$('#btnStart').onclick = () => {
  const name = $('#startName').value.trim();
  if (!name) { $('#startName').focus(); $('#startName').style.borderColor = '#e53935'; return; }
  if (loadGame() && !confirm('Bắt đầu chơi mới sẽ xoá dữ liệu đã lưu. Tiếp tục?')) return;
  startGame(newState(name, startOutfit));
};
$('#startName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnStart').click(); });

function startGame(state) {
  S = state;
  // bổ sung trường còn thiếu cho bản lưu cũ (bản cũ được giữ các ô đất đã có theo cấp)
  if (S.plotsOwned === undefined) S.plotsOwned = plotCount(S.lv);
  if (!ENABLED_OUTFITS.includes(S.outfit)) S.outfit = ENABLED_OUTFITS[0];
  const base = newState(S.name, S.outfit);
  for (const k in base) if (S[k] === undefined) S[k] = base[k];
  SND.init(); SND.apply();
  $('#start').classList.add('hidden');
  ['#hud', '#moneyPill', '#topBtns', '#toolbar', '#tracker', '#zoomCtl'].forEach(s => $(s).classList.remove('hidden'));
  setZoom(S.ui.zoom || 1, false);
  R.started = true; R.paused = false;
  R.char.x = 520; R.char.y = 430; R.queue = [];
  R.nextOfferT = 0;
  if (S.offers.length === 0 && S.orders.length === 0) { genOffer(); genOffer(); }
  rebuildAnimPos();
  drawAvatar(); updateToolbar(); updateHUD(true); applyTracker();
  if (S.dayOver) showDayEnd();
  else { SND.rooster(); toast(`Chào buổi sáng, ${S.name}! 🌞`, 'good'); }
  if (S.day === 1 && S.min < 1 && S.stats.harvest === 0) setTimeout(showHelp, 600);
  saveGame();
}

/* =========================================================
   NỀN BẢN ĐỒ (vẽ sẵn 1 lần)
   ========================================================= */
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function emoji(g, e, x, y, size, flip) {
  g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
  g.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 0, 0); g.restore();
}
function tree(g, x, y, r, fruit) {
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, y + r * 0.95, r * 0.8, r * 0.22, 0, 0, 7); g.fill();
  g.fillStyle = '#8a5a33'; g.fillRect(x - r * 0.13, y, r * 0.26, r * 0.95);
  const blobs = [[0, -0.2, 0.75], [-0.55, 0.1, 0.55], [0.55, 0.1, 0.55], [-0.3, -0.6, 0.5], [0.35, -0.55, 0.5], [0, 0.25, 0.6]];
  g.fillStyle = '#3f9a3a'; blobs.forEach(([dx, dy, s]) => { g.beginPath(); g.arc(x + dx * r, y + dy * r, s * r, 0, 7); g.fill(); });
  g.fillStyle = '#5cbf4a'; blobs.forEach(([dx, dy, s]) => { g.beginPath(); g.arc(x + dx * r - s * r * 0.2, y + dy * r - s * r * 0.25, s * r * 0.7, 0, 7); g.fill(); });
  if (fruit) { g.fillStyle = fruit; for (let i = 0; i < 9; i++) { const a = i * 2.4, d = r * (0.3 + (i % 3) * 0.2); g.beginPath(); g.ellipse(x + Math.cos(a) * d, y - r * 0.15 + Math.sin(a) * d * 0.7, 5, 8, 0, 0, 7); g.fill(); } }
}
function fenceRect(g, x, y, w, h) {
  g.strokeStyle = '#a8743f'; g.lineWidth = 4;
  g.strokeRect(x, y, w, h); g.strokeRect(x + 0, y + 8, w, h - 16);
  g.fillStyle = '#c08a52';
  for (let px = x; px <= x + w; px += 31) { g.fillRect(px - 3, y - 6, 6, 14); g.fillRect(px - 3, y + h - 8, 6, 14); }
  for (let py = y + 31; py < y + h; py += 31) { g.fillRect(x - 3, py - 6, 6, 14); g.fillRect(x + w - 3, py - 6, 6, 14); }
}

function buildBG() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // bầu trời
  let gr = g.createLinearGradient(0, 0, 0, 170); gr.addColorStop(0, '#6ec3f4'); gr.addColorStop(1, '#d6f0ff');
  g.fillStyle = gr; g.fillRect(0, 0, W, 170);
  // đồi xa
  g.fillStyle = '#a8d98f'; for (let x = -60; x < W + 120; x += 150) { g.beginPath(); g.ellipse(x + rnd() * 40, 152, 130, 46, 0, 0, 7); g.fill(); }
  // ruộng xa
  for (let i = 0; i < 9; i++) {
    g.fillStyle = ['#d9e26a', '#9ccc65', '#c5e17a', '#e6d36a'][i % 4];
    const x = 120 + i * 130; g.beginPath(); g.moveTo(x, 132); g.lineTo(x + 120, 132); g.lineTo(x + 140, 152); g.lineTo(x + 10, 152); g.fill();
  }
  // hàng cây xa
  for (let x = 0; x < W; x += 22) { g.fillStyle = rnd() < 0.5 ? '#4f9d43' : '#5fae4f'; g.beginPath(); g.arc(x, 124 + rnd() * 8, 12 + rnd() * 12, 0, 7); g.fill(); }
  tree(g, 90, 110, 46); tree(g, 1180, 108, 52); tree(g, 860, 116, 34);

  // cỏ
  g.fillStyle = '#7ccb55'; g.fillRect(0, 160, W, H - 160);
  for (let i = 0; i < 3500; i++) { g.fillStyle = rnd() < 0.5 ? '#6fbe4a' : '#8ad864'; g.fillRect(rnd() * W, 160 + rnd() * (H - 160), 2, 4); }

  // đường đất
  const path = (x, y, w, h) => { g.fillStyle = '#c9a46a'; rr(g, x - 3, y - 3, w + 6, h + 6, 18); g.fill(); g.fillStyle = '#e4c893'; rr(g, x, y, w, h, 16); g.fill(); };
  path(0, 402, W, 48); path(566, 172, 54, H - 172);
  g.fillStyle = '#d6b67c'; for (let i = 0; i < 300; i++) { const onH = rnd() < 0.6; g.fillRect(onH ? rnd() * W : 570 + rnd() * 46, onH ? 406 + rnd() * 40 : 176 + rnd() * 540, 3, 2); }
  path(200, 338, 370, 26); // lối từ kho

  // hàng rào phía trên
  g.fillStyle = '#b07a45'; g.fillRect(0, 158, W, 5); g.fillRect(0, 172, W, 5);
  for (let x = 6; x < W; x += 36) { g.fillStyle = '#c99059'; rr(g, x, 150, 9, 34, 3); g.fill(); }

  // khung ruộng
  const fw = FIELD.cols * (FIELD.w + FIELD.gap) - FIELD.gap, fh = FIELD.rows * (FIELD.h + FIELD.gap) - FIELD.gap;
  g.fillStyle = '#5a9c3a'; rr(g, FIELD.x - 12, FIELD.y - 12, fw + 24, fh + 24, 14); g.fill();
  g.fillStyle = '#6aad45'; rr(g, FIELD.x - 7, FIELD.y - 7, fw + 14, fh + 14, 10); g.fill();

  // chuồng
  for (const k in PENS) {
    const p = PENS[k];
    g.fillStyle = p.ground; rr(g, p.x, p.y, p.w, p.h, 6); g.fill();
    g.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 70; i++) g.fillRect(p.x + rnd() * p.w, p.y + rnd() * p.h, 3, 3);
    if (k === 'vit') { g.fillStyle = '#6cc0e6'; g.beginPath(); g.ellipse(p.x + p.w - 60, p.y + 62, 46, 26, 0, 0, 7); g.fill(); }
    // máng ăn
    g.fillStyle = '#8a5a33'; rr(g, p.x + 10, p.y + p.h - 26, 46, 14, 4); g.fill(); g.fillStyle = '#e6c25a'; g.fillRect(p.x + 13, p.y + p.h - 24, 40, 6);
    fenceRect(g, p.x, p.y, p.w, p.h);
  }

  // ao
  g.fillStyle = '#9aa38f'; g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx + 10, POND.ry + 10, 0, 0, 7); g.fill();
  for (let a = 0; a < 6.28; a += 0.32) { g.fillStyle = rnd() < 0.5 ? '#b8bfae' : '#8d9583'; g.beginPath(); g.ellipse(POND.x + Math.cos(a) * (POND.rx + 8), POND.y + Math.sin(a) * (POND.ry + 8), 12, 8, a, 0, 7); g.fill(); }
  gr = g.createRadialGradient(POND.x, POND.y - 20, 10, POND.x, POND.y, POND.rx);
  gr.addColorStop(0, '#6fd0f5'); gr.addColorStop(1, '#2f8fd0');
  g.fillStyle = gr; g.beginPath(); g.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, 7); g.fill();
  [[-80, 20], [60, -40], [90, 40], [-30, -50]].forEach(([dx, dy]) => { g.fillStyle = '#4caf50'; g.beginPath(); g.arc(POND.x + dx, POND.y + dy, 13, 0.4, 6.0); g.lineTo(POND.x + dx, POND.y + dy); g.fill(); });
  emoji(g, '🌸', POND.x + 60, POND.y - 44, 16);

  // nhà kho (giống ảnh tham khảo: tường trắng, mái tôn)
  const hx = BUILD.house.x, hy = BUILD.house.y;
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(hx + 12, hy + 140, 170, 12);
  g.fillStyle = '#efe7d5'; g.fillRect(hx + 10, hy + 50, 160, 98);
  g.fillStyle = '#d9cfb9'; for (let y = hy + 60; y < hy + 148; y += 12) g.fillRect(hx + 10, y, 160, 2);
  g.fillStyle = '#c3c8cf'; g.beginPath(); g.moveTo(hx - 6, hy + 58); g.lineTo(hx + 186, hy + 58); g.lineTo(hx + 166, hy); g.lineTo(hx + 14, hy); g.fill();
  g.strokeStyle = '#9aa1aa'; g.lineWidth = 2; for (let x = hx + 14; x < hx + 170; x += 10) { g.beginPath(); g.moveTo(x, hy + 1); g.lineTo(x - 18 + (x - hx) * 0.22, hy + 57); g.stroke(); }
  g.fillStyle = '#8a5a33'; g.fillRect(hx + 66, hy + 86, 50, 62); g.fillStyle = '#6d4424'; g.fillRect(hx + 89, hy + 86, 3, 62);
  g.fillStyle = '#7a4a22'; rr(g, hx + 56, hy + 62, 70, 20, 5); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 14px "Baloo 2",sans-serif'; g.textAlign = 'center'; g.fillText('KHO', hx + 91, hy + 77);
  g.fillStyle = '#b5834f'; g.fillRect(hx + 130, hy + 120, 30, 26); g.fillRect(hx + 18, hy + 120, 34, 26);
  emoji(g, '🥕', hx + 145, hy + 116, 16); emoji(g, '🌽', hx + 35, hy + 116, 16);

  // bể nước / giếng
  const wx = BUILD.well.x + 35, wy = BUILD.well.y + 52;
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(wx, wy + 22, 36, 9, 0, 0, 7); g.fill();
  g.fillStyle = '#9aa0a6'; rr(g, wx - 32, wy - 6, 64, 30, 8); g.fill();
  g.fillStyle = '#b8bec4'; for (let i = 0; i < 4; i++) g.fillRect(wx - 30 + i * 16, wy - 2, 13, 8);
  g.fillStyle = '#2f8fd0'; g.beginPath(); g.ellipse(wx, wy - 6, 30, 9, 0, 0, 7); g.fill();
  g.fillStyle = '#8a5a33'; g.fillRect(wx - 30, wy - 52, 5, 48); g.fillRect(wx + 25, wy - 52, 5, 48);
  g.fillStyle = '#c0533a'; g.beginPath(); g.moveTo(wx - 40, wy - 48); g.lineTo(wx + 40, wy - 48); g.lineTo(wx, wy - 72); g.fill();

  // hộp thư
  const mx = BUILD.mailbox.x + 23, my = BUILD.mailbox.y;
  g.fillStyle = '#8a5a33'; g.fillRect(mx - 3, my + 24, 6, 42);
  g.fillStyle = '#e53935'; rr(g, mx - 20, my + 4, 40, 24, 10); g.fill();
  g.fillStyle = '#b71c1c'; g.fillRect(mx - 20, my + 18, 40, 3);
  g.fillStyle = '#ffd54f'; g.fillRect(mx + 16, my - 6, 4, 18); g.fillRect(mx + 16, my - 6, 12, 7);

  // chợ
  const kx = BUILD.market.x, ky = BUILD.market.y;
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(kx + 8, ky + 102, 228, 10);
  g.fillStyle = '#8a5a33'; g.fillRect(kx + 12, ky + 30, 7, 76); g.fillRect(kx + 218, ky + 30, 7, 76);
  g.fillStyle = '#b57a43'; rr(g, kx + 4, ky + 64, 228, 40, 6); g.fill();
  g.fillStyle = '#9a6535'; g.fillRect(kx + 4, ky + 64, 228, 6);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#e53935'; g.beginPath(); g.moveTo(kx + i * 30, ky + 8); g.lineTo(kx + i * 30 + 30, ky + 8); g.lineTo(kx + i * 30 + 30, ky + 34); g.arc(kx + i * 30 + 15, ky + 34, 15, 0, Math.PI); g.fill(); }
  g.fillStyle = '#6b3f1d'; rr(g, kx + 84, ky - 14, 70, 24, 6); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 15px "Baloo 2",sans-serif'; g.fillText('CHỢ', kx + 119, ky + 4);
  ['🍅', '🥬', '🍉', '🥕', '🌽', '🥚'].forEach((e, i) => emoji(g, e, kx + 28 + i * 36, ky + 60, 24));

  // cây
  tree(g, 360, 226, 52, '#f6c443');   // cây xoài như ảnh mẫu
  tree(g, 500, 240, 34);
  tree(g, 1250, 440, 30);
  // hoa & bụi
  for (let i = 0; i < 34; i++) {
    const x = rnd() * W, y = 190 + rnd() * 520;
    const inBox = (b) => x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20;
    const fieldBox = { x: FIELD.x - 14, y: FIELD.y - 14, w: 620, h: 236 };
    if ([fieldBox, ...Object.values(PENS), ...Object.values(BUILD)].some(inBox)) continue;
    if ((y > 395 && y < 456) || (x > 560 && x < 625)) continue;
    if (Math.hypot((x - POND.x) / (POND.rx + 30), (y - POND.y) / (POND.ry + 30)) < 1) continue;
    if (x > 300 && x < 420 && y < 290) continue;
    if (rnd() < 0.5) { g.fillStyle = '#4e9e3a'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.arc(x + 9, y + 2, 7, 0, 7); g.arc(x - 8, y + 3, 7, 0, 7); g.fill(); }
    else { const col = pick(['#fff', '#ffeb3b', '#f48fb1', '#ce93d8']); for (let j = 0; j < 5; j++) { g.fillStyle = col; g.beginPath(); g.arc(x + Math.cos(j * 1.256) * 4, y + Math.sin(j * 1.256) * 4, 3, 0, 7); g.fill(); } g.fillStyle = '#ffb300'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
  }
  return c;
}

/* =========================================================
   LOGIC GAME
   ========================================================= */
function toast(msg, cls = '') {
  const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = msg;
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 3100);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function floater(x, y, text, color = '#fff') { R.floaters.push({ x, y, text, color, life: 1.4 }); }

function spend(n) {
  if (S.money < n) { toast(`Không đủ tiền! Cần ${money(n)}`, 'bad'); SND.error(); return false; }
  S.money -= n; S.stats.expense += n; return true;
}
function earn(n) { S.money += n; S.stats.income += n; }
function gainXp(n, x, y) {
  S.xp += n; if (x !== undefined) floater(x, y - 18, `+${n} XP`, '#ffe082');
  while (S.xp >= xpNeed(S.lv)) {
    S.xp -= xpNeed(S.lv); S.lv++;
    const un = [];
    for (const k in CROPS) if (CROPS[k].lv === S.lv) un.push(CROPS[k].icon + ' ' + CROPS[k].name);
    for (const k in ANIMALS) if (ANIMALS[k].lv === S.lv) un.push(ANIMALS[k].icon + ' ' + ANIMALS[k].name);
    for (const k in FERTS) if (FERTS[k].lv === S.lv) un.push('🧪 ' + FERTS[k].name);
    if (plotCount(S.lv) > plotCount(S.lv - 1)) un.push(`được mua thêm ${plotCount(S.lv) - plotCount(S.lv - 1)} ô đất`);
    toast(`🎉 Lên cấp ${S.lv}!`, 'big');
    if (un.length) toast('Mở khoá: ' + un.join(', '), 'good');
    SND.levelup(); rebuildAnimPos(); saveGame();
  }
}
function useWater(amount) {
  if (S.water + 1e-9 < amount) { toast('Bể nước đã cạn! Hãy mua thêm nước ở Bể nước 💧', 'bad'); SND.error(); return false; }
  S.water = Math.max(0, S.water - amount);
  if (S.water < WATER.low && S.water + amount >= WATER.low) toast(`⚠️ Nước dưới ${WATER.low} m³ — nạp lại sẽ tính thêm phí bơm gấp ${money(WATER.surcharge)}`, 'bad');
  return true;
}
function refillCost() {
  const need = Math.max(0, WATER.cap - S.water);
  const base = Math.ceil(need * WATER.price / 100) * 100;
  const sur = S.water < WATER.low ? WATER.surcharge : 0;
  return { need, base, sur, total: base + sur };
}
function doRefill() {
  const c = refillCost();
  if (c.need < 0.001) { toast('Bể nước đang đầy'); return; }
  if (!spend(c.total)) return;
  S.water = WATER.cap; SND.refill(); toast(`Đã nạp ${c.need.toFixed(2)} m³ nước (−${money(c.total)})`, 'good'); updateHUD(true);
}
const addInv = (k, n) => { S.inv[k] = (S.inv[k] || 0) + n; if (S.inv[k] <= 0) delete S.inv[k]; };

// ----- Trồng trọt -----
function plotAction(i, mode) {
  const p = S.plots[i], r = plotRect(i), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  if (i >= S.plotsOwned) { openBuyPlot(i); return; }
  const c = p.crop && CROPS[p.crop];
  const ready = c && p.prog >= c.grow;
  mode = mode || S.tool;
  if (mode === 'hand') {
    if (!p.crop) { R.pendingPlot = i; openSeedPicker(); return; }
    if (ready) return harvest(i);
    if (!p.wet) return water(i);
    R.pendingPlot = i; openPlotInfo(i); return;
  }
  if (mode === 'seed') {
    if (!p.crop) return plant(i, S.seed);
    if (ready) return harvest(i);
    if (!p.wet) return water(i);
    return;
  }
  if (mode === 'water') {
    if (!p.crop) { floater(cx, cy, 'Chưa gieo hạt', '#fff'); return; }
    if (ready) return harvest(i);
    if (p.wet) { floater(cx, cy, 'Đất còn ẩm', '#bbdefb'); return; }
    return water(i);
  }
  if (mode === 'fert') {
    if (!p.crop) { floater(cx, cy, 'Chưa gieo hạt', '#fff'); return; }
    if (ready) return harvest(i);
    return fertilize(i, S.fert);
  }
  if (mode === 'harvest') {
    if (ready) return harvest(i);
    if (c && !p.wet) return water(i);
  }
}
function lvForPlot(i) { let lv = 1; while (plotCount(lv) <= i) lv++; return lv; }

function plant(i, key) {
  const c = CROPS[key], p = S.plots[i], r = plotRect(i);
  if (S.lv < c.lv) { toast(`${c.name} mở khoá ở cấp ${c.lv}`, 'bad'); return; }
  if (p.crop) return;
  if (!spend(c.seed)) return;
  Object.assign(p, { crop: key, prog: 0, wet: false, w2: false, fert: 1 });
  floater(r.x + r.w / 2, r.y + 10, `−${money(c.seed)}`, '#ffcdd2');
  SND.plant(); startAct('plant', '🌱');
}
function water(i) {
  const p = S.plots[i], r = plotRect(i);
  if (!p.crop || p.wet) return;
  if (!useWater(WATER.plant)) return;
  p.wet = true; SND.water(); startAct('water', '🚿');
  floater(r.x + r.w / 2, r.y + 8, `−${(WATER.plant * 1000).toFixed(0)} lít`, '#bbdefb');
  for (let k = 0; k < 8; k++) R.ripples.push({ x: r.x + rand(10, r.w - 10), y: r.y + rand(10, r.h - 10), t: 0, drop: true });
}
// Thu hoạch: gặt luôn mọi ô đã chín trên ruộng (ô vừa bấm trước)
function harvest(i) {
  const ripe = [i];
  for (let j = 0; j < S.plotsOwned; j++) {
    const q = S.plots[j];
    if (j !== i && q.crop && q.prog >= CROPS[q.crop].grow) ripe.push(j);
  }
  const got = {};
  let xp = 0;
  ripe.forEach(j => {
    const p = S.plots[j], c = CROPS[p.crop], r = plotRect(j), n = c.yield || 1;
    addInv(p.crop, n); S.stats.harvest++;
    got[p.crop] = (got[p.crop] || 0) + n; xp += c.xp;
    floater(r.x + r.w / 2, r.y + 4, `+${n} ${c.icon}`, '#fff');
    Object.assign(p, { crop: null, prog: 0, wet: false, w2: false, fert: 1 });
  });
  const r = plotRect(i);
  gainXp(xp, r.x + r.w / 2, r.y);
  if (ripe.length > 1) toast(`🧺 Thu hoạch ${ripe.length} ô: ` + Object.entries(got).map(([k, n]) => `+${n} ${CROPS[k].icon}`).join(' '), 'good');
  SND.pop(); startAct('plant', '🧺');
}
function fertilize(i, fk) {
  const f = FERTS[fk], p = S.plots[i], r = plotRect(i);
  if (S.lv < f.lv) { toast(`${f.name} mở khoá ở cấp ${f.lv}`, 'bad'); return false; }
  if (p.fert >= f.mult) { floater(r.x + r.w / 2, r.y + 20, `Đã bón ${'x' + p.fert}`, '#fff'); return false; }
  if (!S.ferts[fk]) {                                   // hết phân -> tự mua 1 bao
    if (!spend(f.price)) return false;
    S.ferts[fk] = 1; floater(r.x + r.w / 2, r.y - 6, `Mua ${f.short} −${money(f.price)}`, '#ffcdd2');
  }
  S.ferts[fk]--; p.fert = f.mult;
  floater(r.x + r.w / 2, r.y + 20, `Tốc độ ${f.short}!`, f.color);
  SND.plant(); SND.pop(); startAct('plant', '🧪'); updateToolbar();
  return true;
}

// ----- Chăn nuôi -----
function penAction(type) {
  const a = ANIMALS[type], list = S.animals[type], pen = PENS[type];
  if (S.lv < a.lv) { toast(`${a.name} mở khoá ở cấp ${a.lv}`); return; }
  if (!list.length) { openShop('animals'); return; }
  let fed = 0, got = 0, waiting = Infinity, noFeed = false, noMoney = false;
  list.forEach(an => {
    if (an.st === 'ready') {
      addInv(a.product, 1); got++; gainXp(a.xp); an.st = 'hungry'; an.prog = 0;
    }
    if (an.st === 'hungry') {
      if (a.feedItem) {
        if ((S.inv[a.feedItem] || 0) < a.feedQty) { noFeed = true; return; }
      } else if (S.money < a.feed) { noMoney = true; return; }
      if (!useWater(WATER.animal)) return;
      if (a.feedItem) addInv(a.feedItem, -a.feedQty);
      else { S.money -= a.feed; S.stats.expense += a.feed; }
      an.st = 'busy'; an.prog = 0; fed++;
    } else if (an.st === 'busy') waiting = Math.min(waiting, a.time - an.prog);
  });
  const cx = pen.x + pen.w / 2, cy = pen.y + 20;
  if (noFeed) { const f = CROPS[a.feedItem]; toast(`Hết ${f.name.toLowerCase()}! Hãy trồng ${f.icon} ${f.name} để cho ${a.name.toLowerCase()} ăn`, 'bad'); SND.error(); }
  if (noMoney) toast('Không đủ tiền mua thức ăn!', 'bad');
  if (got) { floater(cx, cy, `+${got} ${PRODUCTS[a.product].icon} ${PRODUCTS[a.product].name}`, '#fff'); SND.pop(); }
  if (fed) {
    floater(cx, cy + 22, a.feedItem ? `Cho ăn ${fed} con −${fed * a.feedQty} ${CROPS[a.feedItem].icon}` : `Cho ăn ${fed} con −${money(fed * a.feed)}`, '#ffcdd2');
    SND[a.snd]();
  }
  if (!got && !fed && waiting < Infinity) floater(cx, cy, `Còn ${realDur(waiting)} nữa`, '#fff');
  startAct('plant', fed ? '🌾' : '🧺');
}

// ----- Đơn hàng -----
function availableItemKeys() {
  const keys = Object.keys(CROPS).filter(k => CROPS[k].lv <= S.lv);
  for (const t in ANIMALS) if (S.animals[t].length) keys.push(ANIMALS[t].product);
  return keys;
}
function genOffer() {
  if (S.offers.length >= MAX_OFFERS) return;
  const pool = availableItemKeys();
  const nTypes = Math.min(pool.length, randInt(1, Math.min(3, 1 + Math.floor(S.lv / 3))));
  const chosen = [];
  while (chosen.length < nTypes) { const k = pick(pool); if (!chosen.includes(k)) chosen.push(k); }
  const plots = S.plotsOwned;
  let est = 0;
  const items = chosen.map(k => {
    const it = ITEMS[k];
    const base = randInt(2, 4 + Math.floor(S.lv / 2));
    const qty = Math.max(1, Math.round(base * Math.min(1, 90 / it.time)));
    const unit = Math.round(it.sell * rand(1.2, 1.45) / 100) * 100;
    est += it.time * Math.ceil(qty / Math.max(1, plots / nTypes)) + 20;
    return { k, qty, unit };
  });
  const sub = items.reduce((s, it) => s + it.qty * it.unit, 0);
  const xp = Math.round(items.reduce((s, it) => s + it.qty * ITEMS[it.k].xp, 0) * 0.8) + 5;
  const window = clamp(Math.round((est * 1.5 + 90) / 10) * 10, 120, 1100);
  S.offers.push({ id: S.nextId++, partner: pick(PARTNERS), items, sub, xp, window, expires: nowAbs() + 180 });
  updateBadge();
}
function canDeliver(o) { return o.items.every(it => (S.inv[it.k] || 0) >= it.qty); }
function lateInfo(o) {
  const late = nowAbs() - o.deadline;
  if (late <= 0) return { late: 0, rate: 0 };
  return { late, rate: Math.min(LATE_MAX, Math.ceil(late / 60) * LATE_STEP) };
}
function acceptOffer(id) {
  if (S.orders.length >= MAX_ORDERS) { toast(`Chỉ nhận tối đa ${MAX_ORDERS} đơn cùng lúc`, 'bad'); SND.error(); return; }
  const i = S.offers.findIndex(o => o.id === id); if (i < 0) return;
  const o = S.offers.splice(i, 1)[0];
  o.accepted = nowAbs(); o.deadline = nowAbs() + o.window;
  S.orders.push(o); SND.coin(); toast(`Đã nhận đơn của ${o.partner}. Hạn giao: ${absLabel(o.deadline)}`, 'good');
  updateBadge(); openOrders('active');
}
function declineOffer(id) { S.offers = S.offers.filter(o => o.id !== id); SND.click(); updateBadge(); openOrders('offers'); }
function deliverOrder(id) {
  const o = S.orders.find(x => x.id === id); if (!o || !canDeliver(o)) return;
  o.items.forEach(it => addInv(it.k, -it.qty));
  S.orders = S.orders.filter(x => x !== o);
  const { late, rate } = lateInfo(o);
  const vat = Math.round(o.sub * VAT);
  const total = o.sub + vat;
  const penalty = Math.round(total * rate);
  const received = total - penalty;
  const xp = late > 0 ? Math.floor(o.xp / 2) : o.xp;
  earn(received); S.stats.delivered++;
  const inv = { no: S.invoiceNo++, at: nowAbs(), o, vat, total, penalty, rate, late, received, xp };
  SND.coin(); gainXp(xp);
  showInvoice(inv); saveGame();
}
function cancelOrder(id) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  const fee = Math.round(o.sub * CANCEL_FEE);
  if (!confirm(`Huỷ đơn của ${o.partner}? Bạn sẽ bị phạt huỷ hợp đồng ${money(fee)}.`)) return;
  S.orders = S.orders.filter(x => x !== o);
  S.money = Math.max(0, S.money - fee); S.stats.expense += fee;
  toast(`Đã huỷ đơn — phạt ${money(fee)}`, 'bad'); SND.error(); openOrders('active');
}

/* =========================================================
   CẬP NHẬT
   ========================================================= */
/* ----- Câu cá -----
   Bấm vào ao -> đi ra mép ao -> quăng câu -> chờ phao chìm (❗) -> bấm ao / phím Space trong khoảng
   thời gian của cần câu để giật. Bấm chỗ khác khi chưa có cá cắn thì thôi câu (được trả lại mồi). */
const inPond = (x, y, k = 1) => ((x - POND.x) / (POND.rx * k)) ** 2 + ((y - POND.y) / (POND.ry * k)) ** 2 <= 1;
function fishSpot(px, py) {
  // phao: điểm bấm, kéo vào trong lòng ao; chỗ đứng: mép ao phía nhân vật
  let bx = px, by = py;
  if (!inPond(bx, by, 0.8)) { const a = Math.atan2((by - POND.y) / POND.ry, (bx - POND.x) / POND.rx); bx = POND.x + Math.cos(a) * POND.rx * 0.75; by = POND.y + Math.sin(a) * POND.ry * 0.75; }
  const a = Math.atan2((R.char.y - POND.y) / (POND.ry + 30), (R.char.x - POND.x) / (POND.rx + 30));
  const sx = clamp(POND.x + Math.cos(a) * (POND.rx + 26), 24, W - 24), sy = clamp(POND.y + Math.sin(a) * (POND.ry + 22), 196, H - 6);
  return { bx, by, sx, sy };
}
function goFishing(px, py) {
  const rod = RODS[S.rod];
  if (!rod) { toast('Bạn cần mua 🎣 cần câu ở Cửa hàng trước', 'bad'); openShop('fish'); return; }
  if (S.fishLeft <= 0) { toast('Hôm nay ao đã hết cá, mai quay lại nhé 🐟'); return; }
  const sp = fishSpot(px, py);
  R.queue = []; R.char.tx = null; R.fish = null;
  R.queue.push({ at: performance.now(), key: 'fish', x: sp.sx, y: sp.sy, fn: () => castLine(sp) });
}
function castLine(sp) {
  if (S.fishLeft <= 0) return;
  if (!S.bait) {                                   // hết mồi -> tự mua 1
    if (!spend(BAIT_PRICE)) return;
    floater(R.char.x, R.char.y - 110, `Mua mồi −${money(BAIT_PRICE)}`, '#ffcdd2');
  } else S.bait--;
  R.char.dir = sp.bx >= R.char.x ? 1 : -1; R.char.face = R.char.dir > 0 ? 'right' : 'left';
  R.fish = { phase: 'cast', t: 0, biteAt: rand(2.5, 7), bx: sp.bx, by: sp.by, win: RODS[S.rod].window };
  SND.cast();
}
function stopFishing(refund) {
  if (!R.fish) return;
  if (refund && R.fish.phase !== 'bite') S.bait++;
  R.fish = null;
}
function rollFish() {
  const rod = RODS[S.rod], pool = Object.entries(FISH).filter(([, f]) => f.lv <= S.lv);
  const wt = f => f.w * (f.sell >= 8000 ? rod.rare : 1);
  let r = Math.random() * pool.reduce((s, [, f]) => s + wt(f), 0);
  for (const [k, f] of pool) { r -= wt(f); if (r <= 0) return k; }
  return pool[0][0];
}
function tryHook() {
  const f = R.fish; if (!f) return false;
  if (f.phase !== 'bite') { floater(f.bx, f.by - 30, 'Chờ phao chìm đã!', '#fff'); return true; }
  const k = rollFish(), fi = FISH[k];
  addInv(k, 1); S.fishLeft--; S.stats.fish = (S.stats.fish || 0) + 1;
  floater(f.bx, f.by - 20, `+1 ${fi.icon} ${fi.name} (${money(fi.sell)})`, '#fff');
  if (fi.xp) gainXp(fi.xp, R.char.x, R.char.y - 100);
  if (fi.sell >= 30000) { toast(`🎉 Câu được ${fi.icon} ${fi.name}! Bán được ${money(fi.sell)}`, 'big'); SND.levelup(); }
  else if (k === 'giay_cu') toast('👢 Ôi, câu phải chiếc giày cũ...');
  SND.splash();
  for (let i = 0; i < 6; i++) R.ripples.push({ x: f.bx + rand(-12, 12), y: f.by + rand(-6, 6), t: 0 });
  R.fish = null;
  if (S.fishLeft > 0) floater(R.char.x, R.char.y - 125, `🎣 Còn ${S.fishLeft} lượt hôm nay`, '#e3f2fd');
  return true;
}
function updateFishing(dt) {
  const f = R.fish; if (!f) return;
  if ((window.COOP_VISIT && COOP_VISIT.active) || R.queue.length || R.char.tx !== null || R.char.moving) { stopFishing(true); return; }
  f.t += dt;
  if (f.phase === 'cast' && f.t > 0.45) { f.phase = 'wait'; f.t = 0; R.ripples.push({ x: f.bx, y: f.by, t: 0 }); SND.plop(); }
  else if (f.phase === 'wait' && f.t > f.biteAt) { f.phase = 'bite'; f.t = 0; SND.plop(); SND.plop(0.12); }
  else if (f.phase === 'bite' && f.t > f.win) {
    floater(f.bx, f.by - 20, 'Cá chạy mất rồi! 💨', '#ffcdd2'); SND.error(); R.fish = null;
  }
}
function drawFishing() {
  const f = R.fish; if (!f) return;
  const ch = R.char, d = ch.dir, hx = ch.x + d * 10, hy = ch.y - 58, tx = ch.x + d * 52, ty = ch.y - 112;
  ctx.strokeStyle = '#7a4a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke();
  // phao bay ra khi quăng, chìm xuống khi cá cắn
  const k = f.phase === 'cast' ? Math.min(1, f.t / 0.45) : 1;
  const bob = f.phase === 'bite' ? 4 + Math.sin(f.t * 30) * 3 : Math.sin(R.time * 3) * 1.2;
  const bx = tx + (f.bx - tx) * k, by = ty + (f.by - ty) * k - Math.sin(k * Math.PI) * 40 + bob;
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo((tx + bx) / 2, Math.max(ty, by) + 20, bx, by); ctx.stroke();
  ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(bx, by - 2, 5, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by - 2, 5, 0, Math.PI); ctx.fill();
  if (f.phase === 'bite') {
    bubble(f.bx, f.by - 34 - Math.abs(Math.sin(f.t * 12)) * 4, '❗');
    ctx.fillStyle = '#ffeb3b'; ctx.fillRect(f.bx - 22, f.by - 58, 44 * (1 - f.t / f.win), 5);
  }
}
Object.assign(SND, {
  cast() { this.sweep(1400, 300, 0.35, 'sine', 0.12); this.noiseBurst(0.3, 2500, 1, 0.12); },
  plop(t0 = 0) { this.sweep(420, 130, 0.12, 'sine', 0.35, t0); },
  splash() { this.noiseBurst(0.5, 900, 0.7, 0.35); for (let i = 0; i < 5; i++) this.sweep(rand(400, 800), rand(900, 1400), 0.06, 'sine', 0.12, i * 0.07); },
});

function update(dt) {
  R.time += dt;
  updateChar(dt);
  updateAmbient(dt);
  if (!R.started || R.paused || R.portrait || S.dayOver) return;
  updateFishing(dt);

  const g = dt * GM_PER_SEC;
  S.min += g;
  if (S.min >= DAY_MIN) { S.min = DAY_MIN; S.dayOver = true; showDayEnd(); }

  // cây lớn
  S.plots.forEach(p => {
    if (!p.crop || !p.wet) return;
    const c = CROPS[p.crop];
    if (p.prog >= c.grow) return;
    p.prog = Math.min(c.grow, p.prog + g * p.fert);
    if (!p.w2 && p.prog >= c.grow / 2 && p.prog < c.grow) { p.w2 = true; p.wet = false; } // khát nước giữa chừng
  });
  // gia súc
  for (const t in S.animals) S.animals[t].forEach(an => {
    if (an.st !== 'busy') return;
    an.prog += g; if (an.prog >= ANIMALS[t].time) { an.st = 'ready'; an.prog = ANIMALS[t].time; }
  });
  // đơn hàng
  const now = nowAbs();
  if (now >= S.nextOfferAt) { genOffer(); S.nextOfferAt = now + randInt(40, 75); }
  const before = S.offers.length;
  S.offers = S.offers.filter(o => o.expires > now);
  if (S.offers.length !== before) updateBadge();
  S.orders.slice().forEach(o => {
    if (now - o.deadline > LATE_GRACE) {
      const fee = Math.round(o.sub * CANCEL_FEE);
      S.orders = S.orders.filter(x => x !== o);
      S.money = Math.max(0, S.money - fee); S.stats.expense += fee;
      toast(`❌ Đơn của ${o.partner} bị huỷ do trễ quá ${LATE_GRACE / 60}h — phạt ${money(fee)}`, 'bad'); SND.error();
    } else if (!o.warned && o.deadline - now < 60 && o.deadline > now) {
      o.warned = true; toast(`⏰ Đơn của ${o.partner} còn dưới 1 giờ!`, 'bad');
    }
  });

  R.saveT += dt; if (R.saveT > 10) { R.saveT = 0; saveGame(); }
}

// Bắt đầu một hành động (gieo/tưới/thu hoạch...): chạy trọn hoạt ảnh rồi mới đi tiếp
function startAct(kind, icon) {
  const ch = R.char, full = S && OUTFIT_ANIM[S.outfit].full;
  ch.anim = kind; ch.animT = 0; ch.actIcon = icon;
  if (full) { ch.face = ch.dir < 0 ? 'left' : 'right'; ch.act = ANIM_FULL[kind + '_left'][1] / ACT_FPS[kind]; }
  else ch.act = 0.45;
}
function faceFrom(dx, dy) {
  return Math.abs(dx) > Math.abs(dy) * 0.9 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

function updateChar(dt) {
  const ch = R.char;
  let vx = 0, vy = 0, moved = 0;
  const k = R.keys;
  if (!R.modal && R.started) {
    if (k.ArrowLeft || k.a) vx -= 1; if (k.ArrowRight || k.d) vx += 1;
    if (k.ArrowUp || k.w) vy -= 1; if (k.ArrowDown || k.s) vy += 1;
  }
  const speed = 230;
  if (ch.act > 0) {
    ch.act -= dt; ch.animT += dt;
    if (ch.act <= 0) { ch.act = 0; ch.anim = null; }
  }
  if (R.modal || ch.act > 0) { /* đứng yên khi mở hộp thoại hoặc đang làm việc */ }
  else if (vx || vy) {
    R.queue = []; ch.tx = null;
    const l = Math.hypot(vx, vy); ch.x += vx / l * speed * dt; ch.y += vy / l * speed * dt; moved = speed * dt;
    if (vx) ch.dir = vx > 0 ? 1 : -1;
    ch.face = faceFrom(vx, vy);
  } else {
    const tgt = R.queue[0] || (ch.tx !== null ? { x: ch.tx, y: ch.ty } : null);
    if (tgt) {
      const dx = tgt.x - ch.x, dy = tgt.y - ch.y, d = Math.hypot(dx, dy);
      if (d < 5) {
        ch.x = tgt.x; ch.y = tgt.y;
        if (R.queue[0] === tgt) { R.queue.shift(); if (!R.paused && !S.dayOver) tgt.fn(); }
        else ch.tx = null;
      } else {
        const step = Math.min(d, speed * dt); ch.x += dx / d * step; ch.y += dy / d * step; moved = step;
        if (Math.abs(dx) > 2) ch.dir = dx > 0 ? 1 : -1;
        if (d > 8) ch.face = faceFrom(dx, dy);
      }
    }
  }
  ch.x = clamp(ch.x, 24, W - 24); ch.y = clamp(ch.y, 196, H - 6);
  ch.moving = moved > 0;
  ch.phase = ch.moving ? ch.phase + moved / STRIDE_PX : 0;

  // chó đi dạo
  const dg = R.dog; dg.t -= dt;
  if (dg.t <= 0) { dg.tx = rand(40, 260); dg.ty = rand(350, 392); dg.t = rand(3, 7); }
  const ddx = dg.tx - dg.x, ddy = dg.ty - dg.y, dd = Math.hypot(ddx, ddy);
  if (dd > 2) { dg.x += ddx / dd * 40 * dt; dg.y += ddy / dd * 40 * dt; dg.dir = ddx > 0 ? -1 : 1; }

  // gia súc đi lại
  for (const t in R.animPos) {
    const pen = PENS[t];
    R.animPos[t].forEach(a => {
      a.t -= dt;
      if (a.t <= 0) { a.tx = rand(pen.x + 30, pen.x + pen.w - 30); a.ty = rand(pen.y + 34, pen.y + pen.h - 22); a.t = rand(2, 6); }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      if (d > 2) { a.x += dx / d * 22 * dt; a.y += dy / d * 22 * dt; a.dir = dx > 0 ? -1 : 1; a.moving = true; } else a.moving = false;
    });
  }
}
function rebuildAnimPos() {
  for (const t in PENS) {
    const pen = PENS[t], n = S ? S.animals[t].length : 0;
    R.animPos[t] = R.animPos[t] || [];
    while (R.animPos[t].length < n) R.animPos[t].push({ x: rand(pen.x + 30, pen.x + pen.w - 30), y: rand(pen.y + 34, pen.y + pen.h - 22), tx: 0, ty: 0, t: 0, dir: 1 });
    R.animPos[t].length = n;
  }
}

function updateAmbient(dt) {
  // mây
  if (R.clouds.length === 0) for (let i = 0; i < 5; i++) R.clouds.push({ x: rand(0, W), y: rand(20, 90), s: rand(0.6, 1.2), v: rand(6, 14) });
  R.clouds.forEach(c => { c.x += c.v * dt; if (c.x > W + 120) { c.x = -140; c.y = rand(20, 90); } });
  // chim bay & ripples
  R.birds.forEach(b => { b.x += b.v * dt; b.f += dt * 10; }); R.birds = R.birds.filter(b => b.x < W + 40);
  R.ripples.forEach(r => r.t += dt); R.ripples = R.ripples.filter(r => r.t < (r.drop ? 0.7 : 2.2));
  if (Math.random() < dt * 0.8) R.ripples.push({ x: POND.x + rand(-POND.rx * 0.7, POND.rx * 0.7), y: POND.y + rand(-POND.ry * 0.6, POND.ry * 0.6), t: 0 });
  R.floaters.forEach(f => { f.life -= dt; f.y -= 28 * dt; }); R.floaters = R.floaters.filter(f => f.life > 0);
  if (!R.started || !S) return;
  // âm thanh môi trường
  const d = Math.hypot((R.char.x - POND.x) / 1.4, R.char.y - POND.y);
  SND.setPond(clamp(1 - d / 520, 0, 1) * 0.09 + 0.008);
  if (R.paused || S.dayOver) return;
  R.birdT -= dt;
  if (R.birdT <= 0) { SND.bird(); R.birdT = rand(7, 18); if (Math.random() < 0.6) R.birds.push({ x: -30, y: rand(30, 110), v: rand(60, 110), f: 0 }); }
  R.animalSndT -= dt;
  if (R.animalSndT <= 0) {
    R.animalSndT = rand(12, 25);
    const owned = Object.keys(S.animals).filter(t => S.animals[t].length);
    if (owned.length) SND[ANIMALS[pick(owned)].snd]();
    else if (Math.random() < 0.3) SND.rooster();
  }
}

/* =========================================================
   VẼ
   ========================================================= */
function updateCam(dt) {
  const c = R.cam, tz = R.started && S ? (S.ui.zoom || 1) : 1;
  c.z += (tz - c.z) * Math.min(1, dt * 8);
  if (Math.abs(tz - c.z) < 0.002) c.z = tz;
  const vw = W / c.z, vh = H / c.z;
  // bám theo nhân vật, không cho nhìn ra ngoài bản đồ
  c.x = clamp(R.char.x - vw / 2, 0, W - vw);
  c.y = clamp(R.char.y - 50 - vh / 2, 0, H - vh);
}

function draw() {
  const cam = R.cam;
  ctx.setTransform(cam.z, 0, 0, cam.z, -cam.x * cam.z, -cam.y * cam.z);
  ctx.drawImage(R.bg, 0, 0);
  // mây
  R.clouds.forEach(c => {
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath();
    ctx.ellipse(c.x, c.y, 50 * c.s, 18 * c.s, 0, 0, 7); ctx.ellipse(c.x + 30 * c.s, c.y - 10 * c.s, 32 * c.s, 18 * c.s, 0, 0, 7); ctx.ellipse(c.x - 28 * c.s, c.y - 6 * c.s, 26 * c.s, 14 * c.s, 0, 0, 7); ctx.fill();
  });
  // chim bay
  ctx.strokeStyle = '#3c3c3c'; ctx.lineWidth = 2;
  R.birds.forEach(b => { const w = Math.sin(b.f) * 5; ctx.beginPath(); ctx.moveTo(b.x - 8, b.y - w); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + 8, b.y - w); ctx.stroke(); });
  // gợn nước ao
  R.ripples.forEach(r => {
    if (r.drop) { ctx.fillStyle = `rgba(120,190,255,${1 - r.t / 0.7})`; ctx.beginPath(); ctx.arc(r.x, r.y - (0.7 - r.t) * 30, 3, 0, 7); ctx.fill(); return; }
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - r.t / 2.2)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(r.x, r.y, 4 + r.t * 14, 2 + r.t * 5, 0, 0, 7); ctx.stroke();
  });
  if (!S) { ctx.setTransform(1, 0, 0, 1, 0, 0); return; }
  drawPlots();
  drawPens();
  drawBuildLabels();
  // chó
  emoji(ctx, '🐕', R.dog.x, R.dog.y - 14 + (Math.abs(Math.sin(R.time * 8)) * -2), 30, R.dog.dir < 0);
  drawQueueMarks();
  drawChar();
  drawFishing();
  (R.overlays || []).forEach(f => f());
  // chữ bay
  R.floaters.forEach(f => {
    ctx.globalAlpha = clamp(f.life, 0, 1); ctx.font = 'bold 17px "Baloo 2",sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(60,30,10,.8)'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); ctx.globalAlpha = 1;
  });
  // ánh chiều tà (phủ toàn màn hình, không theo camera)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const m = S.min;
  if (m > 480) { const a = clamp((m - 480) / 180, 0, 1); ctx.fillStyle = `rgba(255,120,40,${a * 0.22})`; ctx.fillRect(0, 0, W, H); ctx.fillStyle = `rgba(40,20,80,${a * 0.12})`; ctx.fillRect(0, 0, W, H); }
  else if (m < 40) { ctx.fillStyle = `rgba(255,220,150,${(1 - m / 40) * 0.18})`; ctx.fillRect(0, 0, W, H); }
}

function pill(x, y, text, bg, fg = '#fff') {
  ctx.font = 'bold 13px "Baloo 2",sans-serif'; ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 14;
  ctx.fillStyle = bg; rr(ctx, x - w / 2, y - 10, w, 19, 9); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = fg; ctx.fillText(text, x, y + 4);
}

function drawPlots() {
  const n = S.plotsOwned, overlays = [];
  for (let i = 0; i < 24; i++) {
    const r = plotRect(i), p = S.plots[i];
    if (i >= n) {
      const buyable = i === n && S.lv >= lvForPlot(i);
      const hov = R.hover && R.hover.type === 'plot' && R.hover.i === i;
      ctx.fillStyle = buyable ? (hov ? '#b9e58f' : '#a5dc78') : '#86c860'; rr(ctx, r.x, r.y, r.w, r.h, 8); ctx.fill();
      ctx.setLineDash([5, 4]); ctx.strokeStyle = buyable ? '#fff59d' : 'rgba(80,60,30,.35)'; ctx.lineWidth = buyable ? 3 : 2; ctx.stroke(); ctx.setLineDash([]);
      ctx.textAlign = 'center';
      if (buyable) {
        const b = Math.sin(R.time * 3) * 2;
        emoji(ctx, '🪧', r.x + r.w / 2, r.y + 20 + b, 22);
        ctx.font = 'bold 12px "Baloo 2",sans-serif'; ctx.fillStyle = '#5a3416';
        ctx.fillText(money(plotPrice(i)), r.x + r.w / 2, r.y + r.h - 10);
      } else {
        ctx.fillStyle = 'rgba(80,60,30,.55)'; ctx.font = 'bold 12px "Baloo 2",sans-serif';
        ctx.fillText(S.lv >= lvForPlot(i) ? '🔒 ' + money(plotPrice(i)) : '🔒 Lv ' + lvForPlot(i), r.x + r.w / 2, r.y + r.h / 2 + 4);
      }
      continue;
    }
    // đất
    ctx.fillStyle = p.crop && p.wet ? '#6a4126' : '#a06d41'; rr(ctx, r.x, r.y, r.w, r.h, 8); ctx.fill();
    ctx.strokeStyle = p.crop && p.wet ? '#55331d' : '#8a5a33'; ctx.lineWidth = 2;
    for (let j = 1; j < 4; j++) { ctx.beginPath(); ctx.moveTo(r.x + 6, r.y + j * r.h / 4); ctx.lineTo(r.x + r.w - 6, r.y + j * r.h / 4); ctx.stroke(); }
    if (R.hover && R.hover.type === 'plot' && R.hover.i === i) { ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 3; rr(ctx, r.x, r.y, r.w, r.h, 8); ctx.stroke(); }
    if (!p.crop) continue;
    const c = CROPS[p.crop], st = p.prog / c.grow, cx = r.x + r.w / 2, by = r.y + r.h - 12;
    if (st < 0.3) {
      ctx.strokeStyle = '#7cd35a'; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) { const x = r.x + 16 + k * 19; ctx.beginPath(); ctx.moveTo(x, by); ctx.quadraticCurveTo(x - 5, by - 10, x - 7, by - 14); ctx.moveTo(x, by); ctx.quadraticCurveTo(x + 5, by - 10, x + 7, by - 14); ctx.stroke(); }
    } else {
      const s = st >= 1 ? 1 : 0.45 + st * 0.5, sway = Math.sin(R.time * 2 + i) * 2;
      ctx.fillStyle = c.leaf;
      for (let k = 0; k < 3; k++) {
        const x = r.x + 16 + k * 19;
        ctx.beginPath(); ctx.ellipse(x - 6 * s + sway, by - 12 * s, 6 * s, 13 * s, -0.5, 0, 7); ctx.ellipse(x + 6 * s + sway, by - 12 * s, 6 * s, 13 * s, 0.5, 0, 7); ctx.fill();
      }
      if (st >= 1) {
        const b = Math.abs(Math.sin(R.time * 3 + i)) * 3;
        emoji(ctx, c.icon, cx, r.y + r.h / 2 - 4 - b, 30);
        if (Math.sin(R.time * 4 + i * 1.7) > 0.7) emoji(ctx, '✨', r.x + r.w - 12, r.y + 10, 14);
      } else if (st > 0.6) emoji(ctx, c.icon, cx, by - 22 * s, 16 * s);
    }
    if (st < 1) {
      if (!p.wet) overlays.push(() => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r.x + r.w - 10, r.y + 6, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#64b5f6'; ctx.lineWidth = 2; ctx.stroke(); emoji(ctx, '💧', r.x + r.w - 10, r.y + 7 + Math.sin(R.time * 5) * 1.5, 16); });
      else overlays.push(() => pill(cx, r.y - 2, realDur((c.grow - p.prog) / p.fert), p.fert > 1 ? FERTS['f' + p.fert].color : '#43a047'));
      if (p.fert > 1) overlays.push(() => pill(r.x + 12, r.y + r.h - 8, 'x' + p.fert, FERTS['f' + p.fert].color));
    }
  }
  R.overlays = overlays; // vẽ sau nhân vật để không bị che
}

function drawPens() {
  for (const t in PENS) {
    const pen = PENS[t], a = ANIMALS[t], list = S.animals[t];
    const locked = S.lv < a.lv;
    // biển tên
    ctx.fillStyle = '#7a4a22'; rr(ctx, pen.x + 8, pen.y - 16, 126, 22, 6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Baloo 2",sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`${a.icon} ${a.name} ${locked ? '🔒Lv ' + a.lv : list.length + '/' + penCap(S.lv)}`, pen.x + 14, pen.y);
    if (R.hover && R.hover.type === 'pen' && R.hover.t === t) { ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 3; rr(ctx, pen.x - 4, pen.y - 4, pen.w + 8, pen.h + 8, 8); ctx.stroke(); }
    if (locked) { ctx.fillStyle = 'rgba(60,40,20,.25)'; rr(ctx, pen.x, pen.y, pen.w, pen.h, 6); ctx.fill(); continue; }
    if (!list.length) { ctx.fillStyle = 'rgba(80,50,20,.6)'; ctx.font = 'bold 14px "Baloo 2",sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Bấm để mua ' + a.name.toLowerCase(), pen.x + pen.w / 2, pen.y + pen.h / 2 + 4); continue; }
    const pos = R.animPos[t] || [];
    list.map((an, i) => ({ an, p: pos[i] })).filter(o => o.p).sort((u, v) => u.p.y - v.p.y).forEach(({ an, p }) => {
      const bob = p.moving ? Math.abs(Math.sin(R.time * 9 + p.x)) * 3 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 15, 5, 0, 0, 7); ctx.fill();
      const size = t === 'ga' || t === 'vit' ? 30 : 40;
      emoji(ctx, a.icon, p.x, p.y - size / 2 - bob, size, p.dir < 0);
      const top = p.y - size - 12;
      if (an.st === 'hungry') bubble(p.x, top, '🌾');
      else if (an.st === 'ready') bubble(p.x, top - Math.abs(Math.sin(R.time * 3)) * 3, PRODUCTS[a.product].icon);
      else { ctx.fillStyle = 'rgba(0,0,0,.35)'; rr(ctx, p.x - 16, top + 6, 32, 6, 3); ctx.fill(); ctx.fillStyle = '#ffca28'; rr(ctx, p.x - 16, top + 6, 32 * an.prog / a.time, 6, 3); ctx.fill(); }
    });
  }
}
function bubble(x, y, e) {
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.moveTo(x - 4, y + 11); ctx.lineTo(x, y + 18); ctx.lineTo(x + 4, y + 11); ctx.fill();
  ctx.strokeStyle = '#d8bf95'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 13, 0, 7); ctx.stroke();
  emoji(ctx, e, x, y + 1, 16);
}
function drawBuildLabels() {
  const hov = R.hover && R.hover.type === 'build' ? R.hover.k : null;
  for (const k in BUILD) {
    const b = BUILD[k];
    if (hov === k) { ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 3; rr(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 10); ctx.stroke(); }
  }
  // bể nước: mức nước
  const wb = BUILD.well, ratio = S.water / WATER.cap;
  ctx.fillStyle = 'rgba(0,0,0,.4)'; rr(ctx, wb.x + 2, wb.y + 82, 66, 10, 5); ctx.fill();
  ctx.fillStyle = S.water < WATER.low ? '#ef5350' : '#42a5f5'; rr(ctx, wb.x + 2, wb.y + 82, 66 * ratio, 10, 5); ctx.fill();
  pill(wb.x + 35, wb.y + 106, `💧 ${S.water.toFixed(2)} m³`, S.water < WATER.low ? '#e53935' : '#1e88e5');
  // hộp thư có thư mới
  if (S.offers.length) { const mb = BUILD.mailbox; bubble(mb.x + 23, mb.y - 20 - Math.abs(Math.sin(R.time * 3)) * 4, '✉️'); }
  pill(BUILD.house.x + 91, BUILD.house.y + 162, '📦 vào kho', '#8a5a33');
}

function drawQueueMarks() {
  R.queue.forEach(q => { if (q.mark) { ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; rr(ctx, q.mark.x + 2, q.mark.y + 2, q.mark.w - 4, q.mark.h - 4, 7); ctx.stroke(); ctx.setLineDash([]); } });
}

// Chọn hàng & frame của sprite sheet theo trạng thái nhân vật
function charFrame() {
  const ch = R.char, oa = OUTFIT_ANIM[S.outfit];
  if (oa.full) {
    if (ch.anim) {
      const side = ch.face === 'left' ? 'left' : 'right', [row, n] = ANIM_FULL[ch.anim + '_' + side];
      return { row, col: Math.min(n - 1, Math.floor(ch.animT * ACT_FPS[ch.anim])) };
    }
    if (ch.moving) { const [row, n] = ANIM_FULL['walk_' + ch.face]; return { row, col: Math.floor(ch.phase) % n }; }
    return { row: ANIM_FULL['idle_' + ch.face][0], col: IDLE_SEQ[Math.floor(R.time * IDLE_FPS) % IDLE_SEQ.length] };
  }
  // bộ chỉ có hướng xuống: dùng chung cho mọi hướng
  if (ch.moving) return { row: ANIM_LITE.walk_down[0], col: Math.floor(ch.phase) % ANIM_LITE.walk_down[1] };
  return { row: ANIM_LITE.idle_down[0], col: IDLE_SEQ[Math.floor(R.time * IDLE_FPS) % IDLE_SEQ.length] };
}

function drawChar() {
  const ch = R.char, sheet = R.sheets[S.outfit], oa = OUTFIT_ANIM[S.outfit];
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(ch.x, ch.y, 20, 6, 0, 0, 7); ctx.fill();
  if (sheet) {
    const f = charFrame(), k = CHAR_SIZE / CELL;
    ctx.save(); ctx.translate(ch.x, ch.y);
    if (!oa.full) {
      // bộ không có frame quay ngang: nghiêng nhẹ theo hướng đi, nhún khi làm việc
      if (ch.moving && (ch.face === 'left' || ch.face === 'right')) ctx.rotate((ch.face === 'left' ? -1 : 1) * 0.06);
      if (ch.act > 0) { const sq = Math.sin((1 - ch.act / 0.45) * Math.PI); ctx.scale(1 + sq * 0.04, 1 - sq * 0.08); }
    }
    ctx.drawImage(sheet, f.col * CELL, f.row * CELL, CELL, CELL, -oa.cx * k, -FEET_Y * k, CELL * k, CELL * k);
    ctx.restore();
  } else {
    // dự phòng khi chưa tải được sprite sheet: dùng ảnh tĩnh
    const img = R.imgs[S.outfit], h = 104, w = img && img.width ? img.width / img.height * h : 40;
    if (img) { ctx.save(); ctx.translate(ch.x, ch.y); ctx.scale(ch.dir < 0 ? -1 : 1, 1); ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore(); }
  }
  // biểu tượng dụng cụ: bộ đầy đủ đã có bình tưới / cây trong hoạt ảnh nên chỉ hiện cho việc khác
  const ownProp = oa.full && (ch.actIcon === '🌱' || ch.actIcon === '🚿');
  if (ch.act > 0 && ch.actIcon && !ownProp) emoji(ctx, ch.actIcon, ch.x + ch.dir * 30, ch.y - 70 + Math.sin(ch.animT * 12) * 3, 22, ch.dir < 0);
  // biển tên gỗ dưới chân như ảnh mẫu
  ctx.font = 'bold 14px "Baloo 2",sans-serif'; ctx.textAlign = 'center';
  const tw = ctx.measureText(S.name).width + 18;
  ctx.fillStyle = '#7a4a22'; rr(ctx, ch.x - tw / 2, ch.y + 6, tw, 20, 5); ctx.fill();
  ctx.fillStyle = '#e8b96a'; rr(ctx, ch.x - tw / 2 + 2, ch.y + 8, tw - 4, 16, 4); ctx.fill();
  ctx.fillStyle = '#5a3416'; ctx.fillText(S.name, ch.x, ch.y + 21);
}

function drawAvatar() {
  const a = $('#avatarCv').getContext('2d'), img = R.imgs[S.outfit];
  a.clearRect(0, 0, 72, 72); a.fillStyle = '#ffe9ef'; a.fillRect(0, 0, 72, 72);
  if (img) { const s = img.width * 0.78; a.drawImage(img, (img.width - s) / 2, 0, s, s, 0, 2, 72, 72); }
}

/* =========================================================
   GIAO DIỆN (HUD, modal)
   ========================================================= */
function updateHUD(force) {
  $('#hudName').textContent = S.name;
  $('#hudLv').textContent = 'Lv ' + S.lv;
  $('#hudXp').style.width = (S.xp / xpNeed(S.lv) * 100) + '%';
  $('#hudXpText').textContent = `${S.xp}/${xpNeed(S.lv)} XP`;
  $('#hudWater').textContent = S.water.toFixed(2);
  $('#hudWaterRow').classList.toggle('low', S.water < WATER.low);
  $('#hudTime').textContent = clock(S.min);
  $('#hudDay').textContent = S.day;
  $('#hudMoney').textContent = money(S.money);
  // theo dõi đơn hàng
  const now = nowAbs();
  const ready = S.orders.filter(canDeliver).length, late = S.orders.filter(o => o.deadline < now).length;
  $('#tracker').classList.toggle('empty', !S.orders.length);
  $('#trkTitle').textContent = `📋 ${S.orders.length} đơn` + (ready ? ` · ✅${ready}` : '') + (late ? ` · ⚠️${late}` : '');
  $('#trkList').innerHTML = S.orders.map(o => {
    const ok = canDeliver(o), left = o.deadline - now;
    return `<div class="trk ${ok ? 'ok' : ''} ${left < 0 ? 'late' : ''}" data-open="orders"><b>${esc(o.partner)}</b> ${ok ? '✅ Sẵn sàng giao' : ''}
      <div class="items">${o.items.map(it => `${ITEMS[it.k].icon}${Math.min(S.inv[it.k] || 0, it.qty)}/${it.qty}`).join(' · ')}</div>
      <div>${left >= 0 ? '⏳ Còn ' + gameDur(left) + ' (≈' + realDur(left) + ')' : '⚠️ Trễ ' + gameDur(-left) + ' · phạt ' + Math.round(lateInfo(o).rate * 100) + '%'}</div></div>`;
  }).join('');
}
function updateBadge() { const b = $('#ordersBadge'); b.textContent = S.offers.length; b.classList.toggle('zero', !S.offers.length); }
function updateToolbar() {
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === S.tool));
  $('#toolSeedIcon').textContent = CROPS[S.seed].icon; $('#toolSeedName').textContent = CROPS[S.seed].name;
  $('#toolFertName').textContent = `${FERTS[S.fert].short} (${S.ferts[S.fert] || 0})`;
  updateBadge();
}

function openModal(title, html, opts = {}) {
  R.modal = opts.kind || 'generic'; R.paused = true;
  $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html;
  $('#modal').classList.toggle('narrow', !!opts.narrow);
  $('#modalClose').classList.toggle('hidden', !!opts.noClose);
  $('#modalBg').classList.remove('hidden');
}
function closeModal() {
  if (S && S.dayOver) return;
  $('#modalBg').classList.add('hidden'); R.modal = null; R.paused = false; updateToolbar(); updateHUD(true);
}

function openSeedPicker() {
  const html = `<p class="muted">Chọn hạt giống để gieo (tiền hạt được trừ khi gieo). Thời gian hiển thị là thời gian thật.</p><div class="grid">` +
    Object.entries(CROPS).map(([k, c]) => {
      const lock = S.lv < c.lv;
      return `<div class="card ${lock ? 'locked' : ''} ${S.seed === k ? 'sel' : ''}"><div class="ic">${c.icon}</div><div class="nm">${c.name}</div>
        <div class="meta">Hạt: ${money(c.seed)} · Bán: ${money(c.sell)}${c.yield > 1 ? ` · thu ${c.yield}` : ''}<br>⏱ ${realDur(c.grow)} · +${c.xp} XP${c.note ? `<br>🐔 ${c.note}` : ''}</div>
        ${lock ? `<div class="meta">🔒 Cấp ${c.lv}</div>` : `<button class="btn" data-action="plant" data-arg="${k}">Gieo</button>`}</div>`;
    }).join('') + '</div>';
  openModal('🌱 Gieo hạt', html, { kind: 'seed' });
}
function openPlotInfo(i) {
  const p = S.plots[i], c = CROPS[p.crop];
  const left = (c.grow - p.prog) / p.fert;
  const html = `<div class="row"><div style="font-size:54px">${c.icon}</div><div>
    <h3>${c.name}</h3><div>Còn lại: <b>${realDur(left)}</b> ${p.fert > 1 ? `(đang bón x${p.fert})` : ''}</div>
    <div class="muted">${p.w2 ? 'Đã qua lần tưới thứ 2' : 'Cây sẽ cần tưới thêm 1 lần khi lớn được một nửa'}</div></div></div>
    <h3>Bón phân để cây lớn nhanh hơn</h3><div class="grid">` +
    Object.entries(FERTS).map(([k, f]) => {
      const lock = S.lv < f.lv, have = S.ferts[k] || 0;
      return `<div class="card ${lock ? 'locked' : ''}"><div class="ic">🧪</div><div class="nm" style="color:${f.color}">${f.name}</div>
      <div class="meta">Giá ${money(f.price)} · Đang có: ${have}<br>Còn lại → ${realDur(left * p.fert / Math.max(p.fert, f.mult))}</div>
      ${lock ? `<div class="meta">🔒 Cấp ${f.lv}</div>` : `<button class="btn orange" data-action="fertPlot" data-arg="${k}" ${p.fert >= f.mult ? 'disabled' : ''}>${have ? 'Bón' : 'Mua & bón'}</button>`}</div>`;
    }).join('') + '</div>';
  openModal('🌿 Thông tin ô đất', html, { kind: 'plot' });
}

function openBuyPlot(i) {
  const n = S.plotsOwned, need = lvForPlot(i);
  let html;
  if (i !== n) {
    const next = n < 24 ? `Hãy mua ô kế tiếp trước (ô số ${n + 1}, giá ${money(plotPrice(n))}${S.lv < lvForPlot(n) ? `, cần cấp ${lvForPlot(n)}` : ''}).` : '';
    html = `<p>Các ô đất được mở rộng lần lượt. ${next}</p>
      <div style="text-align:center"><button class="btn" data-action="close">Đã hiểu</button></div>`;
  } else if (S.lv < need) {
    html = `<div style="text-align:center"><div style="font-size:50px">🔒</div>
      <p>Ô đất số ${i + 1} cần đạt <b>cấp ${need}</b> mới được mua.<br>Giá: <b>${money(plotPrice(i))}</b></p>
      <button class="btn" data-action="close">Đã hiểu</button></div>`;
  } else {
    const p = plotPrice(i), ok = S.money >= p;
    html = `<div style="text-align:center"><div style="font-size:50px">🪧🌱</div>
      <h3>Mở rộng nông trại: ô đất số ${i + 1}</h3>
      <div class="invoice" style="text-align:left"><table>
        <tr><td>Giá ô đất</td><td class="r">${money(p)}</td></tr>
        <tr><td>Tiền hiện có</td><td class="r">${money(S.money)}</td></tr>
        <tr class="total"><td>Còn lại sau khi mua</td><td class="r" style="color:${ok ? '#2e7d32' : '#c62828'}">${money(S.money - p)}</td></tr></table></div>
      <p class="muted">Bạn đang có ${n} ô đất. Ô sau sẽ có giá ${n + 1 < 24 ? money(plotPrice(i + 1)) : '—'}.</p>
      <button class="btn" data-action="buyPlot" data-arg="${i}" ${ok ? '' : 'disabled'}>${ok ? '🛒 Mua ô đất' : 'Chưa đủ tiền'}</button>
      <button class="btn red" data-action="close">Để sau</button></div>`;
  }
  openModal('🪧 Mua ô đất', html, { kind: 'buyplot', narrow: true });
}

function openShop(tab = 'seeds') {
  const tabs = [['seeds', '🌱 Hạt giống'], ['fert', '🧪 Phân bón'], ['animals', '🐄 Vật nuôi'], ['fish', '🎣 Câu cá'], ['water', '💧 Nước']];
  let body = '';
  if (tab === 'seeds') {
    body = `<p class="muted">Chọn loại hạt cho công cụ 🌱 Gieo hạt. Tiền hạt trừ khi gieo.</p><div class="grid">` + Object.entries(CROPS).map(([k, c]) => {
      const lock = S.lv < c.lv;
      return `<div class="card ${lock ? 'locked' : ''} ${S.seed === k ? 'sel' : ''}"><div class="ic">${c.icon}</div><div class="nm">${c.name}</div>
      <div class="meta">Hạt ${money(c.seed)} → Bán ${money(c.sell)}${c.yield > 1 ? ` (thu ${c.yield} cái/ô)` : ''}<br>⏱ ${realDur(c.grow)} (≈${gameDur(c.grow)} giờ game) · +${c.xp} XP${c.note ? `<br>🐔 ${c.note}` : ''}</div>
      ${lock ? `<div class="meta">🔒 Cấp ${c.lv}</div>` : `<button class="btn blue" data-action="selectSeed" data-arg="${k}">${S.seed === k ? '✓ Đang chọn' : 'Chọn'}</button>`}</div>`;
    }).join('') + '</div>';
  } else if (tab === 'fert') {
    body = `<p class="muted">Phân bón tăng tốc độ lớn của cây cho phần thời gian còn lại. Mỗi ô chỉ dùng loại mạnh nhất đã bón.</p><div class="grid">` + Object.entries(FERTS).map(([k, f]) => {
      const lock = S.lv < f.lv;
      return `<div class="card ${lock ? 'locked' : ''} ${S.fert === k ? 'sel' : ''}"><div class="ic">🧪</div><div class="nm" style="color:${f.color}">${f.name}</div>
      <div class="meta">Nhanh gấp ${f.mult} lần · ${money(f.price)}/bao<br>Đang có: <b>${S.ferts[k] || 0}</b></div>
      ${lock ? `<div class="meta">🔒 Cấp ${f.lv}</div>` : `<div><button class="btn" data-action="buyFert" data-arg="${k}|1">Mua 1</button><button class="btn" data-action="buyFert" data-arg="${k}|5">Mua 5</button></div>
      <button class="btn blue" data-action="selectFert" data-arg="${k}">${S.fert === k ? '✓ Đang dùng' : 'Dùng loại này'}</button>`}</div>`;
    }).join('') + '</div>';
  } else if (tab === 'animals') {
    body = `<p class="muted">Gia súc cần cho ăn (tốn tiền thức ăn + ${WATER.animal * 1000} lít nước) rồi mới cho sản phẩm. Bấm vào chuồng để cho ăn và thu hoạch cả chuồng.</p><div class="grid">` + Object.entries(ANIMALS).map(([k, a]) => {
      const lock = S.lv < a.lv, n = S.animals[k].length, cap = penCap(S.lv), pr = PRODUCTS[a.product];
      return `<div class="card ${lock ? 'locked' : ''}"><div class="ic">${a.icon}</div><div class="nm">${a.name} (${n}/${cap})</div>
      <div class="meta">Giá ${money(a.price)} · Thức ăn ${a.feedItem ? `${a.feedQty} ${CROPS[a.feedItem].icon} ${CROPS[a.feedItem].name}` : money(a.feed)}/lần<br>${pr.icon} ${pr.name}: ${money(pr.sell)} mỗi ${realDur(a.time)}</div>
      ${lock ? `<div class="meta">🔒 Cấp ${a.lv}</div>` : `<button class="btn" data-action="buyAnimal" data-arg="${k}" ${n >= cap ? 'disabled' : ''}>${n >= cap ? 'Chuồng đầy' : 'Mua'}</button>`}</div>`;
    }).join('') + '</div>';
  } else if (tab === 'fish') {
    body = `<p class="muted">Bấm vào ao để câu. Khi phao chìm và hiện ❗, bấm vào ao (hoặc phím Space) thật nhanh để giật.
      Mỗi lượt tốn 1 mồi (${money(BAIT_PRICE)}). Hôm nay ao còn <b>${S.fishLeft}/${FISH_PER_DAY}</b> lượt cá.</p>
      <div class="grid">` + RODS.slice(1).map((r, i) => {
        const id = i + 1, lock = S.lv < r.lv, own = S.rod >= id;
        return `<div class="card ${lock ? 'locked' : ''} ${S.rod === id ? 'sel' : ''}"><div class="ic">🎣</div><div class="nm">${r.name}</div>
        <div class="meta">${money(r.price)} · Giật trong ${r.window} giây${r.rare > 1 ? `<br>Cá quý dễ cắn gấp ${r.rare} lần` : ''}</div>
        ${lock ? `<div class="meta">🔒 Cấp ${r.lv}</div>` : own ? '<div class="meta">✓ Đã có</div>' : `<button class="btn" data-action="buyRod" data-arg="${id}">Mua</button>`}</div>`;
      }).join('') + `<div class="card"><div class="ic">🪱</div><div class="nm">Mồi câu</div><div class="meta">${money(BAIT_PRICE)}/mồi · Đang có: <b>${S.bait}</b></div>
        <div><button class="btn" data-action="buyBait" data-arg="10">Mua 10</button><button class="btn" data-action="buyBait" data-arg="30">Mua 30</button></div></div></div>
      <h3>Các loài trong ao</h3><div class="grid">` + Object.values(FISH).map(f => `<div class="card ${S.lv < f.lv ? 'locked' : ''}"><div class="ic">${f.icon}</div><div class="nm">${f.name}</div>
        <div class="meta">Bán ${money(f.sell)}${f.xp ? ` · +${f.xp} XP` : ''}<br>${S.lv < f.lv ? `🔒 Cấp ${f.lv}` : f.w >= 18 ? 'Dễ câu' : f.w >= 7 ? 'Hơi hiếm' : f.w >= 3 ? 'Hiếm' : 'Cực hiếm'}</div></div>`).join('') + '</div>';
  } else {
    body = waterHtml();
  }
  openModal('🏪 Cửa hàng', `<div class="tabs">${tabs.map(([k, n]) => `<button class="${k === tab ? 'on' : ''}" data-action="shopTab" data-arg="${k}">${n}</button>`).join('')}</div>${body}`, { kind: 'shop' });
}
function waterHtml() {
  const c = refillCost();
  return `<div class="row"><div style="font-size:60px">💧</div><div>
    <h3>Bể nước: ${S.water.toFixed(2)} / ${WATER.cap.toFixed(2)} m³</h3>
    <div class="muted">Tưới 1 ô đất: ${WATER.plant * 1000} lít (${WATER.plant} m³) · Gia súc uống: ${WATER.animal * 1000} lít<br>
    Giá nước: ${money(WATER.price)}/m³. Nếu để bể xuống dưới <b>${WATER.low} m³</b> sẽ tính thêm phí bơm gấp ${money(WATER.surcharge)}.</div></div></div>
    <div class="invoice" style="margin-top:10px"><table>
      <tr><td>Lượng nước cần nạp</td><td class="r">${c.need.toFixed(2)} m³</td></tr>
      <tr><td>Tiền nước (${money(WATER.price)}/m³)</td><td class="r">${money(c.base)}</td></tr>
      <tr class="${c.sur ? 'pen' : ''}"><td>Phí bơm gấp (bể dưới mức ${WATER.low} m³)</td><td class="r">${money(c.sur)}</td></tr>
      <tr class="total"><td>Tổng</td><td class="r">${money(c.total)}</td></tr></table>
    <div style="text-align:center"><button class="btn blue" data-action="refill" ${c.need < 0.001 ? 'disabled' : ''}>Nạp đầy bể</button></div></div>`;
}
function openWater() { openModal('💧 Bể nước', waterHtml(), { kind: 'water', narrow: true }); }

function openInventory() {
  const need = {};
  S.orders.forEach(o => o.items.forEach(it => need[it.k] = (need[it.k] || 0) + it.qty));
  const keys = Object.keys(S.inv).filter(k => S.inv[k] > 0);
  let html = `<p class="muted">Bán nông sản ở chợ để lấy tiền, hoặc giữ lại để giao đơn hàng (đơn hàng trả giá cao hơn + VAT).</p><div class="list">`;
  if (!keys.length) html += '<p>Kho đang trống. Hãy trồng cây và chăm sóc gia súc nhé! 🌱</p>';
  keys.forEach(k => {
    const it = ITEMS[k], n = S.inv[k];
    html += `<div class="item"><div class="ic">${it.icon}</div><div class="grow"><b>${it.name}</b> × ${n}<div class="muted">Giá bán: ${money(it.sell)}/cái${need[k] ? ` · <span style="color:#e65100">Đơn hàng cần ${need[k]}</span>` : ''}${CROPS[k] && CROPS[k].note ? ` · <span style="color:#2e7d32">${CROPS[k].note}</span>` : ''}</div></div>
      <button class="btn orange" data-action="sell" data-arg="${k}|1">Bán 1</button><button class="btn orange" data-action="sell" data-arg="${k}|all">Bán hết (${money(n * it.sell)})</button></div>`;
  });
  html += `</div><h3>🧪 Phân bón</h3><div class="row">${Object.entries(FERTS).map(([k, f]) => `<span>${f.short}: <b>${S.ferts[k] || 0}</b></span>`).join(' · ')}</div>`;
  openModal('📦 Kho', html, { kind: 'inv' });
}

function openOrders(tab = 'offers') {
  const now = nowAbs();
  let body = '';
  if (tab === 'offers') {
    body = S.offers.length ? '' : '<p>Chưa có đơn hàng mới. Đối tác sẽ gửi đơn trong ít phút nữa ✉️</p>';
    S.offers.forEach(o => {
      body += `<div class="order"><div class="hd"><span>🤝 ${esc(o.partner)}</span><span>${money(o.sub)} + VAT</span></div>
      <div class="its">${o.items.map(it => `<span class="${(S.inv[it.k] || 0) >= it.qty ? 'have' : ''}">${ITEMS[it.k].icon} ${ITEMS[it.k].name} × ${it.qty} <small>(${money(it.unit)})</small></span>`).join('')}</div>
      <div class="muted">Thời gian giao: <b>${gameDur(o.window)}</b> giờ game (≈${realDur(o.window)} thật) · Thưởng +${o.xp} XP · Đơn hết hiệu lực sau ${gameDur(o.expires - now)}</div>
      <div><button class="btn" data-action="accept" data-arg="${o.id}">✔ Nhận đơn</button><button class="btn red" data-action="decline" data-arg="${o.id}">✖ Từ chối</button></div></div>`;
    });
  } else {
    body = S.orders.length ? '' : '<p>Bạn chưa nhận đơn nào.</p>';
    S.orders.forEach(o => {
      const ok = canDeliver(o), left = o.deadline - now, li = lateInfo(o);
      body += `<div class="order ${ok ? 'ok' : ''} ${left < 0 ? 'late' : ''}"><div class="hd"><span>🤝 ${esc(o.partner)}</span><span>${money(o.sub)} + VAT 15%</span></div>
      <div class="its">${o.items.map(it => `<span class="${(S.inv[it.k] || 0) >= it.qty ? 'have' : ''}">${ITEMS[it.k].icon} ${ITEMS[it.k].name} ${Math.min(S.inv[it.k] || 0, it.qty)}/${it.qty}</span>`).join('')}</div>
      <div class="muted">Hạn giao: <b>${absLabel(o.deadline)}</b> · ${left >= 0 ? `còn ${gameDur(left)} (≈${realDur(left)})` : `<span style="color:#c62828">trễ ${gameDur(-left)} — phạt ${Math.round(li.rate * 100)}% (huỷ sau ${gameDur(LATE_GRACE + left)})</span>`}</div>
      <div><button class="btn" data-action="deliver" data-arg="${o.id}" ${ok ? '' : 'disabled'}>🚚 Giao hàng</button><button class="btn red" data-action="cancelOrder" data-arg="${o.id}">Huỷ đơn</button></div></div>`;
    });
  }
  const rules = `<p class="muted" style="margin-top:8px">📋 Quy định: đối tác thanh toán tiền hàng + thuế VAT 15%. Giao trễ bị trừ ${LATE_STEP * 100}% tổng tiền cho mỗi giờ game (tối đa ${LATE_MAX * 100}%) và chỉ nhận một nửa kinh nghiệm. Trễ quá ${LATE_GRACE / 60} giờ hoặc tự huỷ đơn: phạt ${CANCEL_FEE * 100}% giá trị đơn.</p>`;
  openModal('✉️ Đơn hàng', `<div class="tabs"><button class="${tab === 'offers' ? 'on' : ''}" data-action="ordersTab" data-arg="offers">📨 Đơn mới (${S.offers.length})</button>
    <button class="${tab === 'active' ? 'on' : ''}" data-action="ordersTab" data-arg="active">📋 Đang làm (${S.orders.length}/${MAX_ORDERS})</button></div>${body}${rules}`, { kind: 'orders' });
}

function showInvoice(v) {
  const o = v.o;
  const rows = o.items.map((it, i) => `<tr><td>${i + 1}</td><td>${ITEMS[it.k].icon} ${ITEMS[it.k].name}</td><td class="r">${it.qty}</td><td class="r">${money(it.unit)}</td><td class="r">${money(it.qty * it.unit)}</td></tr>`).join('');
  const html = `<div class="invoice">
    <h3>HOÁ ĐƠN GIÁ TRỊ GIA TĂNG</h3>
    <div class="c muted">Số: ${String(v.no).padStart(7, '0')} · Lập lúc ${absLabel(v.at)}</div>
    <div style="margin-top:6px">Đơn vị bán: <b>Nông trại của ${esc(S.name)}</b><br>Người mua: <b>${esc(o.partner)}</b><br>
    Hạn giao: ${absLabel(o.deadline)} · Trạng thái: ${v.late > 0 ? `<b style="color:#c62828">Giao trễ ${gameDur(v.late)}</b>` : '<b style="color:#2e7d32">Đúng hạn</b>'}</div>
    <table><tr><th>#</th><th>Hàng hoá</th><th class="r">SL</th><th class="r">Đơn giá</th><th class="r">Thành tiền</th></tr>${rows}
    <tr class="sum"><td colspan="4">Cộng tiền hàng</td><td class="r">${money(o.sub)}</td></tr>
    <tr class="sum"><td colspan="4">Thuế GTGT (VAT 15%)</td><td class="r">${money(v.vat)}</td></tr>
    <tr class="sum"><td colspan="4"><b>Tổng thanh toán</b></td><td class="r"><b>${money(v.total)}</b></td></tr>
    ${v.penalty ? `<tr class="sum pen"><td colspan="4">Phạt giao trễ (${Math.round(v.rate * 100)}%)</td><td class="r">−${money(v.penalty)}</td></tr>` : ''}
    <tr class="total"><td colspan="4">THỰC NHẬN</td><td class="r">${money(v.received)}</td></tr></table>
    <div class="c">⭐ Kinh nghiệm: +${v.xp} XP${v.late > 0 ? ' (giảm 50% do trễ)' : ''}</div></div>
    <div style="text-align:center;margin-top:10px"><button class="btn" data-action="close">Tuyệt vời!</button></div>`;
  openModal('🧾 Giao hàng thành công', html, { kind: 'invoice', narrow: false });
}

function showDayEnd() {
  R.queue = []; R.char.tx = null;
  const st = S.stats;
  const html = `<div style="text-align:center"><div style="font-size:56px">🌇</div>
    <h3>Đã ${clock(DAY_MIN)} — hết giờ làm việc ngày ${S.day}!</h3>
    <div class="invoice" style="text-align:left"><table>
    <tr><td>💰 Thu nhập</td><td class="r">${money(st.income)}</td></tr>
    <tr><td>💸 Chi tiêu</td><td class="r">${money(st.expense)}</td></tr>
    <tr><td>🧺 Số lần thu hoạch cây</td><td class="r">${st.harvest}</td></tr>
    <tr><td>🚚 Đơn hàng đã giao</td><td class="r">${st.delivered}</td></tr>
    <tr class="total"><td>Lãi/lỗ trong ngày</td><td class="r" style="color:${st.income - st.expense >= 0 ? '#2e7d32' : '#c62828'}">${money(st.income - st.expense)}</td></tr></table></div>
    <p class="muted">Ban đêm cây và gia súc nghỉ ngơi. Đơn hàng chỉ tính giờ làm việc (7:00 – 18:00).</p>
    <button class="big" data-action="sleep">😴 Đi ngủ — sang ngày ${S.day + 1}</button></div>`;
  openModal('🌙 Kết thúc ngày', html, { kind: 'dayend', narrow: true, noClose: true });
  saveGame();
}
function sleep() {
  S.day++; S.min = 0; S.dayOver = false; S.stats = { income: 0, expense: 0, harvest: 0, delivered: 0 };
  S.fishLeft = FISH_PER_DAY; R.fish = null;
  R.char.x = 520; R.char.y = 430;
  $('#modalBg').classList.add('hidden'); R.modal = null; R.paused = false;
  SND.rooster(); toast(`☀️ Ngày ${S.day} bắt đầu! Ò ó o...`, 'good'); updateHUD(true); saveGame();
}

function openMenu() {
  openModal('☰ Menu', `
    <div class="toggle"><span>👧 Nhân vật: <b>${esc(S.name)}</b> — ${OUTFITS[S.outfit]}</span><button class="btn blue" data-action="openChar">Đổi tên / trang phục</button></div>
    <div class="toggle" style="background:#eaf6ff;border-color:#64b5f6"><span>📥 <b>Sao lưu dữ liệu ra file</b><br><small class="muted">File .json lưu vào thư mục Tải xuống (Downloads)</small></span><button class="btn blue" data-action="backup">Tải file</button></div>
    <div class="toggle" style="background:#fff4e5;border-color:#ffb74d"><span>📂 <b>Khôi phục từ file sao lưu</b></span><button class="btn orange" data-action="restore">Chọn file</button></div>
    <div class="toggle"><span>🎵 Nhạc nền</span><button class="btn ${S.settings.music ? '' : 'red'}" data-action="toggle" data-arg="music">${S.settings.music ? 'BẬT' : 'TẮT'}</button></div>
    <div class="toggle"><span>🔊 Âm thanh (gà gáy, chim hót, nước chảy...)</span><button class="btn ${S.settings.sfx ? '' : 'red'}" data-action="toggle" data-arg="sfx">${S.settings.sfx ? 'BẬT' : 'TẮT'}</button></div>
    <div class="toggle"><span>⛶ Toàn màn hình (điện thoại: tự xoay ngang)</span><button class="btn blue" data-action="fullscreen">Bật</button></div>
    <div class="toggle"><span>📋 Đặt lại vị trí & cỡ bảng đơn hàng</span><button class="btn blue" data-action="resetTrk">Đặt lại</button></div>
    <div class="toggle"><span>📖 Hướng dẫn chơi</span><button class="btn blue" data-action="help">Xem</button></div>
    <div class="toggle"><span>😴 Kết thúc ngày sớm (đi ngủ ngay)</span><button class="btn orange" data-action="endDay">Đi ngủ</button></div>
    <div class="toggle"><span>💾 Lưu game (tự động lưu mỗi 10 giây)</span><button class="btn" data-action="save">Lưu</button></div>
    <div class="toggle"><span>🔄 Chơi lại từ đầu</span><button class="btn red" data-action="newGame">Chơi mới</button></div>
    <div class="muted" style="text-align:center">Phiên bản ${GAME_VERSION}</div>`, { kind: 'menu', narrow: true });
}
let charPick = 0;
function openChar() {
  charPick = S.outfit;
  openModal('👧 Nhân vật', `<label class="lbl">Tên nhân vật</label><input class="inp" id="charName" maxlength="16" value="${esc(S.name)}">
    <label class="lbl">Trang phục</label><div class="outfits" id="charOutfits"></div>
    <div style="text-align:center;margin-top:10px"><button class="btn" data-action="charSave">💾 Lưu thay đổi</button></div>`, { kind: 'char' });
  buildOutfitPicker($('#charOutfits'), charPick, i => charPick = i);
}
function showHelp() {
  openModal('📖 Hướng dẫn', `<div class="help">
    <p>🕖 Một ngày làm việc từ <b>7:00 đến 18:00</b>, kéo dài <b>10 phút thật</b>. Hết giờ sẽ đi ngủ sang ngày mới.</p>
    <p>🖱️ Bấm lên mặt đất để di chuyển (hoặc dùng phím W A S D / mũi tên). Bấm liên tiếp nhiều ô đất để xếp hàng công việc.</p>
    <p>🔍 <b>Zoom vào nhân vật:</b> dùng nút ＋ / － / 🔍 bên trái, lăn chuột, phím + / − / 0, hoặc chụm 2 ngón tay trên điện thoại. Camera sẽ đi theo nhân vật.</p>
    <p>🌱 <b>Trồng cây:</b> gieo hạt → <b>tưới nước</b> (cây chỉ lớn khi đất ẩm) → lớn được một nửa cây sẽ khát 💧, tưới thêm lần nữa → thu hoạch 🧺.</p>
    <p>🧪 <b>Phân bón</b> x2 / x3 / x5 giúp cây lớn nhanh hơn. Bón cho cây lâu ngày mới đáng tiền!</p>
    <p>💧 <b>Nước</b> tính theo m³: mỗi lần tưới tốn ${WATER.plant * 1000} lít. Nạp nước ở Bể nước (${money(WATER.price)}/m³). Để bể dưới ${WATER.low} m³ sẽ mất thêm phí bơm gấp.</p>
    <p>🐔 <b>Chăn nuôi:</b> mua gia súc ở Cửa hàng, bấm vào chuồng để cho ăn, đợi rồi thu trứng, sữa, lông cừu... <b>Gà ăn 🌾 lúa mì</b> trong kho (1 bó/con) — lúa mì rẻ nhất, lớn nhanh, mỗi ô thu 2 bó.</p>
    <p>💰 <b>Kiếm tiền:</b> bán nông sản trong Kho, hoặc nhận <b>đơn hàng</b> ✉️ từ đối tác — giao đúng hạn để nhận tiền + VAT 15% + kinh nghiệm. Trễ hạn sẽ bị trừ tiền.</p>
    <p>🪧 <b>Mở rộng đất:</b> bạn có ${START_PLOTS} ô đất ban đầu. Bấm vào ô có biển 🪧 để mua thêm (từ ${money(plotPrice(START_PLOTS))}, ô sau đắt hơn ô trước ${money(10000)}). Mỗi cấp cho phép mua thêm 2 ô.</p>
    <p>🎣 <b>Câu cá:</b> mua cần câu ở Cửa hàng, bấm vào ao, chờ phao chìm hiện ❗ rồi bấm ao (hoặc Space) thật nhanh. Mỗi loài giá khác nhau, cá quý mở theo cấp; mỗi ngày ao có ${FISH_PER_DAY} lượt cá.</p>
    <p>👥 <b>Bạn bè:</b> gửi mã nông trại cho bạn bè hoặc nhập mã của họ để ghé thăm — tưới giúp ô đang khát nước 💧 và tặng quà 🎁.</p>
    <p>⭐ Lên cấp để mở khoá cây trồng, vật nuôi, phân bón và quyền mua thêm ô đất.</p></div>
    <div style="text-align:center"><button class="btn" data-action="close">Bắt đầu thôi!</button></div>`, { kind: 'help' });
}

// ----- Xử lý nút trong modal -----
const ACTIONS = {
  close: () => closeModal(),
  plant: k => { S.seed = k; S.tool = 'seed'; closeModal(); plant(R.pendingPlot, k); updateToolbar(); },
  fertPlot: k => { if (fertilize(R.pendingPlot, k)) closeModal(); else openPlotInfo(R.pendingPlot); },
  selectSeed: k => { S.seed = k; S.tool = 'seed'; SND.click(); openShop('seeds'); },
  selectFert: k => { S.fert = k; S.tool = 'fert'; SND.click(); openShop('fert'); },
  buyFert: a => { const [k, n] = a.split('|'); const f = FERTS[k]; if (spend(f.price * n)) { S.ferts[k] = (S.ferts[k] || 0) + +n; SND.coin(); } openShop('fert'); },
  buyAnimal: k => {
    const a = ANIMALS[k];
    if (S.animals[k].length >= penCap(S.lv)) return;
    if (spend(a.price)) { S.animals[k].push({ st: 'hungry', prog: 0 }); rebuildAnimPos(); SND[a.snd](); toast(`Đã mua 1 ${a.name}! Bấm vào chuồng để cho ăn.`, 'good'); if (!S.offers.length) genOffer(); }
    openShop('animals');
  },
  shopTab: t => openShop(t),
  buyRod: a => {
    const id = +a, r = RODS[id];
    if (!r || S.rod >= id || S.lv < r.lv) return;
    if (spend(r.price)) { S.rod = id; if (!S.bait) S.bait = 5; SND.coin(); toast(`🎣 Đã mua ${r.name}${id === 1 ? ' (tặng kèm 5 mồi)' : ''}! Bấm vào ao để câu cá`, 'good'); saveGame(); }
    openShop('fish');
  },
  buyBait: a => { const n = +a; if (spend(n * BAIT_PRICE)) { S.bait += n; SND.coin(); saveGame(); } openShop('fish'); },
  buyPlot: a => {
    const i = +a;
    if (i !== S.plotsOwned || S.lv < lvForPlot(i)) return;
    if (!spend(plotPrice(i))) return;
    S.plotsOwned++; closeModal(); SND.coin(); SND.plant();
    const r = plotRect(i); floater(r.x + r.w / 2, r.y + 10, `−${money(plotPrice(i))}`, '#ffcdd2');
    toast(`🎉 Đã mua ô đất số ${i + 1}!`, 'good'); saveGame();
  },
  refill: () => { doRefill(); if (R.modal === 'water') openWater(); else openShop('water'); },
  sell: a => {
    const [k, n] = a.split('|'); const cnt = n === 'all' ? S.inv[k] : 1;
    if (!cnt) return;
    addInv(k, -cnt); earn(cnt * ITEMS[k].sell); SND.coin(); toast(`Đã bán ${cnt} ${ITEMS[k].name}: +${money(cnt * ITEMS[k].sell)}`, 'good'); openInventory();
  },
  ordersTab: t => openOrders(t),
  accept: id => acceptOffer(+id),
  decline: id => declineOffer(+id),
  deliver: id => deliverOrder(+id),
  cancelOrder: id => cancelOrder(+id),
  sleep: () => sleep(),
  openChar: () => openChar(),
  charSave: () => {
    const n = $('#charName').value.trim();
    if (!n) { $('#charName').style.borderColor = '#e53935'; return; }
    S.name = n; S.outfit = charPick; drawAvatar(); saveGame(); toast('Đã cập nhật nhân vật ✨', 'good'); closeModal();
  },
  toggle: k => { S.settings[k] = !S.settings[k]; SND.apply(); openMenu(); },
  help: () => showHelp(),
  fullscreen: () => goFullscreen(),
  resetTrk: () => { S.ui.trk = { x: null, y: null, scale: 1, folded: false }; applyTracker(); saveGame(); toast('Đã đặt lại bảng đơn hàng', 'good'); },
  endDay: () => { if (confirm('Kết thúc ngày làm việc ngay bây giờ?')) { closeModal(); S.dayOver = true; showDayEnd(); } },
  save: () => { saveGame(); toast('Đã lưu game 💾', 'good'); },
  backup: () => backupToFile(),
  restore: () => $('#restoreFile').click(),
  newGame: () => {
    if (!confirm('Xoá toàn bộ tiến trình và chơi lại từ đầu?')) return;
    clearSave(); location.reload();
  },
};
$('#modalBg').addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (b && !b.disabled) { SND.click(); ACTIONS[b.dataset.action](b.dataset.arg, b); return; }
  if (e.target.id === 'modalBg' && !S.dayOver) closeModal();
});

// ----- Nút HUD -----
$('#btnOrders').onclick = () => { SND.click(); openOrders(S.offers.length ? 'offers' : 'active'); };
$('#btnShop').onclick = () => { SND.click(); openShop(); };
$('#btnInv').onclick = () => { SND.click(); openInventory(); };
$('#btnMenu').onclick = () => { SND.click(); openMenu(); };
$('#btnRename').onclick = () => { SND.click(); openChar(); };
$('#trkList').addEventListener('click', () => openOrders('active'));

/* ----- Bảng đơn hàng nổi: kéo thả, phóng to/thu nhỏ, thu gọn ----- */
const TRK_MIN = 0.6, TRK_MAX = 1.8;
function applyTracker() {
  const el = $('#tracker'), u = S.ui.trk, mobile = document.body.classList.contains('mobile');
  if (u.x === null) { if (mobile) u.scale = 1.25; u.x = W - 246 * u.scale - 8; u.y = mobile ? 108 : 84; }
  const w = el.offsetWidth * u.scale || 240 * u.scale;
  u.x = clamp(u.x, 0, W - Math.max(60, w));
  u.y = clamp(u.y, 0, H - 34 * u.scale);
  el.style.left = u.x + 'px'; el.style.top = u.y + 'px'; el.style.transform = `scale(${u.scale})`;
  el.classList.toggle('folded', u.folded);
  el.querySelector('[data-trk="fold"]').textContent = u.folded ? '▸' : '▾';
}
function zoomTracker(f) {
  const u = S.ui.trk, old = u.scale;
  u.scale = clamp(Math.round(old * f * 100) / 100, TRK_MIN, TRK_MAX);
  // giữ nguyên mép phải nếu bảng đang nằm sát bên phải
  if (u.x + 240 * old > W - 40) u.x -= 240 * (u.scale - old);
  applyTracker(); saveGame();
}
(() => {
  const el = $('#tracker'), head = el.querySelector('.trk-head');
  el.querySelectorAll('[data-trk]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation(); SND.click();
    const a = b.dataset.trk;
    if (a === 'plus') zoomTracker(1.15);
    else if (a === 'minus') zoomTracker(1 / 1.15);
    else { S.ui.trk.folded = !S.ui.trk.folded; applyTracker(); saveGame(); }
  }));
  el.addEventListener('wheel', e => { e.preventDefault(); zoomTracker(e.deltaY < 0 ? 1.08 : 1 / 1.08); }, { passive: false });
  // kéo bằng chuột / ngón tay; chụm 2 ngón để phóng to thu nhỏ
  const pts = new Map(); let drag = null, pinch = null;
  head.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { head.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
    if (pts.size === 1) drag = { sx: e.clientX, sy: e.clientY, x: S.ui.trk.x, y: S.ui.trk.y };
  });
  el.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || head.contains(e.target)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) {
      drag = null;
      if (!pinch) pinch = { d: dist(), s: S.ui.trk.scale };
      S.ui.trk.scale = clamp(pinch.s * dist() / pinch.d, TRK_MIN, TRK_MAX); applyTracker();
    } else if (drag) {
      const k = R.stageScale || 1;
      S.ui.trk.x = drag.x + (e.clientX - drag.sx) / k; S.ui.trk.y = drag.y + (e.clientY - drag.sy) / k; applyTracker();
    }
  });
  const end = e => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size < 2) pinch = null;
    if (!pts.size) { drag = null; saveGame(); }
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
})();
document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => {
  SND.click(); S.tool = b.dataset.tool;
  if (S.tool === 'seed' && !R.modal) { /* giữ loại hạt đang chọn */ }
  updateToolbar();
}));
// nhấn chuột phải vào công cụ hạt / phân để đổi loại
$('[data-tool="seed"]').addEventListener('contextmenu', e => { e.preventDefault(); openShop('seeds'); });
$('[data-tool="fert"]').addEventListener('contextmenu', e => { e.preventDefault(); openShop('fert'); });
$('[data-tool="seed"]').addEventListener('dblclick', () => openShop('seeds'));
$('[data-tool="fert"]').addEventListener('dblclick', () => openShop('fert'));

/* =========================================================
   CHUỘT & BÀN PHÍM
   ========================================================= */
function toWorld(e) {
  const r = cv.getBoundingClientRect(), c = R.cam;
  const sx = (e.clientX - r.left) * W / r.width, sy = (e.clientY - r.top) * H / r.height;
  return { x: c.x + sx / c.z, y: c.y + sy / c.z };
}

/* ----- Zoom vào nhân vật ----- */
function setZoom(z, save = true) {
  S.ui.zoom = clamp(Math.round(z * 100) / 100, ZOOM_MIN, ZOOM_MAX);
  $('#zoomLbl').textContent = S.ui.zoom.toFixed(1) + 'x';
  if (save) saveGame();
}
document.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
  if (!S) return;
  SND.click();
  const a = b.dataset.zoom, z = S.ui.zoom || 1;
  setZoom(a === 'in' ? z + 0.25 : a === 'out' ? z - 0.25 : (z > 1 ? 1 : 1.8));
}));
cv.addEventListener('wheel', e => {
  if (!R.started || R.modal) return;
  e.preventDefault(); setZoom((S.ui.zoom || 1) * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
}, { passive: false });
// chụm / mở 2 ngón tay trên bản đồ để zoom
(() => {
  const pts = new Map(); let pinch = null;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && R.started) {
      pinch = { d: dist(), z: S.ui.zoom || 1 };
      R.char.tx = null; // ngón đầu tiên không tính là lệnh đi
      const q = R.queue[R.queue.length - 1]; if (q && performance.now() - q.at < 400) R.queue.pop();
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) setZoom(pinch.z * dist() / pinch.d, false);
  });
  const end = e => { if (pts.delete(e.pointerId) && pinch && pts.size < 2) { pinch = null; saveGame(); } };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
})();
function hitTest(x, y) {
  for (let i = 0; i < 24; i++) { const r = plotRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { type: 'plot', i }; }
  for (const t in PENS) { const p = PENS[t]; if (x >= p.x && x <= p.x + p.w && y >= p.y - 16 && y <= p.y + p.h) return { type: 'pen', t }; }
  for (const k in BUILD) { const b = BUILD[k]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h + (k === 'well' ? 30 : 0)) return { type: 'build', k }; }
  if (inPond(x, y)) return { type: 'pond' };
  return null;
}
cv.addEventListener('pointermove', e => {
  if (!R.started || e.pointerType === 'touch') return;
  const p = toWorld(e); R.hover = hitTest(p.x, p.y); cv.style.cursor = R.hover ? 'pointer' : 'default';
});
cv.addEventListener('pointerdown', e => {
  if (!R.started || R.modal || S.dayOver || !e.isPrimary) return;
  SND.init();
  const p = toWorld(e), h = hitTest(p.x, p.y);
  if (e.pointerType === 'touch') { R.hover = h; setTimeout(() => { if (R.hover === h) R.hover = null; }, 250); }
  if (R.fish) {                                     // đang câu: bấm ao = giật câu, bấm chỗ khác = thôi câu
    if (h && h.type === 'pond') { tryHook(); return; }
    stopFishing(true);
  }
  if (h && h.type === 'pond') { goFishing(p.x, p.y); return; }
  if (!h) { R.queue = []; R.char.tx = clamp(p.x, 24, W - 24); R.char.ty = clamp(p.y, 196, H - 6); return; }
  if (h.type === 'build') {
    if (h.k === 'house') openInventory();
    else if (h.k === 'well') openWater();
    else if (h.k === 'mailbox') openOrders(S.offers.length ? 'offers' : 'active');
    else if (h.k === 'market') openShop();
    return;
  }
  if (R.queue.length >= 12) { toast('Đang có quá nhiều việc chờ làm'); return; }
  if (h.type === 'plot' && h.i >= S.plotsOwned) { SND.click(); openBuyPlot(h.i); return; }
  if (h.type === 'plot') {
    const r = plotRect(h.i);
    if (R.queue.some(q => q.key === 'p' + h.i)) return;
    R.char.tx = null;
    R.queue.push({ at: performance.now(), key: 'p' + h.i, x: r.x + r.w / 2, y: r.y + r.h - 4, mark: r, fn: () => { plotAction(h.i); updateToolbar(); } });
  } else if (h.type === 'pen') {
    const pen = PENS[h.t];
    if (S.lv < ANIMALS[h.t].lv) { toast(`${ANIMALS[h.t].name} mở khoá ở cấp ${ANIMALS[h.t].lv}`); return; }
    if (!S.animals[h.t].length) { openShop('animals'); return; }
    R.char.tx = null;
    R.queue.push({ at: performance.now(), key: 'pen' + h.t, x: clamp(p.x, pen.x + 20, pen.x + pen.w - 20), y: pen.y - 2, fn: () => penAction(h.t) });
  }
});
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; R.keys[k] = true;
  if (!R.started) return;
  if (k === 'Escape' && R.modal) closeModal();
  if (!R.modal && (k === '=' || k === '+')) setZoom((S.ui.zoom || 1) + 0.25);
  if (!R.modal && (k === '-' || k === '_')) setZoom((S.ui.zoom || 1) - 0.25);
  if (!R.modal && k === '0') setZoom(1);
  if (!R.modal && k === ' ' && R.fish) { e.preventDefault(); tryHook(); }
  const map = { '1': 'hand', '2': 'seed', '3': 'water', '4': 'fert', '5': 'harvest' };
  if (map[k] && !R.modal) { S.tool = map[k]; updateToolbar(); }
});
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; R.keys[k] = false; });
addEventListener('blur', () => { R.keys = {}; });

/* =========================================================
   VÒNG LẶP
   ========================================================= */
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  update(dt);
  updateCam(dt);
  draw();
  if (R.started) { R.hudT += dt; if (R.hudT > 0.2) { R.hudT = 0; updateHUD(); } }
  requestAnimationFrame(loop);
}

fitStage();
R.bg = buildBG();
loadImages().then(() => { showStart(); requestAnimationFrame(loop); });
