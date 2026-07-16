// ============================================================
// EXPORT PDF — détail de calcul par support et export global
// ============================================================

// ============================================================
// FORMAT PDF-SAFE — la police standard WinAnsi de pdf-lib ne supporte pas
// l'espace fine insécable (U+202F) ni l'espace insécable (U+00A0) utilisés
// par Intl.NumberFormat("fr-FR") ; on les remplace par un espace normal.
// ============================================================

function nettoyerPourPdf(texte) {
  return String(texte).replace(/[\u202f\u00a0]/g, " ");
}

function fmtEURPdf(v) {
  return nettoyerPourPdf(fmtEUR(v));
}

function fmtPctPdf(v) {
  return nettoyerPourPdf(fmtPct(v));
}

// Renvoie le champ de detailAnnuel à utiliser pour la colonne "Déficit reporté"
// selon le régime fiscal (foncier pour la Location nue au Réel, BIC pour le LMNP Réel,
// aucun mécanisme de report pour le Micro-foncier et le Micro-BIC). Ajouté le 16/07/2026.
function champDeficitPourRegime(params) {
  if (params.regimeFiscal === "nu") return "deficitReporteFoncier";
  if (params.regimeFiscal === "lmnp-reel") return "deficitReporteLmnp";
  return null;
}

const PDF_COULEURS = {
  immobilier: [0.961, 0.647, 0.141],   // ambre
  action: [0.290, 0.871, 0.502],        // vert
  obligation: [0.376, 0.647, 0.980],    // bleu
  etf: [1.0, 0.541, 0.302],             // orange
  av: [0.722, 0.478, 1.0],              // violet
  encre: [0.059, 0.114, 0.208],         // fond marine
  texte: [0.05, 0.05, 0.08],
  sousTexte: [0.4, 0.42, 0.48],
};

async function chargerPolicesPdf(pdfDoc) {
  const { StandardFonts } = PDFLib;
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);
  return { regular, bold, mono };
}

function nouvellePagePdf(pdfDoc) {
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  return { page, x: 48, y: 793, largeur: 595.28 - 96 };
}

// Dessine l'en-tête commun (logo textuel + titre + durée) sur une page, retourne le curseur Y après l'en-tête.
function dessinerEnteteSupport(page, fonts, nom, couleur, dureeAnalyse, largeur) {
  const rgb = window.PDFLib.rgb;
  let y = 793;

  page.drawRectangle({ x: 48, y: y - 4, width: largeur, height: 3, color: rgb(...couleur) });
  y -= 26;
  page.drawText("COMPARATEUR DE RENDEMENTS", { x: 48, y, size: 9, font: fonts.bold, color: rgb(...PDF_COULEURS.sousTexte) });
  page.drawText(`Durée d'analyse : ${dureeAnalyse} ans`, { x: 48 + largeur - 130, y, size: 9, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });
  y -= 24;
  page.drawText(nom, { x: 48, y, size: 18, font: fonts.bold, color: rgb(...couleur) });
  y -= 16;
  page.drawLine({ start: { x: 48, y }, end: { x: 48 + largeur, y }, thickness: 0.75, color: rgb(0.85, 0.85, 0.88) });
  y -= 22;
  return y;
}

function dessinerLigneCleVal(page, fonts, x, y, label, valeur, largeurLabel = 230) {
  const rgb = window.PDFLib.rgb;
  page.drawText(label, { x, y, size: 9.5, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });
  page.drawText(valeur, { x: x + largeurLabel, y, size: 9.5, font: fonts.bold, color: rgb(...PDF_COULEURS.texte) });
}

function dessinerSectionTitre(page, fonts, x, y, titre, couleur, largeur) {
  const rgb = window.PDFLib.rgb;
  page.drawRectangle({ x, y: y - 2, width: 3, height: 11, color: rgb(...couleur) });
  page.drawText(titre.toUpperCase(), { x: x + 8, y, size: 9, font: fonts.bold, color: rgb(...PDF_COULEURS.sousTexte) });
  return y - 16;
}

// ============================================================
// PAGE DE RÉSUMÉ — hypothèses + résultats + fiscalité de sortie
// ============================================================

function dessinerResumeImmo(pdfDoc, fonts, dureeAnalyse, params, resultat) {
  const rgb = window.PDFLib.rgb;
  const { page, largeur } = nouvellePagePdf(pdfDoc);
  let y = dessinerEnteteSupport(page, fonts, "Immobilier — détail du calcul", PDF_COULEURS.immobilier, dureeAnalyse, largeur);

  y = dessinerSectionTitre(page, fonts, 48, y, "Hypothèses — Acquisition & crédit", PDF_COULEURS.immobilier, largeur);
  dessinerLigneCleVal(page, fonts, 48, y, "Prix du bien", fmtEURPdf(params.prixBien)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Apport", fmtEURPdf(params.apport)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Frais d'acquisition", fmtPctPdf(params.fraisAcquisitionPct) + "  (" + fmtEURPdf(params.prixBien * params.fraisAcquisitionPct) + ")"); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Travaux initiaux", fmtEURPdf(params.travauxInitiaux)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Apport personnel (mise de fonds)", fmtEURPdf(params.apport)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Montant emprunté", fmtEURPdf(params.montantEmprunte)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Taux du crédit / durée", fmtPctPdf(params.tauxCredit) + "  /  " + params.dureeCredit + " ans"); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Mensualité", fmtEURPdf(resultat.mensualite)); y -= 20;

  y = dessinerSectionTitre(page, fonts, 48, y, "Hypothèses — Revenus, charges, valeur terminale", PDF_COULEURS.immobilier, largeur);
  // Régime fiscal
  const regimeLabel = params.regimeFiscal === "lmnp-reel" ? "LMNP Réel (amortissements + charges)"
    : params.regimeFiscal === "lmnp-microbic" ? "LMNP Micro-BIC (abattement 50 %)"
    : params.regimeFiscal === "nu-micro" ? "Location nue — Micro-foncier (abattement 30 %)"
    : "Location nue — Réel foncier (revenus fonciers)";
  dessinerLigneCleVal(page, fonts, 48, y, "Régime fiscal locatif", regimeLabel); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Loyer annuel initial / croissance", fmtEURPdf(params.loyerAnnuelInitial) + "  /  " + fmtPctPdf(params.tauxCroissanceLoyer) + " par an"); y -= 14;
  const tauxVacance = (params.vacancePct > 0) ? params.vacancePct / 100 : (params.vacanceMois / 12);
  if (tauxVacance > 0) {
    const moisVacance = (tauxVacance * 12).toFixed(1);
    dessinerLigneCleVal(page, fonts, 48, y, "Vacance locative", fmtPctPdf(tauxVacance) + " par an  (" + moisVacance + " mois/an)"); y -= 14;
  }
  dessinerLigneCleVal(page, fonts, 48, y, "Entretien initial / croissance", fmtEURPdf(params.chargesEntretienInitial) + "  /  " + fmtPctPdf(params.tauxCroissanceCharges) + " par an"); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Taxe foncière initiale / croissance", fmtEURPdf(params.taxeFonciereInitiale) + "  /  " + fmtPctPdf(params.tauxCroissanceTaxe) + " par an"); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Taux d'impôt sur les loyers", fmtPctPdf(params.tauxImpot)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Progression de la valeur du bien", fmtPctPdf(params.tauxProgressionValeur) + " par an"); y -= 20;

  y = dessinerSectionTitre(page, fonts, 48, y, "Résultat à l'échéance (" + dureeAnalyse + " ans)", PDF_COULEURS.immobilier, largeur);
  dessinerLigneCleVal(page, fonts, 48, y, "TRI annuel", fmtPctPdf(resultat.tri)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Valeur finale nette (patrimoine total)", fmtEURPdf(resultat.valeurFinaleNette)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Cash-flow cumulé (mise comprise, hors revente)", fmtEURPdf(resultat.cashFlowCumule)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Multiple sur l'apport", (resultat.valeurFinaleNette / params.apport).toFixed(2) + "x"); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Valeur de revente brute estimée du bien", fmtEURPdf(resultat.valeurFutureBien)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Capital restant dû à la sortie", fmtEURPdf(resultat.capitalRestantFinal) + "  (soldé sur le produit de la vente)"); y -= 14;
  if (resultat.van !== undefined) {
    dessinerLigneCleVal(page, fonts, 48, y, "VAN au taux d'actualisation choisi", fmtEURPdf(resultat.van)); y -= 14;
    dessinerLigneCleVal(page, fonts, 48, y, "Valeur future (VAN capitalisée)", fmtEURPdf(resultat.valeurFutureVAN)); y -= 14;
  }

  // Déficit reporté restant en fin de période (Location nue au Réel ou LMNP Réel uniquement) :
  // permet de vérifier pourquoi l'impôt annuel peut rester nul sans que ce soit un crédit d'impôt
  // sur le revenu global (cf. LMNP) — le solde correspond à des charges/amortissements en attente
  // d'imputation sur des bénéfices futurs. Ajouté le 16/07/2026.
  const champDeficit = champDeficitPourRegime(params);
  if (champDeficit && resultat.detailAnnuel && resultat.detailAnnuel.length > 0) {
    const derniereAnnee = resultat.detailAnnuel[resultat.detailAnnuel.length - 1];
    const solde = derniereAnnee[champDeficit] || 0;
    if (solde > 1) {
      dessinerLigneCleVal(page, fonts, 48, y, "Déficit reporté restant en fin de période", fmtEURPdf(solde)); y -= 14;
    }
  }
  y -= 6;

  y = dessinerSectionTitre(page, fonts, 48, y, "Fiscalité de sortie — plus-value immobilière", PDF_COULEURS.immobilier, largeur);
  const libelleFrais = params.modeFraisPV === "forfait" ? "Forfait 7,5 % du prix"
    : params.modeFraisPV === "reel" ? "Montant réel"
    : "Auto — le plus avantageux entre réel et forfait 7,5 %";
  const libelleTraux = params.modeTravauxPV === "forfait" ? "Forfait 15 % du prix"
    : params.modeTravauxPV === "reel" ? "Montant réel"
    : "Auto — le plus avantageux entre réel et forfait 15 %";
  dessinerLigneCleVal(page, fonts, 48, y, "Frais d'acquisition retenus", libelleFrais); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Travaux retenus", libelleTraux); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Plus-value brute estimée", fmtEURPdf(resultat.plusValueBrute)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Impôt IR (abattement " + fmtPctPdf(resultat.fiscalitePV.abattementIR) + ")", fmtEURPdf(resultat.fiscalitePV.impotIR)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Prélèvements sociaux (abattement " + fmtPctPdf(resultat.fiscalitePV.abattementPS) + ")", fmtEURPdf(resultat.fiscalitePV.impotPS)); y -= 14;
  if (resultat.fiscalitePV.surtaxe > 0) {
    dessinerLigneCleVal(page, fonts, 48, y, "Surtaxe plus-value élevée", fmtEURPdf(resultat.fiscalitePV.surtaxe)); y -= 14;
  }
  dessinerLigneCleVal(page, fonts, 48, y, "Total impôt à la revente", fmtEURPdf(resultat.fiscalitePV.total)); y -= 20;

  if (params.baremePlusValueIR === "reforme17ans") {
    page.drawText("Barème IR simulé : exonération à 17 ans (amendement non retenu dans la LF2026 en l'état — hypothèse).", { x: 48, y, size: 8, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });
    y -= 11;
    page.drawText("Prélèvements sociaux inchangés : 17,2 %, exonération totale à 30 ans.", { x: 48, y, size: 8, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });
  } else {
    const tauxIR = params.tauxIRplusvalue || 0.19;
    const tauxPS = params.tauxPSplusvalue || 0.172;
    page.drawText(`Barème en vigueur : ${fmtPctPdf(tauxIR)} IR + ${fmtPctPdf(tauxPS)} PS, abattements pour durée de détention`, { x: 48, y, size: 8, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });
    y -= 11;
    page.drawText("(exonération totale à 22 ans pour l'IR et 30 ans pour les PS), surtaxe au-delà de 50 000 € de plus-value nette.", { x: 48, y, size: 8, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });
  }

  dessinerPiedDePage(page, fonts, largeur);
}

function dessinerResumeTitre(pdfDoc, fonts, dureeAnalyse, nom, couleur, params, resultat, labelRevenu) {
  const rgb = window.PDFLib.rgb;
  const { page, largeur } = nouvellePagePdf(pdfDoc);
  let y = dessinerEnteteSupport(page, fonts, nom + " — détail du calcul", couleur, dureeAnalyse, largeur);

  y = dessinerSectionTitre(page, fonts, 48, y, "Hypothèses", couleur, largeur);
  dessinerLigneCleVal(page, fonts, 48, y, "Mise initiale", fmtEURPdf(params.miseInitiale)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, labelRevenu + " annuel initial / croissance", fmtPctPdf(params.rendementAnnuelInitial) + "  /  " + fmtPctPdf(params.tauxCroissanceRendement) + " par an"); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Impôt sur le " + labelRevenu.toLowerCase(), fmtPctPdf(params.tauxImpotRevenu)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Progression de la valeur", fmtPctPdf(params.tauxProgressionValeur) + " par an"); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Impôt sur la plus-value de sortie", fmtPctPdf(params.tauxImpotPlusValue)); y -= 20;

  y = dessinerSectionTitre(page, fonts, 48, y, "Résultat à l'échéance (" + dureeAnalyse + " ans)", couleur, largeur);
  dessinerLigneCleVal(page, fonts, 48, y, "TRI annuel", fmtPctPdf(resultat.tri)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Valeur finale nette (patrimoine total)", fmtEURPdf(resultat.valeurFinaleNette)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Cash-flow cumulé (mise comprise, hors revente)", fmtEURPdf(resultat.cashFlowCumule)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Multiple sur la mise initiale", (resultat.valeurFinaleNette / resultat.miseInitiale).toFixed(2) + "x"); y -= 20;

  y = dessinerSectionTitre(page, fonts, 48, y, "Valeur de revente estimée à l'échéance", couleur, largeur);
  dessinerLigneCleVal(page, fonts, 48, y, "Valeur de revente brute estimée", fmtEURPdf(resultat.valeurFutureBrute)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Plus-value brute", fmtEURPdf(resultat.plusValue)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Impôt sur la plus-value", fmtEURPdf(resultat.impotPlusValue)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Valeur de revente nette d'impôt", fmtEURPdf(resultat.valeurFutureNette)); y -= 14;
  if (resultat.van !== undefined) {
    dessinerLigneCleVal(page, fonts, 48, y, "VAN au taux d'actualisation choisi", fmtEURPdf(resultat.van)); y -= 14;
    dessinerLigneCleVal(page, fonts, 48, y, "Valeur future (VAN capitalisée)", fmtEURPdf(resultat.valeurFutureVAN)); y -= 14;
  }
  y -= 6;

  page.drawText("Le tableau annuel détaillé (revenu, impôt, valeur de marché) figure en annexe.", { x: 48, y, size: 8, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });

  dessinerPiedDePage(page, fonts, largeur);
}

function dessinerResumeAv(pdfDoc, fonts, dureeAnalyse, params, resultat) {
  const rgb = window.PDFLib.rgb;
  const { page, largeur } = nouvellePagePdf(pdfDoc);
  let y = dessinerEnteteSupport(page, fonts, "Assurance-vie — détail du calcul", PDF_COULEURS.av, dureeAnalyse, largeur);

  y = dessinerSectionTitre(page, fonts, 48, y, "Hypothèses", PDF_COULEURS.av, largeur);
  dessinerLigneCleVal(page, fonts, 48, y, "Versement initial", fmtEURPdf(params.versementInitial)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Rendement annuel brut", fmtPctPdf(params.rendementAnnuelBrut)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Frais de gestion annuels", fmtPctPdf(params.fraisGestionAnnuels)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Rendement net de frais", fmtPctPdf(params.rendementAnnuelBrut - params.fraisGestionAnnuels)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Abattement annuel après 8 ans", fmtEURPdf(params.abattementAnnuel)); y -= 20;

  y = dessinerSectionTitre(page, fonts, 48, y, "Résultat à l'échéance (" + dureeAnalyse + " ans)", PDF_COULEURS.av, largeur);
  dessinerLigneCleVal(page, fonts, 48, y, "TRI annuel", fmtPctPdf(resultat.tri)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Valeur brute du contrat", fmtEURPdf(resultat.valeurFinaleBrute)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Gains réalisés", fmtEURPdf(resultat.gainsFinaux)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Valeur finale nette (patrimoine total)", fmtEURPdf(resultat.valeurFinaleNette)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Multiple sur la mise initiale", (resultat.valeurFinaleNette / resultat.miseInitiale).toFixed(2) + "x"); y -= 14;
  if (resultat.van !== undefined) {
    dessinerLigneCleVal(page, fonts, 48, y, "VAN au taux d'actualisation choisi", fmtEURPdf(resultat.van)); y -= 14;
    dessinerLigneCleVal(page, fonts, 48, y, "Valeur future (VAN capitalisée)", fmtEURPdf(resultat.valeurFutureVAN)); y -= 14;
  }
  y -= 6;

  y = dessinerSectionTitre(page, fonts, 48, y, "Fiscalité de sortie (rachat total)", PDF_COULEURS.av, largeur);
  dessinerLigneCleVal(page, fonts, 48, y, "Abattement appliqué", fmtEURPdf(resultat.abattementApplique)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Impôt sur le revenu", fmtEURPdf(resultat.impotIR)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Prélèvements sociaux", fmtEURPdf(resultat.impotPS)); y -= 14;
  dessinerLigneCleVal(page, fonts, 48, y, "Total impôt à la sortie", fmtEURPdf(resultat.impotFinal)); y -= 20;

  const regimeTexte = dureeAnalyse < 8
    ? "Sortie avant 8 ans : PFU 31,4 % (12,8 % IR + 18,6 % PS), sans abattement. Taux PS 2026 (LFSS 2026)."
    : "Sortie après 8 ans : abattement annuel sur les gains, puis 7,5 % IR + 18,6 % PS (les PS s'appliquent toujours sur la totalité des gains). Taux PS 2026 (LFSS 2026).";
  page.drawText(regimeTexte, { x: 48, y, size: 8, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });

  dessinerPiedDePage(page, fonts, largeur);
}

function dessinerPiedDePage(page, fonts, largeur) {
  const rgb = window.PDFLib.rgb;
  const date = new Date().toLocaleDateString("fr-FR");
  page.drawText(`Généré le ${date} · Calculs effectués localement, à titre indicatif`, { x: 48, y: 36, size: 7.5, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });
}

// ============================================================
// TABLEAU ANNUEL DÉTAILLÉ (annexe)
// ============================================================

function dessinerTableauAnnuel(pdfDoc, fonts, nom, couleur, dureeAnalyse, colonnes, lignes) {
  const rgb = window.PDFLib.rgb;
  let { page, largeur } = nouvellePagePdf(pdfDoc);
  let y = dessinerEnteteSupport(page, fonts, nom + " — annexe : détail année par année", couleur, dureeAnalyse, largeur);

  const nCol = colonnes.length;
  const largeurCol = largeur / nCol;
  const ligneHauteur = 13;
  const yDebutTableau = y;

  function dessinerEnTeteColonnes(yy) {
    page.drawRectangle({ x: 48, y: yy - 3, width: largeur, height: ligneHauteur, color: rgb(0.93, 0.93, 0.95) });
    colonnes.forEach((col, i) => {
      page.drawText(col.label, { x: 48 + i * largeurCol + 3, y: yy, size: 7.5, font: fonts.bold, color: rgb(...PDF_COULEURS.texte) });
    });
    return yy - ligneHauteur;
  }

  y = dessinerEnTeteColonnes(yDebutTableau);

  lignes.forEach((ligne, idx) => {
    if (y < 60) {
      // nouvelle page si on déborde
      const suite = nouvellePagePdf(pdfDoc);
      page = suite.page;
      largeur = suite.largeur;
      y = dessinerEnteteSupport(page, fonts, nom + " — annexe (suite)", couleur, dureeAnalyse, largeur);
      y = dessinerEnTeteColonnes(y);
    }
    if (idx % 2 === 0) {
      page.drawRectangle({ x: 48, y: y - 3, width: largeur, height: ligneHauteur, color: rgb(0.975, 0.975, 0.98) });
    }
    colonnes.forEach((col, i) => {
      const valeur = col.format(ligne);
      page.drawText(String(valeur), { x: 48 + i * largeurCol + 3, y, size: 7.5, font: fonts.regular, color: rgb(...PDF_COULEURS.texte) });
    });
    y -= ligneHauteur;
  });

  dessinerPiedDePage(page, fonts, largeur);
}

// Construit les colonnes du tableau annuel Immobilier, avec la colonne "Déficit reporté"
// insérée juste après "Impôt" quand le régime dispose d'un mécanisme de report (Location nue
// au Réel ou LMNP Réel). Factorisé pour rester identique entre exporterPdfImmobilier et
// exporterPdfGlobal. Ajouté le 16/07/2026.
function colonnesTableauImmo(params) {
  const colonnes = [
    { label: "Année", format: (l) => l.an },
    { label: "Loyer", format: (l) => fmtEURPdf(l.loyer) },
    { label: "Charges", format: (l) => fmtEURPdf(l.charges) },
    { label: "Taxe", format: (l) => fmtEURPdf(l.taxe) },
    { label: "Impôt", format: (l) => fmtEURPdf(l.impot) },
  ];
  const champDeficit = champDeficitPourRegime(params);
  if (champDeficit) {
    colonnes.push({ label: "Déficit reporté", format: (l) => fmtEURPdf(l[champDeficit] || 0) });
  }
  colonnes.push(
    { label: "Annuité crédit", format: (l) => fmtEURPdf(l.annuiteCredit) },
    { label: "Cash-flow", format: (l) => fmtEURPdf(l.cashFlow) },
    { label: "Capital restant", format: (l) => fmtEURPdf(l.capitalRestant) },
    { label: "Équité nette", format: (l) => fmtEURPdf(l.equiteAn) },
  );
  return colonnes;
}

// ============================================================
// FONCTIONS PUBLIQUES D'EXPORT (un PDF par support)
// ============================================================

async function exporterPdfImmobilier(params, resultat, dureeAnalyse) {
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const fonts = await chargerPolicesPdf(pdfDoc);

  dessinerResumeImmo(pdfDoc, fonts, dureeAnalyse, params, resultat);
  dessinerTableauAnnuel(pdfDoc, fonts, "Immobilier", PDF_COULEURS.immobilier, dureeAnalyse, colonnesTableauImmo(params), resultat.detailAnnuel);

  return pdfDoc.save();
}

async function exporterPdfTitre(nom, couleur, params, resultat, dureeAnalyse, labelRevenu) {
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const fonts = await chargerPolicesPdf(pdfDoc);

  dessinerResumeTitre(pdfDoc, fonts, dureeAnalyse, nom, couleur, params, resultat, labelRevenu);

  const colonnes = [
    { label: "Année", format: (l) => l.an },
    { label: labelRevenu + " brut", format: (l) => fmtEURPdf(l.revenuBrut) },
    { label: "Impôt", format: (l) => fmtEURPdf(l.impot) },
    { label: labelRevenu + " net", format: (l) => fmtEURPdf(l.revenuNet) },
  ];
  dessinerTableauAnnuel(pdfDoc, fonts, nom, couleur, dureeAnalyse, colonnes, resultat.detailAnnuel);

  return pdfDoc.save();
}

async function exporterPdfAv(params, resultat, dureeAnalyse) {
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const fonts = await chargerPolicesPdf(pdfDoc);

  dessinerResumeAv(pdfDoc, fonts, dureeAnalyse, params, resultat);

  const colonnes = [
    { label: "Année", format: (l) => l.an },
    { label: "Valeur du contrat", format: (l) => fmtEURPdf(l.valeurContrat) },
    { label: "Gains latents", format: (l) => fmtEURPdf(l.gainsLatents) },
    { label: "Impôt si sortie", format: (l) => fmtEURPdf(l.impotSiSortie) },
  ];
  dessinerTableauAnnuel(pdfDoc, fonts, "Assurance-vie", PDF_COULEURS.av, dureeAnalyse, colonnes, resultat.detailAnnuel);

  return pdfDoc.save();
}

// ============================================================
// EXPORT GLOBAL — les 5 supports dans un seul PDF
// ============================================================

async function exporterPdfGlobal(donnees, dureeAnalyse, tauxActualisation) {
  const { PDFDocument } = PDFLib;
  const pdfDoc = await PDFDocument.create();
  const fonts = await chargerPolicesPdf(pdfDoc);

  // Page de garde comparative
  dessinerPageGardeGlobale(pdfDoc, fonts, donnees, dureeAnalyse, tauxActualisation);

  // Résumé + annexe pour chaque support, à la suite
  dessinerResumeImmo(pdfDoc, fonts, dureeAnalyse, donnees.immo.params, donnees.immo.resultat);
  dessinerTableauAnnuel(pdfDoc, fonts, "Immobilier", PDF_COULEURS.immobilier, dureeAnalyse, colonnesTableauImmo(donnees.immo.params), donnees.immo.resultat.detailAnnuel);

  const titresMeta = [
    ["action", "Action", PDF_COULEURS.action, "Dividende"],
    ["obligation", "Obligation", PDF_COULEURS.obligation, "Coupon"],
    ["etf", "ETF", PDF_COULEURS.etf, "Distribution"],
  ];
  titresMeta.forEach(([cle, nom, couleur, labelRevenu]) => {
    dessinerResumeTitre(pdfDoc, fonts, dureeAnalyse, nom, couleur, donnees[cle].params, donnees[cle].resultat, labelRevenu);
    dessinerTableauAnnuel(pdfDoc, fonts, nom, couleur, dureeAnalyse, [
      { label: "Année", format: (l) => l.an },
      { label: labelRevenu + " brut", format: (l) => fmtEURPdf(l.revenuBrut) },
      { label: "Impôt", format: (l) => fmtEURPdf(l.impot) },
      { label: labelRevenu + " net", format: (l) => fmtEURPdf(l.revenuNet) },
    ], donnees[cle].resultat.detailAnnuel);
  });

  dessinerResumeAv(pdfDoc, fonts, dureeAnalyse, donnees.av.params, donnees.av.resultat);
  dessinerTableauAnnuel(pdfDoc, fonts, "Assurance-vie", PDF_COULEURS.av, dureeAnalyse, [
    { label: "Année", format: (l) => l.an },
    { label: "Valeur du contrat", format: (l) => fmtEURPdf(l.valeurContrat) },
    { label: "Gains latents", format: (l) => fmtEURPdf(l.gainsLatents) },
    { label: "Impôt si sortie", format: (l) => fmtEURPdf(l.impotSiSortie) },
  ], donnees.av.resultat.detailAnnuel);

  return pdfDoc.save();
}

function dessinerPageGardeGlobale(pdfDoc, fonts, donnees, dureeAnalyse, tauxActualisation) {
  const rgb = window.PDFLib.rgb;
  const { page, largeur } = nouvellePagePdf(pdfDoc);
  let y = 793;

  page.drawRectangle({ x: 0, y: y - 60, width: 595.28, height: 90, color: rgb(...PDF_COULEURS.encre) });
  page.drawText("COMPARATEUR DE RENDEMENTS", { x: 48, y: y - 10, size: 11, font: fonts.bold, color: rgb(0.96, 0.65, 0.14) });
  page.drawText("Synthèse comparative — Immobilier · Action · Obligation · ETF · Assurance-vie", { x: 48, y: y - 28, size: 10, font: fonts.regular, color: rgb(0.9, 0.9, 0.93) });
  page.drawText(`Durée d'analyse : ${dureeAnalyse} ans  ·  Taux d'actualisation (VAN) : ${fmtPctPdf(tauxActualisation)}`, { x: 48, y: y - 44, size: 10, font: fonts.regular, color: rgb(0.9, 0.9, 0.93) });
  y -= 100;

  const ordre = [
    ["immo", "Immobilier", PDF_COULEURS.immobilier],
    ["action", "Action", PDF_COULEURS.action],
    ["obligation", "Obligation", PDF_COULEURS.obligation],
    ["etf", "ETF", PDF_COULEURS.etf],
    ["av", "Assurance-vie", PDF_COULEURS.av],
  ];

  y = dessinerSectionTitre(page, fonts, 48, y, "Résultats comparatifs", PDF_COULEURS.encre, largeur);
  y -= 4;

  const colLargeurs = [105, 65, 105, 105, 85];
  const enTetes = ["Support", "TRI", "Valeur finale nette", "VAN", "Multiple"];
  let x = 48;
  enTetes.forEach((h, i) => {
    page.drawText(h, { x, y, size: 8.5, font: fonts.bold, color: rgb(...PDF_COULEURS.sousTexte) });
    x += colLargeurs[i];
  });
  y -= 4;
  page.drawLine({ start: { x: 48, y }, end: { x: 48 + largeur, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.88) });
  y -= 14;

  ordre.forEach(([cle, nom, couleur]) => {
    const r = donnees[cle].resultat;
    x = 48;
    page.drawRectangle({ x: 48, y: y - 2, width: 3, height: 9, color: rgb(...couleur) });
    page.drawText(nom, { x: x + 8, y, size: 9, font: fonts.bold, color: rgb(...PDF_COULEURS.texte) }); x += colLargeurs[0];
    page.drawText(fmtPctPdf(r.tri), { x, y, size: 9, font: fonts.regular, color: rgb(...PDF_COULEURS.texte) }); x += colLargeurs[1];
    page.drawText(fmtEURPdf(r.valeurFinaleNette), { x, y, size: 9, font: fonts.regular, color: rgb(...PDF_COULEURS.texte) }); x += colLargeurs[2];
    page.drawText(fmtEURPdf(r.van), { x, y, size: 9, font: fonts.regular, color: rgb(...PDF_COULEURS.texte) }); x += colLargeurs[3];
    page.drawText((r.valeurFinaleNette / r.miseInitiale).toFixed(2) + "x", { x, y, size: 9, font: fonts.regular, color: rgb(...PDF_COULEURS.texte) });
    y -= 18;
  });

  y -= 10;
  page.drawText("Le détail complet (hypothèses, fiscalité de sortie, tableau année par année) de chaque support suit dans ce document.", { x: 48, y, size: 8.5, font: fonts.regular, color: rgb(...PDF_COULEURS.sousTexte) });

  dessinerPiedDePage(page, fonts, largeur);
}

// ============================================================
// TÉLÉCHARGEMENT
// ============================================================

function telechargerPdf(bytes, nomFichier) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
