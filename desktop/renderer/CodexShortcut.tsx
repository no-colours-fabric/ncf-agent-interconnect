import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
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
  type CodexShortcutConnectionResult,
  type CodexShortcutCreateResult,
  type CodexShortcutDestination,
  type CodexShortcutPlatform,
} from '../shared/codex-shortcut.js';
import type { McpSetupApplyResult, McpSetupInvoke } from '../shared/mcp-setup.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import { t, type Locale } from './i18n/index.js';
import { mcpSetupMessages } from './i18n/mcp-setup.js';

export interface ChatGptConnectRequest {
  planId?: string;
  confirmReplace: boolean;
  complete: (result: McpSetupApplyResult | null) => void;
  fail: (error: unknown) => void;
}

export function ChatGptConnectDialog({
  invoke,
  locale,
  request,
}: {
  invoke: McpSetupInvoke;
  locale: Locale;
  request: ChatGptConnectRequest;
}) {
  const [platform, setPlatform] = useState<CodexShortcutPlatform | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void invoke<CodexShortcutPlatform | null>('codexShortcutPlatform', {}).then(
      (value) => {
        if (live) setPlatform(value);
      },
      () => {
        if (live) setPlatform(null);
      },
    );
    return () => {
      live = false;
    };
  }, [invoke]);
  return (
    <CodexShortcut
      invoke={invoke}
      locale={locale}
      platform={platform}
      disabled={false}
      connection={request}
    />
  );
}

export function CodexShortcut({
  invoke,
  locale,
  platform,
  disabled,
  connection,
}: {
  invoke: McpSetupInvoke;
  locale: Locale;
  platform: CodexShortcutPlatform | null | undefined;
  disabled: boolean;
  connection?: ChatGptConnectRequest;
}) {
  const copy = codexShortcutMessages(locale);
  const destinations = platform ? codexShortcutDestinationsFor(platform) : [];
  const supported = !!platform && (!connection || !!connection.planId);
  const [completed, setCompleted] = useState<McpSetupApplyResult | null>(null);
  const titleId = useId();
  const applying = useRef(false);
  const locationsActive = useRef(false);
  const locationRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [existing, setExisting] = useState<CodexShortcutDestination[] | null>(null);
  const [checkingLocations, setCheckingLocations] = useState(false);
  const [locationsError, setLocationsError] = useState(false);
  const [selected, setSelected] = useState<CodexShortcutDestination[]>([]);
  const [result, setResult] = useState<Exclude<
    CodexShortcutCreateResult,
    { state: 'cancelled' }
  > | null>(null);

  const refreshLocations = useCallback(async () => {
    if (!locationsActive.current) return;
    const request = ++locationRequest.current;
    setCheckingLocations(true);
    setLocationsError(false);
    try {
      const locations = await invoke<CodexShortcutDestination[]>('codexShortcutLocations', {});
      if (request === locationRequest.current) setExisting(locations);
    } catch {
      if (request === locationRequest.current) {
        setExisting(null);
        setLocationsError(true);
      }
    } finally {
      if (request === locationRequest.current) setCheckingLocations(false);
    }
  }, [invoke]);
  const dialogOpen = !!connection || open;
  useEffect(() => {
    if (!dialogOpen || !supported) return;
    locationsActive.current = true;
    void refreshLocations();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshLocations();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      locationsActive.current = false;
      locationRequest.current++;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [dialogOpen, supported, refreshLocations]);

  const close = () => {
    if (busy) return;
    locationsActive.current = false;
    locationRequest.current++;
    if (connection) connection.complete(completed);
    else setOpen(false);
  };

  async function create() {
    const locations =
      existing &&
      destinations.filter(
        (destination) => selected.includes(destination) && !existing.includes(destination),
      );
    if (
      applying.current ||
      checkingLocations ||
      disabled ||
      !supported ||
      completed ||
      !locations?.length
    )
      return;
    applying.current = true;
    setBusy(true);
    setResult(null);
    try {
      let outcome: CodexShortcutCreateResult;
      if (connection) {
        const reply = await invoke<CodexShortcutConnectionResult>('codexShortcutConnect', {
          planId: connection.planId,
          confirmReplace: connection.confirmReplace,
          locale,
          destinations: locations,
        });
        outcome = reply.shortcut;
        if (reply.setup) {
          if (
            reply.setup.status !== 'failed' &&
            outcome.state === 'complete' &&
            outcome.destinations.some(({ result }) => result === 'dockPending')
          )
            setCompleted(reply.setup);
          else {
            connection.complete(reply.setup);
            return;
          }
        }
      } else {
        outcome = await invoke<CodexShortcutCreateResult>('codexShortcutCreate', {
          locale,
          destinations: locations,
        });
      }
      if (outcome.state !== 'cancelled') {
        setResult(outcome);
        setSelected(
          outcome.state === 'complete'
            ? outcome.destinations
                .filter(({ result }) => result === 'closeToUpdate')
                .map(({ destination }) => destination)
            : [],
        );
        await refreshLocations();
      }
    } catch (error) {
      if (connection) connection.fail(error);
      else setResult({ state: 'failed', reason: 'failed' });
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
      {!connection && (
        <Button
          variant="outlined"
          startIcon={<InstallDesktopOutlined />}
          data-testid="codex-create-shortcut"
          disabled={disabled || busy}
          aria-busy={busy}
          onClick={() => {
            setSelected([]);
            setExisting(null);
            setLocationsError(false);
            setResult(null);
            setOpen(true);
          }}
          sx={{ minHeight: 44 }}
        >
          {busy ? copy.creating : copy.action}
        </Button>
      )}
      <Dialog open={dialogOpen} onClose={close} aria-labelledby={titleId} fullWidth maxWidth="md">
        <DialogTitle id={titleId}>{connection ? copy.connectTitle : copy.save}</DialogTitle>
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
              {platform !== undefined && !supported ? (
                <Alert severity="warning">{copy.profileUnavailable}</Alert>
              ) : existing === null ? (
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
                        <Chip
                          size="small"
                          color="success"
                          variant="outlined"
                          label={copy.locationCreated}
                        />
                      </Stack>
                    ) : (
                      <FormControlLabel
                        key={destination}
                        label={copy[destination]}
                        sx={{ minHeight: 44, ml: 0 }}
                        control={
                          <Checkbox
                            disabled={busy || !!completed}
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
                  if (
                    result === 'created' &&
                    destination !== 'custom' &&
                    existing &&
                    !existing.includes(destination)
                  )
                    return null;
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
          {connection && !completed && (
            <Alert severity="info" sx={{ mt: 2.5 }}>
              {copy.chooseForConnection}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ '& .MuiButton-root': { minHeight: 44 } }}>
          <Button disabled={busy} onClick={close}>
            {completed ? mcpSetupMessages(locale).close : t(locale, 'btnCancel')}
          </Button>
          {!completed && (
            <Button
              variant="contained"
              disabled={
                !supported ||
                disabled ||
                busy ||
                checkingLocations ||
                !existing ||
                !selected.some((item) => !existing.includes(item))
              }
              onClick={() => void create()}
            >
              {connection ? t(locale, 'btnConnect') : copy.create}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
