(function () {
  'use strict';

  var SUPABASE_URL = 'https://ledntmcewofaenihreon.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlZG50bWNld29mYWVuaWhyZW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjgxOTAsImV4cCI6MjExMDEwNDE5MH0.8ndtkk6Oq8s6JvDkc5EMuOkb-oB8ICz1H2pnn-I__-Q';
  var C = window.CHALLENGE;
  var ITEMS = {};
  C.items.forEach(function (it) { ITEMS[it.id] = it; });

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var $ = function (id) { return document.getElementById(id); };

  var state = { user: null, profile: null, entries: [], date: null, cat: 'physical', busy: false };
  var PENDING_KEY = 'wellness.pendingEmail';
  var MS_INFO = {
    10: { e: '🌱', t: 'Off to a great start!', b: "You're 10% of the way to your goal. The hardest part is beginning, and you've done it." },
    25: { e: '🔥', t: 'A quarter of the way!', b: "25% of your goal is behind you. These habits are starting to stick." },
    50: { e: '⭐', t: 'Halfway there!', b: "You've reached 50% of your goal. Look how far you've come." },
    75: { e: '💪', t: 'Three quarters done!', b: "75% of your goal. The finish line is in sight." },
    100: { e: '🏆', t: 'You reached your goal!', b: "100%! Go celebrate with your admin team and collect your prize. You earned it." }
  };

  // ---------- helpers ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function todayIso() { return iso(new Date()); }
  function maxDate() { var t = todayIso(); return t > C.end ? C.end : (t < C.start ? C.start : t); }
  function clampDate(s) { if (s < C.start) return C.start; var m = maxDate(); return s > m ? m : s; }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function fmtDate(s, short) {
    return parse(s).toLocaleDateString(undefined, short ? { month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function monthName(s) { return parse(s).toLocaleDateString(undefined, { month: 'long' }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function show(id) {
    ['loading', 'auth', 'onboard', 'main'].forEach(function (s) { $(s).hidden = s !== id; });
  }
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function setMsg(id, msg, ok) { var m = $(id); m.textContent = msg || ''; m.classList.toggle('ok', !!ok); }

  function total() {
    var sum = state.profile ? state.profile.carryover_points : 0;
    state.entries.forEach(function (e) { sum += e.points; });
    return sum;
  }
  function countOn(id, date) {
    return state.entries.filter(function (e) { return e.challenge_id === id && e.entry_date === date; }).length;
  }
  function countAll(id) {
    return state.entries.filter(function (e) { return e.challenge_id === id; }).length;
  }
  function inMonth(id, date) {
    var ym = date.slice(0, 7);
    return state.entries.filter(function (e) { return e.challenge_id === id && e.entry_date.slice(0, 7) === ym; });
  }

  // ---------- data ----------
  async function loadEntries() {
    var all = [], from = 0, size = 1000;
    for (;;) {
      var r = await sb.from('entries').select('id,challenge_id,points,entry_date,created_at')
        .order('id', { ascending: true }).range(from, from + size - 1);
      if (r.error) throw r.error;
      all = all.concat(r.data);
      if (r.data.length < size) break;
      from += size;
    }
    state.entries = all;
  }

  async function addEntry(item, date) {
    var r = await sb.from('entries').insert({ challenge_id: item.id, points: item.pts, entry_date: date })
      .select('id,challenge_id,points,entry_date,created_at').single();
    if (r.error) throw r.error;
    state.entries.push(r.data);
  }
  async function removeEntry(id) {
    var r = await sb.from('entries').delete().eq('id', id);
    if (r.error) throw r.error;
    state.entries = state.entries.filter(function (e) { return e.id !== id; });
  }

  async function act(fn) {
    if (state.busy) return;
    state.busy = true;
    try { await fn(); }
    catch (err) { console.error(err); toast(navigator.onLine ? 'Something went wrong. Please try again.' : "You're offline. Reconnect to save."); }
    state.busy = false;
    render();
    checkMilestones();
  }

  // ---------- milestones ----------
  async function checkMilestones() {
    var p = state.profile; if (!p) return;
    var pct = total() / p.goal_points * 100;
    var fresh = C.milestones.filter(function (m) { return pct >= m && p.celebrated.indexOf(m) === -1; });
    if (!fresh.length) return;
    var top = fresh[fresh.length - 1];
    p.celebrated = p.celebrated.concat(fresh);
    celebrate(top);
    var r = await sb.from('profiles').update({ celebrated: p.celebrated }).eq('id', state.user.id);
    if (r.error) console.error(r.error);
  }

  var confettiRaf;
  function celebrate(m) {
    var info = MS_INFO[m];
    $('cel-emoji').textContent = info.e;
    $('cel-title').textContent = info.t;
    $('cel-body').textContent = info.b;
    $('celebrate').hidden = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var cv = $('confetti'), ctx = cv.getContext('2d');
    var w = cv.width = window.innerWidth, h = cv.height = window.innerHeight;
    var colors = ['#d9a441', '#ffffff', '#7fc8a9', '#f2c14e', '#e76f51'];
    var parts = [];
    for (var i = 0; i < 140; i++) {
      parts.push({ x: Math.random() * w, y: -20 - Math.random() * h * .6, r: 4 + Math.random() * 5, c: colors[i % colors.length], vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3, a: Math.random() * 6.28, va: -.15 + Math.random() * .3 });
    }
    var startT = Date.now();
    cancelAnimationFrame(confettiRaf);
    (function tick() {
      ctx.clearRect(0, 0, w, h);
      parts.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); ctx.restore();
      });
      if (Date.now() - startT < 5000 && !$('celebrate').hidden) confettiRaf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    })();
  }
  $('cel-close').addEventListener('click', function () { $('celebrate').hidden = true; });

  // ---------- render ----------
  function render() {
    if (!state.profile) return;
    var p = state.profile, tot = total();
    var pct = Math.floor(tot / p.goal_points * 100);
    $('hello').textContent = 'Hi, ' + p.display_name.split(' ')[0];
    $('total').textContent = tot;
    $('goal').textContent = p.goal_points;
    $('pct').textContent = pct;
    $('ring-fg').style.strokeDashoffset = (326.73 * (1 - Math.min(pct, 100) / 100)).toFixed(2);
    var nextM = C.milestones.filter(function (m) { return pct < m; })[0];
    $('next').textContent = nextM
      ? (function (n) { return n + (n === 1 ? ' point' : ' points') + ' to your ' + nextM + '% milestone'; })(Math.max(1, Math.ceil(p.goal_points * nextM / 100 - tot)))
      : 'Goal reached. Everything from here is a bonus!';

    renderLog();
    renderProgress();
  }

  function renderLog() {
    var d = state.date, t = todayIso();
    $('date-label').textContent = d === t ? 'Today, ' + fmtDate(d, true) : (d === addDays(t, -1) ? 'Yesterday, ' + fmtDate(d, true) : fmtDate(d));
    var di = $('date-input'); di.min = C.start; di.max = maxDate(); di.value = d;
    $('date-prev').disabled = d <= C.start;
    $('date-next').disabled = d >= maxDate();

    var chips = $('chips'); chips.textContent = '';
    C.categories.forEach(function (c) {
      var b = el('button', 'chip' + (c.id === state.cat ? ' active' : ''), c.name);
      b.type = 'button';
      b.addEventListener('click', function () { state.cat = c.id; renderLog(); });
      chips.appendChild(b);
    });

    var list = $('challenge-list'); list.textContent = '';
    C.items.filter(function (it) { return it.cat === state.cat; }).forEach(function (it) {
      list.appendChild(itemRow(it, d));
    });
  }

  function itemRow(it, d) {
    var row = el('div', 'item');
    var pts = el('div', 'pts'); pts.appendChild(document.createTextNode(it.pts)); pts.appendChild(el('small', null, 'pts'));
    var txt = el('div', 'item-text'); txt.appendChild(el('div', 't', it.text));
    var sub = el('div', 's'); txt.appendChild(sub);
    row.appendChild(pts); row.appendChild(txt);

    if (it.mode === 'repeat') {
      var n = countOn(it.id, d), all = countAll(it.id), max = it.maxPerDay || 10;
      sub.textContent = all ? all + ' time' + (all === 1 ? '' : 's') + ' so far, ' + all * it.pts + ' points' : it.pts + ' point' + (it.pts === 1 ? '' : 's') + ' each time';
      if (n) row.classList.add('done');
      var st = el('div', 'stepper');
      var minus = el('button', 'round', '−'); minus.type = 'button'; minus.disabled = n === 0;
      minus.setAttribute('aria-label', 'Remove one: ' + it.text);
      minus.addEventListener('click', function () {
        act(async function () {
          var mine = state.entries.filter(function (e) { return e.challenge_id === it.id && e.entry_date === d; });
          if (mine.length) await removeEntry(mine[mine.length - 1].id);
        });
      });
      var cnt = el('span', 'count', n);
      var plus = el('button', 'round add', '+'); plus.type = 'button'; plus.disabled = n >= max;
      plus.setAttribute('aria-label', 'Add one: ' + it.text);
      plus.addEventListener('click', function () { act(function () { return addEntry(it, d); }); });
      st.appendChild(minus); st.appendChild(cnt); st.appendChild(plus);
      row.appendChild(st);
    } else {
      var existing = it.mode === 'monthly' ? inMonth(it.id, d) : state.entries.filter(function (e) { return e.challenge_id === it.id; });
      var on = existing.length > 0;
      if (it.mode === 'monthly') sub.textContent = on ? 'Done for ' + monthName(d) : 'Tap when completed for ' + monthName(d);
      else sub.textContent = on ? 'Done on ' + fmtDate(existing[0].entry_date, true) : 'One time only';
      if (on) row.classList.add('done');
      var chk = el('button', 'check' + (on ? ' on' : ''), '✓'); chk.type = 'button';
      chk.setAttribute('aria-pressed', on ? 'true' : 'false');
      chk.setAttribute('aria-label', it.text);
      if (it.auto) chk.disabled = true;
      chk.addEventListener('click', function () {
        act(async function () {
          if (on) { for (var i = 0; i < existing.length; i++) await removeEntry(existing[i].id); }
          else await addEntry(it, d);
        });
      });
      row.appendChild(chk);
    }
    return row;
  }

  function renderProgress() {
    var p = state.profile, tot = total(), pct = tot / p.goal_points * 100;
    var ms = $('milestones'); ms.textContent = '';
    C.milestones.forEach(function (m) {
      var box = el('div', 'ms' + (pct >= m ? ' hit' : ''));
      box.appendChild(el('div', 'e', MS_INFO[m].e));
      box.appendChild(el('div', 'p', m + '%'));
      box.appendChild(el('div', 'n', Math.ceil(p.goal_points * m / 100) + ' pts'));
      ms.appendChild(box);
    });

    var sums = {}; C.categories.forEach(function (c) { sums[c.id] = 0; });
    state.entries.forEach(function (e) { var it = ITEMS[e.challenge_id]; if (it) sums[it.cat] += e.points; });
    var rows = C.categories.map(function (c) { return { name: c.name, v: sums[c.id] }; });
    if (p.carryover_points) rows.push({ name: 'Carried over from spreadsheet', v: p.carryover_points });
    var maxV = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    var bd = $('breakdown'); bd.textContent = '';
    rows.forEach(function (r) {
      var row = el('div', 'bar-row'), lbl = el('div', 'lbl');
      lbl.appendChild(el('span', null, r.name)); lbl.appendChild(el('span', null, r.v));
      var bar = el('div', 'bar'), fill = el('i'); fill.style.width = (r.v / maxV * 100) + '%'; bar.appendChild(fill);
      row.appendChild(lbl); row.appendChild(bar); bd.appendChild(row);
    });

    var h = $('history'); h.textContent = '';
    var recent = state.entries.slice().sort(function (a, b) {
      return a.entry_date === b.entry_date ? b.id - a.id : (a.entry_date < b.entry_date ? 1 : -1);
    }).slice(0, 40);
    if (!recent.length) { h.appendChild(el('div', 'empty', 'Nothing logged yet. Head to the Log tab to get started.')); return; }
    recent.forEach(function (e) {
      var it = ITEMS[e.challenge_id];
      var row = el('div', 'hrow');
      row.appendChild(el('div', 'd', fmtDate(e.entry_date, true)));
      row.appendChild(el('div', 'x', it ? it.text : e.challenge_id));
      row.appendChild(el('div', 'v', '+' + e.points));
      if (!(it && it.auto)) {
        var del = el('button', null, '✕'); del.type = 'button'; del.setAttribute('aria-label', 'Remove this entry');
        del.addEventListener('click', function () { act(function () { return removeEntry(e.id); }); });
        row.appendChild(del);
      }
      h.appendChild(row);
    });
  }

  // ---------- navigation ----------
  document.querySelectorAll('.tabbar button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tabbar button').forEach(function (x) { x.classList.toggle('active', x === b); });
      ['log', 'progress', 'me'].forEach(function (t) { $('tab-' + t).hidden = t !== b.dataset.tab; });
      window.scrollTo(0, 0);
    });
  });
  $('date-prev').addEventListener('click', function () { state.date = clampDate(addDays(state.date, -1)); renderLog(); });
  $('date-next').addEventListener('click', function () { state.date = clampDate(addDays(state.date, 1)); renderLog(); });
  $('date-input').addEventListener('change', function (e) { if (e.target.value) { state.date = clampDate(e.target.value); renderLog(); } });

  // ---------- auth ----------
  function showCodeStep(email) {
    $('email-form').hidden = true; $('code-form').hidden = false;
    $('code-email').textContent = email; $('code').value = '';
    setTimeout(function () { $('code').focus(); }, 50);
  }
  function showEmailStep() {
    localStorage.removeItem(PENDING_KEY);
    $('email-form').hidden = false; $('code-form').hidden = true; setMsg('auth-msg', '');
  }

  $('email-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var email = $('email').value.trim().toLowerCase();
    var btn = ev.target.querySelector('button'); btn.disabled = true; setMsg('auth-msg', '');
    try {
      var r = await sb.functions.invoke('send-code', { body: { email: email } });
      if (r.error) {
        var m = 'Could not send the code. Please try again.';
        try { var j = await r.error.context.json(); if (j && j.error) m = j.error; } catch (e) {}
        throw new Error(m);
      }
      localStorage.setItem(PENDING_KEY, email);
      showCodeStep(email);
      setMsg('auth-msg', 'Code sent. Check your inbox (and spam folder).', true);
    } catch (err) { setMsg('auth-msg', err.message); }
    btn.disabled = false;
  });

  $('code-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var email = localStorage.getItem(PENDING_KEY);
    var token = $('code').value.replace(/\D/g, '');
    var btn = ev.target.querySelector('button'); btn.disabled = true; setMsg('auth-msg', '');
    var r = await sb.auth.verifyOtp({ email: email, token: token, type: 'email' });
    if (r.error) r = await sb.auth.verifyOtp({ email: email, token: token, type: 'magiclink' });
    btn.disabled = false;
    if (r.error) { setMsg('auth-msg', "That code didn't work. Check it and try again, or request a new one."); return; }
    localStorage.removeItem(PENDING_KEY);
  });
  $('code-back').addEventListener('click', showEmailStep);

  $('signout').addEventListener('click', async function () { await sb.auth.signOut(); });

  // ---------- onboarding & settings ----------
  $('onboard-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var btn = ev.target.querySelector('button'); btn.disabled = true; setMsg('onboard-msg', '');
    try {
      var carry = Math.max(0, Math.min(5000, parseInt($('ob-carry').value, 10) || 0));
      var r = await sb.from('profiles').insert({
        id: state.user.id, display_name: $('ob-name').value.trim(),
        goal_points: parseInt($('ob-goal').value, 10), carryover_points: carry
      }).select().single();
      if (r.error) throw r.error;
      state.profile = r.data;
      await addEntry(ITEMS.join, clampDate(todayIso()));
      enterMain();
    } catch (err) { console.error(err); setMsg('onboard-msg', 'Could not save. Please try again.'); }
    btn.disabled = false;
  });

  $('settings-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    setMsg('settings-msg', '');
    var goal = Math.max(50, Math.min(5000, parseInt($('st-goal').value, 10) || 500));
    var carry = Math.max(0, Math.min(5000, parseInt($('st-carry').value, 10) || 0));
    var r = await sb.from('profiles').update({ display_name: $('st-name').value.trim(), goal_points: goal, carryover_points: carry })
      .eq('id', state.user.id).select().single();
    if (r.error) { setMsg('settings-msg', 'Could not save. Please try again.'); return; }
    state.profile = r.data; fillSettings();
    setMsg('settings-msg', 'Saved.', true);
    render(); checkMilestones();
  });

  function fillSettings() {
    $('st-name').value = state.profile.display_name;
    $('st-goal').value = state.profile.goal_points;
    $('st-carry').value = state.profile.carryover_points;
    $('signed-in-as').textContent = 'Signed in as ' + state.user.email;
  }

  function enterMain() {
    state.date = clampDate(todayIso());
    fillSettings(); show('main'); render(); checkMilestones();
  }

  // ---------- startup ----------
  var loadedFor = null;
  async function onSession(session) {
    if (!session) {
      loadedFor = null; state.user = null; state.profile = null; state.entries = [];
      show('auth');
      var pending = localStorage.getItem(PENDING_KEY);
      if (pending) showCodeStep(pending); else showEmailStep();
      return;
    }
    if (loadedFor === session.user.id) return;
    loadedFor = session.user.id; state.user = session.user;
    show('loading');
    try {
      var r = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (r.error) throw r.error;
      if (!r.data) { state.profile = null; state.entries = []; show('onboard'); return; }
      state.profile = r.data;
      await loadEntries();
      enterMain();
    } catch (err) {
      console.error(err); loadedFor = null; show('auth');
      setMsg('auth-msg', navigator.onLine ? 'Could not load your data. Please try again.' : "You're offline. Reconnect and reopen the app.");
    }
  }
  sb.auth.onAuthStateChange(function (event, session) {
    // Defer so we never call Supabase from inside the auth callback.
    setTimeout(function () { onSession(session); }, 0);
  });

  // Refresh "today" when the app comes back to the foreground on a new day.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && state.profile && state.date > maxDate()) { state.date = maxDate(); renderLog(); }
  });

  // ---------- install ----------
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferredPrompt = e; $('install-btn').hidden = false;
  });
  $('install-btn').addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); deferredPrompt = null; $('install-btn').hidden = true;
  });
  if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
    $('install-card').previousElementSibling.hidden = true; $('install-card').hidden = true;
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
