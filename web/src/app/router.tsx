import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";
import { SignInPage } from "@/features/auth/SignInPage";
import { HomePage } from "@/features/home/HomePage";
import { ClassesPage } from "@/features/classes/ClassesPage";
const ClassPage = lazy(() =>
  import("@/features/classes/ClassPage").then((m) => ({
    default: m.ClassPage,
  })),
);
const ScanPage = lazy(() =>
  import("@/features/scan/ScanPage").then((m) => ({ default: m.ScanPage })),
);
import { LoadingState } from "@/components/LoadingState";
import { AppLayout } from "./AppLayout";
function Guard() {
  const { user, loading } = useAuth();
  return loading ? (
    <LoadingState text="กำลังตรวจสอบบัญชี…" />
  ) : user ? (
    <AppLayout key={user.uid} />
  ) : (
    <Navigate to="/sign-in" replace />
  );
}
export function Router() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState />}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route element={<Guard />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/classes/:classId" element={<ClassPage />} />
            <Route path="/scan" element={<ScanPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
