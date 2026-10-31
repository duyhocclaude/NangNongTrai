'use strict';
/* =========================================================
   COOP — GHÉ THĂM NÔNG TRẠI BẠN BÈ (Supabase)
   Nạp sau game.js và supabase-config.js. Mỗi người có một mã nông trại 6 ký tự; bạn bè nhập mã
   để ghé thăm, thấy nhau đi lại theo thời gian thực, tưới giúp ô đang khát nước và tặng quà.

   Supabase (xem supabase-setup.sql):
     bảng farms   code, owner, pub (ảnh chụp nông trại để khách xem), updated_at
     bảng inbox   việc khách làm giúp (tưới, tặng quà) — chủ áp dụng rồi xoá; còn đó khi chủ offline
     kênh realtime "farm:{code}"   vị trí mọi người, ảnh chụp mới, báo có việc giúp (không lưu)
   ========================================================= */
(() => {
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const PUB_EVERY = 2, PUB_HEARTBEAT = 30, POS_EVERY = 0.2, POS_HEARTBEAT = 2, PEER_TIMEOUT = 6; // giây
  const ONLINE_WINDOW = 90;                       // giây: chủ cập nhật gần đây thì coi là online
  const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

  const C = {
    net: null, uid: null, status: 'off',          // off | loading | ready | error
    error: '', peers: {},                          // người khác đang thấy trên bản đồ hiện tại
    pubT: 0, pubBeat: 0, posT: 0, posBeat: 0, lastPub: '', lastPos: '',
    ch: null,                                      // kênh realtime của nông trại đang đứng
    myCh: null,                                    // kênh nông trại của mình (nhận báo việc giúp khi đi vắng)
    applied: new Set(), seenVisitors: {},
  };
  const V = { active: false, code: null, snap: null, base: null, animPos: {}, ownPos: null, ownAnimPos: null, name: '' };
  window.COOP = C; window.COOP_VISIT = V;

  /* ---------- Lớp mạng: Supabase (hoặc COOP_BACKEND giả lập khi kiểm thử) ----------
     Giao diện chung:
       uid
       claimFarm(code) -> true nếu mã thuộc về mình (tạo mới hoặc đã là của mình)
       getFarm(code) -> { owner, pub, updatedAt } | null
       savePub(code, pub)
       channel(code, { onPos(id, d), onBye(id), onPub(pub), onInbox(row) }) -> { pos(id, d), bye(id), pub(p), inbox(row), close() }
       sendInbox(code, row)      row = { id, msg }
       listInbox(code) -> [{ id, msg }]
       deleteInbox(id)
  */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Không tải được thư viện Supabase')); document.head.appendChild(s); });
  }
  async function supabaseBackend(cfg) {
    if (!window.supabase) await loadScript(SUPABASE_JS);
    const sb = window.supabase.createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
    let { data: { session } } = await sb.auth.getSession();
    if (!session) {
      const r = await sb.auth.signInAnonymously();
      if (r.error) throw new Error('Đăng nhập ẩn danh thất bại: ' + r.error.message + ' (đã bật Anonymous sign-ins chưa?)');
      session = r.data.session;
    }
    const uid = session.user.id;
    let accessToken = session.access_token;
    sb.auth.onAuthStateChange((ev, s) => { if (s) accessToken = s.access_token; });
    const chk = r => { if (r.error) throw new Error(r.error.message); return r.data; };
    return {
      uid,
      rpc: async (fn, args) => chk(await sb.rpc(fn, args)),
      // gửi được cả khi đang đóng trang (pagehide)
      rpcKeepalive: (fn, args) => fetch(`${cfg.url}/rest/v1/rpc/${fn}`, {
        method: 'POST', keepalive: true, body: JSON.stringify(args),
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      }).catch(() => {}),
      claimFarm: async code => {
        const ins = await sb.from('farms').insert({ code, owner: uid });
        if (!ins.error) return true;
        if (ins.error.code !== '23505') throw new Error(ins.error.message);   // 23505 = mã đã tồn tại
        const row = chk(await sb.from('farms').select('owner').eq('code', code).maybeSingle());
        return !!row && row.owner === uid;
      },
      getFarm: async code => {
        const row = chk(await sb.from('farms').select('owner,pub,updated_at').eq('code', code).maybeSingle());
        return row && { owner: row.owner, pub: row.pub, updatedAt: Date.parse(row.updated_at) };
      },
      savePub: async (code, pub) => { chk(await sb.from('farms').update({ pub, updated_at: new Date().toISOString() }).eq('code', code)); },
      channel: (code, h) => {
        const ch = sb.channel('farm:' + code, { config: { broadcast: { self: false } } });
        ch.on('broadcast', { event: 'pos' }, ({ payload: p }) => h.onPos && h.onPos(p.id, p.d))
          .on('broadcast', { event: 'bye' }, ({ payload: p }) => h.onBye && h.onBye(p.id))
          .on('broadcast', { event: 'pub' }, ({ payload: p }) => h.onPub && h.onPub(p))
          .on('broadcast', { event: 'inbox' }, ({ payload: p }) => h.onInbox && h.onInbox(p))
          .subscribe();
        const send = (event, payload) => ch.send({ type: 'broadcast', event, payload });
        return { pos: (id, d) => send('pos', { id, d }), bye: id => send('bye', { id }), pub: p => send('pub', p), inbox: row => send('inbox', row), close: () => sb.removeChannel(ch) };
      },
      sendInbox: async (code, row) => { chk(await sb.from('inbox').insert({ id: row.id, code, msg: row.msg })); },
      listInbox: async code => (chk(await sb.from('inbox').select('id,msg').eq('code', code).order('created_at')) || []),
      deleteInbox: async id => { await sb.from('inbox').delete().eq('id', id); },
    };
  }

  // Kết nối Supabase dùng chung (bạn bè + tài khoản mã cá nhân)
  let netPromise = null;
  C.enabled = () => !!window.COOP_BACKEND || !!(window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey);
  C.getNet = () => {
    if (C.net) return Promise.resolve(C.net);
    if (!C.enabled()) return Promise.reject(new Error('Game chưa có cấu hình Supabase'));
    if (!netPromise) netPromise = (window.COOP_BACKEND ? window.COOP_BACKEND() : supabaseBackend(window.SUPABASE_CONFIG))
      .then(n => { C.net = n; C.uid = n.uid; return n; }, e => { netPromise = null; throw e; });
    return netPromise;
  };

  async function connect() {
    if (C.status === 'ready' || C.status === 'loading') return;
    if (!C.enabled()) { C.status = 'off'; return; }
    C.status = 'loading'; refreshPanel();
    try {
      await C.getNet();
      C.status = 'ready';
      await ensureMyFarm();
    } catch (e) {
      C.status = 'error'; C.error = e && e.message || String(e);
      console.warn('Coop:', e);
    }
    refreshPanel();
  }
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

  /* ---------- Nông trại của mình: mã, xuất bản trạng thái, nhận việc giúp ---------- */
  function randomCode() { let s = ''; for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; }
  function coopData() { if (!S.coop) S.coop = { code: null, friends: [] }; return S.coop; }

  async function ensureMyFarm() {
    const cd = coopData();
    let ok = cd.code ? await C.net.claimFarm(cd.code) : false;   // mã cũ vẫn là của mình?
    if (!ok) {
      const old = cd.code;
      for (let tries = 0; tries < 8 && !ok; tries++) { cd.code = randomCode(); ok = await C.net.claimFarm(cd.code); }
      if (!ok) throw new Error('Không tạo được mã nông trại');
      saveGame();
      if (old) toast(`Mã nông trại mới của bạn: ${cd.code}`, 'good');
    }
    C.lastPub = ''; await publishPub(true);
    // kênh nhà mình: luôn nghe báo việc giúp, kể cả khi đang đi thăm nhà khác
    if (C.myCh) C.myCh.close();
    C.myCh = C.net.channel(cd.code, {
      onInbox: row => handleInbox(row),
      onPos: (id, d) => { if (!V.active) onPeerPos(id, d, false, true); },
      onBye: id => { if (!V.active) { delete C.peers[id]; refreshPanel(true); } },
    });
    // việc giúp gửi tới lúc mình offline
    (await C.net.listInbox(cd.code)).forEach(handleInbox);
    if (!V.active) { C.peers = {}; C.ch = C.myCh; }
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
  async function publishPub(force) {
    if (C.status !== 'ready' || !S || !S.coop || !S.coop.code) return;
    const snap = snapshot(), key = JSON.stringify(snap);
    if (!force && key === C.lastPub) return;
    C.lastPub = key; C.pubBeat = 0;
    if (C.myCh) C.myCh.pub(snap);                            // khách đang xem thấy ngay
    try { await C.net.savePub(S.coop.code, snap); } catch (e) { console.warn('Coop savePub:', e); }
  }
  function myPos() {
    const ch = R.char;
    return { x: Math.round(ch.x), y: Math.round(ch.y), face: ch.face, mv: ch.moving ? 1 : 0, an: ch.anim || '', dir: ch.dir, name: S.name, outfit: S.outfit, owner: V.active ? 0 : 1 };
  }
  function publishPos(beat) {
    if (C.status !== 'ready' || !C.ch) return;
    const p = myPos(), key = JSON.stringify(p) + V.code;
    if (!beat && key === C.lastPos) return;
    C.lastPos = key; C.posBeat = 0;
    C.ch.pos(C.uid, p);
  }

  function handleInbox(row) {
    if (!row || !row.id || C.applied.has(row.id)) return;
    C.applied.add(row.id);
    applyInbox(row.msg);
    C.net.deleteInbox(row.id).catch(() => {});
  }
  function applyInbox(m) {
    if (!m || typeof m !== 'object') return;
    const who = String(m.name || 'Bạn bè').slice(0, 20);
    if (m.type === 'water') {
      const i = m.plot | 0, p = S.plots[i];
      if (i >= 0 && i < S.plotsOwned && p && p.crop && !p.wet && p.prog < CROPS[p.crop].grow) {
        p.wet = true;
        if (!V.active) { const r = plotRect(i); floater(r.x + r.w / 2, r.y + 8, `💧 ${who} tưới giúp`, '#bbdefb'); }
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

  /* ---------- Người khác trên bản đồ đang xem ---------- */
  function onPeerPos(id, d, viewingOther, mine) {
    if (id === C.uid || !d || typeof d.x !== 'number') return;
    // ở nhà mình: chỉ vẽ khách; ở nhà bạn: vẽ chủ (owner=1) và các khách khác
    let p = C.peers[id];
    const isNew = !p;
    if (!p) p = C.peers[id] = { x: d.x, y: d.y, tx: d.x, ty: d.y, dir: 1, face: 'down', moving: false, phase: 0, act: 0, actIcon: '', anim: null, animT: 0 };
    p.tx = clamp(d.x, 0, W); p.ty = clamp(+d.y || 0, 0, H); p.seen = performance.now();
    p.face = ['up', 'down', 'left', 'right'].includes(d.face) ? d.face : 'down'; p.dir = d.dir < 0 ? -1 : 1; p.netMoving = !!d.mv;
    p.name = String(d.name || '').slice(0, 16) || 'Bạn'; p.outfit = ENABLED_OUTFITS.includes(d.outfit) ? d.outfit : ENABLED_OUTFITS[0];
    p.owner = !!d.owner;
    const an = d.an === 'plant' || d.an === 'water' ? d.an : null;
    if (an && an !== p.anim) { p.anim = an; p.animT = 0; p.act = 1; } else if (!an) { p.anim = null; p.act = 0; }
    if (isNew && mine && !p.owner && !C.seenVisitors[id]) { C.seenVisitors[id] = true; toast(`👋 ${p.name} đang ghé thăm nông trại của bạn`, 'good'); }
    if (isNew) refreshPanel(true);
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
  function ownerOnline() {
    const o = Object.values(C.peers).find(p => p.owner);
    return !!o || (V.updatedAt && Date.now() - V.updatedAt < ONLINE_WINDOW * 1000);
  }

  async function visit(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (C.status !== 'ready') { toast('Chưa kết nối được máy chủ bạn bè', 'bad'); return; }
    if (code.length !== 6) { toast('Mã nông trại gồm 6 ký tự', 'bad'); return; }
    if (code === S.coop.code) { toast('Đây là mã nông trại của bạn 🙂'); return; }
    let farm;
    try { farm = await C.net.getFarm(code); } catch (e) { toast('Lỗi kết nối: ' + e.message, 'bad'); return; }
    if (!farm) { toast(`Không tìm thấy nông trại mã ${code}`, 'bad'); SND.error(); return; }
    if (!farm.pub) { toast('Nông trại này chưa có dữ liệu', 'bad'); return; }
    if (V.active) leave(true);
    if (C.ch && C.ch === C.myCh) C.myCh.bye(C.uid);       // rời nhà mình
    V.active = true; V.code = code; V.updatedAt = farm.updatedAt;
    V.ownPos = { x: R.char.x, y: R.char.y }; V.ownAnimPos = R.animPos; V.animPos = {};
    C.peers = {};
    setSnap(farm.pub);
    R.animPos = V.animPos; R.queue = []; R.char.tx = null; R.char.x = 520; R.char.y = 430;
    C.ch = C.net.channel(code, {
      onPos: (id, d) => onPeerPos(id, d, true, false),
      onBye: id => { delete C.peers[id]; updateBanner(); },
      onPub: p => { if (p && V.active && V.code === code) { V.updatedAt = Date.now(); setSnap(p); } },
    });
    C.lastPos = ''; setTimeout(() => publishPos(true), 300);
    // lưu vào danh sách bạn bè
    const fr = S.coop.friends.filter(f => f.code !== code);
    fr.unshift({ code, name: V.name }); S.coop.friends = fr.slice(0, 20); saveGame();
    closeModal(); updateBanner();
    toast(`🏡 Đang thăm nông trại của ${V.name}`, 'good');
  }
  function leave(silent) {
    if (!V.active) return;
    if (C.ch && C.ch !== C.myCh) { C.ch.bye(C.uid); const ch = C.ch; setTimeout(() => ch.close(), 300); }
    V.active = false; V.code = null; V.snap = null; V.base = null;
    R.animPos = V.ownAnimPos || R.animPos; rebuildAnimPos();
    R.queue = []; R.char.tx = null;
    if (V.ownPos) { R.char.x = V.ownPos.x; R.char.y = V.ownPos.y; }
    C.peers = {}; C.ch = C.myCh; C.lastPos = ''; publishPos(true);
    updateBanner(); refreshPanel(true);
    if (!silent) toast('🏠 Đã về nông trại của bạn', 'good');
  }

  async function sendHelp(msg) {
    const row = { id: newId(), msg: Object.assign(msg, { name: S.name, t: Date.now() }) };
    const code = V.code, ch = C.ch;
    try { await C.net.sendInbox(code, row); ch && ch.inbox(row); return true; }
    catch (e) { toast('Không gửi được: ' + e.message, 'bad'); return false; }
  }
  // tưới giúp ô đang khát nước của bạn bè (dùng nước của mình)
  function helpWater(i) {
    if (!V.active || !V.base) return;
    const p = V.base.plots[i], r = plotRect(i);
    if (!(i < V.base.plotsOwned && p.crop && !p.wet && p.prog < CROPS[p.crop].grow)) { floater(r.x + r.w / 2, r.y + 10, 'Ô này không cần tưới', '#fff'); return; }
    if (!useWater(WATER.plant)) return;
    p.wet = true;
    sendHelp({ type: 'water', plot: i });
    SND.water(); startAct('water', '🚿');
    floater(r.x + r.w / 2, r.y + 8, `💧 Tưới giúp ${V.name}`, '#bbdefb');
    gainXp(1, r.x + r.w / 2, r.y);
  }
  async function sendGift(k, q) {
    if (!V.active) return;
    q = Math.min(q, S.inv[k] || 0);
    if (!ITEMS[k] || q <= 0) { toast('Không đủ vật phẩm để tặng', 'bad'); return; }
    addInv(k, -q);
    if (!(await sendHelp({ type: 'gift', item: k, qty: q }))) { addInv(k, q); return; }   // gửi lỗi thì trả lại
    SND.coin(); toast(`🎁 Đã tặng ${V.name} ${q} ${ITEMS[k].icon} ${ITEMS[k].name}`, 'good'); saveGame();
    if (R.modal === 'gift') openGift();
  }

  /* ---------- Vòng lặp: xuất bản, nội suy vị trí người khác ---------- */
  const baseUpdate = update;
  update = function (dt) {
    baseUpdate(dt);
    if (C.status !== 'ready' || !R.started) return;
    C.pubT += dt; C.pubBeat += dt; C.posT += dt; C.posBeat += dt;
    if (C.pubT >= PUB_EVERY) { C.pubT = 0; publishPub(C.pubBeat >= PUB_HEARTBEAT); }
    if (C.posT >= POS_EVERY) { C.posT = 0; publishPos(C.posBeat >= POS_HEARTBEAT); }
    const now = performance.now();
    for (const id in C.peers) {
      const p = C.peers[id];
      if (now - p.seen > PEER_TIMEOUT * 1000) { delete C.peers[id]; refreshPanel(true); continue; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      const k = Math.min(1, dt * 8), mx = dx * k, my = dy * k;
      p.x += mx; p.y += my;
      const moved = Math.hypot(mx, my);
      p.moving = d > 2 || (p.netMoving && moved > 0.2);
      p.phase = p.moving ? p.phase + moved / STRIDE_PX : 0;
      if (p.anim) p.animT += dt;
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
      if (!V.active && p.owner) continue;                   // ở nhà mình chỉ vẽ khách
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
    banner.innerHTML = `🏡 Nông trại của <b>${esc(V.name)}</b> · Lv ${V.base ? V.base.lv : '?'} <span class="muted">${ownerOnline() ? '🟢 đang online' : '⚪ đang offline'}</span>
      <button class="btn orange" data-c="gift">🎁 Tặng quà</button><button class="btn blue" data-c="home">↩ Về nhà</button>`;
  }
  setInterval(() => { if (V.active) updateBanner(); }, 3000);

  function panelHtml() {
    if (C.status === 'off') return `<p>Tính năng bạn bè chưa được bật vì game chưa có cấu hình Supabase.</p>
      <p class="muted">Người quản lý game cần điền file <b>supabase-config.js</b> (xem README).</p>`;
    if (C.status === 'loading') return '<p>⏳ Đang kết nối máy chủ bạn bè...</p>';
    if (C.status === 'error') return `<p>❌ Không kết nối được: ${esc(C.error)}</p><button class="btn" data-action="coopRetry">Thử lại</button>`;
    const cd = S.coop, guests = V.active ? [] : Object.values(C.peers).filter(p => !p.owner);
    return `
      <div class="toggle" style="background:#eaf6ff;border-color:#64b5f6"><span>🔑 Mã nông trại của bạn: <b style="font-size:22px;letter-spacing:3px">${cd.code || '…'}</b><br><small class="muted">Gửi mã này cho bạn bè để họ ghé thăm</small></span>
        <button class="btn blue" data-action="coopCopy">Sao chép</button></div>
      ${guests.length ? `<div class="toggle"><span>👋 Đang ghé nông trại bạn: <b>${guests.map(g => esc(g.name)).join(', ')}</b></span></div>` : ''}
      ${V.active ? `<div class="toggle" style="background:#fff4e5;border-color:#ffb74d"><span>🏡 Bạn đang ở nông trại của <b>${esc(V.name)}</b></span><button class="btn blue" data-action="coopLeave">↩ Về nhà</button></div>` : ''}
      <h3>Ghé thăm bạn bè</h3>
      <div class="row"><input class="inp" id="coopCode" maxlength="6" placeholder="Nhập mã 6 ký tự" style="text-transform:uppercase;letter-spacing:3px">
        <button class="btn" data-action="coopVisitInput">Ghé thăm</button></div>
      <h3>Bạn bè đã ghé</h3>
      <div class="list">${cd.friends.length ? cd.friends.map(f => `<div class="item"><div class="ic">👧</div><div class="grow"><b>${esc(f.name || 'Bạn bè')}</b><div class="muted">Mã ${f.code} · <span data-online="${f.code}">…</span></div></div>
        <button class="btn" data-action="coopVisit" data-arg="${f.code}">Ghé thăm</button><button class="btn red" data-action="coopForget" data-arg="${f.code}">Xoá</button></div>`).join('') : '<p class="muted">Chưa có ai. Nhập mã của bạn bè ở trên nhé!</p>'}</div>
      <p class="muted">Khi ghé thăm: bấm vào ô đất đang khát nước 💧 để tưới giúp (dùng nước của bạn, +1 XP), bấm hộp thư hoặc nút 🎁 để tặng quà. Bạn không thể thu hoạch hay gieo hạt ở nông trại người khác.</p>`;
  }
  function openPanel() {
    openModal('👥 Bạn bè', panelHtml(), { kind: 'coop' });
    if (C.status === 'ready') S.coop.friends.forEach(async f => {
      let farm = null; try { farm = await C.net.getFarm(f.code); } catch (e) { /* bỏ qua */ }
      const el = document.querySelector(`[data-online="${f.code}"]`);
      if (!el) return;
      if (!farm || !farm.pub) { el.textContent = 'không còn tồn tại'; return; }
      if (farm.pub.name) f.name = farm.pub.name;
      const on = farm.updatedAt && Date.now() - farm.updatedAt < ONLINE_WINDOW * 1000;
      el.textContent = `Lv ${farm.pub.lv} · ${on ? '🟢 online' : '⚪ offline'}`;
    });
  }
  function refreshPanel(quiet) {
    const n = V.active ? 0 : Object.values(C.peers).filter(p => !p.owner).length;
    $('#friendsBadge').textContent = n; $('#friendsBadge').classList.toggle('zero', !n);
    if (R.modal === 'coop' && !quiet) openPanel();
  }
  function openGift() {
    if (!V.active) return;
    const keys = Object.keys(S.inv).filter(k => S.inv[k] > 0 && ITEMS[k]);
    openModal(`🎁 Tặng quà cho ${V.name}`, `<p class="muted">Quà được chuyển từ kho của bạn sang kho của ${esc(V.name)}${ownerOnline() ? '' : ' (bạn ấy sẽ nhận khi vào game)'}.</p>
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
    coopRetry: () => { C.status = 'off'; connect(); },
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'coopCode') visit(e.target.value); });

  // bắt đầu kết nối khi vào game
  const baseStartGame = startGame;
  startGame = function (st) {
    if (V.active) leave(true);
    baseStartGame(st);
    coopData(); C.applied = new Set(); C.peers = {};
    if (C.status === 'ready') ensureMyFarm().catch(e => console.warn(e)); else connect();
  };
  addEventListener('pagehide', () => { if (C.status === 'ready' && C.ch) C.ch.bye(C.uid); });
})();
