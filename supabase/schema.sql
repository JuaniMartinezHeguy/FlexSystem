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

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rutinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- Helper función para verificar si el usuario autenticado es Admin
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.usuarios
        WHERE id = auth.uid() AND rol = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS: usuarios
CREATE POLICY "Admin total sobre usuarios" ON public.usuarios
    FOR ALL TO authenticated USING (es_admin());

CREATE POLICY "Clientes leen su propio usuario" ON public.usuarios
    FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Clientes actualizan su propio usuario" ON public.usuarios
    FOR UPDATE TO authenticated USING (id = auth.uid());

-- POLÍTICAS: planes
CREATE POLICY "Lectura publica o autenticada de planes activos" ON public.planes
    FOR SELECT TO authenticated USING (activo = true OR es_admin());

CREATE POLICY "Admin total sobre planes" ON public.planes
    FOR ALL TO authenticated USING (es_admin());

-- POLÍTICAS: suscripciones
CREATE POLICY "Admin total sobre suscripciones" ON public.suscripciones
    FOR ALL TO authenticated USING (es_admin());

CREATE POLICY "Clientes ven sus propias suscripciones" ON public.suscripciones
    FOR SELECT TO authenticated USING (usuario_id = auth.uid());

-- POLÍTICAS: asistencias
CREATE POLICY "Admin total sobre asistencias" ON public.asistencias
    FOR ALL TO authenticated USING (es_admin());

CREATE POLICY "Clientes ven sus asistencias" ON public.asistencias
    FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE POLICY "Clientes registran su propia asistencia" ON public.asistencias
    FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Clientes modifican su propia asistencia" ON public.asistencias
    FOR UPDATE TO authenticated USING (usuario_id = auth.uid());

-- POLÍTICAS: rutinas
CREATE POLICY "Admin total sobre rutinas" ON public.rutinas
    FOR ALL TO authenticated USING (es_admin());

CREATE POLICY "Clientes gestionan sus propias rutinas" ON public.rutinas
    FOR ALL TO authenticated USING (usuario_id = auth.uid());

-- POLÍTICAS: ejercicios
CREATE POLICY "Admin total sobre ejercicios" ON public.ejercicios
    FOR ALL TO authenticated USING (es_admin());

CREATE POLICY "Clientes gestionan ejercicios de sus rutinas" ON public.ejercicios
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.rutinas
            WHERE id = ejercicios.rutina_id AND usuario_id = auth.uid()
        )
    );

-- POLÍTICAS: gastos
CREATE POLICY "Admin total sobre gastos" ON public.gastos
    FOR ALL TO authenticated USING (es_admin());

-- POLÍTICAS: configuracion
CREATE POLICY "Lectura autenticada de configuracion" ON public.configuracion
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin modifica configuracion" ON public.configuracion
    FOR ALL TO authenticated USING (es_admin());

-- 7. ACTIVAR PUBLICACIÓN REALTIME EN PUBLIC.SUSCRIPCIONES & PUBLIC.ASISTENCIAS
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.suscripciones, public.asistencias, public.configuracion;
COMMIT;
