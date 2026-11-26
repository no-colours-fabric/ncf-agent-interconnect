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
  return (await configureChatDelivery(invoke, configuration)).issue;
}

export async function configureChatDelivery(
  invoke: import('./mcp-setup.js').McpSetupInvoke,
  configuration: string,
): Promise<{ issue?: DeliveryIssue; changed?: true; status?: DesktopSessionDelivery }> {
  const profile = configurationProfile(configuration);
  if (!profile) return { issue: 'unavailable' };
  try {
    const status = await invoke<DesktopSessionDelivery>('desktopSessionDelivery', {
      action: 'status',
    });
    if (
      status.state === 'unsupported' ||
      (status.state === 'enabled' && status.profile === profile)
    )
      return { status };
    if (status.state === 'configuration-required') return { issue: 'unavailable' };
    if (
      status.state === 'unavailable' ||
      status.state === 'conflict' ||
      status.state === 'close-required'
    )
      return { issue: status.state };
    if (status.state === 'ready' && status.profile !== profile) return { issue: 'unavailable' };
    const result = await invoke<DesktopSessionDelivery>('desktopSessionDelivery', {
      action: 'enable',
      profile,
    });
    if (result.state === 'unsupported') return { status: result };
    if (result.state === 'enabled' && result.profile === profile)
      return { changed: true, status: result };
    return {
      issue:
        result.state === 'conflict' || result.state === 'close-required'
          ? result.state
          : 'unavailable',
    };
  } catch {
    return { issue: 'unavailable' };
  }
}
