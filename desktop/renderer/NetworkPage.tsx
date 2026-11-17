import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ComputerOutlined from '@mui/icons-material/ComputerOutlined';
import StopOutlined from '@mui/icons-material/StopOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import type { Snapshot } from '../shared/contracts.js';
import type { LanPairSelection } from '../shared/lan-discovery.js';
import type { LanSearchNode } from '../shared/lan-search.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import { OwnConnectionCard, type OwnConnectionCode } from './OwnConnectionCard.js';
import { t, type Locale } from './i18n/index.js';
import { lanDiscoveryMessages } from './i18n/lan-discovery.js';
import { formatLanSearch, lanSearchMessages } from './i18n/lan-search.js';

export interface NetworkManualConnection {
  address: string;
  code: string;
  onAddressChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  /** Keep the actual existing manual renderer at the integration boundary. */
  content?: React.ReactNode;
}
export interface NetworkPageProps {
  active: boolean;
  windowVisible: boolean;
  obscured?: boolean;
  snapshot: Snapshot;
  locale: Locale;
  invoke: McpSetupInvoke;
  onSettings: () => void;
  ownCode: OwnConnectionCode | null;
  onOwnCodeChange: (value: OwnConnectionCode | null) => void;
  manual: NetworkManualConnection;
  /** The existing paired-node/details renderer, with all of its capabilities. */
  children: React.ReactNode;
}

export function unpairedLanNodes(snapshot: Snapshot): LanSearchNode[] {
  const ids = new Set(snapshot.peers.map((peer) => peer.id));
  const addresses = new Set(snapshot.peers.map((peer) => peer.address).filter(Boolean));
  return (snapshot.lanSearch?.nodes ?? []).filter(
    (node) => !ids.has(node.nodeId) && !addresses.has(node.address),
  );
}

export function lanSearchNavigation(
  snapshot: Snapshot,
  locale: Locale,
): { searching: boolean; unseenCount: number; statusLabel: string } {
  const search = snapshot.lanSearch;
  const keys = new Set(unpairedLanNodes(snapshot).map((node) => node.key));
  const searching = search?.phase === 'searching';
  return {
    searching,
    unseenCount: search?.unseenKeys.filter((key) => keys.has(key)).length ?? 0,
    statusLabel: searching
      ? formatLanSearch(lanSearchMessages(locale).sidebarStatus, {
          seconds: Math.max(0, Math.ceil((search.durationMs - search.elapsedMs) / 1000)),
          count: search.foundCount,
        })
      : '',
  };
}

/** Keep mounted when inactive so navigation cannot discard drafts or an in-flight action. */
export function NetworkPage({
  active,
  windowVisible,
  obscured = false,
  snapshot,
  locale,
  invoke,
  onSettings,
  ownCode,
  onOwnCodeChange,
  manual,
  children,
}: NetworkPageProps): React.JSX.Element {
  const m = lanSearchMessages(locale);
  const legacy = lanDiscoveryMessages(locale);
  const id = useId();
  const [manualOpen, setManualOpen] = useState(false);
  const [selected, setSelected] = useState<LanPairSelection | null>(null);
  const [code, setCode] = useState('');
  const [pairPending, setPairPending] = useState(false);
  const [pairError, setPairError] = useState<{ uncertain: boolean; detail: string } | null>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [diagnostic, setDiagnostic] = useState('');
  const [pairedNotice, setPairedNotice] = useState(false);
  const [authenticatedAddresses, setAuthenticatedAddresses] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const mounted = useRef(true);
  const pairFence = useRef(false);
  const searchFence = useRef(false);
  const attempt = useRef(0);
  const uncertainAttempts = useRef(new Map<string, string>());
  const currentSnapshot = useRef(snapshot);
  currentSnapshot.current = snapshot;
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const observerGeneration = useRef(0);
  const pendingAcknowledgements = useRef(new Set<string>());
  const [documentVisible, setDocumentVisible] = useState(
    () =>
      typeof document !== 'undefined' &&
      document.visibilityState === 'visible' &&
      document.hasFocus(),
  );
  const search = snapshot.lanSearch;
  const nodes = useMemo(
    () => unpairedLanNodes(snapshot).filter((node) => !authenticatedAddresses.has(node.address)),
    [snapshot, authenticatedAddresses],
  );
  const covered = obscured || !!selected || manualOpen;
  const canObserve = active && windowVisible && documentVisible && !covered;
  const observationGate = useRef(canObserve);
  observationGate.current = canObserve;
  const currentKeys = useRef(new Set<string>());
  currentKeys.current = new Set(nodes.map((node) => node.key));
  const keySignature = nodes.map((node) => node.key).join('\n');
  const unseenSignature = search?.unseenKeys.join('\n') ?? '';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      attempt.current++;
      observerGeneration.current++;
    };
  }, []);
  useEffect(() => {
    // The authoritative snapshot takes over temporary success suppression.
    const paired = new Set(snapshot.peers.map((peer) => peer.address));
    setAuthenticatedAddresses((previous) => {
      if (![...previous].some((address) => paired.has(address))) return previous;
      return new Set([...previous].filter((address) => !paired.has(address)));
    });
  }, [snapshot.peers]);
  useEffect(() => {
    const update = () =>
      setDocumentVisible(document.visibilityState === 'visible' && document.hasFocus());
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    update();
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
    };
  }, []);
  useEffect(() => {
    const generation = ++observerGeneration.current;
    if (!canObserve || typeof IntersectionObserver === 'undefined') return;
    const known = new Set(nodes.map((node) => node.key));
    const unseen = new Set(search?.unseenKeys ?? []);
    const runId = search?.runId;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          !mounted.current ||
          generation !== observerGeneration.current ||
          !observationGate.current ||
          document.visibilityState !== 'visible' ||
          !document.hasFocus() ||
          currentSnapshot.current.lanSearch?.runId !== runId
        )
          return;
        const keys: string[] = [];
        const currentUnseen = new Set(currentSnapshot.current.lanSearch?.unseenKeys ?? []);
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.lanKey;
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.5 &&
            entry.target.isConnected &&
            key &&
            known.has(key) &&
            unseen.has(key) &&
            currentUnseen.has(key) &&
            currentKeys.current.has(key) &&
            rowRefs.current.get(key) === entry.target &&
            !pendingAcknowledgements.current.has(key)
          )
            keys.push(key);
        }
        const exact = [...new Set(keys)].slice(0, 128);
        if (!exact.length) return;
        exact.forEach((key) => pendingAcknowledgements.current.add(key));
        void invoke('ackLanSearch', { keys: exact })
          .catch((error: unknown) => {
            if (mounted.current)
              setDiagnostic(error instanceof Error ? error.message : String(error));
          })
          .finally(() => exact.forEach((key) => pendingAcknowledgements.current.delete(key)));
      },
      { threshold: 0.5 },
    );
    for (const key of known) {
      const row = rowRefs.current.get(key);
      if (row) observer.observe(row);
    }
    return () => {
      observerGeneration.current++;
      observer.disconnect();
    };
  }, [canObserve, keySignature, unseenSignature, search?.runId, invoke]);

  const searchAction = async (stop: boolean) => {
    if (searchFence.current || !snapshot.running) return;
    searchFence.current = true;
    setSearchPending(true);
    setSearchError(false);
    try {
      const result = await invoke<{ started?: boolean }>(
        stop ? 'stopLanSearch' : 'startLanSearch',
        {},
      );
      if (mounted.current && !stop && result?.started === false) setSearchError(true);
    } catch (error) {
      if (mounted.current) {
        setSearchError(true);
        setDiagnostic(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (mounted.current) {
        searchFence.current = false;
        setSearchPending(false);
      }
    }
  };
  const closePair = () => {
    if (pairFence.current) return;
    setSelected(null);
    setManualOpen(false);
    setCode('');
    setPairError(null);
  };
  const connect = async (address: string, access: string, isManual: boolean) => {
    const value = access.trim();
    if (
      pairFence.current ||
      !snapshot.running ||
      !address.trim() ||
      !/^[A-HJ-NP-Z2-9]{8}$/.test(value) ||
      uncertainAttempts.current.get(address) === value
    )
      return;
    const input = Object.freeze({ address, code: value });
    const request = ++attempt.current;
    const nodeId = snapshot.nodeId;
    pairFence.current = true;
    setPairPending(true);
    setPairError(null);
    setPairedNotice(false);
    try {
      await invoke('connectPeer', input);
      if (
        !mounted.current ||
        attempt.current !== request ||
        currentSnapshot.current.nodeId !== nodeId
      )
        return;
      uncertainAttempts.current.delete(address);
      setAuthenticatedAddresses((previous) => {
        const next = new Set(previous);
        next.add(address);
        if (next.size > 128) next.delete(next.values().next().value!);
        return next;
      });
      if (isManual) manual.onCodeChange('');
      setSelected(null);
      setManualOpen(false);
      setCode('');
      setPairedNotice(true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const uncertain =
        /uncertain|authorized this connection|time(?:d)?\s*out|timeout|channel.*closed|object.*destroyed|ECONNRESET/i.test(
          detail,
        );
      if (uncertain) {
        uncertainAttempts.current.set(address, value);
        if (uncertainAttempts.current.size > 128)
          uncertainAttempts.current.delete(uncertainAttempts.current.keys().next().value!);
      }
      if (
        mounted.current &&
        attempt.current === request &&
        currentSnapshot.current.nodeId === nodeId
      )
        setPairError({ uncertain, detail });
    } finally {
      if (mounted.current && attempt.current === request) {
        pairFence.current = false;
        setPairPending(false);
      }
    }
  };

  const searching = search?.phase === 'searching';
  const duration = Math.max(1, search?.durationMs ?? 30000);
  const elapsed = Math.max(0, Math.min(duration, search?.elapsedMs ?? 0));
  const elapsedText = formatLanSearch(m.elapsed, {
    elapsed: Math.floor(elapsed / 1000),
    total: Math.ceil(duration / 1000),
  });
  const title = searching
    ? m.searching
    : search?.phase === 'complete'
      ? m.searchComplete
      : search?.phase === 'stopped'
        ? m.searchStopped
        : m.unavailableHelp;
  const helper = searching
    ? m.searchingHelp
    : search?.phase === 'stopped'
      ? m.stoppedHelp
      : search?.reason === 'no-interfaces'
        ? m.noInterfaces
        : '';
  const blockedSelection =
    !!selected && uncertainAttempts.current.get(selected.address) === code.trim();
  const blockedManual = uncertainAttempts.current.get(manual.address.trim()) === manual.code.trim();
  const selectionMissing = !!selected && !search?.nodes.some((node) => node.key === selected.key);
  const diagnostics = (detail: string) => (
    <Box component="details" sx={{ mt: 1 }}>
      <summary>{m.details}</summary>
      <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
        {detail}
      </Typography>
    </Box>
  );
  const pairFailure = (blocked: boolean) =>
    (pairError || blocked) && (
      <Alert severity="error" role="alert">
        {pairError?.uncertain || blocked ? m.uncertain : legacy.failed}
        {pairError?.detail && diagnostics(pairError.detail)}
      </Alert>
    );
  const onCode = (value: string) => {
    setCode(value.replace(/[a-z]/g, (letter) => letter.toUpperCase()));
    setPairError(null);
  };

  return (
    <>
      <Stack
        spacing={3}
        sx={{ display: active ? 'flex' : 'none', minWidth: 0 }}
        data-testid="network-page"
      >
        <OwnConnectionCard
          node={snapshot}
          announcement={snapshot.lanDiscovery?.announcement}
          code={ownCode}
          onCodeChange={onOwnCodeChange}
          locale={locale}
          invoke={invoke}
          onSettings={onSettings}
          visible={canObserve}
        />
        {pairedNotice && (
          <Alert severity="success" role="status" onClose={() => setPairedNotice(false)}>
            {legacy.success}
          </Alert>
        )}
        <Paper
          component="section"
          variant="outlined"
          aria-labelledby={id + '-search-title'}
          sx={{ p: 3 }}
        >
          <Stack
            direction="row"
            spacing={2}
            sx={{ justifyContent: 'space-between', alignItems: 'start' }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                {searching && <CircularProgress size={16} aria-hidden="true" />}
                <Typography id={id + '-search-title'} variant="h6">
                  {title}
                </Typography>
              </Stack>
              {helper && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {helper}
                </Typography>
              )}
            </Box>
            <Button
              variant={nodes.length || searching ? 'outlined' : 'contained'}
              disabled={!snapshot.running || searchPending}
              startIcon={searching ? <StopOutlined /> : <RefreshOutlined />}
              onClick={() => void searchAction(searching)}
              sx={{ flexShrink: 0, minHeight: 44 }}
            >
              {searching ? m.stopSearch : m.searchAgain}
            </Button>
          </Stack>
          <Stack
            direction="row"
            spacing={2}
            useFlexGap
            sx={{ mt: 2.5, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            <Typography variant="body2">
              {formatLanSearch(m.found, { count: search?.foundCount ?? 0 })}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {elapsedText}
            </Typography>
            {searching && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {formatLanSearch(m.remaining, {
                  seconds: Math.max(0, Math.ceil((duration - elapsed) / 1000)),
                })}
              </Typography>
            )}
          </Stack>
          {searching && (
            <LinearProgress
              variant="determinate"
              value={(elapsed / duration) * 100}
              aria-label={m.searchTime}
              aria-valuetext={elapsedText}
              sx={{ mt: 1.5 }}
            />
          )}
          {searchError && (
            <Typography role="alert" variant="body2" color="error" sx={{ mt: 1 }}>
              {m.unavailableHelp}
            </Typography>
          )}
          {(diagnostic || search?.reason) &&
            diagnostics(
              diagnostic ||
                (search?.reason === 'no-interfaces' ? legacy.noInterfaces : legacy.transportError),
            )}
        </Paper>
        {snapshot.peers.length > 0 && (
          <Box component="section" aria-label={m.pairedTitle} data-testid="retained-paired-content">
            {children}
          </Box>
        )}
        <Box component="section" aria-labelledby={id + '-nearby-title'}>
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', mb: 2 }}>
            <Typography id={id + '-nearby-title'} variant="h6">
              {legacy.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {nodes.length}
            </Typography>
            <Button
              variant="text"
              onClick={() => {
                setPairError(null);
                setManualOpen(true);
              }}
              sx={{
                ml: 'auto',
                p: 0,
                minHeight: 36,
                minWidth: 0,
                fontSize: 13,
                textDecoration: 'underline',
                color: 'text.secondary',
              }}
            >
              {m.manualConnect}
            </Button>
          </Stack>
          <Paper variant="outlined">
            {nodes.length ? (
              <List disablePadding>
                {nodes.map((node, index) => (
                  <ListItem
                    key={node.key}
                    data-lan-key={node.key}
                    ref={(element: HTMLLIElement | null) => {
                      if (element) rowRefs.current.set(node.key, element);
                      else rowRefs.current.delete(node.key);
                    }}
                    sx={{
                      px: 3,
                      py: 2.5,
                      gap: 2,
                      borderTop: index ? '1px solid' : undefined,
                      borderColor: 'divider',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        color: 'text.secondary',
                        flexShrink: 0,
                      }}
                    >
                      <ComputerOutlined sx={{ fontSize: 24 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}
                        >
                          {node.label}
                        </Typography>
                        {node.newlyFound && (
                          <Typography variant="caption" color="success.main">
                            {m.newLabel}
                          </Typography>
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {node.observedInRun && node.lastSeenAgoMs < 30000
                          ? m.available
                          : m.previous}
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      sx={{ minHeight: 44 }}
                      disabled={!snapshot.running || pairPending}
                      aria-label={`${t(locale, 'btnConnect')} ${node.label}`}
                      onClick={() => {
                        setSelected(
                          Object.freeze({
                            key: node.key,
                            nodeId: node.nodeId,
                            label: node.label,
                            address: node.address,
                          }),
                        );
                        setCode('');
                        setPairError(null);
                      }}
                    >
                      {t(locale, 'btnConnect')}
                    </Button>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <ComputerOutlined color="disabled" />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {legacy.empty}
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Stack>
      <Dialog
        open={active && !!selected}
        onClose={closePair}
        fullWidth
        maxWidth="sm"
        aria-labelledby={id + '-pair-title'}
      >
        <Box
          component="form"
          onSubmit={(event: React.FormEvent) => {
            event.preventDefault();
            if (selected) void connect(selected.address, code, false);
          }}
        >
          <DialogTitle id={id + '-pair-title'}>{m.connectTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {legacy.codeHelp}
              </Typography>
              <Typography sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                {selected?.label}
              </Typography>
              {selectionMissing && <Alert severity="info">{m.selectedMissing}</Alert>}
              <TextField
                autoFocus
                label={m.connectionCode}
                value={code}
                disabled={pairPending}
                onChange={(event) => onCode(event.target.value)}
                fullWidth
                slotProps={{
                  input: { notched: false },
                  inputLabel: { shrink: true, disableAnimation: true },
                  htmlInput: {
                    maxLength: 8,
                    autoComplete: 'off',
                    autoCapitalize: 'characters',
                    spellCheck: false,
                  },
                }}
              />
              {selected && diagnostics(selected.address)}
              {pairFailure(blockedSelection)}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closePair} disabled={pairPending} sx={{ minHeight: 44 }}>
              {pairError?.uncertain || blockedSelection
                ? t(locale, 'mcpSetup_close')
                : t(locale, 'btnCancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              sx={{ minHeight: 44 }}
              disabled={
                !snapshot.running ||
                pairPending ||
                blockedSelection ||
                !/^[A-HJ-NP-Z2-9]{8}$/.test(code)
              }
            >
              {pairPending ? m.connecting : t(locale, 'btnConnect')}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
      <Dialog
        open={active && manualOpen}
        onClose={closePair}
        fullWidth
        maxWidth="sm"
        aria-labelledby={id + '-manual-title'}
      >
        <Box
          component={manual.content ? 'div' : 'form'}
          onSubmit={(event: React.FormEvent) => {
            if (manual.content) return;
            event.preventDefault();
            void connect(manual.address.trim(), manual.code, true);
          }}
        >
          <DialogTitle id={id + '-manual-title'}>{m.connectTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {manual.content ?? (
                <>
                  <TextField
                    autoFocus
                    label={t(locale, 'networkAddressLabel')}
                    placeholder={t(locale, 'networkAddressPlaceholder')}
                    value={manual.address}
                    disabled={pairPending}
                    onChange={(event) => manual.onAddressChange(event.target.value)}
                    fullWidth
                  />
                  <TextField
                    label={m.connectionCode}
                    helperText={t(locale, 'networkAccessHelper')}
                    value={manual.code}
                    disabled={pairPending}
                    onChange={(event) => {
                      manual.onCodeChange(
                        event.target.value.replace(/[a-z]/g, (letter) => letter.toUpperCase()),
                      );
                      setPairError(null);
                    }}
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        maxLength: 8,
                        autoComplete: 'off',
                        autoCapitalize: 'characters',
                        spellCheck: false,
                      },
                    }}
                  />
                </>
              )}
              {pairFailure(blockedManual)}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button disabled={pairPending} onClick={closePair} sx={{ minHeight: 44 }}>
              {pairError?.uncertain || blockedManual
                ? t(locale, 'mcpSetup_close')
                : t(locale, 'btnCancel')}
            </Button>
            {!manual.content && (
              <Button
                type="submit"
                variant="contained"
                sx={{ minHeight: 44 }}
                disabled={
                  !snapshot.running ||
                  pairPending ||
                  blockedManual ||
                  !manual.address.trim() ||
                  !/^[A-HJ-NP-Z2-9]{8}$/.test(manual.code.trim())
                }
              >
                {pairPending ? m.connecting : t(locale, 'btnConnect')}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
