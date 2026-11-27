import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material';
import { configurationProfile, type DeliveryIssue } from '../shared/desktop-session-delivery.js';
import type {
  DesktopSessionDeliveryModel,
  PendingDeliveryAction,
} from './desktop-session-delivery-model.js';
import type { Locale } from './i18n/index.js';
import { sessionDeliveryMessages } from './i18n/session-delivery.js';

export function DesktopSessionDeliveryProgress({
  locale,
  action,
}: {
  locale: Locale;
  action: PendingDeliveryAction;
}) {
  const copy = sessionDeliveryMessages[locale];
  return (
    <Box
      component="span"
      sx={{ width: 58, height: 38, display: 'inline-grid', placeItems: 'center' }}
    >
      <CircularProgress size={20} aria-label={action === 'disable' ? copy.disabling : copy.label} />
    </Box>
  );
}

export function DesktopSessionDeliveryControl({
  model,
  locale,
  configuration,
  configured,
  pending,
  onPendingChange,
  applyIssue,
  clearIssue,
  formBusy,
}: {
  model: DesktopSessionDeliveryModel;
  locale: Locale;
  configuration: string;
  configured: boolean;
  pending: boolean;
  onPendingChange: (value: boolean) => void;
  applyIssue?: DeliveryIssue;
  clearIssue: () => void;
  formBusy: boolean;
}) {
  const { known, notice, issue, busy, pendingAction } = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const switchInput = useRef<HTMLInputElement>(null);
  const copy = sessionDeliveryMessages[locale];
  const progress = pendingAction && (
    <DesktopSessionDeliveryProgress locale={locale} action={pendingAction} />
  );
  useEffect(() => model.load(), [model]);
  if (notice === 'unsupported' || (!known && !notice && !pendingAction)) return null;
  const profile = configurationProfile(configuration);
  const staged = !configured;
  if (staged && notice !== 'conflict')
    return (
      <Box sx={{ mt: 1 }}>
        <FormControlLabel
          label={copy.label}
          control={
            progress || (
              <Switch
                checked={pending}
                disabled={!profile || formBusy}
                onChange={(_, value) => onPendingChange(value)}
              />
            )
          }
        />
        <Typography variant="body2" color="text.secondary">
          {copy.offer}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {known?.requiresClosedChatGPT ? copy.quitBeforeChange : copy.connectRestart}
        </Typography>
      </Box>
    );
  const visibleNotice = notice ?? issue ?? applyIssue;
  return (
    <Box sx={{ gridColumn: '1 / -1', mt: 1 }}>
      {!known && progress}
      {known && (
        <>
          <FormControlLabel
            control={
              progress || (
                <Switch
                  slotProps={{
                    input: {
                      ref: switchInput,
                      role: 'switch',
                      ...{ 'data-chatgpt-restart-focus': '' },
                    },
                  }}
                  checked={known.state === 'enabled' && known.profile === profile}
                  disabled={
                    busy ||
                    formBusy ||
                    !profile ||
                    visibleNotice === 'unavailable' ||
                    visibleNotice === 'conflict'
                  }
                  onChange={() => {
                    if (!profile) return;
                    clearIssue();
                    const action =
                      known.state === 'enabled' && known.profile === profile ? 'disable' : 'enable';
                    void model.change(action, profile).then(() => {
                      const { queueWarningPending, restartPending } = model.getSnapshot();
                      if (!queueWarningPending && !restartPending)
                        requestAnimationFrame(() => {
                          if (document.activeElement === document.body)
                            switchInput.current?.focus();
                        });
                    });
                  }}
                />
              )
            }
            label={copy.label}
          />
          <Typography variant="body2" color="text.secondary">
            {copy[known.scope]}{' '}
            <Box component="code" sx={{ overflowWrap: 'anywhere' }}>
              {profile}
            </Box>
          </Typography>
          {!visibleNotice && (
            <Typography variant="body2" color="text.secondary">
              {known.requiresClosedChatGPT ? copy.quitBeforeChange : copy.restart}
            </Typography>
          )}
        </>
      )}
      {visibleNotice && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              disabled={busy}
              onClick={() => {
                clearIssue();
                void model.refresh();
              }}
            >
              {copy.checkStatus}
            </Button>
          }
        >
          {visibleNotice === 'close-required'
            ? copy.quitBeforeChange
            : visibleNotice === 'configuration-required'
              ? copy.unavailable
              : copy[visibleNotice]}
        </Alert>
      )}
    </Box>
  );
}
