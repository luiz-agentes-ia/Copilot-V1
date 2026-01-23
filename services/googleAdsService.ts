
import { supabase } from '../lib/supabase';
import { GoogleAdAccount } from '../types';

/**
 * Inicia o fluxo de Login com Google Ads.
 * Define a flag 'auth_intent' para 'google_ads'.
 */
export const signInWithGoogleAds = async () => {
  if (!supabase) return;

  const returnUrl = window.location.origin + window.location.pathname;
  localStorage.setItem('auth_intent', 'google_ads');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Escopo obrigatório para ler dados de campanhas
      scopes: 'https://www.googleapis.com/auth/adwords',
      redirectTo: returnUrl,
      queryParams: {
        access_type: 'offline', // Garante o refresh token para acesso contínuo
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Busca a lista de contas acessíveis via Proxy (Edge Function).
 */
export const getAccessibleCustomers = async (accessToken: string, developerToken: string): Promise<GoogleAdAccount[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('google-ads-proxy', {
      body: {
        action: 'list_customers',
        access_token: accessToken,
        developer_token: developerToken
      }
    });

    if (error) {
       console.error("Edge Function Error (List):", error);
       throw new Error("Falha de conexão com o servidor de anúncios.");
    }
    
    if (data.error) {
       throw new Error(data.error);
    }

    return data.customers || [];
  } catch (err: any) {
    console.error("Service Error:", err.message);
    throw err;
  }
};

/**
 * Busca métricas de campanhas via Proxy (Edge Function).
 */
export const getGoogleCampaigns = async (customerId: string, accessToken: string, developerToken: string, dateRange?: { start: string, end: string }) => {
  try {
    const { data, error } = await supabase.functions.invoke('google-ads-proxy', {
      body: {
        action: 'get_campaigns',
        customer_id: customerId,
        access_token: accessToken,
        developer_token: developerToken,
        date_range: dateRange
      }
    });

    if (error) {
        console.error("Edge Function Error (Campaigns):", error);
        throw new Error("Falha ao sincronizar campanhas.");
    }

    if (data.error) {
        throw new Error(data.error);
    }

    return data.results || [];

  } catch (error: any) {
    console.error("Service Error:", error.message);
    // Retorna array vazio em caso de erro para não quebrar a UI
    return [];
  }
};
