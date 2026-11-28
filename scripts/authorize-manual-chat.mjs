// Run locally as the profile owner, using a public key shown by the exact host chat.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { authorizeManualChat } from '../build/core/manual-chat-channel.js';
import { nicknameKey } from '../build/shared/contracts.js';
const [action, directory, ...args] = process.argv.slice(2);
if (
  !directory ||
  !path.isAbsolute(directory) ||
  !((action === 'authorize' && args.length === 4) || (action === 'revoke' && args.length === 1))
)
  throw new Error(
    'Use authorize ABSOLUTE_NODE_DIRECTORY AGENT SAVED_CHAT HOST_CHAT PUBLIC_KEY_FILE, or revoke ABSOLUTE_NODE_DIRECTORY KEY_FINGERPRINT',
  );
const db = new DatabaseSync(realpathSync(path.join(directory, 'agents.sqlite')), {
  readOnly: false,
});
try {
  db.exec('BEGIN IMMEDIATE');
  let grant;
  if (action === 'authorize') {
    const [nickname, chat, externalChat, keyFile] = args;
    const conf = JSON.parse(readFileSync(path.join(directory, 'settings.json'), 'utf8'));
    const row = db
      .prepare('SELECT binding FROM agents WHERE name_key=?')
      .get(nicknameKey(nickname));
    if (
      !row?.binding ||
      !conf.adapters.some((p) => p.kind === 'manual' && p.id === JSON.parse(row.binding).adapterId)
    )
      throw new Error('Choose an existing Standard MCP chat');
    grant = authorizeManualChat(db, nickname, chat, externalChat, readFileSync(keyFile, 'utf8'));
  } else db.prepare('DELETE FROM manual_send_grants WHERE key=?').run(args[0]);
  db.exec('COMMIT');
  if (grant) process.stdout.write(JSON.stringify(grant) + '\n');
} finally {
  db.close();
}
