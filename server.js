import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security: Disable powered-by signature header
app.disable('x-powered-by');

// Dynamic configuration provider
app.get('/api/config', (req, res) => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase credentials are missing on server.' });
  }
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY
  });
});

// Serve static website files from the project root
app.use(express.static(__dirname));

// Direct root visits to the dynamic landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'index.html'));
});

// Fallback generic error handler (suppress server leaks)
app.use((err, req, res, next) => {
  console.error('Express Server Exception:', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`[SECURE APP] Server started successfully at http://localhost:${PORT}`);
});

export default app;
