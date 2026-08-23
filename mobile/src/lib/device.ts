import AsyncStorage from '@react-native-async-storage/async-storage';

// Identificador aleatorio que vive en el almacenamiento del navegador de este celular, para que
// el admin pueda notar si dos DNI distintos marcaron entrada desde el mismo dispositivo (posible
// marcado por otra persona). No es un identificador de hardware — se pierde si borran datos del
// navegador o instalan de nuevo, pero alcanza para el aviso informativo que se necesita.
const DEVICE_ID_KEY = 'geoasistencia:deviceId';

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = randomId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}
