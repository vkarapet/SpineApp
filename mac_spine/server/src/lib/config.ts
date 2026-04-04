export interface Config {
  redcapApiUrl: string;
  redcapApiToken: string;
  allowedOrigin: string;
}

export function loadConfig(): Config {
  const redcapApiUrl = process.env.REDCAP_API_URL;
  const redcapApiToken = process.env.REDCAP_API_TOKEN;
  const allowedOrigin = process.env.ALLOWED_ORIGIN;

  if (!redcapApiUrl) throw new Error('REDCAP_API_URL is not set');
  if (!redcapApiToken) throw new Error('REDCAP_API_TOKEN is not set');
  if (!allowedOrigin) throw new Error('ALLOWED_ORIGIN is not set');

  return { redcapApiUrl, redcapApiToken, allowedOrigin };
}
