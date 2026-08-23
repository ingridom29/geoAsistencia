import { supabase } from '@/lib/supabase';

export type Obra = {
  id: string;
  nombre: string;
  latitud: number | null;
  longitud: number | null;
  radioMetros: number;
};

const ESTADOS_ACTIVOS = ['activa', 'activo', 'Activa', 'Activo', 'ACTIVA', 'ACTIVO'];

export async function fetchObrasActivas(): Promise<Obra[]> {
  // Si la migración de ubicación (latitud/longitud/radio_metros) todavía no corrió en Supabase,
  // esta consulta falla entera — caemos a una consulta sin esas columnas para no romper el check-in.
  let { data, error } = await supabase.from('obras').select('id, nombre, estado, latitud, longitud, radio_metros').order('nombre');
  if (error) {
    ({ data, error } = await supabase.from('obras').select('id, nombre, estado').order('nombre'));
  }
  if (error || !data) return [];
  return data
    .filter((o) => ESTADOS_ACTIVOS.includes(o.estado))
    .map((o) => ({
      id: o.id,
      nombre: o.nombre,
      latitud: 'latitud' in o ? o.latitud : null,
      longitud: 'longitud' in o ? o.longitud : null,
      radioMetros: ('radio_metros' in o ? o.radio_metros : null) ?? 150,
    }));
}
