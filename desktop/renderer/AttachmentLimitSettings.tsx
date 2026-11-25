import React, { useState } from 'react';
import {
  Alert,
  Button,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import {
  attachmentLimitSchema,
  defaultAttachmentLimitMiB,
  type AttachmentLimit,
} from '../shared/attachment-limit.js';
import { attachmentLimitMessages } from './i18n/attachment-limit.js';
import { t, type Locale } from './i18n/index.js';

type LimitDraft = { unlimited: boolean; size: string };

export function AttachmentLimitSettings({
  locale,
  limit,
  save,
}: {
  locale: Locale;
  limit: AttachmentLimit;
  save: (value: AttachmentLimit) => Promise<void>;
}): React.JSX.Element {
  const messages = attachmentLimitMessages(locale);
  const [draft, setDraft] = useState<LimitDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<'saved' | 'error' | null>(null);
  const { size, unlimited } = draft ?? {
    size: String(limit ?? defaultAttachmentLimitMiB),
    unlimited: limit === null,
  };
  const parsed = attachmentLimitSchema.safeParse(
    unlimited ? null : /^[1-9]\d*$/.test(size) ? Number(size) : undefined,
  );
  const invalid = !unlimited && !parsed.success;
  const set = (next: LimitDraft) => {
    setDraft(next);
    setOutcome(null);
  };
  const submit = async () => {
    if (busy || !parsed.success || parsed.data === limit) return;
    setBusy(true);
    setOutcome(null);
    try {
      await save(parsed.data);
      setDraft(null);
      setOutcome('saved');
    } catch {
      setOutcome('error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack
      component="form"
      aria-labelledby="attachment-limit-title"
      spacing={1.5}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Typography id="attachment-limit-title" component="h2" variant="h6">
        {messages.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {messages.help}
      </Typography>
      <FormControlLabel
        label={messages.unlimited}
        control={
          <Switch
            checked={unlimited}
            disabled={busy}
            onChange={(_, next) => set({ size, unlimited: next })}
          />
        }
      />
      {!unlimited && (
        <TextField
          label={messages.size}
          value={size}
          disabled={busy}
          onChange={(event) => set({ size: event.target.value, unlimited: false })}
          error={invalid}
          helperText={invalid ? messages.invalid : undefined}
          slotProps={{
            inputLabel: { shrink: true, disableAnimation: true },
            htmlInput: { inputMode: 'numeric' },
          }}
        />
      )}
      <Button
        type="submit"
        variant="outlined"
        sx={{ alignSelf: 'flex-start' }}
        disabled={busy || !parsed.success || parsed.data === limit}
      >
        {t(locale, 'btnSave')}
      </Button>
      {outcome === 'error' && <Alert severity="error">{messages.failed}</Alert>}
      {outcome === 'saved' && (
        <Typography variant="body2" role="status">
          {t(locale, 'settingsSaved')}
        </Typography>
      )}
    </Stack>
  );
}
