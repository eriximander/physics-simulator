// Jointレジストリ — 各ジョイントは spec オブジェクトを register() で登録する。
//
// spec の形:
//   type           : 'rod' などの識別子
//   title          : リストの見出し (日本語)
//   storage        : state のどの配列に入るか ('rods' など)
//   counter        : state.counters のキー ('r' など)
//   namePrefix     : 自動命名の接頭辞 ('R' など)
//   color          : リストアイコン/スナップの代表色
//   pendingColor?  : ツールのプレビュー線の色
//   drawOrder?     : 描画順 (小さいほど奥)  default 100
//   solveOrder?    : 物理反復内の順序 (小さいほど先) default 100
//
//   preStep?(state)                        : 速度積分の前に呼ばれる
//   solve?(item, state)                    : 物理反復 1 パス
//   draw?(ctx, item, state, selected, i)   : 描画
//
//   listMeta(item, state, i) → { color, sub }     : 左パネルの行情報
//   renderProps(box, item, state, api)            : 右パネルのプロパティ編集
//   onDeleteSelf?(item, state)                    : 削除時の片付け
//   onParticleRemoved?(idx, state, shiftP)        : 粒子削除時のカスケード
//   onRodRemoved?(idx, state, shiftR)             : ロッド削除時のカスケード
//
//   tool?: {
//     hint: string,
//     onClick(snap, state, api)              : ツールクリック処理
//   }
(() => {
  const list = [];
  const byType = Object.create(null);

  App.Joints = {
    register(spec) {
      if (byType[spec.type]) throw new Error(`joint type already registered: ${spec.type}`);
      list.push(spec);
      byType[spec.type] = spec;
    },
    get(type) { return byType[type]; },
    all() { return list; },
    inDrawOrder() {
      return list.slice().sort((a, b) => (a.drawOrder ?? 100) - (b.drawOrder ?? 100));
    },
    inSolveOrder() {
      return list.slice().sort((a, b) => (a.solveOrder ?? 100) - (b.solveOrder ?? 100));
    },
  };
})();
