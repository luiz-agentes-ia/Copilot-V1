
import { supabase } from '../lib/supabase';

/**
 * Inicia o fluxo de OAuth para o Google Sheets.
 * Define a flag 'auth_intent' para 'google_sheets'.
 */
export const signInWithGoogleSheets = async () => {
  if (!supabase) return;

  const returnUrl = window.location.origin + window.location.pathname;

  localStorage.setItem('auth_intent', 'google_sheets');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Adicionado drive.readonly para poder LISTAR os arquivos
      scopes: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
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
 * Lista as planilhas do Google Drive do usuário
 */
export const listSpreadsheets = async (accessToken: string) => {
  try {
    // Filtra apenas arquivos do tipo Google Sheets e que não estão na lixeira
    const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=20&fields=files(id,name)`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) throw new Error('Falha ao listar arquivos do Drive');
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error("Erro ao listar planilhas:", error);
    throw error;
  }
};

/**
 * Obtém os detalhes da planilha (para pegar os nomes das abas/páginas)
 */
export const getSpreadsheetDetails = async (accessToken: string, spreadsheetId: string) => {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) throw new Error('Falha ao obter detalhes da planilha');
    const data = await response.json();
    
    // Retorna array de nomes das abas
    return data.sheets.map((s: any) => s.properties.title);
  } catch (error) {
    console.error("Erro ao obter detalhes da planilha:", error);
    throw error;
  }
};

/**
 * Lê os dados de uma aba específica
 */
export const getSheetData = async (accessToken: string, spreadsheetId: string, range: string) => {
  try {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) throw new Error('Falha ao ler dados da planilha');
    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error("Erro ao ler dados:", error);
    throw error;
  }
};
