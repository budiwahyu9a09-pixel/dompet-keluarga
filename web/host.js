/* Dompet Keluarga — host layer for the GitHub Pages build.
 * Provides window.claude.use('db' | 'user') backed by Supabase, plus a login screen,
 * family-member management and sign-out (window.kkHost). The app itself (src/app.html)
 * is identical to the claude.ai version and only talks to this small interface. */
(() => {
  const cfg = window.KK_CONFIG;
  const sb = supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
  let session = null, resolveReady;
  const ready = new Promise(r => (resolveReady = r));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const toast = m => { const t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600); };

  // ---------------- login screen ----------------
  const css = `
  #kkAuth{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;
    background:linear-gradient(160deg,#cfe6ff 0%,#e7ddff 55%,#ffe3ee 100%)}
  html.dark #kkAuth{background:linear-gradient(160deg,#16204a,#2b1d55 60%,#3a1d3c)}
  #kkAuth .box{width:100%;max-width:380px;background:var(--card);border-radius:28px;padding:26px 22px;box-shadow:0 20px 60px rgba(40,40,90,.18)}
  #kkAuth .logo{width:64px;height:64px;border-radius:20px;display:grid;place-items:center;font-size:32px;margin:0 auto 10px;background:linear-gradient(135deg,#bfe0ff,#e3d6ff)}
  #kkAuth h2{text-align:center;font-size:22px;font-weight:800;letter-spacing:-.4px}
  #kkAuth p.s{text-align:center;color:var(--muted);font-size:13px;margin:4px 0 16px;line-height:1.5}
  #kkAuth .err{background:var(--exp-soft);color:var(--exp);font-size:12.5px;padding:9px 11px;border-radius:12px;margin-top:12px;display:none;line-height:1.5}
  #kkAuth .ok{background:var(--inc-soft);color:var(--inc)}
  #kkAuth .btn{width:100%;margin-top:16px}
  #kkAuth .sw2{text-align:center;margin-top:14px;font-size:13px;color:var(--muted)}
  #kkAuth .sw2 button{border:0;background:none;color:var(--pri);font-weight:700}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  let mode = 'login';
  function authHtml(msg) {
    const reg = mode === 'register';
    return `<div class="box"><div class="logo">💰</div><h2>Dompet Keluarga</h2>
      <p class="s">${reg ? 'Buat akun dengan email yang sudah didaftarkan sebagai anggota keluarga.' : 'Masuk untuk membuka keuangan & goals keluargamu.'}</p>
      <form id="kkForm" autocomplete="on">
        <label>Email</label><input id="kkEmail" type="email" autocomplete="email" required placeholder="nama@email.com">
        <label>Password</label><input id="kkPass" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required minlength="6" placeholder="minimal 6 karakter">
        ${reg ? '<label>Ulangi password</label><input id="kkPass2" type="password" autocomplete="new-password" required minlength="6">' : ''}
        <button class="btn" id="kkGo" type="submit">${reg ? 'Daftar & masuk' : 'Masuk'}</button>
      </form>
      <div class="err" id="kkErr">${esc(msg || '')}</div>
      <div class="sw2">${reg ? 'Sudah punya akun?' : 'Belum punya akun?'} <button type="button" id="kkSwitch">${reg ? 'Masuk' : 'Daftar'}</button></div></div>`;
  }
  function showErr(m, ok) { const e = $('kkErr'); if (!e) return; e.textContent = m; e.style.display = m ? 'block' : 'none'; e.classList.toggle('ok', !!ok); }
  function showLogin(msg) {
    let el = $('kkAuth');
    if (!el) { el = document.createElement('div'); el.id = 'kkAuth'; document.body.appendChild(el); }
    el.innerHTML = authHtml(); if (msg) showErr(msg);
    $('kkSwitch').onclick = () => { mode = mode === 'login' ? 'register' : 'login'; showLogin(); };
    $('kkForm').onsubmit = async e => {
      e.preventDefault(); showErr('');
      const email = $('kkEmail').value.trim().toLowerCase(), pass = $('kkPass').value;
      if (mode === 'register' && pass !== $('kkPass2').value) return showErr('Password tidak sama.');
      $('kkGo').disabled = true; $('kkGo').textContent = 'Sebentar…';
      try {
        if (mode === 'register') {
          const { error } = await sb.auth.signUp({ email, password: pass });
          if (error && !/already/i.test(error.message)) throw error;
        }
        const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        session = data.session; await start();
      } catch (err) {
        const m = err.message || '';
        showErr(/invalid login/i.test(m) ? 'Email atau password salah.'
          : /not confirmed/i.test(m) ? 'Email ini belum terdaftar sebagai anggota keluarga. Minta anggota keluarga menambahkan emailmu di ⚙️ → Anggota keluarga, lalu daftar lagi.'
          : /rate limit|too many/i.test(m) ? 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.'
          : /weak|at least/i.test(m) ? 'Password terlalu lemah, gunakan minimal 6 karakter.'
          : 'Gagal: ' + m);
        $('kkGo').disabled = false; $('kkGo').textContent = mode === 'register' ? 'Daftar & masuk' : 'Masuk';
      }
    };
  }
  function hideLogin() { const el = $('kkAuth'); if (el) el.remove(); }

  async function start() {
    const { data: member, error } = await sb.rpc('is_member');
    if (error) { showLogin('Tidak bisa terhubung ke server. Coba lagi.'); return; }
    if (!member) {
      showLogin('Akun ' + session.user.email + ' belum menjadi anggota keluarga. Minta anggota keluarga menambahkan emailmu di ⚙️ → Anggota keluarga.');
      await sb.auth.signOut({ scope: 'local' }); session = null; return;
    }
    hideLogin(); subscribeRealtime(); resolveReady();
  }

  sb.auth.getSession().then(({ data }) => {
    if (data.session) { session = data.session; start(); } else showLogin();
  });

  // ---------------- document store adapter ----------------
  const meta = Object.freeze({ fromCache: false, hasPendingWrites: false });
  const parentOf = p => p.split('/').slice(0, -1).join('/');
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const mkDoc = (path, row) => Object.freeze({ id: path.split('/').pop(), exists: !!row, data: () => (row ? row.data : undefined), metadata: meta });
  const mapErr = e => ({ code: (e && (e.code === '42501' || /row-level security|permission/i.test(e.message || ''))) ? 'invalid_argument' : 'unavailable', message: (e && e.message) || 'error' });

  async function fetchDoc(p) {
    const { data, error } = await sb.from('docs').select('path,data').eq('path', p).maybeSingle();
    if (error) throw mapErr(error);
    return mkDoc(p, data);
  }
  async function fetchCol(c) {
    const { data, error } = await sb.from('docs').select('path,data').eq('parent', c).order('path').limit(10000);
    if (error) throw mapErr(error);
    const docs = (data || []).map(r => mkDoc(r.path, r));
    return { docs, size: docs.length, empty: !docs.length, metadata: meta, docChanges: () => [] };
  }

  const listeners = new Set(); // {kind:'doc'|'col', key, run}
  function listen(kind, key, fetcher, next, error) {
    let alive = true, t = null;
    const run = () => { clearTimeout(t); t = setTimeout(async () => {
      if (!alive) return;
      try { const snap = await fetcher(); if (alive) next(snap); }
      catch (e) { if (alive && e.code === 'invalid_argument' && error) { alive = false; listeners.delete(entry); error(e); } }
    }, 60); };
    const entry = { kind, key, run };
    listeners.add(entry); run();
    return () => { alive = false; listeners.delete(entry); };
  }
  function changed(p) {
    const parent = parentOf(p);
    listeners.forEach(l => { if ((l.kind === 'doc' && l.key === p) || (l.kind === 'col' && l.key === parent)) l.run(); });
  }

  function docRef(p) {
    const ref = {
      id: p.split('/').pop(), path: p,
      get: () => fetchDoc(p),
      async set(d) { const { error } = await sb.from('docs').upsert({ path: p, parent: parentOf(p), data: d }); if (error) throw mapErr(error); changed(p); },
      async update(d) { const cur = await fetchDoc(p); if (!cur.exists) throw { code: 'invalid_argument', message: 'missing' }; await ref.set({ ...cur.data(), ...d }); },
      async delete() { const { error } = await sb.from('docs').delete().eq('path', p); if (error) throw mapErr(error); changed(p); },
      collection: c => colRef(p + '/' + c),
      onSnapshot: (n, e) => listen('doc', p, () => fetchDoc(p), n, e),
      acquire: async () => ({ acquired: true })
    };
    return ref;
  }
  function colRef(c) {
    const q = {
      path: c,
      doc: id => docRef(c + '/' + (id || rid())),
      async add(d) { const r = docRef(c + '/' + rid()); await r.set(d); return r; },
      get: () => fetchCol(c),
      onSnapshot: (n, e) => listen('col', c, () => fetchCol(c), n, e),
      where: () => q, orderBy: () => q, limit: () => q
    };
    return q;
  }
  const db = Object.freeze({ doc: docRef, collection: colRef });

  function subscribeRealtime() {
    sb.channel('docs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, pl => {
        const p = (pl.new && pl.new.path) || (pl.old && pl.old.path); if (p) changed(p);
      })
      .subscribe();
    // safety net: refresh every 30 s while visible, and when coming back to the app
    setInterval(() => { if (document.visibilityState === 'visible') listeners.forEach(l => l.run()); }, 30000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') listeners.forEach(l => l.run()); });
  }

  const user = Object.freeze({
    id: async () => (session ? session.user.id : null),
    can: async () => true,
    canEdit: async () => true,
    isOwner: async () => true
  });

  window.claude = Object.freeze({ use: async name => { await ready; return name === 'db' ? db : name === 'user' ? user : null; } });

  // ---------------- extras used by the app's settings ----------------
  async function members() {
    const sheet = $('sheet'), ov = $('ov');
    const draw = async () => {
      const { data, error } = await sb.from('members').select('email,created_at').order('created_at');
      const list = data || [];
      sheet.innerHTML = `<h3>Anggota keluarga 👨‍👩‍👧</h3>
        <p class="sub">Email di sini boleh membuka semua pos <b>Bersama</b>. Pos <b>Pribadi</b> 🔒 tetap hanya untuk pemiliknya. Setelah ditambahkan, anggota baru tinggal buka app ini lalu pilih <b>Daftar</b>.</p>
        ${error ? '<p class="hint">Gagal memuat daftar.</p>' : list.map(m => `<div class="bankrow"><i class="bb" style="background:var(--pri-soft)">${esc(m.email[0].toUpperCase())}</i>
          <div class="bm"><b>${esc(m.email)}</b><small>${m.email === (session.user.email || '').toLowerCase() ? 'Kamu' : 'Anggota'}</small></div>
          ${m.email === (session.user.email || '').toLowerCase() ? '' : `<button class="x" data-rm="${esc(m.email)}" aria-label="Hapus">✕</button>`}</div>`).join('')}
        <div style="display:flex;gap:8px;margin-top:12px"><input id="mmNew" type="email" placeholder="email pasangan / keluarga"><button class="btn sm" id="mmAdd">Tambah</button></div>
        <div class="actions"><button class="btn ghost" id="mmClose">Tutup</button></div>`;
      sheet.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => {
        const { error } = await sb.from('members').delete().eq('email', b.dataset.rm);
        toast(error ? 'Gagal menghapus' : 'Anggota dihapus'); draw();
      });
      $('mmAdd').onclick = async () => {
        const em = $('mmNew').value.trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('Email tidak valid'); return; }
        const { error } = await sb.from('members').insert({ email: em });
        toast(error ? (/duplicate/i.test(error.message) ? 'Sudah terdaftar' : 'Gagal menambah') : 'Ditambahkan ✓ Minta dia daftar di app ini');
        draw();
      };
      $('mmClose').onclick = () => ov.classList.remove('show');
    };
    ov.classList.add('show'); sheet.innerHTML = '<p class="hint">Memuat…</p>'; draw();
  }
  async function signOut() { await sb.auth.signOut(); location.reload(); }
  window.kkHost = { members, signOut, email: () => (session ? session.user.email : '') };
})();
