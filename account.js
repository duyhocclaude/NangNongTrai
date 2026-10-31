'use strict';
/* =========================================================
   MÃ CÁ NHÂN — LƯU GAME LÊN MÂY (Supabase, xem supabase-account.sql)
   Nạp sau coop.js. Tạo mã cá nhân (NT-XXXX-XXXX) + mật khẩu; máy khác chỉ cần nhập mã + mật khẩu
   là chơi tiếp. Game tự lưu lên mây mỗi 30 giây. Nếu máy khác vừa lưu, hỏi người chơi giữ bản nào.

   Trên máy chỉ giữ "vé" đăng nhập (localStorage, khoá SAVE_KEY + '_acc'), không giữ mật khẩu.
   ========================================================= */
(() => {
  const SYNC_EVERY = 30;   // giây
  const A = { link: null, lastSaved: '', busy: false, conflict: false, t: 0 };
  window.ACCOUNT = A;

  const accKey = () => SAVE_KEY + '_acc';
  const fmtCode = c => c ? `NT-${c.slice(0, 4)}-${c.slice(4)}` : '';
  const normCode = s => String(s || '').toUpperCase().replace(/^NT/, '').replace(/[^A-Z0-9]/g, '');
  function loadLink() { try { return JSON.parse(localStorage.getItem(accKey()) || 'null'); } catch (e) { return null; } }
  function storeLink() { try { if (A.link) localStorage.setItem(accKey(), JSON.stringify(A.link)); else localStorage.removeItem(accKey()); } catch (e) { /* bỏ qua */ } }
  function timeStr(t) { if (!t) return 'chưa'; const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; }
  async function rpc(fn, args) { const net = await COOP.getNet(); return net.rpc(fn, args); }

  /* ---------- Đồng bộ ---------- */
  async function sync(force) {
    if (!A.link || A.conflict || A.busy || !R.started || !S || S.accCode !== A.link.code) return;
    const data = JSON.parse(JSON.stringify(S)), key = JSON.stringify(data);
    if (key === A.lastSaved && !force) return;
    A.busy = true;
    try {
      let res = await rpc('acc_save', { p_code: A.link.code, p_token: A.link.token, p_data: data, p_rev: A.link.rev, p_force: !!force });
      // lần lưu lúc đóng trang bị mất: bản trên mây vẫn là của chính máy này -> lưu lại bình thường
      if (res && res.conflict && res.rev === A.link.rev - 1 && A.link.pending) {
        res = await rpc('acc_save', { p_code: A.link.code, p_token: A.link.token, p_data: data, p_rev: res.rev, p_force: false });
      }
      if (res && res.error) {
        if (res.auth) { toast('☁️ ' + res.error, 'bad'); A.link = null; storeLink(); }
        else toast('☁️ Không lưu được lên mây: ' + res.error, 'bad');
      } else if (res && res.conflict) showConflict(res);
      else if (res) { A.link.rev = res.rev; A.link.syncedAt = Date.now(); A.link.pending = false; A.lastSaved = key; storeLink(); }
    } catch (e) { console.warn('Account sync:', e); }
    A.busy = false;
    if (R.modal === 'menu') openMenu();
  }

  function showConflict(res) {
    A.conflict = true;
    openModal('☁️ Tài khoản vừa được chơi ở máy khác', `
      <p>Mã cá nhân <b>${fmtCode(A.link.code)}</b> đã được lưu từ một máy khác lúc <b>${timeStr(Date.parse(res.updated_at))}</b>.</p>
      <div class="invoice"><table>
        <tr><td>☁️ Bản trên mây</td><td class="r">${esc(res.name || '')} · Lv ${res.lv} · Ngày ${res.day}</td></tr>
        <tr><td>💻 Bản trên máy này</td><td class="r">${esc(S.name)} · Lv ${S.lv} · Ngày ${S.day}</td></tr></table></div>
      <p class="muted">Chọn bản muốn giữ. Bản còn lại sẽ bị thay thế.</p>
      <div style="text-align:center"><button class="btn blue" data-action="accPull">☁️ Tải bản trên mây về</button>
      <button class="btn orange" data-action="accKeepLocal">💻 Giữ bản máy này</button></div>`, { kind: 'accConflict', narrow: true, noClose: true });
  }

  /* ---------- Giao diện ---------- */
  function sectionHtml() {
    if (!COOP.enabled()) return '';
    if (A.link && S && S.accCode === A.link.code) {
      return `<div class="toggle" style="background:#e8f5e9;border-color:#81c784;flex-wrap:wrap;gap:4px">
        <span>☁️ Mã cá nhân: <b style="letter-spacing:1px">${fmtCode(A.link.code)}</b><br><small class="muted">Đã lưu lên mây lúc ${timeStr(A.link.syncedAt)} · tự lưu mỗi ${SYNC_EVERY} giây</small></span>
        <span><button class="btn" data-action="accSync">Lưu ngay</button><button class="btn blue" data-action="accCopy">Sao chép mã</button>
        <button class="btn blue" data-action="accPassForm">Đổi mật khẩu</button><button class="btn red" data-action="accLogout">Đăng xuất</button></span></div>`;
    }
    return `<div class="toggle" style="background:#e8f5e9;border-color:#81c784;flex-wrap:wrap;gap:4px">
      <span>☁️ <b>Mã cá nhân</b> — lưu game lên mây, đổi máy chỉ cần nhập mã + mật khẩu</span>
      <span><button class="btn" data-action="accCreateForm">Tạo mã</button><button class="btn blue" data-action="accLoginForm">Đăng nhập</button></span></div>`;
  }
  const baseOpenMenu = openMenu;
  openMenu = function () { baseOpenMenu(); $('#modalBody').insertAdjacentHTML('afterbegin', sectionHtml()); };

  // nút đăng nhập ở màn hình bắt đầu
  const startBtn = document.createElement('div');
  startBtn.style.marginTop = '6px';
  startBtn.innerHTML = '<button class="btn" id="btnAccStart" style="background:#2e7d32">☁️ Đăng nhập bằng mã cá nhân</button>';
  $('#btnRestoreStart').parentNode.after(startBtn);
  const baseShowStart = showStart;
  showStart = function () { baseShowStart(); startBtn.classList.toggle('hidden', !COOP.enabled()); };
  $('#btnAccStart').onclick = () => { SND.click(); loginForm(); };

  function createForm() {
    openModal('☁️ Tạo mã cá nhân', `<p>Game sẽ tạo cho <b>${esc(S.name)}</b> một mã cá nhân. Đặt mật khẩu để đăng nhập trên máy khác.</p>
      <label class="lbl">Mật khẩu (ít nhất 6 ký tự)</label><input class="inp" id="accPass" type="password" autocomplete="new-password">
      <label class="lbl">Nhập lại mật khẩu</label><input class="inp" id="accPass2" type="password" autocomplete="new-password">
      <div style="text-align:center;margin-top:10px"><button class="btn" data-action="accCreate">Tạo mã cá nhân</button></div>`, { kind: 'acc', narrow: true });
    $('#accPass').focus();
  }
  function loginForm() {
    openModal('☁️ Đăng nhập bằng mã cá nhân', `<p class="muted">Nhập mã cá nhân (dạng NT-XXXX-XXXX) và mật khẩu. Tiến trình trên mây sẽ được tải về máy này.</p>
      <label class="lbl">Mã cá nhân</label><input class="inp" id="accCode" placeholder="NT-XXXX-XXXX" autocomplete="username" style="text-transform:uppercase;letter-spacing:2px">
      <label class="lbl">Mật khẩu</label><input class="inp" id="accLoginPass" type="password" autocomplete="current-password">
      <div style="text-align:center;margin-top:10px"><button class="btn" data-action="accLogin">Đăng nhập</button></div>`, { kind: 'acc', narrow: true });
    $('#accCode').focus();
  }
  function passForm() {
    openModal('🔑 Đổi mật khẩu', `<label class="lbl">Mật khẩu hiện tại</label><input class="inp" id="accOld" type="password" autocomplete="current-password">
      <label class="lbl">Mật khẩu mới (ít nhất 6 ký tự)</label><input class="inp" id="accNew" type="password" autocomplete="new-password">
      <div style="text-align:center;margin-top:10px"><button class="btn" data-action="accChangePass">Đổi mật khẩu</button></div>`, { kind: 'acc', narrow: true });
  }
  // khi đang ở màn hình bắt đầu, hộp thoại nằm trên màn hình đó; đóng hộp thoại không được chạy game
  const startOpen = () => !$('#start').classList.contains('hidden');
  function closeAccModal() { if (startOpen()) { $('#modalBg').classList.add('hidden'); R.modal = null; } else closeModal(); }

  Object.assign(ACTIONS, {
    accCreateForm: () => createForm(),
    accLoginForm: () => loginForm(),
    accPassForm: () => passForm(),
    accCreate: async () => {
      const p1 = $('#accPass').value, p2 = $('#accPass2').value;
      if (p1.length < 6) { toast('Mật khẩu cần ít nhất 6 ký tự', 'bad'); return; }
      if (p1 !== p2) { toast('Hai mật khẩu không giống nhau', 'bad'); return; }
      try {
        const data = JSON.parse(JSON.stringify(S));
        const res = await rpc('acc_create', { p_pass: p1, p_data: data });
        if (res.error) { toast(res.error, 'bad'); return; }
        S.accCode = res.code; saveGame();
        A.link = { code: res.code, token: res.token, rev: res.rev, syncedAt: Date.now() }; A.lastSaved = ''; storeLink();
        await sync();
        SND.levelup();
        openModal('☁️ Đã tạo mã cá nhân', `<div style="text-align:center"><p>Mã cá nhân của <b>${esc(S.name)}</b>:</p>
          <div style="font-size:34px;font-weight:800;letter-spacing:3px;color:#2e7d32">${fmtCode(res.code)}</div>
          <p class="muted">Hãy <b>ghi lại mã này và mật khẩu</b>. Trên máy khác: màn hình bắt đầu → ☁️ Đăng nhập bằng mã cá nhân.<br>Mất cả mã lẫn mật khẩu thì không lấy lại được.</p>
          <button class="btn blue" data-action="accCopy">Sao chép mã</button><button class="btn" data-action="close">Đã ghi lại</button></div>`, { kind: 'acc', narrow: true });
      } catch (e) { toast('Không tạo được: ' + e.message + ' (đã chạy supabase-account.sql chưa?)', 'bad'); }
    },
    accLogin: async () => {
      const code = normCode($('#accCode').value), pass = $('#accLoginPass').value;
      if (code.length !== 8) { toast('Mã cá nhân gồm 8 ký tự sau "NT-"', 'bad'); return; }
      try {
        const res = await rpc('acc_login', { p_code: code, p_pass: pass });
        if (res.error) { toast(res.error, 'bad'); SND.error(); return; }
        if (!res.data || !res.data.name) { toast('Tài khoản chưa có dữ liệu game', 'bad'); return; }
        if (R.started && S && S.accCode !== res.code && !confirm(`Tải nhân vật "${res.data.name}" (Lv ${res.data.lv}) về máy này? Tiến trình đang chơi (${S.name}) sẽ bị thay thế — hãy sao lưu trước nếu cần.`)) return;
        const data = res.data; data.accCode = res.code;
        A.link = { code: res.code, token: res.token, rev: res.rev, syncedAt: Date.parse(res.updated_at) || Date.now() };
        A.conflict = false; A.lastSaved = JSON.stringify(data); storeLink();
        $('#modalBg').classList.add('hidden'); R.modal = null;
        startGame(data);
        toast(`☁️ Chào mừng trở lại, ${data.name}!`, 'good');
      } catch (e) { toast('Không đăng nhập được: ' + e.message, 'bad'); }
    },
    accCopy: () => {
      const c = fmtCode(A.link && A.link.code); if (!c) return;
      (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(() => toast(`Đã sao chép ${c}`, 'good'), () => toast(`Mã của bạn: ${c}`));
    },
    accLogout: async () => {
      if (!A.link) return;
      if (!confirm('Đăng xuất mã cá nhân trên máy này? Tiến trình vẫn còn trên máy và trên mây; muốn đồng bộ lại thì đăng nhập lại.')) return;
      await sync();
      try { await rpc('acc_logout', { p_code: A.link.code, p_token: A.link.token }); } catch (e) { /* bỏ qua */ }
      A.link = null; storeLink(); delete S.accCode; saveGame(); openMenu(); toast('Đã đăng xuất mã cá nhân trên máy này');
    },
    accChangePass: async () => {
      const o = $('#accOld').value, n = $('#accNew').value;
      try {
        const res = await rpc('acc_change_pass', { p_code: A.link.code, p_old: o, p_new: n });
        if (res.error) { toast(res.error, 'bad'); return; }
        toast('🔑 Đã đổi mật khẩu', 'good'); closeAccModal();
      } catch (e) { toast('Lỗi: ' + e.message, 'bad'); }
    },
    accPull: async () => {
      try {
        const res = await rpc('acc_pull', { p_code: A.link.code, p_token: A.link.token });
        if (res.error) { toast(res.error, 'bad'); return; }
        const data = res.data; data.accCode = A.link.code;
        A.link.rev = res.rev; A.link.syncedAt = Date.parse(res.updated_at) || Date.now(); A.link.pending = false;
        A.conflict = false; A.lastSaved = JSON.stringify(data); storeLink();
        $('#modalBg').classList.add('hidden'); R.modal = null; S.dayOver = false;
        startGame(data); toast('☁️ Đã tải bản trên mây về', 'good');
      } catch (e) { toast('Lỗi: ' + e.message, 'bad'); }
    },
    accKeepLocal: async () => {
      A.conflict = false; $('#modalBg').classList.add('hidden'); R.modal = null; R.paused = false;
      await sync(true); toast('☁️ Đã lưu bản máy này lên mây', 'good');
    },
  });
  ACTIONS.accSync = () => { toast('☁️ Đang lưu lên mây...'); sync(); };
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'accLoginPass' || e.target.id === 'accCode') ACTIONS.accLogin();
    if (e.target.id === 'accPass2') ACTIONS.accCreate();
  });

  /* ---------- Gắn vào vòng đời game ---------- */
  A.link = loadLink();
  const baseStartGame = startGame;
  startGame = function (st) {
    baseStartGame(st);
    A.link = loadLink();
    // vé trên máy thuộc về nhân vật khác (vd. vừa bấm "chơi mới") -> bỏ liên kết
    if (A.link && S.accCode !== A.link.code) { A.link = null; storeLink(); }
    A.lastSaved = ''; A.conflict = false; A.t = 0;
    if (A.link) setTimeout(() => sync(), 1500);
  };
  const baseUpdate = update;
  update = function (dt) {
    baseUpdate(dt);
    if (!A.link || !R.started) return;
    A.t += dt;
    if (A.t >= SYNC_EVERY) { A.t = 0; sync(); }
  };
  const baseSleep = sleep;
  sleep = function () { baseSleep(); sync(); };
  addEventListener('pagehide', () => {
    if (!A.link || A.conflict || !S || S.accCode !== A.link.code || !COOP.net || !COOP.net.rpcKeepalive) return;
    const key = JSON.stringify(S); if (key === A.lastSaved) return;
    COOP.net.rpcKeepalive('acc_save', { p_code: A.link.code, p_token: A.link.token, p_data: S, p_rev: A.link.rev, p_force: false });
    A.link.rev += 1; A.link.pending = true; storeLink();   // giả định gửi được; nếu mất thì lần sau tự sửa
  });
})();
