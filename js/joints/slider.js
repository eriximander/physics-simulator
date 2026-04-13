// スライダー (直進拘束) — 粒子を 2 点を結ぶ線分上に拘束する。
// 構造: { name, particle, a, b }  particle は拘束される粒子、a,b はレール両端。
(() => {
  const { state } = App;

  App.Joints.register({
    type: 'slider',
    title: 'スライダー',
    storage: 'sliders',
    counter: 's',
    namePrefix: 'S',
    color: '#7acef0',
    pendingColor: '#7acef0',
    drawOrder: 10,
    solveOrder: 40,

    // 物理反復の最後で「粒子を線分の最近点に押し戻す」だけ。
    solve(s) {
      const p = state.particles[s.particle];
      if (p.pinned || p.driven) return;
      const a = state.particles[s.a], b = state.particles[s.b];
      const { t } = App.util.distPointSeg(p.x, p.y, a.x, a.y, b.x, b.y);
      p.x = a.x + t * (b.x - a.x);
      p.y = a.y + t * (b.y - a.y);
    },

    draw(ctx, s, _state, selected) {
      const a = state.particles[s.a], b = state.particles[s.b];
      ctx.strokeStyle = selected ? '#7acef0' : '#4a7a90';
      ctx.lineWidth = selected ? 5 : 3;
      ctx.setLineDash([8, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      const drawStop = (px, py, dx, dy) => {
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len * 8, ny = dx / len * 8;
        ctx.beginPath();
        ctx.moveTo(px - nx, py - ny); ctx.lineTo(px + nx, py + ny); ctx.stroke();
      };
      ctx.strokeStyle = selected ? '#7acef0' : '#4a7a90';
      ctx.lineWidth = selected ? 4 : 2;
      drawStop(a.x, a.y, b.x - a.x, b.y - a.y);
      drawStop(b.x, b.y, b.x - a.x, b.y - a.y);
    },

    listMeta(s) {
      const a = state.particles[s.a], b = state.particles[s.b];
      return { color: '#7acef0', sub: Math.hypot(b.x - a.x, b.y - a.y).toFixed(0) };
    },

    renderProps(box, s, _state, api) {
      const a = state.particles[s.a], b = state.particles[s.b], p = state.particles[s.particle];
      const rail = Math.hypot(b.x - a.x, b.y - a.y);
      box.innerHTML = api.nameRow(s) + `
        <div class="row"><label>駆動点</label><button id="selP" style="flex:1">${p.name}</button></div>
        <div class="row"><label>端A (上端)</label><button id="selA" style="flex:1">${a.name}</button></div>
        <div class="row"><label>端B (下端)</label><button id="selB" style="flex:1">${b.name}</button></div>
        <div class="row"><label>レール長</label><span class="num" style="color:#ddd;width:auto">${rail.toFixed(1)}</span></div>
      `;
      api.bindName(s);
      document.getElementById('selP').addEventListener('click', () => api.setSelected({ type: 'particle', index: s.particle }));
      document.getElementById('selA').addEventListener('click', () => api.setSelected({ type: 'particle', index: s.a }));
      document.getElementById('selB').addEventListener('click', () => api.setSelected({ type: 'particle', index: s.b }));
    },

    onParticleRemoved(idx, s, shift) {
      s.sliders = s.sliders
        .filter(sl => sl.particle !== idx && sl.a !== idx && sl.b !== idx)
        .map(sl => ({ ...sl, particle: shift(sl.particle), a: shift(sl.a), b: shift(sl.b) }));
    },

    // この粒子はいずれかのスライダーに属しているか?
    isPart(idx) {
      return state.sliders.some(s => s.particle === idx || s.a === idx || s.b === idx);
    },

    // ツール: 駆動点 → 端 A → 端 B の 3 クリック。
    tool: {
      hint: '駆動点→端A→端Bの順に3回クリック。',
      onClick(snap, s, api) {
        const { util } = App;
        const st = s.pending ? s.pending.step : 0;
        let idx = snap.particleIdx;
        if (st === 0) {
          if (idx < 0) idx = util.addParticle(snap.x, snap.y);
          const p = state.particles[idx];
          if (p.driven || p.pinned) { alert('駆動/固定点はスライダー駆動点にできません'); return; }
          if (App.Joints.get('slider').isPart(idx)) { alert('この点は既にスライダーに属しています'); return; }
          s.pending = { tool: 'slider', step: 1, pIdx: idx, x: p.x, y: p.y };
        } else if (st === 1) {
          if (idx < 0) idx = util.addParticle(snap.x, snap.y, true);
          if (idx === s.pending.pIdx) { alert('駆動点と端点は同じにできません'); return; }
          s.pending = { tool: 'slider', step: 2, pIdx: s.pending.pIdx, aIdx: idx, x: state.particles[idx].x, y: state.particles[idx].y };
        } else if (st === 2) {
          if (idx < 0) idx = util.addParticle(snap.x, snap.y, true);
          if (idx === s.pending.aIdx || idx === s.pending.pIdx) { alert('異なる点を選んでください'); return; }
          const pIdx = s.pending.pIdx, aIdx = s.pending.aIdx, bIdx = idx;
          s.sliders.push({ name: `S${++s.counters.s}`, particle: pIdx, a: aIdx, b: bIdx });
          const p = state.particles[pIdx], a = state.particles[aIdx], b = state.particles[bIdx];
          const { t } = util.distPointSeg(p.x, p.y, a.x, a.y, b.x, b.y);
          p.x = a.x + t * (b.x - a.x); p.y = a.y + t * (b.y - a.y);
          p.px = p.x; p.py = p.y;
          s.pending = null;
          api.renderList();
        }
      },
    },
  });
})();
