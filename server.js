
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, delay } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';

// Carrega variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- SUPABASE SETUP ---
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rxvvtdqxinttuoamtapa.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_cZXM43qOuiYp_JOR2D0Y7w_ofs7o-Gi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GOOGLE_ADS_DEV_TOKEN = process.env.VITE_GOOGLE_ADS_DEV_TOKEN || 'F_eYB5lJNEavmardpRzBtw';

app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==============================================================================
// 1. GERENCIADOR DE SESSÕES BAILEYS (Nativo)
// ==============================================================================

const sessions = new Map();

const getSessionPath = (userId) => {
    return path.join(__dirname, 'auth_info_baileys', `session_${userId}`);
};

// Helper para extrair texto da mensagem
const getMessageContent = (msg) => {
    if (!msg.message) return '';
    return msg.message.conversation || 
           msg.message.extendedTextMessage?.text || 
           msg.message.imageMessage?.caption || 
           '';
};

// Função principal que inicia o socket do WhatsApp
const startWhatsAppSession = async (userId) => {
    const sessionPath = getSessionPath(userId);
    
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    
    const sock = makeWASocket.default({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ["Copilot AI", "Chrome", "1.0.0"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        retryRequestDelayMs: 250
    });

    sessions.set(userId, { 
        sock, 
        qrCode: null, 
        status: 'connecting', 
        reconnectAttempts: 0 
    });

    sock.ev.on('creds.update', saveCreds);

    // --- LISTENER DE MENSAGENS (SALVA NO BANCO) ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type === 'notify' || type === 'append') {
            for (const msg of messages) {
                try {
                    if (!msg.key.remoteJid || msg.key.remoteJid === 'status@broadcast') continue;

                    const isFromMe = msg.key.fromMe;
                    const phone = msg.key.remoteJid.replace('@s.whatsapp.net', '');
                    const textBody = getMessageContent(msg);
                    
                    if (!textBody) continue; // Ignora mensagens vazias ou tipos complexos não tratados ainda

                    // 1. Busca ou Cria o Lead
                    let leadId = null;
                    const { data: existingLead } = await supabase
                        .from('leads')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('phone', phone)
                        .maybeSingle();

                    if (existingLead) {
                        leadId = existingLead.id;
                        // Atualiza ultima mensagem do lead
                        await supabase.from('leads').update({
                            last_message: textBody,
                            status: isFromMe ? undefined : 'Conversa' // Se cliente mandou, muda status
                        }).eq('id', leadId);
                    } else {
                        // Novo Lead (apenas se for mensagem recebida, opcional)
                        if (!isFromMe) {
                            const { data: newLead } = await supabase.from('leads').insert({
                                user_id: userId,
                                name: msg.pushName || phone, // Tenta pegar nome do Whats ou usa fone
                                phone: phone,
                                status: 'Novo',
                                temperature: 'Cold',
                                last_message: textBody,
                                source: 'WhatsApp'
                            }).select().single();
                            leadId = newLead?.id;
                        }
                    }

                    // 2. Salva a Mensagem
                    await supabase.from('whatsapp_messages').insert({
                        user_id: userId,
                        lead_id: leadId,
                        contact_phone: phone,
                        sender: isFromMe ? 'me' : 'contact',
                        type: 'text',
                        body: textBody,
                        wa_message_id: msg.key.id,
                        status: 'delivered'
                    });

                    console.log(`[WPP ${userId}] Msg salva: ${isFromMe ? 'Eu' : 'Cliente'} -> ${phone}`);

                } catch (err) {
                    console.error('Erro ao processar mensagem:', err);
                }
            }
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        const session = sessions.get(userId);

        if (qr) {
            console.log(`[WPP ${userId}] QR Code gerado!`);
            try {
                const qrBase64 = await QRCode.toDataURL(qr);
                if (session) {
                    session.qrCode = qrBase64;
                    session.status = 'qrcode';
                }
                await supabase.from('whatsapp_instances')
                    .upsert({ user_id: userId, instance_name: `native_${userId}`, status: 'qrcode' }, { onConflict: 'user_id' });
            } catch (err) {}
        }

        if (connection === 'open') {
            console.log(`[WPP ${userId}] CONEXÃO ESTABELECIDA!`);
            if (session) {
                session.status = 'connected';
                session.qrCode = null;
                session.reconnectAttempts = 0;
            }
            await supabase.from('whatsapp_instances')
                .upsert({ user_id: userId, instance_name: `native_${userId}`, status: 'connected' }, { onConflict: 'user_id' });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`[WPP ${userId}] Conexão fechada. Reconectar? ${shouldReconnect}`);
            
            if (shouldReconnect) {
                if (session) session.status = 'reconnecting';
                await delay(2000); 
                startWhatsAppSession(userId);
            } else {
                console.log(`[WPP ${userId}] Desconectado.`);
                if (session) session.status = 'disconnected';
                sessions.delete(userId);
                try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch(e) {}
                
                await supabase.from('whatsapp_instances')
                    .upsert({ user_id: userId, instance_name: `native_${userId}`, status: 'disconnected' }, { onConflict: 'user_id' });
            }
        }
    });
    
    return sock;
};

// ... (Resto das rotas mantidas: /init, /status, /send, /logout, etc) ...

app.post('/api/whatsapp/init', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const existingSession = sessions.get(userId);
    if (existingSession && existingSession.status === 'connected') {
        return res.json({ state: 'open', instanceName: `native_${userId}` });
    }
    if (existingSession && (existingSession.status === 'connecting' || existingSession.status === 'qrcode')) {
         return res.json({ state: 'connecting', base64: existingSession.qrCode, instanceName: `native_${userId}` });
    }

    try {
        await startWhatsAppSession(userId);
        await delay(1500);
        const newSession = sessions.get(userId);
        res.json({
            state: newSession?.status === 'connected' ? 'open' : 'connecting',
            base64: newSession?.qrCode,
            instanceName: `native_${userId}`
        });
    } catch (e) {
        res.status(500).json({ error: 'Falha ao iniciar driver do WhatsApp' });
    }
});

app.post('/api/whatsapp/status', async (req, res) => {
    const { instanceName } = req.body; 
    const userId = instanceName ? instanceName.replace('native_', '') : null;
    if (!userId) return res.status(400).json({ error: 'Invalid instance name' });
    const session = sessions.get(userId);
    if (!session) return res.json({ instance: { state: 'disconnected' } });
    res.json({
        instance: { state: session.status === 'connected' ? 'open' : 'connecting' },
        base64: session.qrCode
    });
});

app.post('/api/whatsapp/send', async (req, res) => {
    const { instanceName, number, text } = req.body;
    const userId = instanceName.replace('native_', '');
    const session = sessions.get(userId);
    if (!session || session.status !== 'connected') return res.status(400).json({ error: 'WhatsApp desconectado' });
    try {
        const jid = number + '@s.whatsapp.net';
        await session.sock.sendMessage(jid, { text: text });
        // O listener 'upsert' vai capturar essa msg enviada e salvar no banco automaticamente
        res.json({ status: 'sent' });
    } catch (e) {
        res.status(500).json({ error: 'Falha no envio' });
    }
});

app.post('/api/whatsapp/logout', async (req, res) => {
    const { userId } = req.body;
    const session = sessions.get(userId);
    if (session) {
        try { await session.sock.logout(); } catch (e) {}
        sessions.delete(userId);
        const sessionPath = getSessionPath(userId);
        try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (e) {}
    }
    await supabase.from('whatsapp_instances').delete().eq('user_id', userId);
    res.json({ success: true });
});

app.post('/api/google-ads', async (req, res) => {
    try {
        const { action, access_token, customer_id } = req.body;
        const developer_token = GOOGLE_ADS_DEV_TOKEN;
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

const safeJson = async (response) => {
    try { return await response.json(); } catch { return {}; }
};

app.get('/api/health', (req, res) => res.json({ status: 'online', mode: 'native_baileys' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WhatsApp Engine: Native Baileys`);
});
