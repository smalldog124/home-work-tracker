import { z } from "zod";
import { action } from "../../lib/action";
import { context } from "../../lib/firebase-admin";
import { teacherRef } from "../../lib/records";
export const getTeacherAction = action(
  "getTeacher",
  z.object({}).strict(),
  async (uid, _input, identity) => {
    const profile = {
      ownerId: uid,
      name: identity.name ?? "",
      email: identity.email ?? "",
      photo: identity.picture ?? null,
    };
    await context.db.runTransaction(async (tx) => {
      const ref = teacherRef(context, uid);
      const old = await tx.get(ref);
      if (
        !old.exists ||
        Object.entries(profile).some(
          ([key, value]) => old.data()![key] !== value,
        )
      )
        tx.set(ref, profile);
    });
    return profile;
  },
);
