-- AUTOMATIZACIÓN DE BORRADO DE ARCHIVOS EN STORAGE
-- Ejecutar en Supabase SQL Editor

-- 1. Función para extraer el nombre del objeto desde la URL pública
-- Asume formato: .../storage/v1/object/public/adjuntos/NOMBRE_DEL_ARCHIVO
CREATE OR REPLACE FUNCTION public.extraer_ruta_storage(url text)
RETURNS text AS $$
BEGIN
    -- Retorna todo lo que está después de '/adjuntos/'
    RETURN split_part(url, '/adjuntos/', 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Función del Trigger para borrar archivos de Storage
CREATE OR REPLACE FUNCTION public.borrar_adjuntos_evolucion()
RETURNS trigger AS $$
DECLARE
    url_adjunto text;
    ruta_adjunto text;
BEGIN
    -- Iterar sobre el array de adjuntos (JSONB)
    FOR url_adjunto IN SELECT jsonb_array_elements_text(OLD.adjuntos)
    LOOP
        ruta_adjunto := public.extraer_ruta_storage(url_adjunto);
        
        -- Borrar el objeto de la tabla de storage de Supabase
        DELETE FROM storage.objects 
        WHERE bucket_id = 'adjuntos' 
        AND name = ruta_adjunto;
        
        RAISE NOTICE 'Archivo borrado de storage: %', ruta_adjunto;
    END LOOP;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger en la tabla evoluciones
-- Se ejecuta ANTES del borrado para tener acceso a los datos de OLD.adjuntos
DROP TRIGGER IF EXISTS trigger_borrar_adjuntos_evolucion ON public.evoluciones;
CREATE TRIGGER trigger_borrar_adjuntos_evolucion
BEFORE DELETE ON public.evoluciones
FOR EACH ROW
EXECUTE FUNCTION public.borrar_adjuntos_evolucion();
