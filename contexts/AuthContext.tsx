"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

interface User {
  id: number;
  full_name: string;
  email: string | null;
  username: string;
  cnic: string | null;
  phone: string | null;
  role_id: number;
  role: string;
  device_id: string | null;
  image?: string | null;
  coverImage?: string | null;
  bio?: string | null;
  permissions: any[];
  outlet_id?: number | null;
  outlet_name?: string | null;
  // Sub Admin: role is "Admin", limited to these dashboard pages (see src/lib/subAdminPermissions.ts).
  is_sub_admin?: boolean;
  role_label?: string;
  sub_admin_pages?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  updateUserLocally: (updatedData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserFromToken = async (signal: AbortSignal) => {
    const token = Cookies.get("auth_token");
    if (token) {
      try {
        const decoded: User & { exp?: number } = jwtDecode(token);
        // An expired session would otherwise look "logged in" while every API
        // call fails with 401 — send the user to sign in again instead.
        if (decoded.exp && decoded.exp * 1000 < Date.now()) {
          Cookies.remove("auth_token");
          setUser(null);
          setLoading(false);
          return;
        }
        setUser(decoded);
        // Login tokens omit photos and can outlive profile edits by an admin.
        // Hydrate every portal from the saved profile, keeping token role claims
        // intact: /user/me returns a role object instead of the token's string.
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/me`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
            signal,
          });
          const data = response.ok ? await response.json() : null;
          if (data?.user && !signal.aborted && Cookies.get("auth_token") === token) {
            const profile = data.user;
            setUser((prev) => prev?.id === decoded.id ? {
              ...prev,
              full_name: profile.full_name,
              email: profile.email,
              phone: profile.phone,
              cnic: profile.cnic,
              bio: profile.bio,
              image: profile.image,
              coverImage: profile.coverImage,
              ...(Array.isArray(profile.sub_admin_pages)
                ? { sub_admin_pages: profile.sub_admin_pages } : {}),
            } : prev);
          }
        } catch {
          // Keep the existing session if the profile request is unavailable.
        }
      } catch (error) {
        console.error("Invalid JWT token", error);
        Cookies.remove("auth_token");
        setUser(null);
      }
    } else {
      setUser(null);
    }
    if (!signal.aborted) setLoading(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadUserFromToken(controller.signal);
    return () => controller.abort();
  }, []);

  const updateUserLocally = (updatedData: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updatedData } : null));
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser, updateUserLocally }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
