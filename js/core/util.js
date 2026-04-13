// 共通ユーティリティ — 幾何計算、スナップ、粒子/リンク追加・削除。
(() => {
  const { state, constants } = App;
  const util = {};

  util.distPointSeg = (x, y, ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay;
    const wx = x - ax, wy = y - ay;
    const len2 = vx*vx + vy*vy;
    let t = len2 > 0 ? (vx*wx + vy*wy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t*vx, py = ay + t*vy;
    return { d: Math.hypot(x - px, y - py), t };
  };

  util.getParticleAt = (x, y, r = constants.SNAP_PARTICLE, excludeIdx = -1) => {
    let best = -1, bestD2 = r * r;
    for (let i = 0; i < state.particles.length; i++) {
      if (i === excludeIdx) continue;
      const p = state.particles[i];
      const dx = p.x - x, dy = p.y - y, d2 = dx*dx + dy*dy;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }
    return best;
  };

  util.getRodAt = (x, y, r = constants.HIT) => {
    let best = -1, bestD = r;
    for (let i = 0; i < state.rods.length; i++) {
      const rod = state.rods[i];
      const a = state.particles[rod.a], b = state.particles[rod.b];
      const { d } = util.distPointSeg(x, y, a.x, a.y, b.x, b.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  util.getSliderAt = (x, y, r = constants.HIT) => {
    let best = -1, bestD = r;
    for (let i = 0; i < state.sliders.length; i++) {
      const s = state.sliders[i];
      const a = state.particles[s.a], b = state.particles[s.b];
      const { d } = util.distPointSeg(x, y, a.x, a.y, b.x, b.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  // ---- スナップ ----
  // 優先度: 1) 既存粒子  2) 角度スナップ  3) 格子スナップ  4) 結果がまた既存粒子に重なったら再利用
  util.snapPos = (mx, my, from, excludeIdx = -1) => {
    let pIdx = util.getParticleAt(mx, my, constants.SNAP_PARTICLE, excludeIdx);
    if (pIdx >= 0) {
      const p = state.particles[pIdx];
      return { x: p.x, y: p.y, particleIdx: pIdx, type: 'particle' };
    }
    let sx = mx, sy = my, type = 'free';
    if (from && state.snapAngle) {
      const dx = mx - from.x, dy = my - from.y;
      const len = Math.hypot(dx, dy);
      if (len > 5) {
        const ang = Math.atan2(dy, dx);
        let bestSa = null, bestDiff = constants.ANGLE_SNAP_RAD;
        for (const sa of constants.ANGLE_SNAPS) {
          let diff = ang - sa;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          if (Math.abs(diff) < bestDiff) { bestDiff = Math.abs(diff); bestSa = sa; }
        }
        if (bestSa !== null) {
          sx = from.x + len * Math.cos(bestSa);
          sy = from.y + len * Math.sin(bestSa);
          type = 'angle';
        }
      }
    }
    if (state.snapGrid) {
      const G = state.gridSize, ox = state.originX, oy = state.originY;
      const gx = Math.round((sx - ox) / G) * G + ox;
      const gy = Math.round((sy - oy) / G) * G + oy;
      let hx = false, hy = false;
      if (Math.abs(sx - gx) < constants.SNAP_GRID_PX) { sx = gx; hx = true; }
      if (Math.abs(sy - gy) < constants.SNAP_GRID_PX) { sy = gy; hy = true; }
      if (hx || hy) type = type === 'angle' ? 'angle+grid' : 'grid';
    }
    pIdx = util.getParticleAt(sx, sy, Math.max(constants.SNAP_PARTICLE, constants.MERGE_EPS), excludeIdx);
    if (pIdx >= 0) {
      const p = state.particles[pIdx];
      return { x: p.x, y: p.y, particleIdx: pIdx, type: 'particle' };
    }
    return { x: sx, y: sy, particleIdx: -1, type };
  };

  // ---- 粒子の追加・削除 ----
  util.addParticle = (x, y, pinned = false) => {
    const name = `P${++state.counters.p}`;
    state.particles.push({ name, x, y, px: x, py: y, pinned, driven: false });
    return state.particles.length - 1;
  };

  // 粒子を削除する手順:
  //  1) この粒子を端点にもつロッドを util.removeRod() 経由で消す
  //     (→ angleConstraint.onRodRemoved がロッド削除に連鎖的に呼ばれる)
  //  2) 各ジョイントに「粒子 idx が消える」ことを伝え、参照を片付けて index を詰める
  //  3) state.particles から外す
  util.removeParticle = (idx) => {
    const shift = i => i > idx ? i - 1 : i;
    const depRods = [];
    state.rods.forEach((r, i) => { if (r.a === idx || r.b === idx) depRods.push(i); });
    for (let k = depRods.length - 1; k >= 0; k--) util.removeRod(depRods[k]);
    for (const spec of App.Joints.all()) {
      if (spec.onParticleRemoved) spec.onParticleRemoved(idx, state, shift);
    }
    state.particles.splice(idx, 1);
    state.selected = null;
  };

  // ロッドを削除し、依存ジョイントに通知する。
  util.removeRod = (idx) => {
    const shiftR = i => i > idx ? i - 1 : i;
    for (const spec of App.Joints.all()) {
      if (spec.onRodRemoved) spec.onRodRemoved(idx, state, shiftR);
    }
    state.rods.splice(idx, 1);
    state.selected = null;
  };

  // 登録された種別ごとの delete ルータ。
  util.deleteItem = (type, idx) => {
    if (type === 'particle') { util.removeParticle(idx); return; }
    if (type === 'rod') { util.removeRod(idx); return; }
    const spec = App.Joints.get(type);
    if (!spec) return;
    const arr = state[spec.storage];
    const item = arr[idx];
    if (spec.onDeleteSelf) spec.onDeleteSelf(item, state);
    arr.splice(idx, 1);
    state.selected = null;
  };

  App.util = util;
})();
