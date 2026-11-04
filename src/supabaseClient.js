import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase client configuration.');
}

try {
  const configuredUrl = new URL(supabaseUrl);
  const localDevelopment = ['localhost', '127.0.0.1'].includes(configuredUrl.hostname);
  if (configuredUrl.protocol !== 'https:' && !localDevelopment) {
    throw new Error('Supabase must use HTTPS outside local development.');
  }
} catch (error) {
  if (error instanceof Error && error.message.includes('Supabase must use HTTPS')) throw error;
  throw new Error('VITE_SUPABASE_URL is not a valid URL.');
}

// Only the merchant client may consume a merchant magic-link callback. Keep the
// existing customer session intact when a merchant signs in on this browser.
const merchantRoute = new URLSearchParams(window.location.search).has('merchant');
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { detectSessionInUrl: !merchantRoute },
});
