// Client per a l'API ViCare de Viessmann
// Docs: https://viessmann.com

const os = require('os');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const IAM_BASE = 'https://viessmann-climatesolutions.com';
const API_BASE = 'https://viessmann-climatesolutions.com';

// Creem una variable global a la memòria RAM per desar els tokens transitoris
let tokensEnMemoria = { access_token: null, refresh_token: null };

function loadTokens() {
  return tokensEnMemoria;
}

function saveTokens(tokens) {
  tokensEnMemoria = tokens;
}

// --- Pas 1: generar la URL de login que l'usuari ha d'obrir al navegador ---
function buildAuthUrl() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    client_id: process.env.VICARE_CLIENT_ID,
    redirect_uri: process.env.VICARE_REDIRECT_URI,
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'IoT User offline_access',
  });
  return {
    url: `${IAM_BASE}/authorize?${params.toString()}`,
    verifier: verifier
  };
}

// --- Pas 2: bescanviar el "code" del callback per tokens ---
async function exchangeCodeForToken(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.VICARE_CLIENT_ID,
    redirect_uri: process.env.VICARE_REDIRECT_URI,
    code_verifier: verifier,
    code,
  });
  const { data } = await axios.post(`${IAM_BASE}/token`, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  saveTokens({ access_token: data.access_token, refresh_token: data.refresh_token });
  return data;
}

async function refreshAccessToken() {
  const tokens = loadTokens();
  if (!tokens.refresh_token) throw new Error('No hi ha refresh_token. Cal fer login primer a /auth/vicare');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.VICARE_CLIENT_ID,
    refresh_token: tokens.refresh_token,
  });
  const { data } = await axios.post(`${IAM_BASE}/token`, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  saveTokens({ access_token: data.access_token, refresh_token: data.refresh_token || tokens.refresh_token });
  return data.access_token;
}

async function authedRequest(method, url, payload) {
  let tokens = loadTokens();
  if (!tokens.access_token) tokens.access_token = await refreshAccessToken();

  const doCall = (token) =>
    axios({ method, url, data: payload, headers: { Authorization: `Bearer ${token}` } });

  try {
    return (await doCall(tokens.access_token)).data;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      const newToken = await refreshAccessToken();
      return (await doCall(newToken)).data;
    }
    throw err;
  }
}

// --- Helpers de negoci ---

async function getInstallations() {
  return authedRequest('get', `${API_BASE}/equipment/installations?includeGateways=true`);
}

async function getFeatures() {
  const { VICARE_INSTALLATION_ID, VICARE_GATEWAY_SERIAL, VICARE_DEVICE_ID } = process.env;
  const url = `${API_BASE}/features/installations/${VICARE_INSTALLATION_ID}/gateways/${VICARE_GATEWAY_SERIAL}/devices/${VICARE_DEVICE_ID}/features`;
  return authedRequest('get', url);
}

async function setOperatingMode(mode, circuit = process.env.VICARE_CIRCUIT || 0) {
  const { VICARE_INSTALLATION_ID, VICARE_GATEWAY_SERIAL, VICARE_DEVICE_ID } = process.env;
  const feature = `heating.circuits.${circuit}.operating.modes.active`;
  const url = `${API_BASE}/features/installations/${VICARE_INSTALLATION_ID}/gateways/${VICARE_GATEWAY_SERIAL}/devices/${VICARE_DEVICE_ID}/features/${feature}/commands/setMode`;
  return authedRequest('post', url, { mode });
}

async function start() {
  return setOperatingMode(process.env.VICARE_MODE_ON || 'dhwAndHeating');
}

async function stop() {
  return setOperatingMode(process.env.VICARE_MODE_OFF || 'standby');
}

async function setProgramTemperature(
  temperature,
  program = process.env.VICARE_PROGRAM || 'normal',
  circuit = process.env.VICARE_CIRCUIT || 0
) {
  const { VICARE_INSTALLATION_ID, VICARE_GATEWAY_SERIAL, VICARE_DEVICE_ID } = process.env;
  const feature = `heating.circuits.${circuit}.operating.programs.${program}`;
  const url = `${API_BASE}/features/installations/${VICARE_INSTALLATION_ID}/gateways/${VICARE_GATEWAY_SERIAL}/devices/${VICARE_DEVICE_ID}/features/${feature}/commands/setTemperature`;
  return authedRequest('post', url, { targetTemperature: temperature });
}

async function getRoomTemperature(circuit = process.env.VICARE_CIRCUIT || 0) {
  const featureName =
    process.env.VICARE_ROOM_TEMP_FEATURE || `heating.circuits.${circuit}.sensors.temperature.room`;
  const { VICARE_INSTALLATION_ID, VICARE_GATEWAY_SERIAL, VICARE_DEVICE_ID } = process.env;
  const url = `${API_BASE}/features/installations/${VICARE_INSTALLATION_ID}/gateways/${VICARE_GATEWAY_SERIAL}/devices/${VICARE_DEVICE_ID}/features/${featureName}`;
  const data = await authedRequest('get', url);
  return {
    feature: featureName,
    value: data && data.data && data.data.properties && data.data.properties.value
      ? data.data.properties.value.value
      : null,
    raw: data,
  };
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForToken,
  getInstallations,
  getFeatures,
  setOperatingMode,
  setProgramTemperature,
  getRoomTemperature,
  start,
  stop,
};
EOF

