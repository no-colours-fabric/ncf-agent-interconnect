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
        sx={{ flexWrap: 'wrap', gap: 1, p: 1.5, flexShrink: 0, borderBottom: '1px solid #e2e7ec' }}
      >
        <Button
          color="error"
          variant="outlined"
          data-testid="clear-selected-agent"
          disabled={!!state.busy || !agents.some((agent) => agent.nickname === selected)}
          onClick={() => {
            void flow.begin({ scope: 'agent', nickname: selected });
          }}
          sx={{ whiteSpace: 'normal', textAlign: 'left' }}
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
          sx={{ whiteSpace: 'normal', textAlign: 'left' }}
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
      >
        <DialogTitle id="agent-clear-title">
          {t(locale, all ? 'clearAllAgentsTitle' : 'clearAgentTitle')}
        </DialogTitle>
        <DialogContent>
          <AgentClearSummary state={state} locale={locale} />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
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
            sx={{ whiteSpace: 'normal' }}
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
    <Stack spacing={2} sx={{ overflowWrap: 'anywhere' }}>
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
          {state.preview.targets.map((target) => (
            <Typography key={target.nickname} variant="body2">
              {t(locale, 'clearAgentCount', {
                name: target.nickname,
                count: target.messageCount,
              })}
            </Typography>
          ))}
        </>
      )}
      {state.error && <Alert severity="error">{state.error}</Alert>}
    </Stack>
  );
}
