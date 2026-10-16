import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { call } from "@/lib/api";
import { queryClient } from "@/lib/query-client";
import { clearPending } from "../scan/pending-request";
import { clearPendingEdit } from "@/lib/save-request";
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}>({ user: null, loading: true, logout: async () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        queryClient.clear();
        setUser(next);
        setLoading(false);
        if (next) void call("getTeacher", {}).catch(() => {});
      }),
    [],
  );
  async function logout() {
    if (user) {
      clearPending(user.uid);
      clearPendingEdit(user.uid);
      try {
        sessionStorage.removeItem(`recent:${user.uid}`);
      } catch {}
    }
    await signOut(auth);
    queryClient.clear();
  }
  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
