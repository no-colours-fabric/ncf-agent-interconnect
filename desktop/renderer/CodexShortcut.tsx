import { useId, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Stack,
  Typography,
} from '@mui/material';
import InstallDesktopOutlined from '@mui/icons-material/InstallDesktopOutlined';
import { codexShortcutMessages } from '../shared/codex-shortcut-messages.js';
import {
  codexShortcutDestinationsFor,
  type CodexShortcutCreateResult,
  type CodexShortcutDestination,
  type CodexShortcutPlatform,
} from '../shared/codex-shortcut.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import { t, type Locale } from './i18n/index.js';

export function CodexShortcut({
  invoke,
  locale,
  platform,
  disabled,
}: {
  invoke: McpSetupInvoke;
  locale: Locale;
  platform: CodexShortcutPlatform;
  disabled: boolean;
}) {
  const copy = codexShortcutMessages(locale);
  const destinations = codexShortcutDestinationsFor(platform);
  const titleId = useId();
  const applying = useRef(false);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CodexShortcutDestination[]>([]);
  const [result, setResult] = useState<Exclude<
    CodexShortcutCreateResult,
    { state: 'cancelled' }
  > | null>(null);

  async function create() {
    const locations = destinations.filter((destination) => selected.includes(destination));
    if (applying.current || disabled || !locations.length) return;
    applying.current = true;
    setOpen(false);
    setBusy(true);
    setResult(null);
    try {
      const outcome = await invoke<CodexShortcutCreateResult>('codexShortcutCreate', {
        locale,
        destinations: locations,
      });
      if (outcome.state !== 'cancelled') setResult(outcome);
    } catch {
      setResult({ state: 'failed', reason: 'failed' });
    } finally {
      applying.current = false;
      setBusy(false);
    }
  }

  async function revealDock() {
    const revealed = await invoke<boolean>('codexShortcutRevealDock', {}).catch(() => false);
    if (revealed) return;
    setResult((current) =>
      current === result && current?.state === 'complete'
        ? {
            ...current,
            destinations: current.destinations.map((entry) =>
              entry.destination === 'dock' && entry.result === 'dockPending'
                ? { ...entry, result: 'dockUnavailable' }
                : entry,
            ),
          }
        : current,
    );
  }

  return (
    <Stack spacing={1} sx={{ alignItems: 'flex-start', mt: 1 }}>
      <Button
        variant="outlined"
        startIcon={<InstallDesktopOutlined />}
        data-testid="codex-create-shortcut"
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={() => {
          setSelected([]);
          setOpen(true);
        }}
      >
        {busy ? copy.creating : copy.action}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        aria-labelledby={titleId}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id={titleId}>{copy.save}</DialogTitle>
        <DialogContent>
          <FormGroup>
            {destinations.map((destination) => (
              <FormControlLabel
                key={destination}
                label={copy[destination]}
                sx={{ minHeight: 44 }}
                control={
                  <Checkbox
                    checked={selected.includes(destination)}
                    onChange={(_, checked) =>
                      setSelected((previous) =>
                        checked
                          ? [...previous, destination]
                          : previous.filter((item) => item !== destination),
                      )
                    }
                  />
                }
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions sx={{ '& .MuiButton-root': { minHeight: 44 } }}>
          <Button onClick={() => setOpen(false)}>{t(locale, 'btnCancel')}</Button>
          <Button
            variant="contained"
            disabled={disabled || !selected.length}
            onClick={() => void create()}
          >
            {copy.create}
          </Button>
        </DialogActions>
      </Dialog>
      {result?.state === 'failed' && <Alert severity="warning">{copy[result.reason]}</Alert>}
      {result?.state === 'complete' &&
        result.destinations.map(({ destination, result }) => {
          const severity =
            result === 'created' ? 'success' : result === 'dockPending' ? 'info' : 'warning';
          return (
            <Alert
              key={destination}
              severity={severity}
              role={severity === 'warning' ? 'alert' : 'status'}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {copy[destination]}
              </Typography>
              <Typography variant="body2">{copy[result]}</Typography>
              {result === 'dockPending' && (
                <Button
                  size="small"
                  sx={{ minHeight: 44, mt: 0.5 }}
                  onClick={() => void revealDock()}
                >
                  {copy.showInFinder}
                </Button>
              )}
            </Alert>
          );
        })}
    </Stack>
  );
}
