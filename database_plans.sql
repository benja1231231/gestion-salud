-- PLANES Y SUSCRIPCIONES PARA GESTIONSALUD
-- Ejecutar en Supabase SQL Editor

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE tipo_plan AS ENUM ('freemium', 'premium');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. ACTUALIZAR TABLA MEDICOS
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS plan tipo_plan DEFAULT 'freemium',
ADD COLUMN IF NOT EXISTS suscripcion_activa BOOLEAN DEFAULT TRUE;

-- 3. TABLA DE CONFIGURACIÓN DE LÍMITES (Opcional para mayor flexibilidad)
CREATE TABLE IF NOT EXISTS configuracion_planes (
    plan tipo_plan PRIMARY KEY,
    limite_pacientes INTEGER, -- NULL si es ilimitado
    limite_turnos_mes INTEGER, -- NULL si es ilimitado
    limite_evoluciones_mes INTEGER,
    soporte_prioritario BOOLEAN DEFAULT FALSE,
    custom_branding BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar valores iniciales
INSERT INTO configuracion_planes (plan, limite_pacientes, limite_turnos_mes, limite_evoluciones_mes, soporte_prioritario, custom_branding)
VALUES 
('freemium', 50, 100, 100, false, false),
('premium', NULL, NULL, NULL, true, true)
ON CONFLICT (plan) DO UPDATE SET
    limite_pacientes = EXCLUDED.limite_pacientes,
    limite_turnos_mes = EXCLUDED.limite_turnos_mes,
    limite_evoluciones_mes = EXCLUDED.limite_evoluciones_mes,
    soporte_prioritario = EXCLUDED.soporte_prioritario,
    custom_branding = EXCLUDED.custom_branding;

-- 4. FUNCIÓN PARA VALIDAR LÍMITES
CREATE OR REPLACE FUNCTION check_plan_limits()
RETURNS trigger AS $$
DECLARE
    v_plan tipo_plan;
    v_limite INTEGER;
    v_actual BIGINT;
BEGIN
    -- Obtener plan del médico
    SELECT plan INTO v_plan FROM medicos WHERE id = auth.uid();
    
    -- Si es Premium, no hay límites (o manejar según config)
    IF v_plan = 'premium' THEN
        RETURN NEW;
    END IF;

    -- Validar según la tabla que dispara el trigger
    IF TG_TABLE_NAME = 'pacientes' THEN
        SELECT limite_pacientes INTO v_limite FROM configuracion_planes WHERE plan = v_plan;
        SELECT count(*) INTO v_actual FROM pacientes WHERE medico_creador_id = auth.uid();
        
        IF v_limite IS NOT NULL AND v_actual >= v_limite THEN
            RAISE EXCEPTION 'Límite de pacientes alcanzado para el plan Freemium. Mejora a Premium para continuar.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGERS DE LÍMITES
DROP TRIGGER IF EXISTS trigger_check_pacientes_limit ON pacientes;
CREATE TRIGGER trigger_check_pacientes_limit
BEFORE INSERT ON pacientes
FOR EACH ROW EXECUTE PROCEDURE check_plan_limits();
