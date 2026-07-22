const SHEET_HEADERS = [
  'id',
  'date',
  'paidBy',
  'paidTo',
  'amount',
  'reason',
  'points',
  'status',
  'updatedAt'
];

const GENERAL_HEADERS = [
  'timestamp',
  'event',
  'department',
  'meta'
];

const DEPARTMENTS = [
  'Infanterie',
  'Human Resource',
  'Military Police',
  'Special Force',
  'Air Force'
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const action = String(body.action || '').trim();

    ensureSheets();

    if (action === 'loadAll') {
      return jsonResponse({ success: true, data: readAllData() });
    }

    if (action === 'replaceDepartment') {
      const department = String(body.department || '').trim();
      const payouts = Array.isArray(body.payouts) ? body.payouts : [];
      replaceDepartment(department, payouts);
      return jsonResponse({ success: true });
    }

    if (action === 'appendGeneralLog') {
      const entry = body.entry || {};
      appendGeneralLog(entry);
      return jsonResponse({ success: true });
    }

    if (action === 'resetAll') {
      resetAllDepartments();
      appendGeneralLog({
        timestamp: new Date().toISOString(),
        event: 'System Reset',
        department: 'General',
        meta: '{}'
      });
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || 'Server error' });
  }
}

function doGet() {
  try {
    ensureSheets();
    return jsonResponse({ success: true, data: readAllData() });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || 'Server error' });
  }
}

function ensureSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  DEPARTMENTS.forEach((department) => {
    let sheet = spreadsheet.getSheetByName(department);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(department);
    }
    ensureHeader(sheet, SHEET_HEADERS);
  });

  let generalSheet = spreadsheet.getSheetByName('General');
  if (!generalSheet) {
    generalSheet = spreadsheet.insertSheet('General');
  }
  ensureHeader(generalSheet, GENERAL_HEADERS);
}

function ensureHeader(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const current = range.getValues()[0];
  const isValid = headers.every((header, index) => current[index] === header);

  if (!isValid) {
    range.setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function readAllData() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const departments = {};

  DEPARTMENTS.forEach((department) => {
    const sheet = spreadsheet.getSheetByName(department);
    departments[department] = readDepartmentRows(sheet);
  });

  return {
    departments,
    general: readGeneralRows(spreadsheet.getSheetByName('General'))
  };
}

function readDepartmentRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).getValues();
  return values.map((row) => ({
    id: String(row[0] || ''),
    date: String(row[1] || ''),
    paidBy: String(row[2] || ''),
    paidTo: String(row[3] || ''),
    amount: Number(row[4] || 0),
    reason: String(row[5] || ''),
    points: Number(row[6] || 0),
    status: String(row[7] || 'Offen'),
    updatedAt: String(row[8] || '')
  }));
}

function readGeneralRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const values = sheet.getRange(2, 1, lastRow - 1, GENERAL_HEADERS.length).getValues();
  return values.map((row) => ({
    timestamp: String(row[0] || ''),
    event: String(row[1] || ''),
    department: String(row[2] || ''),
    meta: String(row[3] || '')
  }));
}

function replaceDepartment(department, payouts) {
  if (!DEPARTMENTS.includes(department)) {
    throw new Error(`Unknown department: ${department}`);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(department);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).clearContent();
  }

  if (payouts.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const rows = payouts.map((item) => [
    String(item.id || ''),
    String(item.date || ''),
    String(item.paidBy || ''),
    String(item.paidTo || ''),
    Number(item.amount || 0),
    String(item.reason || ''),
    Number(item.points || 0),
    String(item.status || 'Offen'),
    String(item.updatedAt || now)
  ]);

  sheet.getRange(2, 1, rows.length, SHEET_HEADERS.length).setValues(rows);
}

function appendGeneralLog(entry) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName('General');

  sheet.appendRow([
    String(entry.timestamp || new Date().toISOString()),
    String(entry.event || ''),
    String(entry.department || ''),
    String(entry.meta || '{}')
  ]);
}

function resetAllDepartments() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  DEPARTMENTS.forEach((department) => {
    const sheet = spreadsheet.getSheetByName(department);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, SHEET_HEADERS.length).clearContent();
    }
  });
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
