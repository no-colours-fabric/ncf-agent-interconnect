import React, { useMemo, useSyncExternalStore } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type {
  AgentClearInput,
  AgentClearResponse,
  AgentClearResult,
  AgentIdentity,
} from '../shared/contracts.js';
import { AgentClearFlow, type AgentClearState } from './agent-clear-model.js';
import { t, type Locale } from './i18n/index.js';

export function AgentClearControls({
  agents,
  selected,
  locale,
  invoke,
  onCleared,
}: {
  agents: AgentIdentity[];
  selected: string;
  locale: Locale;
  invoke: (input: AgentClearInput) => Promise<AgentClearResponse>;
  onCleared: (result: AgentClearResult, names: string[]) => void;
}): React.JSX.Element {
  const flow = useMemo(() => new AgentClearFlow(invoke), [invoke]);
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const all = state.input?.scope === 'all';
  return (
    <>
      <Stack
        direction="row"
        sx={{
          flexWrap: 'wrap',
          gap: 1,
          p: 1.5,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Button
          color="error"
          variant="outlined"
          data-testid="clear-selected-agent"
          disabled={!!state.busy || !agents.some((agent) => agent.nickname === selected)}
          onClick={() => {
            void flow.begin({ scope: 'agent', nickname: selected });
          }}
          sx={{ whiteSpace: 'nowrap', textAlign: 'left' }}
        >
          {t(locale, 'clearSelectedAgent')}
        </Button>
        <Button
          color="error"
          variant="outlined"
          data-testid="clear-all-local-agents"
          disabled={!!state.busy || !agents.length}
          onClick={() => {
            void flow.begin({ scope: 'all' });
          }}
          sx={{ whiteSpace: 'nowrap', textAlign: 'left' }}
        >
          {t(locale, 'clearAllLocalAgents')}
        </Button>
      </Stack>
      <Dialog
        open={state.open}
        onClose={() => flow.cancel()}
        fullWidth
        maxWidth="sm"
        aria-labelledby="agent-clear-title"
        slotProps={{
          paper: { sx: { m: 3, maxHeight: 'calc(100dvh - 48px)', overflow: 'hidden' } },
        }}
      >
        <DialogTitle id="agent-clear-title">
          {t(locale, all ? 'clearAllAgentsTitle' : 'clearAgentTitle')}
        </DialogTitle>
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          <AgentClearSummary state={state} locale={locale} />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
          <Button onClick={() => flow.cancel()} disabled={state.busy === 'confirm'}>
            {t(locale, 'btnCancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!!state.busy || !state.preview || state.preview.agentCount === 0}
            onClick={() => {
              void flow.confirm().then((result) => {
                if (result)
                  onCleared(result, state.preview?.targets.map((target) => target.nickname) ?? []);
              });
            }}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t(locale, all ? 'clearAllAgentsConfirm' : 'clearAgentConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function AgentClearSummary({
  state,
  locale,
}: {
  state: AgentClearState;
  locale: Locale;
}): React.JSX.Element {
  const all = state.input?.scope === 'all';
  return (
    <Stack
      spacing={2}
      sx={{
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'hidden',
        overflowWrap: 'anywhere',
        '& > :not(.agent-clear-targets)': { flexShrink: 0 },
      }}
    >
      <Typography>{t(locale, all ? 'clearAllAgentsWarning' : 'clearAgentWarning')}</Typography>
      <Alert severity="warning">{t(locale, 'clearIrreversible')}</Alert>
      {state.stale && <Alert severity="warning">{t(locale, 'clearPreviewStale')}</Alert>}
      {state.busy === 'preview' && <CircularProgress size={24} />}
      {state.preview && (
        <>
          <Typography>
            {t(locale, 'clearAllAgentCount', {
              agents: state.preview.agentCount,
              messages: state.preview.messageCount,
            })}
          </Typography>
          {all ? (
            <TableContainer
              className="agent-clear-targets"
              data-testid="agent-clear-targets"
              tabIndex={0}
              sx={{
                minHeight: 0,
                flex: '0 1 auto',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Table stickyHeader size="small" aria-label={t(locale, 'clearAllAgentsTitle')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t(locale, 'agentsColumnName')}</TableCell>
                    <TableCell align="right">{t(locale, 'agentsColumnMessages')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {state.preview.targets.map((target) => (
                    <TableRow key={target.nickname}>
                      <TableCell component="th" scope="row" sx={{ overflowWrap: 'anywhere' }}>
                        {target.nickname}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {target.messageCount.toLocaleString(locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            state.preview.targets.map((target) => (
              <Typography key={target.nickname} variant="body2">
                {t(locale, 'clearAgentCount', {
                  name: target.nickname,
                  count: target.messageCount,
                })}
              </Typography>
            ))
          )}
        </>
      )}
      {state.error && <Alert severity="error">{state.error}</Alert>}
    </Stack>
  );
}
