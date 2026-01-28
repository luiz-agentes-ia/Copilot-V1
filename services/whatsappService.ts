
export interface WhatsappConfig {
  instanceName: string;
  isConnected: boolean;
}

const API_BASE = '/api/whatsapp';

// Helper para ler JSON de forma segura
const safeFetch = async (url: string, options: any) => {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `Erro ${response.status}`);
        }
        return data;
    } catch (error: any) {
        console.error("Fetch Error:", error);
        throw error;
    }
};

// 1. Iniciar conexão (backend inicia Baileys e retorna base64 se tiver)
export const initInstance = async (userId: string, clinicName: string) => {
    return safeFetch(`${API_BASE}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, clinicName })
    });
};

// 2. Verificar Status (Agora o backend retorna o base64 atualizado se estiver pendente)
export const checkStatus = async (instanceName: string) => {
    try {
        const data = await safeFetch(`${API_BASE}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName })
        });
        
        const state = data?.instance?.state || 'disconnected';
        const isConnected = state === 'open';

        return { 
            status: isConnected ? 'CONNECTED' : 'DISCONNECTED',
            state: state,
            base64: data.base64 // Retorna QR se houver
        };
    } catch (error) {
        return { status: 'ERROR' };
    }
};

// 3. Enviar Mensagem (Direto via Socket no backend)
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

// 4. Logout
export const logoutInstance = async (userId: string) => {
    return safeFetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });
};
