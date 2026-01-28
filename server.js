
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
// 1. ROTAS DE GERENCIAMENTO WHATSAPP (EVOLUTION API)
// ==============================================================================

app.post('/api/whatsapp/init', async (req, res) => {
  const { userId, clinicName } = req.body;
  
  // Sanitiza o nome da instância (Evolution não aceita alguns caracteres)
  const instanceName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '')}`;
  console.log(`[Manager] Iniciando Instância: ${instanceName}`);

  try {
    // 1. Verificar Status Atual na Evolution
    let currentState = 'disconnected';
    try {
        const checkRes = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, {
           headers: { 'apikey': EVO_GLOBAL_KEY }
        });
        if (checkRes.ok) {
            const checkData = await safeJson(checkRes);
            currentState = checkData?.instance?.state || 'disconnected';
        }
    } catch (e) {
        console.warn('[Manager] Falha ao checar status inicial, assumindo desconectado.');
    }

    // 2. Se JÁ ESTIVER CONECTADO (open), apenas retorna sucesso e atualiza DB
    if (currentState === 'open') {
        console.log('[Manager] Instância já conectada.');
        await supabase
          .from('whatsapp_instances')
          .upsert({ user_id: userId, instance_name: instanceName, status: 'connected' }, { onConflict: 'user_id' });
        
        return res.json({ instanceName, state: 'open' });
    }

    // 3. ESTRATÉGIA DELETE -> CREATE
    // Se não estiver conectado, deletamos a instância antiga para limpar qualquer estado travado.
    // Isso garante que a criação subsequente gere um QR Code novo.
    console.log(`[Manager] Resetando instância ${instanceName} para gerar novo QR...`);
    
    // Tenta deletar (ignora erro 404 se não existir)
    await fetch(`${EVO_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': EVO_GLOBAL_KEY }
    });

    // Aguarda um breve momento para garantir que a Evolution processou o delete
    await new Promise(r => setTimeout(r, 1000));

    // 4. Cria nova instância solicitando QR Code
    const webhookUrl = `${APP_BASE_URL}/api/webhooks/whatsapp`;
    
    const createRes = await fetch(`${EVO_URL}/instance/create`, {
        method: 'POST',
        headers: { 
            'apikey': EVO_GLOBAL_KEY, 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
            instanceName: instanceName,
            token: userId, // Token de segurança da instância
            qrcode: true,  // Força retorno do QR Code na resposta
            webhook: webhookUrl,
            webhook_by_events: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]
        })
    });
    
    const createData = await safeJson(createRes);
    
    // Tenta extrair o QR code de diferentes formatos possíveis da resposta da Evolution
    let base64 = createData.base64 || createData.qrcode?.base64 || createData.qrcode;

    // Fallback: Se criou com sucesso mas não veio QR, tenta endpoint explícito de connect
    if (!base64 && createData.instance?.state !== 'open') {
         console.log('[Manager] QR Code não veio na criação. Tentando /connect...');
         const connectRes = await fetch(`${EVO_URL}/instance/connect/${instanceName}`, {
            headers: { 'apikey': EVO_GLOBAL_KEY }
        });
        const connectData = await safeJson(connectRes);
        base64 = connectData.base64 || connectData.qrcode?.base64;
    }

    // Atualiza status no banco
    const statusDb = base64 ? 'qrcode' : 'disconnected';
    await supabase
        .from('whatsapp_instances')
        .upsert({ 
            user_id: userId, 
            instance_name: instanceName, 
            status: statusDb
        }, { onConflict: 'user_id' });

    console.log(`[Manager] Retornando para front. QR Code gerado? ${!!base64}`);

    res.json({
        instanceName,
        base64: base64, 
        state: createData?.instance?.state || 'connecting'
    });

  } catch (error) {
    console.error('[Manager] Erro Crítico:', error);
    res.status(500).json({ error: error.message || 'Erro interno no servidor Evolution' });
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
        // console.log('Webhook received:', body.event);
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
