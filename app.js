
// ============================================================
// PERSISTANCE — sauvegarde et restauration des paramètres
// ============================================================

const CLE_STOCKAGE = 'comparateur-params-v1';

function sauvegarderParams() {
  try {
    const data = {
      immo: { ...immo },
      action: { ...action },
      obligation: { ...obligation },
      etf: { ...etf },
      av: { ...av },
      dureeAnalyse,
      tauxActualisation,
    };
    localStorage.setItem(CLE_STOCKAGE, JSON.stringify(data));
  } catch(e) {}
}

function restaurerParams() {
  try {
    const raw = localStorage.getItem(CLE_STOCKAGE);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data) return false;

    if (data.immo) Object.assign(immo, data.immo);
    if (data.action) Object.assign(action, data.action);
    if (data.obligation) Object.assign(obligation, data.obligation);
    if (data.etf) Object.assign(etf, data.etf);
    if (data.av) Object.assign(av, data.av);
    if (data.dureeAnalyse) dureeAnalyse = data.dureeAnalyse;
    if (data.tauxActualisation !== undefined) tauxActualisation = data.tauxActualisation;
    return true;
  } catch(e) { return false; }
}

// Arrondit à 2 décimales — évite les artefacts d'arithmétique flottante
// (ex. 0.035 * 100 = 3.5000000000000004 en JS) lors de la reconversion en %.
function arrondi2(v) {
  return Math.round(v * 100) / 100;
}

function restaurerFormulaires() {
  const prefixes = [
    ['immo', immo], ['action', action], ['obligation', obligation], ['etf', etf], ['av', av]
  ];
  prefixes.forEach(([prefix, data]) => {
    Object.keys(data).forEach(key => {
      const el = document.getElementById(`${prefix}_${key}`);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        el.value = data[key];
      } else {
        // Reconvertir les décimaux en % pour l'affichage, arrondi à 2 décimales
        // pour éviter les artefacts d'arithmétique flottante (ex. 3.5000000000000004).
        const val = PCT_FIELDS.has(key) ? arrondi2(data[key] * 100) : data[key];
        el.value = val;
      }
    });
  });

  const sliderDuree = document.getElementById('dureeAnalyse');
  if (sliderDuree) { sliderDuree.value = dureeAnalyse; document.getElementById('dureeVal').textContent = dureeAnalyse + ' ans'; }
  const sliderTaux = document.getElementById('tauxActualisation');
  if (sliderTaux) { sliderTaux.value = tauxActualisation * 100; document.getElementById('tauxActualisationVal').textContent = (tauxActualisation * 100).toFixed(1).replace('.', ',') + ' %'; }

  mettreAjourRegimeFiscal();
}

// ============================================================
// ÉTAT DE L'APPLICATION
// ============================================================

let dureeAnalyse = 15;
let tauxActualisation = 0.02;

const immo = {
  prixBien: 200000, apport: 40000, fraisAcquisitionPct: 0.08, travauxInitiaux: 5000,
  montantEmprunte: 181000,
  loyerAnnuelInitial: 9600, tauxCroissanceLoyer: 0.015,
  vacancePct: 0, vacanceMois: 0,
  chargesEntretienInitial: 1200, tauxCroissanceCharges: 0.02,
  taxeFonciereInitiale: 900, tauxCroissanceTaxe: 0.02,
  tauxImpot: 0.30, tauxCredit: 0.035, dureeCredit: 20,
  tauxProgressionValeur: 0.02,
  regimeFiscal: "nu",
  tauxPSnue: 0.172, tauxPSlmnp: 0.186,
  quotepartTerrain: 0.15, montantMobilier: 5000,
  dureAmortBien: 30, dureAmortTravaux: 12, dureAmortMobilier: 7,
  assurancePno: 0, cfe: 200, fraisComptable: 400,
  tauxCroissanceCfe: 0.02, tauxCroissanceComptable: 0.02,
  revenuGlobalSuffisant: "oui", plafondImputationDeficit: 10700,
  modeFraisPV: "auto", modeTravauxPV: "auto", baremePlusValueIR: "actuel",
  tauxIRplusvalue: 0.19, tauxPSplusvalue: 0.172,
};

const action = {
  miseInitiale: 61000, rendementAnnuelInitial: 0.025, tauxCroissanceRendement: 0.02,
  tauxImpotRevenu: 0.314, tauxProgressionValeur: 0.06, tauxImpotPlusValue: 0.314,
};

const obligation = {
  miseInitiale: 61000, rendementAnnuelInitial: 0.035, tauxCroissanceRendement: 0,
  tauxImpotRevenu: 0.314, tauxProgressionValeur: 0, tauxImpotPlusValue: 0.314,
};

const etf = {
  miseInitiale: 61000, rendementAnnuelInitial: 0.018, tauxCroissanceRendement: 0.01,
  tauxImpotRevenu: 0.314, tauxProgressionValeur: 0.05, tauxImpotPlusValue: 0.314,
};

const av = {
  versementInitial: 61000, rendementAnnuelBrut: 0.035, fraisGestionAnnuels: 0.008,
  abattementAnnuel: 4600,
};

const COULEURS = {
  immobilier: "#f5a524",
  action: "#4ade80",
  obligation: "#60a5fa",
  etf: "#ff8a4d",
  av: "#b87aff",
};

const NOMS = {
  immobilier: "Immobilier",
  action: "Action",
  obligation: "Obligation",
  etf: "ETF",
  av: "Assurance-vie",
};

// ============================================================
// FORMAT
// ============================================================

function fmtEUR(v) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v)) + " €";
}
function fmtPct(v) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return (v * 100).toFixed(2).replace(".", ",") + " %";
}

// ============================================================
// GÉNÉRATION DES FORMULAIRES (Action / Obligation / ETF)
// ============================================================

function champHtml(id, label, value, suffix, step) {
  return `
    <label class="champ"><span class="champ-label">${label}</span>
      <div class="champ-input-wrap">
        <input type="number" class="champ-input mono" id="${id}" value="${value}" step="${step}">
        <span class="champ-suffix">${suffix}</span>
      </div>
    </label>`;
}

function genererFormulaireTitre(prefix, data, labelRevenu) {
  return `
    <div class="section-bloc">
      <div class="section-titre">Mise</div>
      <div class="section-grille">
        ${champHtml(`${prefix}_miseInitiale`, "Mise initiale", data.miseInitiale, "€", 1000)}
      </div>
    </div>
    <div class="section-bloc">
      <div class="section-titre">${labelRevenu}</div>
      <div class="section-grille">
        ${champHtml(`${prefix}_rendementAnnuelInitial`, `Rendement ${labelRevenu.toLowerCase()} initial`, (data.rendementAnnuelInitial * 100).toFixed(2), "%", 0.1)}
        ${champHtml(`${prefix}_tauxCroissanceRendement`, "Croissance du rendement", (data.tauxCroissanceRendement * 100).toFixed(2), "%", 0.1)}
        ${champHtml(`${prefix}_tauxImpotRevenu`, `Impôt sur ${labelRevenu.toLowerCase()}`, (data.tauxImpotRevenu * 100).toFixed(2), "%", 0.1)}
      </div>
    </div>
    <div class="section-bloc">
      <div class="section-titre">Valeur terminale</div>
      <div class="section-grille">
        ${champHtml(`${prefix}_tauxProgressionValeur`, "Progression valeur", (data.tauxProgressionValeur * 100).toFixed(2), "%", 0.1)}
        ${champHtml(`${prefix}_tauxImpotPlusValue`, "Impôt sur plus-value", (data.tauxImpotPlusValue * 100).toFixed(2), "%", 0.1)}
      </div>
    </div>
    <div class="note-fiscale">
      Le "cash-flow cumulé" affiché dans les résultats inclut la mise initiale (en négatif) et les revenus perçus, mais pas la revente. La valeur de revente est calculée séparément ci-dessous.
      <div class="detail-fiscal-chiffre" id="detailFiscal${prefix.charAt(0).toUpperCase() + prefix.slice(1)}"></div>
    </div>`;
}

function genererFormulaireAv(data) {
  return `
    <div class="section-bloc">
      <div class="section-titre">Versement</div>
      <div class="section-grille">
        ${champHtml("av_versementInitial", "Versement initial", data.versementInitial, "€", 1000)}
      </div>
    </div>
    <div class="section-bloc">
      <div class="section-titre">Rendement & frais</div>
      <div class="section-grille">
        ${champHtml("av_rendementAnnuelBrut", "Rendement annuel brut", (data.rendementAnnuelBrut * 100).toFixed(2), "%", 0.1)}
        ${champHtml("av_fraisGestionAnnuels", "Frais de gestion annuels", (data.fraisGestionAnnuels * 100).toFixed(2), "%", 0.05)}
      </div>
    </div>
    <div class="section-bloc">
      <div class="section-titre">Fiscalité de sortie</div>
      <div class="section-grille">
        ${champHtml("av_abattementAnnuel", "Abattement après 8 ans", data.abattementAnnuel, "€", 100)}
      </div>
    </div>
    <div class="note-fiscale">
      Rachat total simulé à la durée choisie. Avant 8 ans : 31,4&nbsp;% PFU (12,8&nbsp;% IR + 18,6&nbsp;% PS) sans abattement. Après 8 ans : abattement annuel sur les gains (4&nbsp;600&nbsp;€ pour une personne seule, 9&nbsp;200&nbsp;€ pour un couple), puis 7,5&nbsp;% IR + 18,6&nbsp;% PS (les PS s'appliquent toujours sur la totalité des gains, sans abattement). Taux PS 2026 selon LFSS 2026 (loi n° 2025-1403).
      <div class="detail-fiscal-chiffre" id="detailFiscalAv"></div>
    </div>`;
}

document.getElementById("formAction").innerHTML = genererFormulaireTitre("action", action, "Dividende");
document.getElementById("formObligation").innerHTML = genererFormulaireTitre("obligation", obligation, "Coupon");
document.getElementById("formEtf").innerHTML = genererFormulaireTitre("etf", etf, "Distribution");
document.getElementById("formAv").innerHTML = genererFormulaireAv(av);

// ============================================================
// LIAISON DES CHAMPS <-> ÉTAT
// ============================================================

const PCT_FIELDS = new Set([
  "fraisAcquisitionPct", "tauxCroissanceLoyer", "tauxCroissanceCharges", "tauxCroissanceTaxe",
  "tauxImpot", "tauxCredit", "tauxProgressionValeur",
  "rendementAnnuelInitial", "tauxCroissanceRendement", "tauxImpotRevenu", "tauxImpotPlusValue",
  "rendementAnnuelBrut", "fraisGestionAnnuels",
  "tauxIRplusvalue", "tauxPSplusvalue",
  "tauxPSnue", "tauxPSlmnp",
  "quotepartTerrain",
  "tauxCroissanceCfe", "tauxCroissanceComptable",
]);

function lierFormulaire(prefix, data) {
  Object.keys(data).forEach((key) => {
    const el = document.getElementById(`${prefix}_${key}`);
    if (!el) return;
    if (el.tagName === "SELECT") {
      el.addEventListener("change", () => {
        data[key] = el.value;
        recalculer();
      });
      return;
    }
    el.addEventListener("input", () => {
      const brut = parseFloat(el.value);
      const val = isNaN(brut) ? 0 : brut;
      data[key] = PCT_FIELDS.has(key) ? val / 100 : val;
      recalculer();
    });
  });
}

lierFormulaire("immo", immo);
lierFormulaire("action", action);
lierFormulaire("obligation", obligation);
lierFormulaire("etf", etf);
lierFormulaire("av", av);

document.getElementById("dureeAnalyse").addEventListener("input", (e) => {
  dureeAnalyse = parseInt(e.target.value, 10);
  document.getElementById("dureeVal").textContent = `${dureeAnalyse} ans`;
  recalculer();
});

document.getElementById("tauxActualisation").addEventListener("input", (e) => {
  tauxActualisation = parseFloat(e.target.value) / 100;
  document.getElementById("tauxActualisationVal").textContent = `${parseFloat(e.target.value).toFixed(1).replace(".", ",")} %`;
  recalculer();
});

// ============================================================
// BOUTON "SYNCHRONISER" — recopie la mise totale immobilière
// ============================================================

function miseTotaleImmobiliere() {
  return immo.apport + immo.prixBien * immo.fraisAcquisitionPct + immo.travauxInitiaux;
}

function recalculerMontantEmprunteAuto() {
  const coutTotal = immo.prixBien + immo.prixBien * immo.fraisAcquisitionPct + immo.travauxInitiaux;
  const montant = Math.max(Math.round(coutTotal - immo.apport), 0);
  immo.montantEmprunte = montant;
  document.getElementById("immo_montantEmprunte").value = montant;
  recalculer();
}

function mettreAjourRegimeFiscal() {
  const lmnp = immo.regimeFiscal === "lmnp-microbic";
  const reel = immo.regimeFiscal === "lmnp-reel";
  const nueMicro = immo.regimeFiscal === "nu-micro";
  const nueReel = immo.regimeFiscal === "nu"; // Location nue — Réel foncier (valeur par défaut/historique "nu")
  const estLmnp = lmnp || reel;

  const labelImpot = document.querySelector("label[for='immo_tauxImpot'] .champ-label, #immo_tauxImpot")
    ?.closest("label")?.querySelector(".champ-label");
  if (labelImpot) {
    labelImpot.textContent = "Taux marginal d'IR (TMI)";
  }
  const noteRegime = document.getElementById("note-regime");

  // Section commune aux deux régimes LMNP (CFE, montant + son taux de croissance) : affichée
  // dès que le régime est Micro-BIC OU Réel, car le moteur applique la CFE aux deux.
  const sectionCommun = document.getElementById("section-lmnp-commun");
  const sectionCommunTaux = document.getElementById("section-lmnp-commun-taux");
  if (sectionCommun) sectionCommun.style.display = estLmnp ? "block" : "none";
  if (sectionCommunTaux) sectionCommunTaux.style.display = estLmnp ? "block" : "none";

  // Frais comptable (montant + taux de croissance) et amortissements : réservés au Réel.
  const sectionComptable = document.getElementById("section-lmnp-comptable");
  const sectionComptableTaux = document.getElementById("section-lmnp-comptable-taux");
  const sectionReel = document.getElementById("section-lmnp-reel");
  if (sectionComptable) sectionComptable.style.display = reel ? "block" : "none";
  if (sectionComptableTaux) sectionComptableTaux.style.display = reel ? "block" : "none";
  if (sectionReel) sectionReel.style.display = reel ? "block" : "none";

  // Déficit foncier : concerne uniquement la Location nue au Réel (seul régime où les charges
  // réelles, dont les intérêts d'emprunt, peuvent dépasser les loyers de façon déductible).
  const sectionDeficit = document.getElementById("section-nue-reel-deficit");
  if (sectionDeficit) sectionDeficit.style.display = nueReel ? "block" : "none";

  if (noteRegime) {
    if (reel) {
      noteRegime.innerHTML = `LMNP Réel&nbsp;: toutes charges déductibles (entretien, taxe, PNO, CFE, comptable, intérêts) + amortissements du bien, travaux et mobilier. Bénéfice imposable = MAX(loyers − tout, 0). Taux = votre TMI + ${(immo.tauxPSlmnp * 100).toFixed(1).replace('.', ',')} % PS. ⚠️ À la revente, amortissements cumulés réintégrés dans la plus-value (réforme 15/02/2025).`;
    } else if (lmnp) {
      noteRegime.innerHTML = `LMNP Micro-BIC&nbsp;: abattement forfaitaire 50&nbsp;% sur les loyers. Charges non déductibles fiscalement (CFE reste toutefois payée et impacte le cash-flow). Taux = votre TMI&nbsp;+ ${(immo.tauxPSlmnp * 100).toFixed(1).replace('.', ',')} % PS. Seuil 2025+&nbsp;: 77&nbsp;700&nbsp;€ de recettes annuelles (au-delà, régime réel applicable de plein droit).`;
    } else if (nueMicro) {
      noteRegime.innerHTML = `Location nue \u2014 Micro-foncier&nbsp;: abattement forfaitaire 30&nbsp;% sur le loyer. Charges non déductibles fiscalement (elles restent payées et impactent le cash-flow). Taux = votre TMI&nbsp;+ ${(immo.tauxPSnue * 100).toFixed(1).replace('.', ',')} % PS. Applicable de plein droit si les recettes ne dépassent pas 15&nbsp;000&nbsp;€/an (au-delà, régime réel applicable de plein droit).`;
    } else {
      noteRegime.innerHTML = `Location nue \u2014 Réel foncier&nbsp;: entretien, taxe foncière, assurance PNO et intérêts d'emprunt déductibles. Taux = votre TMI&nbsp;+ ${(immo.tauxPSnue * 100).toFixed(1).replace('.', ',')} % PS ajoutés automatiquement. En cas de déficit, mécanisme d'imputation/report détaillé ci-dessous.`;
    }
  }
}

document.getElementById("immo_regimeFiscal").addEventListener("change", (e) => {
  immo.regimeFiscal = e.target.value;
  mettreAjourRegimeFiscal();
  recalculer();
});

mettreAjourRegimeFiscal();

document.getElementById("btnRecalcEmprunt").addEventListener("click", recalculerMontantEmprunteAuto);

document.getElementById("immo_vacancePct").addEventListener("input", (e) => {
  const pct = parseFloat(e.target.value) || 0;
  immo.vacancePct = pct;
  immo.vacanceMois = 0;
  document.getElementById("immo_vacanceMois").value = arrondi2(pct / 100 * 12);
  recalculer();
});
document.getElementById("immo_vacanceMois").addEventListener("input", (e) => {
  const mois = parseFloat(e.target.value) || 0;
  immo.vacanceMois = mois;
  immo.vacancePct = 0;
  document.getElementById("immo_vacancePct").value = arrondi2(mois / 12 * 100);
  recalculer();
});

function synchroniserMise(cible) {
  const montant = Math.round(immo.apport);
  if (cible === "av") {
    av.versementInitial = montant;
    document.getElementById("av_versementInitial").value = montant;
  } else {
    const data = { action, obligation, etf }[cible];
    data.miseInitiale = montant;
    document.getElementById(`${cible}_miseInitiale`).value = montant;
  }
  recalculer();
}

document.querySelectorAll(".btn-sync").forEach((btn) => {
  btn.addEventListener("click", () => synchroniserMise(btn.dataset.target));
});

// ============================================================
// EN-TÊTE STICKY — pastilles TRI
// ============================================================

function rendreTriBar(resultats) {
  const ordre = ["immobilier", "action", "obligation", "etf", "av"];
  document.getElementById("triBar").innerHTML = ordre
    .map((k) => `
      <div class="tri-pastille" style="--c:${COULEURS[k]}" role="button" tabindex="0"
           title="Aller au panneau ${NOMS[k]}" data-cible="panneau-${k}"
           onclick="scrollVersPanneau('panneau-${k}')"
           onkeydown="if(event.key==='Enter')scrollVersPanneau('panneau-${k}')">
        <div class="nom">${NOMS[k]}</div>
        <div class="val">${fmtPct(resultats[k].tri)}</div>
      </div>`)
    .join("");
}

function scrollVersPanneau(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.getElementById("header");
  const offsetHeader = header ? header.offsetHeight : 0;
  const top = el.getBoundingClientRect().top + window.scrollY - offsetHeader - 12;
  window.scrollTo({ top, behavior: "smooth" });
}

// ============================================================
// RENDU DES CARTES DE RÉSULTATS
// ============================================================

function carteResultatHtml(cle, r) {
  const miseRef = cle === "immobilier" ? immo.apport : r.miseInitiale;
  const multiple = miseRef > 0 ? r.valeurFinaleNette / miseRef : null;
  const labelMise = cle === "immobilier" ? "Apport" : "Mise initiale";
  return `
    <div class="resultat-carte" style="--c:${COULEURS[cle]}">
      <div class="resultat-nom">${NOMS[cle]}</div>
      <div class="resultat-tri">${fmtPct(r.tri)}</div>
      <div class="resultat-tri-label">TRI annuel</div>
      <div class="resultat-grille">
        <div><div class="resultat-val">${fmtEUR(r.valeurFinaleNette)}</div><div class="resultat-sub">Valeur finale nette</div></div>
        <div><div class="resultat-val">${fmtEUR(r.cashFlowCumule)}</div><div class="resultat-sub">Cash-flow cumulé (mise comprise)</div></div>
        <div><div class="resultat-val">${multiple !== null ? multiple.toFixed(2) + "x" : "—"}</div><div class="resultat-sub">Multiple sur ${labelMise.toLowerCase()}</div></div>
        <div><div class="resultat-val">${fmtEUR(miseRef)}</div><div class="resultat-sub">${labelMise}</div></div>
      </div>
      <div class="resultat-grille resultat-grille-van">
        <div><div class="resultat-val resultat-val-van">${fmtEUR(r.van)}</div><div class="resultat-sub">VAN au taux choisi</div></div>
        <div><div class="resultat-val resultat-val-van">${fmtEUR(r.valeurFutureVAN)}</div><div class="resultat-sub">Valeur future (VAN capitalisée)</div></div>
      </div>
    </div>`;
}

// ============================================================
// GRAPHIQUE (SVG natif, sans dépendance externe)
// ============================================================

const GRAPH_MARGE = { haut: 16, droite: 16, bas: 32, gauche: 56 };

function dessinerGraphique(resultats) {
  const conteneur = document.getElementById("graphique");
  const largeur = conteneur.clientWidth || 800;
  const hauteur = 320;

  const ordre = ["immobilier", "action", "obligation", "etf", "av"];
  const series = ordre.map((k) => ({ label: NOMS[k], color: COULEURS[k], points: resultats[k].courbeValeurNette }));

  const toutesValeurs = series.flatMap((s) => s.points.map((p) => p.valeur));
  let yMin = Math.min(...toutesValeurs, 0);
  let yMax = Math.max(...toutesValeurs, 0);
  const padY = (yMax - yMin) * 0.08 || 1000;
  yMin -= padY;
  yMax += padY;

  const zoneL = largeur - GRAPH_MARGE.gauche - GRAPH_MARGE.droite;
  const zoneH = hauteur - GRAPH_MARGE.haut - GRAPH_MARGE.bas;

  const xPos = (an) => GRAPH_MARGE.gauche + (an / dureeAnalyse) * zoneL;
  const yPos = (val) => GRAPH_MARGE.haut + zoneH - ((val - yMin) / (yMax - yMin)) * zoneH;

  const nLignesY = 5;
  let grilleSvg = "";
  let labelsYSvg = "";
  for (let i = 0; i <= nLignesY; i++) {
    const val = yMin + (i / nLignesY) * (yMax - yMin);
    const y = yPos(val);
    grilleSvg += `<line x1="${GRAPH_MARGE.gauche}" y1="${y}" x2="${largeur - GRAPH_MARGE.droite}" y2="${y}" stroke="#2a3f6b" stroke-width="1" stroke-dasharray="2 4"/>`;
    labelsYSvg += `<text x="${GRAPH_MARGE.gauche - 8}" y="${y}" fill="#9aa8c2" font-size="11" text-anchor="end" dominant-baseline="middle">${(val / 1000).toFixed(0)}k</text>`;
  }

  let ligneZeroSvg = "";
  if (yMin < 0 && yMax > 0) {
    const y0 = yPos(0);
    ligneZeroSvg = `<line x1="${GRAPH_MARGE.gauche}" y1="${y0}" x2="${largeur - GRAPH_MARGE.droite}" y2="${y0}" stroke="#c5d3e3" stroke-width="1.5"/>`;
  }

  const pasX = dureeAnalyse <= 10 ? 1 : dureeAnalyse <= 20 ? 2 : Math.ceil(dureeAnalyse / 10);
  let labelsXSvg = "";
  for (let an = 0; an <= dureeAnalyse; an += pasX) {
    const x = xPos(an);
    labelsXSvg += `<text x="${x}" y="${hauteur - GRAPH_MARGE.bas + 20}" fill="#9aa8c2" font-size="11" text-anchor="middle">${an}</text>`;
  }
  labelsXSvg += `<text x="${GRAPH_MARGE.gauche + zoneL / 2}" y="${hauteur - 4}" fill="#9aa8c2" font-size="11" text-anchor="middle">Années</text>`;

  let courbesSvg = "";
  let pointsInteractifsSvg = "";
  series.forEach((s) => {
    const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"} ${xPos(p.an)} ${yPos(p.valeur)}`).join(" ");
    courbesSvg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.points.forEach((p) => {
      pointsInteractifsSvg += `<circle cx="${xPos(p.an)}" cy="${yPos(p.valeur)}" r="9" fill="transparent" data-label="${s.label}" data-an="${p.an}" data-val="${p.valeur}" data-color="${s.color}" class="point-hover"/>`;
    });
  });

  conteneur.innerHTML = `
    <svg viewBox="0 0 ${largeur} ${hauteur}" width="100%" height="${hauteur}" id="svgGraphique" style="overflow:visible">
      ${grilleSvg}
      ${ligneZeroSvg}
      ${labelsYSvg}
      ${labelsXSvg}
      ${courbesSvg}
      ${pointsInteractifsSvg}
    </svg>
    <div class="graphique-tooltip" id="graphiqueTooltip" hidden></div>`;

  document.getElementById("graphiqueLegende").innerHTML = series
    .map((s) => `<span class="legende-item"><span class="legende-pastille" style="background:${s.color}"></span>${s.label}</span>`)
    .join("");

  const tooltip = document.getElementById("graphiqueTooltip");
  const svgEl = document.getElementById("svgGraphique");
  svgEl.querySelectorAll(".point-hover").forEach((pt) => {
    pt.addEventListener("mouseenter", (e) => {
      const { label, an, val, color } = e.target.dataset;
      tooltip.innerHTML = `<strong style="color:${color}">${label}</strong> · année ${an} · ${fmtEUR(parseFloat(val))}`;
      tooltip.hidden = false;
      const rect = conteneur.getBoundingClientRect();
      tooltip.style.left = `${e.clientX - rect.left + 12}px`;
      tooltip.style.top = `${e.clientY - rect.top - 12}px`;
    });
    pt.addEventListener("mouseleave", () => { tooltip.hidden = true; });
  });
}

window.addEventListener("resize", () => recalculer());

// ============================================================
// DÉTAIL FISCAL IMMOBILIER ET ASSURANCE-VIE
// ============================================================

function rendreDetailFiscalImmo(r) {
  const f = r.fiscalitePV;
  let html = `
    <span>Montant emprunté : <strong>${fmtEUR(immo.montantEmprunte)}</strong> · mensualité : ${fmtEUR(r.mensualite)}</span>
    <span>Capital restant dû à la sortie : <strong>${fmtEUR(r.capitalRestantFinal)}</strong> (soldé sur le produit de la vente)</span>
    <span>Plus-value brute estimée : <strong>${fmtEUR(r.plusValueBrute)}</strong></span>
    <span>Impôt IR : ${fmtEUR(f.impotIR)} (abattement ${fmtPct(f.abattementIR)})</span>
    <span>Prélèvements sociaux : ${fmtEUR(f.impotPS)} (abattement ${fmtPct(f.abattementPS)})</span>`;
  if (f.surtaxe > 0) {
    html += `<span>Surtaxe plus-value élevée : ${fmtEUR(f.surtaxe)}</span>`;
  }
  html += `<span class="detail-fiscal-total">Total impôt à la revente : <strong>${fmtEUR(f.total)}</strong></span>`;
  document.getElementById("detailFiscalImmo").innerHTML = html;
}

function rendreDetailFiscalAv(r) {
  const html = `
    <span>Valeur brute du contrat : <strong>${fmtEUR(r.valeurFinaleBrute)}</strong></span>
    <span>Gains réalisés : ${fmtEUR(r.gainsFinaux)}</span>
    <span>Abattement appliqué : ${fmtEUR(r.abattementApplique)}</span>
    <span>Impôt IR : ${fmtEUR(r.impotIR)}</span>
    <span>Prélèvements sociaux : ${fmtEUR(r.impotPS)}</span>
    <span class="detail-fiscal-total">Total impôt à la sortie : <strong>${fmtEUR(r.impotFinal)}</strong></span>`;
  document.getElementById("detailFiscalAv").innerHTML = html;
}

function rendreDetailFiscalTitre(prefix, r) {
  const id = `detailFiscal${prefix.charAt(0).toUpperCase() + prefix.slice(1)}`;
  const el = document.getElementById(id);
  if (!el) return;
  const html = `
    <span>Valeur de revente brute estimée : <strong>${fmtEUR(r.valeurFutureBrute)}</strong></span>
    <span>Plus-value brute : ${fmtEUR(r.plusValue)}</span>
    <span>Impôt sur la plus-value : ${fmtEUR(r.impotPlusValue)}</span>
    <span class="detail-fiscal-total">Valeur de revente nette d'impôt : <strong>${fmtEUR(r.valeurFutureNette)}</strong></span>`;
  el.innerHTML = html;
}

// ============================================================
// BOUCLE DE RECALCUL PRINCIPALE
// ============================================================

let derniersResultats = null;

function recalculer() {
  const rImmo = calculerImmobilier(immo, dureeAnalyse);
  const rAction = calculerTitreFinancier(action, dureeAnalyse);
  const rObligation = calculerTitreFinancier(obligation, dureeAnalyse);
  const rEtf = calculerTitreFinancier(etf, dureeAnalyse);
  const rAv = calculerAssuranceVie(av, dureeAnalyse);

  function avecVAN(r) {
    const van = calculerVAN(r.flux, tauxActualisation);
    const valeurFutureVAN = calculerValeurFutureVAN(van, tauxActualisation, dureeAnalyse);
    return { ...r, tri: calculerTRI(r.flux), van, valeurFutureVAN };
  }

  const resultats = {
    immobilier: avecVAN(rImmo),
    action: avecVAN(rAction),
    obligation: avecVAN(rObligation),
    etf: avecVAN(rEtf),
    av: avecVAN(rAv),
  };
  derniersResultats = resultats;

  rendreTriBar(resultats);

  document.getElementById("resultatsGrille").innerHTML =
    carteResultatHtml("immobilier", resultats.immobilier) +
    carteResultatHtml("action", resultats.action) +
    carteResultatHtml("obligation", resultats.obligation) +
    carteResultatHtml("etf", resultats.etf) +
    carteResultatHtml("av", resultats.av);

  rendreDetailFiscalImmo(resultats.immobilier);
  rendreDetailFiscalTitre("action", resultats.action);
  rendreDetailFiscalTitre("obligation", resultats.obligation);
  rendreDetailFiscalTitre("etf", resultats.etf);
  rendreDetailFiscalAv(resultats.av);
  dessinerGraphique(resultats);
  sauvegarderParams();
}

// ============================================================
// EXPORT PDF
// ============================================================

function nomFichierPdf(support) {
  const date = new Date().toISOString().slice(0, 10);
  return `comparateur-${support}-${date}.pdf`;
}

async function gererClicExportPdf(btn) {
  const support = btn.dataset.support;
  if (!derniersResultats) return;
  const texteOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "… génération";
  try {
    let bytes;
    if (support === "immobilier") {
      bytes = await exporterPdfImmobilier(immo, derniersResultats.immobilier, dureeAnalyse);
    } else if (support === "action") {
      bytes = await exporterPdfTitre("Action", PDF_COULEURS.action, action, derniersResultats.action, dureeAnalyse, "Dividende");
    } else if (support === "obligation") {
      bytes = await exporterPdfTitre("Obligation", PDF_COULEURS.obligation, obligation, derniersResultats.obligation, dureeAnalyse, "Coupon");
    } else if (support === "etf") {
      bytes = await exporterPdfTitre("ETF", PDF_COULEURS.etf, etf, derniersResultats.etf, dureeAnalyse, "Distribution");
    } else if (support === "av") {
      bytes = await exporterPdfAv(av, derniersResultats.av, dureeAnalyse);
    }
    telechargerPdf(bytes, nomFichierPdf(support));
  } catch (e) {
    console.error("Erreur export PDF:", e);
    alert("La génération du PDF a échoué. Réessaie, ou signale le problème si ça persiste.");
  } finally {
    btn.disabled = false;
    btn.textContent = texteOriginal;
  }
}

document.querySelectorAll(".btn-pdf:not(.btn-pdf-global)").forEach((btn) => {
  btn.addEventListener("click", () => gererClicExportPdf(btn));
});

document.getElementById("btnExportTout").addEventListener("click", async () => {
  const btn = document.getElementById("btnExportTout");
  if (!derniersResultats) return;
  const texteOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⬇ Génération en cours…";
  try {
    const donnees = {
      immo: { params: immo, resultat: derniersResultats.immobilier },
      action: { params: action, resultat: derniersResultats.action },
      obligation: { params: obligation, resultat: derniersResultats.obligation },
      etf: { params: etf, resultat: derniersResultats.etf },
      av: { params: av, resultat: derniersResultats.av },
    };
    const bytes = await exporterPdfGlobal(donnees, dureeAnalyse, tauxActualisation);
    telechargerPdf(bytes, nomFichierPdf("synthese-globale"));
  } catch (e) {
    console.error("Erreur export PDF global:", e);
    alert("La génération du PDF a échoué. Réessaie, ou signale le problème si ça persiste.");
  } finally {
    btn.disabled = false;
    btn.textContent = texteOriginal;
  }
});

// ============================================================
// INITIALISATION
// ============================================================

if (restaurerParams()) {
  restaurerFormulaires();
}
recalculer();

function afficherNotifMaj() {
  if (document.getElementById('notif-maj')) return;
  const notif = document.createElement('div');
  notif.id = 'notif-maj';
  notif.innerHTML = `
    <span class="notif-maj-icone">🔄</span>
    <span class="notif-maj-texte">Nouvelle version disponible — rechargement dans <strong id="notif-compte">5</strong> s</span>
    <button class="notif-maj-btn" onclick="window.location.reload()">Maintenant</button>
    <button class="notif-maj-fermer" onclick="this.parentElement.remove()" title="Ignorer">✕</button>
  `;
  document.body.appendChild(notif);
  let secondes = 5;
  const timer = setInterval(() => {
    secondes--;
    const el = document.getElementById('notif-compte');
    if (el) el.textContent = secondes;
    if (secondes <= 0) { clearInterval(timer); window.location.reload(); }
  }, 1000);
}

let dejaRecharge = false;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      setInterval(() => reg.update(), 60000);
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            afficherNotifMaj();
          }
        });
      });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!dejaRecharge) { dejaRecharge = true; window.location.reload(); }
    });
  });
}
