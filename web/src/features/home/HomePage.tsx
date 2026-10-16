import { useState } from "react";
import { Link } from "react-router-dom";
import { ScanLine, Plus, ArrowRight } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { ClassCard } from "../classes/ClassesPage";
import { useClasses, useRetention, type ClassRecord } from "../classes/api";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/dialog";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
export function HomePage() {
  const { user } = useAuth();
  const retention = useRetention();
  const classes = useClasses(retention.data?.currentYear || 0, 1);
  const [choose, setChoose] = useState(false);
  let recent: ClassRecord[] = [];
  try {
    recent = JSON.parse(sessionStorage.getItem(`recent:${user!.uid}`) || "[]");
  } catch {
    /* Optional history. */
  }
  recent = recent.filter((c) => retention.data?.retainedYears.includes(c.year));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>หน้าหลัก</h1>
          <p className="muted">
            สวัสดี {user?.displayName || "คุณครู"} เริ่มต้นจากที่นี่
          </p>
        </div>
        <span className="year-pill">
          ปีการศึกษา {retention.data?.currentYear || "…"}
        </span>
      </div>
      {retention.data?.notice && (
        <p className="notice" data-testid="expiry-notice">
          ข้อมูลปี {retention.data.notice.year} จะหมดอายุใน{" "}
          {retention.data.notice.days} วัน
        </p>
      )}
      <section className="scan-hero">
        <div>
          {/* <span className="hero-icon">
            <ScanLine size={36} />
          </span> */}
          <h2>บันทึกการส่งงาน</h2>
          <p>
            เลือกสถานะ แล้วสแกน QR ของนักเรียน
            <br />
            ระบบจะบันทึกลงชิ้นงานล่าสุดของแต่ละห้อง
          </p>
        </div>
        <Button size="lg" asChild data-testid="scan-work">
          <Link to="/scan">
            <ScanLine size={22} />
            สแกนงาน
            <ArrowRight size={20} />
          </Link>
        </Button>
      </section>
      <Button
        variant="outline"
        className="add-task-home"
        onClick={() => setChoose(true)}
      >
        <Plus size={20} />
        เพิ่มชิ้นงาน
      </Button>
      <div className="section-heading">
        <h2>ห้องเรียนที่เปิดล่าสุด</h2>
        <Link to="/classes">
          ดูห้องเรียนทั้งหมด <ArrowRight size={17} />
        </Link>
      </div>
      {retention.error ? (
        <ErrorState
          error={retention.error}
          retry={() => void retention.refetch()}
        />
      ) : retention.isPending ? (
        <LoadingState />
      ) : recent.length ? (
        <div className="class-grid">
          {recent.map((c) => (
            <ClassCard key={c.id} record={c} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h3>ยังไม่มีห้องเรียนที่เปิดล่าสุด</h3>
          <p className="muted">
            เปิดห้องเรียน หรือเพิ่มห้องใหม่เพื่อเริ่มบันทึกงาน
          </p>
          <Button asChild variant="outline">
            <Link to="/classes">เพิ่ม / เปิดห้องเรียน</Link>
          </Button>
        </div>
      )}
      {choose && (
        <Panel
          title="เลือกห้องเพื่อเพิ่มชิ้นงาน"
          onClose={() => setChoose(false)}
        >
          <p className="muted">
            ปีการศึกษา {retention.data?.currentYear} · ภาคเรียน 1
          </p>
          {classes.isPending ? (
            <LoadingState />
          ) : classes.error ? (
            <ErrorState error={classes.error} />
          ) : (
            classes.data?.map((c) => (
              <Link
                key={c.id}
                className="choice-row"
                to={`/classes/${c.id}?tab=tasks&add=1`}
              >
                {c.subject} · {c.group}
                <ArrowRight size={18} />
              </Link>
            ))
          )}
          <Button asChild variant="outline">
            <Link to="/classes">เลือกปีและภาคเรียนอื่น</Link>
          </Button>
        </Panel>
      )}
    </>
  );
}
