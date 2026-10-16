import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PLAN_DEFINITIONS, type PlanSummary as Summary } from '@home-work/shared';
import { Button } from '@/components/ui/button';
import { ContactAdminPanel } from './ContactAdminPanel';
import { thaiDate } from '@/lib/date';
export function PlanSummary({ plan }: { plan: Summary }) {
  const [contact, setContact] = useState(false);
  const navigate = useNavigate();
  const full = plan.classroomLimit !== null && plan.classroomCount >= plan.classroomLimit;
  return <section className="plan-summary" aria-label="แพ็กเกจของคุณ">
    <div data-testid="plan-summary">
      <h2>{PLAN_DEFINITIONS[plan.planId].name}</h2>
      <p>ปีการศึกษาปัจจุบัน {plan.schoolYear} · ห้องเรียน {plan.classroomCount} / {plan.classroomLimit ?? 'Unlimited (ไม่จำกัด)'}</p>
      <p className="muted">นับรวมทุกวิชาและทั้งสองภาคเรียน</p>
    </div>
    {plan.expiresAt && <p data-testid="plan-expires-at">แพ็กเกจสิ้นสุด {thaiDate(plan.expiresAt)} (เวลาประเทศไทย)</p>}
    <p className="muted" data-testid="data-retention-policy">จัดเก็บข้อมูล 3 ปีการศึกษา ทุกแพ็กเกจใช้ระยะเวลาจัดเก็บเท่ากัน</p>
    {full && <p className="notice">จำนวนห้องเรียนเต็มตามแพ็กเกจ จึงยังสร้างห้องใหม่ไม่ได้ ห้องเรียนเดิมยังใช้งานได้ กรุณากรอกโค้ดเพื่อเปลี่ยนแพ็กเกจ หรือลบห้องของปีปัจจุบันให้เหลือน้อยกว่า {plan.classroomLimit} ห้อง</p>}
    <div className="actions">
      <Button type="button" variant="outline" onClick={() => navigate('/plan/code')}>กรอกโค้ด</Button>
      <Button type="button" variant="ghost" onClick={() => setContact(true)}>ติดต่อผู้ดูแล</Button>
    </div>
    {contact && <ContactAdminPanel onClose={() => setContact(false)} />}
  </section>;
}
