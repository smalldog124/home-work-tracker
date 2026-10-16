import { randomInt } from 'node:crypto';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function generatePlanCode() {
  for (;;) {
    const code = Array.from({ length: 5 }, () => alphabet[randomInt(alphabet.length)]).join('');
    if (/[A-Z]/.test(code) && /[0-9]/.test(code)) return code;
  }
}
