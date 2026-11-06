import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import i18n, { isLocale, type Locale } from "@/i18n";
import type { UsersResponse } from "@/lib/pb-types";
import { pb } from "@/lib/pocketbase";

export type AuthUser = UsersResponse;

type RegisterInput = { email: string; password: string; name: string };

type AuthValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the persisted session has been validated against the server. */
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => void;
  /** Switches the UI language and stores it on the user record when signed in. */
  setLocale: (locale: Locale) => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(
    () => (pb.authStore.record as AuthUser | null) ?? null,
  );
  const [loading, setLoading] = useState(pb.authStore.isValid);
  const queryClient = useQueryClient();

  // Someone else (or nobody) now uses this tab: forget everything the last user loaded, or the
  // next one sees it until it refetches (a shared device, a quick account switch).
  const userId = user?.id ?? null;
  const previousUser = useRef(userId);
  useEffect(() => {
    if (previousUser.current === userId) return;
    if (previousUser.current !== null) queryClient.clear();
    previousUser.current = userId;
  }, [userId, queryClient]);

  useEffect(() => {
    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser((record as AuthUser | null) ?? null);
    });

    // Validate (and refresh) a persisted token on startup.
    if (pb.authStore.isValid) {
      pb.collection("users")
        .authRefresh()
        // Only a rejected token ends the session; offline, a restart or a 429 keeps it.
        .catch((error: unknown) => {
          const status = (error as { status?: number } | null)?.status;
          if (status === 401 || status === 403 || status === 404) pb.authStore.clear();
        })
        .finally(() => setLoading(false));
    }
    return unsubscribe;
  }, []);

  // A signed-in user's saved language wins over the browser's.
  useEffect(() => {
    if (user && isLocale(user.locale) && user.locale !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(user.locale);
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection("users").authWithPassword(email, password);
  }, []);

  const register = useCallback(async ({ email, password, name }: RegisterInput) => {
    await pb.collection("users").create({
      email,
      password,
      passwordConfirm: password,
      name,
      locale: isLocale(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en",
    });
    await pb.collection("users").authWithPassword(email, password);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await pb.collection("users").requestPasswordReset(email);
  }, []);

  const logout = useCallback(() => {
    // React Router runs navigate() as a transition; clearing the store inside one too keeps a
    // `navigate("/"); logout();` pair in a single render instead of letting a route guard win.
    startTransition(() => pb.authStore.clear());
  }, []);

  const setLocale = useCallback(
    async (locale: Locale) => {
      await i18n.changeLanguage(locale);
      if (user && user.locale !== locale) {
        await pb.collection("users").update(user.id, { locale });
      }
    },
    [user],
  );

  const value = useMemo<AuthValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      loading,
      login,
      register,
      requestPasswordReset,
      logout,
      setLocale,
    }),
    [user, loading, login, register, requestPasswordReset, logout, setLocale],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
