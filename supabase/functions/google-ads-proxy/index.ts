
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/deploy_node_server

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// Declare Deno to avoid TypeScript errors when checking in a non-Deno environment
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, code, redirect_uri, client_id, client_secret, developer_token, customer_id, user_id } = await req.json();

    // Initialize Supabase Client (Service Role for DB writes)
    const supabaseClient = createClient(
      // Retrieve from Edge Function Environment Variables
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let refresh_token = '';
    let access_token = '';

    // 1. TROCA DE CÓDIGO POR TOKEN (Se action == 'exchange_and_sync')
    if (action === 'exchange_and_sync') {
      const tokenUrl = 'https://oauth2.googleapis.com/token';
      const tokenParams = new URLSearchParams({
        code,
        client_id,
        client_secret,
        redirect_uri,
        grant_type: 'authorization_code',
      });

      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) throw new Error(`Google Auth Error: ${tokenData.error_description || tokenData.error}`);

      refresh_token = tokenData.refresh_token;
      access_token = tokenData.access_token;

      // Salvar Tokens no DB (Tabela ad_integrations)
      // Nota: Em produção, encryptar o refresh_token!
      await supabaseClient.from('ad_integrations').upsert({
        user_id,
        provider: 'google',
        ad_account_id: customer_id,
        // Armazenando tokens temporariamente (Refresh é o importante)
        // access_token: access_token, // Opcional, expira rápido
        // refresh_token: refresh_token // CRÍTICO
      }, { onConflict: 'user_id, provider' });
    } 
    // 2. USO DE TOKEN EXISTENTE (Se action == 'sync_only')
    else if (action === 'sync_only') {
       // Buscar refresh token do banco (ou assumir que foi passado, mas melhor buscar do banco para segurança)
       // Simplificação: vamos regenerar o access token usando refresh token se tivessemos salvo
       // Por limitação deste exemplo, vamos assumir que o fluxo 'exchange' acabou de rodar ou implementar logica de refresh
       throw new Error("Para 'sync_only', implementação de busca de refresh token no DB necessária.");
    }

    // 3. BUSCAR CAMPANHAS (Google Ads API)
    // Endpoint para buscar campanhas usando GAQL (Google Ads Query Language)
    // Remove hífens do Customer ID
    const cleanCustomerId = customer_id.replace(/-/g, '');
    const query = `
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
      LIMIT 50
    `;

    const searchUrl = `https://googleads.googleapis.com/v16/customers/${cleanCustomerId}/googleAds:search`;
    
    const adsRes = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'developer-token': developer_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const adsData = await adsRes.json();
    
    if (adsData.error) {
       // Se erro for de token expirado, precisaria usar refresh_token para pegar novo access_token aqui
       throw new Error(`Google Ads API Error: ${adsData.error.message}`);
    }

    // 4. SALVAR DADOS NO SUPABASE
    const results = adsData.results || [];
    const savedCampaigns = [];

    // Pegar ID da integração
    const { data: integration } = await supabaseClient
       .from('ad_integrations')
       .select('id')
       .eq('user_id', user_id)
       .eq('provider', 'google')
       .single();

    if (integration) {
       for (const row of results) {
          const camp = row.campaign;
          const metrics = row.metrics;
          
          // Upsert Campanha
          const { data: savedCamp } = await supabaseClient
             .from('ad_campaigns')
             .upsert({
                integration_id: integration.id,
                user_id,
                external_id: camp.id,
                name: camp.name,
                platform: 'google',
                status: camp.status,
                budget: 0 // Simplificado
             }, { onConflict: 'integration_id, external_id' })
             .select()
             .single();
          
          if (savedCamp) {
             savedCampaigns.push(savedCamp);
             // Insert Métricas (Hoje)
             await supabaseClient.from('ad_metrics').insert({
                campaign_id: savedCamp.id,
                date: new Date().toISOString().split('T')[0],
                impressions: parseInt(metrics.impressions),
                clicks: parseInt(metrics.clicks),
                spend: parseInt(metrics.costMicros) / 1000000, // Micros to Currency
                conversions: parseFloat(metrics.conversions),
                // Calcular CTR/CPC na query ou no front
             });
          }
       }
    }

    return new Response(JSON.stringify({ success: true, count: savedCampaigns.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
