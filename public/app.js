(() => {
  const socket = io();
  const $ = id => document.getElementById(id);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const COLORS = ['#ff3d2e', '#ffcf33', '#2fd9a0', '#3aa8ff', '#ff8a2e', '#121212'];
  const colorFor = name => { let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return COLORS[h % COLORS.length]; };

  let current = null, prev = null, connected = false, shownKey = '';
  const lastPoints = {};
  const isOverlay = document.body.classList.contains('overlay-page');

  /* ---------- Confetti ---------- */
  const canvas = $('confetti'); const ctx = canvas ? canvas.getContext('2d') : null; let bits = [], raf = 0;
  function fit() { if (!canvas) return; const r = window.devicePixelRatio || 1; canvas.width = innerWidth * r; canvas.height = innerHeight * r; ctx.setTransform(r, 0, 0, r, 0, 0); }
  function burst() {
    if (!ctx || reduced) return; fit();
    const cx = innerWidth / 2, cy = innerHeight * 0.38;
    for (let i = 0; i < 150; i++) {
      const a = Math.random() * Math.PI * 2, v = 5 + Math.random() * 11;
      bits.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, w: 6 + Math.random() * 7, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: COLORS[i % COLORS.length], life: 1 });
    }
    if (!raf) raf = requestAnimationFrame(step);
  }
  function step() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bits = bits.filter(b => b.life > 0 && b.y < innerHeight + 40);
    for (const b of bits) { b.vy += .28; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.life -= .007; ctx.save(); ctx.globalAlpha = Math.max(0, b.life); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore(); }
    raf = bits.length ? requestAnimationFrame(step) : 0; if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(text, good) { const t = $('toast'); if (!t) return; t.textContent = text; t.className = 'show' + (good ? ' good' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = '', 3600); }

  /* ---------- Timer ---------- */
  function tick() {
    const c = current && current.challenge; if (!c) return;
    const total = c.ends_at - c.created_at, left = c.ends_at - Date.now(), frac = Math.min(1, Math.max(0, left / total));
    const over = left <= 0, crit = !over && left <= 10000, warn = !over && !crit && frac <= .4;
    const set = (ring, arc, time, label) => {
      if (!ring) return;
      ring.classList.toggle('over', over); ring.classList.toggle('crit', crit); ring.classList.toggle('warn', warn);
      if (arc) arc.style.width = (frac * 100).toFixed(2) + '%';
      if (time) time.textContent = over ? '00:00' : clock(left);
      if (label) label.textContent = over ? 'Time is up' : 'Left';
    };
    set($('ring'), $('arc'), $('timer'), $('timer-label'));
    set($('ov-ring'), $('ov-arc'), $('overlay-time'), $('overlay-timer-label'));
    const ovc = $('ov-card'); if (ovc) { ovc.classList.toggle('warn', warn); ovc.classList.toggle('crit', crit); }
    const card = $('ov-card'); if (card) card.dataset.state = over ? 'over' : 'live';
    const pill = $('challenge-status');
    if (pill && !isOverlay) { pill.className = 'pill ' + (over ? 'over' : 'active'); pill.querySelector('b').textContent = over ? 'Time is up' : 'Live'; }
  }

  /* ---------- Leaderboard ---------- */
  function leaderHtml(leaders, overlay) {
    const bumped = u => lastPoints[u.username] !== undefined && u.points > lastPoints[u.username];
    if (overlay) return leaders.slice(0, 5).map((u, i) => `<div class="ov-row${bumped(u) ? ' bump' : ''}" style="animation-delay:${i * 70}ms"><span class="n">${i + 1}</span><strong>${esc(u.username)}</strong><b>${u.points}<small>PTS</small></b></div>`).join('');
    const cls = ['first', 'second', 'third'];
    return leaders.slice(0, 8).map((u, i) => `<div class="lrow ${cls[i] || ''}${bumped(u) ? ' bump' : ''}" style="animation-delay:${i * 60}ms"><span class="rk">${i + 1}</span><span class="av" style="background:${colorFor(u.username)}">${esc(u.username.charAt(0).toUpperCase())}</span><div class="who"><strong>${esc(u.username)}</strong><small>${u.wins} ${u.wins === 1 ? 'dare' : 'dares'} done</small></div><div class="pts">${u.points}<small>POINTS</small></div></div>`).join('');
  }

  /* ---------- Render ---------- */
  function render(s) {
    prev = current; current = s;
    const c = s.challenge, leaders = s.leaderboard || [];
    const prevC = prev && prev.challenge;

    // A challenge that just ended: celebrate if its creator was awarded points.
    if (prevC && !c) {
      const before = (prev.leaderboard || []).reduce((n, u) => n + u.points, 0), after = leaders.reduce((n, u) => n + u.points, 0);
      if (after > before) { burst(); if (!isOverlay) toast(`+${after - before} points for @${prevC.suggested_by}`, true); }
      else if (!isOverlay) toast('Dare closed');
    }

    if (!isOverlay) {
      const online = connected && s.twitchConnected;
      const conn = $('connection'); conn.classList.toggle('online', online); conn.classList.toggle('off', !connected);
      $('connection-title').textContent = !connected ? 'Reconnecting' : online ? 'Twitch connected' : 'Twitch not connected';
      $('connection-detail').textContent = !connected ? '' : online ? `#${s.channel}` : 'check settings';
      for (const id of ['done', 'fail', 'clear']) $(id).disabled = !c;

      const key = c ? 'c' + c.id : s.generating ? 'gen' : 'empty';
      if (key !== shownKey) {
        shownKey = key;
        const pill = $('challenge-status');
        if (c) {
          $('challenge-body').innerHTML = `<div class="running" id="ring"><span class="from">Chat's pick · @${esc(c.suggested_by)}</span><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p><div class="clock"><strong id="timer">--:--</strong><small id="timer-label">Left</small></div><div class="fuse"><i id="arc"></i></div></div>`;
        } else if (s.generating) {
          pill.className = 'pill working'; pill.querySelector('b').textContent = 'Creating';
          $('challenge-body').innerHTML = `<div class="empty"><svg class="mark" aria-hidden="true"><use href="#mark"/></svg><div><h3>Making a dare</h3><p>Turning a viewer's idea into something you can do on stream.</p></div></div>`;
        } else {
          pill.className = 'pill'; pill.querySelector('b').textContent = 'Waiting';
          $('challenge-body').innerHTML = `<div class="empty"><svg class="mark" aria-hidden="true"><use href="#mark"/></svg><div><h3>Waiting on chat</h3><p>No dare is running. The next one starts the moment a viewer suggests it.</p><span class="hint">Chat types <code>!challenge &lt;idea&gt;</code></span></div></div>`;
        }
      }
      const board = $('leaderboard');
      board.innerHTML = leaders.length ? leaderHtml(leaders, false) : `<div class="board-empty"><strong>No points yet</strong><p>Mark a dare done and the viewer who suggested it takes first place.</p></div>`;
    } else {
      const card = $('ov-card'), key = c ? 'c' + c.id : s.generating ? 'gen' : 'idle';
      if (key !== shownKey) {
        shownKey = key;
        if (c) {
          card.dataset.state = 'live'; $('overlay-title').textContent = c.title; $('overlay-description').textContent = c.description; $('overlay-meta').textContent = `Suggested by @${c.suggested_by}`;
        } else {
          card.dataset.state = s.generating ? 'working' : 'idle';
          $('overlay-title').textContent = 'Making a dare'; $('overlay-description').innerHTML = s.generating ? 'Turning chat\'s idea into a dare…' : 'Type <b>!challenge</b> and your idea.'; $('overlay-meta').textContent = 'Chat is in control';
        }
        card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
      }
      $('ov-board').classList.toggle('hidden', !leaders.length);
      $('overlay-leaderboard').innerHTML = leaderHtml(leaders, true);
    }

    leaders.forEach(u => { lastPoints[u.username] = u.points; });
    tick();
  }

  socket.on('connect', () => { connected = true; if (current) render(current); });
  socket.on('disconnect', () => { connected = false; if (current) render(current); });
  socket.on('state', render);
  setInterval(tick, 100);
  addEventListener('resize', () => { if (bits.length) fit(); });

  /* ---------- Controls ---------- */
  for (const id of ['done', 'fail', 'clear']) {
    const b = $(id); if (!b) continue;
    b.addEventListener('click', async () => {
      b.classList.add('busy');
      try {
        const res = await fetch(`/api/challenge/${id}`, { method: 'POST' }); const data = await res.json();
        if (!res.ok) throw Error(data.error);
      } catch (e) { toast(e.message || 'Something went wrong.'); }
      finally { b.classList.remove('busy'); }
    });
  }
  const copy = $('copy');
  if (copy) copy.addEventListener('click', async () => {
    const done = () => { copy.classList.add('ok'); $('copy-text').textContent = 'Copied'; setTimeout(() => { copy.classList.remove('ok'); $('copy-text').textContent = 'Copy'; }, 1800); };
    try { await navigator.clipboard.writeText('!challenge <your idea>'); done(); } catch { toast('Copy the command from the box.'); }
  });
})();
