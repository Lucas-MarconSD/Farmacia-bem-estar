require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function makeAdmin() {
  console.log("Buscando o seu usuário no Supabase Auth...");
  
  // Lista o(s) usuário(s) registrado(s)
  const { data, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error("Erro ao buscar usuários:", error.message);
    return;
  }
  
  if (!data || data.users.length === 0) {
    console.log("Nenhum usuário encontrado! Você precisa se cadastrar na tela de Login primeiro.");
    return;
  }

  // Pega o primeiro usuário (seu email)
  const user = data.users[0];
  console.log(`Usuário encontrado: ${user.email} (ID: ${user.id})`);

  console.log("Adicionando você na tabela de Administradores (admins)...");
  
  // Insere o ID dele na tabela admins (bypassa RLS porque usa Service Role)
  const { error: insertError } = await supabase
    .from('admins')
    .upsert({ user_id: user.id }, { onConflict: 'user_id' });
    
  if (insertError) {
    console.error("Erro ao adicionar admin:", insertError.message);
  } else {
    console.log(`SUCESSO! O usuário ${user.email} agora é um ADMINISTRADOR!`);
  }
}

makeAdmin();
