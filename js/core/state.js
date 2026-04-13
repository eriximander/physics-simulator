// 中央state: アプリ全体で共有する状態。各ジョイントモジュールは
// state.particles / state.rods / ... の配列を直接読み書きする。
window.App = window.App || {};

App.state = {
  particles: [],
  rods: [],
  motors: [],
  sliders: [],
  angleConstraints: [],
  coincidences: [],
  parts: [],
  counters: { p: 0, r: 0, m: 0, s: 0, a: 0, c: 0, pt: 0 },

  tool: 'rod',
  playing: false,
  gravity: 0,
  damping: 0.995,
  iterations: 18,

  selected: null,   // { type, index } | null
  pending: null,    // ツールの途中状態 (2点目待ちなど)
  dragging: null,   // ドラッグ中の粒子 index
  feasibilityTarget: null,  // 可動域ツールで選んだ粒子 index (boundary 可視化の対象)

  mouse: { x: 0, y: 0 },

  snapGrid: true,
  snapAngle: true,
  showAxes: true,
  gridSize: 40,
  originX: 0,
  originY: 0,
};

App.FPS = 60;

App.constants = {
  SNAP_PARTICLE: 14,
  HIT: 8,
  SNAP_GRID_PX: 10,
  ANGLE_SNAP_RAD: 7 * Math.PI / 180,
  ANGLE_SNAPS: [0, 45, 90, 135, 180, 225, 270, 315].map(d => d * Math.PI / 180),
  MERGE_EPS: 6,
};

App.radPerStepToDegPerSec = v => v * App.FPS * 180 / Math.PI;
App.degPerSecToRadPerStep = v => v * Math.PI / (180 * App.FPS);
