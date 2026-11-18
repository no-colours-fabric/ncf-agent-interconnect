import { MenuItem } from '@mui/material';
import { networkInterfaceMessages } from './i18n/network-interfaces.js';
import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
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
  visible?: boolean;
}

export function OwnConnectionCard({
  node,
  announcement,
  code,
  onCodeChange,
  locale,
  invoke,
  onSettings,
  visible = true,
}: OwnConnectionCardProps): React.JSX.Element {
  const m = lanSearchMessages(locale);
  const networkMessages = networkInterfaceMessages(locale);
  const urls = node.peerUrls ?? (node.peerUrl ? [node.peerUrl] : []);
  const [selectedAddress, setSelectedAddress] = useState(node.peerUrl);
  const effectiveAddress = urls.includes(selectedAddress)
    ? selectedAddress
    : urls.includes(node.peerUrl)
      ? node.peerUrl
      : (urls[0] ?? '');
  const legacy = lanDiscoveryMessages(locale);
  const announcementDetail = announcement?.available
    ? legacy.announcing
    : announcement?.reason === 'stopped'
      ? legacy.stopped
      : announcement?.reason === 'listener-local'
        ? networkMessages.localHelp
        : announcement?.reason === 'listener-unavailable'
          ? null
          : announcement?.reason === 'no-interfaces'
            ? legacy.noInterfaces
            : announcement?.reason === 'transport-error'
              ? legacy.transportError
              : legacy.notAnnouncing;
  const id = useId();
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ kind: 'code' | 'copy'; detail: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const addressInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const copyCodeButton = useRef<HTMLButtonElement>(null);
  const focusCopy = useRef(false);
  const context = `${node.nodeId}\n${node.running}`;
  const currentContext = useRef(context);
  currentContext.current = context;
  const previousContext = useRef(context);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const expires = code ? Date.parse(code.expiresAt) : 0;
  const remaining = Math.max(0, Math.ceil((expires - now) / 1000));
  const usable = !!code && Number.isFinite(expires) && remaining > 0 && node.running && !pending;
  const expired = !!code && !remaining;
  const local =
    announcement?.reason === 'listener-local' ||
    /^wss:\/\/127\./.test(effectiveAddress) ||
    effectiveAddress.startsWith('wss://[::1]');
  const time = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (previousContext.current !== context) {
      previousContext.current = context;
      generation.current++;
      inFlight.current = false;
      focusCopy.current = false;
      setPending(false);
      setFailure(null);
      setCopied(false);
      onCodeChange(null);
    }
  }, [context, onCodeChange]);
  useEffect(() => {
    setNow(Date.now());
    if (!code) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);
  useEffect(() => {
    if (!focusCopy.current || pending || !usable) return;
    focusCopy.current = false;
    if (visible && document.visibilityState === 'visible') copyCodeButton.current?.focus();
  }, [pending, usable, visible]);

  const createCode = async () => {
    if (!node.running || inFlight.current) return;
    const request = ++generation.current;
    const ownerContext = context;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    setCopied(false);
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
  const copy = async (value: string, input: React.RefObject<HTMLInputElement | null>) => {
    const ownerContext = context;
    setFailure(null);
    setCopied(false);
    try {
      await invoke('copy', { text: value });
      if (mounted.current && currentContext.current === ownerContext) setCopied(true);
    } catch (error) {
      if (!mounted.current || currentContext.current !== ownerContext) return;
      setFailure({ kind: 'copy', detail: error instanceof Error ? error.message : String(error) });
      if (visibleRef.current && document.visibilityState === 'visible') {
        const field = input.current;
        if (typeof field?.select === 'function') field.select();
        else field?.focus();
      }
    }
  };
  const readOnly = {
    input: { readOnly: true, notched: false },
    inputLabel: { shrink: true, disableAnimation: true },
  };

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={id + '-title'}
      data-testid="own-connection-card"
      sx={{ p: 3 }}
    >
      <Typography id={id + '-title'} variant="h6">
        {m.ownTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
        {local ? networkMessages.localHelp : m.ownHelp}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.1fr) minmax(0, .9fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              label={m.ownAddress}
              select={urls.length > 1}
              value={effectiveAddress}
              onChange={(event) => setSelectedAddress(event.target.value)}
              placeholder={networkMessages.emptyEndpoint}
              inputRef={addressInput}
              slotProps={urls.length > 1 ? { inputLabel: readOnly.inputLabel } : readOnly}
              sx={{ '& input': { fontFamily: 'monospace' } }}
            >
              {urls.length > 1 &&
                urls.map((url) => (
                  <MenuItem key={url} value={url}>
                    {url}
                  </MenuItem>
                ))}
            </TextField>
            <Tooltip title={m.copyAddress}>
              <IconButton
                aria-label={m.copyAddress}
                disabled={!effectiveAddress}
                onClick={() => void copy(effectiveAddress, addressInput)}
                sx={{ width: 44, height: 44, flexShrink: 0 }}
              >
                <ContentCopyOutlined sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
          {!effectiveAddress && (
            <Typography role="status" variant="body2">
              {networkMessages.emptyEndpoint}
            </Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {local && (
              <Typography variant="caption" color="text.secondary">
                {m.localOnly}
              </Typography>
            )}
            <Button
              variant="text"
              onClick={onSettings}
              sx={{ minWidth: 0, p: 0, fontSize: 13, textDecoration: 'underline' }}
            >
              {m.networkSettings}
            </Button>
          </Stack>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          {usable ? (
            <>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
                <TextField
                  fullWidth
                  label={m.connectionCode}
                  value={code.code}
                  inputRef={codeInput}
                  slotProps={readOnly}
                  sx={{
                    '& input': { fontFamily: 'monospace', fontSize: 24, letterSpacing: '.15em' },
                  }}
                />
                <Tooltip title={t(locale, 'btnCopyCode')}>
                  <IconButton
                    ref={copyCodeButton}
                    aria-label={t(locale, 'btnCopyCode')}
                    onClick={() => void copy(code.code, codeInput)}
                    sx={{ width: 44, height: 44, mb: 1, flexShrink: 0 }}
                  >
                    <ContentCopyOutlined sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, alignItems: 'center' }}>
                <Tooltip title={m.refreshHint}>
                  <IconButton
                    aria-label={m.refreshCode}
                    onClick={() => void createCode()}
                    sx={{ width: 24, height: 24, p: 0.5 }}
                  >
                    <RefreshOutlined sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" color="text.secondary" data-testid="own-code-expiry">
                  {m.singleUse} · {formatLanSearch(m.expiresIn, { time })}
                </Typography>
              </Stack>
            </>
          ) : (
            <>
              <Typography
                component="div"
                id={id + '-code-label'}
                variant="body2"
                color="text.secondary"
                sx={{ fontSize: 13, mb: 1 }}
              >
                {m.connectionCode}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                {expired && node.running && !pending && (
                  <Typography role="status" variant="body2">
                    {m.codeExpired}
                  </Typography>
                )}
                <Button
                  variant="contained"
                  onClick={() => void createCode()}
                  disabled={!node.running || pending}
                  sx={{ minHeight: 44 }}
                  aria-describedby={id + '-code-label'}
                  aria-busy={pending}
                >
                  {pending ? m.creatingCode : m.createCode}
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                {node.running ? `${m.singleUse} · ${m.validFor}` : m.startNodeHint}
              </Typography>
            </>
          )}
        </Box>
      </Box>
      {announcement && announcementDetail && (
        <Box component="details" sx={{ mt: 1 }} data-testid="announcement-details">
          <summary>{m.details}</summary>
          <Typography variant="caption">{announcementDetail}</Typography>
        </Box>
      )}
      {copied && (
        <Typography
          role="status"
          variant="caption"
          color="success.main"
          sx={{ display: 'block', mt: 1 }}
        >
          {t(locale, 'copied')}
        </Typography>
      )}
      {failure && (
        <Alert severity="error" role="alert" sx={{ mt: 2 }}>
          {failure.kind === 'code' ? m.codeFailed : m.copyFailed}
          <Box component="details" sx={{ mt: 1 }}>
            <summary>{m.details}</summary>
            <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
              {failure.detail}
            </Typography>
          </Box>
        </Alert>
      )}
    </Paper>
  );
}
