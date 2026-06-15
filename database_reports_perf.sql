-- OPTIMIZACION DE REPORTES - Mayo 2026
-- Mejora de performance para consultas de reportes
-- Ejecutar en Supabase SQL Editor

-- 1. INDICES COMPUESTOS PARA QUERIES DE REPORTES
-- Acelera el filtrado por medico + estado + fecha en turnos
CREATE INDEX IF NOT EXISTS idx_turnos_medico_estado_fecha ON turnos(medico_id, estado, fecha_hora);

-- Acelera el JOIN entre pacientes y obras_sociales
CREATE INDEX IF NOT EXISTS idx_pacientes_obra_social ON pacientes(obra_social_id);

-- 2. REWRITE DE get_os_stats_daily (usa rango de fechas en vez de to_char() en WHERE)
-- Esto permite usar el indice idx_turnos_medico_estado_fecha para index scan
CREATE OR REPLACE FUNCTION get_os_stats_daily(p_medico_id UUID, p_mes TEXT)
RETURNS TABLE (
    dia DATE,
    obra_social TEXT,
    cantidad BIGINT
) AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
BEGIN
    -- Convertir p_mes (YYYY-MM) a rango UTC equivalente a ese mes en zona America/Argentina/Buenos_Aires (UTC-3)
    v_start := (p_mes || '-01')::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires';
    v_end := ((p_mes || '-01')::DATE + INTERVAL '1 month')::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires';

    RETURN QUERY
    SELECT
        (t.fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE as dia,
        os.nombre as obra_social,
        count(t.id) as cantidad
    FROM turnos t
    JOIN pacientes p ON t.paciente_id = p.id
    JOIN obras_sociales os ON p.obra_social_id = os.id
    WHERE t.medico_id = p_medico_id
      AND t.fecha_hora >= v_start
      AND t.fecha_hora < v_end
      AND t.estado != 'cancelado'
    GROUP BY dia, os.nombre
    ORDER BY dia ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. OPTIMIZACION DE get_os_stats_by_month (limitar a ultimos 24 meses)
-- La UI del frontend solo muestra los ultimos 12 meses; mantener 24 para margen
CREATE OR REPLACE FUNCTION get_os_stats_by_month(p_medico_id UUID)
RETURNS TABLE (
    mes TEXT,
    obra_social TEXT,
    cantidad BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        to_char(t.fecha_hora AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') as mes,
        os.nombre as obra_social,
        count(t.id) as cantidad
    FROM turnos t
    JOIN pacientes p ON t.paciente_id = p.id
    JOIN obras_sociales os ON p.obra_social_id = os.id
    WHERE t.medico_id = p_medico_id
      AND t.estado != 'cancelado'
      AND t.fecha_hora >= (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires' - INTERVAL '24 months')::DATE::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires'
    GROUP BY mes, os.nombre
    ORDER BY mes DESC, cantidad DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
