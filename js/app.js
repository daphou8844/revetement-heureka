// js/app.js — Moteur UI, état, navigation 4 étapes

// ── État global ───────────────────────────────────────────────────────────────
const AppState = {
  step: 1,
  sheetsUrl: '',

  client: {
    nom: '', tel: '', email: '', adresse: '', notes: '',
  },

  nomProjet: '',
  noSoumission: '',
  projetId: '',

  murs: [newMur()],
  nbCoinsExt: 2,
  nbCoinsInt: 0,

  selections: {
    revetement: '',
    coinExt: '',
    coinInt: '',
    jTrim: '',
    moulureDepart: '',
    soffite: '',
    fascia: '',
    gouttiereDescente: '',
    gouttiereCoude: '',
    gouttiereCapuchon: '',
    gouttiereSupport: '',
    isolation: '',
    fourrure: '',
  },

  margeMateriaux: 20,

  mainOeuvre: {
    hommes: 3,
    jours: 5,
    heuresParJour: 9,
    tauxHoraire: 105,
    marge: 25,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function newMur() {
  return {
    id: uid(),
    nom: '',
    hauteurPieds: 10, hauteurPouces: 0,
    longueurPieds: 30, longueurPouces: 0,
    ouvertures: 0,
    pertePct: 10,
    soffiteLargeur: 0,
    nbDescentes: 0,
  };
}

let _toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

function saveLS() {
  localStorage.setItem('rev-state', JSON.stringify(AppState));
}

function loadLS() {
  try {
    const raw = localStorage.getItem('rev-state');
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(AppState, saved);
    // normalise murs au cas où
    if (!Array.isArray(AppState.murs) || AppState.murs.length === 0) {
      AppState.murs = [newMur()];
    }
  } catch (e) { /* ignore */ }
}

function genNoSoumission() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `REV-${yy}${mm}-${seq}`;
}

// ── Lecture URL params (intégration pipeline) ──────────────────────────────────
function readUrlParams() {
  const p = new URLSearchParams(location.search);
  if (p.get('projetId')) AppState.projetId = p.get('projetId');
  if (p.get('nom'))      AppState.client.nom = decodeURIComponent(p.get('nom'));
  if (p.get('tel'))      AppState.client.tel = decodeURIComponent(p.get('tel') || '');
  if (p.get('email'))    AppState.client.email = decodeURIComponent(p.get('email') || '');
  if (p.get('adresse'))  AppState.client.adresse = decodeURIComponent(p.get('adresse') || '');
  if (p.get('nom'))      AppState.nomProjet = decodeURIComponent(p.get('nom'));
}

// ── Navigation étapes ─────────────────────────────────────────────────────────
function goStep(n) {
  if (n < 1 || n > 4) return;
  if (n > AppState.step && !validateCurrentStep()) return;
  AppState.step = n;
  saveLS();
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCurrentStep() {
  if (AppState.step === 1) {
    if (!AppState.client.nom.trim()) {
      toast('Entrez le nom du client', 'err');
      return false;
    }
    if (AppState.murs.length === 0) {
      toast('Ajoutez au moins un mur', 'err');
      return false;
    }
    for (const m of AppState.murs) {
      const h = toFeet(m.hauteurPieds, m.hauteurPouces);
      const l = toFeet(m.longueurPieds, m.longueurPouces);
      if (h <= 0 || l <= 0) { toast('Vérifiez les dimensions des murs', 'err'); return false; }
    }
  }
  if (AppState.step === 2) {
    if (!AppState.selections.revetement) {
      toast('Sélectionnez un revêtement', 'err');
      return false;
    }
  }
  return true;
}

// ── Murs CRUD ─────────────────────────────────────────────────────────────────
function addMur() {
  AppState.murs.push(newMur());
  saveLS();
  renderStep1();
}

function removeMur(id) {
  if (AppState.murs.length <= 1) { toast('Il faut au moins un mur', 'err'); return; }
  AppState.murs = AppState.murs.filter(m => m.id !== id);
  saveLS();
  renderStep1();
}

function updateMur(id, field, value) {
  const m = AppState.murs.find(m => m.id === id);
  if (!m) return;
  m[field] = field.endsWith('Pieds') || field.endsWith('Pouces') || field === 'ouvertures' || field === 'pertePct' || field === 'soffiteLargeur' || field === 'nbDescentes'
    ? parseFloat(value) || 0
    : value;
  saveLS();
  // rafraîchir l'aire affichée pour ce mur
  const aireEl = document.getElementById(`aire-${id}`);
  if (aireEl) {
    const aire = calcMurAire(m);
    aireEl.textContent = aire > 0 ? `${aire.toFixed(1)} pi²` : '';
  }
}

// ── Sélections produits ────────────────────────────────────────────────────────
function updateSelection(key, value) {
  AppState.selections[key] = value;
  saveLS();
  // mise à jour du prix affiché
  const priceEl = document.getElementById(`price-${key}`);
  if (priceEl && value) {
    const cat = selectionCategMap[key];
    const p = cat ? findProduit(cat, value) : null;
    priceEl.textContent = p ? `${fmt$(p.prix)} / ${p.unite}` : '';
  } else if (priceEl) {
    priceEl.textContent = '';
  }
}

// Maps sélection → catégorie dans PRODUITS
const selectionCategMap = {
  revetement: 'revetements',
  coinExt: 'coinsExt',
  coinInt: 'coinsInt',
  jTrim: 'jTrim',
  moulureDepart: 'moulurasDepart',
  soffite: 'soffites',
  fascia: 'fascias',
  gouttiereDescente: 'gouttiereDescentes',
  gouttiereCoude: 'gouttiereCoudes',
  gouttiereCapuchon: 'gouttiereCapuchons',
  gouttiereSupport: 'gouttiereSupports',
  isolation: 'isolation',
  fourrure: 'fourrures',
};

// ── Rendu principal ────────────────────────────────────────────────────────────
function renderAll() {
  renderStepper();
  renderStepContent();
  renderStepNav();
}

function renderStepper() {
  const steps = [
    { n: 1, label: 'Client & Murs' },
    { n: 2, label: 'Produits' },
    { n: 3, label: 'Quantités' },
    { n: 4, label: 'Soumission' },
  ];
  const cur = AppState.step;
  document.getElementById('stepper').innerHTML = steps.map((s, i) => `
    ${i > 0 ? '<div class="step-sep"></div>' : ''}
    <div class="step ${cur === s.n ? 'active' : ''} ${cur > s.n ? 'done' : ''}"
         onclick="goStep(${s.n})">
      <div class="step-num">${cur > s.n ? '✓' : s.n}</div>
      ${s.label}
    </div>
  `).join('');
}

function renderStepContent() {
  const el = document.getElementById('step-content');
  switch (AppState.step) {
    case 1: el.innerHTML = buildStep1(); attachStep1Events(); break;
    case 2: el.innerHTML = buildStep2(); break;
    case 3: el.innerHTML = buildStep3(); break;
    case 4: el.innerHTML = buildStep4(); break;
  }
}

function renderStepNav() {
  const nav = document.getElementById('step-nav');
  const s = AppState.step;
  const fin = s === 3 ? calculerFinancier(AppState) : null;
  nav.innerHTML = `
    <div class="step-nav-info">
      ${fin ? `<span class="text-gold fw-bold">${fmt$(fin.total)}</span> <span class="text-muted">TTC estimé</span>` : `Étape ${s} / 4`}
    </div>
    <div style="display:flex;gap:8px">
      ${s > 1 ? `<button class="btn btn-outline" onclick="goStep(${s - 1})">← Retour</button>` : ''}
      ${s < 4
        ? `<button class="btn btn-gold" onclick="goStep(${s + 1})">Suivant →</button>`
        : `<button class="btn btn-gold btn-lg" onclick="finaliserSoumission()">✓ Finaliser & Envoyer</button>`
      }
    </div>
  `;
}

// ── Étape 1 — Client & Murs ───────────────────────────────────────────────────
function buildStep1() {
  const c = AppState.client;
  return `
    <div class="card">
      <div class="card-title">Informations client</div>
      <div class="form-row two">
        <div class="field">
          <label>Nom / Entreprise *</label>
          <input id="c-nom" type="text" value="${esc(c.nom)}" placeholder="Jean Tremblay" oninput="AppState.client.nom=this.value;saveLS()">
        </div>
        <div class="field">
          <label>No de soumission</label>
          <input id="c-no" type="text" value="${esc(AppState.noSoumission)}" placeholder="${genNoSoumission()}" oninput="AppState.noSoumission=this.value;saveLS()">
        </div>
      </div>
      <div class="form-row three">
        <div class="field">
          <label>Téléphone</label>
          <input type="tel" value="${esc(c.tel)}" placeholder="(418) 555-0000" oninput="AppState.client.tel=this.value;saveLS()">
        </div>
        <div class="field">
          <label>Courriel</label>
          <input type="email" value="${esc(c.email)}" placeholder="client@exemple.com" oninput="AppState.client.email=this.value;saveLS()">
        </div>
        <div class="field">
          <label>Adresse du chantier</label>
          <input type="text" value="${esc(c.adresse)}" placeholder="123 rue Principale, Québec" oninput="AppState.client.adresse=this.value;saveLS()">
        </div>
      </div>
      <div class="field">
        <label>Notes internes</label>
        <textarea placeholder="Particularités du chantier, accès, etc." oninput="AppState.client.notes=this.value;saveLS()">${esc(c.notes)}</textarea>
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="justify-content:space-between">
        <span>Murs / Façades</span>
        <button class="btn btn-ghost btn-sm" onclick="addMur()">+ Ajouter un mur</button>
      </div>
      <div id="murs-list">${buildMursList()}</div>

      <div class="form-row two" style="margin-top:16px">
        <div class="field">
          <label>Coins extérieurs</label>
          <input type="number" min="0" value="${AppState.nbCoinsExt}" oninput="AppState.nbCoinsExt=parseInt(this.value)||0;saveLS()">
        </div>
        <div class="field">
          <label>Coins intérieurs</label>
          <input type="number" min="0" value="${AppState.nbCoinsInt}" oninput="AppState.nbCoinsInt=parseInt(this.value)||0;saveLS()">
        </div>
      </div>
    </div>
  `;
}

function buildMursList() {
  return AppState.murs.map((m, i) => {
    const aire = calcMurAire(m);
    return `
      <div class="mur-card" id="mur-card-${m.id}">
        <div class="mur-header">
          <div class="mur-label">Mur ${i + 1}${m.nom ? ' — ' + esc(m.nom) : ''}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="mur-aire" id="aire-${m.id}">${aire > 0 ? aire.toFixed(1) + ' pi²' : ''}</span>
            <button class="btn-remove-mur" onclick="removeMur('${m.id}')">✕ Supprimer</button>
          </div>
        </div>
        <div class="form-row four">
          <div class="field">
            <label>Nom / côté</label>
            <input type="text" value="${esc(m.nom)}" placeholder="ex: Façade sud"
              onchange="updateMur('${m.id}','nom',this.value);document.querySelector('#mur-card-${m.id} .mur-label').textContent='Mur ${i + 1}${m.nom ? '' : ''}'">
          </div>
          <div class="field">
            <label>Hauteur</label>
            <div class="dim-pair">
              <input type="number" min="0" step="1" value="${m.hauteurPieds}" placeholder="pi" oninput="updateMur('${m.id}','hauteurPieds',this.value)">
              <span class="dim-sep">pi</span>
              <input type="number" min="0" max="11" step="1" value="${m.hauteurPouces}" placeholder="po" oninput="updateMur('${m.id}','hauteurPouces',this.value)">
              <span class="dim-sep">po</span>
            </div>
          </div>
          <div class="field">
            <label>Longueur</label>
            <div class="dim-pair">
              <input type="number" min="0" step="1" value="${m.longueurPieds}" placeholder="pi" oninput="updateMur('${m.id}','longueurPieds',this.value)">
              <span class="dim-sep">pi</span>
              <input type="number" min="0" max="11" step="1" value="${m.longueurPouces}" placeholder="po" oninput="updateMur('${m.id}','longueurPouces',this.value)">
              <span class="dim-sep">po</span>
            </div>
          </div>
          <div class="field">
            <label>Ouvertures (pi²)</label>
            <input type="number" min="0" step="1" value="${m.ouvertures || ''}" placeholder="0"
              oninput="updateMur('${m.id}','ouvertures',this.value)">
          </div>
        </div>
        <div class="form-row four">
          <div class="field">
            <label>Perte / Coupe (%)</label>
            <input type="number" min="0" max="50" step="1" value="${m.pertePct}" oninput="updateMur('${m.id}','pertePct',this.value)">
          </div>
          <div class="field">
            <label>Soffite largeur (pi)</label>
            <input type="number" min="0" step="0.5" value="${m.soffiteLargeur || ''}" placeholder="0"
              oninput="updateMur('${m.id}','soffiteLargeur',this.value)">
          </div>
          <div class="field">
            <label>Descentes gouttière</label>
            <input type="number" min="0" step="1" value="${m.nbDescentes || ''}" placeholder="0"
              oninput="updateMur('${m.id}','nbDescentes',this.value)">
          </div>
          <div></div>
        </div>
      </div>
    `;
  }).join('');
}

function attachStep1Events() {
  // nothing extra — all events are inline
}

function renderStep1() {
  const el = document.getElementById('murs-list');
  if (el) el.innerHTML = buildMursList();
}

// ── Étape 2 — Produits ────────────────────────────────────────────────────────
function buildStep2() {
  const sel = AppState.selections;

  function prodRow(key, label, categ, placeholder = '— Aucun —') {
    const price = sel[key] ? (() => {
      const p = findProduit(categ, sel[key]);
      return p ? `${fmt$(p.prix)} / ${p.unite}` : '';
    })() : '';
    return `
      <div class="produit-group">
        <div class="produit-group-title">${label}</div>
        <select onchange="updateSelection('${key}',this.value)">
          ${buildSelect(categ, placeholder, sel[key])}
        </select>
        <div class="produit-price" id="price-${key}">${price}</div>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="card-title">Revêtement principal *</div>
      <div class="produit-grid">
        ${prodRow('revetement','Revêtement','revetements','— Choisir le revêtement —')}
        ${prodRow('isolation','Isolation Isoclad (optionnel)','isolation')}
        ${prodRow('fourrure','Fourrures 1×3 (optionnel)','fourrures')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Accessoires revêtement</div>
      <div class="produit-grid">
        ${prodRow('coinExt','Coins extérieurs','coinsExt')}
        ${prodRow('coinInt','Coins intérieurs','coinsInt')}
        ${prodRow('jTrim','J-Trim / Moulure J','jTrim')}
        ${prodRow('moulureDepart','Moulure de départ','moulurasDepart')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Soffites & Fascias</div>
      <div class="produit-grid">
        ${prodRow('soffite','Soffite','soffites')}
        ${prodRow('fascia','Fascia','fascias')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Système de gouttières</div>
      <div class="produit-grid">
        ${prodRow('gouttiereDescente','Descente','gouttiereDescentes')}
        ${prodRow('gouttiereCoude','Coude de descente','gouttiereCoudes')}
        ${prodRow('gouttiereCapuchon','Capuchon','gouttiereCapuchons')}
        ${prodRow('gouttiereSupport','Support de gouttière','gouttiereSupports')}
      </div>
    </div>
  `;
}

// Override buildSelect to support selected value
function buildSelect(categorie, placeholder, selectedId) {
  const cat = PRODUITS[categorie];
  if (!cat) return `<option value="">—</option>`;

  const marques = [...new Set(cat.map(p => p.marque))];
  let html = `<option value="">${placeholder || '— Aucun —'}</option>`;

  marques.forEach(marque => {
    const items = cat.filter(p => p.marque === marque);
    html += `<optgroup label="${esc(marque)}">`;
    items.forEach(p => {
      const note = p.note ? ` (${p.note})` : '';
      const price = p.couverture
        ? `${fmt$(p.prix)}/${p.unite} · ${p.couverture} pi²`
        : p.longueur
        ? `${fmt$(p.prix)}/${p.unite} · ${p.longueur}'`
        : `${fmt$(p.prix)}/${p.unite}`;
      html += `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>${esc(p.nom)}${note} — ${price}</option>`;
    });
    html += `</optgroup>`;
  });
  return html;
}

// ── Étape 3 — Quantités & Financier ──────────────────────────────────────────
function buildStep3() {
  const fin = calculerFinancier(AppState);
  const q   = fin.quantites;
  const t   = q._totaux;

  const rows = buildQtyRows(q);

  return `
    <div class="results-layout">
      <div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="qty-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Marque</th>
                <th class="text-center">Qté</th>
                <th>Unité</th>
                <th class="text-right">Prix unit.</th>
                <th class="text-right">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="6" class="text-center text-muted" style="padding:20px">Aucun produit sélectionné</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="card mt-16">
          <div class="card-title">Récapitulatif surfaces</div>
          <div class="form-row three">
            <div class="text-center">
              <div class="text-muted text-sm">Aire totale</div>
              <div class="fw-bold" style="font-size:18px;color:var(--gold2)">${t.totalAire.toFixed(1)}</div>
              <div class="text-muted text-sm">pi²</div>
            </div>
            <div class="text-center">
              <div class="text-muted text-sm">Périmètre</div>
              <div class="fw-bold" style="font-size:18px;color:var(--gold2)">${t.totalLongueur.toFixed(1)}</div>
              <div class="text-muted text-sm">pi lin.</div>
            </div>
            <div class="text-center">
              <div class="text-muted text-sm">Soffites</div>
              <div class="fw-bold" style="font-size:18px;color:var(--gold2)">${t.totalSoffite.toFixed(1)}</div>
              <div class="text-muted text-sm">pi²</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        ${buildFinanceCard(fin)}
      </div>
    </div>
  `;
}

function buildQtyRows(q) {
  const labels = {
    revetement:        'Revêtement',
    fourrure:          'Fourrures 1×3',
    isolation:         'Isolation Isoclad',
    coinExt:           'Coins extérieurs',
    coinInt:           'Coins intérieurs',
    jTrim:             'J-Trim',
    moulureDepart:     'Moulure de départ',
    soffite:           'Soffite',
    fascia:            'Fascia',
    membrane:          'Membrane Typar',
    rubanMembrane:     'Ruban membrane',
    gouttiereDescente: 'Descente gouttière',
    gouttiereCoude:    'Coude descente',
    gouttiereCapuchon: 'Capuchon descente',
    gouttiereSupport:  'Support gouttière',
    fixRevetement:     'Clous revêtement',
    fixFourrure:       'Clous fourrures',
    fixSoffite:        'Vis soffite',
    fixFascia:         'Vis fascia',
    scellant:          'Scellant Adfast',
    mousse:            'Mousse polyuréthane',
  };

  return Object.entries(labels).map(([key, defaultLabel]) => {
    const v = q[key];
    if (!v || !v.prod) return '';
    const p = v.prod;
    const sous = p.prix * v.qte;
    const label = v.label ? `${defaultLabel} <span class="text-muted text-sm">(${v.label})</span>` : defaultLabel;
    return `
      <tr>
        <td class="col-produit">${label}</td>
        <td class="col-marque">${esc(p.marque || '')}</td>
        <td class="col-qte">${v.qte}</td>
        <td class="col-unite">${esc(p.unite)}</td>
        <td class="col-prix">${fmt$(p.prix)}</td>
        <td class="col-sous">${fmt$(sous)}</td>
      </tr>
    `;
  }).join('');
}

function buildFinanceCard(fin) {
  const mo = AppState.mainOeuvre;
  return `
    <div class="finance-card">
      <div class="finance-title">Calcul financier</div>

      <div class="finance-section-title">Matériaux</div>
      <div class="finance-row"><span class="lbl">Coût matériaux</span><span>${fmt$(fin.coutMat)}</span></div>
      <div class="finance-row"><span class="lbl">Marge (${AppState.margeMateriaux}%)</span>
        <div class="field" style="width:64px">
          <input type="number" min="0" max="60" step="1" value="${AppState.margeMateriaux}"
            style="padding:4px 6px;font-size:12px;text-align:right"
            onchange="AppState.margeMateriaux=parseFloat(this.value)||20;saveLS();renderStepContent();renderStepNav()">
        </div>
      </div>
      <div class="finance-row"><span class="lbl">Prix matériaux client</span><span class="text-gold">${fmt$(fin.prixMat)}</span></div>
      <div class="finance-row"><span class="lbl">Profit mat.</span><span>${fmt$(fin.profitMat)}</span></div>

      <div class="finance-divider"></div>
      <div class="finance-section-title">Main d'œuvre</div>

      <div class="mo-grid" style="margin-bottom:8px">
        <div class="field">
          <label>Hommes</label>
          <input type="number" min="1" value="${mo.hommes}" oninput="AppState.mainOeuvre.hommes=parseInt(this.value)||1;saveLS();renderStepContent();renderStepNav()">
        </div>
        <div class="field">
          <label>Jours</label>
          <input type="number" min="1" value="${mo.jours}" oninput="AppState.mainOeuvre.jours=parseInt(this.value)||1;saveLS();renderStepContent();renderStepNav()">
        </div>
        <div class="field">
          <label>H/jour</label>
          <input type="number" min="1" max="14" step=".5" value="${mo.heuresParJour}" oninput="AppState.mainOeuvre.heuresParJour=parseFloat(this.value)||9;saveLS();renderStepContent();renderStepNav()">
        </div>
        <div class="field">
          <label>Taux $/h</label>
          <input type="number" min="50" step="5" value="${mo.tauxHoraire}" oninput="AppState.mainOeuvre.tauxHoraire=parseFloat(this.value)||105;saveLS();renderStepContent();renderStepNav()">
        </div>
      </div>

      <div class="finance-row"><span class="lbl">Heures totales</span><span>${fin.heures}h</span></div>
      <div class="finance-row"><span class="lbl">Coût M.O.</span><span>${fmt$(fin.coutMO)}</span></div>
      <div class="finance-row"><span class="lbl">Marge M.O. (${mo.marge}%)</span>
        <div class="field" style="width:64px">
          <input type="number" min="0" max="60" step="1" value="${mo.marge}"
            style="padding:4px 6px;font-size:12px;text-align:right"
            onchange="AppState.mainOeuvre.marge=parseFloat(this.value)||25;saveLS();renderStepContent();renderStepNav()">
        </div>
      </div>
      <div class="finance-row"><span class="lbl">Prix M.O. client</span><span class="text-gold">${fmt$(fin.prixMO)}</span></div>
      <div class="finance-row"><span class="lbl">Profit M.O.</span><span>${fmt$(fin.profitMO)}</span></div>

      <div class="finance-divider"></div>
      <div class="finance-row"><span class="lbl">Sous-total</span><span>${fmt$(fin.sousTotal)}</span></div>
      <div class="finance-row"><span class="lbl">TPS (5%)</span><span>${fmt$(fin.TPS)}</span></div>
      <div class="finance-row"><span class="lbl">TVQ (9.975%)</span><span>${fmt$(fin.TVQ)}</span></div>
      <div class="finance-row total">
        <span class="lbl">TOTAL TTC</span>
        <span>${fmt$(fin.total)}</span>
      </div>
    </div>
  `;
}

// ── Étape 4 — Soumission finale ────────────────────────────────────────────────
function buildStep4() {
  const fin = calculerFinancier(AppState);
  const c   = AppState.client;
  const q   = fin.quantites;

  if (!AppState.noSoumission) {
    AppState.noSoumission = genNoSoumission();
    saveLS();
  }

  const today = new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  return `
    <div class="card">
      <div class="recap-header">
        <div style="display:flex;align-items:center;gap:12px">
          <span class="recap-logo">⬡</span>
          <div class="recap-company">
            <strong>GESTIONS HEURÉKA</strong>
            <span>Revêtement Extérieur</span>
          </div>
        </div>
        <div style="text-align:right">
          <div class="text-muted text-sm">No soumission</div>
          <div class="fw-bold text-gold">${esc(AppState.noSoumission)}</div>
          <div class="text-muted text-sm">${today}</div>
        </div>
      </div>

      <div class="form-row two">
        <div class="recap-client-box">
          <strong>${esc(c.nom || '—')}</strong>
          ${c.tel    ? `<span>${esc(c.tel)}</span><br>` : ''}
          ${c.email  ? `<span>${esc(c.email)}</span><br>` : ''}
          ${c.adresse ? `<span>${esc(c.adresse)}</span>` : ''}
        </div>
        <div class="recap-total-box">
          <div class="lbl">Total estimé (TTC)</div>
          <div class="amount">${fmt$(fin.total)}</div>
          <div class="taxes">TPS ${fmt$(fin.TPS)} · TVQ ${fmt$(fin.TVQ)}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Récapitulatif matériaux</div>
      <table class="qty-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Marque</th>
            <th class="text-center">Qté</th>
            <th>Unité</th>
            <th class="text-right">Prix</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>${buildQtyRows(q)}</tbody>
      </table>
    </div>

    <div class="card">
      <div class="card-title">Main d'œuvre</div>
      <div class="form-row three">
        <div><div class="text-muted text-sm">Équipe</div><div class="fw-bold">${AppState.mainOeuvre.hommes} hommes × ${AppState.mainOeuvre.jours} jours</div></div>
        <div><div class="text-muted text-sm">Heures totales</div><div class="fw-bold">${fin.heures}h</div></div>
        <div><div class="text-muted text-sm">Prix M.O. (${AppState.mainOeuvre.marge}%)</div><div class="fw-bold text-gold">${fmt$(fin.prixMO)}</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Actions</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="imprimerSoumission()">🖨 Imprimer / PDF</button>
        <button class="btn btn-ghost" id="btn-sync" onclick="finaliserSoumission()">✓ Enregistrer & Sync Heuréka</button>
        <button class="btn btn-danger" onclick="nouvellesoumission()">↺ Nouvelle soumission</button>
      </div>
      <div id="sync-status" class="text-muted text-sm mt-8"></div>
    </div>
  `;
}

// ── Actions ────────────────────────────────────────────────────────────────────
async function finaliserSoumission() {
  const btn = document.getElementById('btn-sync');
  const status = document.getElementById('sync-status');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }

  const fin = calculerFinancier(AppState);
  const soumission = {
    noSoumission: AppState.noSoumission,
    projetId: AppState.projetId,
    nomProjet: AppState.nomProjet,
    client: { ...AppState.client },
    financier: {
      coutMat: fin.coutMat,
      prixMat: fin.prixMat,
      prixMO:  fin.prixMO,
      sousTotal: fin.sousTotal,
      TPS: fin.TPS,
      TVQ: fin.TVQ,
      total: fin.total,
    },
    murs: AppState.murs,
    selections: { ...AppState.selections },
    margeMateriaux: AppState.margeMateriaux,
    mainOeuvre: { ...AppState.mainOeuvre },
    date: new Date().toISOString(),
  };

  // Sync vers Heuréka si projetId connu
  let syncMsg = '';
  if (soumission.projetId) {
    const r = await syncToHeureka(soumission);
    syncMsg = r.ok
      ? ' · Chantier mis à jour dans Heuréka ✓'
      : ' · Sync Heuréka échoué (réseau?)';
  }

  // Save to Sheets (optionnel si URL configurée)
  const r2 = await saveToSheets(soumission);
  const sheetMsg = r2.ok ? ' · Sauvegardé dans Sheets ✓' : '';

  // Toujours sauvegarder localement
  const saved = JSON.parse(localStorage.getItem('rev-soumissions') || '[]');
  saved.unshift(soumission);
  localStorage.setItem('rev-soumissions', JSON.stringify(saved.slice(0, 50)));

  toast('Soumission enregistrée ✓', 'ok');
  if (status) status.textContent = `Enregistré localement${syncMsg}${sheetMsg}`;
  if (btn) { btn.disabled = false; btn.textContent = '✓ Enregistrer & Sync Heuréka'; }
}

function imprimerSoumission() {
  const fin = calculerFinancier(AppState);
  const c   = AppState.client;
  const q   = fin.quantites;
  const today = new Date().toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  const rows = Object.entries({
    revetement:'Revêtement', fourrure:'Fourrures 1×3', isolation:'Isolation',
    coinExt:'Coins ext.', coinInt:'Coins int.', jTrim:'J-Trim',
    moulureDepart:'Moulure départ', soffite:'Soffite', fascia:'Fascia',
    membrane:'Membrane Typar', rubanMembrane:'Ruban membrane',
    gouttiereDescente:'Descente', gouttiereCoude:'Coude', gouttiereCapuchon:'Capuchon',
    gouttiereSupport:'Support gouttière', fixRevetement:'Clous revêtement',
    fixFourrure:'Clous fourrures', fixSoffite:'Vis soffite', fixFascia:'Vis fascia',
    scellant:'Scellant', mousse:'Mousse',
  }).map(([key, label]) => {
    const v = q[key];
    if (!v || !v.prod) return '';
    return `<tr><td>${label}</td><td>${v.prod.marque||''}</td><td style="text-align:center">${v.qte}</td><td>${v.prod.unite}</td><td style="text-align:right">$${(v.prod.prix*v.qte).toLocaleString('fr-CA',{minimumFractionDigits:2})}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
  <title>Soumission ${AppState.noSoumission}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:30px}
    h1{font-size:20px;margin:0} h2{font-size:13px;margin:12px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px} th,td{padding:5px 8px;border:1px solid #ddd;font-size:11px}
    th{background:#f5f5f5;font-weight:700} .gold{color:#C9922A} .right{text-align:right}
    .total-box{background:#faf5e8;border:2px solid #C9922A;padding:12px 16px;display:inline-block;margin-top:8px}
    .total-box .lbl{font-size:11px;color:#888} .total-box .amt{font-size:22px;font-weight:900;color:#C9922A}
  </style></head><body>
  <table style="border:none;margin-bottom:20px"><tr>
    <td style="border:none;font-size:28px;color:#C9922A;width:40px">⬡</td>
    <td style="border:none">
      <h1>GESTIONS HEURÉKA</h1>
      <div style="font-size:11px;color:#888">Revêtement Extérieur</div>
    </td>
    <td style="border:none;text-align:right">
      <div style="font-size:11px;color:#888">No soumission</div>
      <div style="font-size:14px;font-weight:700;color:#C9922A">${esc(AppState.noSoumission)}</div>
      <div style="font-size:11px;color:#888">${today}</div>
    </td>
  </tr></table>
  <h2>Client</h2>
  <div><strong>${esc(c.nom)}</strong>${c.tel?` · ${esc(c.tel)}`:''}${c.email?` · ${esc(c.email)}`:''}</div>
  ${c.adresse?`<div>${esc(c.adresse)}</div>`:''}
  <h2>Matériaux</h2>
  <table><thead><tr><th>Produit</th><th>Marque</th><th style="text-align:center">Qté</th><th>Unité</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <h2>Main d'œuvre</h2>
  <table><tr><th>Équipe</th><th>Heures</th><th>Prix M.O.</th></tr>
  <tr><td>${AppState.mainOeuvre.hommes} hommes × ${AppState.mainOeuvre.jours} jours</td><td>${fin.heures}h</td><td class="right">$${fin.prixMO.toLocaleString('fr-CA',{minimumFractionDigits:2})}</td></tr></table>
  <div class="total-box">
    <div class="lbl">Sous-total</div><div>$${fin.sousTotal.toLocaleString('fr-CA',{minimumFractionDigits:2})}</div>
    <div class="lbl" style="margin-top:4px">TPS + TVQ</div><div>$${(fin.TPS+fin.TVQ).toLocaleString('fr-CA',{minimumFractionDigits:2})}</div>
    <div class="lbl" style="margin-top:6px">TOTAL TTC</div>
    <div class="amt">$${fin.total.toLocaleString('fr-CA',{minimumFractionDigits:2})}</div>
  </div>
  <script>window.onload=()=>window.print()<\/script></body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

function nouvellesoumission() {
  if (!confirm('Effacer cette soumission et recommencer ?')) return;
  localStorage.removeItem('rev-state');
  location.href = location.pathname;
}

// ── Sanitize ──────────────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadLS();
  readUrlParams();
  if (!AppState.noSoumission) AppState.noSoumission = genNoSoumission();
  renderAll();
});
