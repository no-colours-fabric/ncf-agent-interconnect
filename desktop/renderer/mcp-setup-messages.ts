export const mcpSetupEnglish = {
  statusTitle: 'Status',
  statusMcpConfig: 'MCP settings',
  statusOpencodeConfig: 'MCP and plugin settings',
  statusOpencodeHint: 'This checks saved settings, not whether the plugin is running.',
  statusUnknown: 'Unknown',
  statusCursorMetricsHint:
    'Delivery becomes active after the connected chat completes a turn. After restarting Cursor, send any message in that chat to restore delivery.',
  statusDelivery: 'Agent delivery',
  statusAuthorization: 'Authorization',
  statusLiveBridge: 'Live bridge',
  aionBridgeDisconnected: 'Bridge not connected to a verified chat',

  aionBridgeConnected: 'Bridge connected to a verified chat',

  aionConfigure: 'Configure Cursor Agent',

  aionConfigureAccess: 'Configure access',

  aionDescription:
    'Connect Cursor Agent inside AionUi. Authorization, saved MCP settings and a live bridge are separate states.',
  aionContinue: 'Continue setting up AionUi. Follow the steps below.',
  aionAccessAction: 'Select {action} and follow the pairing instructions.',
  aionPairTitle: 'Access to AionUi',
  aionPairHelp:
    'Enable WebUI in AionUi on this computer, enter its address and pairing code, then confirm access in AionUi.',
  aionAddress: 'AionUi WebUI address',
  aionCode: 'Pairing code',
  aionPair: 'Pair',
  aionDisconnect: 'Disconnect',
  aionConfirm: 'Confirm access in AionUi.',
  aionPaired: 'Authorization saved',
  aionRevoked: 'Access ended',
  aionNotPaired: 'Not paired',
  aionFailure:
    'Could not complete setup. Check that AionUi WebUI is running and approve a fresh pairing code.',
  aionMcpTitle: 'MCP for Cursor Agent',
  aionMcpOutdated: 'AionUi bridge settings need updating',
  aionUpdateAction: 'Select {action}, then click Apply.',
  aionRestartAction:
    'After applying the bridge, reconnect Cursor Agent in the intended AionUi chat so it reloads MCP settings.',
  aionMcpHelp:
    'The current NCF connection in this Cursor profile will be updated for AionUi. To use Cursor separately, use another profile.',
  aionNext:
    'Restart Cursor Agent in AionUi after Apply, then connect using the command below. Saved settings do not confirm a live bridge. Other AionUi backends are not supported by this setup.',

  tabsLabel: 'MCP client',
  userControl:
    'Connect your application with a button. Settings change only after you click Apply.',
  configureCursor: 'Configure Cursor',
  configureOpencode: 'Configure OpenCode',
  configureCodex: 'Configure Codex',
  cursorTitle: 'Configure Cursor',
  opencodeTitle: 'Configure OpenCode',
  codexTitle: 'Configure Codex',
  cursorDescription:
    'Connect Cursor to NCF Agent Interconnect. Apply adds the MCP connection and installs the included reactive plugin automatically.',
  opencodeDescription:
    'Connect OpenCode v1 to NCF Agent Interconnect. We will add the connection settings and enable the included integration. OpenCode v2 is not supported.',
  codexDescription:
    'Connect Codex to NCF Agent Interconnect. We will add the connection settings to the selected instance or profile.',
  pathLabel: 'Configuration file path',
  browse: 'Choose file…',
  knownPaths: 'Other locations',
  pathHint:
    'Choose the file used by this application. A missing file will be created when you click Apply.',
  checking: 'Checking settings…',
  ready: 'Ready to apply',
  create: 'The connection settings will be added.',
  update: 'The connection settings will be updated. A backup will be saved.',
  unchanged: 'These settings are already present. No changes are needed.',
  configured: 'Settings are present',
  'not-configured': 'Not configured',
  'needs-update': 'Settings need updating',
  missing: 'Not configured',
  unavailable: 'Could not check settings',
  openFile: 'Open configuration file',
  openFileMissing: 'Apply setup first to create this file, then open it.',
  backup: 'Backup',
  cancel: 'Cancel',
  apply: 'Apply',
  close: 'Close',
  applied: 'Setup applied.',
  noChanges: 'Settings are already present. Nothing was changed.',
  failed: 'Setup could not be applied.',
  cursorNext: 'Restart Cursor once, then connect an agent in the intended chat.',
  opencodeNext: 'Restart OpenCode v1 to use these settings.',
  codexNext: 'Reconnect MCP in the selected Codex instance or profile to use these settings.',
  copyPrompt: 'Copy connection prompt',
  connect: 'Connect an agent in the client',
  connectionPrompt: 'Connect as agent <a name you choose>.',
};
export type McpSetupMessages = { [K in keyof typeof mcpSetupEnglish]: string };
