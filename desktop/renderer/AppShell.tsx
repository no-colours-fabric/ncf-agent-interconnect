import React from 'react';
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import HubOutlined from '@mui/icons-material/HubOutlined';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import CableOutlined from '@mui/icons-material/CableOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ExtensionOutlined from '@mui/icons-material/ExtensionOutlined';
import type { Snapshot } from '../shared/contracts.js';
import { localeLabel, supportedLocales, t, type Locale } from './i18n/index.js';
import { contentWidth, designTokens } from './theme.js';

export type Page = 'overview' | 'agents' | 'network' | 'mcp' | 'clients' | 'settings';
export const navigation: {
  id: Page;
  tKey: 'navOverview' | 'navAgents' | 'navNetwork' | 'navMcp' | 'navClients' | 'navSettings';
  icon: React.ReactNode;
}[] = [
  { id: 'overview', tKey: 'navOverview', icon: <HubOutlined /> },
  { id: 'agents', tKey: 'navAgents', icon: <ForumOutlined /> },
  { id: 'network', tKey: 'navNetwork', icon: <CableOutlined /> },
  { id: 'mcp', tKey: 'navMcp', icon: <ExtensionOutlined /> },
  { id: 'settings', tKey: 'navSettings', icon: <SettingsOutlined /> },
];

export function AppShell({
  snapshot,
  locale,
  page,
  appVersion,
  busy,
  onNavigate,
  onLocaleChange,
  onToggle,
  children,
}: {
  snapshot: Snapshot;
  locale: Locale;
  page: Page;
  appVersion: string;
  busy: boolean;
  onNavigate: (page: Page) => void;
  onLocaleChange: (locale: unknown) => void;
  onToggle: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const title = navigation.find((item) => item.id === page)?.tKey ?? 'navOverview';
  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: designTokens.shellBackgroundGradient,
      }}
    >
      <Box
        component="aside"
        sx={{
          width: { xs: 208, lg: 232 },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          p: 1.5,
          py: 2.5,
          background: designTokens.sidebarGradient,
          backdropFilter: 'blur(24px)',
          borderRight: `1px solid ${designTokens.sidebarBorder}`,
          boxShadow: designTokens.sidebarShadow,
          overflowY: 'auto',
        }}
      >
        <Stack sx={{ px: 1.5, pt: 1, pb: 4 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 17, fontWeight: 500, lineHeight: 1.35 }}>
              NCF Agent
              <br />
              Interconnect
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
              {appVersion ? `v${appVersion}` : ''}
            </Typography>
          </Box>
        </Stack>
        <List sx={{ flex: 1, py: 0 }}>
          {navigation.map((item) => (
            <ListItemButton
              key={item.id}
              data-testid={`nav-${item.id}`}
              selected={page === item.id}
              onClick={() => onNavigate(item.id)}
              sx={{ mb: 0.5, minHeight: 36, px: 1.25, py: 0.75 }}
            >
              <ListItemIcon sx={{ minWidth: 28, color: 'inherit', '& svg': { fontSize: 18 } }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={t(locale, item.tKey)}
                slotProps={{ primary: { sx: { fontSize: 13, lineHeight: 1.4 } } }}
              />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ px: 1.5, pt: 5 }}>
          <TextField
            data-testid="interface-language"
            select
            label={t(locale, 'localeTitle')}
            value={locale}
            onChange={(event) => onLocaleChange(event.target.value)}
            fullWidth
          >
            {supportedLocales.map((option) => (
              <MenuItem key={option} value={option}>
                {localeLabel(option)}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Box
          data-testid="sidebar-node-status"
          sx={{ px: 1.5, pt: 2.5, mt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 6,
                height: 6,
                flexShrink: 0,
                borderRadius: '50%',
                bgcolor: snapshot.running ? 'success.main' : 'warning.main',
                boxShadow: snapshot.running ? designTokens.statusGlow : 'none',
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {snapshot.running ? t(locale, 'nodeRunning') : t(locale, 'nodeStopped')}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.75, fontFamily: 'monospace', overflowWrap: 'anywhere' }}
          >
            {snapshot.nodeLabel}
          </Typography>
        </Box>
      </Box>
      <Box component="main" sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <Box
          component="header"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            px: { xs: 3, lg: 4 },
            py: 3,
            borderBottom: `1px solid ${designTokens.headerBorder}`,
            boxShadow: designTokens.headerShadow,
            background: designTokens.headerGradient,
            backgroundColor: designTokens.headerBackground,
            backdropFilter: 'blur(24px)',
          }}
        >
          <Stack
            data-testid="header-content"
            direction="row"
            sx={{
              maxWidth: contentWidth,
              mx: 'auto',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 1, overflowWrap: 'anywhere' }}
              >
                {t(locale, 'headerPrefix', { node: snapshot.nodeLabel })}
              </Typography>
              <Typography data-testid="page-title" variant="h4" sx={{ overflowWrap: 'anywhere' }}>
                {t(locale, title)}
              </Typography>
            </Box>
            <Button
              data-testid="node-toggle"
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={onToggle}
            >
              {snapshot.running ? t(locale, 'btnStop') : t(locale, 'btnStart')}
            </Button>
          </Stack>
        </Box>
        <Box sx={{ px: { xs: 3, lg: 4 }, py: 3.5 }}>
          <Box
            data-testid="page-content"
            sx={{ width: '100%', maxWidth: contentWidth, mx: 'auto' }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
