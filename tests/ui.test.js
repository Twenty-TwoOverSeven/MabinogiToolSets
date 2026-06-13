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

  test('monster tab uses current profile combat power by default', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    const strengthInput = root.querySelector('[data-stat="strength"]');
    strengthInput.value = '100';
    strengthInput.dispatchEvent(new Event('input', { bubbles: true }));

    root.querySelector('[data-tab="monsters"]').click();

    expectEqual(root.querySelector('[data-active-monster-cp]').textContent.includes('100.00'), true);
    expectEqual(root.querySelector('[data-monster-source]').textContent, '来自当前角色');

    root.remove();
    localStorage.clear();
  });

  test('monster rank ranges describe half-open CP boundaries', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '100';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    const rangeText = root.querySelector('.monster-range-grid').textContent;
    expectEqual(rangeText.includes('80.00 <= CP < 100.00'), true);
    expectEqual(rangeText.includes('CP >= 300.00'), true);

    root.remove();
    localStorage.clear();
  });

  test('monster tab manual override changes filter source only', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '100';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-source]').textContent, '手动覆盖');
    expectEqual(root.querySelector('[data-active-monster-cp]').textContent.includes('100.00'), true);

    root.querySelector('[data-tab="character"]').click();

    expectEqual(root.querySelector('.result-panel').textContent.includes('总战斗力：0.00'), true);

    root.remove();
    localStorage.clear();
  });

  test('monster tab validates invalid manual combat power', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '-5';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-message]').textContent, '手动战力必须是大于 0 的数字。');

    root.remove();
    localStorage.clear();
  });

  test('monster tab shows all data scope warning in design layout', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    root.querySelector('[data-tab="monsters"]').click();

    expectEqual(Boolean(root.querySelector('.monster-layout')), true);
    expectEqual(Boolean(root.querySelector('.monster-filter-panel')), true);
    expectEqual(Boolean(root.querySelector('.monster-result-panel')), true);
    ['Weakest', 'Weak', 'Normal', 'Strong', 'Awful', 'Boss'].forEach((rankName) => {
      expectEqual(root.querySelector('.monster-rank-filters').textContent.includes(rankName), true);
    });

    const dataScopeSelect = root.querySelector('[data-monster-data-scope]');
    expectEqual(Array.from(dataScopeSelect.options).some((option) => option.textContent === '全部已知数据'), true);
    expectEqual(root.textContent.includes('全部世代'), false);

    dataScopeSelect.value = 'all';
    dataScopeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-data-scope-note]').textContent, '全部已知数据可能包含后期、版本未知或活动记录。');

    root.remove();
    localStorage.clear();
  });

  test('monster rank checkbox keeps focus after filter redraw', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    root.querySelector('[data-tab="monsters"]').click();

    const rankCheckbox = root.querySelector('[data-monster-rank][value="weakest"]');
    rankCheckbox.focus();
    rankCheckbox.checked = false;
    rankCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

    const restoredCheckbox = root.querySelector('[data-monster-rank][value="weakest"]');
    expectEqual(document.activeElement, restoredCheckbox);
    expectEqual(restoredCheckbox.checked, false);

    root.remove();
    localStorage.clear();
  });

  test('monster data scope select keeps focus after filter redraw', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    root.querySelector('[data-tab="monsters"]').click();

    const dataScopeSelect = root.querySelector('[data-monster-data-scope]');
    dataScopeSelect.focus();
    dataScopeSelect.value = 'all';
    dataScopeSelect.dispatchEvent(new Event('change', { bubbles: true }));

    const restoredSelect = root.querySelector('[data-monster-data-scope]');
    expectEqual(document.activeElement, restoredSelect);
    expectEqual(restoredSelect.value, 'all');

    root.remove();
    localStorage.clear();
  });

  test('monster tab can search generated monster records', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '100';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    const nameInput = root.querySelector('[data-monster-name-query]');
    nameInput.value = 'gray';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-results]').textContent.toLowerCase().includes('gray'), true);

    root.remove();
    localStorage.clear();
  });

  test('monster name search supports Chinese composition', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);

    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '100';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    let nameInput = root.querySelector('[data-monster-name-query]');
    nameInput.value = 'zzzznope';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-results]').textContent.includes('Gray Wolf'), false);

    nameInput = root.querySelector('[data-monster-name-query]');
    nameInput.focus();
    nameInput.dispatchEvent(new Event('compositionstart', { bubbles: true }));
    nameInput.value = '灰';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(document.activeElement, nameInput);
    expectEqual(root.querySelector('[data-monster-name-query]'), nameInput);
    expectEqual(root.querySelector('[data-monster-results]').textContent.includes('Gray Wolf'), false);

    nameInput.value = '灰狼';
    nameInput.dispatchEvent(new Event('compositionend', { bubbles: true }));

    expectEqual(document.activeElement.hasAttribute('data-monster-name-query'), true);
    expectEqual(document.activeElement.value, '灰狼');
    expectEqual(root.querySelector('[data-monster-results]').textContent.includes('Gray Wolf'), true);

    root.remove();
    localStorage.clear();
  });

  test('monster result strength shows rank name without Chinese description', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);
    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '100';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    const nameInput = root.querySelector('[data-monster-name-query]');
    nameInput.value = 'gray';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    const rankLabels = Array.from(root.querySelectorAll('[data-monster-rank-label]')).map((cell) => cell.textContent);
    expectEqual(rankLabels.length > 0, true);
    expectEqual(rankLabels.some((label) => label === 'Weak'), true);
    expectEqual(rankLabels.some((label) => label.includes('弱的敌人')), false);
    expectEqual(rankLabels.some((label) => label.includes(' / ')), false);

    root.remove();
    localStorage.clear();
  });

  test('monster result without known location is marked unknown', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    localStorage.clear();

    window.MabinogiCP.renderApp(root);
    root.querySelector('[data-tab="monsters"]').click();

    const manualInput = root.querySelector('[data-monster-manual-cp]');
    manualInput.value = '100';
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));

    const firstUnknownMonster = window.MabinogiCP.MONSTER_RECORDS.find(
      (monster) => !monster.locations.length && (!monster.zhCNLocations || !monster.zhCNLocations.length)
    );
    const nameInput = root.querySelector('[data-monster-name-query]');
    nameInput.value = firstUnknownMonster.enName;
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));

    expectEqual(root.querySelector('[data-monster-results]').textContent.includes('未知'), true);

    root.remove();
    localStorage.clear();
  });
})();
