import { watchFile, unwatchFile, type Stats } from 'node:fs';
import path from 'node:path';
import { discoveryCatalog } from '../core/application-discovery-catalog.js';

/** Monitor only the paths that can change installed ChatGPT identity or metadata. */
export function watchMacChatgptInstallations(
  roots: readonly string[],
  changed: () => void,
): { update: (paths: readonly string[]) => void; close: () => void } {
  const known = roots.flatMap((root) =>
    discoveryCatalog.codex.bundles.map(({ name }) => path.join(root, name)),
  );
  let watched = new Set<string>();
  let pending: ReturnType<typeof setTimeout> | undefined;
  let closed = false;

  function onStat(current: Stats, previous: Stats) {
    if (
      closed ||
      pending ||
      (current.ino === previous.ino &&
        current.dev === previous.dev &&
        current.size === previous.size &&
        current.mtimeMs === previous.mtimeMs &&
        current.ctimeMs === previous.ctimeMs)
    )
      return;
    pending = setTimeout(() => {
      pending = undefined;
      changed();
    }, 150);
    pending.unref();
  }

  function update(paths: readonly string[]) {
    if (closed) return;
    const next = new Set(
      [...known, ...paths].flatMap((bundle) => [
        path.join(bundle, 'Contents/Info.plist'),
        path.join(bundle, 'Contents/MacOS'),
      ]),
    );
    // A stat watcher keeps observing the original path across installs and atomic replacements.
    for (const filename of watched) if (!next.has(filename)) unwatchFile(filename, onStat);
    for (const filename of next)
      if (!watched.has(filename))
        watchFile(filename, { interval: 1500, persistent: false }, onStat);
    watched = next;
  }

  update([]);
  return {
    update,
    close() {
      closed = true;
      clearTimeout(pending);
      for (const filename of watched) unwatchFile(filename, onStat);
      watched.clear();
    },
  };
}
