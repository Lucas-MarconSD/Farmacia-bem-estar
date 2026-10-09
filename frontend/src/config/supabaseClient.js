import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xhwrlvmpsddqpjfzhhwf.supabase.co';
const supabaseKey = 'sb_publishable_OIuhc5e-K8-i4ZmCGfcVIg_4j12iZN_';

export const supabase = createClient(supabaseUrl, supabaseKey);
