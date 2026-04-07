import React, { createContext, useContext, useState } from 'react';
import { UserRole } from './permissions';

export interface AuthUser {
  email: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const USERS: Array<{ email: string; password: string; role: UserRole; name: string }> = [
  {
    email: 'cdima.admin@gmail.com',
    password: import.meta.env.VITE_PASSWORD_DIRECTOR as string,
    role: 'director',
    name: 'Director CDIMA',
  },
  {
    email: 'alicia.cdima@gmail.com',
    password: import.meta.env.VITE_PASSWORD_DIRECTOR as string,
    role: 'director',
    name: 'Director CDIMA',
  },
  {
    email: 'cdima.eviolencia@gmail.com',
    password: import.meta.env.VITE_PASSWORD_TECNICO_EV as string,
    role: 'tecnico ev',
    name: 'Técnico Erradicación Violencia',
  },
  {
    email: 'cdima.erradicaciondeviolencia@gmail.com',
    password: import.meta.env.VITE_PASSWORD_TECNICO_EV as string,
    role: 'tecnico ev',
    name: 'Técnico Erradicación Violencia',
  },
  {
    email: 'cdima.epolitico@gmail.com',
    password: import.meta.env.VITE_PASSWORD_TECNICO_EP as string,
    role: 'tecnico ep',
    name: 'Técnico Empoderamiento Politico',
  },
  {
    email: 'cdima.empoderamientopolitico@gmail.com',
    password: import.meta.env.VITE_PASSWORD_TECNICO_EP as string,
    role: 'tecnico ep',
    name: 'Técnico Empoderamiento Politico',
  },
  {
    email: 'sandraveragutierrez@gmail.com',
    password: import.meta.env.VITE_PASSWORD_ADMINISTRADOR as string,
    role: 'administrador',
    name: 'Sandra Vera',
  },
  {
    email: 'ely.ibanez.v@gmail.com',
    password: import.meta.env.VITE_PASSWORD_COMUNICACION as string,
    role: 'comunicacion',
    name: 'Ely Ibáñez',
  },
  {
    email: 'cdima.planificador@gmail.com',
    password: import.meta.env.VITE_PASSWORD_PLANIFICADOR as string,
    role: 'planificador',
    name: 'Uusuario Planificador',
  },
];

const STORAGE_KEY = 'cdima_auth_user';

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  });

  const login = (email: string, password: string): boolean => {
    const found = USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return false;
    const authUser: AuthUser = { email: found.email, role: found.role, name: found.name };
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};


