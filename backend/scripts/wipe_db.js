require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function wipeDatabase() {
  console.log("Iniciando limpeza do banco de dados...");
  
  // Como são muitos registros, não podemos deletar tudo sem filtro.
  // Vamos apagar usando id > 0 para o PostgREST aceitar a deleção em massa.
  
  console.log("Limpando produtos...");
  const { error: prodError } = await supabase
    .from('products')
    .delete()
    .gt('id', 0);
    
  if (prodError) {
    console.error("Erro ao apagar produtos:", prodError.message);
  } else {
    console.log("Produtos apagados com sucesso.");
  }
  
  console.log("Limpando categorias...");
  const { error: catError } = await supabase
    .from('categories')
    .delete()
    .gt('id', 0);
    
  if (catError) {
    console.error("Erro ao apagar categorias:", catError.message);
  } else {
    console.log("Categorias apagadas com sucesso.");
  }
}

wipeDatabase();
