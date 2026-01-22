import { supabase } from '../lib/supabase';
import { GoogleAdAccount } from '../types';

/**
 * Inicia o fluxo de Login com Google usando Supabase.
 * Solicita escopo do Google Ads automaticamente.
 */
export const signInWithGoogleAds = async () => {
  if (!supabase) return;

  // Garante que o redirecionamento volte para a página/pasta atual, não apenas para o domínio raiz
  const returnUrl = window.location.origin + window.location.pathname;

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

    // Se a resposta não for OK (ex: erro de CORS ou 403), lança erro.
    if (!response.ok) {
       console.warn(`Google Ads API Warning: ${response.statusText}. CORS pode estar bloqueando a requisição direta.`);
       throw new Error(`Google Ads API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    // A API retorna resourceNames no formato "customers/1234567890"
    return (data.resourceNames || []).map((resourceName: string) => ({
      id: resourceName.replace('customers/', ''),
      name: resourceName,
      descriptiveName: `Conta ${resourceName.replace('customers/', '')}`, // A API listAccessibleCustomers não retorna o nome descritivo, apenas o ID
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

  // Query GAQL para buscar métricas essenciais
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