export default function handler(req, res) {
  // Security: Disable x-powered-by signature
  res.setHeader('x-powered-by', 'none');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase credentials are missing on server.' });
  }
  
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
}
