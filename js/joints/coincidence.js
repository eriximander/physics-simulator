// 一致拘束 — 2 粒子を同じ位置に保つ (溶接)。片方は自由点である必要がある。
// 構造: { name, a, b }  どちらも state.particles の index。
(() => {
  const { state } = App;

  App.Joints.register({
    type: 'coincidence',
    title: '一致拘束',
    storage: 'coincidences',
    counter: 'c',
    namePrefix: 'C',
    color: '#2d9c6f',
    pendingColor: '#2d9c6f',
    drawOrder: 50,
    solveOrder: 20,

    // 重心へ均等に引き寄せる (固定/駆動点は動かさない)。
    solve(cc) {
      const a = state.particles[cc.a], b = state.particles[cc.b];
      const mA = (a.pinned || a.driven) ? 0 : 1;
      const mB = (b.pinned || b.driven) ? 0 : 1;
      const total = mA + mB;
      if (total === 0) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      a.x += dx * (mA / total); a.y += dy * (mA / total);
      b.x -= dx * (mB / total); b.y -= dy * (mB / total);
    },

    draw(ctx, cc, _state, selected) {
      const a = state.particles[cc.a], b = state.particles[cc.b];
      if (!a || !b) return;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > 1) {
        ctx.strokeStyle = selected ? '#5de2a3' : '#2d9c6f';
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = selected ? '#5de2a3' : '#2d9c6f';
      ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.fillText('=', mx - 3, my + 3);
    },

    listMeta(cc) {
      const a = state.particles[cc.a], b = state.particles[cc.b];
      return { color: '#2d9c6f', sub: a && b ? `${a.name}=${b.name}` : '' };
    },

    renderProps(box, cc, _state, api) {
      const a = state.particles[cc.a], b = state.particles[cc.b];
      box.innerHTML = api.nameRow(cc) + `
        <div class="row"><label>点A</label><button id="selCA" style="flex:1">${a.name}</button></div>
        <div class="row"><label>点B</label><button id="selCB" style="flex:1">${b.name}</button></div>
        <div style="font-size:11px;color:#888;margin-top:4px">2点の位置を一致させ続けます。片方は固定/駆動/スライダーに属していても構いません（片方は自由点が必要）。</div>
      `;
      api.bindName(cc);
      document.getElementById('selCA').addEventListener('click', () => api.setSelected({ type: 'particle', index: cc.a }));
      document.getElementById('selCB').addEventListener('click', () => api.setSelected({ type: 'particle', index: cc.b }));
    },

    onParticleRemoved(idx, s, shift) {
      s.coincidences = s.coincidences
        .filter(c => c.a !== idx && c.b !== idx)
        .map(c => ({ ...c, a: shift(c.a), b: shift(c.b) }));
    },

    // ツール: 既存の 2 粒子をクリック。新規生成はしない。
    tool: {
      hint: '2つの既存粒子をクリックで一致拘束（同位置に固定）。回転粒子に他のチェーンを繋ぐ時に使用。',
      onClick(snap, s, api) {
        if (snap.particleIdx < 0) { alert('既存の点をクリックしてください'); return; }
        if (s.pending == null) {
          s.pending = { tool: 'coincidence', pIdx: snap.particleIdx, x: state.particles[snap.particleIdx].x, y: state.particles[snap.particleIdx].y };
          return;
        }
        if (snap.particleIdx === s.pending.pIdx) { alert('異なる2点を選んでください'); s.pending = null; return; }
        const aIdx = s.pending.pIdx, bIdx = snap.particleIdx;
        const a = state.particles[aIdx], b = state.particles[bIdx];
        if ((a.pinned || a.driven) && (b.pinned || b.driven)) {
          alert('両方が固定/駆動点だと一致拘束は動作しません。片方は自由点にしてください。');
          s.pending = null; return;
        }
        if (s.coincidences.some(c => (c.a === aIdx && c.b === bIdx) || (c.a === bIdx && c.b === aIdx))) {
          alert('この2点は既に一致拘束で結ばれています'); s.pending = null; return;
        }
        s.coincidences.push({ name: `C${++s.counters.c}`, a: aIdx, b: bIdx });
        // 作成時に初期位置をすり合わせる
        const mA = (a.pinned || a.driven) ? 0 : 1, mB = (b.pinned || b.driven) ? 0 : 1;
        if (mA === 0 && mB === 1) { b.x = a.x; b.y = a.y; b.px = b.x; b.py = b.y; }
        else if (mB === 0 && mA === 1) { a.x = b.x; a.y = b.y; a.px = a.x; a.py = a.y; }
        else { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; a.x = b.x = mx; a.y = b.y = my; a.px = a.x; a.py = a.y; b.px = b.x; b.py = b.y; }
        s.pending = null;
        api.renderList();
      },
    },
  });
})();
