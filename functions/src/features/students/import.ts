import { randomUUID } from 'node:crypto';
import { importStudentsSchema } from '@home-work/shared';
import type { z } from 'zod';
import type { Context } from '../../lib/firebase-admin';
import { readClass, expiryFields, type StudentRecord } from '../../lib/records';
import { checkVersion } from '../../lib/errors';
import { mutate } from '../../services/request-results';
import { newQr, writeQr } from '../qr/service';
export function importStudents(ctx: Context, uid: string, input: z.infer<typeof importStudentsSchema>) {
  return mutate(ctx, uid, 'importStudents', input, async tx => {
    const { ref, record } = await readClass(tx, ctx, uid, input.classId); checkVersion(record.rosterVersion, input.expectedRosterVersion);
    // Fetch only reviewed numbers, in Firestore's <=30-value query groups.
    const snapshots = [];
    for (let i = 0; i < input.rows.length; i += 30) snapshots.push(await tx.get(ref.collection('students').where('number', 'in', input.rows.slice(i, i + 30).map(row => row.number))));
    const existing = new Map(snapshots.flatMap(snap => snap.docs).map(doc => [doc.data().number as number, doc]));
    const counts = { added: 0, changed: 0, unchanged: 0 };
    const changes: Record<string, unknown>[] = [];
    for (const row of input.rows) {
      const oldDoc = existing.get(row.number);
      if (oldDoc) {
        const old = oldDoc.data() as StudentRecord;
        if (old.name === row.name) counts.unchanged++;
        else {
          tx.update(oldDoc.ref, { name: row.name, version: old.version + 1 }); counts.changed++;
          changes.push({ studentId: oldDoc.id, old: { name: old.name }, new: { name: row.name } });
        }
      } else {
        const id = randomUUID(); const qr = newQr(uid, input.classId, id, record, row.number);
        tx.create(ref.collection('students').doc(id), { ...expiryFields(record.year), ...row, active: true, version: 1, currentQrId: qr.id, publicCode: qr.publicCode }); writeQr(tx, ctx, qr);
        counts.added++; changes.push({ studentId: id, new: row });
      }
    }
    const rosterVersion = record.rosterVersion + 1;
    tx.update(ref, { rosterVersion, version: record.version + 1 });
    return { result: { ...counts, rosterVersion }, year: record.year, changes: { classId: input.classId, rows: changes } };
  });
}
