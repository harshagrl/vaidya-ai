require('dotenv').config();
const mongoose = require('mongoose');
const MedicineKB = require('../models/MedicineKB');
const InteractionsKB = require('../models/InteractionsKB');
const connectDB = require('../config/db');
const { generateEmbedding } = require('../services/embeddingService');

// MOCK DATASET (In a real scenario, this would be read from a CSV or JSON file)
const rawIndianMedicines = [
  { brandName: 'Dolo 650', composition: 'Paracetamol', uses: 'Fever' },
  { brandName: 'Crocin', composition: 'Paracetamol', uses: 'Pain' },
  { brandName: 'Pan-D', composition: 'Pantoprazole + Domperidone', uses: 'Acidity' },
  { brandName: 'UnknownMed', composition: '', uses: 'Unknown' }, // Should be excluded
  { brandName: 'Dolo 650', composition: 'Paracetamol', uses: 'Fever' } // Duplicate
];

const rawInteractions = [
  { saltA: 'Paracetamol', saltB: 'Warfarin', severity: 'Severe/Contraindicated', desc: 'Increases bleeding risk' },
];

async function ingestData() {
  await connectDB();
  console.log('Starting ingestion...');
  console.warn('\n=============================================================');
  console.warn('WARNING: Using MOCK dataset for MedicineKB and InteractionsKB.');
  console.warn('Replace with real Kaggle CSV/dataset file before considering');
  console.warn('this ingestion script production-ready!');
  console.warn('=============================================================\n');

  let excludedCount = 0;
  let deduplicatedCount = 0;
  let embeddingFailedCount = 0;
  const processedBrands = new Set();

  const validMedicines = [];

  // Normalization and Deduplication Logic
  for (const item of rawIndianMedicines) {
    // Exclude if generic composition is missing
    if (!item.composition || item.composition.trim() === '') {
      console.warn(`[EXCLUDED] Brand '${item.brandName}' missing generic composition.`);
      excludedCount++;
      continue;
    }

    const normalizedBrand = item.brandName.trim().toUpperCase();
    
    // Deduplication
    if (processedBrands.has(normalizedBrand)) {
      deduplicatedCount++;
      continue;
    }

    processedBrands.add(normalizedBrand);

    /* 
     * TODO (Real Dataset Integration): Parsing Edge Cases to handle:
     * 1. Inconsistent separators: e.g., "+", " + ", "and", ",". (Currently splitting naively by "+").
     * 2. Embedded dosages: e.g., "Paracetamol 500mg + Domperidone 10mg". We need to strip " 500mg" 
     *    so the array only stores the pure salt name "Paracetamol" for clean interaction matching.
     * 3. Normalization: Trim whitespace and consistent casing (e.g., uppercase all salts).
     */
    const rawSalts = item.composition.split('+');
    const cleanedSalts = rawSalts.map(salt => salt.trim().toUpperCase()).filter(salt => salt.length > 0);

    const chunkText = `Medicine brand: ${item.brandName.trim()}. Generic composition (salts): ${cleanedSalts.join(', ')}. Typical uses: ${item.uses || 'Unknown'}.`;
    let embedding = [];
    try {
      embedding = await generateEmbedding(chunkText);
    } catch (e) {
      console.warn(`[EXCLUDED] Warning: Could not generate embedding for ${item.brandName}.`);
    }

    if (!embedding || embedding.length === 0) {
      embeddingFailedCount++;
      continue;
    }

    validMedicines.push({
      brandName: item.brandName.trim(),
      genericComposition: cleanedSalts,
      uses: item.uses,
      embedding
    });
  }

  console.log(`\n--- Ingestion Report ---`);
  console.log(`Total Raw Medicines: ${rawIndianMedicines.length}`);
  console.log(`Excluded (Missing Composition): ${excludedCount}`);
  console.log(`Deduplicated: ${deduplicatedCount}`);
  console.log(`Excluded (Embedding Failed): ${embeddingFailedCount}`);
  console.log(`Valid Medicines to Insert: ${validMedicines.length}`);
  console.log(`------------------------\n`);

  try {
    await MedicineKB.deleteMany({});
    await InteractionsKB.deleteMany({});
    console.log('Cleared existing KB collections.');

    await MedicineKB.insertMany(validMedicines);
    console.log('Inserted MedicineKB data.');

    const formattedInteractions = rawInteractions.map(i => ({
      genericSaltA: i.saltA,
      genericSaltB: i.saltB,
      severity: i.severity,
      description: i.desc
    }));
    await InteractionsKB.insertMany(formattedInteractions);
    console.log('Inserted InteractionsKB data.');

    console.log('Ingestion completed successfully.');
  } catch (err) {
    console.error('Error during ingestion:', err);
  } finally {
    process.exit();
  }
}

ingestData();
