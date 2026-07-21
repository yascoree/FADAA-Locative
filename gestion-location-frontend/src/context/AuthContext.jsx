"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import apiClient, { setAuthToken } from "@/lib/apiClient";

const TOKEN_STORAGE_KEY = "fadaa_access_token";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async (activeToken) => {
    setAuthToken(activeToken);
    const { data } = await apiClient.get("/auth/me");
    setUser(data);
    return data;
  }, []);

  useEffect(() => {
    async function restoreSession() {
      const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!stored) {
        setIsLoading(false);
        return;
      }
      setToken(stored);
      try {
        await loadUser(stored);
      } catch {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setAuthToken(null);
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, [loadUser]);

  const login = useCallback(
    async (email, password) => {
      const body = new URLSearchParams();
      body.set("username", email);
      body.set("password", password);
      const { data } = await apiClient.post("/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      window.localStorage.setItem(TOKEN_STORAGE_KEY, data.access_token);
      setToken(data.access_token);
      return loadUser(data.access_token);
    },
    [loadUser]
  );

  const register = useCallback(async (payload) => {
    const { data } = await apiClient.post("/auth/register", payload);
    return data;
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setAuthToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
