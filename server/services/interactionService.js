const MedicineKB = require('../models/MedicineKB');
const InteractionsKB = require('../models/InteractionsKB');
const HealthRecord = require('../models/HealthRecord');

/**
 * Calculates active medicines for a profile based on prescribedDate + duration.
 * Returns an array of active medicine objects: { medicineName, recordId }
 */
async function getActiveMedicines(profileId, referenceDate = new Date()) {
  const records = await HealthRecord.find({ 
    profileId, 
    type: 'PRESCRIPTION' 
  });

  const activeMedicines = [];

  for (const record of records) {
    if (!record.medicines || record.medicines.length === 0) continue;
    
    // Parse prescribedDate (default to createdAt if missing)
    let startDate = record.prescribedDate ? new Date(record.prescribedDate) : new Date(record.createdAt);
    if (isNaN(startDate.getTime())) startDate = new Date(record.createdAt);

    for (const med of record.medicines) {
      if (!med.medicineName || med.medicineName === 'UNREADABLE') continue;

      let durationDays = 30; // Default fallback for Assumed Active
      if (med.duration && med.duration !== 'UNREADABLE') {
        const durStr = med.duration.toLowerCase();
        const numMatch = durStr.match(/\d+/);
        if (numMatch) {
          const num = parseInt(numMatch[0], 10);
          if (durStr.includes('week')) {
            durationDays = num * 7;
          } else if (durStr.includes('month')) {
            durationDays = num * 30;
          } else {
            durationDays = num;
          }
        }
      }

      const endDate = new Date(startDate.getTime());
      endDate.setDate(endDate.getDate() + durationDays);

      if (endDate >= referenceDate) {
        activeMedicines.push({
          medicineName: med.medicineName,
          recordId: record._id,
          endDate
        });
      }
    }
  }

  return activeMedicines;
}

/**
 * Resolves a medicine brand name to its generic salts via MedicineKB
 * Expects normalized match (case-insensitive)
 */
async function resolveSalts(medicineName) {
  // Try exact case-insensitive match first
  const med = await MedicineKB.findOne({ brandName: new RegExp('^' + medicineName.trim() + '$', 'i') });
  if (med && med.genericComposition && med.genericComposition.length > 0) {
    return { salts: med.genericComposition.map(s => s.trim().toUpperCase()), resolved: true };
  }
  // If not found in KB, log it and fallback to assuming the name itself might be the salt
  console.warn(`[Interaction Check] Medicine not found in KB: ${medicineName}`);
  return { salts: [medicineName.trim().toUpperCase()], resolved: false };
}

/**
 * Checks a pair of salts against InteractionsKB.
 * Handles unordered checking using $or.
 */
async function checkSaltPair(saltA, saltB) {
  const interaction = await InteractionsKB.findOne({
    $or: [
      { genericSaltA: saltA, genericSaltB: saltB },
      { genericSaltA: saltB, genericSaltB: saltA }
    ]
  });
  return interaction;
}

/**
 * Main function: checks a list of new medicines against active profile medicines
 * Returns an array of interaction objects:
 * { medicineA, medicineB, severity, description, saltA, saltB }
 */
async function checkInteractions(profileId, newMedicines) {
  const activeMedicines = await getActiveMedicines(profileId);
  const interactions = [];

  const validNew = newMedicines.filter(m => m.medicineName && m.medicineName !== 'UNREADABLE');
  const validActive = activeMedicines.filter(m => m.medicineName && m.medicineName !== 'UNREADABLE');

  const uncheckedMedicines = new Set();

  // Resolve salts
  const newSaltsMap = {};
  for (const med of validNew) {
    const res = await resolveSalts(med.medicineName);
    newSaltsMap[med.medicineName] = res.salts;
    if (!res.resolved) uncheckedMedicines.add(med.medicineName);
  }

  const activeSaltsMap = {};
  for (const med of validActive) {
    const res = await resolveSalts(med.medicineName);
    activeSaltsMap[med.medicineName] = res.salts;
    if (!res.resolved) uncheckedMedicines.add(med.medicineName);
  }

  // Helper to check and push
  const evaluatePair = async (medA, medB, saltsA, saltsB) => {
    // Avoid self-interaction
    if (medA.toUpperCase() === medB.toUpperCase()) return;

    for (const saltA of saltsA) {
      for (const saltB of saltsB) {
        if (saltA === saltB) continue; 
        
        const interaction = await checkSaltPair(saltA, saltB);
        if (interaction) {
          // Prevent duplicates
          const exists = interactions.some(i => 
            (i.medicineA === medA && i.medicineB === medB) ||
            (i.medicineA === medB && i.medicineB === medA)
          );
          if (!exists) {
            interactions.push({
              medicineA: medA, 
              medicineB: medB, 
              saltA: interaction.genericSaltA,
              saltB: interaction.genericSaltB,
              severity: interaction.severity,
              description: interaction.description
            });
          }
        }
      }
    }
  };

  // 1. Check New vs Active
  for (const nMed of validNew) {
    const nSalts = newSaltsMap[nMed.medicineName];
    for (const aMed of validActive) {
      const aSalts = activeSaltsMap[aMed.medicineName];
      await evaluatePair(nMed.medicineName, aMed.medicineName, nSalts, aSalts);
    }
  }

  // 2. Check New vs New (internal interactions in the same prescription)
  for (let i = 0; i < validNew.length; i++) {
    for (let j = i + 1; j < validNew.length; j++) {
      const medA = validNew[i].medicineName;
      const medB = validNew[j].medicineName;
      await evaluatePair(medA, medB, newSaltsMap[medA], newSaltsMap[medB]);
    }
  }

  return { interactions, uncheckedMedicines: Array.from(uncheckedMedicines) };
}

module.exports = {
  getActiveMedicines,
  resolveSalts,
  checkSaltPair,
  checkInteractions
};
