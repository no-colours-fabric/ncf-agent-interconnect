import {
  ownRead,
  pageFrom,
  incomingText,
  expandedMetadata,
  textTree,
  isOwnResult,
} from './presentation.js';

export function register(on) {
  // One deterministic content site: ToolUse, including unfolded groups and ctrl+o.
  // ToolResult below draws no second copy only for the same valid actual page.
  // No seen-ID state: offscreen callbacks, remount and callback order are harmless.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.tool !== ownRead || e.props.tool_use_id !== e.requestId)
      return next(e);
    if (e.props.isRunning) return textTree('NCF Agent Interconnect: receiving messages…');
    if (isOwnResult(e.props)) {
      const page = pageFrom(e.props.output);
      return textTree(incomingText(page) + (e.props.isExpanded ? expandedMetadata(page) : ''));
    }
    // Host errors, refusals, interruption and unknown result schemas stay intact.
    return next(e);
  });
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.tool_use_id !== e.requestId || !isOwnResult(e.props))
      return next(e);
    return textTree('');
  });
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (
      e.surface !== 'terminal' ||
      !Array.isArray(e.props.calls) ||
      !e.props.calls.some((call) => call.tool === ownRead)
    )
      return next(e);
    return next({ ...e, props: { ...e.props, isExpanded: true } });
  });
  // Presentation only: do not alter the stored/model-facing notice or its claim hash.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const p = e.props;
    if (
      e.surface !== 'terminal' ||
      p.origin?.kind !== 'plugin' ||
      p.origin.name !== 'ncf-agent-interconnect' ||
      p.origin.asUser ||
      typeof p.text !== 'string' ||
      !/^NCF Agent Interconnect messages are waiting for agent .+ in this chat\. Call agent_read for this agent now and continue with nextCursor while hasMore is true\. This notice contains no message content\. Wake reference [a-f0-9]+\.$/.test(
        p.text,
      )
    )
      return next(e);
    return next({
      ...e,
      props: {
        ...p,
        text: 'NCF Agent Interconnect: incoming notification. Content appears after the read completes.',
      },
    });
  });
}
