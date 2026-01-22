
import { supabase } from '../lib/supabase';
import { GoogleAdAccount } from '../types';

/**
 * Inicia o fluxo de Login com Google usando Supabase.
 * Solicita escopo do Google Ads automaticamente.
 */
export const signInWithGoogleAds = async () => {
  if (!supabase) return;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // O escopo oficial para ler/gerenciar Google Ads
      scopes: 'https://www.googleapis.com/auth/adwords',
      redirectTo: window.location.origin,
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
 * 
 * NOTA IMPORTANTE: A API do Google Ads NÃO suporta chamadas diretas do navegador (Browser) devido a CORS.
 * Em produção, você precisaria de um backend (Node.js/Python) ou Supabase Edge Function.
 * 
 * Para este MVP funcionar visualmente sem servidor, implementamos um FALLBACK:
 * Se a chamada falhar (o que vai acontecer sem backend), retornamos contas simuladas
 * para que você possa ver a interface de "Conta Conectada" funcionando.
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

    // Se a resposta não for OK (ex: erro de CORS ou 403), lança erro para cair no catch
    if (!response.ok) {
       throw new Error(`Google Ads API Error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    return (data.resourceNames || []).map((resourceName: string) => ({
      id: resourceName.replace('customers/', ''),
      name: resourceName,
      descriptiveName: `Conta Real ${resourceName.replace('customers/', '')}`,
      currencyCode: 'BRL',
      timeZone: 'America/Sao_Paulo'
    }));

  } catch (error) {
    console.warn("API Google Ads bloqueada pelo navegador (CORS) ou Token inválido.");
    console.warn("Usando DADOS SIMULADOS para demonstração da interface.");
    
    // FALLBACK: Retorna dados simulados para a interface não quebrar
    // Isso permite testar o fluxo de UI "Conectado" mesmo sem backend configurado
    return [
      {
        id: '123-456-7890',
        name: 'customers/1234567890',
        descriptiveName: 'Clínica Principal (Demo)',
        currencyCode: 'BRL',
        timeZone: 'America/Sao_Paulo'
      },
      {
        id: '987-654-3210',
        name: 'customers/9876543210',
        descriptiveName: 'Campanhas Estética (Demo)',
        currencyCode: 'BRL',
        timeZone: 'America/Sao_Paulo'
      }
    ];
  }
};
