// 保存 / 読込 / 全削除 / 重複点統合 — localStorage ベース。
(() => {
  const { state, util } = App;

  function save() {
    localStorage.setItem('physics_save', JSON.stringify({
      particles: state.particles,
      rods: state.rods,
      motors: state.motors,
      sliders: state.sliders,
      angleConstraints: state.angleConstraints,
      coincidences: state.coincidences,
      counters: state.counters,
      originX: state.originX,
      originY: state.originY,
      gridSize: state.gridSize,
    }));
    alert('保存しました');
  }

  function load() {
    const s = localStorage.getItem('physics_save');
    if (!s) { alert('保存データがありません'); return; }
    try {
      const d = JSON.parse(s);
      state.particles = d.particles.map(p => ({ ...p, px: p.x, py: p.y, driven: p.driven || false }));
      state.rods = d.rods;
      state.motors = d.motors || [];
      state.sliders = d.sliders || [];
      state.angleConstraints = d.angleConstraints || [];
      state.coincidences = d.coincidences || [];
      state.counters = d.counters || {
        p: state.particles.length, r: state.rods.length, m: state.motors.length,
        s: state.sliders.length, a: state.angleConstraints.length, c: state.coincidences.length,
      };
      if (d.originX != null) state.originX = d.originX;
      if (d.originY != null) state.originY = d.originY;
      if (d.gridSize) { state.gridSize = d.gridSize; document.getElementById('gridSize').value = d.gridSize; }
      state.selected = null; state.pending = null;
      App.sidebar.updateProps(); App.sidebar.renderList();
    } catch (err) { alert('読込失敗: ' + err.message); }
  }

  function clearAll() {
    if (!confirm('全削除しますか？')) return;
    state.particles = []; state.rods = []; state.motors = []; state.sliders = [];
    state.angleConstraints = []; state.coincidences = [];
    state.counters = { p: 0, r: 0, m: 0, s: 0, a: 0, c: 0 };
    state.selected = null; state.pending = null;
    App.sidebar.updateProps(); App.sidebar.renderList();
  }

  // fromIdx を指す全ての参照を toIdx に差し替える (重複点統合で使用)。
  function redirectParticle(fromIdx, toIdx) {
    state.rods.forEach(r => { if (r.a === fromIdx) r.a = toIdx; if (r.b === fromIdx) r.b = toIdx; });
    state.motors.forEach(m => { if (m.center === fromIdx) m.center = toIdx; if (m.driven === fromIdx) m.driven = toIdx; });
    state.sliders.forEach(s => {
      if (s.particle === fromIdx) s.particle = toIdx;
      if (s.a === fromIdx) s.a = toIdx;
      if (s.b === fromIdx) s.b = toIdx;
    });
    state.angleConstraints.forEach(ac => { if (ac.joint === fromIdx) ac.joint = toIdx; });
    state.coincidences.forEach(c => { if (c.a === fromIdx) c.a = toIdx; if (c.b === fromIdx) c.b = toIdx; });
    // 端点が一致してしまったロッドは縮退しているので削除 (AC もカスケード)
    for (let ri = state.rods.length - 1; ri >= 0; ri--) {
      if (state.rods[ri].a === state.rods[ri].b) util.removeRod(ri);
    }
    state.motors = state.motors.filter(m => m.center !== m.driven);
    state.sliders = state.sliders.filter(s => s.particle !== s.a && s.particle !== s.b && s.a !== s.b);
    state.coincidences = state.coincidences.filter(c => c.a !== c.b);
  }

  function mergeOverlapping(eps = App.constants.MERGE_EPS) {
    let merged = 0, changed = true;
    while (changed) {
      changed = false;
      outer:
      for (let i = 0; i < state.particles.length; i++) {
        for (let j = i + 1; j < state.particles.length; j++) {
          const pi = state.particles[i], pj = state.particles[j];
          if (Math.hypot(pi.x - pj.x, pi.y - pj.y) < eps) {
            if (pj.pinned) pi.pinned = true;
            if (pj.driven) pi.driven = true;
            redirectParticle(j, i);
            util.removeParticle(j);
            merged++; changed = true;
            break outer;
          }
        }
      }
    }
    return merged;
  }

  function setup() {
    document.getElementById('saveBtn').addEventListener('click', save);
    document.getElementById('loadBtn').addEventListener('click', load);
    document.getElementById('clearBtn').addEventListener('click', clearAll);
    document.getElementById('mergeBtn').addEventListener('click', () => {
      const n = mergeOverlapping(8);
      state.selected = null;
      App.sidebar.updateProps(); App.sidebar.renderList();
      alert(n === 0 ? '重複点はありませんでした' : `${n}件の重複点を統合しました`);
    });
  }

  App.io = { setup, save, load, clearAll, mergeOverlapping };
})();
