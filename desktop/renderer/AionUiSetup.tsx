import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { AionUiApplicationState } from '../shared/aionui.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import type { McpSetupStatus } from '../shared/mcp-setup.js';
import type { McpSetupMessages } from './mcp-setup-messages.js';
import { designTokens, surfaceSx } from './theme.js';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import RemoveCircleOutlineOutlined from '@mui/icons-material/RemoveCircleOutlineOutlined';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';

function InlineAction({
  template,
  label,
  onClick,
}: {
  template: string;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  const [before, after = ''] = template.split('{action}');
  return (
    <Typography variant="body2" data-testid="aionui-step-hint">
      {before}
      <Link
        component="button"
        type="button"
        aria-label={label}
        onClick={onClick}
        sx={{ fontSize: 'inherit' }}
      >
        {label}
        <Box component="span" aria-hidden="true" sx={{ font: 'inherit', whiteSpace: 'nowrap' }}>
          {' →'}
        </Box>
      </Link>
      {after}
    </Typography>
  );
}

export function AionUiAuthorization({
  invoke,
  messages: m,
  renderContent,
  mcpState,
  onConfigureMcp,
}: {
  invoke: McpSetupInvoke;
  messages: McpSetupMessages;
  renderContent?: (content: React.ReactNode, complete: boolean) => React.ReactNode;
  mcpState?: McpSetupStatus['state'];
  onConfigureMcp?: () => void;
}): React.JSX.Element {
  const [status, setStatus] = useState<AionUiApplicationState>();
  const [url, setUrl] = useState('http://127.0.0.1:25808');
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [statusFailed, setStatusFailed] = useState(false);
  const revision = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void invoke<AionUiApplicationState>('aionUiStatus')
        .then((state) => {
          if (active) {
            setStatus(state);
            setStatusFailed(false);
          }
        })
        .catch(() => {
          if (active) {
            setStatusFailed(true);
            setError(true);
          }
        });
    };
    refresh();
    const off = window.interconnect.onChange(refresh);
    return () => {
      active = false;
      revision.current++;
      if (pending.current) void invoke('aionUiCancelPair').catch(() => {});
      off();
    };
  }, [invoke]);
  const cancel = () => {
    revision.current++;
    if (pending.current) void invoke('aionUiCancelPair').catch(() => {});
    pending.current = false;
    setCode('');
    setOpen(false);
    setBusy(false);
    setError(false);
  };
  const pair = async () => {
    const current = ++revision.current;
    setBusy(true);
    pending.current = true;
    setError(false);
    const input = { url, code };
    setCode('');
    try {
      await invoke('aionUiPair', input);
      const state = await invoke<AionUiApplicationState>('aionUiStatus');
      if (current === revision.current) {
        setStatus(state);
        setStatusFailed(false);
        setSuccess(true);
      }
    } catch {
      if (current === revision.current) setError(true);
    } finally {
      if (current === revision.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const openAccess = () => {
    setUrl(status?.url ?? url);
    setCode('');
    setError(false);
    setSuccess(false);
    setOpen(true);
  };
  const embedded = !!renderContent;
  const knownStatus = statusFailed ? undefined : status;
  const BridgeIcon = !knownStatus
    ? HelpOutlineOutlined
    : knownStatus.bridgeConnected
      ? CheckCircleOutlineOutlined
      : RemoveCircleOutlineOutlined;
  const accessReady = knownStatus?.state === 'paired';
  const mcpReady = mcpState === 'configured';
  const bridgeReady = !!knownStatus?.bridgeConnected;
  const complete = accessReady && mcpReady && bridgeReady;
  const activeStep =
    !knownStatus || !mcpState || mcpState === 'unavailable'
      ? -1
      : !accessReady
        ? 0
        : !mcpReady
          ? 1
          : !bridgeReady
            ? 2
            : 3;
  const content = (
    <Box
      component={embedded ? 'div' : Paper}
      sx={embedded ? undefined : { ...surfaceSx('soft'), p: 3 }}
      data-testid="aionui-authorization"
    >
      <Stack spacing={2}>
        {(!embedded || complete) && (
          <Box
            data-testid="aionui-status-facts"
            sx={{
              display: 'grid',
              gridTemplateColumns: embedded ? 'repeat(2, minmax(0, 1fr))' : '1fr',
              gap: 2,
            }}
          >
            <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
              <Typography variant={embedded ? 'caption' : 'subtitle2'} color="text.secondary">
                {embedded ? m.statusAuthorization : m.aionPairTitle}
              </Typography>
              <Chip
                size="small"
                label={
                  !knownStatus
                    ? statusFailed
                      ? m.unavailable
                      : m.checking
                    : knownStatus.state === 'paired'
                      ? m.aionPaired
                      : knownStatus.state === 'revoked'
                        ? m.aionRevoked
                        : m.aionNotPaired
                }
                color={knownStatus?.state === 'paired' ? 'success' : 'default'}
                data-testid="aionui-authorization-status"
                variant="outlined"
                icon={
                  <Box
                    component="span"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: knownStatus?.state === 'paired' ? 'success.main' : 'text.disabled',
                      boxShadow: knownStatus?.state === 'paired' ? designTokens.statusGlow : 'none',
                    }}
                  />
                }
                sx={{
                  maxWidth: '100%',
                  border: 0,
                  color: knownStatus?.state === 'paired' ? 'success.main' : 'text.secondary',
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                  '& .MuiChip-icon': { ml: 0, mr: 1 },
                  '& .MuiChip-label': { pl: 0, pr: 0 },
                }}
              />
              {status?.state === 'paired' && (
                <Typography
                  variant="body2"
                  data-testid="aionui-authorization-url"
                  sx={{ overflowWrap: 'anywhere', maxWidth: '100%' }}
                >
                  {status.url}
                </Typography>
              )}
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                {m.statusLiveBridge}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <BridgeIcon
                  sx={{
                    fontSize: 18,
                    mt: '1px',
                    flexShrink: 0,
                    color: knownStatus?.bridgeConnected ? 'success.main' : 'text.secondary',
                  }}
                />
                <Typography variant="body2" data-testid="aionui-bridge-status">
                  {!knownStatus
                    ? statusFailed
                      ? m.unavailable
                      : m.checking
                    : knownStatus.bridgeConnected
                      ? m.aionBridgeConnected
                      : m.aionBridgeDisconnected}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        )}
        {!embedded && (
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '76ch' }}>
            {m.aionPairHelp}
          </Typography>
        )}
        {!complete && (
          <Stepper
            nonLinear
            alternativeLabel
            activeStep={activeStep}
            data-testid="aionui-connection-steps"
            sx={{
              maxWidth: 680,
              py: 0.5,
              '& .MuiStepLabel-label': { fontSize: 12, mt: 0.5 },
              '& .MuiStepIcon-root': { fontSize: 20 },
            }}
          >
            <Step completed={accessReady}>
              <StepLabel>{m.statusAuthorization}</StepLabel>
            </Step>
            <Step completed={mcpReady}>
              <StepLabel>{m.statusMcpConfig}</StepLabel>
            </Step>
            <Step completed={bridgeReady}>
              <StepLabel>{m.statusLiveBridge}</StepLabel>
            </Step>
          </Stepper>
        )}
        {!complete && activeStep === 0 && (
          <InlineAction
            template={m.aionAccessAction}
            label={m.aionConfigureAccess}
            onClick={openAccess}
          />
        )}
        {!complete && activeStep === 1 && (
          <InlineAction
            template={m.aionUpdateAction}
            label={m.aionConfigure}
            onClick={() => onConfigureMcp?.()}
          />
        )}
        {!complete && activeStep === 2 && (
          <Typography variant="body2" data-testid="aionui-reconnect-next">
            {m.aionRestartAction}
          </Typography>
        )}
        {!complete && activeStep === -1 && (
          <Typography variant="body2" data-testid="aionui-step-hint">
            {statusFailed || mcpState === 'unavailable' ? m.unavailable : m.checking}
          </Typography>
        )}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button variant="outlined" data-testid="aionui-configure-access" onClick={openAccess}>
            {m.aionConfigureAccess}
          </Button>
          {status?.state === 'paired' && (
            <Button
              onClick={() => {
                void invoke('aionUiDisconnect')
                  .then(() => invoke<AionUiApplicationState>('aionUiStatus'))
                  .then((state) => {
                    setStatus(state);
                    setStatusFailed(false);
                  })
                  .catch(() => setError(true));
              }}
            >
              {m.aionDisconnect}
            </Button>
          )}
        </Stack>
        {error && !open && <Alert severity="error">{m.aionFailure}</Alert>}
      </Stack>
    </Box>
  );
  return (
    <>
      {renderContent ? (
        renderContent(content, complete)
      ) : (
        <Stack spacing={2}>
          {content}
          <Typography variant="subtitle2" component="h3">
            {m.aionMcpTitle}
          </Typography>
        </Stack>
      )}
      <Dialog
        open={open}
        onClose={cancel}
        fullWidth
        maxWidth="sm"
        aria-labelledby="aionui-access-title"
        slotProps={{
          paper: {
            sx: {
              width: 640,
              maxWidth: 'calc(100% - 48px)',
              height: 'min(520px, calc(100dvh - 64px))',
            },
          },
        }}
      >
        <DialogTitle id="aionui-access-title">{m.aionPairTitle}</DialogTitle>
        <DialogContent sx={{ scrollbarGutter: 'stable' }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>{m.aionPairHelp}</Typography>
            <TextField
              label={m.aionAddress}
              value={url}
              disabled={busy || success}
              onChange={(event) => setUrl(event.target.value)}
              fullWidth
              slotProps={{ htmlInput: { 'data-testid': 'aionui-address' } }}
            />
            <TextField
              label={m.aionCode}
              type="password"
              autoComplete="off"
              value={code}
              disabled={busy || success}
              onChange={(event) => setCode(event.target.value)}
              fullWidth
              slotProps={{ htmlInput: { maxLength: 100, 'data-testid': 'aionui-code' } }}
            />
            <Box sx={{ minHeight: 72 }} aria-live="polite">
              {error && <Alert severity="error">{m.aionFailure}</Alert>}
              {success && <Alert severity="success">{m.aionPaired}</Alert>}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ minHeight: 56, gap: 1, flexShrink: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flex: 1, minWidth: 0, height: 24, alignItems: 'center' }}
            role="status"
            aria-live="polite"
            data-testid="aionui-pair-progress"
            data-busy={busy}
          >
            <Box sx={{ width: 20, height: 20 }}>{busy && <CircularProgress size={18} />}</Box>
            <Typography variant="body2" noWrap>
              {busy ? m.aionConfirm : ''}
            </Typography>
          </Stack>
          <Button onClick={cancel}>{success ? m.close : m.cancel}</Button>
          {!success && (
            <Button
              variant="contained"
              disabled={busy || !code.trim() || !url.trim()}
              onClick={() => void pair()}
            >
              {m.aionPair}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
