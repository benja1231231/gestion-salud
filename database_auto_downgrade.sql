-- AUTOMATIZACIÓN DE VENCIMIENTO DE PLAN PREMIUM
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar columna de vencimiento
ALTER TABLE medicos 
ADD COLUMN IF NOT EXISTS premium_vencimiento TIMESTAMPTZ;

-- 2. Función para verificar y degradar planes vencidos
CREATE OR REPLACE FUNCTION public.verificar_vencimiento_planes()
RETURNS void AS $$
BEGIN
    -- Cambiar a freemium a los médicos cuya fecha de vencimiento ya pasó
    UPDATE medicos
    SET plan = 'freemium',
        suscripcion_activa = false
    WHERE plan = 'premium' 
    AND premium_vencimiento < NOW();
    
    RAISE NOTICE 'Chequeo de vencimientos completado.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Explicación de ejecución automática (CRON)
-- Para que esto corra solo, tienes dos opciones en Supabase:
-- A. Extension pg_cron (Si está disponible en tu proyecto):
-- SELECT cron.schedule('0 0 * * *', 'SELECT verificar_vencimiento_planes();'); -- Corre cada medianoche

-- B. Edge Functions (Alternativa):
-- Crear una función que llame a esta query y dispararla con un cron externo (como GitHub Actions o cron-job.org).
