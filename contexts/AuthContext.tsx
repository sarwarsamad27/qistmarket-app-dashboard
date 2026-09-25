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

  const loadUserFromToken = () => {
    const token = Cookies.get("auth_token");
    if (token) {
      try {
        const decoded: User = jwtDecode(token);
        setUser(decoded);
        // A Sub Admin's pages can be changed by a Super Admin after login — pick up the
        // current list (the backend enforces it either way; this keeps the menu in step).
        if (decoded.is_sub_admin) {
          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/user/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.user && Array.isArray(data.user.sub_admin_pages)) {
                setUser((prev) => (prev ? { ...prev, sub_admin_pages: data.user.sub_admin_pages } : prev));
              }
            })
            .catch(() => {});
        }
      } catch (error) {
        console.error("Invalid JWT token", error);
        Cookies.remove("auth_token");
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUserFromToken();
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