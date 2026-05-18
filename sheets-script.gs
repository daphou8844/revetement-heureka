// sheets-script.gs — Google Apps Script pour Soumissions Revêtement
// Déployer comme Web App : Qui a accès → Tout le monde
// Coller l'URL de déploiement dans js/sheets.js (constante SHEETS_URL)

const SS_ID = ''; // ← Mettre l'ID du Google Spreadsheet ici
const SHEET_SOUMISSIONS = 'Soumissions';

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    // En-têtes
    sh.appendRow([
      'No Soumission', 'Date', 'Client', 'Téléphone', 'Courriel', 'Adresse',
      'Projet ID', 'Nom Projet',
      'Coût Mat.', 'Prix Mat.', 'Prix M.O.',
      'Sous-Total', 'TPS', 'TVQ', 'Total TTC',
      'Marge Mat. %', 'Hommes', 'Jours',
      'Revêtement', 'Soffite', 'Fascia',
      'JSON Complet',
    ]);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
  }
  return sh;
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, data } = body;

    if (action === 'saveSoumission') {
      return saveSoumission(data);
    }

    return jsonRes({ status: 'error', message: 'Action inconnue: ' + action });
  } catch (err) {
    return jsonRes({ status: 'error', message: err.message });
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'getSoumissions') {
    return getSoumissions(e.parameter.limit || 50);
  }
  return jsonRes({ status: 'ok', message: 'Soumissions Revêtement API' });
}

function saveSoumission(s) {
  if (!s || !s.noSoumission) {
    return jsonRes({ status: 'error', message: 'Données manquantes' });
  }

  const sh = getOrCreateSheet(SHEET_SOUMISSIONS);
  const fin = s.financier || {};
  const mo  = s.mainOeuvre || {};
  const sel = s.selections || {};

  sh.appendRow([
    s.noSoumission,
    s.date ? new Date(s.date).toLocaleDateString('fr-CA') : new Date().toLocaleDateString('fr-CA'),
    s.client ? s.client.nom : '',
    s.client ? s.client.tel : '',
    s.client ? s.client.email : '',
    s.client ? s.client.adresse : '',
    s.projetId || '',
    s.nomProjet || '',
    fin.coutMat || 0,
    fin.prixMat || 0,
    fin.prixMO  || 0,
    fin.sousTotal || 0,
    fin.TPS || 0,
    fin.TVQ || 0,
    fin.total || 0,
    s.margeMateriaux || 20,
    mo.hommes || 0,
    mo.jours  || 0,
    sel.revetement || '',
    sel.soffite || '',
    sel.fascia  || '',
    JSON.stringify(s),
  ]);

  return jsonRes({ status: 'ok', noSoumission: s.noSoumission });
}

function getSoumissions(limit) {
  const sh = getOrCreateSheet(SHEET_SOUMISSIONS);
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return jsonRes({ status: 'ok', soumissions: [] });

  const headers = data[0];
  const rows = data.slice(1).reverse().slice(0, parseInt(limit) || 50);
  const soumissions = rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  return jsonRes({ status: 'ok', soumissions });
}

function jsonRes(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
