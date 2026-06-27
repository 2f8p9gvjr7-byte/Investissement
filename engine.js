// ============================================================
// MOTEUR DE CALCUL — Comparateur de rendements
// ============================================================

function calculerMensualite(capital, tauxAnnuel, dureeAnnees) {
  const i = tauxAnnuel / 12;
  const nMois = dureeAnnees * 12;
  if (nMois <= 0) return 0;
  if (i === 0) return capital / nMois;
  return (capital * i) / (1 - Math.pow(1 + i, -nMois));
}

function tableauAmortissement(capital, tauxAnnuel, dureeCreditAnnees, dureeAnalyseAnnees) {
  const mensualite = calculerMensualite(capital, tauxAnnuel, dureeCreditAnnees);
  const i = tauxAnnuel / 12;
  let capitalRestant = capital;
  const parAn = [];
  for (let an = 1; an <= dureeAnalyseAnnees; an++) {
    let interetsAnnee = 0;
    let capitalAnnee = 0;
    for (let m = 1; m <= 12; m++) {
      if (capitalRestant <= 0.01) break;
      const interet = capitalRestant * i;
      const capitalRembourse = Math.min(mensualite - interet, capitalRestant);
      interetsAnnee += interet;
      capitalAnnee += capitalRembourse;
      capitalRestant -= capitalRembourse;
    }
    parAn.push({ an, interetsAnnee, capitalAnnee, capitalRestant: Math.max(capitalRestant, 0) });
  }
  return { mensualite, parAn };
}

function calculerSurtaxePlusValueElevee(plusValueNetteIR) {
  const pv = plusValueNetteIR;
  if (pv <= 50000) return 0;
  if (pv <= 60000) return 0.02 * pv - (60000 - pv) * (1 / 20);
  if (pv <= 100000) return 0.02 * pv;
  if (pv <= 110000) return 0.03 * pv - (110000 - pv) * (1 / 10);
  if (pv <= 150000) return 0.03 * pv;
  if (pv <= 160000) return 0.04 * pv - (160000 - pv) * (15 / 100);
  if (pv <= 200000) return 0.04 * pv;
  if (pv <= 210000) return 0.05 * pv - (210000 - pv) * (20 / 100);
  if (pv <= 250000) return 0.05 * pv;
  if (pv <= 260000) return 0.06 * pv - (260000 - pv) * (25 / 100);
  return 0.06 * pv;
}

// Calcule l'impôt sur la plus-value immobilière (investissement locatif, barème français en vigueur).
function calculerImpotPlusValueImmo(plusValueBrute, dureeDetention) {
  if (plusValueBrute <= 0) {
    return { impotIR: 0, impotPS: 0, surtaxe: 0, total: 0, abattementIR: 0, abattementPS: 0 };
  }

  // Abattement IR (19%) : 6%/an de la 6e à la 21e année, exonération totale à 22 ans
  let abattementIR = 0;
  if (dureeDetention >= 22) {
    abattementIR = 1;
  } else if (dureeDetention > 5) {
    const anneesAuDela5 = Math.min(dureeDetention - 5, 16);
    abattementIR = anneesAuDela5 * 0.06;
  }
  abattementIR = Math.min(abattementIR, 1);

  // Abattement prélèvements sociaux (17,2%) : 1,65%/an de la 6e à la 21e, 1,60% la 22e, 9%/an de la 23e à la 30e
  let abattementPS = 0;
  if (dureeDetention >= 30) {
    abattementPS = 1;
  } else if (dureeDetention > 22) {
    const base = 16 * 0.0165 + 0.016;
    const anneesAuDela22 = Math.min(dureeDetention - 22, 8);
    abattementPS = base + anneesAuDela22 * 0.09;
  } else if (dureeDetention > 5) {
    const anneesAuDela5 = Math.min(dureeDetention - 5, 17);
    abattementPS = anneesAuDela5 * 0.0165;
  }
  abattementPS = Math.min(abattementPS, 1);

  const baseIR = plusValueBrute * (1 - abattementIR);
  const basePS = plusValueBrute * (1 - abattementPS);

  const impotIR = baseIR * 0.19;
  const impotPS = basePS * 0.172;
  const surtaxe = calculerSurtaxePlusValueElevee(baseIR);

  return { impotIR, impotPS, surtaxe, total: impotIR + impotPS + surtaxe, abattementIR, abattementPS };
}

function calculerImmobilier(p, dureeAnalyse) {
  const fraisAcquisition = p.prixBien * p.fraisAcquisitionPct;
  const miseInitiale = p.apport + fraisAcquisition + p.travauxInitiaux;
  const coutTotalOperation = p.prixBien + fraisAcquisition + p.travauxInitiaux;
  // Montant emprunté : paramétrable directement (p.montantEmprunte), sinon calculé par défaut
  // comme le solde à financer une fois l'apport déduit du coût total (bien + frais + travaux).
  const montantEmprunte = Math.max(
    p.montantEmprunte !== undefined && p.montantEmprunte !== null
      ? p.montantEmprunte
      : coutTotalOperation - p.apport,
    0
  );

  const { mensualite, parAn } = tableauAmortissement(montantEmprunte, p.tauxCredit, p.dureeCredit, dureeAnalyse);

  const flux = [-miseInitiale];
  const detailAnnuel = [];
  let cashFlowCumuleProgressif = 0;
  // Patrimoine net à l'achat (an=0) : équité initiale dans le bien (prix - dette contractée) moins la mise totale sortie.
  // Généralise correctement le cas où l'emprunt finance aussi tout ou partie des frais/travaux.
  const equiteInitiale = p.prixBien - montantEmprunte;
  const courbeValeurNette = [{ an: 0, valeur: -miseInitiale + equiteInitiale }];

  for (let an = 1; an <= dureeAnalyse; an++) {
    const loyer = p.loyerAnnuelInitial * Math.pow(1 + p.tauxCroissanceLoyer, an - 1);
    const charges = p.chargesEntretienInitial * Math.pow(1 + p.tauxCroissanceCharges, an - 1);
    const taxe = p.taxeFonciereInitiale * Math.pow(1 + p.tauxCroissanceTaxe, an - 1);
    const dataCredit = parAn[an - 1] || { interetsAnnee: 0, capitalAnnee: 0, capitalRestant: 0 };
    const mensualiteAnnuelle = dataCredit.interetsAnnee + dataCredit.capitalAnnee;

    const revenuImposable = Math.max(loyer - charges - taxe - dataCredit.interetsAnnee, 0);
    const impot = revenuImposable * p.tauxImpot;

    const cashFlow = loyer - charges - taxe - impot - mensualiteAnnuelle;
    flux.push(cashFlow);
    cashFlowCumuleProgressif += cashFlow;

    const valeurBienAn = p.prixBien * Math.pow(1 + p.tauxProgressionValeur, an);
    const equiteAnBrute = valeurBienAn - dataCredit.capitalRestant;
    const prixAcquisitionMajoreAn = p.prixBien + fraisAcquisition + p.travauxInitiaux;
    const plusValueBruteAn = Math.max(valeurBienAn - prixAcquisitionMajoreAn, 0);
    const fiscaliteAn = calculerImpotPlusValueImmo(plusValueBruteAn, an);
    const equiteAn = equiteAnBrute - fiscaliteAn.total;

    detailAnnuel.push({
      an, loyer, charges, taxe, impot, mensualiteAnnuelle,
      capitalRestant: dataCredit.capitalRestant, cashFlow, equiteAn
    });
    // Gain net par rapport à la mise, à date t = -mise + cash-flows cumulés + équité actuelle dans le bien
    // (cohérent avec valeurFinaleNette = -mise + cashFlows + équité finale, calculé plus bas)
    const valeurNetteAn = -miseInitiale + cashFlowCumuleProgressif + equiteAn;
    courbeValeurNette.push({ an, valeur: valeurNetteAn });
  }

  const valeurFutureBien = p.prixBien * Math.pow(1 + p.tauxProgressionValeur, dureeAnalyse);
  const capitalRestantFinal = parAn[dureeAnalyse - 1]?.capitalRestant || 0;
  const equiteNetteBrute = valeurFutureBien - capitalRestantFinal;

  const prixAcquisitionMajore = p.prixBien + fraisAcquisition + p.travauxInitiaux;
  const plusValueBrute = Math.max(valeurFutureBien - prixAcquisitionMajore, 0);
  const fiscalitePV = calculerImpotPlusValueImmo(plusValueBrute, dureeAnalyse);
  const equiteNetteFinale = equiteNetteBrute - fiscalitePV.total;

  const fluxAvecSortie = [...flux];
  fluxAvecSortie[fluxAvecSortie.length - 1] += equiteNetteFinale;

  const cashFlowCumule = flux.reduce((a, b) => a + b, 0); // inclut -miseInitiale au départ
  const gainNet = cashFlowCumule + equiteNetteFinale; // -mise + cashflows + équité finale = gain/perte net réel
  const valeurFinaleNette = gainNet + miseInitiale; // total patrimoine final = mise + gain net

  return {
    miseInitiale, flux: fluxAvecSortie, detailAnnuel, valeurFutureBien,
    equiteNetteFinale, equiteNetteBrute, mensualite, cashFlowCumule, valeurFinaleNette,
    gainNet,
    courbeValeurNette, fiscalitePV, plusValueBrute, capitalRestantFinal, montantEmprunte
  };
}

function calculerTitreFinancier(p, dureeAnalyse) {
  const flux = [-p.miseInitiale];
  const detailAnnuel = [];
  const courbeValeurNette = [{ an: 0, valeur: 0 }];
  let cashFlowCumuleProgressif = 0;

  for (let an = 1; an <= dureeAnalyse; an++) {
    const revenuBrut = p.miseInitiale * p.rendementAnnuelInitial * Math.pow(1 + p.tauxCroissanceRendement, an - 1);
    const impot = revenuBrut * p.tauxImpotRevenu;
    const revenuNet = revenuBrut - impot;
    flux.push(revenuNet);
    cashFlowCumuleProgressif += revenuNet;
    detailAnnuel.push({ an, revenuBrut, impot, revenuNet });

    const valeurMarcheAn = p.miseInitiale * Math.pow(1 + p.tauxProgressionValeur, an);
    const plusValueLatenteBrute = Math.max(valeurMarcheAn - p.miseInitiale, 0);
    const impotLatent = plusValueLatenteBrute * p.tauxImpotPlusValue;
    // Gain net par rapport à la mise, à date t = cash-flows perçus cumulés + plus-value latente nette d'impôt
    const plusValueLatenteNette = (valeurMarcheAn - p.miseInitiale) - impotLatent;
    courbeValeurNette.push({ an, valeur: cashFlowCumuleProgressif + plusValueLatenteNette });
  }

  const valeurFutureBrute = p.miseInitiale * Math.pow(1 + p.tauxProgressionValeur, dureeAnalyse);
  const plusValue = Math.max(valeurFutureBrute - p.miseInitiale, 0);
  const impotPlusValue = plusValue * p.tauxImpotPlusValue;
  const valeurFutureNette = valeurFutureBrute - impotPlusValue;

  const fluxAvecSortie = [...flux];
  fluxAvecSortie[fluxAvecSortie.length - 1] += valeurFutureNette;

  const cashFlowCumule = flux.reduce((a, b) => a + b, 0); // inclut -miseInitiale au départ
  const gainNet = cashFlowCumule + valeurFutureNette; // -mise + cashflows + valeur finale = gain/perte net réel
  const valeurFinaleNette = gainNet + p.miseInitiale; // total patrimoine final = mise + gain net

  return {
    miseInitiale: p.miseInitiale, flux: fluxAvecSortie, detailAnnuel,
    valeurFutureNette, cashFlowCumule, valeurFinaleNette,
    gainNet,
    courbeValeurNette
  };
}

// Calcule l'impôt de sortie sur les gains d'une assurance-vie (rachat total en une fois),
// selon le régime des versements post-27/09/2017.
// Avant 8 ans : PFU 30 % (12,8 % IR + 17,2 % PS), sans abattement.
// Après 8 ans : 7,5 % IR (au-delà d'un abattement annuel) + 17,2 % PS sur la totalité des gains (pas d'abattement sur les PS).
function calculerImpotAssuranceVie(gains, dureeDetention, abattement) {
  if (gains <= 0) return { impot: 0, abattementApplique: 0, impotIR: 0, impotPS: 0 };

  const impotPS = gains * 0.172; // prélèvements sociaux : toujours sur la totalité, jamais d'abattement

  if (dureeDetention < 8) {
    const impotIR = gains * 0.128;
    return { impot: impotIR + impotPS, abattementApplique: 0, impotIR, impotPS };
  }

  const abattementApplique = Math.min(gains, abattement);
  const gainsImposablesIR = gains - abattementApplique;
  const impotIR = gainsImposablesIR * 0.075;
  return { impot: impotIR + impotPS, abattementApplique, impotIR, impotPS };
}

function calculerAssuranceVie(p, dureeAnalyse) {
  const rendementNetFrais = p.rendementAnnuelBrut - p.fraisGestionAnnuels;
  const courbeValeurNette = [{ an: 0, valeur: 0 }];
  const detailAnnuel = [];
  let valeurContrat = p.versementInitial;

  for (let an = 1; an <= dureeAnalyse; an++) {
    valeurContrat *= (1 + rendementNetFrais);
    const gainsLatents = valeurContrat - p.versementInitial;
    const { impot } = calculerImpotAssuranceVie(gainsLatents, an, p.abattementAnnuel);
    detailAnnuel.push({ an, valeurContrat, gainsLatents, impotSiSortie: impot });
    // Gain net par rapport à la mise, à date t = gain latent net d'impôt (la mise n'est ni gagnée ni perdue,
    // elle reste intégralement dans le contrat ; cohérent avec valeurFinaleNette - miseInitiale calculé plus bas)
    courbeValeurNette.push({ an, valeur: gainsLatents - impot });
  }

  const valeurFinaleBrute = valeurContrat;
  const gainsFinaux = valeurFinaleBrute - p.versementInitial;
  const { impot: impotFinal, abattementApplique, impotIR, impotPS } = calculerImpotAssuranceVie(gainsFinaux, dureeAnalyse, p.abattementAnnuel);
  const valeurFinaleNette = valeurFinaleBrute - impotFinal;

  // Un seul flux de sortie au terme (capitalisation pure, pas de cash-flow intermédiaire perçu)
  const fluxFinal = new Array(dureeAnalyse + 1).fill(0);
  fluxFinal[0] = -p.versementInitial;
  fluxFinal[dureeAnalyse] = valeurFinaleNette;

  return {
    miseInitiale: p.versementInitial,
    flux: fluxFinal,
    detailAnnuel,
    courbeValeurNette,
    valeurFinaleBrute,
    gainsFinaux,
    impotFinal, impotIR, impotPS,
    abattementApplique,
    valeurFinaleNette,
    gainNet: valeurFinaleNette - p.versementInitial,
    cashFlowCumule: -p.versementInitial, // aucun cash-flow intermédiaire perçu, tout est capitalisé jusqu'à la sortie
  };
}

function calculerTRI(flux, guess = 0.08) {
  let taux = guess;
  for (let iter = 0; iter < 200; iter++) {
    let npv = 0;
    let dNpv = 0;
    for (let t = 0; t < flux.length; t++) {
      npv += flux[t] / Math.pow(1 + taux, t);
      if (t > 0) dNpv -= (t * flux[t]) / Math.pow(1 + taux, t + 1);
    }
    if (Math.abs(dNpv) < 1e-10) break;
    const nouveauTaux = taux - npv / dNpv;
    if (!isFinite(nouveauTaux)) return null;
    if (Math.abs(nouveauTaux - taux) < 1e-9) return nouveauTaux;
    taux = nouveauTaux;
  }
  return taux;
}
