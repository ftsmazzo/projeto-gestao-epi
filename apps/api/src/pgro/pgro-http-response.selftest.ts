import assert from 'node:assert/strict';
import {
  PgroResponseTooLargeError,
  readResponseTextWithLimit,
} from './pgro-http-response';

async function main() {
  const small = new Response('{"ok":true}', {
    headers: { 'content-type': 'application/json' },
  });
  assert.equal(await readResponseTextWithLimit(small, 100), '{"ok":true}');

  const declaredLarge = new Response('x', {
    headers: { 'content-length': '1000' },
  });
  await assert.rejects(
    () => readResponseTextWithLimit(declaredLarge, 100),
    PgroResponseTooLargeError,
  );

  const streamedLarge = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(80));
        controller.enqueue(new Uint8Array(80));
        controller.close();
      },
    }),
  );
  await assert.rejects(
    () => readResponseTextWithLimit(streamedLarge, 100),
    PgroResponseTooLargeError,
  );

  console.log('pgro-http-response.selftest OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
