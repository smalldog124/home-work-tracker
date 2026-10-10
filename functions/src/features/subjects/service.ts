import { subjectSchema } from '@home-work/shared';
import type { z } from 'zod';
import type { Context } from '../../lib/firebase-admin';
import { hash, teacherRef } from '../../lib/records';
import { currentSchoolYear } from '../../lib/retention';
import { mutate } from '../../services/request-results';
export function saveSubject(ctx: Context, uid: string, input: z.infer<typeof subjectSchema>) {
  return mutate(ctx, uid, 'saveSubject', input, async tx => {
    const id = hash(input.name); const ref = teacherRef(ctx, uid).collection('subjects').doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) tx.create(ref, { ownerId: uid, name: input.name });
    return { result: { subjectId: id, name: input.name }, year: currentSchoolYear(ctx.now()), changes: { subjectId: id, name: input.name } };
  });
}
