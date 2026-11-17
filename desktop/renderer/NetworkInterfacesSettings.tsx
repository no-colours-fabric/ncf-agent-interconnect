import React from 'react';
import { Alert, Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import type {
  NetworkInterfaceExclusion,
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
  return (
    <Stack spacing={2} data-testid="network-interfaces-settings">
      <Typography variant="subtitle1">{m.title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {m.help}
      </Typography>
      {status.inventoryError && (
        <Alert severity="error">
          {m.unavailable}
          <Box component="details">
            <summary>{m.details}</summary>
            {status.inventoryError}
          </Box>
        </Alert>
      )}
      {draft.interfaces.map((entry) => {
        const matches = draft.exclusions.filter((record) =>
          record.matchingNames.includes(entry.name),
        );
        const ambiguous = matches.some((record) => record.ambiguous);
        return (
          <Box key={entry.name} sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
            <FormControlLabel
              label={entry.name}
              control={
                <Switch
                  checked={!entry.excluded}
                  disabled={disabled || (entry.excluded && ambiguous)}
                  slotProps={{ input: { 'aria-label': `${entry.name}: ${m.enabled}` } }}
                  onChange={(_, checked) => {
                    if (!checked)
                      onChange([...value, ...exclusionsForInterface(snapshot, entry.name)]);
                    else
                      onChange(
                        value.filter(
                          (record) =>
                            !matches.some(
                              (match) =>
                                match.exclusion.name === record.name &&
                                match.exclusion.mac === record.mac,
                            ),
                        ),
                      );
                  }}
                />
              }
            />
            <Typography variant="body2" color="text.secondary">
              {entry.excluded ? m.disabled : m.enabled}
            </Typography>
            {!entry.addresses.length && <Typography variant="body2">{m.noAddresses}</Typography>}
            {entry.addresses.map((address) => {
              const listener = status.listeners.find(
                (listener) => listener.address === address.address,
              );
              const actual = status.addresses.find(
                (candidate) => candidate.address === address.address,
              );
              return (
                <Typography
                  key={`${address.address}/${address.prefixLength}`}
                  variant="body2"
                  sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}
                >
                  {address.address}/{address.prefixLength}
                  {!entry.excluded && (listener?.state === 'error' || actual?.allowed === false)
                    ? ` — ${m.unavailable}`
                    : ''}
                </Typography>
              );
            })}
          </Box>
        );
      })}
      {draft.exclusions.map((record) => (
        <Box key={JSON.stringify(record.exclusion)}>
          <Typography variant="body2">
            {record.exclusion.name}
            {record.absent ? ` — ${m.absent}` : ''}
          </Typography>
          {record.ambiguous && (
            <Alert severity="warning">
              {m.ambiguous} {record.matchingNames.join(', ')}
            </Alert>
          )}
          <Button
            disabled={disabled}
            onClick={() => onChange(removeInterfaceExclusion(value, record.exclusion))}
          >
            {m.remove}
          </Button>
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary">
        {m.identityHint}
      </Typography>
      {(status.listeners.some((entry) => entry.error) ||
        status.interfaces.some((entry) => entry.rejected.length)) && (
        <Box component="details">
          <summary>{m.details}</summary>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(
              {
                listeners: status.listeners.filter((entry) => entry.error),
                rejected: status.interfaces
                  .filter((entry) => entry.rejected.length)
                  .map(({ name, rejected }) => ({ name, rejected })),
              },
              null,
              2,
            )}
          </pre>
        </Box>
      )}
    </Stack>
  );
}
