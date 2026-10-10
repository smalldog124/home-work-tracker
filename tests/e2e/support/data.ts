export const NOW = '2026-10-10T05:00:00.000Z';
export const OLD_DATE = '2026-10-08T05:00:00.000Z';
export const statuses = ['ส่งตรงเวลา', 'ส่งสายระดับ 1', 'ส่งสายระดับ 2', 'ส่งสายระดับ 3', 'ส่งสายระดับ 4'] as const;
export type SentStatus = typeof statuses[number];
export type Status = SentStatus | 'ยังไม่ส่ง';

export function baseline() {
  return {
    now: NOW,
    teachers: [
      { id: 'teacher-a', name: 'ครูทดสอบ ก', email: 'a@example.test' },
      { id: 'teacher-b', name: 'ครูทดสอบ ข', email: 'b@example.test' },
    ],
    classes: [
      { id: 'class-a', ownerId: 'teacher-a', year: 2569, term: 1, subject: 'คณิตศาสตร์', group: 'ม.1/1' },
      { id: 'class-other', ownerId: 'teacher-a', year: 2569, term: 1, subject: 'วิทยาศาสตร์', group: 'ม.1/2' },
      { id: 'class-b', ownerId: 'teacher-b', year: 2569, term: 1, subject: 'ภาษาไทย', group: 'ม.2/1' },
    ],
    students: [
      { id: 'student-a', classId: 'class-a', number: 1, name: 'สมชาย ทดสอบ', active: true },
      { id: 'student-a2', classId: 'class-a', number: 2, name: 'สมหญิง ทดสอบ', active: true },
      { id: 'student-off', classId: 'class-a', number: 3, name: 'พักใช้ ทดสอบ', active: false },
      { id: 'student-other', classId: 'class-other', number: 1, name: 'อีกห้อง ทดสอบ', active: true },
      { id: 'student-b', classId: 'class-b', number: 1, name: 'ส่วนตัว ครูข', active: true },
    ],
    tasks: [1, 2, 3].map(order => ({ id: `task-${order}`, classId: 'class-a', order, name: `ชิ้นงานที่ ${order}`, createdAt: `2026-10-0${order}T05:00:00.000Z` })),
    work: [{ studentId: 'student-a', taskId: 'task-1', status: 'ส่งตรงเวลา' as Status, savedAt: OLD_DATE }],
  };
}
export type Seed = ReturnType<typeof baseline>;
export interface Work {
  classId: string; studentId: string; taskId: string; status: Status; savedAt: string;
}
export interface Snapshot {
  students: Seed['students'];
  tasks: Seed['tasks'];
  work: Work[];
  requests: { id: string; ownerId: string; action: string; confirmed: boolean }[];
  audit: { action: string; studentId?: string; taskId?: string }[];
}
export interface SeedResult {
  qr: Record<string, string>;
  replacedQr: string;
}
