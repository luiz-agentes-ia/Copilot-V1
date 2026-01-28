
// O front-end fala com o NOSSO backend (/api/whatsapp), e o backend fala com a Evolution.
// Isso protege sua EVO_GLOBAL_KEY.

export interface WhatsappConfig {
  instanceName: string;
  isConnected: boolean;
}

const API_BASE = '/api/whatsapp';

// 1. Iniciar conexão (Solicita QR Code ao backend)
export const initInstance = async (userId: string, clinicName: string) => {
    try {
        const response = await fetch(`${API_BASE}/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, clinicName })
        });
        
        if (!response.ok) throw new Error('Falha ao iniciar WhatsApp');
        return await response.json(); // Retorna { instanceName, base64, state }
    } catch (error) {
        console.error(error);
        throw error;
    }
};

// 2. Verificar Status (Polling)
export const checkStatus = async (instanceName: string) => {
    try {
        const response = await fetch(`${API_BASE}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName })
        });
        const data = await response.json();
        
        // Mapeia o estado da Evolution para o nosso estado interno
        const state = data?.instance?.state || 'disconnected';
        const isConnected = state === 'open';

        return { 
            status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
            state: state
        };
    } catch (error) {
        return { status: 'ERROR' };
    }
};

// 3. Enviar Mensagem (Chat)
export const sendMessage = async (instanceName: string, phone: string, text: string) => {
    try {
        // Limpeza básica do telefone (Brasil)
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
            cleanPhone = '55' + cleanPhone;
        }

        const response = await fetch(`${API_BASE}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName, number: cleanPhone, text })
        });

        if (!response.ok) throw new Error('Falha no envio');
        return await response.json();
    } catch (error) {
        console.error('Erro envio Wpp:', error);
        throw error;
    }
};
