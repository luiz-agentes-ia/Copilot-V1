
import { supabase } from '../lib/supabase';
import { GoogleAdAccount } from '../types';

/**
 * Inicia o fluxo de Login com Google Ads.
 * Define a flag 'auth_intent' para 'google_ads' para que o App.tsx saiba
 * onde salvar o token retornado.
 */
export const signInWithGoogleAds = async () => {
  if (!supabase) return;

  // Garante que o redirecionamento volte para a página/pasta atual
  const returnUrl = window.location.origin + window.location.pathname;

  // Seta a intenção para que o App saiba processar o token no retorno
  localStorage.setItem('auth_intent', 'google_ads');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // O escopo oficial para ler/gerenciar Google Ads
      scopes: 'https://www.googleapis.com/auth/adwords',
      redirectTo: returnUrl,
      // access_type offline é crucial para receber o refresh_token (acesso contínuo)
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Busca a lista de contas de anúncio acessíveis pelo usuário logado.
 */
export const getAccessibleCustomers = async (accessToken: string, developerToken: string): Promise<GoogleAdAccount[]> => {
  const url = 'https://googleads.googleapis.com/v16/customers:listAccessibleCustomers';
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
       console.warn(`Google Ads API Warning: ${response.statusText}. CORS pode estar bloqueando a requisição direta.`);
       throw new Error(`Google Ads API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return (data.resourceNames || []).map((resourceName: string) => ({
      id: resourceName.replace('customers/', ''),
      name: resourceName,
      descriptiveName: `Conta ${resourceName.replace('customers/', '')}`, 
      currencyCode: 'BRL',
      timeZone: 'America/Sao_Paulo'
    }));

  } catch (error) {
    console.error("Erro ao buscar contas Google Ads:", error);
    return [];
  }
};

/**
 * Busca campanhas e métricas de uma conta específica do Google Ads usando GAQL.
 */
export const getGoogleCampaigns = async (customerId: string, accessToken: string, developerToken: string, dateRange?: { start: string, end: string }) => {
  const cleanCustomerId = customerId.replace(/-/g, '');
  const url = `https://googleads.googleapis.com/v16/customers/${cleanCustomerId}/googleAds:search`;

  let query = `
    SELECT 
      campaign.id, 
      campaign.name, 
      campaign.status, 
      campaign.advertising_channel_type,
      metrics.clicks, 
      metrics.impressions, 
      metrics.cost_micros, 
      metrics.conversions 
    FROM campaign 
    WHERE campaign.status != 'REMOVED'
  `;

  if (dateRange) {
      query += ` AND segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
       return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Erro Google Ads Campaigns:", error);
    return [];
  }
};
