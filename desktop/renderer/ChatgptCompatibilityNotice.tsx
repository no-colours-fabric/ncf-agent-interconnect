import { Alert, Box, Link } from '@mui/material';
import type { ChatgptCompatibility } from '../shared/chatgpt-compatibility.js';
import { t, type Locale } from './i18n/index.js';

// This cutoff controls the notice independently of measured delivery capabilities.
const delayNoticeCutoff = '26.1111.71704';
const versionOrder = new Intl.Collator('en', { numeric: true });

export function showsChatgptCompatibilityNotice(
  compatibility: ChatgptCompatibility | undefined,
): compatibility is ChatgptCompatibility {
  return (
    !!compatibility &&
    compatibility.status !== 'verified' &&
    (!compatibility.version || versionOrder.compare(compatibility.version, delayNoticeCutoff) > 0)
  );
}

function VersionNumber({ version }: { version: string }) {
  return (
    <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
      {version}
    </Box>
  );
}

function VersionedText({ text, version }: { text: string; version: string }) {
  const [before, after] = text.split('{version}');
  return (
    <>
      {before}
      <VersionNumber version={version} />
      {after}
    </>
  );
}

export function ChatgptCompatibilityNotice({
  compatibility,
  locale,
}: {
  compatibility?: ChatgptCompatibility;
  locale: Locale;
}) {
  if (!showsChatgptCompatibilityNotice(compatibility)) return null;
  const { version, download } = compatibility;
  return (
    <Alert
      severity="warning"
      sx={{
        gridColumn: '1 / -1',
        minWidth: 0,
        flexWrap: 'wrap',
        '& .MuiAlert-message': { flex: '1 1 105px', minWidth: 0, overflowWrap: 'anywhere' },
      }}
    >
      {version ? (
        <>
          <strong>
            ChatGPT <VersionNumber version={version} />.{' '}
          </strong>
          {t(
            locale,
            compatibility.status === 'affected'
              ? 'chatgptDeliveryAffected'
              : 'chatgptDeliveryUnknown',
          )}
        </>
      ) : (
        <VersionedText
          text={t(locale, 'chatgptDeliveryVersionUnknown')}
          version={delayNoticeCutoff}
        />
      )}
      {download && version !== download.version && (
        <Link
          href={download.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'block', width: 'fit-content' }}
        >
          <VersionedText
            text={t(
              locale,
              download.coverage === 'active-turn'
                ? 'chatgptDownloadVerified'
                : 'chatgptDownloadAutomatic',
            )}
            version={download.version}
          />
        </Link>
      )}
    </Alert>
  );
}
