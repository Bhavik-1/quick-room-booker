// src/contexts/AuthContext.tsx (MODIFIED)

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "@/lib/mockAuth"; // Keep User type definition
import { api } from "@/lib/api"; // <-- NEW IMPORT
import { toast } from "sonner";

// Define the API response structure
interface AuthResponse {
  user: User;
  token: string;
}

interface AuthContextType {
  user: User | null;
  // All auth methods are now async and return void on failure (handle via toast)
  login: (email: string, password: string) => Promise<boolean>;
  signup: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Attempt to re-fetch user details or load from storage on mount
    const loadUser = async () => {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("currentUser");

      if (token && userStr) {
        // Simple load from storage for quick UI display
        const storedUser = JSON.parse(userStr);
        setUser(storedUser);

        // Optional: Verify token by hitting a protected endpoint (e.g., /me)
        try {
          const response = await api.get("/auth/me");
          setUser(response.data);
        } catch (error) {
          // Token is invalid/expired. Clear storage.
          localStorage.removeItem("token");
          localStorage.removeItem("currentUser");
          setUser(null);
        }
      }
    };
    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const response = await api.post<AuthResponse>("/auth/login", {
        email,
        password,
      });
      const { user, token } = response.data;

      // Store auth data
      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(user));
      setUser(user);
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || "Invalid credentials";
      toast.error(message);
      return false;
    }
  };

  const signup = async (
    email: string,
    password: string,
    name: string
  ): Promise<boolean> => {
    try {
      const response = await api.post<AuthResponse>("/auth/register", {
        name,
        email,
        password,
      });
      const { user, token } = response.data;

      // Store auth data
      localStorage.setItem("token", token);
      localStorage.setItem("currentUser", JSON.stringify(user));
      setUser(user);
      return true;
    } catch (error: any) {
      const message = error.response?.data?.message || "Registration failed";
      toast.error(message);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentUser");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, signup, logout, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
