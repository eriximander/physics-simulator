// 物理ステップ — preStep → 速度積分 → 拘束反復 の順で 1 フレームぶん進める。
// 各 Joint の solve / preStep を呼ぶだけで、ソルバーの中身はこのファイルに書かない。
(() => {
  App.physics = {
    step() {
      const { state } = App;

      // 1) preStep: モーターが駆動点を次フレーム位置に動かす、など
      for (const spec of App.Joints.all()) {
        if (spec.preStep) spec.preStep(state);
      }

      // 2) Verlet 積分 (自由な粒子のみ)
      const g = state.gravity, damp = state.damping;
      for (const p of state.particles) {
        if (p.pinned || p.driven) continue;
        const vx = (p.x - p.px) * damp;
        const vy = (p.y - p.py) * damp;
        p.px = p.x; p.py = p.y;
        p.x += vx;
        p.y += vy + g;
      }

      // 3) 拘束反復 — solveOrder 順に solve を持つ Joint を呼ぶ
      const solvers = App.Joints.inSolveOrder().filter(s => s.solve);
      for (let it = 0; it < state.iterations; it++) {
        for (const spec of solvers) {
          const arr = state[spec.storage];
          for (const item of arr) spec.solve(item, state);
        }
      }

      // 4) 残差誤差の測定 — 反復後もロッド長が目標を満たせていなければ
      // 物理的に不可能な構成。rod.error に残差を記録 (描画側で赤く警告表示)。
      for (const rod of state.rods) {
        const a = state.particles[rod.a], b = state.particles[rod.b];
        rod.error = Math.hypot(b.x - a.x, b.y - a.y) - rod.length;
      }
    },

    // ロッドの誤差が「物理的に無理」とみなす閾値 (長さの 2% または 2px の大きい方)
    rodErrorThreshold(rod) { return Math.max(2, rod.length * 0.02); },
    rodViolated(rod) { return Math.abs(rod.error || 0) > App.physics.rodErrorThreshold(rod); },
  };
})();
