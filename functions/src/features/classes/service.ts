import { Timestamp } from 'firebase-admin/firestore';
import { createClassSchema } from '@home-work/shared';
import type { z } from 'zod';
import type { Context } from '../../lib/firebase-admin';
import { classRef, hash, teacherRef } from '../../lib/records';
import { assertRetained, currentSchoolYear, expiresAt, retentionInfo } from '../../lib/retention';
import { fail } from '../../lib/errors';
import { mutate } from '../../services/request-results';
import { effectivePlan, limitFor, planRef, readUsage } from '../plans/records';
export function createClass(ctx: Context, uid: string, input: z.infer<typeof createClassSchema>) {
  const classId = hash(JSON.stringify([input.year, input.term, input.subject, input.group]));
  return mutate(ctx, uid, 'createClass', input, async tx => {
    assertRetained(input.year, ctx.now());
    if (input.year !== currentSchoolYear(ctx.now())) fail('failed-precondition', 'สร้างห้องเรียนได้เฉพาะปีการศึกษาปัจจุบัน', 'CURRENT_YEAR_ONLY');
    const ref = classRef(ctx, uid, classId);
    const subjectId = hash(input.subject);
    const subject = teacherRef(ctx, uid).collection('subjects').doc(subjectId);
    const [old, savedSubject, plan, job] = await tx.getAll(ref, subject, planRef(ctx, uid), ctx.db.doc(`classroomDeletionJobs/${hash(JSON.stringify([uid, classId]))}`));
    if (old.data()?.status === 'deleting' || (job.exists && job.data()!.status !== 'complete')) fail('failed-precondition', 'ห้องเรียนนี้กำลังลบข้อมูล กรุณาลองอีกครั้งภายหลัง', 'CLASS_DELETING');
    if (old.exists) fail('already-exists', 'มีห้องเรียนวิชาและกลุ่มนี้ในปีและภาคเรียนนี้แล้ว', 'DUPLICATE_CLASS');
    const usage = await readUsage(tx, ctx, uid, input.year);
    const planId = effectivePlan(plan.data(), ctx.now());
    const limit = limitFor(planId);
    if (limit !== null && usage.count >= limit) fail('resource-exhausted', 'จำนวนห้องเรียนเต็มตามแพ็กเกจ กรุณากรอกโค้ดหรือติดต่อผู้ดูแล', 'CLASSROOM_LIMIT', { classroomCount: usage.count, classroomLimit: limit });
    const record = { ownerId: uid, status: 'active', year: input.year, term: input.term, subject: input.subject, subjectId, group: input.group, rosterVersion: 0, version: 1, latestTaskId: null, createdAt: Timestamp.fromDate(ctx.now()), expiresAt: Timestamp.fromDate(expiresAt(input.year)) };
    if (!savedSubject.exists) tx.create(subject, { ownerId: uid, name: input.subject });
    tx.create(ref, record);
    tx.set(usage.ref, { schoolYear: input.year, classroomCount: usage.count + 1, updatedAt: Timestamp.fromDate(ctx.now()) });
    return { result: { classId, year: input.year, term: input.term, subject: input.subject, group: input.group, version: 1, rosterVersion: 0 }, year: input.year, changes: { classId, subject: input.subject, group: input.group } };
  });
}
export const getRetention = (ctx: Context) => retentionInfo(ctx.now());
