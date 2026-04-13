// サイドバー — 左パネル (要素一覧) と 右パネル (プロパティエディタ)。
// どちらも App.Joints レジストリを回してセクション/エディタを生成するので、
// ジョイント種類を追加すると自動でリストとプロパティ欄に出てくる。
(() => {
  const { state } = App;

  // renderProps から呼ぶための共通ヘルパー集 (api)。
  const api = {
    renderList,
    updateProps,
    setSelected(sel) { state.selected = sel; updateProps(); renderList(); },
    nameRow(obj) {
      return `<div class="row"><label>名前</label><input type="text" id="propName" value="${obj.name}"></div>`;
    },
    bindName(obj) {
      document.getElementById('propName').addEventListener('input', e => {
        obj.name = e.target.value;
        renderList();
      });
    },
  };

  // ---- 左パネル: 要素一覧 ----
  function renderList() {
    const listEl = document.getElementById('list');
    listEl.innerHTML = '';
    for (const spec of App.Joints.all()) {
      const items = state[spec.storage];
      const sec = document.createElement('div');
      sec.className = 'list-section';
      const header = document.createElement('div');
      header.className = 'list-header';
      header.innerHTML = `<h4>${spec.title}</h4><span class="count">${items.length}</span>`;
      sec.appendChild(header);
      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'list-empty';
        empty.textContent = '—';
        sec.appendChild(empty);
      } else {
        items.forEach((item, i) => {
          const row = document.createElement('div');
          row.className = 'list-item';
          if (state.selected && state.selected.type === spec.type && state.selected.index === i) row.classList.add('selected');
          const meta = spec.listMeta(item, state, i);
          row.innerHTML = `<div class="icon" style="background:${meta.color}"></div>`;
          const nameInput = document.createElement('input');
          nameInput.type = 'text';
          nameInput.value = item.name;
          nameInput.addEventListener('click', e => e.stopPropagation());
          nameInput.addEventListener('input', e => {
            item.name = e.target.value;
            if (state.selected && state.selected.type === spec.type && state.selected.index === i) updateProps();
          });
          row.appendChild(nameInput);
          if (meta.sub) {
            const subEl = document.createElement('span');
            subEl.className = 'meta';
            subEl.textContent = meta.sub;
            row.appendChild(subEl);
          }
          const del = document.createElement('button');
          del.className = 'del';
          del.textContent = '×';
          del.addEventListener('click', e => {
            e.stopPropagation();
            App.util.deleteItem(spec.type, i);
            renderList(); updateProps();
          });
          row.appendChild(del);
          row.addEventListener('click', () => {
            state.selected = { type: spec.type, index: i };
            updateProps(); renderList();
          });
          sec.appendChild(row);
        });
      }
      listEl.appendChild(sec);
    }
  }

  // ---- 右パネル: プロパティ ----
  function updateProps() {
    const box = document.getElementById('props');
    const title = document.getElementById('propTitle');
    if (!state.selected) {
      title.textContent = 'プロパティ';
      box.innerHTML = '<div style="color:#666;font-size:12px">オブジェクトを選択してください</div>';
      return;
    }
    const spec = App.Joints.get(state.selected.type);
    if (!spec) { state.selected = null; updateProps(); return; }
    const item = state[spec.storage][state.selected.index];
    if (!item) { state.selected = null; updateProps(); return; }
    title.textContent = spec.title;
    spec.renderProps(box, item, state, api);
  }

  App.sidebar = { renderList, updateProps, api };
})();
