
import { supabase } from '../lib/supabase';
import { GoogleAdAccount } from '../types';

/**
 * Inicia o fluxo de Login com Google Ads.
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
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
};

/**
 * Busca a lista de contas via Backend Interno (/api/google-ads).
 * O developer_token agora é injetado pelo servidor, não precisa passar aqui.
 */
export const getAccessibleCustomers = async (accessToken: string, _developerToken?: string): Promise<GoogleAdAccount[]> => {
  try {
    const response = await fetch('/api/google-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'list_customers',
            access_token: accessToken
        })
    });

    if (!response.ok) {
       const err = await response.json();
       throw new Error(err.error || "Falha ao conectar com o servidor.");
    }
    
    const data = await response.json();
    return data.customers || [];
  } catch (err: any) {
    console.error("Service Error:", err.message);
    throw err;
  }
};

/**
 * Busca campanhas via Backend Interno (/api/google-ads).
 */
export const getGoogleCampaigns = async (customerId: string, accessToken: string, _developerToken?: string, dateRange?: { start: string, end: string }) => {
  try {
    const response = await fetch('/api/google-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'get_campaigns',
            customer_id: customerId,
            access_token: accessToken,
            date_range: dateRange
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Falha ao buscar campanhas.");
    }

    const data = await response.json();
    return data.results || [];

  } catch (error: any) {
    console.error("Service Error:", error.message);
    return [];
  }
};
