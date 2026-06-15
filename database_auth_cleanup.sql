-- BORRADO DE USUARIOS DE AUTH AL ELIMINAR MÉDICOS
-- Ejecutar en Supabase SQL Editor

-- 1. Habilitar la extensión necesaria para hacer peticiones HTTP si no está (opcional, pero útil)
-- CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";

-- 2. Función para borrar el usuario de la tabla auth.users
-- NOTA: Por seguridad, las tablas de 'auth' están protegidas. 
-- Para que un trigger en 'public' pueda borrar en 'auth', necesitamos SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.borrar_usuario_auth_al_eliminar_medico()
RETURNS trigger AS $$
BEGIN
    -- Borrar el registro correspondiente en auth.users
    -- El ID del médico coincide con el ID del usuario en Auth
    DELETE FROM auth.users WHERE id = OLD.id;
    
    RAISE NOTICE 'Usuario de Auth borrado para el médico ID: %', OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger en la tabla public.medicos
-- Se ejecuta DESPUÉS de borrar el médico para asegurar que la integridad referencial se cumpla
DROP TRIGGER IF EXISTS trigger_borrar_usuario_auth ON public.medicos;
CREATE TRIGGER trigger_borrar_usuario_auth
AFTER DELETE ON public.medicos
FOR EACH ROW
EXECUTE FUNCTION public.borrar_usuario_auth_al_eliminar_medico();

-- IMPORTANTE:
-- Para que esto funcione, el usuario de la base de datos que ejecuta el trigger 
-- debe tener permisos sobre el esquema 'auth'. Supabase por defecto restringe esto.
-- Si recibes un error de permisos, podrías necesitar ejecutar:
-- GRANT DELETE ON auth.users TO postgres;
