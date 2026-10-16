import { afterEach, expect, it, vi } from 'vitest';
import { planCodeSchema } from '@home-work/shared';
import { generatePlanCode } from './code';

const random = vi.hoisted(() => vi.fn<(max: number) => number>());

vi.mock('node:crypto', async importOriginal => ({
  ...await importOriginal<typeof import('node:crypto')>(),
  randomInt: random,
}));
afterEach(() => vi.resetAllMocks());

it('resamples letter-only and digit-only candidates before returning a mixed five-character code', () => {
  // AAAAA, 00000, then A7K2P.
  for (const index of [0, 0, 0, 0, 0, 26, 26, 26, 26, 26, 0, 33, 10, 28, 15]) {
    random.mockReturnValueOnce(index);
  }
  expect(generatePlanCode()).toBe('A7K2P');
  expect(random).toHaveBeenCalledTimes(15);
  expect(random).toHaveBeenCalledWith(36);
});

it('produces codes accepted by the shared input contract', async () => {
  const crypto = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  random.mockImplementation(max => crypto.randomInt(max));
  for (let n = 0; n < 100; n++) {
    const code = generatePlanCode();
    expect(planCodeSchema.parse(code)).toBe(code);
  }
});
