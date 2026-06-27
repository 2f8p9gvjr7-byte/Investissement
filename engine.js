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
  const montantEmprunte = Math.max(p.prixBien - p.apport, 0);

  const { mensualite, parAn } = tableauAmortissement(montantEmprunte, p.tauxCredit, p.dureeCredit, dureeAnalyse);

  const flux = [-miseInitiale];
  const detailAnnuel = [];
  let cashFlowCumuleProgressif = 0;
  const fraisEtTravauxPerdus = fraisAcquisition + p.travauxInitiaux;
  const courbeValeurNette = [{ an: 0, valeur: -fraisEtTravauxPerdus }];

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
    const valeurNetteAn = (-miseInitiale + cashFlowCumuleProgressif) + equiteAn;
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

  const cashFlowCumule = flux.reduce((a, b) => a + b, 0);
  const valeurFinaleNette = cashFlowCumule + equiteNetteFinale;

  return {
    miseInitiale, flux: fluxAvecSortie, detailAnnuel, valeurFutureBien,
    equiteNetteFinale, equiteNetteBrute, mensualite, cashFlowCumule, valeurFinaleNette,
    courbeValeurNette, fiscalitePV, plusValueBrute
  };
}

function calculerTitreFinancier(p, dureeAnalyse) {
  const flux = [-p.miseInitiale];
  const detailAnnuel = [];
  const courbeValeurNette = [{ an: 0, valeur: -p.miseInitiale }];
  let cashFlowCumuleProgressif = 0;

  for (let an = 1; an <= dureeAnalyse; an++) {
    const revenuBrut = p.miseInitiale * p.rendementAnnuelInitial * Math.pow(1 + p.tauxCroissanceRendement, an - 1);
    const impot = revenuBrut * p.tauxImpotRevenu;
    const revenuNet = revenuBrut - impot;
    flux.push(revenuNet);
    cashFlowCumuleProgressif += revenuNet;
    detailAnnuel.push({ an, revenuBrut, impot, revenuNet });

    const valeurMarcheAn = p.miseInitiale * Math.pow(1 + p.tauxProgressionValeur, an);
    const plusValueLatenteNette = valeurMarcheAn - p.miseInitiale;
    courbeValeurNette.push({ an, valeur: -p.miseInitiale + cashFlowCumuleProgressif + plusValueLatenteNette });
  }

  const valeurFutureBrute = p.miseInitiale * Math.pow(1 + p.tauxProgressionValeur, dureeAnalyse);
  const plusValue = Math.max(valeurFutureBrute - p.miseInitiale, 0);
  const impotPlusValue = plusValue * p.tauxImpotPlusValue;
  const valeurFutureNette = valeurFutureBrute - impotPlusValue;

  const fluxAvecSortie = [...flux];
  fluxAvecSortie[fluxAvecSortie.length - 1] += valeurFutureNette;

  const cashFlowCumule = flux.reduce((a, b) => a + b, 0);
  const valeurFinaleNette = cashFlowCumule + valeurFutureNette;

  return {
    miseInitiale: p.miseInitiale, flux: fluxAvecSortie, detailAnnuel,
    valeurFutureNette, cashFlowCumule, valeurFinaleNette,
    courbeValeurNette
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
