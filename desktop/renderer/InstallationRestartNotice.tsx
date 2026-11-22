import React, { useId } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import RestartAltOutlined from '@mui/icons-material/RestartAltOutlined';
import { applicationNames } from '../shared/application-discovery.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import { installationRestartMessages } from './i18n/installation-restart.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
import type { Locale } from './i18n/index.js';

const clients = ['codex', 'cursor', 'opencode', 'aionui', 'claude'] as const;

export function InstallationRestartNotice({
  open,
  locale,
  onClose,
}: {
  open: boolean;
  locale: Locale;
  onClose: () => void;
}): React.JSX.Element {
  const titleId = useId();
  const descriptionId = useId();
  const copy = installationRestartMessages(locale);
  const names = {
    ...applicationNames,
    opencode: `${applicationNames.opencode} v1 / v2`,
    aionui: applicationSetupMessages(locale).aionUiName,
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="installation-restart-notice"
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle component="div" sx={{ pb: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              color: 'warning.main',
              width: 40,
              height: 40,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <RestartAltOutlined aria-hidden="true" />
          </Box>
          <Typography id={titleId} component="h2" variant="h6">
            {copy.title}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography id={descriptionId} variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {copy.body}
        </Typography>
        <Stack component="ul" spacing={1} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {clients.map((client) => (
            <Stack
              component="li"
              direction="row"
              key={client}
              sx={{
                alignItems: 'center',
                gap: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1.5,
                p: 0.75,
              }}
            >
              <ClientLogo client={client} size={26} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {names[client]}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button autoFocus variant="contained" onClick={onClose} sx={{ minHeight: 44 }}>
          {copy.dismiss}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
