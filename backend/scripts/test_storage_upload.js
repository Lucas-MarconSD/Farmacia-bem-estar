const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xhwrlvmpsddqpjfzhhwf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = 'sb_publishable_OIuhc5e-K8-i4ZmCGfcVIg_4j12iZN_';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY ausente no backend/.env');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const userClient = createClient(SUPABASE_URL, ANON_KEY);

async function verify() {
  console.log('🔄 Testando permissões de upload autenticado no Supabase Storage...');

  // Gera sessão de teste para lucas.marcom@gmail.com
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: 'lucas.marcom@gmail.com'
  });

  if (linkErr) {
    console.error('❌ Falha ao obter link de autenticação:', linkErr.message);
    return;
  }

  const { data: sessionData, error: sessErr } = await userClient.auth.verifyOtp({
    email: 'lucas.marcom@gmail.com',
    token: linkData.properties.email_otp,
    type: 'magiclink'
  });

  if (sessErr) {
    console.error('❌ Falha ao autenticar cliente:', sessErr.message);
    return;
  }

  console.log('✅ Usuário autenticado com sucesso:', sessionData.user.email);

  // Tenta upload no bucket product-images com upsert: true (mesmo fluxo do painel)
  const testFileName = `teste-rls-${Date.now()}.txt`;
  const buffer = Buffer.from('Teste de validacao de politica de Storage RLS');

  const { data: uploadData, error: uploadErr } = await userClient.storage
    .from('product-images')
    .upload(testFileName, buffer, {
      upsert: true,
      contentType: 'text/plain'
    });

  if (uploadErr) {
    console.error('❌ ERRO NO UPLOAD (RLS ainda bloqueando):', uploadErr.message);
    console.log('\n👉 Execute o arquivo "aplicar_politicas_storage.sql" no SQL Editor do Supabase.');
  } else {
    console.log('🎉 SUCESSO! Upload concluído sem erros:', uploadData.path);
    // Remove o arquivo de teste
    await userClient.storage.from('product-images').remove([testFileName]);
    console.log('🧹 Arquivo de teste removido.');
    console.log('\nAs políticas de Storage estão 100% ativas e funcionando perfeitamente!');
  }
}

verify();
