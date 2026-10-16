import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomDisplayName } from '@home-work/shared';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/dialog';
import { ErrorState } from '@/components/ErrorState';
import { newRequestId } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '../auth/useAuth';
import { deleteClass, type ClassRecord } from './api';
export function DeleteClassPanel({ classroom, currentYear, onClose }: { classroom: ClassRecord; currentYear: number; onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const displayed = classroomDisplayName(classroom.subject, classroom.group);
  async function remove() {
    if (busy || name !== displayed) return;
    setBusy(true); setError(undefined);
    try {
      await deleteClass({ requestId: newRequestId(), classId: classroom.id, confirmationName: name });
      try {
        const key = `recent:${user!.uid}`;
        const recent: ClassRecord[] = JSON.parse(sessionStorage.getItem(key) || '[]');
        sessionStorage.setItem(key, JSON.stringify(recent.filter(row => row.id !== classroom.id)));
      } catch { /* Optional recent history. */ }
      queryClient.removeQueries({ queryKey: [user!.uid, 'class', classroom.id] });
      await queryClient.invalidateQueries({ queryKey: [user!.uid] });
      navigate('/classes', { replace: true });
    } catch (error) { setError(error); }
    finally { setBusy(false); }
  }
  return <Panel title="ลบห้องเรียน" onClose={onClose} locked={busy}>
    <p data-testid="deletion-class-name">{displayed}</p>
    <p>ปีการศึกษา {classroom.year} · ภาคเรียน {classroom.term}</p>
    <p className="notice">ห้องเรียน รายชื่อนักเรียน ชิ้นงาน คะแนน ประวัติการส่งงาน และข้อมูลที่เกี่ยวข้องจะถูกลบ ไม่สามารถกู้คืนได้</p>
    {classroom.year !== currentYear && <p className="notice">การลบห้องเรียนปีเก่าไม่คืนสิทธิ์สร้างห้องเรียนในปีปัจจุบัน</p>}
    <label>พิมพ์ชื่อห้องเรียนตามที่แสดง<input value={name} disabled={busy} onChange={e => setName(e.target.value)} autoComplete="off" /></label>
    {error !== undefined && <ErrorState error={error} />}
    <div className="actions"><Button variant="outline" disabled={busy} onClick={onClose}>ยกเลิก</Button><Button disabled={busy || name !== displayed} onClick={() => void remove()}>ยืนยันการลบ</Button></div>
  </Panel>;
}
