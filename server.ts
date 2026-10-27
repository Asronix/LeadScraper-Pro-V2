import express from 'express';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json());

// API endpoint to fetch and return webpage HTML for real-time live page scanning
app.get('/api/scrape-url', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let formatted = targetUrl.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = 'https://' + formatted;
  }

  try {
    const fetchRes = await fetch(formatted, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (LeadScrape Pro Live Scanner)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({
        error: `Website responded with HTTP ${fetchRes.status} ${fetchRes.statusText}`
      });
    }

    const html = await fetchRes.text();
    return res.json({
      url: formatted,
      html,
      status: fetchRes.status
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || 'Failed to fetch webpage'
    });
  }
});

async function main() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });
  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LeadScrape Pro] Server running at http://0.0.0.0:${PORT}`);
  });
}

main();
