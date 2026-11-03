import assert from 'node:assert/strict';

const loadButton = (page) => page.getByRole('button', { name: 'Load more messages', exact: true });
const history = (page) => page.getByTestId('agent-chat-history');

async function frames(page, count = 6) {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        const next = () => (--count ? requestAnimationFrame(next) : resolve());
        requestAnimationFrame(next);
      }),
    count,
  );
}

async function assertPage(page, expectedTexts, count) {
  await page.waitForFunction(
    (count) => document.querySelectorAll('[data-testid="chat-message"]').length === count,
    count,
  );
  if (count < expectedTexts.length) await loadButton(page).waitFor();
  else await loadButton(page).waitFor({ state: 'detached' });
  await frames(page);
  const rows = await page.getByTestId('chat-message').evaluateAll((elements) =>
    elements.map((element) => ({
      key: element.dataset.messageKey,
      sequence: Number(element.dataset.sequence),
      text: element.querySelector('[data-testid="message-text"]').textContent,
    })),
  );
  assert.equal(rows.length, count);
  assert.equal(new Set(rows.map((row) => row.key)).size, count);
  assert.deepEqual(
    rows.map((row) => row.text),
    expectedTexts.slice(-count),
    'Each history page must retain its exact content and chronological order',
  );
  const sequences = rows.map((row) => row.sequence);
  assert.deepEqual(
    sequences,
    [...sequences].sort((a, b) => a - b),
  );
  assert.equal(new Set(sequences).size, count);
}

async function assertBottom(page) {
  assert.ok(
    await history(page).evaluate(
      (element) => element.scrollHeight - element.scrollTop - element.clientHeight < 3,
    ),
    'The latest page must open at the bottom',
  );
}

async function observeActions(page) {
  await history(page).evaluate((element) => {
    window.__historySmoke?.dispose();
    const actions = { clicks: [], scrolls: [] };
    const click = (event) => {
      if (event.target.closest('button')?.textContent === 'Load more messages')
        actions.clicks.push({ trusted: event.isTrusted, top: element.scrollTop });
    };
    const scroll = () => {
      actions.scrolls.push({
        top: element.scrollTop,
        count: element.querySelectorAll('[data-testid="chat-message"]').length,
      });
    };
    element.addEventListener('click', click, true);
    element.addEventListener('scroll', scroll);
    window.__historySmoke = {
      actions,
      dispose: () => {
        element.removeEventListener('click', click, true);
        element.removeEventListener('scroll', scroll);
      },
    };
  });
}

async function prepend(page, expectedTexts, count) {
  await history(page).evaluate((element) => {
    // This is an automatic-load intent. Do not scroll a transient button into view.
    element.scrollTop = 40;
    const top = element.getBoundingClientRect().top;
    const anchor = [...element.querySelectorAll('[data-message-key]')].find(
      (row) => row.getBoundingClientRect().bottom > top + 1,
    );
    if (!anchor) throw new Error('A visible message is required for the prepend anchor');
    const trace = {
      key: anchor.dataset.messageKey,
      offset: anchor.getBoundingClientRect().top - top,
      samples: [],
      running: true,
    };
    window.__historySmoke.trace = trace;
    const sample = () => {
      if (!trace.running) return;
      const row = [...element.querySelectorAll('[data-message-key]')].find(
        (row) => row.dataset.messageKey === trace.key,
      );
      trace.samples.push(
        row
          ? row.getBoundingClientRect().top - element.getBoundingClientRect().top - trace.offset
          : Infinity,
      );
      requestAnimationFrame(sample);
    };
    sample();
  });
  try {
    await assertPage(page, expectedTexts, count);
    const anchor = await page.evaluate(() => {
      const { key, samples } = window.__historySmoke.trace;
      return { key, samples: samples.length, maxShift: Math.max(...samples.map(Math.abs)) };
    });
    assert.ok(anchor.samples >= 4, 'The prepend must be sampled across paint frames');
    assert.ok(anchor.maxShift <= 1, 'The visible anchor moved ' + anchor.maxShift + ' CSS px');
    assert.ok(
      await history(page).evaluate(
        (element) =>
          element.scrollTop > 0 &&
          element.scrollHeight - element.scrollTop - element.clientHeight > 100,
      ),
      'Prepending must preserve the reading position away from the bottom',
    );
    return { count, ...anchor };
  } finally {
    await page.evaluate(() => {
      window.__historySmoke.trace.running = false;
    });
  }
}

export async function verifyChatHistoryPagination(page, expectedTexts, reopen) {
  assert.ok(expectedTexts.length > 200 && expectedTexts.length < 300);
  await assertPage(page, expectedTexts, 100);
  await assertBottom(page);
  await observeActions(page);

  // Keep keyboard activation separate from scrolling. Focus itself must not start auto-loading.
  const top = await history(page).evaluate((element) => element.scrollTop);
  await loadButton(page).evaluate((button) => button.focus({ preventScroll: true }));
  assert.ok(await loadButton(page).evaluate((button) => document.activeElement === button));
  assert.equal(await history(page).evaluate((element) => element.scrollTop), top);
  await page.keyboard.press('Enter');
  await assertPage(page, expectedTexts, 200);
  await assertBottom(page);
  const manual = await page.evaluate(() => window.__historySmoke.actions.clicks);
  assert.equal(manual.length, 1, 'Manual loading requires a real button activation');
  assert.equal(manual[0].trusted, true);
  assert.ok(manual[0].top >= 64, 'Manual activation must not depend on the auto-load threshold');

  await reopen();
  await assertPage(page, expectedTexts, 100);
  await assertBottom(page);
  await observeActions(page);
  const anchors = [];
  try {
    for (const count of [200, expectedTexts.length])
      anchors.push(await prepend(page, expectedTexts, count));
    assert.deepEqual(
      await page.evaluate(() => window.__historySmoke.actions.clicks),
      [],
      'Automatic pagination must not rely on clicking a disappearing button',
    );
    return {
      manualKeyboardPages: [100, 200],
      automaticPages: [100, 200, expectedTexts.length],
      anchors,
    };
  } finally {
    await page.evaluate(() => window.__historySmoke.dispose());
  }
}

export async function reproduceHistoryClickScroll(page, expectedTexts) {
  await assertPage(page, expectedTexts, 100);
  await observeActions(page);
  await prepend(page, expectedTexts, 200);
  // Isolate Playwright's normal pre-click scrolling, without dispatching or forcing a click.
  const before = await history(page).evaluate((element) => element.scrollTop);
  await loadButton(page).scrollIntoViewIfNeeded();
  await assertPage(page, expectedTexts, expectedTexts.length);
  const actions = await page.evaluate(() => window.__historySmoke.actions);
  assert.deepEqual(actions.clicks, []);
  assert.ok(actions.scrolls.some((event) => event.top < 64 && event.count === 200));
  await page.evaluate(() => window.__historySmoke.dispose());
  return {
    beforeScrollTop: before,
    ...actions,
    finalCount: expectedTexts.length,
    buttonRemovedBeforeClick: true,
  };
}
