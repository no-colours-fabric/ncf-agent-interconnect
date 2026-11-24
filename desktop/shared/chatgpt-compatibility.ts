export interface ChatgptRuntime {
  version?: string;
  build?: string;
  architecture?: string;
}

export interface ChatgptCompatibility {
  status: 'verified' | 'affected' | 'unknown';
  version?: string;
  download?: { version: string; url: string; coverage: 'active-turn' | 'automatic' };
}

// Only platform and architecture combinations with native delivery evidence belong here.
const macArmRelease = {
  version: '26.1111.71704',
  coverage: 'active-turn' as const,
  url: 'https://persistent.oaistatic.com/codex-app-prod/ChatGPT-darwin-arm64-26.1111.71704.zip',
};

const windowsX64Release = {
  version: '26.1111.71704',
  coverage: 'automatic' as const,
  url: 'https://persistent.oaistatic.com/codex-app-prod/releases/26.1111.9664.0/ChatGPT-x64.msix',
};

export function isChatgptReleaseUrl(url: string, platform: NodeJS.Platform): boolean {
  return (
    (platform === 'darwin' && url === macArmRelease.url) ||
    (platform === 'win32' && url === windowsX64Release.url)
  );
}

export function chatgptCompatibility(
  platform: NodeJS.Platform,
  runtime: ChatgptRuntime,
): ChatgptCompatibility {
  const version = /^\d{1,4}\.\d{1,5}\.\d{1,5}$/.test(runtime.version ?? '')
    ? runtime.version
    : undefined;
  if (platform === 'darwin' && runtime.architecture === 'arm64') {
    if (version === macArmRelease.version && runtime.build === '29030')
      return { status: 'verified', version };
    return {
      status: version === '26.1117.41037' && runtime.build === '29803' ? 'affected' : 'unknown',
      version,
      download: macArmRelease,
    };
  }
  if (platform === 'win32' && runtime.architecture === 'x64')
    return { status: 'unknown', version, download: windowsX64Release };
  return { status: 'unknown', version };
}
