import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Home, ScanLine, BookOpen, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { Button } from "@/components/ui/button";
export function AppLayout() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/home">
          <span className="brand-icon">
            <ScanLine size={24} />
          </span>
          <span>
            บันทึกงาน<span className="brand-sub">สำหรับครู</span>
          </span>
        </NavLink>
        <div className="account">
          <button
            className="account-button"
            data-testid="account-menu"
            aria-label="บัญชีของคุณ"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="รูปครู"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="avatar">
                {user?.displayName?.slice(0, 1) || "ค"}
              </span>
            )}
            <span className="account-name">
              {user?.displayName || "บัญชีครู"}
            </span>
            <ChevronDown size={16} />
          </button>
          {menu && (
            <div className="account-dropdown">
              <p>{user?.email}</p>
              <Button variant="ghost" onClick={() => void logout()}>
                <LogOut size={18} />
                ออกจากระบบ
              </Button>
            </div>
          )}
        </div>
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
