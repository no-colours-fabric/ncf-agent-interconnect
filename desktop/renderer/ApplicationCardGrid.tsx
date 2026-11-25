import type { ReactNode } from 'react';
import { Box } from '@mui/material';

export function ApplicationCardGrid({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <Box sx={{ containerType: 'inline-size' }}>
      <Box
        data-testid={testId}
        sx={{
          '--application-card-width': 'calc((100% - 16px) / 2)',
          '@container (max-width: 359px)': {
            '--application-card-width': '100%',
          },
          '@container (min-width: 744px)': {
            '--application-card-width': 'calc((100% - 32px) / 3)',
            '& > [data-compatibility-warning="true"]': {
              flexBasis: 'calc(var(--application-card-width) * 2 + 16px)',
            },
          },
          '@container (min-width: 912px)': {
            '--application-card-width': 'calc((100% - 48px) / 4)',
          },
          '@container (min-width: 1056px)': {
            '--application-card-width': 'calc((100% - 80px) / 6)',
          },
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center',
          '& > *': {
            flex: '0 0 var(--application-card-width)',
            minWidth: 0,
            boxSizing: 'border-box',
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
