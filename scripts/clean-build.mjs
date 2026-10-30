import { rm } from 'node:fs/promises';

// Removed and renamed modules must not survive in the packaged application.
await rm(new URL('../build/', import.meta.url), { recursive: true, force: true });
