import { expect, test } from 'claude-code/testing';

test(
  'explicit native render matcher',
  {
    plugins: [
      {
        name: 'loader-control',
        register(on) {
          on('ui.render', { component: 'ToolUse' }, ($, e, next) => ({
            type: 'Text',
            children: ['LOADED'],
          }));
        },
      },
    ],
  },
  async ($, on) => {
    on('ui.render', () => ({ type: 'Text', children: ['NATIVE'] }));
    const e = {
      component: 'ToolUse',
      surface: 'terminal',
      requestId: 'id',
      plugin: 'loader-control',
      props: {
        tool: 'Read',
        tool_use_id: 'id',
        input: {},
        isRunning: false,
        isErrored: false,
        isInterrupted: false,
      },
    };
    const ui = await $.ui.mount({
      plugin: 'loader-control',
      surface: 'terminal',
      component: 'ToolUse',
      props: e.props,
    });
    expect((await ui.drawn()).children).toEqual(['LOADED']);
    await ui.unmount();
  },
);
