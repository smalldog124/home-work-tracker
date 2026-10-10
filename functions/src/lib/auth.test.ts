import { expect, it, vi } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { authorize } from './auth';
const request = { auth: { uid: 'teacher' }, rawRequest: { headers: { authorization: 'Bearer token' } } } as CallableRequest<unknown>;
const identity = { uid: 'teacher', firebase: { sign_in_provider: 'google.com' } } as DecodedIdToken;
it('accepts Google identity verified again with revocation checking', async () => {
  const verify = vi.fn().mockResolvedValue(identity); expect(await authorize(request, verify)).toEqual(identity); expect(verify).toHaveBeenCalledWith('token');
});
it.each(['expired', 'revoked', 'disabled', 'wrong-project', 'forged'])('rejects %s tokens', async () => {
  await expect(authorize(request, async () => { throw new Error('rejected'); })).rejects.toMatchObject({ code: 'unauthenticated' });
});
it('rejects missing session without calling verifier', async () => {
  const verify = vi.fn(); await expect(authorize({ ...request, auth: undefined }, verify)).rejects.toMatchObject({ code: 'unauthenticated' }); expect(verify).not.toHaveBeenCalled();
});
it('rejects mismatched identity and non-Google provider', async () => {
  await expect(authorize(request, async () => ({ ...identity, uid: 'other' }))).rejects.toMatchObject({ code: 'unauthenticated' });
  await expect(authorize(request, async () => ({ ...identity, firebase: { ...identity.firebase, sign_in_provider: 'password' } }))).rejects.toMatchObject({ code: 'unauthenticated' });
});
