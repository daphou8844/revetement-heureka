// js/sheets.js — Persistance vers le même Google Sheet que Gestions Heuréka

// URL du script admin Heuréka (unique pour tout — admin, punch, pipeline ET soumissions)
const HEUREKA_GAS_URL = 'https://script.google.com/macros/s/AKfycbwzhekI8CnQ0Erg_s2mM2G5n2gB-kzl2XnAeTtdjFGs2B-pyVX8yCGZISseIJsyvhNxaA/exec';

async function saveToSheets(soumission) {
  try {
    const res = await fetch(HEUREKA_GAS_URL, {
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
      nom:     soumission.nomProjet || (soumission.client && soumission.client.nom) || '',
      client:  (soumission.client && soumission.client.nom) || '',
      tel:     (soumission.client && soumission.client.tel) || '',
      email:   (soumission.client && soumission.client.email) || '',
      adresse: (soumission.client && soumission.client.adresse) || '',
      statut:  'soumis',
      note:    `Soumission ${soumission.noSoumission} — Total: ${fmt$(soumission.financier.total)}`,
      updatedAt: new Date().toISOString(),
    }],
  };
  try {
    const res = await fetch(HEUREKA_GAS_URL, {
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
