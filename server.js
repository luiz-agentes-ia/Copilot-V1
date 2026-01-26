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

// Helper para parse seguro de JSON
const safeJson = async (response) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Failed to parse JSON from ${response.url}. Status: ${response.status}. Body: ${text.slice(0, 100)}`);
  }
};

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

    // 1. LISTAR CLIENTES (AGORA COM NOMES REAIS)
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
        return res.status(502).json({ error: `Google recusou a conexão inicial.` });
      }

      const data = await safeJson(response);
      const resourceNames = data.resourceNames || [];

      // Passo 2: Buscar detalhes (Nome e se é MCC) para cada conta encontrada
      // Fazemos isso em paralelo para ser rápido
      const detailedCustomers = await Promise.all(resourceNames.map(async (resourceName) => {
        const id = resourceName.replace('customers/', '');
        
        try {
            // Query para pegar o nome da conta e se é gerente
            const queryUrl = `${BASE_URL}/customers/${id}/googleAds:search`;
            const query = `SELECT customer.id, customer.descriptive_name, customer.manager, customer.status FROM customer LIMIT 1`;
            
            const detailResponse = await fetch(queryUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'developer-token': developer_token,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });

            if (detailResponse.ok) {
                const detailData = await detailResponse.json();
                const info = detailData.results?.[0]?.customer;
                
                if (info) {
                    return {
                        id: info.id,
                        name: resourceName,
                        descriptiveName: info.descriptiveName || `Conta ${info.id}`,
                        isManager: info.manager || false,
                        status: info.status,
                        currencyCode: 'BRL',
                        timeZone: 'America/Sao_Paulo'
                    };
                }
            }
        } catch (e) {
            console.warn(`Erro ao buscar detalhes da conta ${id}:`, e.message);
        }

        // Fallback se a query falhar
        return {
            id: id,
            name: resourceName,
            descriptiveName: `Conta ${id} (Sem detalhes)`,
            isManager: false,
            currencyCode: 'BRL',
            timeZone: 'America/Sao_Paulo'
        };
      }));

      // Filtra contas canceladas/fechadas se desejar, ou retorna todas
      // Ordena: MCCs primeiro, depois alfabético
      const sortedCustomers = detailedCustomers.sort((a, b) => {
          if (a.isManager === b.isManager) return a.descriptiveName.localeCompare(b.descriptiveName);
          return a.isManager ? -1 : 1;
      });

      return res.json({ customers: sortedCustomers });
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

      // IMPORTANTE: Se a conta selecionada for MCC, precisamos passar o login-customer-id no header?
      // Geralmente, para ler métricas, devemos selecionar a conta FILHA, não a MCC.
      // A query vai falhar se tentarmos ler métricas de campanha diretamente na MCC root.
      // O frontend deve garantir que o usuário selecione uma conta de anúncio real, não a MCC.

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

      const data = await safeJson(response);
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
