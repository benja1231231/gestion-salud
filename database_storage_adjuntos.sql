-- CONFIGURACIÓN DE STORAGE PARA ADJUNTOS DE EVOLUCIONES
-- Ejecutar en Supabase SQL Editor

-- 1. Crear bucket 'adjuntos' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('adjuntos', 'adjuntos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Seguridad para el bucket 'adjuntos'

-- Permitir que cualquier médico autenticado suba adjuntos a su propia carpeta
CREATE POLICY "Medicos: Subir adjuntos propios"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'adjuntos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que los médicos vean/descarguen sus propios adjuntos
CREATE POLICY "Medicos: Ver adjuntos propios"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'adjuntos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir lectura pública (opcional, si prefieres acceso vía URL pública directa)
CREATE POLICY "Adjuntos: Lectura pública"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'adjuntos');

-- Permitir que los médicos eliminen sus adjuntos
CREATE POLICY "Medicos: Borrar adjuntos propios"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'adjuntos' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
