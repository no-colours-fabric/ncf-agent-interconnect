import { useEffect, useSyncExternalStore } from 'react';
import { Alert, Box, Button, FormControlLabel, Switch, Typography } from '@mui/material';
import { configurationProfile, type DeliveryIssue } from '../shared/desktop-session-delivery.js';
import type { DesktopSessionDeliveryModel } from './desktop-session-delivery-model.js';
import type { Locale } from './i18n/index.js';
import { sessionDeliveryMessages } from './i18n/session-delivery.js';

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
  const { known, notice, issue, busy } = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const copy = sessionDeliveryMessages[locale];
  useEffect(() => model.load(), [model]);
  if (notice === 'unsupported' || (!known && !notice)) return null;
  const profile = configurationProfile(configuration);
  const staged = !configured;
  if (staged && notice !== 'conflict')
    return (
      <Box sx={{ mt: 1 }}>
        <FormControlLabel
          label={copy.label}
          control={
            <Switch
              checked={pending}
              disabled={!profile || formBusy}
              onChange={(_, value) => onPendingChange(value)}
            />
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
      {known && (
        <>
          <FormControlLabel
            control={
              <Switch
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
                  void model.change(
                    known.state === 'enabled' && known.profile === profile ? 'disable' : 'enable',
                    profile,
                  );
                }}
              />
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
