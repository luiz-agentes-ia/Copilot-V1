
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(express.json());

// --- PROXY GOOGLE ADS (BACKEND) ---
app.post('/api/google-ads', async (req, res) => {
  try {
    const { action, access_token, customer_id, date_range } = req.body;
    
    // O Token de desenvolvedor fica seguro aqui no servidor (process.env)
    const developer_token = process.env.VITE_GOOGLE_ADS_DEV_TOKEN || process.env.GOOGLE_ADS_DEV_TOKEN;

    if (!access_token) return res.status(400).json({ error: 'Missing access_token' });
    if (!developer_token) return res.status(500).json({ error: 'Developer Token not configured on server' });

    const API_VERSION = 'v16';
    const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

    // 1. LISTAR CLIENTES
    if (action === 'list_customers') {
      const url = `${BASE_URL}/customers:listAccessibleCustomers`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'developer-token': developer_token,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google API Error: ${errText}`);
      }

      const data = await response.json();
      const customers = (data.resourceNames || []).map((resourceName) => {
        const id = resourceName.replace('customers/', '');
        return {
          id: id,
          name: resourceName,
          descriptiveName: `Conta ${id}`,
          currencyCode: 'BRL',
          timeZone: 'America/Sao_Paulo'
        };
      });

      return res.json({ customers });
    }

    // 2. BUSCAR CAMPANHAS
    if (action === 'get_campaigns') {
      if (!customer_id) return res.status(400).json({ error: 'Missing customer_id' });

      const cleanCustomerId = customer_id.replace(/-/g, '');
      const url = `${BASE_URL}/customers/${cleanCustomerId}/googleAds:search`;

      let query = `
        SELECT 
          campaign.id, 
          campaign.name, 
          campaign.status, 
          metrics.clicks, 
          metrics.impressions, 
          metrics.cost_micros, 
          metrics.conversions 
        FROM campaign 
        WHERE campaign.status != 'REMOVED' 
      `;

      if (date_range && date_range.start && date_range.end) {
        query += ` AND segments.date BETWEEN '${date_range.start}' AND '${date_range.end}'`;
      } else {
        query += ` AND segments.date DURING LAST_30_DAYS`;
      }
      query += ` LIMIT 50`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'developer-token': developer_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Google Ads Query Error:', errText);
        // Retorna array vazio se não tiver permissão, para não quebrar o front
        if (errText.includes("CUSTOMER_NOT_FOUND") || errText.includes("NOT_ADS_USER")) {
            return res.json({ results: [] }); 
        }
        throw new Error(errText);
      }

      const data = await response.json();
      return res.json({ results: data.results || [] });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- SERVIR FRONTEND (VITE BUILD) ---
// Serve arquivos estáticos da pasta 'dist'
app.use(express.static(path.join(__dirname, 'dist')));

// Qualquer outra rota retorna o index.html (para o React Router funcionar)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
