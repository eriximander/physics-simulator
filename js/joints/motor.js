// 回転ジョイント (モーター) — 中心まわりに駆動点を一定角速度で動かす。
// 構造: { name, center, driven, radius, angle, omega }  center/driven は粒子 index。
// driven 粒子は driven=true フラグがつき、通常の物理から除外される。
(() => {
  const { state } = App;

  App.Joints.register({
    type: 'motor',
    title: '回転ジョイント',
    storage: 'motors',
    counter: 'm',
    namePrefix: 'M',
    color: '#ffaa55',
    pendingColor: '#ffaa55',
    drawOrder: 20,

    // 駆動は物理反復の外で毎フレーム行う → preStep を使う。
    preStep(s) {
      for (const m of s.motors) {
        m.angle += m.omega;
        const c = s.particles[m.center];
        const d = s.particles[m.driven];
        d.px = d.x; d.py = d.y;
        d.x = c.x + m.radius * Math.cos(m.angle);
        d.y = c.y + m.radius * Math.sin(m.angle);
      }
    },

    draw(ctx, m, _state, selected) {
      const c = state.particles[m.center];
      ctx.strokeStyle = selected ? '#ffaa55' : '#8b6a3a';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, m.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 回転方向の矢印
      ctx.strokeStyle = '#ffaa55';
      ctx.lineWidth = 2;
      const dir = Math.sign(m.omega) || 1;
      const start = m.angle, end = m.angle + dir * 0.6;
      ctx.beginPath();
      ctx.arc(c.x, c.y, m.radius + 10, start, end, dir < 0);
      ctx.stroke();
      const tipX = c.x + (m.radius + 10) * Math.cos(end);
      const tipY = c.y + (m.radius + 10) * Math.sin(end);
      const tangent = end + dir * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - 7 * Math.cos(tangent - dir * 0.5), tipY - 7 * Math.sin(tangent - dir * 0.5));
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - 7 * Math.cos(tangent + dir * 0.5), tipY - 7 * Math.sin(tangent + dir * 0.5));
      ctx.stroke();
    },

    listMeta(m) {
      return { color: '#ffaa55', sub: `${App.radPerStepToDegPerSec(m.omega).toFixed(0)}°/s` };
    },

    renderProps(box, m, _state, api) {
      const degPerSec = App.radPerStepToDegPerSec(m.omega);
      const rpm = m.omega * App.FPS * 60 / (2 * Math.PI);
      box.innerHTML = api.nameRow(m) + `
        <div class="row"><label>回転速度 (°/秒)</label><input type="number" id="motSpd" value="${degPerSec.toFixed(1)}" step="5"></div>
        <div class="row"><input type="range" id="motSpdR" min="-720" max="720" step="1" value="${Math.round(degPerSec)}"></div>
        <div class="row" style="color:#888;font-size:11px"><span id="rpmLabel">≒ ${rpm.toFixed(2)} RPM</span></div>
        <div class="row"><label>腕の長さ</label><input type="number" id="motR" value="${m.radius.toFixed(1)}" step="1" min="1"></div>
        <div class="row"><input type="range" id="motRR" min="5" max="400" step="1" value="${Math.min(400, Math.max(5, m.radius)).toFixed(0)}"></div>
        <div class="row" style="color:#888;font-size:11px">中心: ${state.particles[m.center].name} / 駆動: ${state.particles[m.driven].name}</div>
      `;
      api.bindName(m);
      const spdEl = document.getElementById('motSpd'), spdR = document.getElementById('motSpdR');
      const rpmLbl = document.getElementById('rpmLabel');
      const syncSpd = (v, from) => {
        m.omega = App.degPerSecToRadPerStep(v);
        if (from !== 'num') spdEl.value = v.toFixed(1);
        if (from !== 'rng') spdR.value = Math.max(-720, Math.min(720, Math.round(v)));
        rpmLbl.textContent = `≒ ${(m.omega * App.FPS * 60 / (2 * Math.PI)).toFixed(2)} RPM`;
        api.renderList();
      };
      spdEl.addEventListener('input', e => syncSpd(+e.target.value, 'num'));
      spdR.addEventListener('input', e => syncSpd(+e.target.value, 'rng'));
      const rEl = document.getElementById('motR'), rR = document.getElementById('motRR');
      const syncR = (v, from) => {
        m.radius = Math.max(1, v);
        const rod = state.rods.find(r => (r.a === m.center && r.b === m.driven) || (r.a === m.driven && r.b === m.center));
        if (rod) rod.length = m.radius;
        if (from !== 'num') rEl.value = m.radius.toFixed(1);
        if (from !== 'rng') rR.value = Math.min(400, Math.max(5, m.radius));
        api.renderList();
      };
      rEl.addEventListener('input', e => syncR(+e.target.value, 'num'));
      rR.addEventListener('input', e => syncR(+e.target.value, 'rng'));
    },

    // モーターを消す → 駆動中だった粒子のフラグを戻す。
    onDeleteSelf(m) {
      if (state.particles[m.driven]) state.particles[m.driven].driven = false;
    },

    // 中心 or 駆動点が消えた → モーター自体を削除。それ以外は index を詰める。
    onParticleRemoved(idx, s, shift) {
      s.motors = s.motors.filter(m => {
        if (m.center === idx || m.driven === idx) {
          if (m.driven !== idx && s.particles[m.driven]) s.particles[m.driven].driven = false;
          return false;
        }
        return true;
      }).map(m => ({ ...m, center: shift(m.center), driven: shift(m.driven) }));
    },

    // この粒子はモーターの中心か?
    isCenter(idx) {
      return state.motors.some(m => m.center === idx);
    },
    findByParticle(idx) {
      for (let i = 0; i < state.motors.length; i++) {
        if (state.motors[i].center === idx || state.motors[i].driven === idx) return i;
      }
      return -1;
    },

    // ツール: 中心→駆動点 の順に 2 クリック。rod も同時に作成。
    tool: {
      hint: '中心→腕の先端の順にクリックで回転ジョイント作成。',
      onClick(snap, s, api) {
        const { util } = App;
        let idx = snap.particleIdx >= 0 ? snap.particleIdx : util.addParticle(snap.x, snap.y);
        if (s.pending == null) {
          const p = state.particles[idx];
          if (p.driven) { alert('駆動点は中心にできません'); return; }
          p.pinned = true; p.px = p.x; p.py = p.y;
          s.pending = { tool: 'motor', pIdx: idx, x: p.x, y: p.y };
        } else {
          const dIdx = snap.particleIdx >= 0 ? snap.particleIdx : util.addParticle(snap.x, snap.y);
          if (dIdx === s.pending.pIdx) { s.pending = null; return; }
          const d = state.particles[dIdx];
          if (d.driven) { alert('この点は既に駆動されています'); s.pending = null; return; }
          if (d.pinned) { alert('固定点は駆動できません'); s.pending = null; return; }
          const c = state.particles[s.pending.pIdx];
          const dx = d.x - c.x, dy = d.y - c.y;
          const r = Math.hypot(dx, dy) || 1;
          d.driven = true;
          s.motors.push({ name: `M${++s.counters.m}`, center: s.pending.pIdx, driven: dIdx, radius: r, angle: Math.atan2(dy, dx), omega: 0.03 });
          App.Joints.get('rod').create(s.pending.pIdx, dIdx);
          // 新規作成ロッドの長さを半径に合わせる
          s.rods[s.rods.length - 1].length = r;
          s.pending = null;
          api.renderList();
        }
      },
    },
  });
})();
