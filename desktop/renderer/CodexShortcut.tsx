import { useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
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
import { ClientLogo } from './ApplicationDiscovery.js';
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
  const locationRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<CodexShortcutDestination[] | null>(null);
  const [locationsError, setLocationsError] = useState(false);
  const [selected, setSelected] = useState<CodexShortcutDestination[]>([]);
  const [result, setResult] = useState<Exclude<
    CodexShortcutCreateResult,
    { state: 'cancelled' }
  > | null>(null);

  async function refreshLocations() {
    const request = ++locationRequest.current;
    setExisting(null);
    setLocationsError(false);
    try {
      const locations = await invoke<CodexShortcutDestination[]>('codexShortcutLocations', {});
      if (request === locationRequest.current) setExisting(locations);
    } catch {
      if (request === locationRequest.current) setLocationsError(true);
    }
  }

  async function create() {
    const locations =
      existing &&
      destinations.filter(
        (destination) => selected.includes(destination) && !existing.includes(destination),
      );
    if (applying.current || disabled || !locations?.length) return;
    applying.current = true;
    setBusy(true);
    setResult(null);
    try {
      const outcome = await invoke<CodexShortcutCreateResult>('codexShortcutCreate', {
        locale,
        destinations: locations,
      });
      if (outcome.state !== 'cancelled') {
        setResult(outcome);
        setSelected([]);
        await refreshLocations();
      }
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
    <>
      <Button
        variant="outlined"
        startIcon={<InstallDesktopOutlined />}
        data-testid="codex-create-shortcut"
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={() => {
          setSelected([]);
          setOpen(true);
          void refreshLocations();
        }}
        sx={{ minHeight: 44 }}
      >
        {busy ? copy.creating : copy.action}
      </Button>
      <Dialog
        open={open}
        onClose={() => {
          if (!busy) setOpen(false);
        }}
        aria-labelledby={titleId}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle id={titleId}>{copy.save}</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 3,
            }}
          >
            <Stack spacing={2} sx={{ pt: 0.75 }} data-testid="chatgpt-shortcut-explanation">
              <ClientLogo client="codex" size={72} />
              <Typography variant="body2">{copy.helpBefore}</Typography>
              <Typography variant="body2">{copy.helpWhen}</Typography>
            </Stack>
            <Stack
              spacing={1}
              sx={{
                borderLeft: { sm: 1 },
                borderTop: { xs: 1, sm: 0 },
                borderColor: { xs: 'divider', sm: 'divider' },
                pl: { sm: 3 },
                pt: { xs: 2, sm: 0 },
              }}
              data-testid="chatgpt-shortcut-locations"
            >
              {existing === null ? (
                <Typography role={locationsError ? 'alert' : 'status'} variant="body2">
                  {locationsError ? copy.locationsFailed : copy.checkingLocations}
                </Typography>
              ) : (
                <FormGroup>
                  {destinations.map((destination) =>
                    existing.includes(destination) ? (
                      <Stack
                        key={destination}
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: 'center', minHeight: 44, px: 0.75 }}
                        data-testid={'chatgpt-shortcut-created-' + destination}
                      >
                        <ClientLogo client="codex" size={24} />
                        <Typography variant="body2">{copy[destination]}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {copy.locationCreated}
                        </Typography>
                      </Stack>
                    ) : (
                      <FormControlLabel
                        key={destination}
                        label={copy[destination]}
                        sx={{ minHeight: 44, ml: 0 }}
                        control={
                          <Checkbox
                            disabled={busy}
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
                    ),
                  )}
                </FormGroup>
              )}
              {result?.state === 'failed' && (
                <Alert severity="warning">{copy[result.reason]}</Alert>
              )}
              {result?.state === 'complete' &&
                result.destinations.map(({ destination, result }) => {
                  const severity =
                    result === 'created'
                      ? 'success'
                      : result === 'dockPending'
                        ? 'info'
                        : 'warning';
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ '& .MuiButton-root': { minHeight: 44 } }}>
          <Button disabled={busy} onClick={() => setOpen(false)}>
            {t(locale, 'btnCancel')}
          </Button>
          <Button
            variant="contained"
            disabled={
              disabled || busy || !existing || !selected.some((item) => !existing.includes(item))
            }
            onClick={() => void create()}
          >
            {copy.create}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
