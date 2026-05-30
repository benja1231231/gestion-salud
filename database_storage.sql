-- CONFIGURACIÓN DE STORAGE PARA FIRMAS DIGITALES
-- Ejecutar en Supabase SQL Editor

-- 1. Crear bucket 'firmas' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('firmas', 'firmas', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Seguridad para el bucket 'firmas'

-- Permitir que cualquier médico autenticado suba su propia firma
-- El nombre del archivo debe empezar con su ID de médico
CREATE POLICY "Medicos: Subir propia firma"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'firmas' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que los médicos actualicen o borren su propia firma
CREATE POLICY "Medicos: Gestionar propia firma"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'firmas' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Medicos: Borrar propia firma"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'firmas' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir lectura pública de las firmas (necesario para el PDF Service del backend)
CREATE POLICY "Firmas: Lectura pública"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'firmas');
