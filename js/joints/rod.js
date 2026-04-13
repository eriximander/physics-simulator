// ロッド (距離拘束) — 2 粒子間を固定長で結ぶ。
// 構造: { name, a, b, length }  a,b は state.particles の index。
(() => {
  const { state } = App;

  App.Joints.register({
    type: 'rod',
    title: 'リンク (ロッド)',
    storage: 'rods',
    counter: 'r',
    namePrefix: 'R',
    color: '#c0d0e0',
    pendingColor: '#6a9fd8',
    drawOrder: 30,
    solveOrder: 10,

    // 新規作成のファクトリ。a,b はすでに存在する粒子 index。
    create(aIdx, bIdx) {
      const a = state.particles[aIdx], b = state.particles[bIdx];
      const rod = {
        name: `R${++state.counters.r}`,
        a: aIdx, b: bIdx,
        length: Math.hypot(b.x - a.x, b.y - a.y),
      };
      state.rods.push(rod);
      return state.rods.length - 1;
    },

    // Verletスタイルの距離拘束。固定/駆動点は動かさない。
    solve(rod) {
      const a = state.particles[rod.a], b = state.particles[rod.b];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx*dx + dy*dy) || 1e-5;
      const diff = (d - rod.length) / d;
      const mA = (a.pinned || a.driven) ? 0 : 1;
      const mB = (b.pinned || b.driven) ? 0 : 1;
      const total = mA + mB;
      if (total === 0) return;
      const px = dx * diff, py = dy * diff;
      a.x += px * (mA / total); a.y += py * (mA / total);
      b.x -= px * (mB / total); b.y -= py * (mB / total);
    },

    draw(ctx, rod, _state, selected) {
      const a = state.particles[rod.a], b = state.particles[rod.b];
      ctx.strokeStyle = selected ? '#ffcb6b' : '#c0d0e0';
      ctx.lineWidth = selected ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      ctx.stroke();
      if (selected) {
        const mx = (a.x + b.x)/2, my = (a.y + b.y)/2;
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        ctx.fillStyle = '#ffcb6b';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(`${rod.name} (${len.toFixed(1)})`, mx + 8, my - 8);
      }
    },

    listMeta(rod) {
      return { color: '#c0d0e0', sub: rod.length.toFixed(0) };
    },

    renderProps(box, rod, _state, api) {
      box.innerHTML = api.nameRow(rod) + `
        <div class="row"><label>長さ</label><input type="number" id="rodLen" value="${rod.length.toFixed(1)}" step="1" min="1"></div>
        <div class="row"><input type="range" id="rodLenR" min="5" max="800" step="1" value="${Math.min(800, Math.max(5, rod.length)).toFixed(0)}"></div>
        <div class="row" style="color:#888;font-size:11px">端点: ${state.particles[rod.a].name} ⇄ ${state.particles[rod.b].name}</div>
      `;
      api.bindName(rod);
      const lenEl = document.getElementById('rodLen'), rngEl = document.getElementById('rodLenR');
      const sync = (v, from) => {
        rod.length = Math.max(1, v);
        if (from !== 'num') lenEl.value = rod.length.toFixed(1);
        if (from !== 'rng') rngEl.value = Math.min(800, Math.max(5, rod.length));
        api.renderList();
      };
      lenEl.addEventListener('input', e => sync(+e.target.value, 'num'));
      rngEl.addEventListener('input', e => sync(+e.target.value, 'rng'));
    },

    // 粒子が消えた → この粒子を参照するロッドは削除され、残りは index を詰める。
    // ロッド削除は onRodRemoved のカスケードが必要なので util.removeRod 経由で行う
    // (util.removeParticle が先に依存ロッドを除去してから本フックを呼ぶ)。
    onParticleRemoved(idx, s, shift) {
      state.rods = state.rods.map(r => ({ ...r, a: shift(r.a), b: shift(r.b) }));
    },

    // ツール: 2 点クリックでロッドを作成。
    tool: {
      hint: '2点クリックでロッド作成。角度/格子/粒子にスナップ補正。',
      onClick(snap, s, api) {
        const { util } = App;
        let idx = snap.particleIdx >= 0 ? snap.particleIdx : util.addParticle(snap.x, snap.y);
        if (s.pending == null) {
          s.pending = { tool: 'rod', pIdx: idx, x: state.particles[idx].x, y: state.particles[idx].y };
        } else {
          const bIdx = snap.particleIdx >= 0 ? snap.particleIdx : util.addParticle(snap.x, snap.y);
          if (bIdx !== s.pending.pIdx) {
            App.Joints.get('rod').create(s.pending.pIdx, bIdx);
          }
          s.pending = null;
          api.renderList();
        }
      },
    },
  });
})();
