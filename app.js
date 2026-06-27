// ============================================================
// ÉTAT DE L'APPLICATION
// ============================================================

let dureeAnalyse = 15;

const immo = {
  prixBien: 200000, apport: 40000, fraisAcquisitionPct: 0.08, travauxInitiaux: 5000,
  loyerAnnuelInitial: 9600, tauxCroissanceLoyer: 0.015,
  chargesEntretienInitial: 1200, tauxCroissanceCharges: 0.02,
  taxeFonciereInitiale: 900, tauxCroissanceTaxe: 0.02,
  tauxImpot: 0.30, tauxCredit: 0.035, dureeCredit: 20,
  tauxProgressionValeur: 0.02,
};

const action = {
  miseInitiale: 61000, rendementAnnuelInitial: 0.025, tauxCroissanceRendement: 0.02,
  tauxImpotRevenu: 0.30, tauxProgressionValeur: 0.06, tauxImpotPlusValue: 0.30,
};

const obligation = {
  miseInitiale: 61000, rendementAnnuelInitial: 0.035, tauxCroissanceRendement: 0,
  tauxImpotRevenu: 0.30, tauxProgressionValeur: 0, tauxImpotPlusValue: 0.30,
};

const etf = {
  miseInitiale: 61000, rendementAnnuelInitial: 0.018, tauxCroissanceRendement: 0.01,
  tauxImpotRevenu: 0.30, tauxProgressionValeur: 0.05, tauxImpotPlusValue: 0.30,
};

const COULEURS = {
  immobilier: "#d4a657",
  action: "#5fb3a3",
  obligation: "#7b9fd4",
  etf: "#c47a6b",
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
    </div>`;
}

document.getElementById("formAction").innerHTML = genererFormulaireTitre("action", action, "Dividende");
document.getElementById("formObligation").innerHTML = genererFormulaireTitre("obligation", obligation, "Coupon");
document.getElementById("formEtf").innerHTML = genererFormulaireTitre("etf", etf, "Distribution");

// ============================================================
// LIAISON DES CHAMPS <-> ÉTAT
// ============================================================

const PCT_FIELDS = new Set([
  "fraisAcquisitionPct", "tauxCroissanceLoyer", "tauxCroissanceCharges", "tauxCroissanceTaxe",
  "tauxImpot", "tauxCredit", "tauxProgressionValeur",
  "rendementAnnuelInitial", "tauxCroissanceRendement", "tauxImpotRevenu", "tauxImpotPlusValue",
]);

function lierFormulaire(prefix, data) {
  Object.keys(data).forEach((key) => {
    const el = document.getElementById(`${prefix}_${key}`);
    if (!el) return;
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

document.getElementById("dureeAnalyse").addEventListener("input", (e) => {
  dureeAnalyse = parseInt(e.target.value, 10);
  document.getElementById("dureeVal").textContent = `${dureeAnalyse} ans`;
  recalculer();
});

// ============================================================
// RENDU DES CARTES DE RÉSULTATS
// ============================================================

function carteResultatHtml(nom, accentVar, r) {
  const multiple = r.miseInitiale > 0 ? r.valeurFinaleNette / r.miseInitiale : null;
  return `
    <div class="resultat-carte" style="--accent: var(${accentVar})">
      <div class="resultat-nom">${nom}</div>
      <div class="resultat-tri">${fmtPct(r.tri)}</div>
      <div class="resultat-tri-label">TRI annuel</div>
      <div class="resultat-grille">
        <div><div class="resultat-val">${fmtEUR(r.valeurFinaleNette)}</div><div class="resultat-sub">Valeur finale nette</div></div>
        <div><div class="resultat-val">${fmtEUR(r.cashFlowCumule)}</div><div class="resultat-sub">Cash-flow cumulé</div></div>
        <div><div class="resultat-val">${multiple !== null ? multiple.toFixed(2) + "x" : "—"}</div><div class="resultat-sub">Multiple sur mise</div></div>
        <div><div class="resultat-val">${fmtEUR(r.miseInitiale)}</div><div class="resultat-sub">Mise initiale</div></div>
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

  const series = [
    { label: "Immobilier", color: COULEURS.immobilier, points: resultats.immobilier.courbeValeurNette },
    { label: "Action", color: COULEURS.action, points: resultats.action.courbeValeurNette },
    { label: "Obligation", color: COULEURS.obligation, points: resultats.obligation.courbeValeurNette },
    { label: "ETF", color: COULEURS.etf, points: resultats.etf.courbeValeurNette },
  ];

  const toutesValeurs = series.flatMap((s) => s.points.map((p) => p.valeur));
  let yMin = Math.min(...toutesValeurs, 0);
  let yMax = Math.max(...toutesValeurs, 0);
  // marge visuelle de 8% en haut/bas pour ne pas coller les courbes aux bords
  const padY = (yMax - yMin) * 0.08 || 1000;
  yMin -= padY;
  yMax += padY;

  const zoneL = largeur - GRAPH_MARGE.gauche - GRAPH_MARGE.droite;
  const zoneH = hauteur - GRAPH_MARGE.haut - GRAPH_MARGE.bas;

  const xPos = (an) => GRAPH_MARGE.gauche + (an / dureeAnalyse) * zoneL;
  const yPos = (val) => GRAPH_MARGE.haut + zoneH - ((val - yMin) / (yMax - yMin)) * zoneH;

  // --- Grille horizontale + labels Y ---
  const nLignesY = 5;
  let grilleSvg = "";
  let labelsYSvg = "";
  for (let i = 0; i <= nLignesY; i++) {
    const val = yMin + (i / nLignesY) * (yMax - yMin);
    const y = yPos(val);
    grilleSvg += `<line x1="${GRAPH_MARGE.gauche}" y1="${y}" x2="${largeur - GRAPH_MARGE.droite}" y2="${y}" stroke="#2a2f3a" stroke-width="1" stroke-dasharray="2 4"/>`;
    labelsYSvg += `<text x="${GRAPH_MARGE.gauche - 8}" y="${y}" fill="#8b8f9c" font-size="11" text-anchor="end" dominant-baseline="middle">${(val / 1000).toFixed(0)}k</text>`;
  }

  // --- Ligne zéro plus marquée si dans la plage ---
  let ligneZeroSvg = "";
  if (yMin < 0 && yMax > 0) {
    const y0 = yPos(0);
    ligneZeroSvg = `<line x1="${GRAPH_MARGE.gauche}" y1="${y0}" x2="${largeur - GRAPH_MARGE.droite}" y2="${y0}" stroke="#5a5f6c" stroke-width="1.5"/>`;
  }

  // --- Labels X (années) ---
  const pasX = dureeAnalyse <= 10 ? 1 : dureeAnalyse <= 20 ? 2 : Math.ceil(dureeAnalyse / 10);
  let labelsXSvg = "";
  for (let an = 0; an <= dureeAnalyse; an += pasX) {
    const x = xPos(an);
    labelsXSvg += `<text x="${x}" y="${hauteur - GRAPH_MARGE.bas + 20}" fill="#8b8f9c" font-size="11" text-anchor="middle">${an}</text>`;
  }
  labelsXSvg += `<text x="${GRAPH_MARGE.gauche + zoneL / 2}" y="${hauteur - 4}" fill="#5a5f6c" font-size="11" text-anchor="middle">Années</text>`;

  // --- Courbes ---
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

  // Légende
  document.getElementById("graphiqueLegende").innerHTML = series
    .map((s) => `<span class="legende-item"><span class="legende-pastille" style="background:${s.color}"></span>${s.label}</span>`)
    .join("");

  // Interaction tooltip au survol
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
// DÉTAIL FISCAL IMMOBILIER
// ============================================================

function rendreDetailFiscalImmo(r) {
  const f = r.fiscalitePV;
  let html = `
    <span>Plus-value brute estimée : <strong>${fmtEUR(r.plusValueBrute)}</strong></span>
    <span>Impôt IR : ${fmtEUR(f.impotIR)} (abattement ${fmtPct(f.abattementIR)})</span>
    <span>Prélèvements sociaux : ${fmtEUR(f.impotPS)} (abattement ${fmtPct(f.abattementPS)})</span>`;
  if (f.surtaxe > 0) {
    html += `<span>Surtaxe plus-value élevée : ${fmtEUR(f.surtaxe)}</span>`;
  }
  html += `<span class="detail-fiscal-total">Total impôt à la revente : <strong>${fmtEUR(f.total)}</strong></span>`;
  document.getElementById("detailFiscalImmo").innerHTML = html;
}

// ============================================================
// BOUCLE DE RECALCUL PRINCIPALE
// ============================================================

function recalculer() {
  const rImmo = calculerImmobilier(immo, dureeAnalyse);
  const rAction = calculerTitreFinancier(action, dureeAnalyse);
  const rObligation = calculerTitreFinancier(obligation, dureeAnalyse);
  const rEtf = calculerTitreFinancier(etf, dureeAnalyse);

  const resultats = {
    immobilier: { ...rImmo, tri: calculerTRI(rImmo.flux) },
    action: { ...rAction, tri: calculerTRI(rAction.flux) },
    obligation: { ...rObligation, tri: calculerTRI(rObligation.flux) },
    etf: { ...rEtf, tri: calculerTRI(rEtf.flux) },
  };

  document.getElementById("resultatsGrille").innerHTML =
    carteResultatHtml("Immobilier", "--immobilier", resultats.immobilier) +
    carteResultatHtml("Action", "--action", resultats.action) +
    carteResultatHtml("Obligation", "--obligation", resultats.obligation) +
    carteResultatHtml("ETF", "--etf", resultats.etf);

  rendreDetailFiscalImmo(resultats.immobilier);
  dessinerGraphique(resultats);
}

// ============================================================
// INITIALISATION
// ============================================================

recalculer();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // L'app fonctionne sans le mode hors-ligne si l'enregistrement échoue.
    });
  });
}
