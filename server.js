
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pino from 'pino';

// Carrega variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- SUPABASE SETUP ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rxvvtdqxinttuoamtapa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- EVOLUTION API CONFIG ---
// Usa a chave global fornecida no painel
const EVO_URL = process.env.EVOLUTION_API_URL || 'https://task-dev-01-evolution-api.8ypyjm.easypanel.host';
const EVO_KEY = process.env.EVOLUTION_GLOBAL_KEY || '429683C4C977415CAAFCCE10F7D57E11';

// --- GOOGLE ADS CONFIG ---
const GOOGLE_ADS_DEV_TOKEN = process.env.VITE_GOOGLE_ADS_DEV_TOKEN || 'F_eYB5lJNEavmardpRzBtw';

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper para chamadas na Evolution API
const evoRequest = async (endpoint, method = 'GET', body = null) => {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'apikey': EVO_KEY
            }
        };
        if (body) options.body = JSON.stringify(body);

        // Remove barra duplicada se houver
        const url = `${EVO_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
        
        console.log(`[EVO REQ] ${method} ${url}`);
        
        const response = await fetch(url, options);
        if (!response.ok) {
            const errText = await response.text();
            console.error(`[EVO ERROR] ${endpoint} (${response.status}):`, errText);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error(`[EVO FETCH ERROR] ${endpoint}:`, error);
        return null;
    }
};

// ==============================================================================
// 1. WHATSAPP (PROXY EVOLUTION API)
// ==============================================================================

app.post('/api/whatsapp/init', async (req, res) => {
    const { userId, clinicName, phoneNumber } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const instanceName = `copilot_${userId.replace(/-/g, '')}`;

    console.log(`[WPP INIT] User: ${userId} | Phone: ${phoneNumber || 'QR'} | Instance: ${instanceName}`);

    // 1. Tenta criar a instância
    // Se phoneNumber existir, qrcode = false para preparar para o Pairing Code
    const createResult = await evoRequest('/instance/create', 'POST', {
        instanceName: instanceName,
        token: userId,
        qrcode: !phoneNumber, 
        integration: "WHATSAPP-BAILEYS"
    });

    // Se criou agora ou já existe, buscamos o status de conexão
    const connectionState = await evoRequest(`/instance/connectionState/${instanceName}`);
    
    // Se estiver conectado
    if (connectionState?.instance?.state === 'open') {
        await supabase.from('whatsapp_instances')
            .upsert({ user_id: userId, instance_name: instanceName, status: 'connected' }, { onConflict: 'user_id' });
            
        return res.json({ 
            state: 'open', 
            instanceName, 
            message: 'Instância já conectada.' 
        });
    }

    // Lógica de Pairing Code ou QR Code
    if (phoneNumber) {
        // Para Pairing Code na Evo V2: GET /instance/connect/{name}?number={phone}
        const connectResult = await evoRequest(`/instance/connect/${instanceName}?number=${phoneNumber}`, 'GET');
        
        if (connectResult && (connectResult.code || connectResult.pairingCode)) {
             return res.json({
                state: 'pairing',
                pairingCode: connectResult.code || connectResult.pairingCode,
                instanceName
             });
        }
    } 
    
    // Fallback para QR Code
    const connectResult = await evoRequest(`/instance/connect/${instanceName}`, 'GET');
    
    if (connectResult && (connectResult.base64 || connectResult.code)) {
        await supabase.from('whatsapp_instances')
            .upsert({ user_id: userId, instance_name: instanceName, status: 'qrcode' }, { onConflict: 'user_id' });

        return res.json({
            state: 'connecting',
            base64: connectResult.base64 || connectResult.code, 
            instanceName
        });
    }

    res.json({ state: 'connecting', instanceName, message: 'Aguardando código...' });
});

app.post('/api/whatsapp/status', async (req, res) => {
    const { instanceName } = req.body;
    if (!instanceName) return res.status(400).json({ error: 'Instance Name Required' });

    const stateData = await evoRequest(`/instance/connectionState/${instanceName}`);
    const state = stateData?.instance?.state || 'close';
    
    if (state === 'open') {
        return res.json({ instance: { state: 'open' } });
    }

    // Se ainda não conectou, não precisa retornar o QR/Pairing novamente aqui se estivermos usando Pairing Code
    // O frontend só chama isso para saber "já conectou?"
    res.json({
        instance: { state: state }
    });
});

app.post('/api/whatsapp/send', async (req, res) => {
    const { instanceName, number, text } = req.body;
    
    const body = {
        number: number,
        options: { delay: 1200, presence: "composing", linkPreview: false },
        textMessage: { text: text }
    };

    const result = await evoRequest(`/message/sendText/${instanceName}`, 'POST', body);
    
    if (result) return res.json({ status: 'sent', result });
    res.status(500).json({ error: 'Falha ao enviar mensagem via Evolution' });
});

app.post('/api/whatsapp/logout', async (req, res) => {
    const { userId, instanceName } = req.body;
    await evoRequest(`/instance/logout/${instanceName}`, 'DELETE');
    await supabase.from('whatsapp_instances').delete().eq('user_id', userId);
    res.json({ success: true });
});

// ==============================================================================
// 2. GOOGLE ADS PROXY (MCC & CLIENT)
// ==============================================================================

app.post('/api/google-ads', async (req, res) => {
    try {
        const { action, access_token, customer_id, date_range } = req.body;
        const developer_token = GOOGLE_ADS_DEV_TOKEN;
        
        const API_VERSION = 'v16';
        const BASE_URL = `https://googleads.googleapis.com/${API_VERSION}`;
        
        const headers = { 
            'Authorization': `Bearer ${access_token}`, 
            'developer-token': developer_token, 
            'Content-Type': 'application/json' 
        };

        if (action === 'list_customers') {
             const gRes = await fetch(`${BASE_URL}/customers:listAccessibleCustomers`, { headers });
             const gData = await safeJson(gRes);
             if (gData.error) return res.status(400).json({ error: gData.error.message });

             const customers = (gData.resourceNames || []).map(r => {
                 const id = r.replace('customers/', '');
                 return { id: id, name: r, descriptiveName: `Conta ${id}`, currencyCode: 'BRL' };
             });
             return res.json({ customers });
        }
        
        if (action === 'get_campaigns') {
            if (!customer_id) return res.status(400).json({ error: 'Customer ID required' });
            const cleanId = customer_id.replace(/-/g, '');
            const query = `
                SELECT campaign.id, campaign.name, campaign.status, metrics.clicks, metrics.impressions, metrics.cost_micros, metrics.conversions 
                FROM campaign WHERE campaign.status != 'REMOVED' AND segments.date BETWEEN '${date_range.start}' AND '${date_range.end}' LIMIT 50
            `;
            
            const gRes = await fetch(`${BASE_URL}/customers/${cleanId}/googleAds:search`, { 
                method: 'POST', headers, body: JSON.stringify({ query }) 
            });
            const gData = await safeJson(gRes);
            if (gData.error) return res.status(400).json({ error: gData.error.message });
            return res.json({ results: gData.results || [] });
        }

        return res.status(400).json({ error: 'Invalid Action' });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
});

const safeJson = async (response) => {
    try { return await response.json(); } catch { return {}; }
};

app.get('/api/health', (req, res) => res.json({ status: 'online', mode: 'evolution_proxy' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WhatsApp Engine: Evolution API Proxy (${EVO_URL})`);
});
