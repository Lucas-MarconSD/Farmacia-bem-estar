const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xhwrlvmpsddqpjfzhhwf.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY ausente no backend/.env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function clean() {
  console.log('🔄 Verificando códigos corrompidos com E+ no banco de dados...');

  const { error: errBarcode } = await supabase
    .from('products')
    .update({ barcode: null })
    .like('barcode', '%E+%');

  if (errBarcode) {
    console.error('Erro ao limpar barcode com E+:', errBarcode.message);
  }

  const { error: errExtId } = await supabase
    .from('products')
    .update({ external_id: null })
    .like('external_id', '%E+%');

  if (errExtId) {
    console.error('Erro ao limpar external_id com E+:', errExtId.message);
  }

  const { count: remainingEan } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .like('barcode', '%E+%');

  const { count: remainingExt } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .like('external_id', '%E+%');

  console.log(`✅ Limpeza concluída! Barcodes com E+: ${remainingEan || 0} | External_ids com E+: ${remainingExt || 0}`);
}

clean();
