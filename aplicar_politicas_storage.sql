-- ====================================================================
-- POLÍTICAS DE RLS PARA O STORAGE (product-images)
-- Execute este script no SQL Editor do seu painel Supabase
-- (https://supabase.com/dashboard/project/xhwrlvmpsddqpjfzhhwf/sql)
-- ====================================================================

-- 1. Limpeza de políticas anteriores para evitar erros de duplicidade
DROP POLICY IF EXISTS "Fotos públicas acessíveis por qualquer visitante" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem atualizar fotos" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem deletar fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura publica de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload para usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir update para usuarios autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir delete para usuarios autenticados" ON storage.objects;

-- 2. Leitura pública de fotos (essencial para exibir no site e obter metadados no upload)
CREATE POLICY "Permitir leitura publica de fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- 3. Upload para administradores autenticados
CREATE POLICY "Permitir upload para usuarios autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- 4. Atualização para administradores autenticados (obrigatório para upsert: true)
CREATE POLICY "Permitir update para usuarios autenticados"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- 5. Deleção de fotos para administradores autenticados
CREATE POLICY "Permitir delete para usuarios autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');
