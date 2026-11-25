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
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import FileDownloadOffOutlined from '@mui/icons-material/FileDownloadOffOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import Circle from '@mui/icons-material/Circle';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import ComputerOutlined from '@mui/icons-material/ComputerOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import { applicationNames } from '../shared/application-discovery.js';
import type { AgentApplicationId } from '../shared/contracts.js';
import type { McpSetupClient } from '../shared/mcp-setup.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import {
  agentLastMessageTime,
  sortAgentRows,
  type AgentRow,
  type AgentSort,
  type AgentSortColumn,
} from './agents-table-model.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
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
  rename: string;
  remoteRemoval: string;
}

const applicationClients = {
  'cursor-hook': 'cursor',
  'opencode-http': 'opencode',
  'opencode-v2': 'opencode',
  'codex-desktop': 'codex',
  aionui: 'aionui',
  'claude-code': 'claude',
} satisfies Record<AgentApplicationId, McpSetupClient>;

function agentApplicationName(application: AgentApplicationId, locale: Locale): string {
  if (application === 'aionui') return applicationSetupMessages(locale).aionUiName;
  if (application === 'opencode-http') return 'OpenCode v1';
  if (application === 'opencode-v2') return 'OpenCode v2';
  return applicationNames[applicationClients[application]];
}

function AgentApplicationIcon({
  application,
  locale,
}: {
  application?: AgentApplicationId;
  locale: Locale;
}) {
  const name = application
    ? agentApplicationName(application, locale)
    : t(locale, 'agentsApplicationUnknown');
  return (
    <Tooltip title={name}>
      <Box
        component="span"
        role="img"
        aria-label={name}
        sx={{
          display: 'inline-flex',
          width: 24,
          height: 24,
          alignItems: 'center',
          justifyContent: 'center',
          verticalAlign: 'middle',
          color: 'text.secondary',
        }}
      >
        {application ? (
          <ClientLogo client={applicationClients[application]} size={24} />
        ) : (
          <span aria-hidden="true">?</span>
        )}
      </Box>
    </Tooltip>
  );
}

export function AgentsTable({
  rows,
  labels,
  locale,
  nodeName,
  onChat,
  onDelete,
  onRename,
  onRemoveReceivedAttachments,
}: {
  rows: AgentRow[];
  labels: AgentsTableLabels;
  locale: Locale;
  nodeName: (id: string) => string;
  onChat: (agent: AgentRow) => void;
  onDelete: (agent: AgentRow) => void;
  onRename: (agent: AgentRow) => void;
  onRemoveReceivedAttachments?: { label: string; open: (agent: AgentRow) => void };
}): React.JSX.Element {
  const [sort, setSort] = React.useState<AgentSort>({ column: 'name', direction: 'asc' });
  const applicationName = (application: AgentApplicationId) =>
    agentApplicationName(application, locale);
  const attachmentSize = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'byte',
    unitDisplay: 'short',
  });
  const columns: { key: AgentSortColumn; label: string; align?: 'right'; span?: number }[] = [
    { key: 'name', label: labels.name },
    { key: 'application', label: labels.client },
    { key: 'node', label: labels.node, span: 2 },
    { key: 'lastMessage', label: labels.lastMessage },
    { key: 'messages', label: t(locale, 'agentsColumnMessages'), align: 'right' },
    { key: 'attachments', label: t(locale, 'agentsColumnAttachments'), align: 'right' },
  ];
  return (
    <TableContainer component={Paper} sx={{ containerType: 'inline-size' }}>
      <Table
        data-testid="agents-table"
        aria-label={t(locale, 'agentsTitle')}
        size="small"
        sx={{
          minWidth: 704,
          tableLayout: 'fixed',
          '& td, & th': { overflowWrap: 'anywhere', verticalAlign: 'middle' },
          '& thead th': { whiteSpace: 'normal' },
        }}
      >
        <colgroup>
          <Box component="col" sx={{ width: '24%' }} />
          <col style={{ width: 72 }} />
          <col style={{ width: 36 }} />
          <col />
          <Box component="col" sx={{ width: 'clamp(90px, calc(100cqw - 700px), 180px)' }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 116 }} />
          <col style={{ width: 122 }} />
        </colgroup>
        <TableHead>
          <TableRow>
            {columns.map(({ key, label, align, span }) => {
              const active = sort.column === key;
              const direction = active ? sort.direction : 'asc';
              return (
                <TableCell
                  key={key}
                  scope="col"
                  align={align}
                  colSpan={span}
                  sortDirection={active ? direction : false}
                  sx={key === 'application' ? { p: '2px' } : undefined}
                >
                  <TableSortLabel
                    component="button"
                    type="button"
                    active={active}
                    direction={direction}
                    onClick={() =>
                      setSort((current) => ({
                        column: key,
                        direction:
                          current.column === key && current.direction === 'asc' ? 'desc' : 'asc',
                      }))
                    }
                    sx={{
                      maxWidth: '100%',
                      textAlign: align ?? 'left',
                      '& .MuiTableSortLabel-icon': { flexShrink: 0 },
                      '&.Mui-focusVisible': { outline: '2px solid currentColor', outlineOffset: 2 },
                    }}
                  >
                    {label}
                  </TableSortLabel>
                </TableCell>
              );
            })}
            <TableCell align="right">{labels.actions}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sortAgentRows(rows, sort, locale, nodeName, applicationName).map((agent) => (
            <TableRow key={agent.id} data-testid="agent-row" data-agent-id={agent.id} hover>
              <TableCell component="th" scope="row">
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
              <TableCell sx={{ p: '2px' }}>
                <AgentApplicationIcon application={agent.application} locale={locale} />
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
              <TableCell sx={{ pl: 0 }}>
                <Typography variant="body2" sx={{ fontSize: 12 }}>
                  {nodeName(agent.nodeId)}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>
                {agent.lastMessageAt && agentLastMessageTime(agent) !== undefined
                  ? new Date(agent.lastMessageAt).toLocaleString(locale)
                  : ''}
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
              <TableCell align="right" sx={{ px: 1 }} data-testid="agent-received-attachments">
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: 'center', justifyContent: 'end' }}
                >
                  {agent.receivedAttachmentBytes !== undefined && (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {attachmentSize.format(agent.receivedAttachmentBytes)}
                    </Typography>
                  )}
                  {agent.local && agent.identity?.incarnation && onRemoveReceivedAttachments && (
                    <Tooltip title={onRemoveReceivedAttachments.label}>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={onRemoveReceivedAttachments.label}
                        onClick={() => onRemoveReceivedAttachments.open(agent)}
                      >
                        <FileDownloadOffOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
              <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
                <Tooltip title={labels.chat(agent.nickname)}>
                  <IconButton
                    size="small"
                    aria-label={labels.chat(agent.nickname)}
                    onClick={() => onChat(agent)}
                  >
                    <ChatBubbleOutlineOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
                {agent.local && agent.identity?.incarnation && (
                  <Tooltip title={labels.rename}>
                    <IconButton
                      size="small"
                      aria-label={labels.rename}
                      onClick={() => onRename(agent)}
                      data-testid="rename-local-agent"
                    >
                      <EditOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
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
              <TableCell colSpan={8} sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                {t(locale, 'agentEmptyPrompt')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
