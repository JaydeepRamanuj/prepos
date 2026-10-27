"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";
import { deleteField, doc, FieldPath, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { firebaseAuth, firebaseEnabled, firestore } from "@/lib/firebase/client";
import { emptyData, getData, mergeData, setRemoteWriter, useProgress, type ProgressData } from "./store";

interface AuthCtx {
  enabled: boolean;
  user: User | null;
  loading: boolean;
  syncError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  enabled: false,
  user: null,
  loading: false,
  syncError: null,
  signIn: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(Ctx);

function normalize(raw: Partial<ProgressData> | undefined): ProgressData {
  const e = emptyData();
  return {
    solved: raw?.solved ?? e.solved,
    revise: raw?.revise ?? e.revise,
    bookmarks: raw?.bookmarks ?? e.bookmarks,
    chapters: raw?.chapters ?? e.chapters,
    notes: raw?.notes ?? e.notes,
  };
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseEnabled);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const auth = firebaseAuth();
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const db = firestore();
    if (!db || !user) {
      setRemoteWriter(null);
      return;
    }
    const ref = doc(db, "users", user.uid);
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        // First sync on this device: union local progress into the account.
        const snap = await getDoc(ref);
        const remoteData = normalize(snap.data() as Partial<ProgressData> | undefined);
        const merged = mergeData(remoteData, getData(useProgress.getState()));
        await setDoc(ref, { ...merged, updatedAt: Date.now() }, { merge: true });
        if (cancelled) return;
        useProgress.getState().replaceData(merged);

        setRemoteWriter({
          toggle: (list, key, on, at) => {
            updateDoc(ref, new FieldPath(list, key), on ? at : deleteField(), "updatedAt", Date.now()).catch((e) =>
              setSyncError(String(e?.message ?? e)),
            );
          },
          note: (key, note) => {
            updateDoc(ref, new FieldPath("notes", key), note ? note : deleteField(), "updatedAt", Date.now()).catch(
              (e) => setSyncError(String(e?.message ?? e)),
            );
          },
        });

        // Live updates from other devices.
        unsub = onSnapshot(ref, (s) => {
          if (s.metadata.hasPendingWrites) return;
          useProgress.getState().replaceData(normalize(s.data() as Partial<ProgressData> | undefined));
        });
        setSyncError(null);
      } catch (e) {
        setSyncError(String((e as Error)?.message ?? e));
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
      setRemoteWriter(null);
    };
  }, [user]);

  const signIn = async () => {
    const auth = firebaseAuth();
    if (!auth) return;
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(auth, provider);
      } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setSyncError(String((e as Error).message));
      }
    }
  };

  const signOut = async () => {
    const auth = firebaseAuth();
    if (!auth) return;
    await fbSignOut(auth);
    // Keep the device clean after signing out; progress lives in the account.
    useProgress.getState().resetLocal();
  };

  return (
    <Ctx.Provider value={{ enabled: firebaseEnabled, user, loading, syncError, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}
