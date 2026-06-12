(function () {
  const { expectEqual, test } = window.MabinogiCPTest;

  test('text input keeps focus after state redraw', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    const nameInput = root.querySelector('[data-field="name"]');
    nameInput.focus();
    nameInput.value = '娜儿';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(document.activeElement.getAttribute('data-field'), 'name');
    expectEqual(document.activeElement.value, '娜儿');

    root.remove();
    localStorage.clear();
  });

  test('profile text inputs clear stale validation message without redraw', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    const strengthInput = root.querySelector('[data-stat="strength"]');
    strengthInput.value = '-1';
    strengthInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-import-message]').textContent, '白值属性无效：力量');

    const titleInput = root.querySelector('[data-field="title"]');
    titleInput.focus();
    titleInput.value = '测试称号';
    titleInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-import-message]').textContent, '');
    expectEqual(document.activeElement, titleInput);

    root.remove();
    localStorage.clear();
  });

  test('skill search keeps focus while suggestions redraw', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    const searchInput = root.querySelector('[data-skill-search]');
    searchInput.focus();
    searchInput.value = '防';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(document.activeElement.hasAttribute('data-skill-search'), true);
    expectEqual(document.activeElement.value, '防');

    root.remove();
    localStorage.clear();
  });

  test('stat input does not replace the focused number field', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    const strengthInput = root.querySelector('[data-stat="strength"]');
    strengthInput.focus();
    strengthInput.value = '100';
    strengthInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(document.activeElement, strengthInput);
    expectEqual(strengthInput.value, '100');
    expectEqual(root.querySelector('.result-panel').textContent.includes('总战斗力：100.00'), true);
    expectEqual(root.querySelector('[data-stat-contribution="strength"]').textContent, '贡献：100.00');

    root.remove();
    localStorage.clear();
  });

  test('valid stat input clears stale validation message without redraw', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    const strengthInput = root.querySelector('[data-stat="strength"]');
    strengthInput.focus();
    strengthInput.value = '-1';
    strengthInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-import-message]').textContent, '白值属性无效：力量');

    strengthInput.value = '100';
    strengthInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-import-message]').textContent, '');
    expectEqual(document.activeElement, strengthInput);

    root.remove();
    localStorage.clear();
  });

  test('skill search supports Chinese composition and windmill result', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    const searchInput = root.querySelector('[data-skill-search]');
    searchInput.focus();
    searchInput.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    searchInput.value = '风';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(document.activeElement, searchInput);
    expectEqual(root.textContent.includes('添加 风车'), false);

    searchInput.value = '风车';
    searchInput.dispatchEvent(new Event('compositionend', { bubbles: true }));

    expectEqual(document.activeElement.hasAttribute('data-skill-search'), true);
    expectEqual(root.textContent.includes('添加 风车'), true);

    root.remove();
    localStorage.clear();
  });
})();
