import assert from 'node:assert/strict';

// Test-only native ResizeObserver phase measurements; callbacks never move scroll.
export function createHistoryLayoutObservation(page, settled) {
  async function instrumentResizeObserver() {
    await page.evaluate(() => {
      const NativeResizeObserver = window.ResizeObserver;
      const registrations = new WeakMap();
      const identities = new WeakMap();
      let nextObserver = 0,
        nextTarget = 0,
        sequence = 0;
      const identity = (target) => {
        if (!identities.has(target)) identities.set(target, ++nextTarget);
        return identities.get(target);
      };
      window.__appsResizeRegistrations = [];
      window.__appsViewportRun = null;
      window.__appsRecordViewport = (phase, observerId = null) => {
        const run = window.__appsViewportRun;
        if (!run) return;
        const element = run.element;
        const target = [...element.querySelectorAll('[data-message-key]')].find(
          (item) => item.dataset.messageKey === run.key,
        );
        const sample = {
          seq: ++sequence,
          phase,
          observerId,
          targetInstance: identity(element),
          connected: element.isConnected,
          height: element.clientHeight,
          gap: element.scrollHeight - element.scrollTop - element.clientHeight,
          offset: target
            ? target.getBoundingClientRect().top - element.getBoundingClientRect().top
            : null,
        };
        run.samples.push(sample);
        return sample;
      };
      // Invoke the native product callback once with unchanged entries and receiver.
      // Measurements never move scroll, reconcile layout or wait for a good value.
      window.ResizeObserver = class extends NativeResizeObserver {
        constructor(callback) {
          const observerId = ++nextObserver;
          super(function (entries, observer) {
            const run = window.__appsViewportRun;
            const measuresHistory = !!run && entries.some((entry) => entry.target === run.element);
            if (measuresHistory) window.__appsRecordViewport('productRO:start', observerId);
            try {
              callback.call(observer, entries, observer);
            } finally {
              if (measuresHistory) window.__appsRecordViewport('productRO:return', observerId);
            }
          });
          registrations.set(this, observerId);
        }
        observe(target, options) {
          if (target.dataset?.testid === 'agent-chat-history') {
            window.__appsResizeRegistrations.push({
              seq: ++sequence,
              phase: 'observe',
              observerId: registrations.get(this),
              targetInstance: identity(target),
            });
          }
          return super.observe(target, options);
        }
      };
      window.__appsViewportTargetIdentity = identity;
    });
  }
  async function sampleViewportChange(history, mode, action) {
    const before = await history.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const row = [...element.querySelectorAll('[data-message-key]')].find((item) => {
        const bounds = item.getBoundingClientRect();
        return bounds.bottom > rect.top && bounds.top < rect.bottom;
      });
      if (!row) throw Error('No visible history anchor');
      window.__appsViewportRun = {
        element,
        key: row.dataset.messageKey,
        samples: [],
        sampling: true,
      };
      const activeRun = window.__appsViewportRun;
      const sample = window.__appsRecordViewport('before');
      requestAnimationFrame(function tick() {
        if (window.__appsViewportRun !== activeRun || !activeRun.sampling) return;
        window.__appsRecordViewport('rawRAF');
        requestAnimationFrame(tick);
      });
      return { ...sample, key: row.dataset.messageKey };
    });
    await action();
    await settled();
    const { samples, registrations } = await page.evaluate(() => {
      window.__appsRecordViewport('settled');
      const run = window.__appsViewportRun;
      run.sampling = false;
      const result = {
        samples: run.samples,
        registrations: window.__appsResizeRegistrations.filter(
          (item) => item.targetInstance === window.__appsViewportTargetIdentity(run.element),
        ),
      };
      window.__appsViewportRun = null;
      return result;
    });
    const deviation = (sample) =>
      Math.abs(mode === 'bottom' ? sample.gap : sample.offset - before.offset);
    const raw = samples.filter((sample) => sample.phase === 'rawRAF');
    const post = samples.filter((sample) => sample.phase === 'productRO:return');
    const checked = [...post, samples.at(-1)];
    assert.ok(post.length > 0, 'The active product ResizeObserver callback must run');
    assert.ok(post.length <= 60, 'The bounded animation must not create a ResizeObserver loop');
    assert.ok(
      post.every((sample) =>
        registrations.some((registration) => registration.observerId === sample.observerId),
      ),
      'Post samples must come from the callback of an observer that actually observed this history node',
    );
    assert.ok(
      post.every((sample) =>
        samples.some(
          (start) =>
            start.phase === 'productRO:start' &&
            start.observerId === sample.observerId &&
            start.seq === sample.seq - 1,
        ),
      ),
      'Callback return must be measured synchronously after its actual start',
    );
    const stableDOM = samples.every(
      (sample) =>
        sample.connected &&
        sample.targetInstance === before.targetInstance &&
        sample.offset !== null,
    );
    const maxRawDeviation = Math.max(...raw.map(deviation));
    const maxPostDeviation = Math.max(...checked.map(deviation));
    return {
      mode,
      before,
      after: samples.at(-1),
      rawFrames: raw.length,
      productCallbacks: post.length,
      registrations,
      stableDOM,
      maxRawDeviation,
      maxPostDeviation,
      samples,
      pass: stableDOM && maxPostDeviation <= 1,
    };
  }

  return { instrumentResizeObserver, sampleViewportChange };
}
