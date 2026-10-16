import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { PLAN_DEFINITIONS } from "@home-work/shared";
import { Button } from "@/components/ui/button";
import { thaiDate } from "@/lib/date";
import { useAuth } from "../auth/useAuth";
import { usePlan } from "../plans/api";
import { ContactAdminPanel } from "../plans/ContactAdminPanel";

export function TeacherMenu() {
  const { user, logout } = useAuth();
  const plan = usePlan();
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const location = useLocation();

  useEffect(() => { setOpen(false); setContact(false); }, [location]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div className="account" ref={root}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={event => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}>
      <button ref={trigger} className="account-button" data-testid="account-menu"
        aria-label="ครู" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(value => !value)}>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar" aria-hidden="true">{user?.displayName?.slice(0, 1) || "ค"}</span>
        )}
        <span>ครู</span><ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && <section id={panelId} className="account-dropdown" aria-label="ข้อมูลครู">
        <p className="teacher-name">{user?.displayName || "บัญชีครู"}</p>
        <p>{user?.email || "ไม่มีอีเมล"}</p>
        <div className="teacher-plan" data-testid="teacher-plan-summary">
          {plan.data ? <>
            <p>แพ็กเกจ: <strong>{PLAN_DEFINITIONS[plan.data.planId].name}</strong></p>
            {plan.data.expiresAt && <p>สิ้นสุด {thaiDate(plan.data.expiresAt)}</p>}
          </> : plan.isError ? <>
            <p role="alert">โหลดแพ็กเกจไม่สำเร็จ</p>
            <Button variant="ghost" disabled={plan.isFetching} onClick={() => void plan.refetch()}>ลองใหม่</Button>
          </> : <p role="status">กำลังโหลดแพ็กเกจ…</p>}
        </div>
        <Button asChild variant="ghost"><Link to="/plan/code" onClick={() => setOpen(false)}>กรอกโค้ด</Link></Button>
        <Button variant="ghost" onClick={() => { setOpen(false); setContact(true); }}>ติดต่อผู้ดูแล</Button>
        <Button variant="ghost" onClick={() => void logout()}><LogOut size={18} />ออกจากระบบ</Button>
      </section>}
      {contact && <ContactAdminPanel onClose={() => setContact(false)}
        onCloseAutoFocus={() => trigger.current?.focus()} />}
    </div>
  );
}
