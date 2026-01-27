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
  console.log(`[${new Date().toISOString()}] Recebida requisição /api/google-ads [${req.body.action}]`);

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

    // ATUALIZADO PARA V19 (Versão Estável Recente)
    const API_VERSION = 'v19'; 
    const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;

    // 1. LISTAR CLIENTES (HIERARQUIA PROFUNDA)
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
        console.error("Google API Erro (List):", errText);
        if (errText.includes("TEST_ACCOUNT") || errText.includes("DEVELOPER_TOKEN_PROHIBITED")) {
             return res.status(403).json({ error: 'Seu Developer Token é de nível TESTE. Você só pode acessar contas de teste, não contas de produção.' });
        }
        return res.status(502).json({ error: `Google recusou a conexão: ${response.statusText}` });
      }

      const data = await safeJson(response);
      const resourceNames = data.resourceNames || [];
      const accessibleIds = resourceNames.map(r => r.replace('customers/', ''));

      console.log(`Encontradas ${accessibleIds.length} contas raiz. Expandindo hierarquia...`);

      // ARRAY PARA ARMAZENAR TODAS AS CONTAS (MCCs + CLIENTES FINAIS)
      let allAccounts = [];

      // Função para buscar sub-contas de uma MCC
      const fetchSubAccounts = async (managerId) => {
          const query = `
            SELECT 
                customer_client.client_customer, 
                customer_client.descriptive_name, 
                customer_client.manager, 
                customer_client.status,
                customer_client.currency_code,
                customer_client.time_zone
            FROM customer_client 
            WHERE customer_client.status = 'ENABLED'
          `;

          const searchUrl = `${BASE_URL}/customers/${managerId}/googleAds:search`;
          
          try {
              const res = await fetch(searchUrl, {
                  method: 'POST',
                  headers: {
                      'Authorization': `Bearer ${access_token}`,
                      'developer-token': developer_token,
                      'login-customer-id': managerId, // Importante: Logar como a MCC
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ query })
              });

              if (res.ok) {
                  const json = await res.json();
                  return (json.results || []).map(row => {
                      const client = row.customerClient;
                      return {
                          id: client.clientCustomer.replace('customers/', ''),
                          name: client.clientCustomer,
                          descriptiveName: client.descriptiveName || `Conta ${client.clientCustomer}`,
                          isManager: client.manager || false,
                          status: client.status,
                          currencyCode: client.currencyCode || 'BRL',
                          timeZone: client.timeZone || 'America/Sao_Paulo',
                          parentMcc: managerId // Referência útil
                      };
                  });
              }
          } catch (e) {
              console.warn(`Erro ao expandir MCC ${managerId}:`, e.message);
          }
          return [];
      };

      // Itera sobre as contas acessíveis diretamente (geralmente MCCs)
      for (const rootId of accessibleIds) {
          // Adiciona a própria MCC à lista (caso queira ver dados dela)
          // Mas primeiro precisamos dos detalhes dela
          try {
             const selfQuery = `SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1`;
             const selfRes = await fetch(`${BASE_URL}/customers/${rootId}/googleAds:search`, {
                 method: 'POST',
                 headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'developer-token': developer_token,
                    'Content-Type': 'application/json',
                 },
                 body: JSON.stringify({ query: selfQuery })
             });
             
             if (selfRes.ok) {
                 const selfJson = await selfRes.json();
                 const info = selfJson.results?.[0]?.customer;
                 if (info) {
                     allAccounts.push({
                         id: String(info.id),
                         name: `customers/${info.id}`,
                         descriptiveName: info.descriptiveName || `MCC Raiz ${info.id}`,
                         isManager: info.manager || false,
                         currencyCode: 'BRL',
                         timeZone: 'America/Sao_Paulo'
                     });

                     // SE FOR MCC, BUSCA OS FILHOS
                     if (info.manager) {
                         const subAccounts = await fetchSubAccounts(String(info.id));
                         allAccounts = [...allAccounts, ...subAccounts];
                     }
                 }
             }
          } catch (e) {
              console.warn(`Erro ao processar conta raiz ${rootId}`, e);
          }
      }

      // Remove duplicatas (caso uma conta apareça em múltiplas MCCs)
      const uniqueAccounts = Array.from(new Map(allAccounts.map(item => [item.id, item])).values());

      // Ordena: Clientes primeiro, MCCs por último (para facilitar seleção)
      const sortedCustomers = uniqueAccounts.sort((a, b) => {
          if (a.isManager === b.isManager) return a.descriptiveName.localeCompare(b.descriptiveName);
          return a.isManager ? 1 : -1; // MCCs no final da lista
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

      // Helper para fazer a requisição, aceitando loginCustomerId opcional
      const fetchCampaigns = async (loginCustomerId = null) => {
         const headers = {
            'Authorization': `Bearer ${access_token}`,
            'developer-token': developer_token,
            'Content-Type': 'application/json'
         };
         if (loginCustomerId) {
            headers['login-customer-id'] = loginCustomerId;
         }
         
         return fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query })
         });
      };

      // TENTATIVA 1: Acesso Direto
      let response = await fetchCampaigns();
      
      // SMART MCC RETRY: Se falhar com erro de permissão, tentamos encontrar uma MCC acessível
      if (!response.ok) {
         const errText = await response.text();
         
         // Se o erro indicar falta de acesso direto, e temos um usuário de agência (MCC)
         if (errText.includes("NOT_ADS_USER") || errText.includes("AuthorizationError.USER_PERMISSION_DENIED")) {
            console.log(`Acesso direto falhou para ${cleanCustomerId}. Tentando via MCCs acessíveis...`);
            
            // Busca lista de clientes acessíveis para encontrar MCCs
            const listUrl = `${BASE_URL}/customers:listAccessibleCustomers`;
            const listRes = await fetch(listUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'developer-token': developer_token,
                    'Content-Type': 'application/json',
                }
            });
            
            if (listRes.ok) {
                const listData = await listRes.json();
                const possibleMccs = (listData.resourceNames || []).map(rn => rn.replace('customers/', ''));
                
                // Tenta cada MCC encontrada como login-customer-id (limite de 3 para não demorar demais)
                for (const mccId of possibleMccs.slice(0, 3)) {
                    // Não usa a própria conta alvo como MCC
                    if (mccId === cleanCustomerId) continue;

                    console.log(`Tentando acesso via MCC: ${mccId}`);
                    const mccResponse = await fetchCampaigns(mccId);
                    if (mccResponse.ok) {
                        response = mccResponse; // Sucesso! Substitui a resposta original
                        break;
                    }
                }
            }
         } else {
             // Se não for erro de permissão (ex: erro de servidor), retorna o erro original
             console.error('Google Ads Query Erro (Fatal):', errText);
             return res.status(502).json({ error: `Erro na consulta Google Ads: ${errText}` });
         }
      }

      if (!response.ok) {
        // Se ainda assim falhou após retry
        const finalErr = await response.text();
        console.error('Todas as tentativas falharam:', finalErr);
        if (finalErr.includes("CUSTOMER_NOT_FOUND")) {
             return res.json({ results: [] }); 
        }
        return res.status(502).json({ error: `Não foi possível acessar a conta. Verifique se o ID está correto e se você tem permissão.` });
      }

      const data = await safeJson(response);
      return res.json({ results: data.results || [] });
    }

    return res.status(400).json({ error: `Ação desconhecida: ${action}` });

  } catch (error) {
    console.error('SERVER INTERNAL ERROR:', error);
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