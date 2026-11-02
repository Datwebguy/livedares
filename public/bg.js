/* Flowing silk background: thin threads that drift like heat haze behind the page. */
(() => {
  const c = document.getElementById('flow'); if (!c) return;
  const ctx = c.getContext('2d'); const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, t0 = performance.now(), running = true, mx = 0, my = 0;
  const bands = [
    { y: .30, amp: .14, f: 1.3, sp: .09, ph: 0,   hue: [8, 24],   n: 34, a: .50, w: .16 },
    { y: .46, amp: .12, f: 1.9, sp: -.07, ph: 2,  hue: [22, 42],  n: 30, a: .46, w: .13 },
    { y: .62, amp: .16, f: 1.1, sp: .06, ph: 4,   hue: [38, 50],  n: 34, a: .40, w: .18 },
    { y: .78, amp: .10, f: 2.3, sp: -.10, ph: 1,  hue: [160, 176],n: 22, a: .30, w: .10 },
    { y: .20, amp: .09, f: 2.7, sp: .12, ph: 5,   hue: [350, 12], n: 20, a: .34, w: .09 }
  ];
  function size() { dpr = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight; c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function frame(now) {
    const t = (now - t0) / 1000; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#0b0a09'; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.1;
    const step = Math.max(10, W / 90);
    for (const b of bands) {
      for (let i = 0; i < b.n; i++) {
        const k = i / (b.n - 1), spread = (k - .5) * b.w * H, hue = b.hue[0] + (b.hue[1] - b.hue[0]) * k;
        ctx.strokeStyle = `hsla(${hue},95%,58%,${b.a * (0.25 + 0.75 * Math.sin(k * Math.PI)) * .5})`;
        ctx.beginPath();
        for (let x = -step; x <= W + step; x += step) {
          const u = x / W, ph = t * b.sp * 6.28 + b.ph;
          const y = b.y * H + spread * (1 + .55 * Math.sin(u * 3 + ph)) + Math.sin(u * b.f * 6.28 + ph) * b.amp * H + Math.sin(u * b.f * 2.9 - ph * 1.3 + k * 2) * b.amp * H * .45 + my * 14 * (b.y - .5);
          x === -step ? ctx.moveTo(x + mx * 10, y) : ctx.lineTo(x + mx * 10, y);
        }
        ctx.stroke();
      }
    }
    if (running && !reduced) requestAnimationFrame(frame);
  }
  size(); addEventListener('resize', () => { size(); if (reduced) frame(performance.now()); });
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running && !reduced) requestAnimationFrame(frame); });
  frame(performance.now());
})();
