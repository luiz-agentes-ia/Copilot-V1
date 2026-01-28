
// O front-end fala com o NOSSO backend (/api/whatsapp), e o backend fala com a Evolution.
// Isso protege sua EVO_GLOBAL_KEY.

export interface WhatsappConfig {
  instanceName: string;
  isConnected: boolean;
}

const API_BASE = '/api/whatsapp';

// Helper para ler JSON de forma segura
const safeFetch = async (url: string, options: any) => {
    try {
        const response = await fetch(url, options);
        const text = await response.text();
        
        let data;
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            // Se falhar o parse, retorna o texto como erro
            throw new Error(`Resposta inválida do servidor: ${text.substring(0, 50)}...`);
        }

        if (!response.ok) {
            throw new Error(data.error || data.message || `Erro ${response.status}: Falha na requisição.`);
        }
        
        return data;
    } catch (error: any) {
        console.error("Fetch Error:", error);
        throw error;
    }
};

// 1. Iniciar conexão (Solicita QR Code ao backend)
export const initInstance = async (userId: string, clinicName: string) => {
    return safeFetch(`${API_BASE}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clinicName })
    });
};

// 2. Verificar Status (Polling)
export const checkStatus = async (instanceName: string) => {
    try {
        const data = await safeFetch(`${API_BASE}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName })
        });
        
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
    // Limpeza básica do telefone (Brasil)
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
    }

    return safeFetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, number: cleanPhone, text })
    });
};
