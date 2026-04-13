// キャンバス描画 — 背景・グリッド・軸・各 Joint の draw・ペンディング/スナップのプレビュー。
// Joint は drawOrder の小さい順に描画されるので、奥→手前のレイヤー順が自然に表現される。
(() => {
  const { state } = App;
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);

  function drawBackground() {
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, W, H);
    const G = state.gridSize, ox = state.originX, oy = state.originY;
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const firstX = ox - Math.floor(ox / G) * G;
    for (let x = firstX; x < W; x += G) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    const firstY = oy - Math.floor(oy / G) * G;
    for (let y = firstY; y < H; y += G) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    if (state.showAxes) {
      ctx.strokeStyle = '#5a6a78';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, oy); ctx.lineTo(W, oy);
      ctx.moveTo(ox, 0); ctx.lineTo(ox, H);
      ctx.stroke();
      ctx.fillStyle = '#8a9aaa';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('O', ox + 4, oy - 4);
      ctx.fillText('X', W - 12, oy - 4);
      ctx.fillText('Y', ox + 4, 10);
      const step = G * 2;
      for (let x = ox + step; x < W; x += step) ctx.fillText(Math.round(x - ox).toString(), x + 2, oy + 12);
      for (let x = ox - step; x > 0; x -= step) ctx.fillText(Math.round(x - ox).toString(), x + 2, oy + 12);
      for (let y = oy - step; y > 0; y -= step) ctx.fillText(Math.round(oy - y).toString(), ox + 4, y);
      for (let y = oy + step; y < H; y += step) ctx.fillText(Math.round(oy - y).toString(), ox + 4, y);
    }
  }

  function drawPendingAndSnap() {
    const from = state.pending ? { x: state.pending.x, y: state.pending.y } : null;
    const snap = App.util.snapPos(state.mouse.x, state.mouse.y, from);
    if (state.pending) {
      const spec = App.Joints.get(state.pending.tool);
      ctx.strokeStyle = (spec && spec.pendingColor) || '#6a9fd8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(state.pending.x, state.pending.y);
      ctx.lineTo(snap.x, snap.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const d = Math.hypot(snap.x - state.pending.x, snap.y - state.pending.y);
      const ang = Math.atan2(snap.y - state.pending.y, snap.x - state.pending.x) * 180 / Math.PI;
      ctx.fillStyle = '#9ab8dc';
      ctx.font = '12px ui-monospace, monospace';
      ctx.fillText(`${d.toFixed(0)}  ∠${ang.toFixed(0)}°`, (state.pending.x + snap.x)/2 + 8, (state.pending.y + snap.y)/2 - 6);
    }
    if (snap.type !== 'free' && snap.type !== 'particle') {
      ctx.strokeStyle = '#ffee88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(snap.x - 6, snap.y); ctx.lineTo(snap.x + 6, snap.y);
      ctx.moveTo(snap.x, snap.y - 6); ctx.lineTo(snap.x, snap.y + 6);
      ctx.stroke();
      if (snap.type.includes('angle') && from) {
        const ang = Math.round(Math.atan2(snap.y - from.y, snap.x - from.x) * 180 / Math.PI);
        ctx.fillStyle = '#ffee88';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`${ang}°`, snap.x + 10, snap.y - 10);
      }
    }
    if (snap.particleIdx >= 0) {
      const p = state.particles[snap.particleIdx];
      ctx.strokeStyle = '#ffee88';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 可動域ツール: 選択粒子にかかる各拘束の「許される位置」を描画する。
  // ロッド→相手端点を中心とする円、スライダー→レール線分、一致拘束→相手粒子の点。
  // 2 つ以上のラインが交わる点に置くと複数拘束を同時に満たせる。
  function drawFeasibility() {
    const idx = state.feasibilityTarget;
    if (idx == null || !state.particles[idx]) return;
    const P = state.particles[idx];

    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;

    // Rod constraints: circle around the other endpoint
    ctx.strokeStyle = 'rgba(130, 217, 130, 0.75)';
    for (const rod of state.rods) {
      if (rod.a !== idx && rod.b !== idx) continue;
      const otherIdx = rod.a === idx ? rod.b : rod.a;
      const Q = state.particles[otherIdx];
      ctx.beginPath();
      ctx.arc(Q.x, Q.y, rod.length, 0, Math.PI * 2);
      ctx.stroke();
      // label at top of circle
      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(130, 217, 130, 0.95)';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`${rod.name}:${Q.name} r=${rod.length.toFixed(0)}`, Q.x + rod.length + 4, Q.y);
      ctx.restore();
    }

    // Slider constraints: rail segment
    ctx.strokeStyle = 'rgba(122, 206, 240, 0.85)';
    for (const sld of state.sliders) {
      if (sld.particle !== idx) continue;
      const a = state.particles[sld.a], b = state.particles[sld.b];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Coincidence constraints: mark the other particle
    ctx.strokeStyle = 'rgba(93, 226, 163, 0.9)';
    ctx.fillStyle = 'rgba(93, 226, 163, 0.35)';
    for (const c of state.coincidences) {
      if (c.a !== idx && c.b !== idx) continue;
      const otherIdx = c.a === idx ? c.b : c.a;
      const Q = state.particles[otherIdx];
      ctx.beginPath();
      ctx.arc(Q.x, Q.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();

    // target marker
    ctx.strokeStyle = '#ffcb6b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(P.x, P.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffcb6b';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillText(`可動域: ${P.name}`, P.x + 16, P.y - 14);
  }

  function drawViolationBanner() {
    const violated = state.rods.filter(r => App.physics.rodViolated(r));
    if (violated.length === 0) return;
    const pad = 10, h = 34;
    const names = violated.slice(0, 4).map(r => r.name).join(', ') + (violated.length > 4 ? ` 他${violated.length - 4}本` : '');
    ctx.fillStyle = 'rgba(200, 40, 40, 0.92)';
    ctx.fillRect(pad, pad, 540, h);
    ctx.strokeStyle = '#ff8866';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 0.5, pad + 0.5, 540, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.fillText(`⚠ 物理的に不可能: ${violated.length}本のロッドが長さを保てていません (${names})`,
      pad + 10, pad + 21);
  }

  function render() {
    drawBackground();
    for (const spec of App.Joints.inDrawOrder()) {
      if (!spec.draw) continue;
      const arr = state[spec.storage];
      for (let i = 0; i < arr.length; i++) {
        const sel = !!(state.selected && state.selected.type === spec.type && state.selected.index === i);
        spec.draw(ctx, arr[i], state, sel, i);
      }
    }
    drawPendingAndSnap();
    drawFeasibility();
    drawViolationBanner();
  }

  function loop() {
    if (state.playing) App.physics.step();
    render();
    requestAnimationFrame(loop);
  }

  App.canvas = {
    el: canvas,
    ctx,
    resize,
    render,
    loop,
    size() { return { W, H }; },
  };
})();
