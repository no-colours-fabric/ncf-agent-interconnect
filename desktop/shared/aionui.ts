export interface AionUiSetupState {
  state: 'not-paired' | 'paired' | 'revoked';
  url: string;
}
export interface AionUiSetupInstructions {
  testPrompt: string;
}

export interface AionUiApplicationState extends AionUiSetupState {
  bridgeConnected: boolean;
}
