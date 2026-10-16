import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { ScanLine, Check } from "lucide-react";
import { auth, configured, useEmulators } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ErrorState";
import { useAuth } from "./useAuth";
export function SignInPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  if (user) return <Navigate to="/home" replace />;
  async function login() {
    setBusy(true);
    setError(undefined);
    try {
      const teacher = new URLSearchParams(location.search).get("e2eTeacher");
      if (import.meta.env.DEV && useEmulators && teacher) {
        const { emulatorSignIn } = await import("./emulator-sign-in");
        await emulatorSignIn(teacher);
      } else await signInWithPopup(auth, new GoogleAuthProvider());
      navigate("/home", { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="sign-in">
      <section className="sign-in-card">
        <div className="brand-icon">
          <ScanLine size={36} />
        </div>
        <p className="eyebrow">พื้นที่ทำงานสำหรับครู</p>
        <h1>
          บันทึกงาน
          <br />
          <span>ง่ายๆผ่านการแสกน
          </span>
        </h1>
        <p className="muted">
          จัดการชิ้นงานและติดตามการส่งงานของนักเรียน
          <br />
          ในที่เดียว ใช้งานได้ทั้งมือถือและคอมพิวเตอร์
        </p>
        <div className="sign-in-points">
          <p>
            <Check size={18} /> สแกน QR เพื่อบันทึกการส่งงาน
          </p>
          <p>
            <Check size={18} /> ดูภาพรวมของแต่ละห้องได้ทันที
          </p>
          <p>
            <Check size={18} /> นักเรียนไม่ต้องมีบัญชี
          </p>
        </div>
        <Button size="lg" onClick={login} disabled={busy || !configured}>
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบด้วย Google"}
        </Button>
        {!configured && (
          <p role="status" className="notice">
            ยังไม่ได้เชื่อมต่อระบบ กรุณาให้ผู้ดูแลตั้งค่าการเชื่อมต่อก่อนใช้งาน
          </p>
        )}
        {error !== undefined && <ErrorState error={error} />}
        <p className="caption">ข้อมูลห้องเรียนมองเห็นได้เฉพาะบัญชีของคุณ</p>
      </section>
    </main>
  );
}
