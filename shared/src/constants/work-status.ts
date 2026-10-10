export const SENT_STATUSES = ['on-time', 'late-1', 'late-2', 'late-3', 'late-4'] as const;
export const WORK_STATUSES = ['not-sent', ...SENT_STATUSES] as const;
export const STATUS_LABELS = {
  'not-sent': 'ยังไม่ส่ง', 'on-time': 'ส่งตรงเวลา',
  'late-1': 'ส่งสายระดับ 1', 'late-2': 'ส่งสายระดับ 2',
  'late-3': 'ส่งสายระดับ 3', 'late-4': 'ส่งสายระดับ 4',
} as const;
