// 角度拘束 — あるジョイント(粒子)を中心とした 2 本のロッドのなす角を固定する。
// 構造: { name, joint, rodA, rodB, angle }  joint は粒子index、rodA/rodB はロッドindex、angle はラジアン。
// 測り方: atan2(B方向) - atan2(A方向)
//
// この拘束は「ツールバー」から作るのではなく、粒子のプロパティパネル内の
// 埋め込みフォームから作る。extendParticleProps でそのフォームを挿入する。
(() => {
  const { state } = App;

  // 現在の A-joint-B の成す角を計算するヘルパー。プロパティの「現在角で固定」で使う。
  function currentAngleBetween(jIdx, rodAIdx, rodBIdx) {
    const rodA = state.rods[rodAIdx], rodB = state.rods[rodBIdx];
    const J = state.particles[jIdx];
    const aIdx = rodA.a === jIdx ? rodA.b : rodA.a;
    const bIdx = rodB.a === jIdx ? rodB.b : rodB.a;
    const A = state.particles[aIdx], B = state.particles[bIdx];
    let ang = Math.atan2(B.y - J.y, B.x - J.x) - Math.atan2(A.y - J.y, A.x - J.x);
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    return ang;
  }

  function rodsThrough(idx) {
    const arr = [];
    state.rods.forEach((r, i) => { if (r.a === idx || r.b === idx) arr.push(i); });
    return arr;
  }

  App.Joints.register({
    type: 'angleConstraint',
    title: '角度拘束',
    storage: 'angleConstraints',
    counter: 'a',
    namePrefix: 'A',
    color: '#c9a0dc',
    drawOrder: 40,
    solveOrder: 30,
    // ツールバーには出さない (粒子プロパティから作る)

    // 2 本のロッドを中心ジョイントの周りに相対回転させて目標角に合わせる。
    solve(ac) {
      const rodA = state.rods[ac.rodA], rodB = state.rods[ac.rodB];
      if (!rodA || !rodB) return;
      const J = state.particles[ac.joint]; if (!J) return;
      const aIdx = rodA.a === ac.joint ? rodA.b : (rodA.b === ac.joint ? rodA.a : -1);
      const bIdx = rodB.a === ac.joint ? rodB.b : (rodB.b === ac.joint ? rodB.a : -1);
      if (aIdx < 0 || bIdx < 0 || aIdx === bIdx) return;
      const A = state.particles[aIdx], B = state.particles[bIdx];
      const angA = Math.atan2(A.y - J.y, A.x - J.x);
      const angB = Math.atan2(B.y - J.y, B.x - J.x);
      let err = ac.angle - (angB - angA);
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;
      const fA = (A.pinned || A.driven) ? 0 : 1;
      const fB = (B.pinned || B.driven) ? 0 : 1;
      const total = fA + fB;
      if (total === 0) return;
      const rotA = -err * fA / total;
      const rotB = err * fB / total;
      if (fA > 0) {
        const vx = A.x - J.x, vy = A.y - J.y;
        const c = Math.cos(rotA), s = Math.sin(rotA);
        A.x = J.x + vx * c - vy * s;
        A.y = J.y + vx * s + vy * c;
      }
      if (fB > 0) {
        const vx = B.x - J.x, vy = B.y - J.y;
        const c = Math.cos(rotB), s = Math.sin(rotB);
        B.x = J.x + vx * c - vy * s;
        B.y = J.y + vx * s + vy * c;
      }
    },

    draw(ctx, ac, _state, selected) {
      const rodA = state.rods[ac.rodA], rodB = state.rods[ac.rodB];
      if (!rodA || !rodB) return;
      const J = state.particles[ac.joint];
      const aIdx = rodA.a === ac.joint ? rodA.b : rodA.a;
      const bIdx = rodB.a === ac.joint ? rodB.b : rodB.a;
      const A = state.particles[aIdx], B = state.particles[bIdx];
      const angA = Math.atan2(A.y - J.y, A.x - J.x);
      const angB = Math.atan2(B.y - J.y, B.x - J.x);
      ctx.strokeStyle = selected ? '#e892ff' : '#a56bc4';
      ctx.fillStyle = selected ? 'rgba(232,146,255,0.2)' : 'rgba(165,107,196,0.15)';
      ctx.lineWidth = selected ? 2 : 1.5;
      const arcR = 22;
      ctx.beginPath();
      ctx.moveTo(J.x, J.y);
      ctx.arc(J.x, J.y, arcR, angA, angB, angB < angA);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const midAng = (angA + angB) / 2 + (angB < angA ? Math.PI : 0);
      ctx.fillStyle = selected ? '#e892ff' : '#c9a0dc';
      ctx.font = '10px ui-monospace, monospace';
      const lbl = `${(ac.angle * 180 / Math.PI).toFixed(0)}°`;
      ctx.fillText(lbl, J.x + (arcR + 4) * Math.cos(midAng), J.y + (arcR + 4) * Math.sin(midAng));
    },

    listMeta(ac) {
      return { color: '#c9a0dc', sub: `${(ac.angle * 180 / Math.PI).toFixed(0)}°` };
    },

    renderProps(box, ac, _state, api) {
      const deg = ac.angle * 180 / Math.PI;
      const rodA = state.rods[ac.rodA], rodB = state.rods[ac.rodB];
      box.innerHTML = api.nameRow(ac) + `
        <div class="row"><label>ジョイント</label><button id="selJ" style="flex:1">${state.particles[ac.joint].name}</button></div>
        <div class="row"><label>ロッドA</label><button id="selRA" style="flex:1">${rodA ? rodA.name : '—'}</button></div>
        <div class="row"><label>ロッドB</label><button id="selRB" style="flex:1">${rodB ? rodB.name : '—'}</button></div>
        <div class="row"><label>角度 (°)</label><input type="number" id="acDeg" value="${deg.toFixed(1)}" step="1"></div>
        <div class="row"><input type="range" id="acDegR" min="-180" max="180" step="1" value="${Math.round(deg)}"></div>
        <div class="row">
          <button class="preset" data-d="45">45°</button>
          <button class="preset" data-d="90">90°</button>
          <button class="preset" data-d="-90">-90°</button>
          <button class="preset" data-d="135">135°</button>
          <button class="preset" data-d="180">180°</button>
        </div>
        <div class="row"><button id="acCurBtn">現在の角度で固定</button></div>
      `;
      api.bindName(ac);
      const degEl = document.getElementById('acDeg'), degR = document.getElementById('acDegR');
      const syncAc = (v, from) => {
        const vv = ((v + 180) % 360 + 360) % 360 - 180;
        ac.angle = vv * Math.PI / 180;
        if (from !== 'num') degEl.value = vv.toFixed(1);
        if (from !== 'rng') degR.value = Math.round(vv);
        api.renderList();
      };
      degEl.addEventListener('input', e => syncAc(+e.target.value, 'num'));
      degR.addEventListener('input', e => syncAc(+e.target.value, 'rng'));
      box.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => syncAc(+b.dataset.d, 'pre')));
      document.getElementById('acCurBtn').addEventListener('click', () => {
        const cur = currentAngleBetween(ac.joint, ac.rodA, ac.rodB);
        syncAc(cur * 180 / Math.PI, 'pre');
      });
      document.getElementById('selJ').addEventListener('click', () => api.setSelected({ type: 'particle', index: ac.joint }));
      document.getElementById('selRA').addEventListener('click', () => api.setSelected({ type: 'rod', index: ac.rodA }));
      document.getElementById('selRB').addEventListener('click', () => api.setSelected({ type: 'rod', index: ac.rodB }));
    },

    // 粒子プロパティパネルに「角度拘束を作成」フォームを追加する。
    // 対象粒子に通るロッドが 2 本以上ある時だけ表示。
    extendParticleProps(container, idx, _state, api) {
      const jointRods = rodsThrough(idx);
      if (jointRods.length < 2) return;
      const existingACs = state.angleConstraints.filter(ac => ac.joint === idx);
      const options = jointRods.map(ri => `<option value="${ri}">${state.rods[ri].name}</option>`).join('');
      const box = document.createElement('div');
      box.className = 'subbox';
      box.innerHTML = `
        <h5>角度拘束</h5>
        ${existingACs.length ? `<div style="font-size:11px;color:#c9a0dc;margin-bottom:6px">既存: ${existingACs.map(a => a.name).join(', ')}</div>` : ''}
        <div class="row"><label>ロッドA</label><select id="acRodA">${options}</select></div>
        <div class="row"><label>ロッドB</label><select id="acRodB">${options}</select></div>
        <div class="row"><label>角度 (°)</label><input type="number" id="acNewDeg" value="90" step="1"></div>
        <div class="row">
          <button class="preset" data-d="90">90°</button>
          <button class="preset" data-d="180">180°</button>
          <button class="preset" data-d="45">45°</button>
          <button id="acNewCur">現在角</button>
        </div>
        <div class="row"><button id="acCreateBtn" class="primary" style="flex:1">作成</button></div>
      `;
      container.appendChild(box);
      const sA = box.querySelector('#acRodA'), sB = box.querySelector('#acRodB');
      sA.value = jointRods[0]; sB.value = jointRods[1];
      const degInp = box.querySelector('#acNewDeg');
      box.querySelectorAll('.preset').forEach(b => b.addEventListener('click', () => { degInp.value = b.dataset.d; }));
      box.querySelector('#acNewCur').addEventListener('click', () => {
        const cur = currentAngleBetween(idx, +sA.value, +sB.value);
        degInp.value = (cur * 180 / Math.PI).toFixed(1);
      });
      box.querySelector('#acCreateBtn').addEventListener('click', () => {
        const rA = +sA.value, rB = +sB.value;
        if (rA === rB) { alert('異なるロッドを選んでください'); return; }
        const rodA = state.rods[rA], rodB = state.rods[rB];
        if (rodA.a !== idx && rodA.b !== idx) { alert('ロッドAがこのジョイントに接続していません'); return; }
        if (rodB.a !== idx && rodB.b !== idx) { alert('ロッドBがこのジョイントに接続していません'); return; }
        const ang = +degInp.value * Math.PI / 180;
        state.angleConstraints.push({ name: `A${++state.counters.a}`, joint: idx, rodA: rA, rodB: rB, angle: ang });
        api.renderList();
        api.setSelected({ type: 'angleConstraint', index: state.angleConstraints.length - 1 });
      });
    },

    // 粒子が消えた → その粒子をジョイントとする AC を削除。残る AC の joint index を詰める。
    // (rod 参照は onRodRemoved 側で処理されるので、ここでは触らない)
    onParticleRemoved(idx, s, shift) {
      s.angleConstraints = s.angleConstraints
        .filter(ac => ac.joint !== idx)
        .map(ac => ({ ...ac, joint: shift(ac.joint) }));
    },

    // ロッドが消えた → そのロッドを参照する AC を削除。残る AC の rodA/B を詰める。
    onRodRemoved(idx, s, shiftR) {
      s.angleConstraints = s.angleConstraints
        .filter(ac => ac.rodA !== idx && ac.rodB !== idx)
        .map(ac => ({ ...ac, rodA: shiftR(ac.rodA), rodB: shiftR(ac.rodB) }));
    },
  });
})();
