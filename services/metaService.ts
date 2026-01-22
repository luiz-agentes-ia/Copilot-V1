
const META_API_VERSION = 'v19.0';
const GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

export const getMetaAdAccounts = async (token: string) => {
  const response = await fetch(`${GRAPH_URL}/me/adaccounts?fields=name,id&access_token=${token}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
};

export const getMetaCampaigns = async (accountId: string, token: string) => {
  const response = await fetch(`${GRAPH_URL}/${accountId}/campaigns?fields=name,id,status,objective&access_token=${token}`);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.data;
};

export const getCampaignInsights = async (campaignId: string, token: string, range?: { start: string, end: string }) => {
  let url = `${GRAPH_URL}/${campaignId}/insights?fields=spend,clicks,impressions,actions&access_token=${token}`;
  
  if (range) {
    const timeRange = JSON.stringify({ 'since': range.start, 'until': range.end });
    url += `&time_range=${encodeURIComponent(timeRange)}`;
  } else {
    url += `&date_preset=last_30d`;
  }

  const response = await fetch(url);
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const insights = data.data[0] || {};
  const conversions = (insights.actions || []).find((a: any) => 
    a.action_type === 'offsite_conversion.fb_pixel_lead' || 
    a.action_type === 'lead' ||
    a.action_type === 'onsite_conversion.messaging_conversation_started_7d' // Para campanhas de Wpp
  )?.value || 0;
  
  return {
    spend: parseFloat(insights.spend || '0'),
    clicks: parseInt(insights.clicks || '0'),
    impressions: parseInt(insights.impressions || '0'),
    conversions: parseInt(conversions)
  };
};
