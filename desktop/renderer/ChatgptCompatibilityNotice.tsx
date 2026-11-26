import { useEffect, useSyncExternalStore } from 'react';
import { Alert, Box, FormControlLabel, Switch, Typography } from '@mui/material';
import type { ChatgptCompatibility } from '../shared/chatgpt-compatibility.js';
import type { DesktopSessionDeliveryModel } from './desktop-session-delivery-model.js';
import type { Locale } from './i18n/index.js';
import { sessionDeliveryMessages } from './i18n/session-delivery.js';

const delayNoticeCutoff = '26.1111.71704';
const versionOrder = new Intl.Collator('en', { numeric: true });

export function showsChatgptCompatibilityNotice(
  compatibility: ChatgptCompatibility | undefined,
  delivery: ReturnType<DesktopSessionDeliveryModel['getSnapshot']>,
): boolean {
  return (
    isAboveCutoff(compatibility?.version) &&
    (delivery.notice === 'configuration-required' ||
      (!delivery.notice && delivery.known?.state === 'ready'))
  );
}

function isAboveCutoff(version?: string) {
  return (
    !!version &&
    /^\d{1,4}\.\d{1,5}\.\d{1,5}$/.test(version) &&
    versionOrder.compare(version, delayNoticeCutoff) > 0
  );
}

export function useChatgptCompatibilityNotice(
  model: DesktopSessionDeliveryModel,
  compatibility?: ChatgptCompatibility,
) {
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const newer = isAboveCutoff(compatibility?.version);
  useEffect(() => {
    if (newer) model.load();
  }, [model, newer]);
  return showsChatgptCompatibilityNotice(compatibility, state);
}

export function ChatgptCompatibilityNotice({
  model,
  locale,
  marginTop,
  disabled,
  showSwitch = false,
  onConnect,
}: {
  model: DesktopSessionDeliveryModel;
  locale: Locale;
  marginTop?: string;
  disabled?: boolean;
  showSwitch?: boolean;
  onConnect?: () => void;
}) {
  const { known, notice, issue, busy } = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const profile = !notice && known?.state === 'ready' ? known.profile : undefined;
  const copy = sessionDeliveryMessages[locale];
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
      <Typography variant="body2">{copy.offWarning}</Typography>
      {showSwitch && (
        <FormControlLabel
          sx={{ ml: 0, mr: 0 }}
          label={copy.label}
          control={
            <Switch
              checked={false}
              disabled={busy || disabled || (!profile && !onConnect)}
              onChange={() => {
                if (!profile) {
                  onConnect?.();
                  return;
                }
                const target = document.activeElement;
                const card = target?.closest<HTMLElement>('[data-chatgpt-restart-focus]');
                void model.change('enable', profile).then(() => {
                  if (
                    model.getSnapshot().known?.state === 'enabled' &&
                    (document.activeElement === target || document.activeElement === document.body)
                  )
                    requestAnimationFrame(() => {
                      if (
                        document.activeElement === target ||
                        document.activeElement === document.body
                      )
                        card?.focus();
                    });
                });
              }}
            />
          }
        />
      )}
      {issue && (
        <Box role="alert" sx={{ typography: 'body2' }}>
          {issue === 'close-required' ? copy.quitBeforeChange : copy[issue]}
        </Box>
      )}
    </Alert>
  );
}
