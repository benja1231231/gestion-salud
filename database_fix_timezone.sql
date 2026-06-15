-- FIX: Reportes - Corrección de conversión de zona horaria
-- Bug: La doble conversión AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires' es incorrecta.
--       Los turnos con hora UTC >= 21:00 (hora Argentina >= 18:00) se asignaban al día siguiente.
-- Fix:  Basta con AT TIME ZONE 'America/Argentina/Buenos_Aires' para obtener la fecha correcta en zona Argentina.
-- Ejecutar en Supabase SQL Editor.

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
