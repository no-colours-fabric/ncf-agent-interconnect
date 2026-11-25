import { Alert, Link } from '@mui/material';
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
    <Alert severity="warning" sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
      {version && <strong>ChatGPT {version}. </strong>}
      {version
        ? t(
            locale,
            compatibility.status === 'affected'
              ? 'chatgptDeliveryAffected'
              : 'chatgptDeliveryUnknown',
          )
        : t(locale, 'chatgptDeliveryVersionUnknown', { version: delayNoticeCutoff })}
      {download && version !== download.version && (
        <Link
          href={download.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ display: 'block', width: 'fit-content' }}
        >
          {t(
            locale,
            download.coverage === 'active-turn'
              ? 'chatgptDownloadVerified'
              : 'chatgptDownloadAutomatic',
            { version: download.version },
          )}
        </Link>
      )}
    </Alert>
  );
}
