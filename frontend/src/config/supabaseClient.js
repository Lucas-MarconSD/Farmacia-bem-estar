import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xhwrlvmpsddqpjfzhhwf.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OIuhc5e-K8-i4ZmCGfcVIg_4j12iZN_';

export const supabase = createClient(supabaseUrl, supabaseKey);
