(function () {
  'use strict';

  var SUPABASE_URL = 'https://ledntmcewofaenihreon.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlZG50bWNld29mYWVuaWhyZW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MjgxOTAsImV4cCI6MjExMDEwNDE5MH0.8ndtkk6Oq8s6JvDkc5EMuOkb-oB8ICz1H2pnn-I__-Q';
  var C = window.CHALLENGE;
  var ITEMS = {};
  C.items.forEach(function (it) { ITEMS[it.id] = it; });

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  var $ = function (id) { return document.getElementById(id); };

  // counts: { 'YYYY-MM-01': { challenge_id: n } }  One number per challenge per month, nothing finer.
  var state = { user: null, profile: null, counts: {}, month: null, cat: C.categories[0].id, busy: false };
  var PENDING_KEY = 'wellness.pendingEmail';
  var MS_INFO = {
    10: { e: '🌱', t: 'Off to a great start!', b: "You're 10% of the way to your goal. The hardest part is beginning, and you've done it." },
    25: { e: '🔥', t: 'A quarter of the way!', b: "25% of your goal is behind you. These habits are starting to stick." },
    50: { e: '⭐', t: 'Halfway there!', b: "You've reached 50% of your goal. Look how far you've come." },
    75: { e: '💪', t: 'Three quarters done!', b: "75% of your goal. The finish line is in sight." },
    100: { e: '🏆', t: 'You reached your goal!', b: "100%! Go celebrate with your admin team and collect your prize. You earned it." },
    3000: { e: '👑', t: '3,000 points!', b: "Three thousand points. That is an extraordinary amount of care for your body, mind, and spirit. Go celebrate with your admin team." }
  };
  // Every milestone for this person, in the order they will be reached.
  // Percent milestones depend on the personal goal; point milestones are fixed.
  function milestones() {
    var goal = state.profile.goal_points;
    var list = C.milestones.map(function (m) { return { key: m, pts: Math.ceil(goal * m / 100), label: m + '%', name: m + '% milestone' }; });
    (C.pointMilestones || []).forEach(function (n) { list.push({ key: n, pts: n, label: n.toLocaleString(), name: n.toLocaleString() + ' point milestone' }); });
    return list.sort(function (a, b) { return a.pts - b.pts || a.key - b.key; });
  }

  // ---------- helpers ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-01'; }
  var FIRST = C.start.slice(0, 8) + '01', LAST = C.end.slice(0, 8) + '01';
  function currentMonth() { var m = monthKey(new Date()); return m < FIRST ? FIRST : (m > LAST ? LAST : m); }
  function shiftMonth(m, n) { var d = parse(m); d.setMonth(d.getMonth() + n); return monthKey(d); }
  function clampMonth(m) { if (m < FIRST) return FIRST; var c = currentMonth(); return m > c ? c : m; }
  function months() { var out = [], m = FIRST, c = currentMonth(); while (m <= c) { out.push(m); m = shiftMonth(m, 1); } return out; }
  function monthName(m, withYear) { return parse(m).toLocaleDateString(undefined, withYear ? { month: 'long', year: 'numeric' } : { month: 'long' }); }
  // Days of the challenge that fall inside a month (September starts on the 8th).
  function daysIn(m) {
    var d = parse(m), last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    var from = m === FIRST ? +C.start.slice(8) : 1, to = m === LAST ? +C.end.slice(8) : last;
    return to - from + 1;
  }
  function maxFor(it, m) { return it.daily ? daysIn(m) : (it.maxPerMonth || 99); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function show(id) { ['loading', 'auth', 'onboard', 'main'].forEach(function (s) { $(s).hidden = s !== id; }); }
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function setMsg(id, msg, ok) { var m = $(id); m.textContent = msg || ''; m.classList.toggle('ok', !!ok); }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  function getCount(id, m) { return (state.counts[m] && state.counts[m][id]) || 0; }
  function countAll(id) { var n = 0; Object.keys(state.counts).forEach(function (m) { n += state.counts[m][id] || 0; }); return n; }
  function monthPoints(m) {
    var sum = 0, row = state.counts[m] || {};
    Object.keys(row).forEach(function (id) { if (ITEMS[id]) sum += row[id] * ITEMS[id].pts; });
    return sum;
  }
  function total() {
    var sum = state.profile ? state.profile.carryover_points : 0;
    Object.keys(state.counts).forEach(function (m) { sum += monthPoints(m); });
    return sum;
  }

  // ---------- data ----------
  async function loadCounts() {
    var r = await sb.from('monthly_counts').select('month,challenge_id,count');
    if (r.error) throw r.error;
    state.counts = {};
    r.data.forEach(function (row) { (state.counts[row.month] = state.counts[row.month] || {})[row.challenge_id] = row.count; });
  }
  async function setCount(item, m, n) {
    n = Math.max(0, Math.min(maxFor(item, m), Math.floor(n) || 0));
    var r;
    if (n === 0) r = await sb.from('monthly_counts').delete().eq('user_id', state.user.id).eq('month', m).eq('challenge_id', item.id);
    else r = await sb.from('monthly_counts').upsert({ user_id: state.user.id, month: m, challenge_id: item.id, count: n }, { onConflict: 'user_id,month,challenge_id' });
    if (r.error) throw r.error;
    state.counts[m] = state.counts[m] || {};
    if (n === 0) delete state.counts[m][item.id]; else state.counts[m][item.id] = n;
  }
  async function clearAll(item) {
    var r = await sb.from('monthly_counts').delete().eq('user_id', state.user.id).eq('challenge_id', item.id);
    if (r.error) throw r.error;
    Object.keys(state.counts).forEach(function (m) { delete state.counts[m][item.id]; });
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
    var tot = total();
    var fresh = milestones().filter(function (m) { return tot >= m.pts && p.celebrated.indexOf(m.key) === -1; }).map(function (m) { return m.key; });
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
    var nextM = milestones().filter(function (m) { return tot < m.pts; })[0];
    $('next').textContent = nextM
      ? plural(nextM.pts - tot, 'point') + ' to your ' + nextM.name
      : 'Every milestone reached. Everything from here is a bonus!';
    renderLog();
    renderProgress();
  }

  function renderLog() {
    var m = state.month;
    $('month-label').textContent = monthName(m, true);
    $('month-prev').disabled = m <= FIRST;
    $('month-next').disabled = m >= currentMonth();
    $('month-hint').textContent = state.cat === 'onetime' ? 'Check each one off once you have done it.'
      : state.cat === 'monthly' ? 'Check off what you completed in ' + monthName(m) + '.'
      : 'Enter how many times you did each one in ' + monthName(m) + '.';

    var chips = $('chips'); chips.textContent = '';
    C.categories.forEach(function (c) {
      var b = el('button', 'chip' + (c.id === state.cat ? ' active' : ''), c.name);
      b.type = 'button';
      b.addEventListener('click', function () { state.cat = c.id; renderLog(); });
      chips.appendChild(b);
    });

    var list = $('challenge-list'); list.textContent = '';
    C.items.filter(function (it) { return it.cat === state.cat; }).forEach(function (it) { list.appendChild(itemRow(it, m)); });
  }

  function itemRow(it, m) {
    var row = el('div', 'item');
    var pts = el('div', 'pts'); pts.appendChild(document.createTextNode(it.pts)); pts.appendChild(el('small', null, 'pts'));
    var txt = el('div', 'item-text'); txt.appendChild(el('div', 't', it.text));
    var sub = el('div', 's'); txt.appendChild(sub);
    row.appendChild(pts); row.appendChild(txt);

    if (it.mode === 'repeat') {
      var n = getCount(it.id, m), all = countAll(it.id), max = maxFor(it, m);
      sub.textContent = all ? plural(all, 'time') + ' overall, ' + plural(all * it.pts, 'point') : plural(it.pts, 'point') + ' each time';
      if (n) row.classList.add('done');
      var st = el('div', 'stepper');
      var minus = el('button', 'round', '−'); minus.type = 'button'; minus.disabled = n === 0;
      minus.setAttribute('aria-label', 'One fewer: ' + it.text);
      minus.addEventListener('click', function () { act(function () { return setCount(it, m, getCount(it.id, m) - 1); }); });
      var cnt = el('input', 'count'); cnt.type = 'number'; cnt.inputMode = 'numeric'; cnt.min = 0; cnt.max = max; cnt.value = n;
      cnt.setAttribute('aria-label', 'Times in ' + monthName(m) + ': ' + it.text);
      cnt.addEventListener('focus', function () { cnt.select(); });
      cnt.addEventListener('change', function () { act(function () { return setCount(it, m, parseInt(cnt.value, 10)); }); });
      var plus = el('button', 'round add', '+'); plus.type = 'button'; plus.disabled = n >= max;
      plus.setAttribute('aria-label', 'One more: ' + it.text);
      plus.addEventListener('click', function () { act(function () { return setCount(it, m, getCount(it.id, m) + 1); }); });
      st.appendChild(minus); st.appendChild(cnt); st.appendChild(plus);
      row.appendChild(st);
    } else {
      var on = it.mode === 'monthly' ? getCount(it.id, m) > 0 : countAll(it.id) > 0;
      if (it.mode === 'monthly') sub.textContent = on ? 'Done for ' + monthName(m) : 'Tap when completed for ' + monthName(m);
      else sub.textContent = on ? 'Done' : 'One time only';
      if (on) row.classList.add('done');
      var chk = el('button', 'check' + (on ? ' on' : ''), '✓'); chk.type = 'button';
      chk.setAttribute('aria-pressed', on ? 'true' : 'false');
      chk.setAttribute('aria-label', it.text);
      if (it.auto) chk.disabled = true;
      chk.addEventListener('click', function () {
        act(function () {
          if (!on) return setCount(it, m, 1);
          return it.mode === 'monthly' ? setCount(it, m, 0) : clearAll(it);
        });
      });
      row.appendChild(chk);
    }
    return row;
  }

  function bars(container, rows) {
    var maxV = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    container.textContent = '';
    rows.forEach(function (r) {
      var row = el('div', 'bar-row'), lbl = el('div', 'lbl');
      lbl.appendChild(el('span', null, r.name)); lbl.appendChild(el('span', null, r.v));
      var bar = el('div', 'bar'), fill = el('i'); fill.style.width = (r.v / maxV * 100) + '%'; bar.appendChild(fill);
      row.appendChild(lbl); row.appendChild(bar); container.appendChild(row);
    });
  }

  function renderProgress() {
    var p = state.profile, tot = total();
    var ms = $('milestones'); ms.textContent = '';
    milestones().forEach(function (m) {
      var box = el('div', 'ms' + (tot >= m.pts ? ' hit' : ''));
      box.appendChild(el('div', 'e', MS_INFO[m.key].e));
      box.appendChild(el('div', 'p', m.label));
      box.appendChild(el('div', 'n', m.key > 100 ? 'points' : m.pts.toLocaleString() + ' pts'));
      ms.appendChild(box);
    });

    var sums = {}; C.categories.forEach(function (c) { sums[c.id] = 0; });
    Object.keys(state.counts).forEach(function (m) {
      Object.keys(state.counts[m]).forEach(function (id) { var it = ITEMS[id]; if (it) sums[it.cat] += state.counts[m][id] * it.pts; });
    });
    var rows = C.categories.map(function (c) { return { name: c.name, v: sums[c.id] }; });
    if (p.carryover_points) rows.push({ name: 'Carried over from spreadsheet', v: p.carryover_points });
    bars($('breakdown'), rows);

    var h = $('history'); h.textContent = '';
    var wrap = el('div', 'pad'); wrap.style.padding = '1rem';
    bars(wrap, months().map(function (m) { return { name: monthName(m, true), v: monthPoints(m) }; }));
    h.appendChild(wrap);
  }

  // ---------- navigation ----------
  document.querySelectorAll('.tabbar button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tabbar button').forEach(function (x) { x.classList.toggle('active', x === b); });
      ['log', 'progress', 'me'].forEach(function (t) { $('tab-' + t).hidden = t !== b.dataset.tab; });
      window.scrollTo(0, 0);
    });
  });
  $('month-prev').addEventListener('click', function () { state.month = clampMonth(shiftMonth(state.month, -1)); renderLog(); });
  $('month-next').addEventListener('click', function () { state.month = clampMonth(shiftMonth(state.month, 1)); renderLog(); });

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

  // Deleting takes two taps so it can't happen by accident.
  var armTimer;
  $('delete-account').addEventListener('click', async function () {
    var btn = $('delete-account');
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed'); btn.textContent = 'Tap again to permanently delete everything';
      clearTimeout(armTimer);
      armTimer = setTimeout(function () { btn.classList.remove('armed'); btn.textContent = 'Delete my account and data'; }, 6000);
      return;
    }
    clearTimeout(armTimer); btn.disabled = true; setMsg('delete-msg', '');
    var r = await sb.functions.invoke('delete-account', { body: {} });
    btn.disabled = false; btn.classList.remove('armed'); btn.textContent = 'Delete my account and data';
    if (r.error) { setMsg('delete-msg', 'Could not delete your account. Please try again.'); return; }
    await sb.auth.signOut({ scope: 'local' });
    try { localStorage.clear(); } catch (e) {}
    toast('Your account and data were deleted.');
  });

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
      await setCount(ITEMS.join, currentMonth(), 1);
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
    state.month = currentMonth();
    fillSettings(); show('main'); render(); checkMilestones();
  }

  // ---------- startup ----------
  var loadedFor = null;
  async function onSession(session) {
    if (!session) {
      loadedFor = null; state.user = null; state.profile = null; state.counts = {};
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
      if (!r.data) { state.profile = null; state.counts = {}; show('onboard'); return; }
      state.profile = r.data;
      await loadCounts();
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
