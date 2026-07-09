# Handoff: App de Asistencia para Trabajadores de Campo

## Overview
App móvil para que trabajadores de obra/construcción marquen su asistencia (llegada/salida) validando su ubicación por GPS. Incluye login por PIN numérico (sin correo/contraseña), pantalla principal de marcado con animación de confirmación, historial de asistencia, notificaciones y perfil.

## About the Design Files
Los archivos de este paquete son **referencias de diseño creadas en HTML** (prototipo interactivo) — muestran el look final y el comportamiento esperado, pero **no son código de producción para copiar tal cual**. La tarea es **recrear este diseño en el entorno de desarrollo real de la app** (por ejemplo Flutter, React Native, SwiftUI/Kotlin nativo, o el stack que ya use el proyecto), usando sus propios patrones, componentes y sistema de navegación. Si el proyecto aún no tiene un stack definido, se recomienda Flutter o React Native por la necesidad de una sola base de código para Android/iOS típica en apps de campo.

## Fidelity
**Alta fidelidad (hifi)**: colores, tipografía, espaciados, textos y animaciones mostrados son el diseño final propuesto. El desarrollador debe recrear la interfaz con precisión, adaptando la implementación (CSS/inline styles → sistema nativo de estilos) pero manteniendo los valores exactos indicados abajo.

## Cómo ver el prototipo
Abrir `Asistencia App.dc.html` en un navegador. Es un componente HTML autocontenido (usa `support.js`, cargado desde CDN dentro del archivo, y `ios-frame.jsx` para el bisel del dispositivo — ambos incluidos en esta carpeta como referencia visual del bisel, no como dependencia a integrar). El PIN de demostración es **2468**.

## Pantallas / Vistas

### 1. Login — PIN numérico
**Propósito:** autenticar al trabajador sin fricción (evita teclear correo/contraseña).
**Layout:** contenido centrado verticalmente en toda la pantalla, padding horizontal 26px.
- Avatar circular 64×64px con iniciales, gradiente `linear-gradient(145deg, oklch(0.6 0.14 55), oklch(0.5 0.12 40))` (ámbar), texto blanco Manrope 700 22px.
- Nombre completo: Manrope 700, 17px.
- Obra/sitio asignado: 12.5px, color `oklch(0.68 0.01 255)`.
- Prompt: "Ingresa tu PIN para marcar asistencia" (o "PIN incorrecto, intenta de nuevo" en error), 13px.
- 4 puntos indicadores de PIN, 15×15px, círculo. Vacío: `rgba(255,255,255,0.15)` relleno / `rgba(255,255,255,0.25)` borde. Lleno: ámbar `oklch(0.78 0.16 55)` con `scale(1.1)`. Error: rojo-naranja `oklch(0.68 0.17 30)` + animación shake horizontal (~450ms, desplazamientos de ±3 a ±8px).
- Teclado numérico: grid 3 columnas × 62px, gap 14px. Botones circulares 62×62px, fondo `rgba(255,255,255,0.06)`, borde `rgba(255,255,255,0.08)`, texto Manrope 600 22px. Última fila: vacío, "0", "⌫" (borrar, sin fondo).
- **Comportamiento:** al completar 4 dígitos se valida automáticamente. Correcto → transición a Home (fade 380ms). Incorrecto → puntos en rojo + shake 550ms, luego se limpia el PIN.

### 2. Home — Marcar asistencia
**Propósito:** ver estado del día y marcar llegada/salida.
**Layout:** scroll vertical, padding `64px 18px 110px` (el top compensa el status bar del dispositivo, el bottom compensa la barra de navegación flotante).
- **Header:** saludo grande en 2 líneas ("Buenos días,\nMarcos.") — Manrope 800, 28px, line-height 1.05, letter-spacing -0.5px. Debajo, fecha completa en español, 13px, capitalizada. Avatar circular 44×44px a la derecha (mismo estilo que login).
- **Tarjeta de marcado** (glassmorphism): radio 28px, fondo `rgba(255,255,255,0.06)`, `backdrop-filter: blur(20px) saturate(160%)`, borde `1px solid rgba(255,255,255,0.10)`, sombra `0 20px 40px rgba(0,0,0,0.35)`.
  - Texto de estado (mayúsculas, 13px): "Sin marcar hoy" / "Verificando ubicación…" / "Presente en obra".
  - Botón circular central 150×150px con anillo de resplandor animado (`breathe`, 2.6s) en ámbar (idle) o verde (checked-in). Círculo interior 112×112px, vidrio con gradiente diagonal.
    - Idle: ícono de pin de ubicación ámbar.
    - Cargando (tras tap, ~1.3s): spinner girando (borde superior ámbar).
    - Confirmado: check verde con animación "pop" (`cubic-bezier(.34,1.56,.64,1)`, 500ms).
  - Label del botón: "Marcar llegada" / "Ubicando…" / "Marcar salida" (Manrope 700, 17px).
  - Subtexto: cronómetro en vivo "Tiempo en obra · H:MM:SS" (actualiza cada segundo) cuando está marcado; o "Toca para verificar tu ubicación" si no.
- **Tarjeta de mapa:** altura 132px, fondo con patrón rayado diagonal (placeholder de mapa — reemplazar por mapa real o SDK de mapas), pin pulsante (animación `pinPulse`, círculo expandiéndose), etiqueta monoespaciada "MAPA EN VIVO". Debajo: nombre de la obra + dirección, y badge "GPS ±5m".
- **Stats:** 2 tarjetas en grid (Horas hoy / Horas semana), radio 20px, mismo estilo glass.
- **Actividad reciente:** lista de 2 últimos eventos (ícono, título, hora).

### 3. Historial
Lista agrupada por fecha. Cada día: label de fecha (mayúsculas, 12.5px) + tarjeta con 3 columnas (Entrada / Salida / Total) y badge de estado a la derecha ("Completo" verde, "Tardanza" ámbar, "En curso" turquesa, "Pendiente" gris).

### 4. Notificaciones
Lista de tarjetas glass con ícono emoji en chip de color (por tipo: ubicación, recordatorio, reporte, alerta de tardanza), título, mensaje y tiempo relativo.

### 5. Perfil
Avatar grande (84px) + nombre completo + rol/obra. Grid de 3 stats (Asistencia %, Horas mes, Faltas). Lista de opciones (Editar perfil, Ubicación de trabajo, Notificaciones, Cerrar sesión) con chevron.

### Navegación
Barra de tabs flotante (glass, radio 26px) fija en la parte inferior, 24px del borde, con 4 ítems: Inicio, Historial, Alertas (con badge de punto), Perfil. Ítem activo: fondo `rgba(255,255,255,0.10)` + ícono/texto en `oklch(0.85 0.02 255)`; inactivo: `rgba(255,255,255,0.4)`.

### Toast de confirmación
Pastilla flotante sobre la barra de tabs (bottom 110px), aparece con animación pop (350ms) al marcar llegada/salida, desaparece a los 2.4s. Fondo `rgba(20,26,34,0.85)` con blur.

## Interacciones y Comportamiento
- Tap en botón de marcado: idle → loading (1.3s simulando validación GPS) → confirmado, con toast.
- Segundo tap (ya marcado): marca salida directamente, muestra toast, resetea cronómetro.
- Cambio de tab: contenido nuevo entra con fade + slide-up (400ms).
- Reloj/cronómetro: actualiza cada 1000ms mientras está marcado.
- Cada pantalla nueva (login, home, historial, etc.) monta con animación `fadeSlideIn`.

## Design Tokens

### Colores (paleta cálida ámbar/naranja — ambientación "atardecer/humo" sobre fondo oscuro)
- Fondo base pantalla del teléfono: `oklch(0.14 0.015 45)`
- Manchas de resplandor (glow blobs) detrás de las tarjetas: `oklch(0.62 0.19 45)`, `oklch(0.5 0.17 25)`, `oklch(0.4 0.1 60)` — todas con blur 95px y opacidad reducida.
- Acento primario (ámbar / marcado, botones): `oklch(0.78 0.16 55)`
- Acento secundario (mapa / GPS, turquesa): `oklch(0.78 0.16 195)`
- Éxito (check-in confirmado): `oklch(0.78 0.15 150)`
- Alerta/tardanza: `oklch(0.68 0.17 30)`
- Texto principal: `oklch(0.97 0.006 255)` (blanco cálido)
- Texto secundario/muted: `oklch(0.7–0.75 0.01–0.02 255/60)`
- Tarjetas glass: fondo `rgba(255,255,255,0.05–0.06)`, borde `rgba(255,255,255,0.08–0.10)`, `backdrop-filter: blur(20px) saturate(160%)`

### Tipografía
- **Manrope** (700/800) — títulos, saludo, labels de botones, números grandes.
- **IBM Plex Sans** (400/500/600) — cuerpo de texto, descripciones, listas.
- Escala: saludo 28px / títulos de sección 24px / labels 17px / cuerpo 13–14px / captions 10.5–12px.

### Espaciado y forma
- Radio de tarjetas: 20–28px (grande, consistente con look "liquid glass").
- Radio de botones circulares: 50% (círculos completos).
- Padding de pantalla: 18px horizontal.
- Gap entre elementos de grid: 10–14px.

### Sombras
- Tarjetas: `0 12px–20px 28px–40px rgba(0,0,0,0.3–0.35)` + inset highlight `0 1px 1px rgba(255,255,255,0.06–0.08)`.
- Barra de tabs: `0 14px 34px rgba(0,0,0,0.45)`.

## Estado (State Management)
- `loggedIn` (bool) — controla si se muestra login o app.
- `pin` (string, máx 4 dígitos) — buffer del PIN ingresado.
- `pinShake` (bool) — activa animación de error.
- `tab` (enum: home | history | notifications | profile) — tab activo.
- `checkedIn` (bool), `checking` (bool) — estado del flujo de marcado.
- `checkInAt` (timestamp) — hora de marcado, usado para el cronómetro en vivo.
- `toast` (string | null) — mensaje de confirmación temporal.

Para producción, `checkedIn`/`checkInAt`/`historial` deben venir de un backend (API de asistencia) en vez de estado local, y la validación de PIN debe hacerse contra un servicio de autenticación, no un valor hardcodeado en el cliente.

## Assets
No se usan imágenes reales — el mapa es un placeholder (patrón rayado) que debe reemplazarse por un SDK de mapas real (Google Maps / Mapbox) mostrando la ubicación en vivo del trabajador y el perímetro de la obra. Los emojis en notificaciones/perfil pueden sustituirse por un set de iconos propio de la app si se define un sistema de iconografía.

## Archivos
- `Asistencia App.dc.html` — prototipo completo (todas las pantallas, lógica de estados, animaciones).
- `ios-frame.jsx` — bisel de dispositivo usado solo para la presentación del prototipo (no es parte de la app real).
