import { groupLanSearchNodes } from '../shared/lan-search.js';
import { networkInterfaceMessages } from './i18n/network-interfaces.js';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ComputerOutlined from '@mui/icons-material/ComputerOutlined';
import StopOutlined from '@mui/icons-material/StopOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import type { Snapshot } from '../shared/contracts.js';
import type { LanSearchNode } from '../shared/lan-search.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import { OwnConnectionCard, type OwnConnectionCode } from './OwnConnectionCard.js';
import { t, type Locale } from './i18n/index.js';
import { lanDiscoveryMessages } from './i18n/lan-discovery.js';
import { formatLanSearch, lanSearchMessages } from './i18n/lan-search.js';

export interface PairAttemptInput {
  address: string;
  code: string;
  expectedNodeId?: string;
}
class UncertainPairAttempt extends Error {
  constructor(
    message: string,
    readonly diagnostic: string,
  ) {
    super(message);
  }
}
const uncertainPairFailure = (error: unknown): boolean =>
  error instanceof UncertainPairAttempt ||
  /uncertain|authorized this connection|time(?:d)?\s*out|timeout|channel.*closed|object.*destroyed|ECONNRESET/i.test(
    error instanceof Error ? error.message : String(error),
  );
function pairAddressKey(value: string): string {
  const raw = value.trim();
  try {
    const implicit =
      !raw.includes('://') && !raw.startsWith('[') && raw.split(':').length > 2
        ? `[${raw}]:7336`
        : !raw.includes(':')
          ? raw + ':7336'
          : raw;
    const url = new URL(raw.includes('://') ? raw : 'wss://' + implicit);
    if (
      !['wss:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['/', '/peer'].includes(url.pathname)
    )
      return raw;
    url.protocol = 'wss:';
    url.pathname = '/peer';
    return url.toString();
  } catch {
    return raw;
  }
}

/** Negative retry provenance only: observed UUID claims never grant trust or rewrite destinations. */
export class PairAttemptLedger {
  private readonly uncertain = new Map<string, { code: string; diagnostic: string }>();
  get size(): number {
    return this.uncertain.size;
  }
  private capture(snapshot: Snapshot | null, input: PairAttemptInput) {
    const address = 'address:' + pairAddressKey(input.address);
    const observations = (snapshot?.lanSearch?.nodes ?? [])
      .flatMap((node) => [node, ...(node.endpoints ?? [])])
      .map((node) => ({ nodeId: node.nodeId, address: node.address }));
    for (const peer of snapshot?.peers ?? []) {
      if (peer.address) observations.push({ nodeId: peer.id, address: peer.address });
      if (peer.activeAddress) observations.push({ nodeId: peer.id, address: peer.activeAddress });
    }
    const matches = new Set(
      observations
        .filter((node) => 'address:' + pairAddressKey(node.address) === address)
        .map((node) => node.nodeId),
    );
    if (input.expectedNodeId) matches.add(input.expectedNodeId);
    const identity = input.expectedNodeId ?? (matches.size === 1 ? [...matches][0] : undefined);
    const aliases = identity
      ? [
          ...new Set(
            observations
              .filter((node) => node.nodeId === identity)
              .map((node) => 'address:' + pairAddressKey(node.address)),
          ),
        ]
      : [];
    return {
      address,
      node: identity ? 'node:' + identity : undefined,
      matches: [...matches].map((id) => 'node:' + id),
      aliases,
    };
  }
  private lookup(context: ReturnType<PairAttemptLedger['capture']>, code: string) {
    return [context.address, ...context.matches, ...context.aliases]
      .map((key) => this.uncertain.get(key))
      .find((record) => record?.code === code);
  }
  blocked(snapshot: Snapshot | null, input: PairAttemptInput): boolean {
    return !!this.lookup(this.capture(snapshot, input), input.code.trim());
  }
  diagnostic(snapshot: Snapshot | null, input: PairAttemptInput): string {
    return this.lookup(this.capture(snapshot, input), input.code.trim())?.diagnostic ?? '';
  }
  async run<T>(
    snapshot: Snapshot | null,
    input: PairAttemptInput,
    message: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const context = this.capture(snapshot, input);
    const code = input.code.trim();
    const blocked = this.lookup(context, code);
    if (blocked) throw new UncertainPairAttempt(message, blocked.diagnostic);
    try {
      const result = await work();
      for (const key of [
        ...context.aliases,
        context.address,
        ...(context.node ? [context.node] : []),
      ])
        this.uncertain.delete(key);
      return result;
    } catch (error) {
      if (!uncertainPairFailure(error)) throw error;
      const diagnostic =
        error instanceof UncertainPairAttempt
          ? error.diagnostic
          : error instanceof Error
            ? error.message
            : String(error);
      // Refresh insertion order; retain the latest selected address and node after any alias pruning.
      for (const key of [
        ...context.aliases,
        context.address,
        ...(context.node ? [context.node] : []),
      ]) {
        this.uncertain.delete(key);
        this.uncertain.set(key, { code, diagnostic });
      }
      while (this.uncertain.size > 128) this.uncertain.delete(this.uncertain.keys().next().value!);
      throw new UncertainPairAttempt(message, diagnostic);
    }
  }
}

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
  pairLedger?: PairAttemptLedger;
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
  return groupLanSearchNodes(snapshot.lanSearch?.nodes ?? []).filter(
    (node) => !ids.has(node.nodeId) && !addresses.has(node.address),
  );
}

export function lanSearchNavigation(snapshot: Snapshot): {
  searching: boolean;
  unseenCount: number;
} {
  const search = snapshot.lanSearch;
  const visibleNodes = unpairedLanNodes(snapshot);
  const unseen = new Set(search?.unseenKeys ?? []);
  return {
    searching: search?.phase === 'searching',
    unseenCount: visibleNodes.filter((node) =>
      [node, ...(node.endpoints ?? [])].some((endpoint) => unseen.has(endpoint.key)),
    ).length,
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
  pairLedger,
  onSettings,
  ownCode,
  onOwnCodeChange,
  manual,
  children,
}: NetworkPageProps): React.JSX.Element {
  const m = lanSearchMessages(locale);
  const legacy = lanDiscoveryMessages(locale);
  const theme = useTheme();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const id = useId();
  const [manualOpen, setManualOpen] = useState(false);
  const [selected, setSelected] = useState<Readonly<LanSearchNode> | null>(null);
  const [addressChoice, setAddressChoice] = useState('auto');
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
  const [localPairLedger] = useState(() => new PairAttemptLedger());
  const ledger = pairLedger ?? localPairLedger;
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
    () =>
      unpairedLanNodes(snapshot).filter(
        (node) =>
          ![node, ...(node.endpoints ?? [])].some((endpoint) =>
            authenticatedAddresses.has(endpoint.address),
          ),
      ),
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
    observerGeneration.current++;
    if (!canObserve || typeof IntersectionObserver === 'undefined') return;
    const known = new Set(nodes.map((node) => node.key));
    const unseen = new Set(search?.unseenKeys ?? []);
    const runId = search?.runId;
    const row = [...known].map((key) => rowRefs.current.get(key)).find(Boolean);
    const scrollport = row?.closest('main') ?? null;
    const header = scrollport?.querySelector(':scope > header') ?? null;
    const geometry = () => {
      if (!scrollport) return { inset: 0, stamp: `${window.innerWidth},${window.innerHeight}` };
      const bounds = scrollport.getBoundingClientRect();
      const cover = header?.getBoundingClientRect();
      const top = bounds.top + scrollport.clientTop;
      const bottom = top + scrollport.clientHeight;
      const inset =
        cover && header && getComputedStyle(header).position === 'sticky'
          ? Math.max(0, Math.min(bottom, cover.bottom) - Math.max(top, cover.top))
          : 0;
      return {
        inset,
        stamp: [
          bounds.left,
          top,
          scrollport.clientWidth,
          scrollport.clientHeight,
          cover?.top,
          cover?.bottom,
          inset,
        ].join(','),
      };
    };
    let observer: IntersectionObserver | undefined;
    let disposed = false;
    const observeFreshGeometry = () => {
      const generation = ++observerGeneration.current;
      observer?.disconnect();
      if (disposed || !observationGate.current) return;
      const measured = geometry();
      observer = new IntersectionObserver(
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
          // A queued intersection may predate the header's ResizeObserver delivery.
          if (geometry().stamp !== measured.stamp) {
            observeFreshGeometry();
            return;
          }
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
          const exact = [...new Set(keys)]
            .filter((key) => {
              const row = rowRefs.current.get(key);
              return row?.isConnected && !row.closest('[aria-hidden="true"]');
            })
            .slice(0, 128);
          if (!exact.length) return;
          exact.forEach((key) => pendingAcknowledgements.current.add(key));
          void invoke('ackLanSearch', { keys: exact })
            .catch((error: unknown) => {
              if (mounted.current)
                setDiagnostic(error instanceof Error ? error.message : String(error));
            })
            .finally(() => exact.forEach((key) => pendingAcknowledgements.current.delete(key)));
        },
        { root: scrollport, rootMargin: `${-measured.inset}px 0px 0px 0px`, threshold: 0.5 },
      );
      for (const key of known) {
        const row = rowRefs.current.get(key);
        if (row && !row.closest('[aria-hidden="true"]')) observer.observe(row);
      }
    };
    // Observe only row ancestors. Modal exit needs new intersections, not cached entries.
    const ancestors = new Set<Element>();
    for (const key of known) {
      let ancestor: Element | null = rowRefs.current.get(key) ?? null;
      while (ancestor) {
        ancestors.add(ancestor);
        ancestor = ancestor.parentElement;
      }
    }
    const modalChanges = new MutationObserver(observeFreshGeometry);
    for (const ancestor of ancestors)
      modalChanges.observe(ancestor, { attributes: true, attributeFilter: ['aria-hidden'] });
    const resizing = new ResizeObserver(observeFreshGeometry);
    if (scrollport) resizing.observe(scrollport);
    if (header) resizing.observe(header);
    observeFreshGeometry();
    return () => {
      disposed = true;
      observerGeneration.current++;
      modalChanges.disconnect();
      resizing.disconnect();
      observer?.disconnect();
    };
  }, [canObserve, keySignature, unseenSignature, search?.runId, invoke]);

  const searchAction = async (stop: boolean) => {
    if (searchFence.current || !snapshot.running) return;
    searchFence.current = true;
    setSearchPending(true);
    setSearchError(false);
    setDiagnostic('');
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
    const input = Object.freeze({
      address,
      code: value,
      ...(!isManual && selected ? { expectedNodeId: selected.nodeId } : {}),
    });
    if (
      pairFence.current ||
      !snapshot.running ||
      !address.trim() ||
      !/^[A-HJ-NP-Z2-9]{8}$/.test(value) ||
      ledger.blocked(snapshot, input)
    )
      return;
    const request = ++attempt.current;
    const nodeId = snapshot.nodeId;
    pairFence.current = true;
    setPairPending(true);
    setPairError(null);
    setPairedNotice(false);
    try {
      await ledger.run(snapshot, input, m.uncertain, () => invoke('connectPeer', input));
      if (
        !mounted.current ||
        attempt.current !== request ||
        currentSnapshot.current.nodeId !== nodeId
      )
        return;
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
      const detail =
        error instanceof UncertainPairAttempt
          ? error.diagnostic
          : error instanceof Error
            ? error.message
            : String(error);
      const uncertain = uncertainPairFailure(error);
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
  const searchDiagnostic =
    diagnostic ||
    (search?.reason === 'no-interfaces'
      ? legacy.noInterfaces
      : search?.reason
        ? legacy.transportError
        : '');
  const selectedInput = selected && {
    address: addressChoice === 'auto' ? selected.address : addressChoice,
    code,
    expectedNodeId: selected.nodeId,
  };
  const blockedSelection = !!selectedInput && ledger.blocked(snapshot, selectedInput);
  const blockedManual = ledger.blocked(snapshot, { address: manual.address, code: manual.code });
  const selectionMissing =
    !!selectedInput &&
    !search?.nodes.some(
      (node) =>
        node.nodeId === selectedInput.expectedNodeId &&
        [node, ...(node.endpoints ?? [])].some(
          (endpoint) => endpoint.address === selectedInput.address,
        ),
    );
  const diagnostics = (detail: string) => (
    <Box component="details" sx={{ mt: 1 }}>
      <summary>{m.details}</summary>
      <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
        {detail}
      </Typography>
    </Box>
  );
  const pairFailure = (blocked: boolean, input: PairAttemptInput) => {
    const detail = pairError?.detail || ledger.diagnostic(snapshot, input);
    return (
      (pairError || blocked) && (
        <Alert severity="error" role="alert">
          {pairError?.uncertain || blocked ? m.uncertain : legacy.failed}
          {detail && diagnostics(detail)}
        </Alert>
      )
    );
  };
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
        {snapshot.peers.length > 0 && (
          <Box component="section" aria-label={m.pairedTitle} data-testid="retained-paired-content">
            {children}
          </Box>
        )}
        <Box component="section" aria-labelledby={id + '-nearby-title'}>
          <Stack
            direction="row"
            useFlexGap
            spacing={1.5}
            sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 2 }}
          >
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
              <Typography id={id + '-nearby-title'} variant="h6" aria-live="polite">
                {searching ? m.searching : legacy.title}
              </Typography>
              {searching ? (
                <Box sx={{ display: 'grid', placeItems: 'center', width: 26, flexShrink: 0 }}>
                  <CircularProgress size={16} aria-hidden="true" />
                </Box>
              ) : (
                <Chip component="span" size="small" label={nodes.length.toLocaleString(locale)} />
              )}
            </Stack>
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{
                ml: 'auto',
                alignItems: 'center',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="text"
                onClick={() => {
                  setPairError(null);
                  setManualOpen(true);
                }}
                sx={{
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
              <Button
                variant={nodes.length || searching ? 'outlined' : 'contained'}
                disabled={!snapshot.running || searchPending}
                startIcon={searching ? <StopOutlined /> : <RefreshOutlined />}
                onClick={() => void searchAction(searching)}
                sx={{ minHeight: 44 }}
              >
                {searching ? m.stopSearch : m.searchAgain}
              </Button>
            </Stack>
          </Stack>
          <Collapse
            in={searching}
            timeout={reducedMotion ? 0 : theme.transitions.duration.short}
            easing={theme.transitions.easing.easeInOut}
            unmountOnExit
            aria-hidden={!searching}
          >
            <Box sx={{ pb: 2 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.75, fontVariantNumeric: 'tabular-nums' }}
              >
                {search &&
                  formatLanSearch(m.searchStatus, {
                    seconds: Math.ceil((duration - elapsed) / 1000),
                    count: search.foundCount,
                  })}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(elapsed / duration) * 100}
                aria-label={m.searchTime}
                aria-valuetext={elapsedText}
              />
            </Box>
          </Collapse>
          {(searchError || searchDiagnostic) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {m.unavailableHelp}
              {searchDiagnostic && diagnostics(searchDiagnostic)}
            </Alert>
          )}
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
                        <Typography variant="caption" color="text.secondary">
                          {networkInterfaceMessages(locale).unverified}
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
                        setSelected(Object.freeze({ ...node }));
                        setAddressChoice('auto');
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
            if (selectedInput) void connect(selectedInput.address, code, false);
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
              {selected && (
                <TextField
                  id={id + '-pair-address'}
                  select
                  fullWidth
                  label={networkInterfaceMessages(locale).addressLabel}
                  value={addressChoice}
                  disabled={pairPending}
                  onChange={(event) => {
                    setAddressChoice(event.target.value);
                    setPairError(null);
                  }}
                  slotProps={{
                    input: { notched: false },
                    inputLabel: { shrink: true, disableAnimation: true },
                    select: {
                      renderValue: (value) => (value === 'auto' ? m.autoAddress : String(value)),
                    },
                  }}
                >
                  <MenuItem value="auto">{m.autoAddress}</MenuItem>
                  {(selected.endpoints ?? [selected]).map((endpoint) => (
                    <MenuItem
                      key={endpoint.address}
                      value={endpoint.address}
                      sx={{ display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                    >
                      {endpoint.address} —{' '}
                      {endpoint.observedInRun && endpoint.lastSeenAgoMs < 30000
                        ? m.available
                        : m.previous}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              {selectedInput && pairFailure(blockedSelection, selectedInput)}
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
              {pairFailure(blockedManual, { address: manual.address, code: manual.code })}
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
