-- SCHEMA COMPLETO PARA GESTION-SALUD (BLIPDOC CLONE)
-- Ejecutar en Supabase SQL Editor

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE estado_turno AS ENUM ('pendiente', 'llegó', 'en_espera', 'en_consultorio', 'finalizado', 'cancelado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. TABLAS

-- Médicos (Auth Link)
CREATE TABLE IF NOT EXISTS medicos (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    matricula TEXT UNIQUE NOT NULL,
    especialidad TEXT,
    firma_url TEXT,
    config_agenda JSONB DEFAULT '{"duracion_turno": 15, "inicio": "08:00", "fin": "20:00", "dias_laborales": [1,2,3,4,5]}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Obras Sociales
CREATE TABLE IF NOT EXISTS obras_sociales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medico_id UUID REFERENCES medicos(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    codigo_nacional TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pacientes
CREATE TABLE IF NOT EXISTS pacientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dni TEXT NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    email TEXT,
    telefono TEXT,
    fecha_nacimiento DATE,
    obra_social_id UUID REFERENCES obras_sociales(id),
    nro_afiliado TEXT,
    medico_creador_id UUID REFERENCES medicos(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dni, medico_creador_id)
);

-- Turnos (Agenda Pro)
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    fecha_hora TIMESTAMPTZ NOT NULL,
    duracion_minutos INTEGER DEFAULT 15,
    estado estado_turno DEFAULT 'pendiente',
    motivo TEXT,
    es_sobreturno BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evoluciones (Historia Clínica)
CREATE TABLE IF NOT EXISTS evoluciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    medico_id UUID NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
    turno_id UUID REFERENCES turnos(id),
    contenido TEXT NOT NULL,
    adjuntos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SEGURIDAD (RLS)

ALTER TABLE medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE evoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras_sociales ENABLE ROW LEVEL SECURITY;

-- Médicos: Solo acceden a su propio perfil
CREATE POLICY "Medicos: Acceso propio" ON medicos FOR ALL USING (auth.uid() = id);

-- Obras Sociales: Acceso por medico
CREATE POLICY "ObrasSociales: Gestion por medico" ON obras_sociales FOR ALL USING (medico_id = auth.uid());
CREATE POLICY "ObrasSociales: Lectura publica" ON obras_sociales FOR SELECT USING (true);

-- Turnos: Médico solo ve sus turnos
CREATE POLICY "Turnos: Gestion por medico" ON turnos FOR ALL USING (medico_id = auth.uid());

-- Pacientes: Médico ve sus pacientes (creados o con turnos)
CREATE POLICY "Pacientes: Acceso por medico" ON pacientes FOR ALL USING (
    medico_creador_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM turnos WHERE turnos.paciente_id = pacientes.id AND turnos.medico_id = auth.uid())
);

-- Evoluciones: Solo el médico tratante
CREATE POLICY "Evoluciones: Acceso por medico" ON evoluciones FOR ALL USING (medico_id = auth.uid());

-- 5. INDEXACIÓN PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_turnos_medico_fecha ON turnos(medico_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_pacientes_dni ON pacientes(dni);
CREATE INDEX IF NOT EXISTS idx_evoluciones_paciente ON evoluciones(paciente_id);

-- 6. AUTOMATIZACIÓN (TRIGGERS)

-- Función para crear perfil de médico automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.medicos (id, nombre, apellido, matricula, especialidad)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'nombre', 'Nuevo'), 
    COALESCE(new.raw_user_meta_data->>'apellido', 'Médico'),
    COALESCE(new.raw_user_meta_data->>'matricula', 'PENDIENTE'), 
    COALESCE(new.raw_user_meta_data->>'especialidad', 'General')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para ejecutar la función
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
