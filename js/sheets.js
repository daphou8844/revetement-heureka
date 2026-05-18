// js/sheets.js — Persistance Google Sheets + sync Heuréka

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyREVETEMENT_PLACEHOLDER/exec';

// URL du script admin Heuréka (pour créer/mettre à jour un chantier)
const HEUREKA_ADMIN_URL = 'https://script.google.com/macros/s/AKfycbwzhekI8CnQ0Erg_s2mM2G5n2gB-kzl2XnAeTtdjFGs2B-pyVX8yCGZISseIJsyvhNxaA/exec';

async function saveToSheets(soumission) {
  const url = AppState.sheetsUrl || SHEETS_URL;
  if (!url || url.includes('PLACEHOLDER')) return { ok: false, reason: 'no_url' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveSoumission', data: soumission }),
      redirect: 'follow',
    });
    const d = await res.json();
    return { ok: d.status === 'ok', data: d };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function syncToHeureka(soumission) {
  if (!soumission.projetId) return { ok: false, reason: 'no_projetId' };
  const payload = {
    action: 'sync',
    jobs: [{
      id:      soumission.projetId,
      nom:     soumission.nomProjet || soumission.client.nom,
      client:  soumission.client.nom,
      tel:     soumission.client.tel,
      email:   soumission.client.email,
      adresse: soumission.client.adresse,
      statut:  'soumis',
      note:    `Soumission ${soumission.noSoumission} — Total: ${fmt$(soumission.financier.total)}`,
      updatedAt: new Date().toISOString(),
    }],
  };
  try {
    const res = await fetch(HEUREKA_ADMIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    const d = await res.json();
    return { ok: d.status === 'ok' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
