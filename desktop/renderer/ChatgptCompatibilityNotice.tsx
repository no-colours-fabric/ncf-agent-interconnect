import { Alert, Link } from '@mui/material';
import type { ChatgptCompatibility } from '../shared/chatgpt-compatibility.js';
import { t, type Locale } from './i18n/index.js';

export function ChatgptCompatibilityNotice({
  compatibility,
  locale,
}: {
  compatibility?: ChatgptCompatibility;
  locale: Locale;
}) {
  if (!compatibility || compatibility.status === 'verified') return null;
  const { version, download } = compatibility;
  return (
    <Alert severity="warning" sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
      {version && <strong>ChatGPT {version}. </strong>}
      {t(
        locale,
        compatibility.status === 'affected' ? 'chatgptDeliveryAffected' : 'chatgptDeliveryUnknown',
      )}
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
