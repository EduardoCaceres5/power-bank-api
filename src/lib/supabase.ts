import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Cliente con Service Role Key (para operaciones del servidor)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Cliente público (para validación de tokens)
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
