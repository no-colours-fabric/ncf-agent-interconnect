export type CodexShortcutPlatform = 'mac' | 'windows';

export type CodexShortcutResult =
  | 'created'
  | 'cancelled'
  | 'setupRequired'
  | 'appMissing'
  | 'profileUnavailable'
  | 'alreadyExists'
  | 'failed';
