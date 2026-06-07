let supabaseInstance = null;

export async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error(`Failed to fetch configuration. Status: ${response.status}`);
    }
    const { supabaseUrl, supabaseAnonKey } = await response.json();
    
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    
    // Configure storage as sessionStorage to prevent persistent localStorage risks
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    
    return supabaseInstance;
  } catch (err) {
    console.error('Supabase client connection exception:', err);
    throw new Error('Connection failed. Check your internet.');
  }
}
