import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';

const timings: number[] = [];
for (let index = 0; index < 5; index++) {
  const started = performance.now();
  const hash = await argon2.hash(randomBytes(32).toString('base64url'), {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  if (!hash.startsWith('$argon2id$'))
    throw new Error('Unexpected hashing algorithm');
  timings.push(performance.now() - started);
}
console.log(
  JSON.stringify(
    {
      algorithm: 'argon2id',
      memoryKiB: 19_456,
      timeCost: 2,
      parallelism: 1,
      meanMs: Math.round(
        timings.reduce((sum, value) => sum + value, 0) / timings.length,
      ),
      maxMs: Math.round(Math.max(...timings)),
      note: 'Rebenchmark on deployment hardware under expected concurrent load.',
    },
    null,
    2,
  ),
);
