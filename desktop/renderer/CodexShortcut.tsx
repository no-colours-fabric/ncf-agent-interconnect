import { useRef, useState } from 'react';
import { Alert, Button, Stack } from '@mui/material';
import InstallDesktopOutlined from '@mui/icons-material/InstallDesktopOutlined';
import { codexShortcutMessages } from '../shared/codex-shortcut-messages.js';
import type { CodexShortcutResult } from '../shared/codex-shortcut.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import type { Locale } from './i18n/index.js';

export function CodexShortcut({
  invoke,
  locale,
  disabled,
}: {
  invoke: McpSetupInvoke;
  locale: Locale;
  disabled: boolean;
}) {
  const copy = codexShortcutMessages(locale);
  const applying = useRef(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Exclude<CodexShortcutResult, 'cancelled'> | null>(null);

  async function create() {
    if (applying.current || disabled) return;
    applying.current = true;
    setBusy(true);
    setResult(null);
    try {
      const outcome = await invoke<CodexShortcutResult>('codexShortcutCreate', { locale });
      if (outcome !== 'cancelled') setResult(outcome);
    } catch {
      setResult('failed');
    } finally {
      applying.current = false;
      setBusy(false);
    }
  }

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start', mt: 1 }}>
      <Button
        variant="outlined"
        startIcon={<InstallDesktopOutlined />}
        data-testid="codex-create-shortcut"
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={() => void create()}
      >
        {busy ? copy.creating : copy.action}
      </Button>
      {result && (
        <Alert
          severity={result === 'created' ? 'success' : 'warning'}
          role={result === 'created' ? 'status' : 'alert'}
        >
          {copy[result]}
        </Alert>
      )}
    </Stack>
  );
}
