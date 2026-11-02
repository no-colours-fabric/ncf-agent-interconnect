export interface AionUiSetupState {
  state: 'not-paired' | 'paired' | 'revoked';
  url: string;
}
export interface AionUiSetupInstructions {
  configuration: string;
  testPrompt: string;
}
