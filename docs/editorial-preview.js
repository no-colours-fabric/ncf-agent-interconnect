/* Local messenger simulations. No live agents, requests or outgoing messages. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const END_PAUSE = 8000;
  let motionEnabled = !reducedMotion.matches;
  const copy = (key, params) => window.NCF_HOME.text(key, params);
  const artifactDialog = document.querySelector('.artifact-dialog');
  let artifactTrigger = null;
  let frame = 0;
  let previousTime = null;

  const demos = [...document.querySelectorAll('[data-demo]')].map((windowElement) => {
    const figure = windowElement.closest('figure');
    const events = [...windowElement.querySelectorAll('.demo-event')].map((element) => {
      const original = element.querySelector('.demo-full');
      const visual = document.createElement('span');
      visual.className = 'demo-visual';
      visual.setAttribute('aria-hidden', 'true');
      visual.textContent = original.textContent;
      original.parentElement.append(visual);
      return {
        element,
        visual,
        source: original,
        text: original.textContent,
        user: element.classList.contains('demo-user'),
        message: element.classList.contains('demo-message'),
        artifact: element.classList.contains('demo-artifact'),
        speaker: element.querySelector('.demo-speaker')?.firstChild?.textContent.trim() || '',
      };
    });
    return {
      windowElement,
      figure,
      events,
      scroller: windowElement.querySelector('.demo-scroll'),
      composer: windowElement.querySelector('.demo-compose'),
      draft: windowElement.querySelector('.demo-draft-text'),
      jump: windowElement.querySelector('.demo-jump'),
      status: figure.querySelector('.demo-status'),
      pauseButton: figure.querySelector('[data-demo-pause]'),
      heading: windowElement.querySelector('.demo-heading strong'),
      visible: false,
      started: false,
      paused: false,
      followTail: true,
      manualScroll: false,
      phase: 'waiting',
      elapsed: 0,
      index: 0,
      cycle: 0,
      newCount: 0,
    };
  });

  function setPhase(demo, phase) {
    demo.phase = phase;
    demo.elapsed = 0;
    demo.windowElement.dataset.phase = phase;
  }

  function scrollToTail(demo) {
    if (demo.followTail) demo.scroller.scrollTop = demo.scroller.scrollHeight;
  }

  function updateJump(demo) {
    demo.windowElement.dataset.followTail = String(demo.followTail);
    demo.jump.hidden = demo.followTail;
    demo.jump.textContent =
      demo.newCount > 0 ? copy('u321', { count: demo.newCount }) : copy('u322');
  }

  function describe(demo) {
    let text;
    if (demo.phase === 'waiting') text = copy('u046');
    else if (demo.phase === 'static') text = copy('u323');
    else if (demo.paused) text = copy('u324');
    else if (!demo.followTail) text = copy('u325');
    else if (demo.phase === 'end')
      text = copy('u326', { seconds: Math.ceil((END_PAUSE - demo.elapsed) / 1000) });
    else if (demo.phase === 'compose' || demo.phase === 'send') text = copy('u327');
    else if (demo.phase === 'typing')
      text = copy('u328', { speaker: demo.events[demo.index].speaker });
    else text = copy('u329');
    if (demo.status.textContent !== text) demo.status.textContent = text;
    const label =
      demo.phase === 'static' ? copy('u330') : demo.paused ? copy('u331') : copy('u047');
    demo.pauseButton.textContent = label;
    demo.pauseButton.setAttribute('aria-pressed', String(demo.paused));
  }

  function clearDraft(demo) {
    demo.draft.textContent = copy('u045');
    demo.composer.classList.remove('is-composing', 'is-sending');
  }

  function reveal(demo, event) {
    event.element.hidden = false;
    event.element.classList.add('is-arriving');
    if (!demo.followTail) demo.newCount += 1;
    if (event.element.dataset.connectName)
      demo.heading.textContent = event.element.dataset.connectName;
    updateJump(demo);
    scrollToTail(demo);
  }

  function beginEvent(demo) {
    if (demo.index >= demo.events.length) {
      setPhase(demo, 'end');
      describe(demo);
      return;
    }
    const event = demo.events[demo.index];
    if (event.user) {
      demo.composer.classList.add('is-composing');
      demo.draft.textContent = '';
      setPhase(demo, 'compose');
    } else {
      event.visual.textContent = event.message ? '' : event.text;
      reveal(demo, event);
      if (event.message) event.element.classList.add('is-typing');
      setPhase(demo, event.message ? 'typing' : 'reading');
    }
    describe(demo);
  }

  function reset(demo, start = false) {
    demo.events.forEach((event) => {
      event.element.hidden = true;
      event.visual.textContent = '';
      event.element.classList.remove('is-arriving', 'is-typing');
    });
    clearDraft(demo);
    demo.index = 0;
    demo.followTail = true;
    demo.manualScroll = false;
    demo.newCount = 0;
    demo.scroller.scrollTop = 0;
    if (demo.windowElement.dataset.demo === 'contact') demo.heading.textContent = copy('u029');
    updateJump(demo);
    setPhase(demo, 'waiting');
    if (start) {
      demo.started = true;
      demo.cycle += 1;
      demo.windowElement.dataset.cycle = String(demo.cycle);
      beginEvent(demo);
    }
    describe(demo);
  }

  function showAll(demo) {
    demo.events.forEach((event) => {
      event.element.hidden = false;
      event.visual.textContent = event.text;
      event.element.classList.remove('is-arriving', 'is-typing');
      if (event.element.dataset.connectName)
        demo.heading.textContent = event.element.dataset.connectName;
    });
    clearDraft(demo);
    demo.started = true;
    demo.paused = true;
    demo.followTail = false;
    demo.manualScroll = false;
    demo.newCount = 0;
    setPhase(demo, 'static');
    demo.scroller.scrollTop = 0;
    updateJump(demo);
    describe(demo);
  }

  function advance(demo, delta) {
    if (demo.phase === 'waiting') {
      demo.started = true;
      demo.cycle += 1;
      demo.windowElement.dataset.cycle = String(demo.cycle);
      beginEvent(demo);
    }
    // A detached reader keeps the completed thread; looping waits for their return.
    if (demo.phase === 'end' && !demo.followTail) {
      describe(demo);
      return;
    }
    demo.elapsed += delta;
    if (demo.phase === 'end') {
      if (demo.elapsed >= END_PAUSE) reset(demo, true);
      else describe(demo);
      return;
    }
    const event = demo.events[demo.index];
    if (demo.phase === 'compose' || demo.phase === 'typing') {
      const duration = Math.max(1200, event.text.length * (event.user ? 46 : 39)) / 1.5;
      const count = Math.min(
        event.text.length,
        Math.floor((event.text.length * demo.elapsed) / duration),
      );
      if (event.user) demo.draft.textContent = event.text.slice(0, count);
      else event.visual.textContent = event.text.slice(0, count);
      scrollToTail(demo);
      if (demo.elapsed >= duration) {
        if (event.user) {
          demo.composer.classList.add('is-sending');
          setPhase(demo, 'send');
        } else {
          event.element.classList.remove('is-typing');
          setPhase(demo, 'reading');
        }
      }
    } else if (demo.phase === 'send' && demo.elapsed >= 700) {
      event.visual.textContent = event.text;
      reveal(demo, event);
      clearDraft(demo);
      setPhase(demo, 'reading');
    } else if (demo.phase === 'reading') {
      const pause =
        (event.artifact
          ? 4800
          : event.message
            ? Math.max(1700, Math.min(4000, event.text.length * 25))
            : 1500) / 3;
      if (demo.elapsed >= pause) {
        event.element.classList.remove('is-arriving');
        demo.index += 1;
        beginEvent(demo);
      }
    }
    describe(demo);
  }

  function isActive(demo) {
    return (
      !artifactDialog.open &&
      motionEnabled &&
      demo.visible &&
      !demo.paused &&
      demo.phase !== 'static'
    );
  }

  function schedule() {
    if (!frame && !document.hidden && demos.some(isActive)) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    const delta = previousTime === null ? 0 : Math.min(80, now - previousTime);
    previousTime = now;
    if (!document.hidden) demos.filter(isActive).forEach((demo) => advance(demo, delta));
    if (document.hidden || !demos.some(isActive)) previousTime = null;
    else schedule();
  }

  function syncMotion() {
    demos.forEach((demo) => {
      demo.paused = false;
      if (motionEnabled) reset(demo);
      else showAll(demo);
    });
    previousTime = null;
    schedule();
  }

  document.body.classList.add('motion-ready');
  reducedMotion.addEventListener('change', () => {
    motionEnabled = !reducedMotion.matches;
    syncMotion();
  });

  demos.forEach((demo) => {
    demo.figure.querySelector('.demo-controls').hidden = false;
    demo.figure.querySelector('[data-demo-show]').addEventListener('click', () => showAll(demo));
    demo.figure.querySelector('[data-demo-replay]').addEventListener('click', () => {
      if (!motionEnabled) {
        showAll(demo);
        return;
      }
      demo.paused = false;
      reset(demo);
      schedule();
    });
    demo.pauseButton.addEventListener('click', () => {
      if (!motionEnabled) return;
      if (demo.phase === 'static') {
        demo.paused = false;
        reset(demo);
      } else demo.paused = !demo.paused;
      describe(demo);
      schedule();
    });
    demo.jump.addEventListener('click', () => {
      demo.followTail = true;
      demo.manualScroll = false;
      demo.newCount = 0;
      scrollToTail(demo);
      updateJump(demo);
      describe(demo);
      schedule();
    });
    demo.scroller.addEventListener(
      'wheel',
      (event) => {
        if (demo.scroller.scrollHeight <= demo.scroller.clientHeight) return;
        if (event.deltaY < 0) {
          demo.manualScroll = true;
          demo.followTail = false;
          updateJump(demo);
        } else if (!demo.followTail) demo.manualScroll = true;
      },
      { passive: true },
    );
    demo.scroller.addEventListener('pointerdown', (event) => {
      const rect = demo.scroller.getBoundingClientRect();
      if (
        demo.scroller.scrollHeight > demo.scroller.clientHeight &&
        event.clientX >= rect.left + demo.scroller.clientWidth - 12
      )
        demo.manualScroll = true;
    });
    demo.scroller.addEventListener(
      'touchmove',
      () => {
        if (demo.scroller.scrollHeight <= demo.scroller.clientHeight) return;
        demo.manualScroll = true;
        demo.followTail = false;
        updateJump(demo);
      },
      { passive: true },
    );
    demo.scroller.addEventListener('keydown', (event) => {
      if (demo.scroller.scrollHeight <= demo.scroller.clientHeight) return;
      if (demo.followTail && ['ArrowDown', 'PageDown', 'End'].includes(event.key)) return;
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) {
        demo.manualScroll = true;
        if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) demo.followTail = false;
        updateJump(demo);
      }
    });
    demo.scroller.addEventListener(
      'scroll',
      () => {
        // Content growth and our own scrolling are not manual detachment.
        if (!demo.manualScroll) return;
        const remaining =
          demo.scroller.scrollHeight - demo.scroller.clientHeight - demo.scroller.scrollTop;
        demo.followTail = remaining <= 2;
        if (demo.followTail) {
          demo.newCount = 0;
          demo.manualScroll = false;
        }
        updateJump(demo);
        describe(demo);
        schedule();
      },
      { passive: true },
    );
  });

  document.querySelectorAll('[data-artifact]').forEach((button) => {
    button.addEventListener('click', () => {
      artifactTrigger = button;
      document.querySelector('#artifact-title').textContent =
        button.querySelector('.demo-full').textContent;
      artifactDialog
        .querySelector('.artifact-content')
        .replaceChildren(
          document.querySelector(`#artifact-${button.dataset.artifact}`).content.cloneNode(true),
        );
      artifactDialog.showModal();
      artifactDialog.querySelector('.artifact-content').scrollTop = 0;
      previousTime = null;
    });
  });
  artifactDialog
    .querySelector('.artifact-close')
    .addEventListener('click', () => artifactDialog.close());
  artifactDialog.addEventListener('close', () => {
    artifactTrigger?.focus({ preventScroll: true });
    previousTime = null;
    schedule();
  });

  syncMotion();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const demo = demos.find((item) => item.windowElement === entry.target);
          demo.visible = entry.isIntersecting && entry.intersectionRatio >= 0.05;
        });
        schedule();
      },
      { threshold: [0, 0.05] },
    );
    demos.forEach((demo) => observer.observe(demo.windowElement));
  } else {
    demos.forEach(showAll);
  }
  document.addEventListener('visibilitychange', () => {
    previousTime = null;
    schedule();
  });
  if ('ResizeObserver' in window) {
    const layoutObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const demo = demos.find(
          (item) =>
            item.scroller === entry.target ||
            item.windowElement.querySelector('.demo-events') === entry.target,
        );
        if (demo) scrollToTail(demo);
      });
    });
    demos.forEach((demo) => {
      layoutObserver.observe(demo.scroller);
      layoutObserver.observe(demo.windowElement.querySelector('.demo-events'));
    });
  }
  document.addEventListener('ncf-home-language-change', () => {
    demos.forEach((demo) => {
      demo.events.forEach((event, index) => {
        const previousLength = event.text.length;
        const active =
          index === demo.index && (demo.phase === 'compose' || demo.phase === 'typing');
        const fraction =
          active && previousLength
            ? Math.min(
                1,
                demo.elapsed / (Math.max(1200, previousLength * (event.user ? 46 : 39)) / 1.5),
              )
            : 1;
        event.text = event.source.textContent;
        event.speaker =
          event.element.querySelector('.demo-speaker')?.firstChild?.textContent.trim() || '';
        if (active) {
          const duration = Math.max(1200, event.text.length * (event.user ? 46 : 39)) / 1.5;
          demo.elapsed = fraction * duration;
          const count = Math.min(event.text.length, Math.floor(event.text.length * fraction));
          if (event.user) demo.draft.textContent = event.text.slice(0, count);
          else event.visual.textContent = event.text.slice(0, count);
        } else if (!event.element.hidden) event.visual.textContent = event.text;
      });
      if (demo.phase === 'send') demo.draft.textContent = demo.events[demo.index].text;
      else if (demo.phase !== 'compose') demo.draft.textContent = copy('u045');
      if (demo.windowElement.dataset.demo === 'contact') {
        const connected = demo.events.find(
          (event) => event.element.dataset.connectName && !event.element.hidden,
        );
        demo.heading.textContent = connected ? connected.element.dataset.connectName : copy('u029');
      }
      updateJump(demo);
      describe(demo);
    });
  });
})();
