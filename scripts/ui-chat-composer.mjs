/** Wait for the approved finite MUI Collapse before steady-state assertions. */
export async function waitForComposerTransition(scope) {
  const expanded = await scope
    .getByTestId('agent-chat-compose-toggle')
    .getAttribute('aria-expanded');
  if (expanded === 'true')
    await scope
      .locator('.MuiCollapse-entered [data-testid="agent-chat-compose"]')
      .waitFor({ state: 'visible' });
  else await scope.getByTestId('agent-chat-compose').waitFor({ state: 'detached' });
}
