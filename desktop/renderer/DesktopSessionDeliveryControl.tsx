import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, Switch, Typography } from '@mui/material';
import {
  configurationProfile,
  type DesktopSessionDelivery,
  type DeliveryAction,
  type DeliveryIssue,
} from '../shared/desktop-session-delivery.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import type { Locale } from './i18n/index.js';
import { sessionDeliveryMessages } from './i18n/session-delivery.js';

type Verified = Extract<DesktopSessionDelivery, { profile: string }>;
type Notice = Exclude<DesktopSessionDelivery, Verified>['state'];

export function DesktopSessionDeliveryControl({
  invoke,
  locale,
  configuration,
  configured,
  pending,
  onPendingChange,
  refresh,
  applyIssue,
  clearIssue,
  formBusy,
}: {
  invoke: McpSetupInvoke;
  locale: Locale;
  configuration: string;
  configured: boolean;
  pending: boolean;
  onPendingChange: (value: boolean) => void;
  refresh: number;
  applyIssue?: DeliveryIssue;
  clearIssue: () => void;
  formBusy: boolean;
}) {
  const [known, setKnown] = useState<Verified | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const copy = sessionDeliveryMessages[locale];
  const request = useCallback(
    async (action: DeliveryAction, profile?: string) => {
      const id = ++sequence.current;
      setBusy(true);
      try {
        const result = await invoke<DesktopSessionDelivery>(
          'desktopSessionDelivery',
          action === 'status' ? { action } : { action, profile },
        );
        if (id !== sequence.current) return;
        if ('profile' in result) {
          setKnown(result);
          setNotice(null);
        } else {
          setNotice(result.state);
        }
      } catch {
        if (id === sequence.current) setNotice('unavailable');
      } finally {
        if (id === sequence.current) setBusy(false);
      }
    },
    [invoke],
  );
  useEffect(() => {
    setKnown(null);
    setNotice(null);
    void request('status');
    return () => {
      sequence.current++;
    };
  }, [request, refresh]);
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
  const visibleNotice = notice ?? applyIssue;
  return (
    <Box sx={{ gridColumn: '1 / -1', mt: 1 }}>
      {known && (
        <>
          <FormControlLabel
            control={
              <Switch
                checked={known.state === 'enabled' && known.profile === profile}
                disabled={
                  busy || formBusy || !profile || notice === 'unavailable' || notice === 'conflict'
                }
                onChange={() => {
                  clearIssue();
                  void request(
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
                void request('status');
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
