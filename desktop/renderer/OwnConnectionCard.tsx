import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import type { Snapshot } from '../shared/contracts.js';
import type { LanDiscoverySnapshot } from '../shared/lan-discovery.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import { t, type Locale } from './i18n/index.js';
import { formatLanSearch, lanSearchMessages } from './i18n/lan-search.js';
import { lanDiscoveryMessages } from './i18n/lan-discovery.js';
import { networkInterfaceMessages } from './i18n/network-interfaces.js';

export interface OwnConnectionCode {
  code: string;
  expiresAt: string;
}

export interface OwnConnectionCardProps {
  node: Pick<Snapshot, 'nodeId' | 'running' | 'peerUrl' | 'listenHost' | 'peerUrls'>;
  announcement?: LanDiscoverySnapshot['announcement'];
  code: OwnConnectionCode | null;
  onCodeChange: (value: OwnConnectionCode | null) => void;
  locale: Locale;
  invoke: McpSetupInvoke;
  onSettings: () => void;
  active?: boolean;
  visible?: boolean;
}

const linkSx = {
  p: 0,
  textAlign: 'start',
  '&:disabled': { color: 'text.disabled', cursor: 'default', textDecoration: 'none' },
} as const;

export function OwnConnectionCard({
  node,
  announcement,
  code,
  onCodeChange,
  locale,
  invoke,
  onSettings,
  active = true,
  visible = true,
}: OwnConnectionCardProps): React.JSX.Element {
  const m = lanSearchMessages(locale);
  const networkMessages = networkInterfaceMessages(locale);
  const legacy = lanDiscoveryMessages(locale);
  const urls = [...new Set(node.peerUrls ?? (node.peerUrl ? [node.peerUrl] : []))];
  const local =
    announcement?.reason === 'listener-local' ||
    (urls.length > 0 && urls.every((url) => /^wss:\/\/(127\.|\[::1\])/u.test(url)));
  const announcementDetail = announcement?.available
    ? legacy.announcing
    : announcement?.reason === 'stopped'
      ? legacy.stopped
      : announcement?.reason === 'listener-local' || announcement?.reason === 'listener-unavailable'
        ? null
        : announcement?.reason === 'no-interfaces'
          ? legacy.noInterfaces
          : announcement?.reason === 'transport-error'
            ? legacy.transportError
            : legacy.notAnnouncing;

  const id = useId();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ kind: 'code' | 'copy'; detail: string } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const copyGeneration = useRef(0);
  const codeInput = useRef<HTMLInputElement>(null);
  const copyCodeButton = useRef<HTMLButtonElement>(null);
  const focusCopy = useRef(false);
  const context = `${node.nodeId}\n${node.running}`;
  const currentContext = useRef(context);
  currentContext.current = context;
  const previousContext = useRef(context);
  const dialogOpen = active && open && previousContext.current === context;
  const visibleRef = useRef(visible && dialogOpen);
  visibleRef.current = visible && dialogOpen;

  const expires = code ? Date.parse(code.expiresAt) : 0;
  const remaining = Number.isFinite(expires) ? Math.max(0, Math.ceil((expires - now) / 1000)) : 0;
  const usable = !!code && remaining > 0 && node.running && !pending && dialogOpen;
  const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      copyGeneration.current++;
    };
  }, []);
  useEffect(() => {
    if (previousContext.current === context) return;
    previousContext.current = context;
    generation.current++;
    copyGeneration.current++;
    inFlight.current = false;
    focusCopy.current = false;
    setOpen(false);
    setPending(false);
    setFailure(null);
    setCopied(null);
    onCodeChange(null);
  }, [context, onCodeChange]);
  useEffect(() => {
    if (!dialogOpen) return;
    const currentTime = Date.now();
    setNow(currentTime);
    if (!Number.isFinite(expires) || expires <= currentTime) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const deadline = setTimeout(() => {
      setNow(Date.now());
      clearInterval(timer);
    }, expires - currentTime);
    return () => {
      clearInterval(timer);
      clearTimeout(deadline);
    };
  }, [dialogOpen, expires]);
  useEffect(() => {
    if (!focusCopy.current || !usable) return;
    focusCopy.current = false;
    if (visible && document.visibilityState === 'visible') copyCodeButton.current?.focus();
  }, [usable, visible]);
  useEffect(() => {
    if (copied === null) return;
    const timeout = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const createCode = async () => {
    if (!node.running || inFlight.current) return;
    const request = ++generation.current;
    const ownerContext = context;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    setCopied(null);
    copyGeneration.current++;
    // A refresh may replace the server's code even if its response is lost.
    onCodeChange(null);
    try {
      const value = await invoke<OwnConnectionCode>('accessCode', {});
      if (
        !value ||
        !/^[A-HJ-NP-Z2-9]{8}$/.test(value.code) ||
        !Number.isFinite(Date.parse(value.expiresAt))
      )
        throw new Error('Invalid access-code response');
      if (
        mounted.current &&
        generation.current === request &&
        currentContext.current === ownerContext
      ) {
        setNow(Date.now());
        focusCopy.current = true;
        onCodeChange({ code: value.code, expiresAt: value.expiresAt });
      }
    } catch (error) {
      if (
        mounted.current &&
        generation.current === request &&
        currentContext.current === ownerContext
      )
        setFailure({
          kind: 'code',
          detail: error instanceof Error ? error.message : String(error),
        });
    } finally {
      if (mounted.current && generation.current === request) {
        inFlight.current = false;
        setPending(false);
      }
    }
  };
  const openDialog = () => {
    if (!node.running) return;
    const currentTime = Date.now();
    setOpen(true);
    setNow(currentTime);
    if (!code || !Number.isFinite(expires) || expires <= currentTime) void createCode();
  };
  const closeDialog = () => {
    setOpen(false);
    copyGeneration.current++;
    setCopied(null);
    setFailure((current) => (current?.kind === 'copy' ? null : current));
  };
  const copy = async (value: string, selectOnFailure?: () => void) => {
    if (!dialogOpen) return;
    const request = ++copyGeneration.current;
    const ownerContext = context;
    setFailure((current) => (current?.kind === 'copy' ? null : current));
    setCopied(null);
    const isCurrent = () =>
      mounted.current &&
      copyGeneration.current === request &&
      currentContext.current === ownerContext;
    try {
      await invoke('copy', { text: value });
      if (isCurrent()) setCopied(request);
    } catch (error) {
      if (!isCurrent()) return;
      setFailure({ kind: 'copy', detail: error instanceof Error ? error.message : String(error) });
      if (visibleRef.current && document.visibilityState === 'visible') selectOnFailure?.();
    }
  };
  const copyCode = (includeAddresses: boolean) => {
    if (!code || !usable) return;
    if (Date.now() >= expires) {
      setNow(Date.now());
      return;
    }
    const text = includeAddresses ? [code.code, ...urls].join('\n') : code.code;
    void copy(text, () => codeInput.current?.select());
  };

  return (
    <>
      <Paper
        component="section"
        variant="outlined"
        aria-labelledby={id + '-title'}
        data-testid="own-connection-card"
        sx={{ p: 3 }}
      >
        <Stack
          direction="row"
          useFlexGap
          spacing={2}
          sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <Typography id={id + '-title'} variant="h6">
            {m.ownTitle}
          </Typography>
          <Button
            variant="contained"
            onClick={openDialog}
            disabled={!node.running}
            sx={{ minHeight: 44 }}
          >
            {m.createCode}
          </Button>
        </Stack>
      </Paper>
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        fullWidth
        maxWidth="sm"
        aria-labelledby={id + '-dialog-title'}
      >
        <DialogTitle id={id + '-dialog-title'}>{m.ownTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5}>
            <Box>
              <Typography
                component="label"
                htmlFor={id + '-code'}
                variant="body2"
                color="text.secondary"
                sx={{ display: 'block', mb: 1 }}
              >
                {m.connectionCode}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <TextField
                  id={id + '-code'}
                  fullWidth
                  value={usable ? code.code : '********'}
                  inputRef={codeInput}
                  slotProps={{
                    input: { readOnly: true, notched: false },
                    htmlInput: { 'aria-describedby': id + '-expiry' },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-input:not(textarea)': {
                      fontFamily: 'monospace',
                      fontSize: 20,
                      height: 20,
                      letterSpacing: '.15em',
                    },
                  }}
                />
                <Tooltip title={t(locale, 'btnCopyCode')}>
                  <span>
                    <IconButton
                      ref={copyCodeButton}
                      aria-label={t(locale, 'btnCopyCode')}
                      disabled={!usable}
                      onClick={() => copyCode(false)}
                      sx={{ width: 44, height: 44 }}
                    >
                      <ContentCopyOutlined sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
              <Stack
                direction="row"
                spacing={2}
                useFlexGap
                sx={{
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  mt: 1,
                }}
              >
                <Typography
                  id={id + '-expiry'}
                  variant="caption"
                  color="text.secondary"
                  data-testid="own-code-expiry"
                >
                  {pending
                    ? m.creatingCode
                    : usable
                      ? `${m.singleUse} · ${formatLanSearch(m.expiresIn, { time })}`
                      : code
                        ? m.codeExpired
                        : null}
                </Typography>
                {(code || failure?.kind === 'code') && (
                  <Tooltip title={m.refreshHint} describeChild>
                    <Link
                      component="button"
                      type="button"
                      variant="body2"
                      underline="always"
                      disabled={!node.running || pending}
                      onClick={() => void createCode()}
                      sx={linkSx}
                    >
                      <RefreshOutlined
                        aria-hidden="true"
                        sx={{ fontSize: '1em', verticalAlign: '-0.125em', mr: 0.5 }}
                      />
                      {m.refreshCode}
                    </Link>
                  </Tooltip>
                )}
              </Stack>
            </Box>
            <Box>
              {urls.length ? (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" aria-label={m.ownAddress}>
                    <TableHead>
                      <TableRow>
                        <TableCell>{m.ownAddress}</TableCell>
                        <TableCell aria-label={m.copyAddress} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {urls.map((url) => (
                        <TableRow key={url}>
                          <TableCell
                            component="th"
                            scope="row"
                            sx={{ overflowWrap: 'anywhere', userSelect: 'text' }}
                          >
                            {url}
                          </TableCell>
                          <TableCell align="right" sx={{ width: 56, px: 1, py: 0 }}>
                            <Tooltip title={m.copyAddress}>
                              <IconButton
                                aria-label={`${m.copyAddress} ${url}`}
                                onClick={(event) => {
                                  const cell = event.currentTarget.closest('tr')?.firstElementChild;
                                  void copy(url, () => {
                                    const selection = window.getSelection();
                                    if (!cell?.isConnected || !selection) return;
                                    const range = document.createRange();
                                    range.selectNodeContents(cell);
                                    selection.removeAllRanges();
                                    selection.addRange(range);
                                  });
                                }}
                                sx={{ width: 44, height: 44 }}
                              >
                                <ContentCopyOutlined sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2">{networkMessages.emptyEndpoint}</Typography>
              )}
              {!!urls.length && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {local ? networkMessages.localHelp : m.ownHelp}
                </Typography>
              )}
              <Link
                component="button"
                type="button"
                variant="body2"
                underline="always"
                onClick={() => {
                  closeDialog();
                  onSettings();
                }}
                sx={{ ...linkSx, mt: 1 }}
              >
                {m.networkSettings}
              </Link>
              {announcement && announcementDetail && (
                <Box component="details" sx={{ mt: 1 }} data-testid="announcement-details">
                  <summary>{m.details}</summary>
                  <Typography variant="caption">{announcementDetail}</Typography>
                </Box>
              )}
            </Box>
            {failure && (
              <Alert severity="error">
                {failure.kind === 'code' ? m.codeFailed : m.copyFailed}
                <Box component="details" sx={{ mt: 1 }}>
                  <summary>{m.details}</summary>
                  <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                    {failure.detail}
                  </Typography>
                </Box>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="always"
              disabled={!usable}
              onClick={() => copyCode(true)}
              sx={linkSx}
            >
              {m.copyConnectionInfo}
            </Link>
            <Typography
              role="status"
              variant="caption"
              color="success.main"
              sx={{ minHeight: '1.5em' }}
            >
              {copied !== null ? t(locale, 'copied') : ''}
            </Typography>
          </Stack>
          <Button onClick={closeDialog} sx={{ minHeight: 44 }}>
            {t(locale, 'mcpSetup_close')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
