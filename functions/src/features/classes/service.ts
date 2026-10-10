import { Timestamp } from 'firebase-admin/firestore';
import { createClassSchema } from '@home-work/shared';
import type { z } from 'zod';
import type { Context } from '../../lib/firebase-admin';
import { classRef, hash, teacherRef } from '../../lib/records';
import { assertRetained, expiresAt, retentionInfo } from '../../lib/retention';
import { fail } from '../../lib/errors';
import { mutate } from '../../services/request-results';
export function createClass(ctx: Context, uid: string, input: z.infer<typeof createClassSchema>) {
  const classId = hash(JSON.stringify([input.year, input.term, input.subject, input.group]));
  return mutate(ctx, uid, 'createClass', input, async tx => {
    assertRetained(input.year, ctx.now());
    const ref = classRef(ctx, uid, classId);
    const subjectId = hash(input.subject);
    const subject = teacherRef(ctx, uid).collection('subjects').doc(subjectId);
    const [old, savedSubject] = await tx.getAll(ref, subject);
    if (old.exists) fail('already-exists', 'มีห้องเรียนวิชาและกลุ่มนี้ในปีและภาคเรียนนี้แล้ว', 'DUPLICATE_CLASS');
    const record = { ownerId: uid, year: input.year, term: input.term, subject: input.subject, subjectId, group: input.group, rosterVersion: 0, version: 1, latestTaskId: null, createdAt: Timestamp.fromDate(ctx.now()), expiresAt: Timestamp.fromDate(expiresAt(input.year)) };
    if (!savedSubject.exists) tx.create(subject, { ownerId: uid, name: input.subject });
    tx.create(ref, record);
    return { result: { classId, year: input.year, term: input.term, subject: input.subject, group: input.group, version: 1, rosterVersion: 0 }, year: input.year, changes: { classId, subject: input.subject, group: input.group } };
  });
}
export const getRetention = (ctx: Context) => retentionInfo(ctx.now());
