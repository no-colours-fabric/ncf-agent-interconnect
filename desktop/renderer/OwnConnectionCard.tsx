import { MenuItem } from '@mui/material';
import { networkInterfaceMessages } from './i18n/network-interfaces.js';
import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputBase,
  Select,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
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
          ? legacy.listenerUnavailable
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [connectionIntent, setConnectionIntent] = useState(false);
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
      setConnectionIntent(false);
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
    setConnectionIntent(true);
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
  const addressWidth = `${Math.min(56, Math.max(18, effectiveAddress.length))}ch`;

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby={id + '-title'}
      data-testid="own-connection-card"
      sx={{ p: 2 }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Typography id={id + '-title'} component="h2" variant="subtitle1" sx={{ flex: 1 }}>
          {m.ownTitle}
        </Typography>
        <Tooltip title={m.networkSettings}>
          <IconButton
            aria-label={m.networkSettings}
            onClick={onSettings}
            sx={{ width: 44, height: 44, flexShrink: 0 }}
          >
            <SettingsOutlined sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Button
          aria-expanded={detailsOpen}
          aria-controls={id + '-details'}
          onClick={() => setDetailsOpen((open) => !open)}
          sx={{ minHeight: 44, minWidth: 0, px: 1, color: 'text.secondary' }}
        >
          {m.details}
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {local ? networkMessages.localHelp : m.ownHelp}
      </Typography>
      <Stack direction="row" spacing={2} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {(connectionIntent || code || detailsOpen) && (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ alignItems: 'center', minWidth: 0, maxWidth: '100%' }}
          >
            {urls.length > 1 ? (
              <Select
                variant="standard"
                disableUnderline
                value={effectiveAddress}
                onChange={(event) => setSelectedAddress(event.target.value)}
                inputRef={addressInput}
                inputProps={{ 'aria-label': m.ownAddress }}
                sx={{
                  width: `calc(${addressWidth} + 28px)`,
                  maxWidth: 'calc(100% - 48px)',
                  minHeight: 44,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  '& .MuiSelect-select': { py: 1, textOverflow: 'ellipsis' },
                }}
              >
                {urls.map((url) => (
                  <MenuItem
                    key={url}
                    value={url}
                    sx={{ overflowWrap: 'anywhere', whiteSpace: 'normal' }}
                  >
                    {url}
                  </MenuItem>
                ))}
              </Select>
            ) : (
              <InputBase
                value={effectiveAddress}
                readOnly
                placeholder={networkMessages.emptyEndpoint}
                inputRef={addressInput}
                slotProps={{ input: { 'aria-label': m.ownAddress } }}
                sx={{
                  width: addressWidth,
                  maxWidth: 'calc(100% - 48px)',
                  minHeight: 44,
                  fontFamily: 'monospace',
                  fontSize: 13,
                  '& input': { minWidth: 0, textOverflow: 'ellipsis' },
                }}
              />
            )}
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
        )}
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
          {usable ? (
            <>
              <InputBase
                value={code.code}
                readOnly
                inputRef={codeInput}
                slotProps={{ input: { 'aria-label': m.connectionCode } }}
                sx={{ width: '9ch', minHeight: 44, fontFamily: 'monospace', fontSize: 20 }}
              />
              <Button
                ref={copyCodeButton}
                variant="outlined"
                aria-label={t(locale, 'btnCopyCode')}
                onClick={() => void copy(code.code, codeInput)}
                startIcon={<ContentCopyOutlined sx={{ fontSize: 18 }} />}
                sx={{ minHeight: 44, flexShrink: 0 }}
              >
                {t(locale, 'btnCopyCode')}
              </Button>
              <Tooltip title={m.refreshHint}>
                <IconButton
                  aria-label={m.refreshCode}
                  onClick={() => void createCode()}
                  sx={{ width: 44, height: 44, flexShrink: 0 }}
                >
                  <RefreshOutlined sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" color="text.secondary">
                {m.singleUse}
              </Typography>
            </>
          ) : (
            <>
              {expired && node.running && !pending && (
                <Typography role="status" variant="body2">
                  {m.codeExpired}
                </Typography>
              )}
              <Button
                variant="outlined"
                onClick={() => void createCode()}
                disabled={!node.running || pending}
                sx={{ minHeight: 44 }}
                aria-label={pending ? m.creatingCode : m.createCode}
                aria-busy={pending}
              >
                {pending ? m.creatingCode : m.createCode}
              </Button>
              {!node.running && (
                <Typography variant="caption" color="text.secondary">
                  {m.startNodeHint}
                </Typography>
              )}
            </>
          )}
        </Stack>
      </Stack>
      {(node.running || connectionIntent || code || detailsOpen) && !effectiveAddress && (
        <Typography
          role="status"
          variant="body2"
          color="warning.main"
          data-testid="own-address-unavailable"
          sx={{ mt: 1 }}
        >
          {networkMessages.emptyEndpoint}
        </Typography>
      )}
      <Box
        id={id + '-details'}
        hidden={!detailsOpen}
        data-testid="announcement-details"
        sx={{ mt: 1 }}
      >
        <Stack spacing={0.5}>
          {local && (
            <Typography variant="caption" color="text.secondary">
              {m.localOnly}
            </Typography>
          )}
          {announcement && (
            <Typography variant="caption" color="text.secondary">
              {announcementDetail}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" data-testid="own-code-expiry">
            {usable ? formatLanSearch(m.expiresIn, { time }) : `${m.singleUse} · ${m.validFor}`}
          </Typography>
        </Stack>
      </Box>
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
