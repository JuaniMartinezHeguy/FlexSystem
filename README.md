# Flex Gym — Sistema Web de Gestión de Gimnasio

Sistema completo de gestión para gimnasios desarrollado con **React (Vite), Tailwind CSS, Lucide React, Framer Motion, Supabase (Auth, PostgreSQL, Realtime, RLS)** y **PWA**.

---

## 🎨 Estilo & Diseño UX/UI

- **Tema**: Dark/Negro Mate Premium con acentos en rojo carmesí (`#ef4444` / `#dc2626`).
- **Fondo base**: `bg-zinc-950` (`#09090b`), contenedores `bg-zinc-900`, bordes `border-zinc-800`.
- **Íconos**: Exclusivamente `lucide-react` (sin emojis en la interfaz).
- **Manejo Horario Estricto**: Todo cálculo de vencimientos, "hoy" y reseteo semanal de metas (Lunes 00:00 ART) se evalúa estrictamente contra la zona horaria `America/Argentina/Buenos_Aires`.

---

## 🚀 Requisitos e Instalación

### 1. Clonar e instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno (`.env`)
Copia `.env.example` a `.env`:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```
> *Nota*: Si no configuras las variables de Supabase inmediatamente, la aplicación iniciará automáticamente en **Modo Local Demo**, permitiéndote probar el 100% de la interfaz con datos semilla locales sin romperse.

### 3. Configurar Supabase & SQL
Abre el SQL Editor en tu dashboard de Supabase y ejecuta todo el contenido de `supabase/schema.sql`.

El script SQL creará:
- Los tipos `ENUM` (`rol_usuario`, `medio_pago`, `estado_suscripcion`, `categoria_gasto`, `dia_semana`).
- Las 8 tablas relacionales (`usuarios`, `planes`, `suscripciones`, `asistencias`, `rutinas`, `ejercicios`, `gastos`, `configuracion`).
- Triggers automáticos de actualización y sincronización.
- Políticas de seguridad **RLS (Row Level Security)** habilitadas para `admin` y `cliente`.
- Publicación **Realtime** en la tabla `suscripciones` para auto-desbloqueo instantáneo del Paywall cuando la recepción registra un pago.

---

## 🛠️ Modos de Uso y Prueba

### 👤 Panel Admin (Recepción / Dueño)
- **Acceso**: Email o DNI `11111111`, contraseña `admin123`.
- **Secciones**:
  1. **Registro & Cobro Rápido**: Alta de nuevo alumno con generación de clave inicial y cobro en un solo paso.
  2. **Alumnos**: Tabla interactiva con filtros por cuotas al día / vencidas, WhatsApp y ficha detallada de historial.
  3. **Stats del Gimnasio**: Ingreso bruto y desglose por medio de pago (Efectivo, Transferencia, Tarjeta) con selector de día, mes y año.
  4. **Gastos & Rentabilidad**: Carga de gastos fijos y eventuales, cálculo de Ganancia Neta.
  5. **Configuración de Planes**: CRUD de membresías con regla de congelamiento de precios y configuración de WhatsApp de recepción.

### 📱 Portal Cliente (PWA Mobile-First)
- **Acceso Socio Al Día**: DNI `40123456`, contraseña `40123456`.
- **Acceso Socio Vencido**: DNI `38999888`, contraseña `38999888`.
- **Características**:
  - **Paywall Vencido**: Bloqueo automático si `fecha_vencimiento < hoy` en ART. Listener en tiempo real desprotege la app apenas la recepción cobra la cuota.
  - **Home Feed**: Contador de días restantes, banner "¿Fuiste a entrenar hoy?", reseteo semanal de meta los lunes 00:00 ART (domingos excluidos), y rutina del día actual con edición en tiempo real de pesos (`peso_kg`).
  - **Mi Rutina Semanal**: Pestañas Lunes a Sábado para armar y editar ejercicios.
  - **Historial & Estadísticas**: Selector de mes, porcentaje de efectividad y mapa de calor interactivo.

---

## ⚡ Comandos Disponibles

```bash
# Servidor de desarrollo
npm run dev

# Compilar para producción (validación TypeScript y bundler)
npm run build

# Previsualizar build de producción
npm run preview
```
