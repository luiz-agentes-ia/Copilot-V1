
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Carrega variáveis locais se existirem (em produção no Render, elas vêm do ambiente do sistema)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

// Rota de Diagnóstico (Health Check)
app.get('/api/health', (req, res) => {
  const devToken = process.env.VITE_GOOGLE_ADS_DEV_TOKEN || process.env.GOOGLE_ADS_DEV_TOKEN;
  res.json({
    status: 'online',
    environment: process.env.NODE_ENV || 'development',
    hasDevToken: !!devToken,
    nodeVersion: process.version
  });
});

// --- PROXY GOOGLE ADS (BACKEND) ---
app.post('/api/google-ads', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Recebida requisição /api/google-ads`);

  try {
    const { action, access_token, customer_id, date_range } = req.body;
    
    // Tenta ler o token de várias fontes possíveis
    const developer_token = process.env.VITE_GOOGLE_ADS_DEV_TOKEN || process.env.GOOGLE_ADS_DEV_TOKEN;

    if (!access_token) {
      console.error('Erro: access_token não fornecido.');
      return res.status(400).json({ error: 'Token de Acesso (Login) não fornecido.' });
    }
    
    if (!developer_token) {
      console.error('Erro CRÍTICO: Developer Token não encontrado nas variáveis de ambiente.');
      return res.status(500).json({ error: 'Configuração de Servidor Incompleta: Developer Token ausente.' });
    }

    const API_VERSION = 'v16';
    const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

    // 1. LISTAR CLIENTES
    if (action === 'list_customers') {
      const url = `${BASE_URL}/customers:listAccessibleCustomers`;
      console.log(`Forwarding to Google: ${url}`);
      
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
        console.error("Google API Erro (List):", errText);
        
        let readableError = errText;
        try {
            const errJson = JSON.parse(errText);
            readableError = errJson.error?.message || errText;
        } catch (e) {}

        // Retorna status 502 (Bad Gateway) para indicar que o erro veio do Google, não do nosso server
        return res.status(502).json({ error: `Google recusou a conexão: ${readableError}` });
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
      if (!customer_id) return res.status(400).json({ error: 'ID do Cliente (Customer ID) faltando.' });

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
        console.error('Google Ads Query Erro:', errText);
        if (errText.includes("CUSTOMER_NOT_FOUND") || errText.includes("NOT_ADS_USER")) {
            return res.json({ results: [] }); 
        }
        return res.status(502).json({ error: `Erro na consulta Google Ads: ${errText}` });
      }

      const data = await response.json();
      return res.json({ results: data.results || [] });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });

  } catch (error) {
    console.error('SERVER INTERNAL ERROR:', error);
    // IMPORTANTE: Retornar JSON mesmo no catch para evitar "Unexpected end of JSON input"
    res.status(500).json({ error: `Erro Interno do Servidor: ${error.message}` });
  }
});

// --- SERVIR FRONTEND (VITE BUILD) ---
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (Node ${process.version})`);
});
