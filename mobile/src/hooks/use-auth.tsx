import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

export type Worker = {
  nombre: string;
  apellido: string;
  obra: string;
  iniciales: string;
  pin: string;
};

// Mock worker + PIN. In production this comes from an authentication service, not a client-side constant.
const MOCK_WORKER: Worker = {
  nombre: 'Marcos',
  apellido: 'Gutiérrez',
  obra: 'Obra Las Condes',
  iniciales: 'MG',
  pin: '2468',
};

type AuthContextValue = {
  worker: Worker;
  isAuthenticated: boolean;
  signIn: (pin: string) => boolean;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const value = useMemo<AuthContextValue>(
    () => ({
      worker: MOCK_WORKER,
      isAuthenticated,
      signIn: (pin: string) => {
        const success = pin === MOCK_WORKER.pin;
        if (success) setIsAuthenticated(true);
        return success;
      },
      signOut: () => setIsAuthenticated(false),
    }),
    [isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
