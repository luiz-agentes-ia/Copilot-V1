
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
const APP_BASE_URL = 'https://copilot-v1.onrender.com'; 
const EVO_URL = 'https://task-dev-01-evolution-api.8ypyjm.easypanel.host';
const EVO_GLOBAL_KEY = '429683C4C977415CAAFCCE10F7D57E11';
const GOOGLE_ADS_DEV_TOKEN = 'F_eYB5lJNEavmardpRzBtw';

// --- SUPABASE ADMIN ---
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
  
  const instanceName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '')}`;
  console.log(`[Manager] Iniciando: ${instanceName}`);

  try {
    // 1. Verifica se a instância já existe na Evolution
    console.log(`[Manager] Checando instância na Evolution: ${EVO_URL}`);
    const checkRes = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, {
       headers: { 'apikey': EVO_GLOBAL_KEY }
    });
    
    // Se o fetch falhar (ex: URL errada), vai pro catch

    // 2. Se não existe (404), cria uma nova
    if (checkRes.status === 404) {
       console.log(`[Manager] Instância 404. Criando...`);
       
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
           const errText = await createRes.text();
           console.error(`[Manager] Erro Criação: ${errText}`);
           throw new Error(`Falha ao criar instância: ${createRes.status}`);
       }
    }

    // 3. Conecta
    const connectRes = await fetch(`${EVO_URL}/instance/connect/${instanceName}`, {
        headers: { 'apikey': EVO_GLOBAL_KEY }
    });
    const connectData = await safeJson(connectRes);

    // 4. Salva no DB (Tenta, mas não crasha se falhar)
    const { error: dbError } = await supabase
        .from('whatsapp_instances')
        .upsert({ 
            user_id: userId, 
            instance_name: instanceName,
            status: connectData?.instance?.state === 'open' ? 'connected' : 'qrcode'
        }, { onConflict: 'user_id' });

    if (dbError) {
        console.error("Erro CRÍTICO no DB (Tabela whatsapp_instances existe?):", dbError.message);
    }

    res.json({
        instanceName,
        base64: connectData.base64 || connectData.qrcode?.base64, 
        state: connectData?.instance?.state || 'connecting'
    });

  } catch (error) {
    console.error('Erro Init WhatsApp:', error);
    res.status(500).json({ error: error.message || 'Erro interno no servidor' });
  }
});

// ... (Resto das rotas mantidas iguais) ...
app.post('/api/whatsapp/status', async (req, res) => {
    const { instanceName } = req.body;
    try {
        const response = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, { headers: { 'apikey': EVO_GLOBAL_KEY } });
        const data = await safeJson(response);
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Erro ao checar status' }); }
});

app.post('/api/whatsapp/send', async (req, res) => {
    const { instanceName, number, text } = req.body;
    try {
        const response = await fetch(`${EVO_URL}/message/sendText/${instanceName}`, {
            method: 'POST',
            headers: { 'apikey': EVO_GLOBAL_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number, options: { delay: 1200 }, textMessage: { text } })
        });
        const data = await safeJson(response);
        res.json(data);
    } catch (e) { res.status(500).json({ error: 'Erro ao enviar' }); }
});

app.post('/api/webhooks/whatsapp', async (req, res) => {
    res.status(200).send('OK');
    try {
        const body = req.body;
        // ... (Mesma lógica de webhook anterior)
        if (body.event === 'CONNECTION_UPDATE') {
             await supabase.from('whatsapp_instances').update({ status: body.data.state === 'open' ? 'connected' : 'disconnected' }).eq('instance_name', body.instance);
        }
    } catch (e) { console.error('[Webhook Error]', e); }
});

app.post('/api/google-ads', async (req, res) => {
    try {
        const { action, access_token, customer_id, date_range } = req.body;
        const developer_token = GOOGLE_ADS_DEV_TOKEN;
        if (!access_token) return res.status(400).json({ error: 'Missing access_token' });

        const API_VERSION = 'v16';
        const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;
        const headers = { 'Authorization': `Bearer ${access_token}`, 'developer-token': developer_token, 'Content-Type': 'application/json' };

        if (action === 'list_customers') {
             const gRes = await fetch(`${BASE_URL}/customers:listAccessibleCustomers`, { headers });
             const gData = await safeJson(gRes);
             const customers = (gData.resourceNames || []).map(r => ({ id: r.replace('customers/', ''), name: r, descriptiveName: `Conta ${r.replace('customers/', '')}`, currencyCode: 'BRL' }));
             return res.json({ customers });
        }
        if (action === 'get_campaigns') {
            const cleanId = customer_id.replace(/-/g, '');
            const query = `SELECT campaign.id, campaign.name, campaign.status, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions FROM campaign WHERE campaign.status != 'REMOVED' LIMIT 50`;
            const gRes = await fetch(`${BASE_URL}/customers/${cleanId}/googleAds:search`, { method: 'POST', headers, body: JSON.stringify({ query }) });
            const gData = await safeJson(gRes);
            return res.json({ results: gData.results || [] });
        }
        return res.status(400).json({ error: 'Invalid Action' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (req, res) => res.json({ status: 'online' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Config: ${APP_BASE_URL} | WhatsApp: ${EVO_URL}`);
});
