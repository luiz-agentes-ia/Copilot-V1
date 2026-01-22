
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
      scopes: 'https://www.googleapis.com/auth/adwords',
      redirectTo: returnUrl,
      queryParams: {
        access_type: 'offline', // Importante para receber refresh_token
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Busca a lista de contas acessíveis.
 * Tenta via Edge Function para evitar CORS, ou fallback local se necessário.
 */
export const getAccessibleCustomers = async (accessToken: string, developerToken: string): Promise<GoogleAdAccount[]> => {
  // Chamada via Edge Function (Segura e sem CORS)
  try {
    const { data, error } = await supabase.functions.invoke('google-ads-proxy', {
      body: {
        action: 'list_customers',
        access_token: accessToken,
        developer_token: developerToken
      }
    });

    if (error) throw error;
    
    // Se a função retornar os dados formatados
    if (data && data.customers) {
       return data.customers;
    }
  } catch (err) {
    console.warn("Edge Function falhou ou não existe, tentando método legacy (pode falhar por CORS)...");
  }

  // Fallback (Método Legacy - sujeito a CORS)
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

    if (!response.ok) throw new Error(`Google Ads API Error: ${response.statusText}`);
    const data = await response.json();
    
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
 * Busca campanhas. 
 * SOLUÇÃO CORS: Invoca a Edge Function que atua como Proxy seguro.
 */
export const getGoogleCampaigns = async (customerId: string, accessToken: string, developerToken: string, dateRange?: { start: string, end: string }) => {
  try {
    // 1. Tenta invocar a Edge Function 'google-ads-proxy'
    const { data, error } = await supabase.functions.invoke('google-ads-proxy', {
      body: {
        action: 'get_campaigns', // Ação específica para buscar campanhas
        customer_id: customerId,
        access_token: accessToken,
        developer_token: developerToken,
        date_range: dateRange
      }
    });

    if (error) throw error;

    // A função deve retornar { results: [...] }
    return data.results || [];

  } catch (error) {
    console.error("Erro ao buscar campanhas via Proxy:", error);
    
    // Se falhar (ex: função não deployada), retorna array vazio para não quebrar o app
    // Não tentamos fetch direto aqui pois sabemos que dará erro de CORS na query GAQL
    return [];
  }
};
