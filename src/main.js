const app = document.querySelector('#app');

if (!app) {
  throw new Error('找不到应用挂载点 #app');
}

app.innerHTML = '<main class="app-shell"><h1>洛奇战斗力计算器</h1><p>应用初始化完成。</p></main>';
