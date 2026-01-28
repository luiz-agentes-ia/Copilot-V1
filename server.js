
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

// --- CONFIGURAÇÕES GLOBAIS ---
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

// Helper para tratar respostas JSON com segurança e LOGAR erros
const safeJson = async (response, context = '') => {
  try { 
      const text = await response.text();
      // console.log(`[Evo Response - ${context}]`, text.substring(0, 200)); 
      return text ? JSON.parse(text) : {}; 
  } catch (e) { 
      console.warn(`Falha JSON [${context}]:`, e.message);
      return {}; 
  }
};

// ==============================================================================
// 1. ROTAS DE GERENCIAMENTO WHATSAPP (EVOLUTION API)
// ==============================================================================

app.post('/api/whatsapp/init', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  // Nome da instância limpo (Evolution não gosta de caracteres especiais)
  const instanceName = `user_${userId.replace(/[^a-zA-Z0-9]/g, '')}`;
  console.log(`[Manager] >>> INICIANDO PROCESSO PARA: ${instanceName}`);

  const headers = { 
    'apikey': EVO_GLOBAL_KEY, 
    'Content-Type': 'application/json' 
  };

  try {
    // 1. CHECAGEM DE ESTADO
    // Se já estiver conectado, não fazemos nada destrutivo.
    try {
        const checkRes = await fetch(`${EVO_URL}/instance/connectionState/${instanceName}`, { headers });
        if (checkRes.ok) {
            const checkData = await safeJson(checkRes, 'CheckStatus');
            if (checkData?.instance?.state === 'open') {
                console.log('[Manager] Instância JÁ CONECTADA. Retornando sucesso.');
                await supabase
                  .from('whatsapp_instances')
                  .upsert({ user_id: userId, instance_name: instanceName, status: 'connected' }, { onConflict: 'user_id' });
                return res.json({ instanceName, state: 'open' });
            }
        }
    } catch (e) { console.log('[Manager] Instância provavelmente offline ou inexistente.'); }

    // 2. CICLO DE LIMPEZA (Logout -> Delete)
    // Se o usuário pediu para iniciar, ele quer o QR Code. Vamos limpar o que existe.
    console.log('[Manager] Limpando ambiente...');
    
    // Logout (previne sockets presos)
    await fetch(`${EVO_URL}/instance/logout/${instanceName}`, { method: 'DELETE', headers }).catch(() => {});
    
    // Delete (remove do banco da Evolution)
    const deleteRes = await fetch(`${EVO_URL}/instance/delete/${instanceName}`, { method: 'DELETE', headers });
    
    if (deleteRes.ok) {
        console.log('[Manager] Instância deletada com sucesso. Aguardando limpeza...');
        // DELAY CRÍTICO: O EasyPanel/Docker precisa de tempo para liberar o arquivo de sessão
        await new Promise(r => setTimeout(r, 3000));
    } else {
        console.log('[Manager] Instância não existia ou erro ao deletar. Prosseguindo.');
    }

    // 3. CRIAÇÃO DA INSTÂNCIA
    console.log('[Manager] Criando nova instância...');
    const webhookUrl = `${APP_BASE_URL}/api/webhooks/whatsapp`;
    
    const createRes = await fetch(`${EVO_URL}/instance/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            instanceName: instanceName,
            token: userId,
            qrcode: true, 
            webhook: webhookUrl,
            webhook_by_events: true,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
            integration: "WHATSAPP-BAILEYS", // Engine V2 Padrão
            reject_call: false,
            msg_call: ""
        })
    });
    
    const createData = await safeJson(createRes, 'Create');
    
    // Se der erro 403/409, significa que ela ainda existe. Vamos tentar conectar nela mesmo assim.
    if (!createRes.ok && (createRes.status === 403 || createRes.status === 409)) {
        console.warn('[Manager] Instância já existia (Delete falhou ou foi lento). Tentando conexão direta...');
    } else if (!createRes.ok) {
        // Erro real
        throw new Error(createData.error || createData.message || 'Falha ao criar instância na Evolution');
    }

    // 4. BUSCA DO QR CODE (CONNECT)
    // Na v2, o create as vezes não retorna o base64 se o socket demorar.
    // Chamamos o connect explicitamente.
    console.log('[Manager] Solicitando QR Code via /connect...');
    await new Promise(r => setTimeout(r, 1000)); // Espera a instância "subir"

    // IMPORTANTE: Na v2, connect é geralmente GET para recuperar o QR
    const connectRes = await fetch(`${EVO_URL}/instance/connect/${instanceName}`, { 
        method: 'GET', 
        headers 
    });
    
    const connectData = await safeJson(connectRes, 'Connect');
    
    // Normalização: O base64 pode vir em lugares diferentes dependendo da versão exata
    const base64 = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode || createData.base64 || createData.qrcode?.base64;

    if (base64) {
        console.log('[Manager] QR Code obtido com sucesso!');
        
        await supabase
            .from('whatsapp_instances')
            .upsert({ user_id: userId, instance_name: instanceName, status: 'qrcode' }, { onConflict: 'user_id' });

        return res.json({
            instanceName,
            base64: base64,
            state: 'connecting'
        });
    } 
    
    console.error('[Manager] Falha ao obter QR Code.', connectData);
    // Retornamos 200 com erro lógico para o frontend tratar sem crashar
    return res.json({ 
        error: true, 
        message: 'A instância foi criada, mas o QR Code demorou para ser gerado. Tente clicar novamente em "Gerar QR Code".' 
    });

  } catch (error) {
    console.error('[Manager] Erro Crítico:', error);
    res.status(500).json({ error: error.message || 'Erro interno no servidor' });
  }
});

// ... (Resto das rotas inalteradas) ...

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
        // Atualiza status no banco quando a Evolution notificar
        if (body.event === 'CONNECTION_UPDATE') {
             const state = body.data?.state || body.data?.status;
             const newStatus = state === 'open' ? 'connected' : 'disconnected';
             await supabase.from('whatsapp_instances').update({ status: newStatus }).eq('instance_name', body.instance);
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
