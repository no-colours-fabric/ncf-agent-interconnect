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
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import Circle from '@mui/icons-material/Circle';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import ComputerOutlined from '@mui/icons-material/ComputerOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import type { AgentRow } from './agents-table-model.js';
import { t, type Locale } from './i18n/index.js';
import { designTokens } from './theme.js';

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
        size="small"
        sx={{
          minWidth: 680,
          '& td, & th': { overflowWrap: 'anywhere', verticalAlign: 'middle' },
          '& thead th': { whiteSpace: 'nowrap' },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell>{labels.name}</TableCell>
            <TableCell>{labels.client}</TableCell>
            <TableCell aria-hidden="true" sx={{ width: 36, px: 1 }} />
            <TableCell>{labels.node}</TableCell>
            <TableCell>{labels.lastMessage}</TableCell>
            <TableCell align="right">{t(locale, 'agentsColumnMessages')}</TableCell>
            <TableCell align="right">{labels.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((agent) => (
            <TableRow key={agent.id} data-testid="agent-row" data-agent-id={agent.id} hover>
              <TableCell
                component="th"
                scope="row"
                sx={{ whiteSpace: 'nowrap', overflowWrap: 'normal' }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {agent.online && (
                    <Tooltip title={t(locale, 'directoryOnline')}>
                      <Circle
                        data-testid="agent-online"
                        role="img"
                        aria-label={t(locale, 'directoryOnline')}
                        sx={{
                          color: 'success.main',
                          fontSize: 6,
                          flexShrink: 0,
                          filter: `drop-shadow(${designTokens.statusGlow})`,
                        }}
                      />
                    </Tooltip>
                  )}
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {agent.nickname}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', overflowWrap: 'normal' }}>
                {agent.client}
              </TableCell>
              <TableCell sx={{ width: 36, px: 1 }}>
                <Tooltip title={t(locale, agent.local ? 'agentsLocalTitle' : 'agentsRemoteTitle')}>
                  <Box
                    component="span"
                    role="img"
                    aria-label={t(locale, agent.local ? 'agentsLocalTitle' : 'agentsRemoteTitle')}
                    data-testid="agent-node-kind"
                    sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}
                  >
                    {agent.local ? (
                      <ComputerOutlined sx={{ fontSize: 18 }} />
                    ) : (
                      <PublicOutlined sx={{ fontSize: 18 }} />
                    )}
                  </Box>
                </Tooltip>
              </TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontSize: 12 }}>
                  {nodeName(agent.nodeId)}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontSize: 12, color: 'text.secondary', overflowWrap: 'normal' }}>
                {agent.lastMessageAt ? new Date(agent.lastMessageAt).toLocaleString(locale) : ''}
              </TableCell>
              <TableCell
                align="right"
                sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
              >
                {agent.messageCount !== undefined && (
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 0.25,
                    }}
                  >
                    {agent.messageCount}
                    {agent.incomingCount !== undefined && agent.outgoingCount !== undefined && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: 'text.secondary',
                          fontSize: 12,
                        }}
                      >
                        <Tooltip title={labels.incoming}>
                          <Box
                            component="span"
                            role="img"
                            aria-label={`${labels.incoming}: ${agent.incomingCount}`}
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
                          >
                            <ArrowDownwardOutlined sx={{ fontSize: 15 }} />
                            {agent.incomingCount}
                          </Box>
                        </Tooltip>
                        <Tooltip title={labels.outgoing}>
                          <Box
                            component="span"
                            role="img"
                            aria-label={`${labels.outgoing}: ${agent.outgoingCount}`}
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}
                          >
                            <ArrowUpwardOutlined sx={{ fontSize: 15 }} />
                            {agent.outgoingCount}
                          </Box>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                )}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                <Tooltip title={labels.chat(agent.nickname)}>
                  <IconButton
                    size="small"
                    aria-label={labels.chat(agent.nickname)}
                    onClick={() => onChat(agent)}
                  >
                    <ChatBubbleOutlineOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={agent.local ? labels.remove(agent.nickname) : labels.remoteRemoval}>
                  <Box component="span">
                    <IconButton
                      size="small"
                      color="error"
                      disabled={!agent.local}
                      aria-label={labels.remove(agent.nickname)}
                      onClick={() => onDelete(agent)}
                    >
                      <DeleteOutlined fontSize="small" />
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
