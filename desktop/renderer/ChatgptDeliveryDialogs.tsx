import { useSyncExternalStore } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import type { ApplicationSetupFlow } from './application-setup-model.js';
import type { Locale } from './i18n/index.js';
import { installationRestartMessages } from './i18n/installation-restart.js';
import { sessionDeliveryMessages } from './i18n/session-delivery.js';

export function ChatgptDeliveryDialogs({
  flow,
  locale,
  connectRestartPending,
}: {
  flow: ApplicationSetupFlow;
  locale: Locale;
  connectRestartPending: boolean;
}) {
  const model = flow.chatDelivery;
  const { queueWarningPending, restartPending } = useSyncExternalStore(
    model.subscribe,
    model.getSnapshot,
    model.getSnapshot,
  );
  const copy = sessionDeliveryMessages[locale];
  const restoreFocus = () =>
    requestAnimationFrame(() => {
      const pending = model.getSnapshot();
      if (
        pending.queueWarningPending ||
        pending.restartPending ||
        flow.getSnapshot().codex.restartNotice === 'pending'
      )
        return;
      const targets = [
        ...document.querySelectorAll<HTMLElement>('[data-chatgpt-restart-focus]'),
      ].filter(
        (element) => element.getClientRects().length && !element.closest('[aria-hidden="true"]'),
      );
      const target = targets.find((element) => element instanceof HTMLInputElement) ?? targets[0];
      target?.focus();
    });
  const dialog = (
    id: string,
    open: boolean,
    title: string,
    body: string,
    acknowledge: () => void,
  ) => (
    <Dialog
      open={open}
      disableRestoreFocus
      fullWidth
      maxWidth="xs"
      aria-labelledby={id + '-title'}
      aria-describedby={id + '-body'}
      slotProps={{ transition: { onExited: restoreFocus } }}
    >
      <DialogTitle id={id + '-title'}>{title}</DialogTitle>
      <DialogContent>
        <Typography id={id + '-body'} variant="body2" color="text.secondary">
          {body}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button autoFocus variant="contained" onClick={acknowledge}>
          {installationRestartMessages(locale).dismiss}
        </Button>
      </DialogActions>
    </Dialog>
  );
  return (
    <>
      {dialog(
        'chatgpt-delivery-queue-warning',
        queueWarningPending === true,
        copy.queueWarningTitle,
        copy.offWarning,
        () => model.acknowledgeQueueWarning(),
      )}
      {dialog(
        'chatgpt-connect-restart',
        !queueWarningPending && (restartPending === true || connectRestartPending),
        copy.connectRestartTitle,
        copy.restartInstruction,
        () => {
          model.acknowledgeRestart();
          flow.acknowledgeCodexRestart();
        },
      )}
    </>
  );
}
