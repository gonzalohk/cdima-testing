import React, { createContext, useContext, useState } from 'react';
import { UserRole } from './permissions';

export interface AuthUser {
  email: string;
  role: UserRole;
  name: string;
  solicitante?: string;
  cargo?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => AuthUser | null;
  logout: () => void;
}

const USERS: Array<{ email: string; password: string; role: UserRole; name: string; solicitante?: string ; cargo?: string }> = [
  {
    email: 'cdima.admin@gmail.com',
    password: import.meta.env.VITE_PASSWORD_DIRECTOR as string,
    role: 'director',
    name: 'Director CDIMA',
    solicitante: 'Alicia Canaviri Mallcu',
    cargo: 'Directora Ejecutiva',
  },
  {
    email: 'alicia.cdima@gmail.com',
    password: import.meta.env.VITE_PASSWORD_DIRECTOR as string,
    role: 'director',
    name: 'Director CDIMA',
    solicitante: 'Alicia Canaviri Mallcu',
    cargo: 'Directora Ejecutiva',
  },
  {
    email: 'cdima.eviolencia@gmail.com',
    password: import.meta.env.VITE_PASSWORD_TECNICO_EV as string,
    role: 'tecnico ev',
    name: 'Técnico Erradicación Violencia',
    solicitante: 'Delma Lopez Callisaya',
    cargo: 'Resp. Erradicación de Violencia',
  },
  {
    email: 'cdima.erradicaciondeviolencia@gmail.com',
    password: import.meta.env.VITE_PASSWORD_TECNICO_EV as string,
    role: 'tecnico ev',
    name: 'Técnico Erradicación Violencia',
    solicitante: 'Delma Lopez Callisaya',
    cargo: 'Resp. Erradicación de Violencia',
  },
  {
    email: 'cdima.epolitico@gmail.com',
    password: import.meta.env.VITE_PASSWORD_TECNICO_EP as string,
    role: 'tecnico ep',
    name: 'Técnico Empoderamiento Politico',
    solicitante: 'Darío Alanoca Calcina',
    cargo: 'Resp. Empoderamiento Político',
  },
  {
    email: 'cdima.empoderamientopolitico@gmail.com',
    password: import.meta.env.VITE_PASSWORD_TECNICO_EP as string,
    role: 'tecnico ep',
    name: 'Técnico Empoderamiento Politico',
    solicitante: 'Darío Alanoca Calcina',
    cargo: 'Resp. Empoderamiento Político',
  },
  {
    email: 'sandraveragutierrez@gmail.com',
    password: import.meta.env.VITE_PASSWORD_ADMINISTRADOR as string,
    role: 'administrador',
    name: 'Sandra Vera',
    solicitante: 'Sandra Vera Gutierrez',
    cargo: 'Resp. Administrativa y Financiera'
  },
  {
    email: 'ely.ibanez.v@gmail.com',
    password: import.meta.env.VITE_PASSWORD_COMUNICACION as string,
    role: 'comunicacion',
    name: 'Ely Ibáñez',
    solicitante: 'Elizabeth Ibañez Susara',
    cargo: 'Resp. Área de Comunicación',
  },
  {
    email: 'cdima.planificador@gmail.com',
    password: import.meta.env.VITE_PASSWORD_PLANIFICADOR as string,
    role: 'planificador',
    name: 'Uusuario Planificador',
    solicitante: 'Usuario Planificador',
    cargo: 'Resp. Planificador',
  },
];

// Devuelve el nombre del solicitante asociado a un email registrado.
// Fallback para solicitudes legacy que no guardaron el campo "solicitante".
export const getSolicitanteByEmail = (email?: string): string | undefined => {
  if (!email) return undefined;
  return USERS.find((u) => u.email.toLowerCase() === email.toLowerCase())?.solicitante;
};

// Devuelve el cargo asociado a un email registrado.
// Fallback para solicitudes legacy que no guardaron el campo "cargo".
export const getCargoByEmail = (email?: string): string | undefined => {
  if (!email) return undefined;
  return USERS.find((u) => u.email.toLowerCase() === email.toLowerCase())?.cargo;
};

// Devuelve los emails de los usuarios aprobadores (director + administrador).
// Se usa como destinatarios de las notificaciones de nuevas solicitudes.
export const getAprobadorEmails = (): string[] =>
  USERS.filter((u) => u.role === 'director' || u.role === 'administrador').map((u) => u.email);

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

  const login = (email: string, password: string): AuthUser | null => {
    const found = USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return null;
    const authUser: AuthUser = { email: found.email, role: found.role, name: found.name, solicitante: found.solicitante, cargo: found.cargo };
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    return authUser;
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


