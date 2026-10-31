'use strict';
/* =========================================================
   COOP — GHÉ THĂM NÔNG TRẠI BẠN BÈ (Firebase Realtime Database)
   Nạp sau game.js. Mỗi người có một mã nông trại 6 ký tự; bạn bè nhập mã để ghé thăm,
   thấy nhau đi lại theo thời gian thực, tưới giúp ô đang khát nước và tặng quà.

   Dữ liệu trên Firebase:
     farms/{code}/owner            uid chủ nông trại
     farms/{code}/pub              ảnh chụp nông trại (cây, chuồng, cấp...) để khách xem
     farms/{code}/pos              vị trí chủ nông trại
     farms/{code}/visitors/{uid}   vị trí & tên khách đang ghé
     farms/{code}/inbox/{id}       việc khách làm giúp (tưới, tặng quà) — chủ áp dụng rồi xoá
   ========================================================= */
(() => {
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PUB_EVERY = 2, POS_EVERY = 0.2;         // giây
  const FIREBASE_VER = '10.12.2';

  const C = {
    net: null, uid: null, status: 'off',          // off | loading | ready | error
    error: '', peers: {},                          // người khác đang thấy trên bản đồ hiện tại
    pubT: 0, posT: 0, lastPub: '', lastPos: '',
    subs: [],                                       // huỷ đăng ký khi đổi nông trại
    seenVisitors: {},
  };
  const V = { active: false, code: null, snap: null, base: null, animPos: {}, ownPos: null, ownAnimPos: null, name: '' };
  window.COOP = C; window.COOP_VISIT = V;

  /* ---------- Lớp mạng: Firebase (hoặc COOP_BACKEND giả lập khi kiểm thử) ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Không tải được ' + src)); document.head.appendChild(s); });
  }
  async function firebaseBackend(cfg) {
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VER}/`;
    await loadScript(base + 'firebase-app-compat.js');
    await loadScript(base + 'firebase-auth-compat.js');
    await loadScript(base + 'firebase-database-compat.js');
    const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
    const auth = app.auth(), db = app.database();
    const uid = await new Promise((res, rej) => {
      const off = auth.onAuthStateChanged(u => { if (u) { off(); res(u.uid); } });
      auth.signInAnonymously().catch(rej);
    });
    const r = p => db.ref(p);
    return {
      uid,
      get: async p => (await r(p).get()).val(),
      set: (p, v) => r(p).set(v),
      update: (p, v) => r(p).update(v),
      remove: p => r(p).remove(),
      push: (p, v) => r(p).push(v),
      on: (p, cb) => { const h = s => cb(s.val()); r(p).on('value', h); return () => r(p).off('value', h); },
      onChildAdded: (p, cb) => { const h = s => cb(s.key, s.val()); r(p).on('child_added', h); return () => r(p).off('child_added', h); },
      claim: async (p, v) => (await r(p).transaction(cur => (cur === null || cur === v) ? v : undefined)).committed,
      onDisconnectRemove: p => r(p).onDisconnect().remove(),
      onDisconnectSet: (p, v) => r(p).onDisconnect().set(v),
      cancelDisconnect: p => r(p).onDisconnect().cancel(),
      now: () => firebase.database.ServerValue.TIMESTAMP,
    };
  }

  async function connect() {
    if (C.net || C.status === 'loading') return;
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg && !window.COOP_BACKEND) { C.status = 'off'; return; }
    C.status = 'loading';
    try {
      C.net = window.COOP_BACKEND ? await window.COOP_BACKEND() : await firebaseBackend(cfg);
      C.uid = C.net.uid; C.status = 'ready';
      await ensureMyFarm();
    } catch (e) {
      C.status = 'error'; C.error = e && e.message || String(e); C.net = null;
      console.warn('Coop:', e);
    }
    refreshPanel();
  }

  /* ---------- Nông trại của mình: mã, xuất bản trạng thái, nhận việc giúp ---------- */
  function randomCode() { let s = ''; for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; }
  function coopData() { if (!S.coop) S.coop = { code: null, friends: [] }; return S.coop; }

  async function ensureMyFarm() {
    const cd = coopData();
    let ok = false;
    if (cd.code) ok = await C.net.claim(`farms/${cd.code}/owner`, C.uid);   // vẫn là của mình?
    if (!ok) {
      const old = cd.code;
      for (let tries = 0; tries < 8 && !ok; tries++) { cd.code = randomCode(); ok = await C.net.claim(`farms/${cd.code}/owner`, C.uid); }
      if (!ok) throw new Error('Không tạo được mã nông trại');
      saveGame();
      if (old) toast(`Mã nông trại mới của bạn: ${cd.code}`, 'good');
    }
    C.net.onDisconnectSet(`farms/${cd.code}/pub/online`, false);
    C.net.onDisconnectRemove(`farms/${cd.code}/pos`);
    publishPub(true);
    // khách đến nhà mình làm giúp
    if (C.inboxOff) C.inboxOff();
    C.inboxOff = C.net.onChildAdded(`farms/${cd.code}/inbox`, (id, m) => { applyInbox(m); C.net.remove(`farms/${cd.code}/inbox/${id}`); });
    if (!V.active) watchFarm(cd.code, true);
  }

  function snapshot() {
    const animals = {};
    for (const t in S.animals) animals[t] = S.animals[t].map(a => [a.st, Math.round(a.prog)]);
    return {
      name: S.name, outfit: S.outfit, lv: S.lv, day: S.day, plotsOwned: S.plotsOwned,
      plots: S.plots.map(p => p.crop ? [p.crop, Math.round(p.prog * 10) / 10, p.wet ? 1 : 0, p.w2 ? 1 : 0, p.fert] : 0),
      animals, online: true,
    };
  }
  function publishPub(force) {
    if (C.status !== 'ready' || !S || !S.coop || !S.coop.code) return;
    const snap = snapshot(), key = JSON.stringify(snap);
    if (!force && key === C.lastPub) return;
    C.lastPub = key; snap.t = C.net.now();
    C.net.set(`farms/${S.coop.code}/pub`, snap);
  }
  function myPos() {
    const ch = R.char;
    return { x: Math.round(ch.x), y: Math.round(ch.y), face: ch.face, mv: ch.moving ? 1 : 0, an: ch.anim || '', dir: ch.dir, name: S.name, outfit: S.outfit };
  }
  function publishPos() {
    if (C.status !== 'ready' || !S || !S.coop || !S.coop.code) return;
    const p = myPos(), key = JSON.stringify(p) + V.active;
    if (key === C.lastPos) return;
    C.lastPos = key;
    if (V.active) {
      C.net.set(`farms/${V.code}/visitors/${C.uid}`, p);
      if (!C.awaySent) { C.awaySent = true; C.net.remove(`farms/${S.coop.code}/pos`); }
    } else { C.awaySent = false; C.net.set(`farms/${S.coop.code}/pos`, p); }
  }

  function applyInbox(m) {
    if (!m || typeof m !== 'object') return;
    const who = String(m.name || 'Bạn bè').slice(0, 20);
    if (m.type === 'water') {
      const i = m.plot | 0, p = S.plots[i];
      if (i >= 0 && i < S.plotsOwned && p && p.crop && !p.wet && p.prog < CROPS[p.crop].grow) {
        p.wet = true;
        const r = plotRect(i); floater(r.x + r.w / 2, r.y + 8, `💧 ${who} tưới giúp`, '#bbdefb');
        toast(`💧 ${who} đã tưới giúp ô số ${i + 1}`, 'good');
      }
    } else if (m.type === 'gift') {
      const k = String(m.item), q = Math.floor(+m.qty);
      if (ITEMS[k] && q > 0 && q <= 999) {
        addInv(k, q); SND.coin();
        toast(`🎁 ${who} tặng bạn ${q} ${ITEMS[k].icon} ${ITEMS[k].name}`, 'good');
      }
    }
    saveGame();
  }

  /* ---------- Theo dõi người trên bản đồ đang xem (nhà mình hoặc nhà bạn) ---------- */
  function unwatch() { C.subs.forEach(f => f()); C.subs = []; C.peers = {}; }
  function upsertPeer(id, d, isOwner) {
    if (!d || typeof d.x !== 'number') { delete C.peers[id]; return; }
    let p = C.peers[id];
    if (!p) p = C.peers[id] = { x: d.x, y: d.y, tx: d.x, ty: d.y, dir: 1, face: 'down', moving: false, phase: 0, act: 0, actIcon: '', anim: null, animT: 0 };
    p.tx = clamp(d.x, 0, W); p.ty = clamp(+d.y || 0, 0, H);
    p.face = ['up', 'down', 'left', 'right'].includes(d.face) ? d.face : 'down'; p.dir = d.dir < 0 ? -1 : 1; p.netMoving = !!d.mv;
    p.name = String(d.name || '').slice(0, 16) || 'Bạn'; p.outfit = ENABLED_OUTFITS.includes(d.outfit) ? d.outfit : ENABLED_OUTFITS[0];
    p.owner = isOwner;
    const an = d.an === 'plant' || d.an === 'water' ? d.an : null;
    if (an && an !== p.anim) { p.anim = an; p.animT = 0; p.act = 1; } else if (!an) { p.anim = null; p.act = 0; }
  }
  function watchFarm(code, mine) {
    unwatch();
    C.subs.push(C.net.on(`farms/${code}/visitors`, all => {
      const seen = new Set();
      for (const id in (all || {})) {
        if (id === C.uid) continue;
        seen.add(id); upsertPeer(id, all[id], false);
        if (mine && !C.seenVisitors[id]) toast(`👋 ${C.peers[id].name} đang ghé thăm nông trại của bạn`, 'good');
      }
      for (const id in C.peers) if (!C.peers[id].owner && !seen.has(id)) delete C.peers[id];
      if (mine) { C.seenVisitors = {}; seen.forEach(id => C.seenVisitors[id] = true); }
      refreshPanel(true);
    }));
    if (!mine) {
      C.subs.push(C.net.on(`farms/${code}/pos`, d => upsertPeer('__owner', d, true)));
      C.subs.push(C.net.on(`farms/${code}/pub`, d => { if (d) setSnap(d); }));
    }
  }

  /* ---------- Ghé thăm ---------- */
  function setSnap(d) {
    V.snap = d; V.name = String(d.name || '').slice(0, 16);
    const plots = Array.from({ length: 24 }, (_, i) => {
      const p = d.plots && d.plots[i];
      return Array.isArray(p) && CROPS[p[0]] ? { crop: p[0], prog: +p[1] || 0, wet: !!p[2], w2: !!p[3], fert: +p[4] || 1 } : { crop: null, prog: 0, wet: false, w2: false, fert: 1 };
    });
    const animals = {};
    for (const t in ANIMALS) animals[t] = ((d.animals && d.animals[t]) || []).slice(0, 6).map(a => ({ st: ['hungry', 'busy', 'ready'].includes(a[0]) ? a[0] : 'hungry', prog: +a[1] || 0 }));
    V.base = { plots, animals, plotsOwned: clamp(d.plotsOwned | 0, 0, 24), lv: d.lv | 0 || 1, offers: [] };
    // vị trí gia súc của nông trại bạn tính riêng
    const keep = R.animPos; R.animPos = V.animPos; withProxy(() => rebuildAnimPos()); R.animPos = keep;
    if (V.active) R.animPos = V.animPos;
    updateBanner();
  }
  function proxy() { return Object.assign({}, S, V.base); }
  function withProxy(fn) { const real = S; S = proxy(); try { return fn(); } finally { S = real; } }

  async function visit(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (C.status !== 'ready') { toast('Chưa kết nối được máy chủ bạn bè', 'bad'); return; }
    if (code.length !== 6) { toast('Mã nông trại gồm 6 ký tự', 'bad'); return; }
    if (code === S.coop.code) { toast('Đây là mã nông trại của bạn 🙂'); return; }
    const owner = await C.net.get(`farms/${code}/owner`);
    if (!owner) { toast(`Không tìm thấy nông trại mã ${code}`, 'bad'); SND.error(); return; }
    const pub = await C.net.get(`farms/${code}/pub`);
    if (!pub) { toast('Nông trại này chưa có dữ liệu', 'bad'); return; }
    if (V.active) await leave(true);
    V.active = true; V.code = code; V.ownPos = { x: R.char.x, y: R.char.y }; V.ownAnimPos = R.animPos; V.animPos = {};
    setSnap(pub);
    R.animPos = V.animPos; R.queue = []; R.char.tx = null; R.char.x = 520; R.char.y = 430;
    C.net.onDisconnectRemove(`farms/${code}/visitors/${C.uid}`);
    C.lastPos = ''; publishPos();
    watchFarm(code, false);
    // lưu vào danh sách bạn bè
    const fr = S.coop.friends.filter(f => f.code !== code);
    fr.unshift({ code, name: V.name }); S.coop.friends = fr.slice(0, 20); saveGame();
    closeModal(); updateBanner();
    toast(`🏡 Đang thăm nông trại của ${V.name}`, 'good');
  }
  async function leave(silent) {
    if (!V.active) return;
    const code = V.code;
    V.active = false; V.code = null; V.snap = null; V.base = null;
    if (C.net) { C.net.remove(`farms/${code}/visitors/${C.uid}`); C.net.cancelDisconnect(`farms/${code}/visitors/${C.uid}`); }
    R.animPos = V.ownAnimPos || R.animPos; rebuildAnimPos();
    R.queue = []; R.char.tx = null;
    if (V.ownPos) { R.char.x = V.ownPos.x; R.char.y = V.ownPos.y; }
    if (C.net && S.coop.code) watchFarm(S.coop.code, true);
    C.lastPos = ''; updateBanner();
    if (!silent) toast('🏠 Đã về nông trại của bạn', 'good');
  }

  // tưới giúp ô đang khát nước của bạn bè (dùng nước của mình)
  function helpWater(i) {
    if (!V.active || !V.base) return;
    const p = V.base.plots[i], r = plotRect(i);
    if (!(i < V.base.plotsOwned && p.crop && !p.wet && p.prog < CROPS[p.crop].grow)) { floater(r.x + r.w / 2, r.y + 10, 'Ô này không cần tưới', '#fff'); return; }
    if (!useWater(WATER.plant)) return;
    p.wet = true;
    C.net.push(`farms/${V.code}/inbox`, { type: 'water', plot: i, from: C.uid, name: S.name, t: C.net.now() });
    SND.water(); startAct('water', '🚿');
    floater(r.x + r.w / 2, r.y + 8, `💧 Tưới giúp ${V.name}`, '#bbdefb');
    gainXp(1, r.x + r.w / 2, r.y);
  }
  function sendGift(k, q) {
    if (!V.active) return;
    q = Math.min(q, S.inv[k] || 0);
    if (!ITEMS[k] || q <= 0) { toast('Không đủ vật phẩm để tặng', 'bad'); return; }
    addInv(k, -q);
    C.net.push(`farms/${V.code}/inbox`, { type: 'gift', item: k, qty: q, from: C.uid, name: S.name, t: C.net.now() });
    SND.coin(); toast(`🎁 Đã tặng ${V.name} ${q} ${ITEMS[k].icon} ${ITEMS[k].name}`, 'good'); saveGame();
    openGift();
  }

  /* ---------- Vòng lặp: xuất bản, nội suy vị trí người khác ---------- */
  const baseUpdate = update;
  update = function (dt) {
    baseUpdate(dt);
    if (C.status !== 'ready' || !R.started) return;
    C.pubT += dt; C.posT += dt;
    if (C.pubT >= PUB_EVERY) { C.pubT = 0; publishPub(false); }
    if (C.posT >= POS_EVERY) { C.posT = 0; publishPos(); }
    for (const id in C.peers) {
      const p = C.peers[id], dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      const k = Math.min(1, dt * 8), mx = dx * k, my = dy * k;
      p.x += mx; p.y += my;
      const moved = Math.hypot(mx, my);
      p.moving = d > 2 || (p.netMoving && moved > 0.2);
      p.phase = p.moving ? p.phase + moved / STRIDE_PX : 0;
      if (p.anim) { p.animT += dt; }
    }
  };

  // vẽ nông trại bạn: tạm thay S bằng dữ liệu nông trại bạn trong lúc vẽ
  const baseDraw = draw;
  draw = function () {
    if (V.active && V.base && S) withProxy(baseDraw); else baseDraw();
  };
  // vẽ người khác trước nhân vật của mình
  const baseDrawChar = drawChar;
  drawChar = function () {
    if (S) for (const id in C.peers) {
      const p = C.peers[id];
      if (p.owner && V.snap && V.snap.online === false) continue;
      const rc = R.char, sn = S.name, so = S.outfit;
      R.char = p; S.name = (p.owner ? '🏡 ' : '') + p.name; S.outfit = p.outfit;
      try { baseDrawChar(); } finally { R.char = rc; S.name = sn; S.outfit = so; }
    }
    baseDrawChar();
  };

  // khi đang ghé thăm: chặn thao tác của nông trại mình, chỉ cho đi lại / tưới giúp
  cv.addEventListener('pointerdown', e => {
    if (!V.active || !R.started || R.modal || !e.isPrimary) return;
    e.stopImmediatePropagation();
    const p = toWorld(e), h = hitTest(p.x, p.y);
    if (!h) { R.queue = []; R.char.tx = clamp(p.x, 24, W - 24); R.char.ty = clamp(p.y, 196, H - 6); return; }
    if (h.type === 'plot') {
      const r = plotRect(h.i);
      if (R.queue.some(q => q.key === 'h' + h.i) || R.queue.length >= 12) return;
      R.char.tx = null;
      R.queue.push({ at: performance.now(), key: 'h' + h.i, x: r.x + r.w / 2, y: r.y + r.h - 4, mark: r, fn: () => helpWater(h.i) });
    } else if (h.type === 'build' && h.k === 'mailbox') openGift();
    else toast(`Đây là nông trại của ${V.name} — bạn có thể tưới giúp ô khát nước 💧 hoặc tặng quà 🎁`);
  }, true);

  /* ---------- Giao diện ---------- */
  const btn = document.createElement('button');
  btn.className = 'rbtn'; btn.id = 'btnFriends'; btn.title = 'Bạn bè';
  btn.innerHTML = '👥<span class="badge zero" id="friendsBadge">0</span><small>Bạn bè</small>';
  $('#topBtns').insertBefore(btn, $('#btnMenu'));
  btn.onclick = () => { SND.click(); openPanel(); };

  const banner = document.createElement('div');
  banner.id = 'coopBanner'; banner.className = 'hidden';
  $('#stage').appendChild(banner);
  banner.addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    SND.click(); if (b.dataset.c === 'gift') openGift(); else leave();
  });
  function updateBanner() {
    banner.classList.toggle('hidden', !V.active);
    if (!V.active) return;
    const on = V.snap && V.snap.online !== false;
    banner.innerHTML = `🏡 Nông trại của <b>${esc(V.name)}</b> · Lv ${V.base ? V.base.lv : '?'} <span class="muted">${on ? '🟢 đang online' : '⚪ đang offline'}</span>
      <button class="btn orange" data-c="gift">🎁 Tặng quà</button><button class="btn blue" data-c="home">↩ Về nhà</button>`;
  }

  function panelHtml() {
    if (C.status === 'off') return `<p>Tính năng bạn bè chưa được bật vì game chưa có cấu hình Firebase.</p>
      <p class="muted">Người quản lý game cần dán cấu hình vào file <b>firebase-config.js</b> (xem README).</p>`;
    if (C.status === 'loading') return '<p>⏳ Đang kết nối máy chủ bạn bè...</p>';
    if (C.status === 'error') return `<p>❌ Không kết nối được: ${esc(C.error)}</p><button class="btn" data-action="coopRetry">Thử lại</button>`;
    const cd = S.coop, guests = Object.values(C.peers).filter(p => !p.owner);
    return `
      <div class="toggle" style="background:#eaf6ff;border-color:#64b5f6"><span>🔑 Mã nông trại của bạn: <b style="font-size:22px;letter-spacing:3px">${cd.code || '…'}</b><br><small class="muted">Gửi mã này cho bạn bè để họ ghé thăm</small></span>
        <button class="btn blue" data-action="coopCopy">Sao chép</button></div>
      ${!V.active && guests.length ? `<div class="toggle"><span>👋 Đang ghé nông trại bạn: <b>${guests.map(g => esc(g.name)).join(', ')}</b></span></div>` : ''}
      ${V.active ? `<div class="toggle" style="background:#fff4e5;border-color:#ffb74d"><span>🏡 Bạn đang ở nông trại của <b>${esc(V.name)}</b></span><button class="btn blue" data-action="coopLeave">↩ Về nhà</button></div>` : ''}
      <h3>Ghé thăm bạn bè</h3>
      <div class="row"><input class="inp" id="coopCode" maxlength="6" placeholder="Nhập mã 6 ký tự" style="text-transform:uppercase;letter-spacing:3px">
        <button class="btn" data-action="coopVisitInput">Ghé thăm</button></div>
      <h3>Bạn bè đã ghé</h3>
      <div class="list" id="coopFriends">${cd.friends.length ? cd.friends.map(f => `<div class="item"><div class="ic">👧</div><div class="grow"><b>${esc(f.name || 'Bạn bè')}</b><div class="muted">Mã ${f.code} · <span data-online="${f.code}">…</span></div></div>
        <button class="btn" data-action="coopVisit" data-arg="${f.code}">Ghé thăm</button><button class="btn red" data-action="coopForget" data-arg="${f.code}">Xoá</button></div>`).join('') : '<p class="muted">Chưa có ai. Nhập mã của bạn bè ở trên nhé!</p>'}</div>
      <p class="muted">Khi ghé thăm: bấm vào ô đất đang khát nước 💧 để tưới giúp (dùng nước của bạn, +1 XP), bấm hộp thư hoặc nút 🎁 để tặng quà. Bạn không thể thu hoạch hay gieo hạt ở nông trại người khác.</p>`;
  }
  function openPanel() {
    openModal('👥 Bạn bè', panelHtml(), { kind: 'coop' });
    if (C.status === 'ready') S.coop.friends.forEach(async f => {
      const pub = await C.net.get(`farms/${f.code}/pub`);
      const el = document.querySelector(`[data-online="${f.code}"]`);
      if (!el) return;
      if (!pub) { el.textContent = 'không còn tồn tại'; return; }
      if (pub.name && pub.name !== f.name) { f.name = pub.name; }
      el.textContent = `Lv ${pub.lv} · ${pub.online === false ? '⚪ offline' : '🟢 online'}`;
    });
  }
  function refreshPanel(quiet) {
    $('#friendsBadge').textContent = Object.values(C.peers).filter(p => !p.owner).length;
    $('#friendsBadge').classList.toggle('zero', V.active || !Object.values(C.peers).some(p => !p.owner));
    if (R.modal === 'coop' && !quiet) openPanel();
  }
  function openGift() {
    if (!V.active) return;
    const keys = Object.keys(S.inv).filter(k => S.inv[k] > 0 && ITEMS[k]);
    openModal(`🎁 Tặng quà cho ${V.name}`, `<p class="muted">Quà được chuyển từ kho của bạn sang kho của ${esc(V.name)}${V.snap && V.snap.online === false ? ' (bạn ấy sẽ nhận khi vào game)' : ''}.</p>
      <div class="list">${keys.length ? keys.map(k => `<div class="item"><div class="ic">${ITEMS[k].icon}</div><div class="grow"><b>${ITEMS[k].name}</b> × ${S.inv[k]}</div>
        <button class="btn orange" data-action="coopGift" data-arg="${k}|1">Tặng 1</button>${S.inv[k] >= 5 ? `<button class="btn orange" data-action="coopGift" data-arg="${k}|5">Tặng 5</button>` : ''}</div>`).join('') : '<p>Kho của bạn đang trống.</p>'}</div>`, { kind: 'gift' });
  }

  Object.assign(ACTIONS, {
    coopCopy: () => {
      const code = S.coop.code; if (!code) return;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast(`Đã sao chép mã ${code}`, 'good'), () => toast(`Mã của bạn: ${code}`));
    },
    coopVisitInput: () => visit($('#coopCode').value),
    coopVisit: code => visit(code),
    coopForget: code => { S.coop.friends = S.coop.friends.filter(f => f.code !== code); saveGame(); openPanel(); },
    coopLeave: () => { closeModal(); leave(); },
    coopGift: a => { const [k, n] = a.split('|'); sendGift(k, +n); },
    coopRetry: () => { C.status = 'off'; C.net = null; connect(); openPanel(); },
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'coopCode') visit(e.target.value); });

  // bắt đầu kết nối khi vào game
  const baseStartGame = startGame;
  startGame = function (st) {
    if (V.active) leave(true);
    baseStartGame(st);
    coopData();
    if (C.status === 'ready') ensureMyFarm().catch(e => console.warn(e)); else connect();
  };
  addEventListener('beforeunload', () => {
    if (C.status !== 'ready') return;
    if (V.active) C.net.remove(`farms/${V.code}/visitors/${C.uid}`);
    if (S && S.coop && S.coop.code) C.net.set(`farms/${S.coop.code}/pub/online`, false);
  });
})();
