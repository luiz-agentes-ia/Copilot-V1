
import { supabase } from '../lib/supabase';

/**
 * Inicia o fluxo de OAuth para o Google Calendar.
 * Define a flag 'auth_intent' para 'google_calendar'.
 */
export const signInWithGoogleCalendar = async () => {
  if (!supabase) return;

  const returnUrl = window.location.origin + window.location.pathname;

  // Seta a intenção para que o App saiba processar o token no retorno
  localStorage.setItem('auth_intent', 'google_calendar');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'https://www.googleapis.com/auth/calendar.events.readonly',
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

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  status: string;
  htmlLink: string;
}

/**
 * Busca os próximos 20 eventos do calendário principal.
 */
export const getUpcomingEvents = async (accessToken: string): Promise<GoogleCalendarEvent[]> => {
  try {
    const timeMin = new Date().toISOString();
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=20&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Falha ao buscar eventos do Google Calendar');
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Erro Google Calendar:", error);
    return []; 
  }
};
