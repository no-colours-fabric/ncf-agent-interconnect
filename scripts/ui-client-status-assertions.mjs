import assert from 'node:assert/strict';

/** Assert the approved conditional panel without attributing manual MCP to Cursor. */
export async function verifyClientStatusPanel(
  page,
  { kind, count, activity, locale = 'en', unknownLabel = 'Unknown' },
) {
  const selected = page.getByRole('tab', { selected: true });
  await page.waitForFunction(() => {
    const state = document
      .querySelector('[role="tab"][aria-selected="true"] [data-mcp-state]')
      ?.getAttribute('data-mcp-state');
    return state && state !== 'unknown';
  });
  const state = await selected.locator('[data-mcp-state]').getAttribute('data-mcp-state');
  const panel = page.getByTestId('client-status-panel');
  assert.equal(
    await page.getByTestId('application-manual').count(),
    0,
    'There is no overall manual-MCP summary',
  );
  if (state !== 'configured' && state !== 'needs-update') {
    assert.equal(
      await panel.count(),
      0,
      'Absent, pending and unavailable setup must not show a configured Status panel',
    );
    assert.ok((await page.getByTestId('client-setup-description').innerText()).trim());
    return;
  }
  await panel.waitFor();
  assert.equal(await panel.count(), 1);
  assert.equal(await panel.getAttribute('data-status'), state);
  assert.equal(await page.getByTestId('client-setup-description').count(), 0);
  const actualCount = await panel.getByTestId('application-agent-count').innerText();
  const actualActivity = await panel.getByTestId('application-last-activity').innerText();
  if (!kind || kind === 'manual') {
    assert.ok(actualCount.trim());
    assert.ok(
      !/^\d+$/.test(actualCount),
      'Cursor count must remain unknown instead of borrowing every manual connection',
    );
    assert.equal(actualCount, actualActivity);
    if (unknownLabel !== null) assert.equal(actualCount, unknownLabel);
    assert.equal(await panel.getByTestId('application-delivery-status').count(), 0);
    return;
  }
  assert.equal(actualCount, String(count));
  if (activity)
    assert.equal(
      actualActivity,
      await page.evaluate(
        ([date, locale]) => new Date(date).toLocaleString(locale),
        [activity, locale],
      ),
    );
  else if (unknownLabel !== null) assert.equal(actualActivity, unknownLabel);
  else assert.ok(actualActivity.trim(), 'Unknown activity remains explicit');
  assert.ok((await panel.getByTestId('application-delivery-status').innerText()).trim());
}
