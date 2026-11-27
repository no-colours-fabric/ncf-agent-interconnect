import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Alert, Box, FormControlLabel, Switch, Typography } from '@mui/material';
import type { ApplicationDiscoverySnapshot } from '../shared/application-discovery.js';
import type { ChatgptCompatibility } from '../shared/chatgpt-compatibility.js';
import { DesktopSessionDeliveryProgress } from './DesktopSessionDeliveryControl.js';
import type {
  DesktopSessionDeliveryModel,
  PendingDeliveryAction,
} from './desktop-session-delivery-model.js';
import type { Locale } from './i18n/index.js';
import { sessionDeliveryMessages } from './i18n/session-delivery.js';

const delayNoticeCutoff = '26.1111.71704';
const versionOrder = new Intl.Collator('en', { numeric: true });

export function chatgptCompatibilityWarning(
  compatibility: ChatgptCompatibility | undefined,
  delivery: ReturnType<DesktopSessionDeliveryModel['getSnapshot']>,
): 'off' | 'version-unknown' | undefined {
  if (delivery.notice !== 'configuration-required' && delivery.known?.state !== 'ready') return;
  const version = compatibility?.version;
  if (!version || !/^\d{1,4}\.\d{1,5}\.\d{1,5}$/.test(version)) return 'version-unknown';
  return versionOrder.compare(version, delayNoticeCutoff) > 0 ? 'off' : undefined;
}

export function useChatgptDeliveryPresentation(
  model: DesktopSessionDeliveryModel,
  discovery?: ApplicationDiscoverySnapshot,
) {
  const detected = discovery?.applications.some(
    ({ client, status }) => client === 'codex' && status === 'detected',
  );
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  useEffect(() => {
    if (detected) model.load();
  }, [model, detected]);
  return {
    state,
    warning: detected
      ? chatgptCompatibilityWarning(discovery?.chatgptCompatibility, state)
      : undefined,
  };
}

export function ChatgptDeliveryIndicator({
  locale,
  action,
}: {
  locale: Locale;
  action: PendingDeliveryAction;
}) {
  const copy = sessionDeliveryMessages[locale];
  return (
    <Box role="status" sx={{ display: 'flex', alignItems: 'center' }}>
      <DesktopSessionDeliveryProgress locale={locale} action={action} />
      <Typography variant="body2">{action === 'disable' ? copy.disabling : copy.label}</Typography>
    </Box>
  );
}

export function ChatgptCompatibilityNotice({
  model,
  locale,
  warning,
  marginTop,
  disabled,
  showSwitch = false,
  onConnect,
}: {
  model: DesktopSessionDeliveryModel;
  locale: Locale;
  warning: 'off' | 'version-unknown';
  marginTop?: string;
  disabled?: boolean;
  showSwitch?: boolean;
  onConnect?: () => void;
}) {
  const { known, notice, issue, busy, pendingAction } = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const profile = !notice && known?.state === 'ready' ? known.profile : undefined;
  const copy = sessionDeliveryMessages[locale];
  const switchInput = useRef<HTMLInputElement>(null);
  const visibleIssue = issue ?? (notice === 'configuration-required' ? undefined : notice);
  return (
    <Alert
      data-testid="chatgpt-delivery-off"
      severity="warning"
      role="group"
      aria-label={copy.label}
      sx={{
        gridColumn: '1 / -1',
        marginTop,
        minWidth: 0,
        flexWrap: 'wrap',
        '& .MuiAlert-message': { flex: '1 1 105px', minWidth: 0, overflowWrap: 'anywhere' },
      }}
    >
      <Typography variant="body2">
        {warning === 'off'
          ? copy.offWarning
          : copy.unknownVersionWarning.replace('{version}', delayNoticeCutoff)}
      </Typography>
      {showSwitch && (
        <FormControlLabel
          sx={{ ml: 0, mr: 0 }}
          label={copy.label}
          control={
            pendingAction ? (
              <DesktopSessionDeliveryProgress locale={locale} action={pendingAction} />
            ) : (
              <Switch
                slotProps={{ input: { ref: switchInput } }}
                checked={false}
                disabled={
                  busy ||
                  disabled ||
                  (!profile && (notice !== 'configuration-required' || !onConnect))
                }
                onChange={() => {
                  if (!profile) {
                    onConnect?.();
                    return;
                  }
                  const target = document.activeElement;
                  const card = target?.closest<HTMLElement>('[data-chatgpt-restart-focus]');
                  void model.change('enable', profile).then(() => {
                    if (!model.getSnapshot().restartPending)
                      requestAnimationFrame(() => {
                        if (
                          document.activeElement === target ||
                          document.activeElement === document.body
                        )
                          (switchInput.current ?? card)?.focus();
                      });
                  });
                }}
              />
            )
          }
        />
      )}
      {visibleIssue && visibleIssue !== 'unsupported' && (
        <Box role="alert" sx={{ typography: 'body2' }}>
          {visibleIssue === 'close-required' ? copy.quitBeforeChange : copy[visibleIssue]}
        </Box>
      )}
    </Alert>
  );
}
