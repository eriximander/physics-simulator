// ツールバーとキャンバス入力ハンドリング。
// 2 種類のツールがある:
//  - ジョイント生成系 : Joint spec の tool.onClick に委譲 (rod/motor/slider/coincidence)
//  - 既存粒子操作系   : pin / drag / select / delete はこのファイル内で処理
(() => {
  const { state, util } = App;
  const canvas = App.canvas.el;

  // 既存粒子操作系ツールの定義。ジョイント生成と同じ hint を表示するだけ。
  const BUILTIN_TOOLS = {
    pin:    { hint: '点をクリックで固定⇄解除。' },
    drag:   { hint: '点をドラッグで移動。格子スナップが効きます。' },
    feasibility: { hint: '点をクリック→ドラッグで移動。各拘束が要求する「可動曲線」(円/線/点) が表示されます。' },
    select: { hint: 'クリックで選択。ジョイント(点)を選ぶと角度拘束の追加ができます。' },
    delete: { hint: 'クリックで削除。' },
  };
  // ジョイント生成中はシミュレーションを止める
  const PLACEMENT_TOOLS = new Set();
  for (const spec of App.Joints.all()) if (spec.tool) PLACEMENT_TOOLS.add(spec.type);

  function hintText(t) {
    if (BUILTIN_TOOLS[t]) return BUILTIN_TOOLS[t].hint;
    const spec = App.Joints.get(t);
    return spec && spec.tool ? spec.tool.hint : '';
  }

  function handleCanvasClick() {
    const from = state.pending ? { x: state.pending.x, y: state.pending.y } : null;
    const snap = util.snapPos(state.mouse.x, state.mouse.y, from);
    const tool = state.tool;
    const api = App.sidebar.api;

    // 1) ジョイント生成系: 登録された tool に委譲
    const spec = App.Joints.get(tool);
    if (spec && spec.tool) { spec.tool.onClick(snap, state, api); return; }

    // 2) 既存粒子操作系
    if (tool === 'pin') {
      if (snap.particleIdx >= 0) {
        const p = state.particles[snap.particleIdx];
        if (p.driven) { alert('駆動中の点はピン固定できません'); return; }
        p.pinned = !p.pinned;
        p.px = p.x; p.py = p.y;
        api.renderList();
      }
    } else if (tool === 'drag') {
      if (snap.particleIdx >= 0) state.dragging = snap.particleIdx;
    } else if (tool === 'feasibility') {
      if (snap.particleIdx >= 0) {
        state.feasibilityTarget = snap.particleIdx;
        state.dragging = snap.particleIdx;
        api.renderList();
      }
    } else if (tool === 'select') {
      if (snap.particleIdx >= 0) {
        const mIdx = App.Joints.get('motor').findByParticle(snap.particleIdx);
        state.selected = mIdx >= 0
          ? { type: 'motor', index: mIdx }
          : { type: 'particle', index: snap.particleIdx };
      } else {
        const rIdx = util.getRodAt(state.mouse.x, state.mouse.y);
        if (rIdx >= 0) {
          state.selected = { type: 'rod', index: rIdx };
        } else {
          const sIdx = util.getSliderAt(state.mouse.x, state.mouse.y);
          state.selected = sIdx >= 0 ? { type: 'slider', index: sIdx } : null;
        }
      }
      api.updateProps(); api.renderList();
    } else if (tool === 'delete') {
      if (snap.particleIdx >= 0) {
        util.removeParticle(snap.particleIdx);
      } else {
        const rIdx = util.getRodAt(state.mouse.x, state.mouse.y);
        if (rIdx >= 0) { util.removeRod(rIdx); }
        else {
          const sIdx = util.getSliderAt(state.mouse.x, state.mouse.y);
          if (sIdx >= 0) util.deleteItem('slider', sIdx);
        }
      }
      api.renderList(); api.updateProps();
    }
  }

  // ロッドをダブルクリックして長さを直接編集。ツールバーの選択状態に関係なく効く。
  function handleCanvasDblClick() {
    const rIdx = util.getRodAt(state.mouse.x, state.mouse.y);
    if (rIdx < 0) return;
    const rod = state.rods[rIdx];
    const input = window.prompt(`${rod.name} の長さ`, rod.length.toFixed(1));
    if (input == null) return;
    const v = parseFloat(input);
    if (!isFinite(v) || v <= 0) { alert('正の数値を入力してください'); return; }
    rod.length = v;
    // モーターが管理してるロッドなら半径側も合わせる (モーターの想定長さとずれないように)
    const m = state.motors.find(m =>
      (m.center === rod.a && m.driven === rod.b) ||
      (m.center === rod.b && m.driven === rod.a));
    if (m) m.radius = v;
    state.selected = { type: 'rod', index: rIdx };
    App.sidebar.updateProps();
    App.sidebar.renderList();
  }

  function setup() {
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      state.mouse.x = e.clientX - r.left;
      state.mouse.y = e.clientY - r.top;
      if (state.dragging !== null) {
        const p = state.particles[state.dragging];
        if (!p.driven) {
          const s = util.snapPos(state.mouse.x, state.mouse.y, null, state.dragging);
          p.x = s.x; p.y = s.y; p.px = p.x; p.py = p.y;
        }
      }
    });
    canvas.addEventListener('mousedown', handleCanvasClick);
    canvas.addEventListener('dblclick', handleCanvasDblClick);
    window.addEventListener('mouseup', () => { state.dragging = null; });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { state.pending = null; state.feasibilityTarget = null; }
      if (e.key === ' ' && e.target.tagName !== 'INPUT') { App.togglePlay(); e.preventDefault(); }
    });

    document.querySelectorAll('.tool').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.tool;
        state.tool = t;
        state.pending = null;
        if (t !== 'feasibility') state.feasibilityTarget = null;
        document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('hint').textContent = hintText(t);
        if (state.playing && PLACEMENT_TOOLS.has(t)) App.togglePlay();
      });
    });
    document.querySelector('[data-tool=rod]').classList.add('active');
    document.getElementById('hint').textContent = hintText('rod');
  }

  App.tools = { setup };
})();
