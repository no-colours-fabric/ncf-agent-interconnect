import React, { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { attachmentMessages } from './i18n/attachments.js';
import { t, type Locale } from './i18n/index.js';

type CleanupKind = 'sources' | 'received';
type CleanupResult = { removed: number; preserved: number };

export function AttachmentCleanup({
  locale,
  invoke,
}: {
  locale: Locale;
  invoke: (method: string, params: { kind: CleanupKind }) => Promise<CleanupResult>;
}): React.JSX.Element {
  const messages = attachmentMessages(locale);
  const [selection, setSelection] = useState<CleanupKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CleanupResult | 'error' | null>(null);
  const confirm = async () => {
    if (!selection || busy) return;
    setBusy(true);
    setSelection(null);
    setOutcome(null);
    try {
      setOutcome(await invoke('cleanTemporaryAttachments', { kind: selection }));
    } catch {
      setOutcome('error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack component="section" aria-labelledby="temporary-attachments-title" spacing={1.5}>
      <Typography id="temporary-attachments-title" component="h2" variant="h6">
        {messages.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {messages.help}
      </Typography>
      <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" disabled={busy} onClick={() => setSelection('sources')}>
          {messages.sources}
        </Button>
        <Button variant="outlined" disabled={busy} onClick={() => setSelection('received')}>
          {messages.received}
        </Button>
      </Stack>
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
      <Dialog
        open={selection !== null}
        onClose={() => setSelection(null)}
        aria-labelledby="attachment-cleanup-confirm-title"
      >
        <DialogTitle id="attachment-cleanup-confirm-title">
          {selection && messages[selection]}
        </DialogTitle>
        <DialogContent>
          <Typography>{messages.help}</Typography>
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => setSelection(null)}>
            {t(locale, 'btnCancel')}
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirm()}>
            {messages.confirm}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
