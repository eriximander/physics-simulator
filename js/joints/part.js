// パーツ — 複数のロッドを 1 つの剛体部品としてまとめるグループ。
// 構造: state.parts = [{ name }]  (部品自体は名前だけ持つ)
// ロッド側に rod.part = 部品 index を立てて所属を表現する。
//
// 剛性は「接続する各頂点で 1 つ角度拘束を自動追加する」ことで確保する。
// 最小構成でツリー状に固定 → 余計な過剰拘束を避ける (閉ループ等は多少過剰になる)。
(() => {
  const { state } = App;

  // onDeleteSelf 実行中は onRodRemoved 側の「空パーツ自動削除」を止める。
  let deletingSelf = false;

  function part() { return App.Joints.get('part'); }

  function rodsTouching(idx) {
    const out = [];
    state.rods.forEach((r, i) => { if (r.a === idx || r.b === idx) out.push(i); });
    return out;
  }

  function otherEnd(rod, vertex) {
    return rod.a === vertex ? rod.b : rod.a;
  }

  // ジョイント vertex における既存ロッドと新ロッドの間の現在角を測り AC として登録。
  function addAngleConstraintAt(vertex, existingRodIdx, newRodIdx) {
    const existing = state.rods[existingRodIdx];
    const newRod = state.rods[newRodIdx];
    const J = state.particles[vertex];
    const A = state.particles[otherEnd(existing, vertex)];
    const B = state.particles[otherEnd(newRod, vertex)];
    let ang = Math.atan2(B.y - J.y, B.x - J.x) - Math.atan2(A.y - J.y, A.x - J.x);
    while (ang > Math.PI) ang -= 2 * Math.PI;
    while (ang < -Math.PI) ang += 2 * Math.PI;
    state.angleConstraints.push({
      name: `A${++state.counters.a}`,
      joint: vertex,
      rodA: existingRodIdx,
      rodB: newRodIdx,
      angle: ang,
    });
  }

  // 指定 partIdx に所属するロッドの index を全部返す (昇順)。
  function rodsInPart(partIdx) {
    const out = [];
    state.rods.forEach((r, i) => { if (r.part === partIdx) out.push(i); });
    return out;
  }

  App.Joints.register({
    type: 'part',
    title: 'パーツ',
    storage: 'parts',
    counter: 'pt',
    namePrefix: 'Part',
    color: '#d78cb0',
    pendingColor: '#d78cb0',
    // draw/solve 無し — 物理は構成ロッドと自動 AC が担当する

    listMeta(_p, _s, i) {
      const count = rodsInPart(i).length;
      return { color: '#d78cb0', sub: `${count} rod${count === 1 ? '' : 's'}` };
    },

    renderProps(box, p, _s, api) {
      const partIdx = state.selected.index;
      const members = rodsInPart(partIdx);
      const memberHtml = members.length
        ? members.map(ri => `<button class="preset selRod" data-r="${ri}">${state.rods[ri].name}</button>`).join(' ')
        : '<span style="color:#666;font-size:11px">メンバー無し</span>';
      box.innerHTML = api.nameRow(p) + `
        <div class="row" style="color:#888;font-size:11px">構成ロッド: ${members.length}</div>
        <div class="row" style="flex-wrap:wrap;gap:4px">${memberHtml}</div>
        <div style="font-size:11px;color:#888;margin-top:8px">削除すると構成ロッドもまとめて消えます。</div>
      `;
      api.bindName(p);
      box.querySelectorAll('.selRod').forEach(btn => {
        btn.addEventListener('click', () => api.setSelected({ type: 'rod', index: +btn.dataset.r }));
      });
    },

    // 自身を削除 → 構成ロッドをまとめて除去してから parts[idx] を splice
    onDeleteSelf(p, s) {
      const partIdx = s.parts.indexOf(p);
      if (partIdx < 0) return;
      deletingSelf = true;
      try {
        const members = rodsInPart(partIdx);
        // 大きい方から削除 (index ずれ防止)
        for (let k = members.length - 1; k >= 0; k--) {
          App.util.removeRod(members[k], { confirm: false });
        }
        // parts.splice(partIdx, 1) は呼び出し側 (util.deleteItem) が実施
        // 残るロッドの .part を詰める
        for (const r of s.rods) {
          if (r.part != null && r.part > partIdx) r.part--;
        }
      } finally { deletingSelf = false; }
    },

    // ロッド削除 → 属していたパーツが空になったらパーツ自身も消す
    onRodRemoved(idx, s, _shiftR) {
      if (deletingSelf) return;
      const rod = s.rods[idx];
      if (rod == null || rod.part == null) return;
      const partIdx = rod.part;
      let remaining = 0;
      for (let i = 0; i < s.rods.length; i++) {
        if (i === idx) continue;
        if (s.rods[i].part === partIdx) remaining++;
      }
      if (remaining === 0) {
        s.parts.splice(partIdx, 1);
        for (const r of s.rods) {
          if (r.part != null && r.part > partIdx) r.part--;
        }
      }
    },

    // ---- 削除前の警告文を返す (なければ null) ----

    confirmDeleteRod(rodIdx) {
      const rod = state.rods[rodIdx];
      if (rod == null || rod.part == null) return null;
      const p = state.parts[rod.part];
      if (!p) return null;
      return `⚠ ロッド "${rod.name}" はパーツ "${p.name}" の部品です。\n削除するとパーツが壊れる可能性があります。続けますか?`;
    },

    confirmDeleteSelf(p) {
      const partIdx = state.parts.indexOf(p);
      if (partIdx < 0) return null;
      const count = rodsInPart(partIdx).length;
      return `⚠ パーツ "${p.name}" を削除します。構成ロッド ${count} 本もまとめて消えます。続けますか?`;
    },

    confirmDeleteParticle(pIdx) {
      const hits = state.rods.filter(r => (r.a === pIdx || r.b === pIdx) && r.part != null);
      if (hits.length === 0) return null;
      const partSet = new Set(hits.map(r => r.part));
      const partNames = [...partSet].map(i => state.parts[i]?.name).filter(Boolean).join(', ');
      const rodNames = hits.map(r => r.name).join(', ');
      return `⚠ この点はパーツ "${partNames}" の構成要素 (${rodNames}) に繋がっています。\n削除するとパーツが壊れる可能性があります。続けますか?`;
    },

    // ---- 外から参照できるユーティリティ ----

    rodsInPart,

    // ツール: 頂点 → 終点 の 2 クリックで構成ロッドを 1 本追加する。
    tool: {
      hint: '既存の頂点から始点→終点の順にクリック。連続したロッドは 1 つのパーツになる。',
      onClick(snap, s, api) {
        const { util } = App;

        // 1 クリック目: 既存粒子じゃないと何もしない
        if (s.pending == null) {
          if (snap.particleIdx < 0) return;
          s.pending = {
            tool: 'part',
            pIdx: snap.particleIdx,
            x: state.particles[snap.particleIdx].x,
            y: state.particles[snap.particleIdx].y,
          };
          return;
        }

        // 2 クリック目: 既存粒子 or 自由位置 (新規粒子作成)
        const aIdx = s.pending.pIdx;
        let bIdx = snap.particleIdx >= 0 ? snap.particleIdx : util.addParticle(snap.x, snap.y);
        s.pending = null;
        if (bIdx === aIdx) return;

        const rodsAtA = rodsTouching(aIdx);
        const rodsAtB = rodsTouching(bIdx);

        // 端点で触れている既存パーツを拾う (touch 頂点にある part-rod のどれか)
        const findPartAt = (touching) => {
          for (const ri of touching) {
            if (state.rods[ri].part != null) return state.rods[ri].part;
          }
          return -1;
        };
        const aPartIdx = findPartAt(rodsAtA);
        const bPartIdx = findPartAt(rodsAtB);

        // パーツ決定: どちらかに既存パーツがあれば流用、両端が別パーツなら合体
        let partIdx = aPartIdx >= 0 ? aPartIdx : bPartIdx;
        if (aPartIdx >= 0 && bPartIdx >= 0 && aPartIdx !== bPartIdx) {
          const keepIdx = aPartIdx;
          const mergeIdx = bPartIdx;
          for (const r of state.rods) if (r.part === mergeIdx) r.part = keepIdx;
          state.parts.splice(mergeIdx, 1);
          for (const r of state.rods) {
            if (r.part != null && r.part > mergeIdx) r.part--;
          }
          partIdx = keepIdx > mergeIdx ? keepIdx - 1 : keepIdx;
        }

        // まだパーツが無ければ新規作成
        if (partIdx < 0) {
          state.parts.push({ name: `Part${++state.counters.pt}` });
          partIdx = state.parts.length - 1;
        }

        // 端点に触れている「単独ロッド (.part == null)」をこのパーツに吸収する。
        // 同じ端点に既存のアンカー (このパーツ内のロッド) があれば、吸収時に
        // その場で角度拘束を張って剛性を確保する。
        const absorbAt = (vertex, touching) => {
          let anchor = touching.find(ri => state.rods[ri].part === partIdx);
          for (const ri of touching) {
            const rod = state.rods[ri];
            if (rod.part === partIdx) continue;   // 既にこのパーツ
            if (rod.part != null) continue;       // 他パーツ所属は奪わない
            rod.part = partIdx;
            if (anchor != null && anchor !== ri) {
              addAngleConstraintAt(vertex, anchor, ri);
            } else if (anchor == null) {
              anchor = ri;
            }
          }
        };
        absorbAt(aIdx, rodsAtA);
        absorbAt(bIdx, rodsAtB);

        // 新ロッド作成 → パーツに入れる
        const rodIdx = App.Joints.get('rod').create(aIdx, bIdx);
        state.rods[rodIdx].part = partIdx;

        // 剛性 — 各端点で「同パーツ内の既存ロッド 1 本」との角度を固定 (最小構成)
        const pickExisting = (vertex) => {
          for (const ri of rodsTouching(vertex)) {
            if (ri === rodIdx) continue;
            if (state.rods[ri].part === partIdx) return ri;
          }
          return -1;
        };
        const existingAtA = pickExisting(aIdx);
        if (existingAtA >= 0) addAngleConstraintAt(aIdx, existingAtA, rodIdx);
        const existingAtB = pickExisting(bIdx);
        if (existingAtB >= 0) addAngleConstraintAt(bIdx, existingAtB, rodIdx);

        api.renderList();
      },
    },
  });
})();
