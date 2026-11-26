export type DesktopSessionDelivery =
  | {
      state: 'ready' | 'enabled';
      profile: string;
      scope: 'login' | 'user' | 'profile';
      requiresClosedChatGPT?: true;
    }
  | {
      state:
        'conflict' | 'unavailable' | 'unsupported' | 'close-required' | 'configuration-required';
    };

export type DeliveryAction = 'status' | 'enable' | 'disable';
export type DeliveryIssue = 'conflict' | 'unavailable' | 'close-required';

export function configurationProfile(configuration: string) {
  const match = /^(.*[\\/])config\.toml$/i.exec(configuration);
  if (!match) return undefined;
  return match[1].replace(/([^:])[\\/]$/, '$1') || match[1];
}

export async function enableChatDelivery(
  invoke: import('./mcp-setup.js').McpSetupInvoke,
  configuration: string,
): Promise<DeliveryIssue | undefined> {
  const profile = configurationProfile(configuration);
  if (!profile) return 'unavailable';
  try {
    const status = await invoke<DesktopSessionDelivery>('desktopSessionDelivery', {
      action: 'status',
    });
    if (
      status.state === 'unsupported' ||
      (status.state === 'enabled' && status.profile === profile)
    )
      return;
    if (status.state === 'configuration-required') return 'unavailable';
    if (
      status.state === 'unavailable' ||
      status.state === 'conflict' ||
      status.state === 'close-required'
    )
      return status.state;
    if (status.state === 'ready' && status.profile !== profile) return 'unavailable';
    const result = await invoke<DesktopSessionDelivery>('desktopSessionDelivery', {
      action: 'enable',
      profile,
    });
    if (
      result.state === 'unsupported' ||
      (result.state === 'enabled' && result.profile === profile)
    )
      return;
    return result.state === 'conflict' || result.state === 'close-required'
      ? result.state
      : 'unavailable';
  } catch {
    return 'unavailable';
  }
}
