import { supabase } from '../lib/supabase';

/**
 * Inicia o fluxo de OAuth para o Google Sheets.
 * Define a flag 'auth_intent' para 'google_sheets'.
 */
export const signInWithGoogleSheets = async () => {
  if (!supabase) return;

  const returnUrl = window.location.origin + window.location.pathname;

  // Seta a intenção para que o App saiba processar o token no retorno
  localStorage.setItem('auth_intent', 'google_sheets');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Escopo para ler e escrever em planilhas
      scopes: 'https://www.googleapis.com/auth/spreadsheets',
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
 * Cria uma planilha de exemplo (apenas para testar a conexão)
 */
export const createTestSpreadsheet = async (accessToken: string, title: string) => {
  try {
    const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: title
        }
      })
    });
    
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error('Resposta inválida do Google Sheets');
    }
    
    if (!response.ok) throw new Error(data.error?.message || 'Falha ao criar planilha');
    return data;
  } catch (error) {
    console.error("Sheets Error:", error);
    return null;
  }
};
