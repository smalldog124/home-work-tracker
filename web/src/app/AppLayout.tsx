import { NavLink, Outlet } from "react-router-dom";
import { Home, ScanLine, BookOpen } from "lucide-react";
import { TeacherMenu } from "@/features/teachers/TeacherMenu";
export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/home" aria-label="กลับหน้าหลัก" data-testid="brand-home">
          <span className="brand-icon">
            <ScanLine size={24} />
          </span>
          <span>
            บันทึกงาน<span className="brand-sub">สำหรับครู</span>
          </span>
        </NavLink>
        <TeacherMenu />
      </header>
      <nav className="main-nav" aria-label="เมนูหลัก">
        {[
          { to: "/home", label: "หน้าหลัก", id: "home", icon: Home },
          { to: "/scan", label: "สแกนงาน", id: "scan", icon: ScanLine },
          { to: "/classes", label: "ห้องเรียน", id: "classes", icon: BookOpen },
        ].map(({ to, label, id, icon: Icon }) => (
          <NavLink key={id} to={to} data-testid={`nav-${id}`}>
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="page">
        <Outlet />
      </main>
      <footer className="page-footer">
        บันทึกงานสำหรับครู · ข้อมูลของคุณในพื้นที่ส่วนตัว
      </footer>
    </div>
  );
}
