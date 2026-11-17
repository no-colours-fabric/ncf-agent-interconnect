import React from 'react';
import { Alert, Box, Button, Stack, Switch, Typography } from '@mui/material';
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
  // Assigned external IPv4 stays in place while its draft switch changes. Loopback and
  // no-IPv4 inventory remain controllable under Details, without guessing from OS names.
  const primary = draft.interfaces.filter((entry) =>
    entry.addresses.some((address) => !address.internal),
  );
  const secondary = draft.interfaces.filter((entry) => !primary.includes(entry));
  const count = new Intl.NumberFormat(locale).format(draft.interfaces.length);
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
    const addresses = entry.addresses.map(
      (address) => `${address.address}/${address.prefixLength}`,
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
          {addresses.length > 1 ? (
            <Box
              component="details"
              sx={{
                '& > summary': {
                  cursor: 'pointer',
                  minHeight: 44,
                  lineHeight: '44px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  listStylePosition: 'inside',
                },
              }}
            >
              <summary title={addresses.join(', ')}>
                <Typography variant="body2" component="span" sx={{ fontFamily: 'monospace' }}>
                  {addresses[0]}
                </Typography>{' '}
                (+{addresses.length - 1})
              </summary>
              {addresses.map((address) => (
                <Typography
                  key={address}
                  variant="body2"
                  sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', pb: 0.5 }}
                >
                  {address}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography
              variant="body2"
              noWrap
              title={addresses[0] ?? m.noAddresses}
              sx={{ fontFamily: addresses.length ? 'monospace' : undefined }}
            >
              {addresses[0] ?? m.noAddresses}
            </Typography>
          )}
          {unavailable && (
            <Typography variant="caption" color="error">
              {m.unavailable}
            </Typography>
          )}
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
      </Box>
    );
  };
  const list = (entries: readonly NetworkInterfaceInventory[], testId: string) => (
    <Box component="ul" data-testid={testId} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {entries.map(row)}
    </Box>
  );
  return (
    <Box
      component="details"
      data-testid="network-interfaces-settings"
      sx={{
        minWidth: 0,
        '& > summary': {
          cursor: 'pointer',
          minHeight: 44,
          lineHeight: '44px',
          listStylePosition: 'inside',
          fontSize: 13,
          fontWeight: 500,
        },
      }}
    >
      <summary>
        {m.title}
        <Typography variant="body2" component="span" color="text.secondary" sx={{ ml: 1 }}>
          ({count})
        </Typography>
      </summary>
      {primary.length > 0 && list(primary, 'network-primary-list')}
      <Box
        component="details"
        data-testid="network-technical-details"
        sx={{
          '& > summary': {
            cursor: 'pointer',
            minHeight: 44,
            lineHeight: '44px',
            listStylePosition: 'inside',
            fontSize: 13,
            color: 'text.secondary',
          },
        }}
      >
        <summary>{m.details}</summary>
        <Stack spacing={1} sx={{ pt: 1 }}>
          {secondary.length > 0 && list(secondary, 'network-secondary-list')}
          {draft.exclusions.map((record) => (
            <Box key={JSON.stringify(record.exclusion)} data-testid="network-exclusion">
              <Stack
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
              >
                <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {record.exclusion.name}
                  {record.absent ? ` — ${m.absent}` : ''}
                </Typography>
                <Button
                  disabled={disabled}
                  sx={{ minHeight: 44 }}
                  onClick={() => onChange(removeInterfaceExclusion(value, record.exclusion))}
                >
                  {m.remove}
                </Button>
              </Stack>
              {record.ambiguous && (
                <Alert severity="warning">
                  {m.ambiguous} {record.matchingNames.join(', ')}
                </Alert>
              )}
            </Box>
          ))}
          <Typography variant="body2" color="text.secondary">
            {m.help}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {m.identityHint}
          </Typography>
          {(status.inventoryError ||
            status.listeners.some((entry) => entry.error) ||
            status.interfaces.some((entry) => entry.rejected.length)) && (
            <Box>
              <Typography variant="body2" color="error">
                {m.unavailable}
              </Typography>
              <Box
                component="pre"
                sx={{ m: 0, mt: 1, fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
              >
                {JSON.stringify(
                  {
                    ...(status.inventoryError ? { inventoryError: status.inventoryError } : {}),
                    listeners: status.listeners.filter((entry) => entry.error),
                    rejected: status.interfaces
                      .filter((entry) => entry.rejected.length)
                      .map(({ name, rejected }) => ({ name, rejected })),
                  },
                  null,
                  2,
                )}
              </Box>
            </Box>
          )}
        </Stack>
      </Box>
    </Box>
  );
}
