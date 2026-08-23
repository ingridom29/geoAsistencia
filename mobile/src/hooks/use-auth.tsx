import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';

// Remembers the last DNI that successfully signed in on this device, so a worker who always
// uses the same phone only has to type their PIN, not the DNI, on every check-in.
const LAST_DNI_KEY = 'geoasistencia:lastDni';

export async function getSavedDni(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_DNI_KEY);
}

export async function saveDni(dni: string): Promise<void> {
  await AsyncStorage.setItem(LAST_DNI_KEY, dni);
}

export async function clearSavedDni(): Promise<void> {
  await AsyncStorage.removeItem(LAST_DNI_KEY);
}

// Field-worker positions that can check in via geoAsistencia. Office roles (GERENTE GENERAL,
// INGENIERO, etc.) manage things from the web panel instead.
const CARGOS_OBRA = ['AYUDANTE', 'MAESTRO DE OBRA', 'PEÓN', 'VIGÍA'];

// The mobile app authenticates to Supabase as this single shared account (not tied to any
// worker) so it can satisfy RLS when writing attendance. Workers only ever see DNI + PIN.
const APP_EMAIL = 'appmovil@sgds.pe';
const APP_PASSWORD = 'GeoAsist_2026_SGDS!';

export type Worker = {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  cargo: string;
  iniciales: string;
  fechaNacimiento: string;
  fechaIngreso: string | null;
};

// A worker's PIN is always the first 4 digits of their birthday, DDMM (29 de abril -> "2904").
export function pinFromFecha(fechaNacimiento: string | null): string {
  if (!fechaNacimiento) return '';
  const [, month, day] = fechaNacimiento.split('-');
  if (!day || !month) return '';
  return `${day}${month}`;
}

type DniLookupResult =
  | { ok: true; worker: Worker }
  | { ok: false; reason: 'not_found' | 'office_role' | 'network' };

// Looks up a worker by DNI only (no PIN check yet) so the PIN screen can greet them by name.
export async function lookupWorkerByDni(dni: string): Promise<DniLookupResult> {
  const { data, error } = await supabase
    .from('empleados')
    .select('id, dni, nombres, apellido_paterno, cargo, fecha_nacimiento, fecha_ingreso')
    .eq('dni', dni)
    .eq('activo', true)
    .maybeSingle();

  if (error) return { ok: false, reason: 'network' };
  if (!data) return { ok: false, reason: 'not_found' };
  if (!CARGOS_OBRA.includes(data.cargo)) return { ok: false, reason: 'office_role' };

  return {
    ok: true,
    worker: {
      id: data.id,
      dni: data.dni,
      nombre: data.nombres ?? '',
      apellido: data.apellido_paterno ?? '',
      cargo: data.cargo,
      iniciales: `${(data.nombres ?? '')[0] ?? ''}${(data.apellido_paterno ?? '')[0] ?? ''}`.toUpperCase(),
      fechaNacimiento: data.fecha_nacimiento,
      fechaIngreso: data.fecha_ingreso,
    },
  };
}

type AuthContextValue = {
  worker: Worker | null;
  isAuthenticated: boolean;
  appReady: boolean;
  signInAs: (worker: Worker) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    supabase.auth.signInWithPassword({ email: APP_EMAIL, password: APP_PASSWORD }).finally(() => {
      setAppReady(true);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      worker,
      isAuthenticated: worker !== null,
      appReady,
      signInAs: setWorker,
      signOut: () => setWorker(null),
    }),
    [worker, appReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
