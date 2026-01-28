
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Carrega variáveis de ambiente locais (se houver arquivo .env)
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- CONFIGURAÇÕES GLOBAIS (HARDCODED) ---
// Configurado diretamente para garantir funcionamento no Render sem variáveis de ambiente

const APP_BASE_URL = 'https://copilot-v1.onrender.com'; 
const EVO_URL = 'https://task-dev-01-evolution-api.8ypyjm.easypanel.host';
const EVO_GLOBAL_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const GOOGLE_ADS_DEV_TOKEN = 'F_eYB5lJNEavmardpRzBtw';

// --- SUPABASE ADMIN ---
// Tenta pegar do env, mas se falhar, tenta usar a chave anônima (embora service_role seja ideal)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rxvvtdqxinttuoamtapa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_cZXM43qOuiYp_JOR2D0Y7w_ofs7o-Gi';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper para tratar respostas JSON com segurança
const safeJson = async (response) => {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; } 
  catch (e) { return {}; }
};

// ==============================================================================
// 1. ROTAS DE GERENCIAMENTO WHATSAPP
// ==============================================================================

app.post('/api/whatsapp/init', async (req, res) => {
  const { userId, clinicName } = req.body;
  
  // Limpeza de caracteres especiais para nome da instância
  const instanceName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '')}`;
  console.log(`[Manager] Iniciando configuração para: ${instanceName}`);

  try {
    // 1. Verifica se a instância já existe na Evolution
    const checkRes = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, {
       headers: { 'apikey': EVO_GLOBAL_KEY }
    });

    // 2. Se não existe (404), cria uma nova
    if (checkRes.status === 404) {
       console.log(`[Manager] Instância não encontrada. Criando nova...`);
       
       const webhookUrl = `${APP_BASE_URL}/api/webhooks/whatsapp`;

       const createRes = await fetch(`${EVO_URL}/instance/create`, {
          method: 'POST',
          headers: { 
            'apikey': EVO_GLOBAL_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
             instanceName: instanceName,
             token: userId,
             qrcode: true,
             webhook: webhookUrl,
             webhook_by_events: true,
             events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
          })
       });
       
       if (!createRes.ok) {
           const err = await safeJson(createRes);
           throw new Error(err.message || 'Falha ao criar instância na Evolution.');
       }
    }

    // 3. Conecta (Gera QR Code se necessário)
    const connectRes = await fetch(`${EVO_URL}/instance/connect/${instanceName}`, {
        headers: { 'apikey': EVO_GLOBAL_KEY }
    });
    
    const connectData = await safeJson(connectRes);

    // 4. Salva referência no banco de dados (Supabase)
    const { error: dbError } = await supabase
        .from('whatsapp_instances')
        .upsert({ 
            user_id: userId, 
            instance_name: instanceName,
            status: connectData?.instance?.state === 'open' ? 'connected' : 'qrcode'
        }, { onConflict: 'user_id' });

    if (dbError) {
        console.error("Erro ao salvar instância no DB:", dbError);
    }

    res.json({
        instanceName,
        base64: connectData.base64 || connectData.qrcode?.base64, 
        state: connectData?.instance?.state || 'connecting'
    });

  } catch (error) {
    console.error('Erro Init WhatsApp:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/whatsapp/status', async (req, res) => {
    const { instanceName } = req.body;
    try {
        const response = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': EVO_GLOBAL_KEY }
        });
        const data = await safeJson(response);
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao checar status' });
    }
});

app.post('/api/whatsapp/send', async (req, res) => {
    const { instanceName, number, text } = req.body;
    try {
        const response = await fetch(`${EVO_URL}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: { 
                'apikey': EVO_GLOBAL_KEY,
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                number,
                options: { delay: 1200, presence: "composing" },
                textMessage: { text }
            })
        });
        const data = await safeJson(response);
        res.json(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// ==============================================================================
// 2. WEBHOOK CENTRAL (Recebe dados do WhatsApp)
// ==============================================================================

app.post('/api/webhooks/whatsapp', async (req, res) => {
    // Responde rápido para a Evolution não tentar reenviar
    res.status(200).send('OK');

    try {
        const body = req.body;
        const event = body.event;
        const instance = body.instance;
        const data = body.data;

        // Atualização de Status (Conectado/Desconectado)
        if (event === 'CONNECTION_UPDATE') {
            const status = data.state;
            const dbStatus = status === 'open' ? 'connected' : 'disconnected';
            
            await supabase
                .from('whatsapp_instances')
                .update({ status: dbStatus })
                .eq('instance_name', instance);
        }

        // Recebimento de Mensagens (Salva como Lead ou Histórico)
        if (event === 'MESSAGES_UPSERT') {
            if (!data.key.fromMe) {
                const remoteJid = data.key.remoteJid;
                const phone = remoteJid.split('@')[0];
                const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '[Mídia]';
                const pushName = data.pushName || 'Desconhecido';

                // Busca a qual usuário do nosso sistema essa instância pertence
                const { data: instanceData } = await supabase
                    .from('whatsapp_instances')
                    .select('user_id')
                    .eq('instance_name', instance)
                    .single();

                if (instanceData) {
                    const userId = instanceData.user_id;

                    // Verifica se o lead já existe
                    const { data: existingLead } = await supabase
                        .from('leads')
                        .select('id, history, name')
                        .eq('user_id', userId)
                        .eq('phone', phone)
                        .maybeSingle();

                    if (existingLead) {
                        // Atualiza Lead existente
                        const newHistory = (existingLead.history || '') + `\n[${new Date().toLocaleTimeString()} Cliente]: ${text}`;
                        await supabase.from('leads').update({
                            last_message: text,
                            last_interaction: 'Agora',
                            history: newHistory,
                            status: 'Conversa',
                            temperature: 'Warm'
                        }).eq('id', existingLead.id);
                    } else {
                        // Cria novo Lead
                        await supabase.from('leads').insert({
                            user_id: userId,
                            name: pushName,
                            phone: phone,
                            last_message: text,
                            status: 'Novo',
                            temperature: 'Cold',
                            source: 'WhatsApp',
                            history: `[Início]: ${text}`
                        });
                    }
                }
            }
        }
    } catch (e) {
        console.error('[Webhook Error]', e);
    }
});

// ==============================================================================
// 3. GOOGLE ADS PROXY
// ==============================================================================

app.post('/api/google-ads', async (req, res) => {
    try {
        const { action, access_token, customer_id, date_range } = req.body;
        
        // TOKEN HARDCODED AQUI
        const developer_token = GOOGLE_ADS_DEV_TOKEN;

        if (!access_token) return res.status(400).json({ error: 'Missing access_token' });

        const API_VERSION = 'v16';
        const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;
        
        const headers = {
            'Authorization': `Bearer ${access_token}`,
            'developer-token': developer_token,
            'Content-Type': 'application/json'
        };

        if (action === 'list_customers') {
             const url = `${BASE_URL}/customers:listAccessibleCustomers`;
             const gRes = await fetch(url, { headers });
             
             if (!gRes.ok) {
                 const errText = await gRes.text();
                 console.error('Google Ads List Error:', errText);
                 return res.status(gRes.status).json({ error: errText });
             }

             const gData = await gRes.json();
             const customers = (gData.resourceNames || []).map(r => ({ 
                 id: r.replace('customers/', ''), 
                 name: r, 
                 descriptiveName: `Conta ${r.replace('customers/', '')}`,
                 currencyCode: 'BRL'
             }));
             return res.json({ customers });
        }
        
        if (action === 'get_campaigns') {
            if (!customer_id) return res.status(400).json({ error: 'Missing customer_id' });
            
            const cleanId = customer_id.replace(/-/g, '');
            const url = `${BASE_URL}/customers/${cleanId}/googleAds:search`;
            
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
            
            if (date_range?.start && date_range?.end) {
                query += ` AND segments.date BETWEEN '${date_range.start}' AND '${date_range.end}'`;
            } else {
                query += ` AND segments.date DURING LAST_30_DAYS`;
            }
            query += ` LIMIT 50`;

            const gRes = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query })
            });
            
            if (!gRes.ok) {
                const errText = await gRes.text();
                 console.error('Google Ads Search Error:', errText);
                return res.status(gRes.status).json({ error: errText });
            }
            
            const gData = await gRes.json();
            return res.json({ results: gData.results || [] });
        }

        return res.status(400).json({ error: 'Invalid Action' });

    } catch (e) {
        console.error("Google Proxy Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Health Check
app.get('/api/health', (req, res) => res.json({ status: 'online', mode: 'manager' }));

// Serve o Frontend
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Configuração Fixa Carregada:`);
  console.log(`- App URL: ${APP_BASE_URL}`);
  console.log(`- WhatsApp API: ${EVO_URL}`);
  console.log(`- Google Ads Token: ${GOOGLE_ADS_DEV_TOKEN.slice(0, 5)}...`);
});
