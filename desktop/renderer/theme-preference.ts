export type ThemeMode = 'dark' | 'light';

export const themeStorageKey = 'interconnect.theme';

export function loadThemeMode(
  getStorage: () => Pick<Storage, 'getItem'> | null | undefined,
): ThemeMode {
  try {
    return getStorage()?.getItem(themeStorageKey) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function persistThemeMode(
  getStorage: () => Pick<Storage, 'setItem'> | null | undefined,
  mode: ThemeMode,
): void {
  try {
    getStorage()?.setItem(themeStorageKey, mode);
  } catch {
    // Storage write failed; the selected theme stays active in memory.
  }
}
