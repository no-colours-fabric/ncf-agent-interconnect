import React, { useEffect, useId, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  receivedAttachmentAges,
  type ReceivedAttachmentAge,
  type ReceivedAttachmentCleanupResult,
  type ReceivedAttachmentScope,
  type ReceivedAttachmentUsage,
  type RemoveReceivedAttachments,
} from '../shared/attachment-cleanup.js';
import { formatAttachmentStorage } from './attachment-storage-format.js';
import { attachmentMessages } from './i18n/attachments.js';
import { t, type Locale } from './i18n/index.js';

type Invoke = <T>(method: string, params: unknown) => Promise<T>;

export function ReceivedAttachmentCleanupDialog({
  locale,
  target,
  onClose,
  onRemove,
  busy,
}: {
  locale: Locale;
  target: (ReceivedAttachmentScope & { nickname?: string }) | null;
  onClose: () => void;
  onRemove: (input: RemoveReceivedAttachments) => void;
  busy: boolean;
}): React.JSX.Element {
  const titleId = useId();
  const helpId = useId();
  const messages = attachmentMessages(locale);
  const [olderThanDays, setAge] = useState<ReceivedAttachmentAge>(30);
  return (
    <Dialog
      open={target !== null}
      onClose={busy ? undefined : onClose}
      aria-labelledby={titleId}
      aria-describedby={helpId}
    >
      <DialogTitle id={titleId}>{messages.received}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography id={helpId}>{messages.help}</Typography>
          {target?.scope === 'agent' && target.nickname && (
            <Typography variant="subtitle1">{target.nickname}</Typography>
          )}
          <TextField
            select
            fullWidth
            slotProps={{ inputLabel: { shrink: true, disableAnimation: true } }}
            label={messages.olderThan}
            value={olderThanDays}
            onChange={(event) => {
              const selected = receivedAttachmentAges.find(
                (days) => String(days) === String(event.target.value),
              );
              if (selected) setAge(selected);
            }}
            disabled={busy}
          >
            {receivedAttachmentAges.map((days) => (
              <MenuItem key={days} value={days}>
                {new Intl.NumberFormat(locale, {
                  style: 'unit',
                  unit: 'day',
                  unitDisplay: 'long',
                }).format(days)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button autoFocus onClick={onClose} disabled={busy}>
          {t(locale, 'btnCancel')}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={busy || !target}
          onClick={() => {
            if (!target) return;
            if (target.scope === 'all') onRemove({ scope: 'all', olderThanDays });
            else
              onRemove({
                scope: 'agent',
                key: target.key,
                incarnation: target.incarnation,
                olderThanDays,
              });
          }}
        >
          {messages.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function AttachmentCleanup({
  locale,
  invoke,
}: {
  locale: Locale;
  invoke: Invoke;
}): React.JSX.Element {
  const messages = attachmentMessages(locale);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<ReceivedAttachmentUsage | 'error' | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [outcome, setOutcome] = useState<ReceivedAttachmentCleanupResult | 'error' | null>(null);
  useEffect(() => {
    let active = true;
    void invoke<ReceivedAttachmentUsage>('receivedAttachmentUsage', {}).then(
      (value) => {
        if (active) setUsage(value);
      },
      () => {
        if (active) setUsage('error');
      },
    );
    return () => {
      active = false;
    };
  }, [invoke, refresh]);
  const confirm = async (input: RemoveReceivedAttachments) => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    try {
      setOutcome(await invoke<ReceivedAttachmentCleanupResult>('removeReceivedAttachments', input));
    } catch {
      setOutcome('error');
    } finally {
      setOpen(false);
      setBusy(false);
      setRefresh((previous) => previous + 1);
    }
  };
  return (
    <Stack component="section" aria-labelledby="received-attachments-title" spacing={1.5}>
      <Typography id="received-attachments-title" component="h2" variant="h6">
        {messages.title}
      </Typography>
      {usage === 'error' ? (
        <Alert severity="error">{messages.usageFailed}</Alert>
      ) : (
        usage && (
          <Typography variant="body2">
            {messages.usage.replace('{size}', formatAttachmentStorage(usage.totalBytes, locale))}
          </Typography>
        )
      )}
      <Button
        sx={{ alignSelf: 'flex-start' }}
        variant="outlined"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        {messages.received}
      </Button>
      {outcome === 'error' ? (
        <Alert severity="error">{messages.failed}</Alert>
      ) : (
        outcome && (
          <Typography role="status" variant="body2">
            {messages.result
              .replace('{removed}', outcome.removed.toLocaleString(locale))
              .replace('{preserved}', outcome.preserved.toLocaleString(locale))}
          </Typography>
        )
      )}
      <ReceivedAttachmentCleanupDialog
        locale={locale}
        target={open ? { scope: 'all' } : null}
        onClose={() => setOpen(false)}
        onRemove={(input) => void confirm(input)}
        busy={busy}
      />
    </Stack>
  );
}
