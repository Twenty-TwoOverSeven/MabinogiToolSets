(function () {
  const results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (error) {
      results.push({ name, ok: false, error });
    }
  }

  function expectEqual(actual, expected) {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}`);
    }
  }

  function expectClose(actual, expected, precision = 0.000001) {
    if (Math.abs(actual - expected) > precision) {
      throw new Error(`Expected ${expected}, got ${actual}`);
    }
  }

  function renderResults() {
    const root = document.querySelector('#results');
    const passed = results.filter((result) => result.ok).length;

    root.innerHTML = `
      <h1>Browser Tests</h1>
      <p>${passed}/${results.length} passed</p>
      <ul>
        ${results
          .map((result) => `<li class="${result.ok ? 'pass' : 'fail'}">${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error.message}` : ''}</li>`)
          .join('')}
      </ul>
    `;
  }

  window.MabinogiCPTest = {
    test,
    expectEqual,
    expectClose,
    renderResults,
  };
})();
