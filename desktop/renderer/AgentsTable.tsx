import React from 'react';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Circle from '@mui/icons-material/Circle';
import type { AgentRow } from './agents-table-model.js';
import { t, type Locale } from './i18n/index.js';

export interface AgentsTableLabels {
  name: string;
  client: string;
  node: string;
  lastMessage: string;
  incoming: string;
  outgoing: string;
  actions: string;
  chat: (nickname: string) => string;
  remove: (nickname: string) => string;
  remoteRemoval: string;
}

export function AgentsTable({
  rows,
  labels,
  locale,
  nodeName,
  onChat,
  onDelete,
}: {
  rows: AgentRow[];
  labels: AgentsTableLabels;
  locale: Locale;
  nodeName: (id: string) => string;
  onChat: (agent: AgentRow) => void;
  onDelete: (agent: AgentRow) => void;
}): React.JSX.Element {
  return (
    <TableContainer component={Paper}>
      <Table
        data-testid="agents-table"
        aria-label={t(locale, 'agentsTitle')}
        sx={{ minWidth: 720, '& td, & th': { overflowWrap: 'anywhere' } }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{labels.name}</TableCell>
            <TableCell>{labels.client}</TableCell>
            <TableCell>{labels.node}</TableCell>
            <TableCell>{labels.lastMessage}</TableCell>
            <TableCell align="right">{labels.incoming}</TableCell>
            <TableCell align="right">{labels.outgoing}</TableCell>
            <TableCell align="right">{labels.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((agent) => (
            <TableRow key={agent.id} data-testid="agent-row" data-agent-id={agent.id} hover>
              <TableCell component="th" scope="row">
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {agent.online && (
                    <Tooltip title={t(locale, 'directoryOnline')}>
                      <Circle
                        data-testid="agent-online"
                        role="img"
                        aria-label={t(locale, 'directoryOnline')}
                        sx={{ color: 'success.main', fontSize: 10, flexShrink: 0 }}
                      />
                    </Tooltip>
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 650 }}>
                    {agent.nickname}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell>{agent.client}</TableCell>
              <TableCell>
                <Typography variant="body2">{nodeName(agent.nodeId)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(locale, agent.local ? 'agentsLocalTitle' : 'agentsRemoteTitle')}
                </Typography>
              </TableCell>
              <TableCell>
                {agent.lastMessageAt ? new Date(agent.lastMessageAt).toLocaleString(locale) : ''}
              </TableCell>
              <TableCell align="right">{agent.incomingCount}</TableCell>
              <TableCell align="right">{agent.outgoingCount}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Tooltip title={labels.chat(agent.nickname)}>
                  <IconButton
                    aria-label={labels.chat(agent.nickname)}
                    onClick={() => onChat(agent)}
                  >
                    <ChatBubbleOutline fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={agent.local ? labels.remove(agent.nickname) : labels.remoteRemoval}>
                  <Box component="span">
                    <IconButton
                      color="error"
                      disabled={!agent.local}
                      aria-label={labels.remove(agent.nickname)}
                      onClick={() => onDelete(agent)}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Box>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={7} sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                {t(locale, 'agentEmptyPrompt')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
