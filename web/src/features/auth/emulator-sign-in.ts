import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth, useEmulators } from "@/lib/firebase";
// Loaded only by local development; production ignores the e2eTeacher parameter.
export async function emulatorSignIn(teacher: string) {
  if (!useEmulators || !/^[a-zA-Z0-9_-]{1,100}$/.test(teacher))
    throw new Error("ไม่สามารถเข้าสู่ระบบได้");
  const claims = {
    sub: teacher,
    email: `${teacher}@example.test`,
    name: "ครูทดสอบ",
    email_verified: true,
  };
  const encode = (value: unknown) =>
    btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const token = [encode({ alg: "none", typ: "JWT" }), encode(claims), ""].join(
    ".",
  );
  await signInWithCredential(auth, GoogleAuthProvider.credential(token));
}
