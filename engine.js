// ============================================================
// MOTEUR DE CALCUL — Comparateur de rendements
// ============================================================

function calculerMensualite(capital, tauxAnnuel, dureeAnnees) {
  // Taux mensuel proportionnel (convention légale française pour les crédits immobiliers)
  const i = tauxAnnuel / 12;
  const nMois = dureeAnnees * 12;
  if (nMois <= 0) return 0;
  if (i === 0) return capital / nMois;
  return (capital * i) / (1 - Math.pow(1 + i, -nMois));
}

function tableauAmortissement(capital, tauxAnnuel, dureeCreditAnnees, dureeAnalyseAnnees) {
  const mensualite = calculerMensualite(capital, tauxAnnuel, dureeCreditAnnees);
  // Taux mensuel proportionnel (identique à calculerMensualite)
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

// Calcule l'impôt sur la plus-value immobilière (investissement locatif, barème en vigueur).
function calculerImpotPlusValueImmo(plusValueBrute, dureeDetention, bareme = "actuel", tauxIR = 0.19, tauxPS = 0.172) {
  if (plusValueBrute <= 0) {
    return { impotIR: 0, impotPS: 0, surtaxe: 0, total: 0, abattementIR: 0, abattementPS: 0 };
  }

  // Abattement IR (19%) :
  // - Barème actuel (en vigueur) : 6%/an de la 6e à la 21e année, exonération totale à 22 ans
  // - Barème "réforme 17 ans" (amendement I-377, adopté en 1re lecture le 03/11/2025 puis écarté du texte
  //   définitif de la LF2026 — conservé ici en option paramétrable au cas où une loi future le reprendrait) :
  //   8%/an de la 6e à la 16e année, exonération totale à 17 ans
  let abattementIR = 0;
  if (bareme === "reforme17ans") {
    if (dureeDetention >= 17) {
      abattementIR = 1;
    } else if (dureeDetention > 5) {
      const anneesAuDela5 = Math.min(dureeDetention - 5, 11);
      abattementIR = anneesAuDela5 * 0.08;
    }
  } else {
    if (dureeDetention >= 22) {
      abattementIR = 1;
    } else if (dureeDetention > 5) {
      const anneesAuDela5 = Math.min(dureeDetention - 5, 16);
      abattementIR = anneesAuDela5 * 0.06;
    }
  }
  abattementIR = Math.min(abattementIR, 1);

  // Abattement prélèvements sociaux (17,2%) : 1,65%/an de la 6e à la 21e, 1,60% la 22e, 9%/an de la 23e à la 30e
  // Barème inchangé par la réforme à 17 ans (qui ne touche que l'IR) : toujours 30 ans pour une exonération totale.
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

  const impotIR = baseIR * tauxIR;
  const impotPS = basePS * tauxPS;
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

  // Frais et travaux retenus pour le calcul de la PLUS-VALUE FISCALE uniquement.
  // Si le mode est "auto" (par défaut) ou non spécifié, on calcule les deux options
  // et on retient la plus avantageuse (celle qui minimise la plus-value imposable,
  // donc qui maximise le montant retenu en majoration du prix d'acquisition).
  // Le forfait travaux 15% n'est valable qu'au-delà de 5 ans de détention.
  const forfaitFrais = p.prixBien * 0.075;
  const fraisReels = fraisAcquisition;
  const fraisRetenusPourPV = p.modeFraisPV === "forfait" ? forfaitFrais
    : p.modeFraisPV === "reel" ? fraisReels
    : Math.max(forfaitFrais, fraisReels); // "auto" : le plus avantageux

  function travauxRetenusPourPV(dureeDetention) {
    const forfaitTravaux = dureeDetention > 5 ? p.prixBien * 0.15 : 0;
    const travauxReels = p.travauxInitiaux;
    if (p.modeTravauxPV === "forfait") return dureeDetention > 5 ? forfaitTravaux : travauxReels;
    if (p.modeTravauxPV === "reel") return travauxReels;
    return Math.max(forfaitTravaux, travauxReels); // "auto" : le plus avantageux
  }

  const { mensualite, parAn } = tableauAmortissement(montantEmprunte, p.tauxCredit, p.dureeCredit, dureeAnalyse);

  // Le flux initial du TRI = apport seul (capital réellement sorti de poche au jour 0).
  // Les frais et travaux sont financés par le crédit, donc déjà intégrés dans l'annuité.
  // La miseInitiale (apport+frais+travaux) reste utilisée pour la courbe et le multiple.
  const flux = [-p.apport];
  const detailAnnuel = [];
  let cashFlowCumuleProgressif = 0;
  // Patrimoine net à l'achat (an=0) : équité initiale dans le bien (prix - dette contractée) moins la mise totale sortie.
  // Généralise correctement le cas où l'emprunt finance aussi tout ou partie des frais/travaux.
  const equiteInitiale = p.prixBien - montantEmprunte;
  const courbeValeurNette = [{ an: 0, valeur: -miseInitiale + equiteInitiale }];

  // Stock de déficit foncier reportable (location nue au réel uniquement) : liste d'entrées
  // {montant, anneeOrigine}, chacune valable 10 ans, consommées en priorité (FIFO) dès qu'un
  // résultat foncier positif est disponible. CGI art. 156 I 3°. Ajouté le 16/07/2026.
  let stockDeficitReportable = [];

  // Stock de déficit LMNP Réel reportable : même logique de file d'attente sur 10 ans, mais
  // JAMAIS imputable sur le revenu global (CGI art. 156, I-1° ter) — uniquement sur les
  // bénéfices BIC futurs de cette même activité de location meublée. Ajouté le 16/07/2026.
  let stockDeficitLmnp = [];

  // Taux de vacance : priorité au taux % s'il est non nul, sinon conversion depuis les mois/an
  const tauxVacance = (p.vacancePct !== undefined && p.vacancePct > 0)
    ? p.vacancePct / 100
    : (p.vacanceMois !== undefined ? p.vacanceMois / 12 : 0);

  for (let an = 1; an <= dureeAnalyse; an++) {
    const loyerTheorique = p.loyerAnnuelInitial * Math.pow(1 + p.tauxCroissanceLoyer, an - 1);
    // Le loyer encaissé tient compte de la vacance (mois non loués) : seul le loyer perçu
    // entre dans les recettes et la base imposable. Les charges et annuités restent dues en totalité.
    const loyer = loyerTheorique * (1 - tauxVacance);
    const charges = p.chargesEntretienInitial * Math.pow(1 + p.tauxCroissanceCharges, an - 1);
    const taxe = p.taxeFonciereInitiale * Math.pow(1 + p.tauxCroissanceTaxe, an - 1);
    const dataCredit = parAn[an - 1] || { interetsAnnee: 0, capitalAnnee: 0, capitalRestant: 0 };
    const annuiteCredit = dataCredit.interetsAnnee + dataCredit.capitalAnnee;

    // Charges communes réelles (toujours payées, quel que soit le régime)
    const pno = (p.assurancePno || 0) * Math.pow(1 + p.tauxCroissanceCharges, an - 1);

    // Amortissements LMNP Réel (bien + travaux + mobilier selon durées)
    const valeurAmortBien = p.prixBien * (1 - (p.quotepartTerrain || 0));
    const amortBien   = (p.dureAmortBien   && an <= p.dureAmortBien)   ? valeurAmortBien / p.dureAmortBien   : 0;
    const amortTravaux = (p.dureAmortTravaux && an <= p.dureAmortTravaux) ? p.travauxInitiaux / p.dureAmortTravaux : 0;
    const amortMobilier = (p.dureAmortMobilier && an <= p.dureAmortMobilier) ? (p.montantMobilier || 0) / p.dureAmortMobilier : 0;
    const amortTotal = amortBien + amortTravaux + amortMobilier;

    // CFE : due dans les deux régimes LMNP (taxe professionnelle indépendante de la comptabilité).
    // Frais comptable : réservés au Réel — le Micro-BIC est un régime déclaratif simplifié qui
    // ne nécessite pas d'expert-comptable, contrairement au Réel (liasse fiscale, amortissements).
    // Corrigé le 13/07/2026.
    const cfe = (p.cfe || 0) * Math.pow(1 + (p.tauxCroissanceCfe ?? p.tauxCroissanceCharges), an - 1);
    const cpta = p.regimeFiscal === "lmnp-reel"
      ? (p.fraisComptable || 0) * Math.pow(1 + (p.tauxCroissanceComptable ?? p.tauxCroissanceCharges), an - 1)
      : 0;

    let revenuImposable, impot, cashFlow;
    if (p.regimeFiscal === "lmnp-microbic") {
      // LMNP Micro-BIC : abattement forfaitaire 50%, charges NON déductibles fiscalement
      revenuImposable = loyer * 0.50;
      const tauxPS = p.tauxPSlmnp !== undefined ? p.tauxPSlmnp : 0.186;
      impot = revenuImposable * (p.tauxImpot + tauxPS);
      // Charges réellement payées (non déductibles) soustraites du cash-flow
      cashFlow = loyer - charges - taxe - pno - cfe - cpta - impot - annuiteCredit;

    } else if (p.regimeFiscal === "lmnp-reel") {
      // LMNP Réel : charges complètes + amortissements déductibles.
      // Déficit non imputable sur le revenu global (CGI art. 156, I-1° ter) — mais reportable
      // sur les bénéfices BIC futurs de cette même activité, pendant 10 ans (FIFO).
      // Corrigé le 16/07/2026 : le report n'était pas implémenté, chaque année repartait de
      // zéro sans tenir compte des déficits non consommés des années précédentes.
      const chargesDeductibles = charges + taxe + pno + cfe + cpta + dataCredit.interetsAnnee + amortTotal;
      const resultatAvantReportLmnp = loyer - chargesDeductibles;
      const tauxPS = p.tauxPSlmnp !== undefined ? p.tauxPSlmnp : 0.186;

      stockDeficitLmnp = stockDeficitLmnp.filter((e) => an - e.anneeOrigine <= 10);

      if (resultatAvantReportLmnp < 0) {
        stockDeficitLmnp.push({ montant: -resultatAvantReportLmnp, anneeOrigine: an });
        revenuImposable = 0;
      } else {
        let resultatRestant = resultatAvantReportLmnp;
        for (const entree of stockDeficitLmnp) {
          if (resultatRestant <= 0) break;
          const imputable = Math.min(entree.montant, resultatRestant);
          entree.montant -= imputable;
          resultatRestant -= imputable;
        }
        stockDeficitLmnp = stockDeficitLmnp.filter((e) => e.montant > 0.01);
        revenuImposable = resultatRestant;
      }
      impot = revenuImposable * (p.tauxImpot + tauxPS);
      cashFlow = loyer - charges - taxe - pno - cfe - cpta - impot - annuiteCredit;

    } else if (p.regimeFiscal === "nu-micro") {
      // Location nue — Micro-foncier : abattement forfaitaire 30 %, charges NON déductibles
      // fiscalement (même logique que le Micro-BIC, mais pour les revenus fonciers). Applicable
      // de plein droit si les recettes ne dépassent pas 15 000 €/an (au-delà, régime réel
      // applicable de plein droit). Ajouté le 15/07/2026.
      revenuImposable = loyer * 0.70;
      const tauxPSnueMicro = p.tauxPSnue !== undefined ? p.tauxPSnue : 0.172;
      impot = revenuImposable * (p.tauxImpot + tauxPSnueMicro);
      // Charges réellement payées (non déductibles) soustraites du cash-flow
      cashFlow = loyer - charges - taxe - pno - impot - annuiteCredit;

    } else {
      // Location nue — régime réel foncier : entretien + taxe + PNO + intérêts déductibles
      // (pas CFE, pas comptable, pas amort). Corrigé le 15/07/2026 (PS manquants) et complété
      // le 16/07/2026 avec le régime du déficit foncier (CGI art. 156 I 3°) :
      // - le revenu brut compense en priorité les intérêts d'emprunt (jamais imputables sur le
      //   revenu global, uniquement reportables sur les revenus fonciers des 10 années suivantes) ;
      // - le déficit lié aux autres charges est imputable sur le revenu global du foyer dans la
      //   limite annuelle de 10 700 € (procure une économie d'impôt immédiate au taux du TMI,
      //   hors prélèvements sociaux) ; le surplus, comme la part liée aux intérêts, est reportable
      //   sur les revenus fonciers des 10 années suivantes.
      const autresCharges = charges + taxe + pno;
      const interets = dataCredit.interetsAnnee;
      const resultatAvantReport = loyer - autresCharges - interets;
      const tauxPSnue = p.tauxPSnue !== undefined ? p.tauxPSnue : 0.172;
      const plafondImputation = p.plafondImputationDeficit !== undefined ? p.plafondImputationDeficit : 10700;
      const imputationAutorisee = p.revenuGlobalSuffisant !== "non";

      // Purge des entrées de plus de 10 ans (non consommées, elles sont définitivement perdues)
      stockDeficitReportable = stockDeficitReportable.filter((e) => an - e.anneeOrigine <= 10);

      if (resultatAvantReport < 0) {
        const deficitTotal = -resultatAvantReport;
        const deficitInterets = Math.max(interets - loyer, 0);
        const deficitAutresCharges = deficitTotal - deficitInterets;
        const montantImpute = imputationAutorisee ? Math.min(deficitAutresCharges, plafondImputation) : 0;
        const montantReporte = deficitTotal - montantImpute;
        if (montantReporte > 0.01) stockDeficitReportable.push({ montant: montantReporte, anneeOrigine: an });

        revenuImposable = 0;
        // Économie d'impôt réelle et immédiate sur le foyer (réduit l'IR dû sur les autres revenus,
        // jamais les prélèvements sociaux) : représentée ici par un impôt négatif (crédit).
        impot = -(montantImpute * p.tauxImpot);
      } else {
        // Résultat positif : on impute d'abord le stock de déficits reportés (FIFO, les plus
        // anciens d'abord car ce sont eux qui expirent le plus tôt), dans la limite du résultat.
        let resultatRestant = resultatAvantReport;
        for (const entree of stockDeficitReportable) {
          if (resultatRestant <= 0) break;
          const imputable = Math.min(entree.montant, resultatRestant);
          entree.montant -= imputable;
          resultatRestant -= imputable;
        }
        stockDeficitReportable = stockDeficitReportable.filter((e) => e.montant > 0.01);
        revenuImposable = resultatRestant;
        impot = revenuImposable * (p.tauxImpot + tauxPSnue);
      }
      cashFlow = loyer - autresCharges - impot - annuiteCredit;
    }

    flux.push(cashFlow);
    cashFlowCumuleProgressif += cashFlow;

    // Base de valorisation = prix d'achat + travaux réels (la remise en état fait partie de la valeur
    // réelle du bien dès l'achat, indépendamment du forfait fiscal éventuellement retenu pour la PV).
    const valeurBienAn = (p.prixBien + p.travauxInitiaux) * Math.pow(1 + p.tauxProgressionValeur, an);
    const equiteAnBrute = valeurBienAn - dataCredit.capitalRestant;
    // PV fiscale : valeur de cession (marché réel) - prix d'acquisition majoré (frais+travaux retenus)
    // Les travaux peuvent apparaître avec des montants différents dans les deux termes :
    // dans la cession, ils ont valorisé le bien au taux du marché ;
    // dans le prix majoré, on retient le plus avantageux entre réel et forfait fiscal.
    const prixAcquisitionMajoreAn = p.prixBien + fraisRetenusPourPV + travauxRetenusPourPV(an);
    const plusValueBruteAn = Math.max(valeurBienAn - prixAcquisitionMajoreAn, 0);
    const fiscaliteAn = calculerImpotPlusValueImmo(plusValueBruteAn, an, p.baremePlusValueIR, p.tauxIRplusvalue || 0.19, p.tauxPSplusvalue || 0.172);
    const equiteAn = equiteAnBrute - fiscaliteAn.total;

    // Stock de déficit reporté restant en fin d'année, exposé pour l'affichage/export (PDF, etc.) —
    // permet de vérifier pourquoi l'impôt reste nul alors que des amortissements/charges ont été
    // déduits : ils ne sont pas "perdus", ils restent en attente d'imputation future. Ajouté le 16/07/2026.
    const deficitReporteFoncier = stockDeficitReportable.reduce((s, e) => s + e.montant, 0);
    const deficitReporteLmnp = stockDeficitLmnp.reduce((s, e) => s + e.montant, 0);

    detailAnnuel.push({
      an, loyer, charges, taxe, impot, annuiteCredit,
      capitalRestant: dataCredit.capitalRestant, cashFlow, equiteAn,
      deficitReporteFoncier, deficitReporteLmnp,
    });
    // Gain net par rapport à la mise, à date t = -mise + cash-flows cumulés + équité actuelle dans le bien
    // (cohérent avec valeurFinaleNette = -mise + cashFlows + équité finale, calculé plus bas)
    const valeurNetteAn = -miseInitiale + cashFlowCumuleProgressif + equiteAn;
    courbeValeurNette.push({ an, valeur: valeurNetteAn });
  }

  const valeurFutureBien = (p.prixBien + p.travauxInitiaux) * Math.pow(1 + p.tauxProgressionValeur, dureeAnalyse);
  const capitalRestantFinal = parAn[dureeAnalyse - 1]?.capitalRestant || 0;
  const equiteNetteBrute = valeurFutureBien - capitalRestantFinal;

  const prixAcquisitionMajore = p.prixBien + fraisRetenusPourPV + travauxRetenusPourPV(dureeAnalyse);
  let plusValueBrute, fiscalitePV;

  if (p.regimeFiscal === "lmnp-reel") {
    // LMNP Réel (réforme LF2025, art. 84, en vigueur depuis le 15/02/2025) : seul l'amortissement
    // du BÂTI est réintégré dans la plus-value. Sont explicitement EXCLUS de la réintégration :
    // - l'amortissement des travaux de construction/reconstruction/agrandissement/amélioration
    //   (exclusion prévue par l'article 84 lui-même : ces amortissements ne minorent pas le prix
    //   d'acquisition retenu pour le calcul de la plus-value) ;
    // - le mobilier (doctrine administrative — composant non immobilier).
    // Les majorations forfaitaires 7,5%/15% restent utilisables normalement (comparées au réel),
    // calculées sur le prix d'acquisition initial. Corrigé le 13/07/2026.
    const valeurAmortBien = p.prixBien * (1 - (p.quotepartTerrain || 0));
    const amortCumulReintegre = Math.min(dureeAnalyse, p.dureAmortBien || 30) * (valeurAmortBien / (p.dureAmortBien || 30));
    const prixAcquisitionFiscalReduit = prixAcquisitionMajore - amortCumulReintegre;
    plusValueBrute = Math.max(valeurFutureBien - prixAcquisitionFiscalReduit, 0);
    fiscalitePV = calculerImpotPlusValueImmo(plusValueBrute, dureeAnalyse, p.baremePlusValueIR, p.tauxIRplusvalue || 0.19, p.tauxPSplusvalue || 0.172);
  } else {
    plusValueBrute = Math.max(valeurFutureBien - prixAcquisitionMajore, 0);
    fiscalitePV = calculerImpotPlusValueImmo(plusValueBrute, dureeAnalyse, p.baremePlusValueIR, p.tauxIRplusvalue || 0.19, p.tauxPSplusvalue || 0.172);
  }

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
    valeurFutureBrute, plusValue, impotPlusValue,
    valeurFutureNette, cashFlowCumule, valeurFinaleNette,
    gainNet,
    courbeValeurNette
  };
}

// Calcule l'impôt de sortie sur les gains d'une assurance-vie (rachat total en une fois),
// selon le régime des versements post-27/09/2017.
// Taux 2026 suite à la hausse de la CSG (LFSS 2026, loi n° 2025-1403 du 30/12/2025) :
// Avant 8 ans : PFU 31,4 % (12,8 % IR + 18,6 % PS), sans abattement.
// Après 8 ans : 7,5 % IR (au-delà d'un abattement annuel) + 18,6 % PS sur la totalité des gains.
function calculerImpotAssuranceVie(gains, dureeDetention, abattement) {
  if (gains <= 0) return { impot: 0, abattementApplique: 0, impotIR: 0, impotPS: 0 };

  const impotPS = gains * 0.186; // PS 2026 : 18,6% (hausse de 1,4 pt vs 17,2% jusqu'en 2025)

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
  // Frais sur versement (frais d'entrée) : prélevés immédiatement sur le versement initial,
  // avant toute capitalisation. Très variables selon les contrats — environ 40 % des contrats
  // (essentiellement en ligne) n'en appliquent aucun, un tiers se situent entre 0,1 % et 2 %,
  // et certains contrats bancaires traditionnels facturent encore 3 % à plus de 4 %.
  // Ajouté le 16/07/2026.
  const fraisEntreePct = p.fraisEntree || 0;
  const montantFraisEntree = p.versementInitial * fraisEntreePct;
  // Capital réellement investi et mis en capitalisation, net des frais d'entrée.
  const capitalInvesti = p.versementInitial - montantFraisEntree;

  const rendementNetFrais = p.rendementAnnuelBrut - p.fraisGestionAnnuels;
  const detailAnnuel = [];
  // À l'an 0, les frais d'entrée sont une perte immédiate et certaine (contrairement au reste de
  // la mise, qui demeure investie) : on l'expose dès le premier point de la courbe plutôt que de
  // partir de 0, pour un graphique de comparaison fidèle dès le départ.
  const courbeValeurNette = [{ an: 0, valeur: -montantFraisEntree }];
  let valeurContrat = capitalInvesti;

  for (let an = 1; an <= dureeAnalyse; an++) {
    valeurContrat *= (1 + rendementNetFrais);
    // Les gains taxables se calculent, comme en pratique fiscale, par rapport au total des
    // primes VERSÉES par le souscripteur (montant brut, frais d'entrée compris) et non par
    // rapport au seul capital investi : les frais d'entrée réduisent donc le gain final réalisé,
    // mais n'ouvrent droit à aucune déduction fiscale supplémentaire.
    const gainsLatents = valeurContrat - p.versementInitial;
    const { impot } = calculerImpotAssuranceVie(gainsLatents, an, p.abattementAnnuel);
    detailAnnuel.push({ an, valeurContrat, gainsLatents, impotSiSortie: impot });
    // Gain net par rapport à la mise, à date t = gain latent net d'impôt (la mise, hors frais
    // d'entrée déjà comptabilisés à l'an 0, reste intégralement dans le contrat)
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
    fraisEntreePct, montantFraisEntree, capitalInvesti,
    valeurFinaleBrute,
    gainsFinaux,
    impotFinal, impotIR, impotPS,
    abattementApplique,
    valeurFinaleNette,
    gainNet: valeurFinaleNette - p.versementInitial,
    cashFlowCumule: -p.versementInitial, // aucun cash-flow intermédiaire perçu, tout est capitalisé jusqu'à la sortie
  };
}

// Valeur Actuelle Nette des flux à un taux d'actualisation donné (ex: taux sans risque choisi par l'utilisateur).
// Complémentaire au TRI : exprime en euros la création de valeur au taux d'exigence retenu,
// plutôt que de chercher le taux qui annule la VAN (ce qu'est justement le TRI).
function calculerVAN(flux, tauxActualisation) {
  let van = 0;
  for (let t = 0; t < flux.length; t++) {
    van += flux[t] / Math.pow(1 + tauxActualisation, t);
  }
  return van;
}

// Valeur future = la VAN capitalisée jusqu'à l'horizon (mathématiquement identique à la somme
// de chaque flux capitalisé individuellement jusqu'à la même date).
function calculerValeurFutureVAN(van, tauxActualisation, dureeAnalyse) {
  return van * Math.pow(1 + tauxActualisation, dureeAnalyse);
}

function calculerTRI(flux, guess = 0.08) {
  // Cas particulier à 2 flux (un seul investissement, un seul retour) : solution analytique exacte,
  // Newton-Raphson peut diverger sur un cas aussi dégénéré faute de courbure suffisante.
  const nonZero = flux.map((v, i) => [i, v]).filter(([, v]) => v !== 0);
  if (nonZero.length === 2 && nonZero[0][1] < 0 && nonZero[1][1] > 0) {
    const [t0, v0] = nonZero[0];
    const [t1, v1] = nonZero[1];
    const n = t1 - t0;
    if (n > 0) return Math.pow(v1 / -v0, 1 / n) - 1;
  }

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
    // Garde-fou : un TRI annuel hors de [-99%, +500%] signale une divergence numérique, pas un résultat
    // économiquement plausible pour ce type de simulation ; on arrête plutôt que de renvoyer une valeur absurde.
    if (nouveauTaux < -0.99 || nouveauTaux > 5) return null;
    if (Math.abs(nouveauTaux - taux) < 1e-9) return nouveauTaux;
    taux = nouveauTaux;
  }
  return taux;
}
