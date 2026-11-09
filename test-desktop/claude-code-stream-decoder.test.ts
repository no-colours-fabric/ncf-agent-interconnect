import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ClaudeJsonLineDecoder } from '../desktop/integrations/claude-code.js';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');

test('Claude helper and wake frames preserve exact Unicode and notice hashes at every byte split', () => {
  const nickname = 'Борис 漢字 🧑🏽‍💻 e\u0301';
  const notice = `NCF messages for ${JSON.stringify(nickname)}: wake-reference`;
  const frames = [
    { type: 'ready' },
    { type: 'wake', nickname },
    { type: 'wake', claim: 'a'.repeat(64), notice },
  ];
  const bytes = Buffer.from(frames.map((frame) => JSON.stringify(frame) + '\n').join(''));
  for (const limit of [65536, 1024 * 1024]) {
    for (let split = 1; split < bytes.length; split++) {
      const decoder = new ClaudeJsonLineDecoder(limit);
      const decoded = [
        ...decoder.push(bytes.subarray(0, split)),
        ...decoder.push(bytes.subarray(split)),
      ];
      decoder.finish();
      assert.deepEqual(decoded, frames, `Byte split ${split}, limit ${limit}`);
      assert.equal(digest(String(decoded[2].notice)), digest(notice));
    }
    const decoder = new ClaudeJsonLineDecoder(limit);
    const decoded = [...bytes].flatMap((byte) => decoder.push(Uint8Array.of(byte)));
    decoder.finish();
    assert.deepEqual(decoded, frames);
  }
});

test('Claude stream decoding rejects malformed UTF-8, incomplete frames and oversized buffers', () => {
  const malformed = new ClaudeJsonLineDecoder(65536);
  assert.throws(() => malformed.push(Uint8Array.of(0xff)));
  const truncatedCharacter = new ClaudeJsonLineDecoder(65536);
  truncatedCharacter.push(Uint8Array.of(0xe6));
  assert.throws(() => truncatedCharacter.finish());
  const truncatedFrame = new ClaudeJsonLineDecoder(65536);
  truncatedFrame.push(Buffer.from('{"type":"ready"}'));
  assert.throws(() => truncatedFrame.finish(), /incomplete frame/);
  const bounded = new ClaudeJsonLineDecoder(64);
  assert.throws(() => bounded.push(Buffer.from('漢'.repeat(22))), /too large/);
});
