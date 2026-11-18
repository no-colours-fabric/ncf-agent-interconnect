import React from 'react';
import { Alert, Box, Button, Stack, Switch, Tooltip, Typography } from '@mui/material';
import type {
  NetworkInterfaceExclusion,
  NetworkInterfaceInventory,
  NetworkInterfaceStatus,
} from '../shared/network-interfaces.js';
import {
  computeNetworkInterfacePolicy,
  exclusionsForInterface,
  removeInterfaceExclusion,
} from '../core/network-interfaces.js';
import type { Locale } from './i18n/index.js';
import { networkInterfaceMessages } from './i18n/network-interfaces.js';

export function NetworkInterfacesSettings({
  status,
  value,
  onChange,
  locale,
  disabled,
}: {
  status: NetworkInterfaceStatus;
  value: readonly NetworkInterfaceExclusion[];
  onChange(value: NetworkInterfaceExclusion[]): void;
  locale: Locale;
  disabled?: boolean;
}): React.JSX.Element {
  const m = networkInterfaceMessages(locale);
  const snapshot = Object.fromEntries(
    status.interfaces.map((entry) => [
      entry.name,
      [
        ...entry.addresses.flatMap((address) =>
          (entry.macs.length ? entry.macs : [undefined]).map((mac) => ({
            ...address,
            family: 'IPv4',
            mac,
          })),
        ),
        ...(!entry.addresses.length
          ? entry.macs.map((mac) => ({
              address: '::1',
              family: 'IPv6',
              mac,
              netmask: '',
              internal: false,
            }))
          : []),
      ],
    ]),
  );
  const draft = computeNetworkInterfacePolicy(snapshot, value);
  // Visibility does not alter saved exclusions; a returning IPv4 address retains its policy.
  const visible = draft.interfaces.filter((entry) => entry.addresses.length > 0);
  const hasError =
    !!status.inventoryError ||
    status.listeners.some((entry) => entry.state === 'error' || !!entry.error);
  const diagnostic = JSON.stringify(
    {
      ...(status.inventoryError ? { inventoryError: status.inventoryError } : {}),
      listeners: status.listeners.filter((entry) => entry.state === 'error' || entry.error),
      rejected: status.interfaces
        .filter((entry) => entry.rejected.length)
        .map(({ name, rejected }) => ({ name, rejected })),
      blocked: status.addresses.filter((entry) => !entry.allowed),
    },
    null,
    2,
  );
  const problem = (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption">{m.details}</Typography>
          <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {diagnostic}
          </Box>
        </Box>
      }
    >
      <Typography component="span" tabIndex={0} variant="caption" color="error">
        {m.unavailable}
      </Typography>
    </Tooltip>
  );
  const recovery = (record: (typeof draft.exclusions)[number], testId: string) => (
    <Box key={JSON.stringify(record.exclusion)} data-testid={testId}>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
        {record.exclusion.name}
        {record.exclusion.mac ? ` (${record.exclusion.mac})` : ''}
        {record.absent ? ` — ${m.absent}` : ''}
      </Typography>
      {record.ambiguous && (
        <Alert severity="warning">
          {m.ambiguous} {record.matchingNames.join(', ')}
        </Alert>
      )}
      <Button
        disabled={disabled}
        sx={{ minHeight: 44 }}
        onClick={() => onChange(removeInterfaceExclusion(value, record.exclusion))}
      >
        {m.remove}
      </Button>
    </Box>
  );
  const row = (entry: NetworkInterfaceInventory) => {
    const matches = draft.exclusions.filter((record) => record.matchingNames.includes(entry.name));
    const ambiguous = matches.some((record) => record.ambiguous);
    const unavailable =
      !entry.excluded &&
      entry.addresses.some(
        (address) =>
          status.listeners.some(
            (listener) => listener.address === address.address && listener.state === 'error',
          ) ||
          status.addresses.some(
            (candidate) => candidate.address === address.address && !candidate.allowed,
          ),
      );
    return (
      <Box
        component="li"
        key={entry.name}
        data-interface-name={entry.name}
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr) 64px',
          alignItems: 'center',
          gap: 1,
          minHeight: 48,
          borderBottom: 1,
          borderColor: 'divider',
          '&:last-child': { borderBottom: 0 },
        }}
      >
        <Typography variant="body2" component="span" noWrap title={entry.name}>
          {entry.name}
        </Typography>
        <Box sx={{ minWidth: 0, color: 'text.secondary' }}>
          {entry.addresses.map((address) => (
            <Typography
              key={`${address.address}/${address.prefixLength}`}
              variant="body2"
              sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
            >
              {address.address}/{address.prefixLength}
            </Typography>
          ))}
          {unavailable && problem}
        </Box>
        <Switch
          checked={!entry.excluded}
          disabled={disabled || (entry.excluded && ambiguous)}
          title={entry.excluded ? m.disabled : m.enabled}
          sx={{ width: 64, height: 44, p: '15px 12px', '& .MuiSwitch-switchBase': { p: 1.5 } }}
          slotProps={{ input: { 'aria-label': `${entry.name}: ${m.enabled}` } }}
          onChange={(_, checked) => {
            if (!checked) onChange([...value, ...exclusionsForInterface(snapshot, entry.name)]);
            else
              onChange(
                value.filter(
                  (record) =>
                    !matches.some(
                      (match) =>
                        match.exclusion.name === record.name && match.exclusion.mac === record.mac,
                    ),
                ),
              );
          }}
        />
        {entry.excluded && ambiguous && (
          <Stack
            data-testid="network-row-recovery"
            spacing={1}
            sx={{ gridColumn: '1 / -1', minWidth: 0, pb: 1 }}
          >
            {matches.map((record) => recovery(record, 'network-row-exclusion'))}
          </Stack>
        )}
      </Box>
    );
  };
  return (
    <Stack spacing={1} data-testid="network-interfaces-settings" sx={{ minWidth: 0 }}>
      {hasError && (
        <Alert severity="error" data-testid="network-interface-problem">
          {problem}
        </Alert>
      )}
      <Box
        component="ul"
        aria-label={m.title}
        data-testid="network-primary-list"
        sx={{ listStyle: 'none', p: 0, m: 0 }}
      >
        {visible.map(row)}
      </Box>
      {draft.exclusions
        .filter((record) => record.absent)
        .map((record) => recovery(record, 'network-exclusion'))}
    </Stack>
  );
}
