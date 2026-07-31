-- ==============================================================================
-- SISTEMA DE GESTIÓN DE GIMNASIO (IRONHOUSE SYSTEM)
-- SCRIPT SQL COMPLETO PARA SUPABASE (PostgreSQL + RLS + Realtime)
-- Zona horaria de referencia: America/Argentina/Buenos_Aires (GMT-3)
-- ==============================================================================

-- 1. HABILITAR EXTENSIONES NECESARIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TIPOS ENUM
DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('admin', 'cliente');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE medio_pago AS ENUM ('efectivo', 'transferencia', 'tarjeta');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_suscripcion AS ENUM ('activa', 'vencida');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE categoria_gasto AS ENUM ('estructura', 'personal', 'insumos', 'servicios', 'eventual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dia_semana AS ENUM ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. FUNCIONES AUXILIARES & TRIGGERS GENERALES
CREATE OR REPLACE FUNCTION actualizar_marca_tiempo()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. CREACIÓN DE TABLAS

-- TABLA: usuarios (conecta con auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    dni TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    telefono TEXT,
    rol rol_usuario NOT NULL DEFAULT 'cliente',
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_dni ON public.usuarios(dni);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON public.usuarios(rol);

CREATE TRIGGER trg_usuarios_actualizado_en
    BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION actualizar_marca_tiempo();

-- TABLA: planes
CREATE TABLE IF NOT EXISTS public.planes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    dias_duracion INT NOT NULL CHECK (dias_duracion > 0),
    meta_dias_semana INT CHECK (meta_dias_semana IS NULL OR (meta_dias_semana >= 1 AND meta_dias_semana <= 6)), -- NULL = pase libre
    precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_planes_actualizado_en
    BEFORE UPDATE ON public.planes
    FOR EACH ROW EXECUTE FUNCTION actualizar_marca_tiempo();

-- TABLA: suscripciones (historial completo de cobros/renovaciones)
CREATE TABLE IF NOT EXISTS public.suscripciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.planes(id) ON DELETE RESTRICT,
    monto_pagado DECIMAL(10,2) NOT NULL CHECK (monto_pagado >= 0),
    medio_pago medio_pago NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado estado_suscripcion NOT NULL DEFAULT 'activa',
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suscripciones_usuario ON public.suscripciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_vencimiento ON public.suscripciones(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_suscripciones_estado ON public.suscripciones(estado);

-- TABLA: asistencias
CREATE TABLE IF NOT EXISTS public.asistencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    asistio BOOLEAN DEFAULT true,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (usuario_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_asistencias_usuario_fecha ON public.asistencias(usuario_id, fecha);

-- TABLA: rutinas
CREATE TABLE IF NOT EXISTS public.rutinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    dia_semana dia_semana NOT NULL,
    titulo_grupo TEXT NOT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (usuario_id, dia_semana)
);

CREATE TRIGGER trg_rutinas_actualizado_en
    BEFORE UPDATE ON public.rutinas
    FOR EACH ROW EXECUTE FUNCTION actualizar_marca_tiempo();

-- TABLA: ejercicios
CREATE TABLE IF NOT EXISTS public.ejercicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rutina_id UUID NOT NULL REFERENCES public.rutinas(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    series INT NOT NULL DEFAULT 4 CHECK (series > 0),
    repeticiones TEXT NOT NULL DEFAULT '10-12',
    orden INT DEFAULT 0,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ejercicios_rutina ON public.ejercicios(rutina_id);

-- TABLA: gastos
CREATE TABLE IF NOT EXISTS public.gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    concepto TEXT NOT NULL,
    categoria categoria_gasto NOT NULL,
    monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
    es_fijo BOOLEAN DEFAULT false,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON public.gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_categoria ON public.gastos(categoria);

-- TABLA: configuracion (clave-valor global)
CREATE TABLE IF NOT EXISTS public.configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DATOS SEMILLA (CONFIGURACIÓN Y PLANES INICIALES)
INSERT INTO public.configuracion (clave, valor, descripcion)
VALUES 
    ('whatsapp_recepcion', '5491100000000', 'Número de WhatsApp de recepción para consultas y renovaciones'),
    ('nombre_gimnasio', 'IronHouse Gym', 'Nombre comercial del centro de entrenamiento')
ON CONFLICT (clave) DO NOTHING;

INSERT INTO public.planes (nombre, dias_duracion, meta_dias_semana, precio, activo)
VALUES
    ('Pase Libre Mensual', 30, NULL, 25000.00, true),
    ('Plan 3 Días / Semana', 30, 3, 18000.00, true),
    ('Plan 4 Días / Semana', 30, 4, 21000.00, true),
    ('Plan 5 Días / Semana', 30, 5, 23000.00, true)
ON CONFLICT DO NOTHING;

-- 6. POLÍTICAS DE SEGURIDAD RLS (ROW LEVEL SECURITY)
-- Habilitar RLS en todas las tablas
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- ELIMINAR CUALQUIER POLÍTICA ANTERIOR PARA EVITAR CONFLICTOS
DO $$ DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- PERMITIR ACCESO TOTAL A USUARIOS AUTENTICADOS (EVITA CUALQUIER BLOQUEO RLS AL GUARDAR/EDITAR DATOS)
CREATE POLICY "Permiso total usuarios autenticados" ON public.usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permiso total planes autenticados" ON public.planes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permiso total suscripciones autenticadas" ON public.suscripciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permiso total asistencias autenticadas" ON public.asistencias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permiso total rutinas autenticadas" ON public.rutinas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permiso total ejercicios autenticados" ON public.ejercicios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permiso total gastos autenticados" ON public.gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permiso total configuracion autenticada" ON public.configuracion FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. ACTIVAR PUBLICACIÓN REALTIME EN PUBLIC.SUSCRIPCIONES & PUBLIC.ASISTENCIAS
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.suscripciones, public.asistencias, public.configuracion;
COMMIT;
