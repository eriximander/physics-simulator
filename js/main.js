// エントリポイント — 全モジュールをロード済みの前提で初期化する。
// 読込順は index.html の <script> タグで制御する:
//   core/state → registry → util → physics
//   joints/* (任意順, 依存は App.Joints.get() 経由で遅延解決)
//   ui/canvas → sidebar → tools → io
//   main
(() => {
  const { state } = App;

  // 再生/停止: tools.js と main.js から呼べるよう App に出す。
  const playBtn = document.getElementById('playBtn');
  App.togglePlay = () => {
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? '■ 停止' : '▶ 再生';
    // 再開時は velocity をリセット (px=x, py=y で速度 0)
    if (state.playing) for (const p of state.particles) { p.px = p.x; p.py = p.y; }
  };

  function setupSimControls() {
    playBtn.addEventListener('click', App.togglePlay);
    document.getElementById('stepBtn').addEventListener('click', () => App.physics.step());

    const bindRange = (id, valId, setter, digits) => {
      const el = document.getElementById(id), out = document.getElementById(valId);
      const upd = () => { out.textContent = (+el.value).toFixed(digits); setter(+el.value); };
      el.addEventListener('input', upd); upd();
    };
    bindRange('gravity', 'gravityVal', v => state.gravity = v, 2);
    bindRange('damp', 'dampVal', v => state.damping = v, 3);
    bindRange('iter', 'iterVal', v => state.iterations = v, 0);

    document.getElementById('snapGrid').addEventListener('change', e => state.snapGrid = e.target.checked);
    document.getElementById('snapAngle').addEventListener('change', e => state.snapAngle = e.target.checked);
    document.getElementById('showAxes').addEventListener('change', e => state.showAxes = e.target.checked);
    document.getElementById('gridSize').addEventListener('input', e => {
      state.gridSize = Math.max(10, +e.target.value || 40);
    });
  }

  // デモシーン — スライダー-クランク機構。
  function seedDemo() {
    const { util } = App;
    const { W, H } = App.canvas.size();
    state.originX = Math.round(W / 2 / state.gridSize) * state.gridSize;
    state.originY = Math.round(H / 2 / state.gridSize) * state.gridSize;

    const cx = state.originX - 200, cy = state.originY;
    const center = util.addParticle(cx, cy, true);
    state.particles[center].name = 'Crank中心';

    const crankR = 80;
    const crankEnd = util.addParticle(cx + crankR, cy);
    state.particles[crankEnd].name = 'Crank先端';
    state.particles[crankEnd].driven = true;
    state.motors.push({ name: 'メインモーター', center, driven: crankEnd, radius: crankR, angle: 0, omega: 0.03 });
    state.rods.push({ name: 'クランク', a: center, b: crankEnd, length: crankR });
    state.counters.m = 1;

    const pistonX = cx + 320;
    const piston = util.addParticle(pistonX, cy);
    state.particles[piston].name = 'ピストン';
    const railA = util.addParticle(cx + 160, cy, true);
    state.particles[railA].name = 'レール上端';
    const railB = util.addParticle(cx + 520, cy, true);
    state.particles[railB].name = 'レール下端';
    state.sliders.push({ name: 'ピストンレール', particle: piston, a: railA, b: railB });
    state.counters.s = 1;

    state.rods.push({ name: 'コンロッド', a: crankEnd, b: piston, length: Math.hypot(pistonX - (cx + crankR), 0) });
    state.counters.r = 2;
  }

  function init() {
    App.canvas.resize();
    setupSimControls();
    App.tools.setup();
    App.io.setup();
    seedDemo();
    App.sidebar.renderList();
    App.canvas.loop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
