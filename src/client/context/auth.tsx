import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiUrl } from "@/client/api";
import { withBasePath } from "@/lib/base-path";
import type { Release } from "@/lib/releases";

export type AuthUser = {
  userName: string;
  currentVersion: string;
  update: Release | null;
  counts: Record<string, number>;
  showUsagePing: boolean;
};

export type AuthContextType = {
  loading: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  reloadSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  loading: true,
  authenticated: false,
  user: null,
  reloadSession: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const reloadSession = async () => {
    try {
      const res = await fetch(apiUrl("/api/auth/session"));
      if (!res.ok) {
        setAuthenticated(false);
        setUser(null);
        return;
      }
      const data = await res.json();
      setAuthenticated(Boolean(data.authenticated));
      setUser(data.user || null);
    } catch {
      setAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(apiUrl("/api/auth/sign-out"), { method: "POST" });
    } finally {
      setAuthenticated(false);
      setUser(null);
      window.location.href = withBasePath("/login");
    }
  };

  useEffect(() => {
    void reloadSession();
  }, []);

  return (
    <AuthContext.Provider value={{ loading, authenticated, user, reloadSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
