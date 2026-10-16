import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PLAN_DEFINITIONS, planCodeSchema, redeemPlanCodeSchema, type PlanPreview } from '@home-work/shared';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ErrorState';
import { AccountChangedError, newRequestId, reason, uncertain } from '@/lib/api';
import { queryClient } from '@/lib/query-client';
import { thaiDate } from '@/lib/date';
import { useAuth } from '../auth/useAuth';
import { previewCode, redeemCode } from './api';
import { ContactAdminDetails } from './ContactAdminDetails';
interface Pending { code: string; requestId: string; previewToken: string }
export function PlanCodePage() {
  const { user } = useAuth();
  const uid = user!.uid;
  const storageKey = `pending-plan:${uid}`;
  const alive = useRef(true);
  const pendingRef = useRef<Pending | null>(null);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PlanPreview>();
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    alive.current = true;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) { pendingRef.current = redeemPlanCodeSchema.parse(JSON.parse(stored)); setPending(true); }
    } catch { setError(new Error('อ่านรายการที่ค้างอยู่ไม่ได้ กรุณาตรวจสอบพื้นที่จัดเก็บของเบราว์เซอร์')); }
    return () => { alive.current = false; };
  }, [storageKey]);
  async function check() {
    if (busy || pending) return;
    setBusy(true); setError(undefined); setPreview(undefined);
    try { const next = await previewCode(code); if (alive.current) setPreview(next); }
    catch (error) { if (alive.current) setError(error); }
    finally { if (alive.current) setBusy(false); }
  }
  async function confirm() {
    if (busy || (!preview && !pendingRef.current)) return;
    setBusy(true); setError(undefined);
    try {
      const input = pendingRef.current ?? { code: code.trim(), requestId: newRequestId(), previewToken: preview!.previewToken };
      sessionStorage.setItem(storageKey, JSON.stringify(input));
      pendingRef.current = input; setPending(true);
      await redeemCode(input);
      sessionStorage.removeItem(storageKey); pendingRef.current = null;
      if (!alive.current) return;
      setPending(false); setSuccess(true);
      await queryClient.invalidateQueries({ queryKey: [uid] });
    } catch (error) {
      if (error instanceof AccountChangedError || !alive.current) return;
      if (!uncertain(error)) {
        sessionStorage.removeItem(storageKey); pendingRef.current = null; setPending(false);
        if (reason(error) === 'PLAN_PREVIEW_CHANGED') {
          setPreview(undefined);
          // Fetch the newly calculated result; a fresh click is required to confirm it.
          try { setPreview(await previewCode(code)); } catch { /* Keep the original failure visible. */ }
        }
      }
      setError(error);
    } finally { if (alive.current) setBusy(false); }
  }
  return <>
    <Link className="back-link" to="/classes">กลับไปห้องเรียน</Link>
    <h1>กรอกโค้ดเปลี่ยนแพ็กเกจ</h1>
    {success ? <p role="status" className="success">เปลี่ยนแพ็กเกจสำเร็จ</p> : <>
      {!pending && <form onSubmit={e => { e.preventDefault(); void check(); }}>
        <label>โค้ดแพ็กเกจ<input autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="A7K2P" aria-describedby="plan-code-help" pattern="(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{5}" minLength={5} maxLength={5} value={code} disabled={busy} onChange={e => { setCode(e.target.value.toUpperCase()); setPreview(undefined); }} required /></label>
        <p id="plan-code-help" className="muted">ภาษาอังกฤษผสมตัวเลข 5 ตัว เช่น A7K2P (ใช้ตัวพิมพ์เล็กหรือใหญ่ได้)</p>
        <Button disabled={busy || !planCodeSchema.safeParse(code).success}>{busy ? 'กำลังตรวจสอบ…' : 'ตรวจสอบโค้ด'}</Button>
      </form>}
      {preview && <section className="plan-summary" data-testid="plan-code-preview">
        <h2>{PLAN_DEFINITIONS[preview.planId].name}</h2>
        <p>วันสิ้นสุดใหม่ {thaiDate(preview.expiresAt)} (เวลาประเทศไทย)</p>
        {preview.change === 'upgrade' && <p className="notice">แพ็กเกจใหม่เริ่มทันที โดยไม่รวมเวลาคงเหลือของแพ็กเกจเดิม</p>}
        {preview.change === 'renewal' && <p>ต่ออายุ 13 เดือนจากวันสิ้นสุดเดิม</p>}
        {!pending && <Button disabled={busy} onClick={() => void confirm()}>ยืนยันเปลี่ยนแพ็กเกจ</Button>}
      </section>}
      {pending && <>
        <p className="notice">{busy ? 'กำลังยืนยันแพ็กเกจ…' : 'ยังไม่ทราบผล กรุณาตรวจสอบผลด้วยคำขอเดิมก่อนทำรายการใหม่'}</p>
        <Button disabled={busy} onClick={() => void confirm()}>{busy ? 'ยืนยันเปลี่ยนแพ็กเกจ' : 'ตรวจสอบผล / ลองอีกครั้ง'}</Button>
      </>}
      {error !== undefined && <ErrorState error={error} />}
    </>}
    <section className="plan-details" aria-labelledby="plan-details-heading">
      <h2 id="plan-details-heading">รายละเอียดแพ็กเกจ</h2>
      <p className="muted">จำนวนห้องเรียนต่อปีการศึกษาปัจจุบัน นับรวมทุกวิชาและทั้งสองภาคเรียน</p>
      <div className="plan-options">
        {Object.entries(PLAN_DEFINITIONS).map(([id, plan]) => (
          <article className="plan-option" key={id}>
            <h3>{plan.name}</h3>
            <p className="plan-option-limit">{plan.classroomLimit === null ? 'ห้องเรียนไม่จำกัด' : `${plan.classroomLimit} ห้องเรียน`}</p>
            <p className="muted">{id === 'starter' ? 'แพ็กเกจเริ่มต้น ไม่มีวันหมดอายุ' : 'อายุแพ็กเกจ 13 เดือน'}</p>
            <p className="muted">{id === 'starter' ? 'เริ่มใช้งานได้โดยไม่ต้องกรอกโค้ด' : 'ติดต่อผู้ดูแลเพื่อรับโค้ดเปิดใช้งาน'}</p>
          </article>
        ))}
      </div>
      <p className="muted">ทุกแพ็กเกจจัดเก็บข้อมูล 3 ปีการศึกษา รวมถึง Level 3</p>
      <p className="muted">ต่ออายุแพ็กเกจเดิม: เพิ่ม 13 เดือนจากวันสิ้นสุดเดิม · อัปเกรด: เริ่มใหม่ทันที 13 เดือน โดยไม่รวมเวลาคงเหลือ</p>
      <p className="muted">เมื่อแพ็กเกจหมดอายุ จะกลับเป็น Starter ห้องเรียนเดิมยังใช้งานได้ แต่จะเพิ่มห้องใหม่ได้เมื่อจำนวนห้องต่ำกว่าขีดจำกัด</p>
    </section>
    <section className="plan-summary" aria-labelledby="admin-contact-heading">
      <h2 id="admin-contact-heading">ติดต่อผู้ดูแล</h2>
      <ContactAdminDetails />
    </section>
  </>;
}
