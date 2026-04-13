// 粒子 (点) — シミュレーションの基本要素。他のジョイントは粒子 index を参照する。
// 構造: { name, x, y, px, py, pinned, driven }
//   px,py : 1 ステップ前の位置 (Verlet 積分の速度保持)
//   pinned: 固定 (動かない)
//   driven: モーターに駆動されている (物理から除外)
//
// ツールバーの pin/drag/select/delete はジョイント生成ではなく粒子への操作なので
// ui/tools.js で直接ハンドリングする。ここでは draw/listMeta/renderProps のみ提供。
(() => {
  const { state } = App;

  // 色分け: motor中心(橙) / pin(赤) / driven(黄) / slider所属(青) / 自由(緑)
  function colorOf(idx) {
    const p = state.particles[idx];
    if (App.Joints.get('motor').isCenter(idx)) return '#ffaa55';
    if (p.pinned) return '#ff6b6b';
    if (p.driven) return '#ffd166';
    if (App.Joints.get('slider').isPart(idx)) return '#7acef0';
    return '#82d982';
  }

  App.Joints.register({
    type: 'particle',
    title: '点',
    storage: 'particles',
    counter: 'p',
    namePrefix: 'P',
    color: '#82d982',
    drawOrder: 60,
    // solve 無し (物理本体は App.physics.step で処理)

    colorOf,

    draw(ctx, p, _state, selected, i) {
      const isMotorCenter = App.Joints.get('motor').isCenter(i);
      const radius = (p.pinned || isMotorCenter) ? 7 : 5.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colorOf(i);
      ctx.fill();
      if (p.pinned || isMotorCenter) {
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.stroke();
      }
      if (selected) {
        ctx.strokeStyle = '#ffcb6b'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffcb6b';
        ctx.font = '11px ui-monospace, monospace';
        ctx.fillText(p.name, p.x + 12, p.y - 10);
      }
    },

    listMeta(_p, _s, i) {
      const p = state.particles[i];
      const sub = p.pinned ? 'pin' : p.driven ? 'drv' : App.Joints.get('motor').isCenter(i) ? 'ctr' : '';
      return { color: colorOf(i), sub };
    },

    renderProps(box, p, _s, api) {
      const idx = state.selected.index;
      const partOfSlider = state.sliders.filter(s => s.a === idx || s.b === idx || s.particle === idx);
      const motorRole = state.motors.find(m => m.center === idx) ? '回転中心' : state.motors.find(m => m.driven === idx) ? '駆動点' : null;
      const relX = (p.x - state.originX).toFixed(1);
      const relY = (state.originY - p.y).toFixed(1);
      box.innerHTML = api.nameRow(p) + `
        <div class="row"><label>X</label><input type="number" id="pX" value="${p.x.toFixed(1)}" step="1"></div>
        <div class="row"><label>Y</label><input type="number" id="pY" value="${p.y.toFixed(1)}" step="1"></div>
        <div class="row" style="color:#888;font-size:11px">原点基準: (${relX}, ${relY})</div>
        <div class="row"><label>固定(ピン)</label><input type="checkbox" id="pPin" ${p.pinned ? 'checked' : ''} ${p.driven ? 'disabled' : ''}></div>
        ${motorRole ? `<div style="color:#ffd166;font-size:11px">役割: ${motorRole}</div>` : ''}
        ${partOfSlider.length ? `<div style="color:#7acef0;font-size:11px">所属スライダー: ${partOfSlider.map(s => s.name).join(', ')}</div>` : ''}
      `;
      api.bindName(p);
      document.getElementById('pX').addEventListener('input', e => { p.x = +e.target.value; p.px = p.x; });
      document.getElementById('pY').addEventListener('input', e => { p.y = +e.target.value; p.py = p.y; });
      document.getElementById('pPin').addEventListener('change', e => { p.pinned = e.target.checked; p.px = p.x; p.py = p.y; api.renderList(); });

      // 他ジョイントが提供する追加フォーム (例: 角度拘束の作成) を下に差し込む。
      for (const spec of App.Joints.all()) {
        if (spec.extendParticleProps) spec.extendParticleProps(box, idx, state, api);
      }
    },
  });
})();
