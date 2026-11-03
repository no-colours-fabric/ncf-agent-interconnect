import { createTheme, type CSSObject } from '@mui/material/styles';

// Visual direction: unslop by Damir Sokolovsky (@heydamir), CC BY 4.0.
// https://github.com/heydamir/unslop

// Material direction follows the approved concept and unslop by Damir Sokolovsky
// (@heydamir), CC BY 4.0: https://github.com/heydamir/unslop.
export const contentWidth = 1200;

export const designTokens = {
  background: '#171819',
  text: '#ededee',
  secondary: '#b1b3b7',
  muted: '#8d9096',
  accent: '#9dc8bb',
  border: 'rgba(255,255,255,0.09)',
  borderHighlight: 'rgba(255,255,255,0.16)',
  backgroundGradient:
    'radial-gradient(ellipse at 5% 1%, #4a4c4e88, transparent 34%), radial-gradient(ellipse at 100% 72%, #3c414333, transparent 55%), linear-gradient(122deg, #161718 20%, #202122 68%, #171819)',
  surfaceGradient: 'linear-gradient(135deg, #2b2d2f, #202224 48%, #242628)',
  softGradient: 'linear-gradient(120deg, #242628, #1e2022)',
  insetGradient: 'linear-gradient(#151718, #1c1e20)',
  activeGradient: 'linear-gradient(#36383a, #292b2c)',
  sidebarGradient: 'linear-gradient(150deg, #313334c4, #1a1b1cd9 55%, #17191ac9)',
  glassGradient: 'linear-gradient(145deg, #393b3dc4, #232527c4)',
  surfaceShadow:
    'inset 0 1px 0 rgba(255,255,255,0.025), inset 1px 0 0 rgba(255,255,255,0.012), 0 1px 2px rgba(0,0,0,0.32)',
  focusRing: '0 0 0 2px #171819, 0 0 0 4px #9dc8bb',
  statusGlow: '0 0 8px rgba(157,200,187,0.36)',
} as const;

export function surfaceSx(kind: 'default' | 'soft' | 'glass' | 'inset' = 'default'): CSSObject {
  const base: CSSObject = {
    minWidth: 0,
    backgroundColor: '#242628',
    backgroundImage: designTokens.surfaceGradient,
    border: `1px solid ${designTokens.border}`,
    borderTopColor: 'rgba(255,255,255,0.125)',
    borderRadius: '12px',
    boxShadow: designTokens.surfaceShadow,
  };
  if (kind === 'soft') {
    return {
      ...base,
      backgroundColor: '#202224',
      backgroundImage: designTokens.softGradient,
      borderColor: 'rgba(255,255,255,0.05)',
      borderTopColor: 'rgba(255,255,255,0.08)',
    };
  }
  if (kind === 'inset') {
    return {
      ...base,
      backgroundColor: '#191b1d',
      backgroundImage: designTokens.insetGradient,
      borderColor: 'rgba(255,255,255,0.07)',
      borderBottomColor: 'rgba(255,255,255,0.14)',
      borderRadius: '8px',
      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.36), 0 1px 0 rgba(255,255,255,0.012)',
    };
  }
  if (kind === 'glass') {
    return {
      ...base,
      backgroundColor: '#2b2d2f',
      backgroundImage: 'linear-gradient(145deg, #353739, #252729)',
      borderColor: 'rgba(255,255,255,0.095)',
      borderTopColor: designTokens.borderHighlight,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 36px rgba(0,0,0,0.25)',
      '@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
        backgroundColor: 'transparent',
        backgroundImage: designTokens.glassGradient,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      },
    };
  }
  return base;
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#e5e7e9', dark: '#cfd2d4', contrastText: '#222426' },
    secondary: { main: designTokens.accent, contrastText: '#17231e' },
    success: { main: designTokens.accent, contrastText: '#17231e' },
    error: { main: '#d6a0a5', contrastText: '#2a181b' },
    warning: { main: '#d2bb91', contrastText: '#282115' },
    info: { main: '#afc2ce', contrastText: '#17212a' },
    background: { default: designTokens.background, paper: '#242628' },
    text: {
      primary: designTokens.text,
      secondary: designTokens.secondary,
      disabled: designTokens.muted,
    },
    divider: 'rgba(255,255,255,0.07)',
    action: {
      active: designTokens.secondary,
      hover: 'rgba(255,255,255,0.035)',
      selected: 'rgba(255,255,255,0.075)',
      focus: 'rgba(157,200,187,0.12)',
      disabled: '#777c82',
      disabledBackground: 'rgba(255,255,255,0.055)',
    },
  },
  shape: { borderRadius: 8 },
  spacing: 8,
  typography: {
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    fontSize: 14,
    fontWeightLight: 400,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 500,
    h1: { fontSize: 32, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.6px' },
    h2: { fontSize: 28, fontWeight: 500, lineHeight: 1.25, letterSpacing: '-0.5px' },
    h3: { fontSize: 26, fontWeight: 500, lineHeight: 1.25, letterSpacing: '-0.5px' },
    h4: { fontSize: 26, fontWeight: 500, lineHeight: 1.25, letterSpacing: '-0.5px' },
    h5: { fontSize: 22, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0 },
    h6: { fontSize: 18, fontWeight: 500, lineHeight: 1.35, letterSpacing: 0 },
    subtitle1: { fontSize: 15, fontWeight: 500, lineHeight: 1.5 },
    subtitle2: { fontSize: 14, fontWeight: 500, lineHeight: 1.5 },
    body1: { fontSize: 14, fontWeight: 400, lineHeight: 1.6 },
    body2: { fontSize: 13, fontWeight: 400, lineHeight: 1.6 },
    caption: { fontSize: 12, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 },
    overline: {
      fontSize: 11,
      fontWeight: 400,
      lineHeight: 1.6,
      textTransform: 'none',
      letterSpacing: 0,
    },
    button: { fontSize: 13, fontWeight: 400, lineHeight: 1.4, textTransform: 'none' },
  },
  transitions: {
    easing: { easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    duration: { shortest: 120, shorter: 140, short: 180, standard: 220 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { colorScheme: 'dark' },
        body: {
          backgroundColor: designTokens.background,
          backgroundImage: designTokens.backgroundGradient,
          backgroundAttachment: 'fixed',
        },
        '*': { scrollbarWidth: 'thin', scrollbarColor: '#53575c #1d1f21' },
        '::selection': { backgroundColor: '#9dc8bb40' },
        code: {
          fontFamily: '"SFMono-Regular",Consolas,"Liberation Mono",monospace',
          fontVariantNumeric: 'tabular-nums',
        },
        '@media (prefers-reduced-transparency: reduce)': {
          '.MuiDrawer-paper, .MuiDialog-paper': {
            backgroundColor: '#2b2d2f',
            backgroundImage: 'linear-gradient(145deg, #353739, #252729)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          },
        },
      },
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': { outline: `2px solid ${designTokens.accent}`, outlineOffset: 3 },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 36,
          minWidth: 0,
          padding: '8px 14px',
          borderRadius: 8,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          fontWeight: 400,
          transition: 'background-color 140ms, border-color 140ms, box-shadow 140ms',
        },
        sizeSmall: { minHeight: 30, padding: '5px 10px', fontSize: 12 },
        startIcon: { marginRight: 8, '& > :nth-of-type(1)': { fontSize: 18 } },
        endIcon: { marginLeft: 8, '& > :nth-of-type(1)': { fontSize: 18 } },
        contained: {
          border: '1px solid #f4f4f5',
          color: '#222426',
          backgroundColor: '#dfe1e3',
          backgroundImage: 'linear-gradient(#eeeeef, #cfd2d4)',
          boxShadow: 'inset 0 1px 0 #fff, 0 2px 4px rgba(0,0,0,0.18)',
          '&:hover': {
            color: '#1c1e20',
            borderColor: '#fff',
            backgroundColor: '#eceeef',
            backgroundImage: 'linear-gradient(#fff, #e0e3e5)',
            boxShadow: 'inset 0 1px 0 #fff, 0 2px 4px rgba(0,0,0,0.18)',
          },
          '&.Mui-disabled': {
            color: '#777c82',
            borderColor: '#ffffff0c',
            backgroundColor: '#27292b',
            backgroundImage: 'none',
            boxShadow: 'none',
          },
          '&.MuiButton-colorError': {
            color: '#2a181b',
            borderColor: '#e3b4b8',
            backgroundColor: '#d6a0a5',
            backgroundImage: 'linear-gradient(#e2b4b8, #c48f95)',
            boxShadow: 'inset 0 1px 0 #ffffff35, 0 2px 4px #0003',
            '&:hover': {
              color: '#2a181b',
              borderColor: '#edc7ca',
              backgroundColor: '#e2b4b8',
              backgroundImage: 'linear-gradient(#edc7ca, #d5a0a6)',
            },
            '&.Mui-disabled': {
              color: '#777c82',
              borderColor: '#ffffff0c',
              backgroundColor: '#27292b',
              backgroundImage: 'none',
              boxShadow: 'none',
            },
          },
        },
        outlined: {
          color: designTokens.text,
          borderColor: '#ffffff18',
          backgroundColor: '#2e3032',
          backgroundImage: 'linear-gradient(#36383a, #2a2c2e)',
          boxShadow: 'inset 0 1px 0 #ffffff0c, 0 1px 2px #0004',
          '&:hover': {
            borderColor: '#ffffff30',
            backgroundColor: '#393b3d',
            backgroundImage: 'linear-gradient(#404245, #303235)',
          },
          '&.Mui-disabled': {
            color: '#777c82',
            backgroundColor: '#202224',
            backgroundImage: 'none',
            borderColor: '#ffffff0a',
            boxShadow: 'none',
          },
          '&.MuiButton-colorError': {
            color: '#d6a0a5',
            borderColor: '#d6a0a535',
            '&:hover': { color: '#e4b3b7', borderColor: '#d6a0a566' },
            '&.Mui-disabled': { color: '#777c82', borderColor: '#ffffff0a' },
          },
        },
        text: {
          color: designTokens.secondary,
          '&:hover': { color: designTokens.text, backgroundColor: '#ffffff05' },
          '&.MuiButton-colorError': {
            color: '#d6a0a5',
            '&:hover': { color: '#e4b3b7', backgroundColor: '#d6a0a50c' },
          },
          '&.Mui-disabled': { color: '#777c82' },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: designTokens.secondary,
          borderRadius: 8,
          padding: 8,
          '&:hover': { color: designTokens.text, backgroundColor: '#ffffff07' },
          '&.MuiIconButton-colorSecondary': {
            color: designTokens.accent,
            '&:hover': { color: '#badcd1', backgroundColor: '#9dc8bb0a' },
            '&.Mui-disabled': { color: '#62676d' },
          },
          '&.MuiIconButton-colorError': {
            color: '#d6a0a5',
            '&:hover': { color: '#e4b3b7', backgroundColor: '#d6a0a50c' },
            '&.Mui-disabled': { color: '#62676d' },
          },
          '&.Mui-disabled': { color: '#62676d' },
        },
        sizeSmall: { padding: 6, '& .MuiSvgIcon-root': { fontSize: 18 } },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: surfaceSx(),
        rounded: { borderRadius: 12 },
        outlined: { borderColor: '#ffffff10', borderTopColor: '#ffffff20' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          color: designTokens.text,
          borderRadius: 8,
          backgroundColor: '#191b1d',
          backgroundImage: designTokens.insetGradient,
          boxShadow: 'inset 0 1px 3px #0006, 0 1px 0 #ffffff03',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ffffff2d' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: designTokens.accent,
            borderWidth: 1,
          },
          '&.Mui-focused': { boxShadow: 'inset 0 1px 3px #0006, 0 0 0 2px #9dc8bb14' },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#d6a0a5' },
          '&.Mui-disabled': { color: '#777c82', backgroundImage: 'none' },
          '& textarea.MuiOutlinedInput-input': { padding: 0 },
        },
        notchedOutline: { borderColor: '#ffffff17', borderBottomColor: '#ffffff24' },
        input: {
          fontSize: 13,
          padding: '10px 12px',
          '&::placeholder': { color: '#8d9096', opacity: 1 },
          '&.Mui-disabled': { WebkitTextFillColor: '#777c82' },
        },
        multiline: { padding: '10px 12px' },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: designTokens.secondary,
          fontSize: 13,
          '&.Mui-focused': { color: designTokens.accent },
          '&.Mui-error': { color: '#d6a0a5' },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { color: designTokens.muted, fontSize: 12, lineHeight: 1.5 } },
    },
    MuiSelect: {
      styleOverrides: { icon: { color: designTokens.secondary }, select: { minHeight: '1.5em' } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 36,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid transparent',
          color: designTokens.secondary,
          position: 'relative',
          '&:hover': { color: designTokens.text, backgroundColor: '#ffffff06' },
          '&.Mui-selected': {
            color: designTokens.text,
            borderColor: '#ffffff16',
            backgroundColor: '#2d2f31',
            backgroundImage: designTokens.activeGradient,
            boxShadow: 'inset 0 1px 0 #ffffff10, 0 1px 1px #0008',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              width: 2,
              height: 14,
              borderRadius: 2,
              backgroundColor: designTokens.accent,
              boxShadow: '0 0 8px #9dc8bb30',
            },
          },
          '&.Mui-selected:hover': {
            backgroundColor: '#343638',
            backgroundImage: 'linear-gradient(#3d3f41, #2e3032)',
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { color: 'inherit', minWidth: 30, '& .MuiSvgIcon-root': { fontSize: 18 } },
      },
    },
    MuiListItemText: { styleOverrides: { primary: { fontSize: 13 }, root: { margin: 0 } } },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 36,
          fontSize: 13,
          borderRadius: 6,
          margin: '2px 4px',
          '&.Mui-selected': { backgroundColor: '#ffffff0c' },
          '&.Mui-selected:hover': { backgroundColor: '#ffffff12' },
        },
      },
    },
    MuiMenu: { styleOverrides: { paper: { ...surfaceSx('glass'), borderRadius: 10 } } },
    MuiPopover: { styleOverrides: { paper: { ...surfaceSx('glass'), borderRadius: 10 } } },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          ...surfaceSx('glass'),
          borderRadius: 0,
          borderLeftColor: '#ffffff1a',
          boxShadow: '-20px 0 60px #0005, inset 1px 0 0 #ffffff08',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: { root: { backgroundColor: '#08090a80', backdropFilter: 'blur(1.5px)' } },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          ...surfaceSx('glass'),
          borderRadius: 16,
          minWidth: 0,
          margin: 24,
          maxHeight: 'calc(100% - 48px)',
          boxShadow: '0 28px 80px #0008, inset 0 1px 0 #ffffff08',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: 24,
          fontSize: 20,
          fontWeight: 500,
          borderBottom: '1px solid #ffffff0d',
          flexShrink: 0,
          overflowWrap: 'anywhere',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: 24,
          minWidth: 0,
          scrollbarGutter: 'stable',
          '&:first-of-type': { paddingTop: 24 },
        },
      },
    },
    MuiDialogActions: {
      defaultProps: { disableSpacing: true },
      styleOverrides: {
        root: {
          padding: '16px 24px',
          borderTop: '1px solid #ffffff0c',
          backgroundColor: '#10121426',
          flexShrink: 0,
          gap: 8,
        },
      },
    },
    MuiTableContainer: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '12px 16px', borderBottomColor: '#ffffff07', fontSize: 13 },
        head: {
          color: designTokens.muted,
          fontWeight: 400,
          fontSize: 12,
          backgroundColor: '#292b2d',
          backgroundImage: 'linear-gradient(#ffffff02, #00000009)',
          borderBottomColor: '#101213',
          boxShadow: '0 1px 0 #ffffff07',
        },
        sizeSmall: { padding: '8px 12px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&.MuiTableRow-hover:hover': { backgroundColor: '#ffffff03' },
          '&:last-child > td, &:last-child > th[scope="row"]': { borderBottom: 0 },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 44, borderBottom: '1px solid #ffffff0c' },
        indicator: {
          height: 1,
          backgroundColor: designTokens.accent,
          boxShadow: '0 0 8px #9dc8bb25',
        },
        list: { gap: 4 },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 40,
          minWidth: 0,
          padding: '9px 20px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 400,
          textTransform: 'none',
          color: designTokens.muted,
          '&.Mui-selected': {
            color: designTokens.text,
            backgroundColor: '#2b2d2f',
            backgroundImage: 'linear-gradient(#343638, #282a2c)',
            boxShadow: 'inset 0 1px 0 #ffffff09',
          },
        },
      },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { borderRadius: 6, height: 26, fontSize: 12, fontWeight: 400 },
        colorDefault: {
          color: designTokens.secondary,
          borderColor: '#ffffff14',
          backgroundColor: '#191b1d',
          boxShadow: 'inset 0 1px 0 #ffffff04',
        },
        label: { paddingLeft: 8, paddingRight: 8 },
      },
    },
    MuiAvatar: {
      styleOverrides: {
        root: {
          width: 36,
          height: 36,
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 400,
          color: '#c0c4c6',
          border: '1px solid #ffffff15',
          backgroundColor: '#383b3d',
          backgroundImage: 'linear-gradient(#45484b, #313437)',
          boxShadow: 'inset 0 1px 0 #ffffff0d',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.6,
          border: '1px solid transparent',
          variants: [
            {
              props: { variant: 'standard', severity: 'error' },
              style: { color: '#edc4c7', backgroundColor: '#33262a', borderColor: '#d6a0a524' },
            },
            {
              props: { variant: 'standard', severity: 'warning' },
              style: { color: '#ded0b7', backgroundColor: '#302c24', borderColor: '#d2bb9124' },
            },
            {
              props: { variant: 'standard', severity: 'info' },
              style: { color: '#cfdae0', backgroundColor: '#252d32', borderColor: '#afc2ce24' },
            },
            {
              props: { variant: 'standard', severity: 'success' },
              style: { color: '#c4d9d1', backgroundColor: '#26322e', borderColor: '#9dc8bb24' },
            },
          ],
        },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: '#ffffff0b', boxShadow: '0 -1px 0 #0004' } },
    },
    MuiSwitch: {
      styleOverrides: {
        switchBase: {
          color: '#b4b8bd',
          '&.Mui-checked': { color: designTokens.accent },
          '&.Mui-checked + .MuiSwitch-track': { backgroundColor: designTokens.accent },
        },
        track: { backgroundColor: '#6e7479' },
      },
    },
    MuiSnackbarContent: {
      styleOverrides: {
        root: {
          color: designTokens.text,
          backgroundColor: '#242628',
          backgroundImage: designTokens.surfaceGradient,
        },
      },
    },
    MuiTooltip: {
      defaultProps: {
        slotProps: { popper: { popperOptions: { strategy: 'fixed' } } },
      },
      styleOverrides: {
        tooltip: {
          color: designTokens.text,
          backgroundColor: '#343638',
          border: '1px solid #ffffff1a',
          borderRadius: 6,
          fontSize: 12,
          lineHeight: 1.5,
          boxShadow: '0 4px 12px #0005',
        },
        arrow: { color: '#343638' },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: designTokens.accent,
          textDecorationColor: '#9dc8bb66',
          '&:focus-visible': { outline: `2px solid ${designTokens.accent}`, outlineOffset: 3 },
        },
      },
    },
  },
});
