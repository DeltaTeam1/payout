const unitCards = document.querySelectorAll('.unit-card');
const historyList = document.getElementById('historyList');

const resetAllBtn = document.getElementById('resetAll');
const logoutAllBtn = document.getElementById('logoutAll');
const generalArea = document.getElementById('generalArea');
const generalPasswordInput = document.getElementById('generalPassword');
const unlockGeneralBtn = document.getElementById('unlockGeneral');
const securityFeedback = document.getElementById('securityFeedback');
const analyticsGrid = document.getElementById('analyticsGrid');
const departmentBoard = document.getElementById('departmentBoard');
const generalDeptModal = document.getElementById('generalDeptModal');
const generalDeptTitle = document.getElementById('generalDeptTitle');
const closeGeneralDeptModalBtn = document.getElementById('closeGeneralDeptModal');
const generalDeptPayoutList = document.getElementById('generalDeptPayoutList');

const payoutModal = document.getElementById('payoutModal');
const payoutModalTitle = document.getElementById('payoutModalTitle');
const closePayoutModalBtn = document.getElementById('closePayoutModal');
const savePayoutModalBtn = document.getElementById('savePayoutModal');
const logoutFromModalBtn = document.getElementById('logoutFromModal');
const modalPayoutDateInput = document.getElementById('modalPayoutDate');
const modalPaidByInput = document.getElementById('modalPaidBy');
const modalPaidToInput = document.getElementById('modalPaidTo');
const modalPayoutAmountInput = document.getElementById('modalPayoutAmount');
const modalPayoutReasonInput = document.getElementById('modalPayoutReason');
const modalConfirmPasswordInput = document.getElementById('modalConfirmPassword');
const modalPayoutFeedback = document.getElementById('modalPayoutFeedback');

const GENERAL_AUTH = {
  salt: 'f1c9ab7d4e253a1186d2f0cb3a9ed674',
  hash: '3f563f352fbade0fd888824c5fb79d5a4636602c831f16b70808e34366e597c5'
};

const DEPARTMENT_AUTH = {
  'Infanterie': {
    salt: '92eb8272953d0ee59d1e2e1ab37048c8',
    hash: 'd3440395f289ef84cceba5ce33e4f1d7fbf8fe4ed516cb6081583890cf89da32'
  },
  'Human Resource': {
    salt: 'd12a30c6646121ce8531c40a68429dc2',
    hash: 'a7f8762fcbfce369607c6e4c64ff7280e2ad0e8702e799c7d980635a47cdae53'
  },
  'Military Police': {
    salt: '66c5ccfba5d2e004c8c91f60aab2297e',
    hash: 'f5af0a05786d9fc117a4a32c78bbda3c865b42f084a9483e4ee0d48f92293d90'
  },
  'Special Force': {
    salt: '1804e2042be6ec8c63594fb462bd871d',
    hash: '857688bfeac63bd4001944a1ec104995b7f3bcf3e29ee551c82aafc552175813'
  },
  'Air Force': {
    salt: '8f49ffe0237d302acad6b9bd52cfa845',
    hash: '72931e926e1ef2cf57e8dbdc1e9ccbf07e5c1be7f9848f0296b4272863784280'
  }
};

const DEPARTMENTS = Object.keys(DEPARTMENT_AUTH);

const DB_CONFIG = {
  enabled: Boolean(window.GOOGLE_SHEETS_DB && window.GOOGLE_SHEETS_DB.enabled),
  useProxy: Boolean(window.GOOGLE_SHEETS_DB && window.GOOGLE_SHEETS_DB.useProxy),
  proxyEndpoint: window.GOOGLE_SHEETS_DB && window.GOOGLE_SHEETS_DB.proxyEndpoint
    ? String(window.GOOGLE_SHEETS_DB.proxyEndpoint).trim()
    : '',
  endpoint: window.GOOGLE_SHEETS_DB && window.GOOGLE_SHEETS_DB.endpoint
    ? String(window.GOOGLE_SHEETS_DB.endpoint).trim()
    : '',
  timeoutMs: window.GOOGLE_SHEETS_DB && Number.isFinite(window.GOOGLE_SHEETS_DB.timeoutMs)
    ? Number(window.GOOGLE_SHEETS_DB.timeoutMs)
    : 12000,
  sheets: {
    general: window.GOOGLE_SHEETS_DB
      && window.GOOGLE_SHEETS_DB.sheets
      && window.GOOGLE_SHEETS_DB.sheets.general
      ? String(window.GOOGLE_SHEETS_DB.sheets.general)
      : 'General',
    departments: window.GOOGLE_SHEETS_DB
      && window.GOOGLE_SHEETS_DB.sheets
      && window.GOOGLE_SHEETS_DB.sheets.departments
      ? window.GOOGLE_SHEETS_DB.sheets.departments
      : {}
  }
};

const state = {
  authenticatedUnits: {},
  payoutsByDept: {},
  generalUnlocked: false,
  activeDepartment: null,
  activeGeneralDepartment: null
};

function addHistory(message) {
  const item = document.createElement('li');
  const timestamp = new Date().toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  item.textContent = `[${timestamp}] ${message}`;

  historyList.prepend(item);
  while (historyList.children.length > 12) {
    historyList.removeChild(historyList.lastChild);
  }
}

function isDatabaseEnabled() {
  return DB_CONFIG.enabled && getDatabaseEndpoint().length > 0;
}

function isLocalRuntime() {
  const host = String(window.location.hostname || '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function getDatabaseEndpoint() {
  if (DB_CONFIG.useProxy && DB_CONFIG.proxyEndpoint.length > 0 && isLocalRuntime()) {
    return DB_CONFIG.proxyEndpoint;
  }

  return DB_CONFIG.endpoint;
}

function toStorablePayout(payout) {
  return {
    id: payout.id,
    date: payout.date,
    paidBy: payout.paidBy,
    paidTo: payout.paidTo,
    amount: Number(payout.amount) || 0,
    reason: payout.reason,
    points: Number(payout.points) || 0,
    status: payout.status,
    updatedAt: payout.updatedAt || new Date().toISOString()
  };
}

function toClientPayout(record) {
  return {
    id: String(record.id || `${Date.now()}-${Math.floor(Math.random() * 100000)}`),
    date: String(record.date || ''),
    paidBy: String(record.paidBy || ''),
    paidTo: String(record.paidTo || ''),
    amount: Number(record.amount) || 0,
    reason: String(record.reason || ''),
    points: Number(record.points) || Math.round(Number(record.amount) || 0),
    status: String(record.status || 'Offen'),
    updatedAt: String(record.updatedAt || '')
  };
}

async function dbRequest(action, payload) {
  if (!isDatabaseEnabled()) {
    return null;
  }

  const endpoint = getDatabaseEndpoint();
  const isProxyEndpoint = endpoint === DB_CONFIG.proxyEndpoint;
  const isAppsScriptEndpoint = endpoint.includes('script.google.com');
  const useNoCorsWrite = !isProxyEndpoint && isAppsScriptEndpoint && action !== 'loadAll';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DB_CONFIG.timeoutMs);

  try {
    if (useNoCorsWrite) {
      await fetch(endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8'
        },
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal
      });

      return {
        success: true,
        noCors: true
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function syncDepartmentPayouts(department) {
  if (!isDatabaseEnabled()) {
    return;
  }

  const payouts = (state.payoutsByDept[department] || []).map(toStorablePayout);
  await dbRequest('appendDepartment', {
    department,
    payout
  });
}

async function appendGeneralLog(event, department, meta = {}) {
  if (!isDatabaseEnabled()) {
    return;
  }

  await dbRequest('appendGeneralLog', {
    entry: {
      timestamp: new Date().toISOString(),
      event,
      department,
      meta: JSON.stringify(meta)
    }
  });
}

async function resetDatabaseState() {
  if (!isDatabaseEnabled()) {
    return;
  }

  await dbRequest('resetAll', {});
}

async function loadPayoutsFromDatabase() {
  if (!isDatabaseEnabled()) {
    addHistory('Hinweis: Google-Sheets-DB ist nicht aktiv. Lokaler Modus laeuft.');
    return;
  }

  try {
    const response = await dbRequest('loadAll', {});
    if (!response || !response.success || !response.data || !response.data.departments) {
      addHistory('Datenbankantwort ungueltig. Lokaler Zustand wird verwendet.');
      return;
    }

    DEPARTMENTS.forEach((department) => {
      const records = response.data.departments[department] || [];
      state.payoutsByDept[department] = records.map(toClientPayout);
    });

    addHistory('Google-Sheets-Datenbank verbunden. Daten wurden geladen.');
  } catch (error) {
    addHistory(`Datenbank nicht erreichbar: ${error.message}. Lokaler Zustand aktiv.`);
  }
}

function formatCurrencyUSD(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const parts = value.split('-');
  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function getStatusClass(status) {
  if (status === 'Bestaetigt') {
    return 'is-confirmed';
  }

  if (status === 'Abgelehnt') {
    return 'is-rejected';
  }

  if (status === 'In Bearbeitung') {
    return 'is-editing';
  }

  return 'is-open';
}

function getDepartmentTotals(payouts) {
  const totalAmount = payouts.reduce((sum, payout) => sum + payout.amount, 0);
  const totalPaid = payouts
    .filter((payout) => payout.status === 'Bestaetigt')
    .reduce((sum, payout) => sum + payout.amount, 0);
  const totalOpen = payouts
    .filter((payout) => payout.status === 'Offen' || payout.status === 'In Bearbeitung')
    .reduce((sum, payout) => sum + payout.amount, 0);
  const totalRejected = payouts
    .filter((payout) => payout.status === 'Abgelehnt')
    .reduce((sum, payout) => sum + payout.amount, 0);

  return {
    totalAmount,
    totalPaid,
    totalOpen,
    totalRejected
  };
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setLabeledValue(parent, label, value) {
  const row = document.createElement('p');
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const valueEl = document.createElement('strong');
  valueEl.textContent = value;
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  parent.appendChild(row);
}

function appendLinkifiedText(container, text) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const matches = text.matchAll(urlRegex);
  let lastIndex = 0;
  let hasLink = false;

  for (const match of matches) {
    const matchedText = match[0];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }

    const href = matchedText.startsWith('http') ? matchedText : `https://${matchedText}`;
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'reason-link';
    link.textContent = matchedText;
    container.appendChild(link);

    lastIndex = start + matchedText.length;
    hasLink = true;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  if (!hasLink && !text) {
    container.textContent = '-';
  }
}

function getDepartmentSeries() {
  return DEPARTMENTS.map((department) => {
    const payouts = state.payoutsByDept[department] || [];
    const totals = getDepartmentTotals(payouts);
    return {
      label: department,
      total: totals.totalAmount,
      paid: totals.totalPaid,
      open: totals.totalOpen,
      rejected: totals.totalRejected
    };
  });
}

function getSeriesByKey(key) {
  return getDepartmentSeries().map((entry) => ({
    label: entry.label,
    value: entry[key]
  }));
}

function getPalette(index) {
  const palette = ['#66f3ff', '#4fc3ff', '#ffd06a', '#ff8a95', '#8eea9f'];
  return palette[index % palette.length];
}

function renderDonutChart(container, title, series) {
  const total = series.reduce((sum, item) => sum + item.value, 0);

  const card = document.createElement('article');
  card.className = 'chart-card';

  const heading = document.createElement('h4');
  heading.textContent = title;
  card.appendChild(heading);

  if (total <= 0) {
    const empty = document.createElement('p');
    empty.className = 'chart-empty';
    empty.textContent = 'Keine Daten vorhanden';
    card.appendChild(empty);
    container.appendChild(card);
    return;
  }

  let cumulative = 0;
  const gradientParts = [];

  series.forEach((item, index) => {
    const percent = (item.value / total) * 100;
    const start = cumulative;
    cumulative += percent;
    const color = getPalette(index);
    gradientParts.push(`${color} ${start}% ${cumulative}%`);
  });

  const donut = document.createElement('div');
  donut.className = 'chart-donut';
  donut.style.background = `conic-gradient(${gradientParts.join(', ')})`;

  const center = document.createElement('div');
  center.className = 'chart-center';
  center.innerHTML = `<strong>100%</strong><span>Verteilung</span>`;
  donut.appendChild(center);
  card.appendChild(donut);

  const legend = document.createElement('div');
  legend.className = 'chart-legend';

  series.forEach((item, index) => {
    const percent = total > 0 ? ((item.value / total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'chart-legend-row';

    const left = document.createElement('div');
    left.className = 'chart-legend-left';
    const swatch = document.createElement('span');
    swatch.className = 'chart-swatch';
    swatch.style.backgroundColor = getPalette(index);
    const label = document.createElement('span');
    label.textContent = item.label;
    left.appendChild(swatch);
    left.appendChild(label);

    const right = document.createElement('strong');
    right.textContent = `${percent.toFixed(1)}%`;

    row.appendChild(left);
    row.appendChild(right);
    legend.appendChild(row);
  });

  card.appendChild(legend);
  container.appendChild(card);
}

function renderAnalytics() {
  analyticsGrid.innerHTML = '';

  renderDonutChart(analyticsGrid, 'Abteilungen - Gesamtbetrag (%)', getSeriesByKey('total'));
  renderDonutChart(analyticsGrid, 'Abteilungen - Gezahlt (%)', getSeriesByKey('paid'));
  renderDonutChart(analyticsGrid, 'Abteilungen - Offen (%)', getSeriesByKey('open'));
  renderDonutChart(analyticsGrid, 'Abteilungen - Abgelehnt (%)', getSeriesByKey('rejected'));
}

function openGeneralDepartmentModal(department) {
  state.activeGeneralDepartment = department;
  generalDeptTitle.textContent = `${department} - Auszahlungen`;
  renderGeneralDepartmentDetails();
  generalDeptModal.classList.add('is-open');
  generalDeptModal.setAttribute('aria-hidden', 'false');
}

function closeGeneralDepartmentModal() {
  generalDeptModal.classList.remove('is-open');
  generalDeptModal.setAttribute('aria-hidden', 'true');
  state.activeGeneralDepartment = null;
}

function renderGeneralDepartmentDetails() {
  const department = state.activeGeneralDepartment;
  if (!department) {
    generalDeptPayoutList.innerHTML = '';
    return;
  }

  const payouts = state.payoutsByDept[department] || [];
  generalDeptPayoutList.innerHTML = '';

  if (payouts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-payouts';
    empty.textContent = 'Noch keine Auszahlungen erfasst.';
    generalDeptPayoutList.appendChild(empty);
    return;
  }

  payouts.forEach((payout) => {
    const block = document.createElement('article');
    block.className = `payout-block ${getStatusClass(payout.status)}`;

    const header = document.createElement('div');
    header.className = 'payout-block-head';

    const headerLeft = document.createElement('div');

    const status = document.createElement('span');
    status.className = `status-badge ${getStatusClass(payout.status)}`;
    status.textContent = payout.status;
    headerLeft.appendChild(status);

    const date = document.createElement('p');
    date.className = 'payout-date';
    date.textContent = `Datum: ${formatDate(payout.date)}`;
    headerLeft.appendChild(date);

    header.appendChild(headerLeft);

    const amount = document.createElement('p');
    amount.className = 'payout-amount-highlight';
    amount.textContent = formatCurrencyUSD(payout.amount);
    header.appendChild(amount);
    block.appendChild(header);

    const details = document.createElement('div');
    details.className = 'payout-details';

    setLabeledValue(details, 'Ausgezahlt von', payout.paidBy);
    setLabeledValue(details, 'Ausgezahlt an', payout.paidTo);

    const reason = document.createElement('p');
    const reasonLabel = document.createElement('span');
    reasonLabel.textContent = 'Zweck';
    const reasonValue = document.createElement('strong');
    appendLinkifiedText(reasonValue, payout.reason);
    reason.appendChild(reasonLabel);
    reason.appendChild(reasonValue);
    details.appendChild(reason);

    block.appendChild(details);

    const actions = document.createElement('div');
    actions.className = 'payout-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'action-btn mini';
    confirmBtn.dataset.action = 'confirm';
    confirmBtn.dataset.id = payout.id;
    confirmBtn.textContent = 'Bestaetigen';
    actions.appendChild(confirmBtn);

    const rejectBtn = document.createElement('button');
    rejectBtn.type = 'button';
    rejectBtn.className = 'action-btn mini ghost-danger';
    rejectBtn.dataset.action = 'reject';
    rejectBtn.dataset.id = payout.id;
    rejectBtn.textContent = 'Ablehnen';
    actions.appendChild(rejectBtn);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'action-btn mini ghost';
    editBtn.dataset.action = 'edit';
    editBtn.dataset.id = payout.id;
    editBtn.textContent = 'Bearbeitung';
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'action-btn mini ghost-danger';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.dataset.id = payout.id;
    deleteBtn.textContent = 'Loeschen';
    actions.appendChild(deleteBtn);

    block.appendChild(actions);
    generalDeptPayoutList.appendChild(block);
  });
}

function renderDepartmentBoard() {
  departmentBoard.innerHTML = '';

  DEPARTMENTS.forEach((department) => {
    const payouts = state.payoutsByDept[department] || [];
    const totals = getDepartmentTotals(payouts);
    const openCount = payouts.filter((payout) => payout.status === 'Offen' || payout.status === 'In Bearbeitung').length;

    const column = document.createElement('button');
    column.type = 'button';
    column.className = 'department-column';
    column.dataset.department = department;
    column.setAttribute('aria-label', `${department} Details anzeigen`);

    const head = document.createElement('div');
    head.className = 'department-head';

    const title = document.createElement('h3');
    title.textContent = department;
    head.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'department-meta';
    meta.textContent = `${payouts.length} Auszahlung(en), ${openCount} offen`;
    head.appendChild(meta);

    column.appendChild(head);

    const metricsGrid = document.createElement('div');
    metricsGrid.className = 'metrics-grid';

    const totalAmount = document.createElement('div');
    totalAmount.className = 'metric-row';
    totalAmount.innerHTML = `<span>Gesamtbetrag</span><strong>${formatCurrencyUSD(totals.totalAmount)}</strong>`;
    metricsGrid.appendChild(totalAmount);

    const totalPaid = document.createElement('div');
    totalPaid.className = 'metric-row is-paid';
    totalPaid.innerHTML = `<span>Gesamt gezahlt</span><strong>${formatCurrencyUSD(totals.totalPaid)}</strong>`;
    metricsGrid.appendChild(totalPaid);

    const totalOpen = document.createElement('div');
    totalOpen.className = 'metric-row is-open';
    totalOpen.innerHTML = `<span>Gesamt offen</span><strong>${formatCurrencyUSD(totals.totalOpen)}</strong>`;
    metricsGrid.appendChild(totalOpen);

    const totalRejected = document.createElement('div');
    totalRejected.className = 'metric-row is-rejected';
    totalRejected.innerHTML = `<span>Gesamt abgelehnt</span><strong>${formatCurrencyUSD(totals.totalRejected)}</strong>`;
    metricsGrid.appendChild(totalRejected);

    column.appendChild(metricsGrid);

    const hint = document.createElement('p');
    hint.className = 'summary-hint';
    hint.textContent = 'Details anzeigen';
    column.appendChild(hint);

    departmentBoard.appendChild(column);
  });

  renderAnalytics();
}

async function sha256Hex(value) {
  const encoder = new TextEncoder();
  const digestBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  const digestBytes = Array.from(new Uint8Array(digestBuffer));
  return digestBytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(authConfig, plainPassword) {
  const digest = await sha256Hex(`${authConfig.salt}|${plainPassword}`);
  return digest === authConfig.hash;
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function clearModalInputs() {
  modalPayoutDateInput.value = getToday();
  modalPaidByInput.value = '';
  modalPaidToInput.value = '';
  modalPayoutAmountInput.value = '';
  modalPayoutReasonInput.value = '';
  modalConfirmPasswordInput.value = '';
  modalPayoutFeedback.textContent = '';
  modalPayoutFeedback.classList.remove('is-error');
}

function openPayoutModal(department) {
  state.activeDepartment = department;
  payoutModalTitle.textContent = `Neue Auszahlung - ${department}`;
  clearModalInputs();
  payoutModal.classList.add('is-open');
  payoutModal.setAttribute('aria-hidden', 'false');
}

function closePayoutModal() {
  payoutModal.classList.remove('is-open');
  payoutModal.setAttribute('aria-hidden', 'true');
  state.activeDepartment = null;
}

async function loginDepartment(card) {
  const unitName = card.dataset.unit;
  const passwordInput = card.querySelector('.dept-password');
  const status = card.querySelector('.unit-status');
  const authConfig = DEPARTMENT_AUTH[unitName];
  const enteredPassword = passwordInput.value.trim();

  const isValid = await verifyPassword(authConfig, enteredPassword);
  if (!isValid) {
    status.textContent = 'Login fehlgeschlagen';
    status.classList.add('is-error');
    addHistory(`${unitName}: Fehlgeschlagener Login.`);
    return;
  }

  state.authenticatedUnits[unitName] = true;
  status.textContent = 'Zugang freigegeben';
  status.classList.remove('is-error');
  passwordInput.value = '';
  addHistory(`${unitName}: Login erfolgreich.`);
  openPayoutModal(unitName);
}

async function submitPayoutFromModal() {
  const unitName = state.activeDepartment;
  if (!unitName) {
    modalPayoutFeedback.textContent = 'Keine Abteilung aktiv.';
    modalPayoutFeedback.classList.add('is-error');
    return;
  }

  const authConfig = DEPARTMENT_AUTH[unitName];

  const date = modalPayoutDateInput.value;
  const paidBy = modalPaidByInput.value.trim();
  const paidTo = modalPaidToInput.value.trim();
  const amount = Number(modalPayoutAmountInput.value);
  const reason = modalPayoutReasonInput.value.trim();
  const confirmPassword = modalConfirmPasswordInput.value.trim();

  if (!date || !paidBy || !paidTo || !reason || !confirmPassword || Number.isNaN(amount) || amount <= 0) {
    modalPayoutFeedback.textContent = 'Bitte alle Felder korrekt ausfuellen.';
    modalPayoutFeedback.classList.add('is-error');
    return;
  }

  const isValid = await verifyPassword(authConfig, confirmPassword);
  if (!isValid) {
    modalPayoutFeedback.textContent = 'Passwort-Bestaetigung ungueltig.';
    modalPayoutFeedback.classList.add('is-error');
    addHistory(`${unitName}: Auszahlung blockiert, Passwort-Bestaetigung ungueltig.`);
    return;
  }

  const payout = {
    id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    date,
    paidBy,
    paidTo,
    amount,
    reason,
    points: Math.round(amount),
    status: 'Offen',
    updatedAt: new Date().toISOString()
  };

  state.payoutsByDept[unitName].push(payout);
  renderDepartmentBoard();

  try {
    await syncDepartmentPayouts(unitName);
    await appendGeneralLog('PAYOUT_CREATED', unitName, {
      id: payout.id,
      amount: payout.amount,
      status: payout.status
    });
  } catch (error) {
    addHistory(`${unitName}: Datenbank-Sync fehlgeschlagen (${error.message}).`);
  }

  modalPayoutFeedback.textContent = 'Auszahlung erfasst.';
  modalPayoutFeedback.classList.remove('is-error');
  clearModalInputs();

  addHistory(`${unitName}: Auszahlung erfasst (${formatCurrencyUSD(amount)}).`);
}

async function unlockGeneralArea() {
  const enteredPassword = generalPasswordInput.value.trim();

  const isValid = await verifyPassword(GENERAL_AUTH, enteredPassword);
  if (!isValid) {
    securityFeedback.textContent = 'Falsches Passwort. Zugriff verweigert.';
    securityFeedback.classList.add('is-error');
    addHistory('Sicherheitspruefung fehlgeschlagen: General Bereich bleibt gesperrt.');
    return;
  }

  state.generalUnlocked = true;
  generalArea.classList.remove('is-locked');
  securityFeedback.textContent = 'Zugriff erlaubt. General Bereich wurde entsperrt.';
  securityFeedback.classList.remove('is-error');
  generalPasswordInput.value = '';
  renderDepartmentBoard();
  addHistory('Sicherheitspruefung erfolgreich: General Bereich entsperrt.');
}

function resetApp() {
  unitCards.forEach((card) => {
    const unitName = card.dataset.unit;
    state.authenticatedUnits[unitName] = false;
    state.payoutsByDept[unitName] = [];

    card.querySelector('.dept-password').value = '';
    card.querySelector('.unit-status').textContent = 'Nicht authentifiziert';
    card.querySelector('.unit-status').classList.remove('is-error');

    const form = card.querySelector('.payout-form');
    if (form) {
      form.classList.add('is-hidden');
    }
  });

  state.generalUnlocked = false;
  generalArea.classList.add('is-locked');
  generalPasswordInput.value = '';
  securityFeedback.textContent = '';
  securityFeedback.classList.remove('is-error');
  closePayoutModal();
  closeGeneralDepartmentModal();

  historyList.innerHTML = '<li>System bereit. Werte erfassen und Berechnung starten.</li>';
  addHistory('System wurde auf Ausgangszustand zurueckgesetzt.');
  renderDepartmentBoard();

  resetDatabaseState().catch((error) => {
    addHistory(`Reset wurde lokal ausgefuehrt, DB-Reset fehlgeschlagen: ${error.message}.`);
  });
}

function logoutGeneralArea() {
  state.generalUnlocked = false;
  generalArea.classList.add('is-locked');
  generalPasswordInput.value = '';
  securityFeedback.textContent = '';
  securityFeedback.classList.remove('is-error');
  closeGeneralDepartmentModal();
  addHistory('Generalbereich Logout ausgefuehrt. Auszahlungen bleiben erhalten.');
}

function logoutAll() {
  resetApp();
  addHistory('Logout ausgefuehrt. Alle Masken wurden auf Anfang gesetzt.');
}

async function updatePayoutStatus(department, id, status) {
  const payouts = state.payoutsByDept[department];
  if (!payouts) {
    return;
  }

  const target = payouts.find((payout) => payout.id === id);
  if (!target) {
    return;
  }

  target.status = status;
  target.updatedAt = new Date().toISOString();
  renderDepartmentBoard();
  renderGeneralDepartmentDetails();
  addHistory(`${department}: Auszahlung ${id} wurde auf "${status}" gesetzt.`);

  try {
    await syncDepartmentPayouts(department);
    await appendGeneralLog('PAYOUT_STATUS_CHANGED', department, {
      id,
      status
    });
  } catch (error) {
    addHistory(`${department}: Status lokal gesetzt, DB-Sync fehlgeschlagen (${error.message}).`);
  }
}

async function deletePayout(department, id) {
  const payouts = state.payoutsByDept[department];
  if (!payouts) {
    return;
  }

  const index = payouts.findIndex((payout) => payout.id === id);
  if (index === -1) {
    return;
  }

  const removed = payouts[index];
  const confirmed = window.confirm(`Auszahlung ${id} in ${department} wirklich loeschen?`);
  if (!confirmed) {
    addHistory(`${department}: Loeschvorgang fuer Auszahlung ${id} abgebrochen.`);
    return;
  }

  payouts.splice(index, 1);

  renderDepartmentBoard();
  renderGeneralDepartmentDetails();
  addHistory(`${department}: Auszahlung ${id} wurde geloescht (${formatCurrencyUSD(removed.amount)}).`);

  try {
    await syncDepartmentPayouts(department);
    await appendGeneralLog('PAYOUT_DELETED', department, {
      id,
      amount: removed.amount
    });
  } catch (error) {
    addHistory(`${department}: Loeschung lokal, DB-Sync fehlgeschlagen (${error.message}).`);
  }
}

unitCards.forEach((card) => {
  const unitName = card.dataset.unit;
  const loginBtn = card.querySelector('.dept-login-btn');
  const deptPasswordInput = card.querySelector('.dept-password');

  state.authenticatedUnits[unitName] = false;
  state.payoutsByDept[unitName] = [];

  loginBtn.addEventListener('click', async () => {
    await loginDepartment(card);
  });

  deptPasswordInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      await loginDepartment(card);
    }
  });
});

unlockGeneralBtn.addEventListener('click', async () => {
  await unlockGeneralArea();
});

generalPasswordInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    await unlockGeneralArea();
  }
});

resetAllBtn.addEventListener('click', () => {
  logoutGeneralArea();
});

if (logoutAllBtn) {
  logoutAllBtn.addEventListener('click', () => {
    logoutAll();
  });
}

logoutFromModalBtn.addEventListener('click', () => {
  logoutAll();
});

savePayoutModalBtn.addEventListener('click', async () => {
  await submitPayoutFromModal();
});

closePayoutModalBtn.addEventListener('click', () => {
  closePayoutModal();
});

closeGeneralDeptModalBtn.addEventListener('click', () => {
  closeGeneralDepartmentModal();
});

modalConfirmPasswordInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    await submitPayoutFromModal();
  }
});

departmentBoard.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const card = target.closest('.department-column');
  if (!card) {
    return;
  }

  const department = card.dataset.department;
  if (!department) {
    return;
  }

  openGeneralDepartmentModal(department);
});

generalDeptPayoutList.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const action = target.dataset.action;
  const id = target.dataset.id;
  const department = state.activeGeneralDepartment;

  if (!department || !action || !id) {
    return;
  }

  if (action === 'confirm') {
    await updatePayoutStatus(department, id, 'Bestaetigt');
    return;
  }

  if (action === 'reject') {
    await updatePayoutStatus(department, id, 'Abgelehnt');
    return;
  }

  if (action === 'edit') {
    await updatePayoutStatus(department, id, 'In Bearbeitung');
    return;
  }

  if (action === 'delete') {
    await deletePayout(department, id);
  }
});

async function initializeApplication() {
  await loadPayoutsFromDatabase();
  renderDepartmentBoard();
}

initializeApplication();
