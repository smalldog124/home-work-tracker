import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { fail } from './errors';
export async function authorize(request: CallableRequest<unknown>, verify = (token: string) => getAuth().verifyIdToken(token, true)): Promise<DecodedIdToken> {
  const authorization = request.rawRequest.headers.authorization;
  if (!request.auth || !authorization?.startsWith('Bearer ')) fail('unauthenticated', 'กรุณาเข้าสู่ระบบด้วย Google', 'AUTH_REQUIRED');
  let token: DecodedIdToken;
  try { token = await verify(authorization.slice(7)); }
  catch { fail('unauthenticated', 'บัญชีหรือการเข้าสู่ระบบนี้ใช้ไม่ได้ กรุณาเข้าสู่ระบบอีกครั้ง', 'SESSION_INVALID'); }
  if (token.uid !== request.auth.uid || token.firebase.sign_in_provider !== 'google.com') fail('unauthenticated', 'กรุณาเข้าสู่ระบบด้วย Google', 'GOOGLE_REQUIRED');
  return token;
}
