const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.PROXY_HOST || '127.0.0.1';
const PORT = Number(process.env.PROXY_PORT || 8787);
const CONFIG_FILE = path.join(__dirname, 'googleSheetsConfig.js');

function parseAppsScriptEndpoint() {
  if (process.env.APPS_SCRIPT_ENDPOINT) {
    return process.env.APPS_SCRIPT_ENDPOINT;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const match = content.match(/endpoint:\s*'([^']+)'/);
    if (!match || !match[1]) {
      return '';
    }
    return String(match[1]).trim();
  } catch (error) {
    return '';
  }
}

const APPS_SCRIPT_ENDPOINT = parseAppsScriptEndpoint();

function writeJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function proxyRequest(payload) {
  if (!APPS_SCRIPT_ENDPOINT) {
    throw new Error('APPS_SCRIPT_ENDPOINT missing. Set env var or endpoint in db/googleSheetsConfig.js');
  }

  const response = await fetch(APPS_SCRIPT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Upstream HTTP ${response.status}`);
  }

  return await response.json();
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    writeJson(res, 204, {});
    return;
  }

  if (requestUrl.pathname === '/health') {
    writeJson(res, 200, {
      success: true,
      proxy: 'ok',
      appsScriptEndpointConfigured: Boolean(APPS_SCRIPT_ENDPOINT)
    });
    return;
  }

  if (requestUrl.pathname !== '/api/sheets') {
    writeJson(res, 404, { success: false, error: 'Not found' });
    return;
  }

  if (req.method !== 'POST') {
    writeJson(res, 405, { success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const result = await proxyRequest(body);
    writeJson(res, 200, result);
  } catch (error) {
    writeJson(res, 500, {
      success: false,
      error: error.message || 'Proxy error'
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Google Sheets Proxy running at http://${HOST}:${PORT}`);
  if (!APPS_SCRIPT_ENDPOINT) {
    console.log('Warning: No Apps Script endpoint configured yet.');
  }
});
