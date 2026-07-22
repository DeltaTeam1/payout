window.GOOGLE_SHEETS_DB = {
  enabled: true,
  useProxy: true,
  proxyEndpoint: 'http://127.0.0.1:8787/api/sheets',
  endpoint: 'https://script.google.com/macros/s/AKfycbzEovQKYdD0eUB-hKcxkjTpX9aSwxh_NaPEbvGqXlxIdGYqVg-i-tmgVfdjINW589A2/exec',
  timeoutMs: 12000,
  sheets: {
    general: 'General',
    departments: {
      'Infanterie': 'Infanterie',
      'Human Resource': 'Human Resource',
      'Military Police': 'Military Police',
      'Special Force': 'Special Force',
      'Air Force': 'Air Force'
    }
  }
};
