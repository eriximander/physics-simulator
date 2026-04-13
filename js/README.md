# js/

アプリの JavaScript。素の `<script>` タグで読み込む (ビルド不要)。
全モジュールは `window.App` に機能をぶら下げる。

## 構成

```
core/     共通基盤 (state / registry / util / physics)
joints/   ジョイント種類ごとの実装。1 種類 = 1 ファイル
ui/       DOM 側の表示・入力処理 (canvas / sidebar / tools / io)
main.js   エントリポイント (初期化・デモシーン)
```

## 読込順

[../index.html](../index.html) の `<script>` 順がそのまま依存順:

1. `core/state.js` → `App.state`, `App.constants`
2. `core/registry.js` → `App.Joints` (空のレジストリ)
3. `core/util.js` → 幾何・スナップ・粒子/ロッド追加削除
4. `core/physics.js` → `App.physics.step()`
5. `joints/*.js` → 各ジョイントが `App.Joints.register(spec)` で登録
6. `ui/*.js` → canvas 描画ループ、サイドバー、ツール、保存/読込
7. `main.js` → init、デモシーン投入、ループ開始

## ジョイントを追加する

1. `joints/yourJoint.js` を作って `App.Joints.register({...})` する
   - 最低限必要なもの: `type`, `title`, `storage`, `counter`,
     `namePrefix`, `color`, `listMeta`, `renderProps`
   - 物理拘束なら `solve(item, state)` を実装
   - 描画するなら `draw(ctx, item, state, selected, i)` と `drawOrder`
   - ツールバーから作らせるなら `tool: { hint, onClick(snap, state, api) }`
   - 粒子/ロッド削除時のカスケードが要るなら
     `onParticleRemoved(idx, state, shift)` / `onRodRemoved(idx, state, shift)`
2. `App.state` にストレージ配列とカウンターを足す
   ([core/state.js](core/state.js))
3. [../index.html](../index.html) に `<script src="js/joints/yourJoint.js">`
   を 1 行追加
4. ツールバーに出すなら [../index.html](../index.html) の
   `.tools` 内に `<button class="tool" data-tool="yourJoint">` を追加

左パネルの一覧、物理ループ、描画、選択/プロパティ編集、削除は
レジストリ経由で自動的に繋がる。

## ジョイント spec のフック一覧

| フック | 呼び出しタイミング | 必須 |
|---|---|---|
| `preStep(state)` | 速度積分の前 (モーターが駆動点を動かす用) | |
| `solve(item, state)` | 物理反復 1 パス | |
| `draw(ctx, item, state, selected, i)` | 毎フレーム | |
| `listMeta(item, state, i)` | 左パネル行の `{ color, sub }` | ✓ |
| `renderProps(box, item, state, api)` | 右パネルのエディタ | ✓ |
| `extendParticleProps(container, idx, state, api)` | 粒子プロパティパネルに差し込むフォーム | |
| `onDeleteSelf(item, state)` | この要素が直接削除される直前 | |
| `onParticleRemoved(idx, state, shift)` | 粒子が削除された時 | |
| `onRodRemoved(idx, state, shift)` | ロッドが削除された時 | |
| `tool.onClick(snap, state, api)` | 対応ツール中にキャンバスがクリックされた時 | |

`api` は [ui/sidebar.js](ui/sidebar.js) で定義されている
`{ renderList, updateProps, setSelected, nameRow, bindName }`。
