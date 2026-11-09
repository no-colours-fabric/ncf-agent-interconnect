// Operator control for the isolated research fixture node (--control).
// Usage: node control.mjs <hold|release|arm|transfer> ['{"trigger":"turn.start"}']
// It reads the fixture descriptor and never prints the token.
import { readFile } from 'node:fs/promises';
const descriptor = JSON.parse(
  await readFile(
    (process.env.NCF_RESEARCH_HOME ?? process.env.HOME + '/ncf-readiness') +
      '/node/research-first-wake.json',
    'utf8',
  ),
);
const [route, body = '{}'] = process.argv.slice(2);
const response = await fetch(descriptor.url + '/fixture/' + route, {
  method: 'POST',
  headers: { authorization: 'Bearer ' + descriptor.token },
  body,
});
console.log(response.status, await response.text());
