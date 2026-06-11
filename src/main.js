(function () {
  const appNamespace = window.MabinogiCP;
  const app = document.querySelector('#app');

  if (!app) {
    throw new Error('找不到应用挂载点 #app');
  }

  appNamespace.renderApp(app);
})();
