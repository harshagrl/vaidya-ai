const mongoose = require('mongoose');
const HealthRecord = require('../models/HealthRecord');
const FamilyMember = require('../models/FamilyMember');
const VectorChunk = require('../models/VectorChunk');
const { checkInteractions } = require('../services/interactionService');
const { generateEmbedding } = require('../services/embeddingService');

/**
 * Controller for POST /api/profiles/:profileId/records
 * Saves a finalized, user-confirmed health record to the database.
 */
async function createRecord(req, res) {
  try {
    const { profileId } = req.params;
    const { type, sourceImageUrl, prescribedDate, prescribingDoctor, medicines, testDate, labTests } = req.body;

    // Validate ObjectId format before querying DB
    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: 'Invalid profile ID format.' });
    }

    // Verify the profile exists and belongs to the authenticated user
    const profile = await FamilyMember.findById(profileId);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    if (profile.accountId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to add records to this profile.' });
    }

    // Prepare the record object based on the schema
    const recordData = {
      profileId,
      type,
      sourceImageUrl,
    };

    if (type === 'PRESCRIPTION') {
      // Controller-level explicit check for empty subdocuments
      if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
        return res.status(400).json({ message: 'A PRESCRIPTION must include at least one medicine.' });
      }
      for (const med of medicines) {
        if (!med.medicineName || med.medicineName.trim() === '') {
          return res.status(400).json({ message: 'Every medicine must have a medicineName.' });
        }
      }

      // Interaction checking logic
      const { interactions, uncheckedMedicines } = await checkInteractions(profileId, medicines);
      const severeInteractions = interactions.filter(i => i.severity === 'Severe/Contraindicated');

      if (severeInteractions.length > 0) {
        // Validate acknowledgedInteractions bypass
        const { acknowledgedInteractions } = req.body;
        
        let allAcknowledged = false;
        if (acknowledgedInteractions && Array.isArray(acknowledgedInteractions)) {
          allAcknowledged = severeInteractions.every(si => {
            return acknowledgedInteractions.some(ai => 
              ai.severity === 'Severe/Contraindicated' &&
              ((ai.medicineA === si.medicineA && ai.medicineB === si.medicineB) ||
               (ai.medicineA === si.medicineB && ai.medicineB === si.medicineA))
            );
          });
        }

        if (!allAcknowledged) {
          return res.status(409).json({
            success: false,
            message: 'Severe drug interactions detected. Please acknowledge the warnings to proceed.',
            interactions,
            uncheckedMedicines
          });
        }
      }

      recordData.prescribedDate = prescribedDate;
      recordData.prescribingDoctor = prescribingDoctor;
      recordData.medicines = medicines;
      recordData.interactions = interactions;
      recordData.uncheckedMedicines = uncheckedMedicines;
    } else if (type === 'LAB_REPORT') {
      // Controller-level explicit check for empty subdocuments
      if (!labTests || !Array.isArray(labTests) || labTests.length === 0) {
        return res.status(400).json({ message: 'A LAB_REPORT must include at least one lab test.' });
      }
      for (const test of labTests) {
        if (!test.testName || test.testName.trim() === '' || !test.value || test.value.trim() === '') {
          return res.status(400).json({ message: 'Every lab test must have a testName and a value.' });
        }
      }

      recordData.testDate = testDate;
      recordData.labTests = labTests;
    } else {
      return res.status(400).json({ message: 'Invalid record type. Must be PRESCRIPTION or LAB_REPORT.' });
    }

    // Instantiate and save. Mongoose pre-save hooks and required validations will run here.
    const newRecord = new HealthRecord(recordData);
    await newRecord.save();

    // Send response immediately to keep the save operation fast
    res.status(201).json({
      success: true,
      message: 'Health record saved successfully. Processing embeddings in the background.',
      data: newRecord
    });

    // Fire-and-forget: Asynchronously generate and save VectorChunks
    (async () => {
      try {
        const chunksToSave = [];
        const profileName = profile.firstName + (profile.lastName ? ' ' + profile.lastName : '');
        const eventDateStr = type === 'PRESCRIPTION' 
          ? (prescribedDate ? new Date(prescribedDate).toDateString() : 'an unknown date')
          : (testDate ? new Date(testDate).toDateString() : 'an unknown date');

        if (type === 'PRESCRIPTION') {
          const docName = prescribingDoctor || 'a doctor';
          for (const med of medicines) {
            const chunkText = `On ${eventDateStr}, ${profileName} was prescribed ${med.medicineName} by ${docName}. ` +
              `Dosage: ${med.dosage && med.dosage !== 'UNREADABLE' ? med.dosage : 'Not specified'}, ` +
              `Frequency: ${med.frequency && med.frequency !== 'UNREADABLE' ? med.frequency : 'Not specified'}, ` +
              `Duration: ${med.duration && med.duration !== 'UNREADABLE' ? med.duration : 'Not specified'}. ` +
              `Instructions: ${med.doctorNotes && med.doctorNotes !== 'UNREADABLE' ? med.doctorNotes : 'None'}.`;
            
            const embedding = await generateEmbedding(chunkText);
            chunksToSave.push({
              profileId,
              recordId: newRecord._id,
              text: chunkText,
              embedding,
              metadata: { type: 'PRESCRIPTION', sourceImageUrl }
            });
          }
        } else if (type === 'LAB_REPORT') {
          for (const test of labTests) {
            const abnormalStr = test.isAbnormalFlag ? 'This result was flagged as abnormal. ' : '';
            const chunkText = `On ${eventDateStr}, ${profileName} had a lab test for ${test.testName}. ` +
              `The result was ${test.value && test.value !== 'UNREADABLE' ? test.value : 'unknown'} ${test.unit && test.unit !== 'UNREADABLE' ? test.unit : ''}. ` +
              `The reference range is ${test.referenceRange && test.referenceRange !== 'UNREADABLE' ? test.referenceRange : 'Not specified'}. ${abnormalStr}`;
            
            const embedding = await generateEmbedding(chunkText);
            chunksToSave.push({
              profileId,
              recordId: newRecord._id,
              text: chunkText,
              embedding,
              metadata: { type: 'LAB_REPORT', sourceImageUrl }
            });
          }
        }

        if (chunksToSave.length > 0) {
          await VectorChunk.insertMany(chunksToSave);
          // Mark as successfully embedded for durability tracking
          newRecord.chunksGenerated = true;
          await newRecord.save();
        } else {
          // If there were no chunks to save, consider it generated
          newRecord.chunksGenerated = true;
          await newRecord.save();
        }
      } catch (embeddingError) {
        console.error('Background Vector Chunk Generation Failed:', embeddingError);
        // chunksGenerated remains false on the record
      }
    })();
  } catch (error) {
    console.error('Create Record Error:', error);
    
    // Check for our custom pre-save hook validation or Mongoose Schema validation
    if (error.isRecordValidation || error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'An error occurred while saving the health record.'
    });
  }
}

/**
 * Controller for GET /api/profiles/:profileId/records
 * Fetches health records for a profile with optional type and date filtering.
 */
async function getRecords(req, res) {
  try {
    const { profileId } = req.params;
    const { type, startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: 'Invalid profile ID format.' });
    }

    const profile = await FamilyMember.findById(profileId);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found.' });
    }

    if (profile.accountId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view records for this profile.' });
    }

    const query = { profileId };

    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      const dateCondition = {};
      if (startDate) dateCondition.$gte = new Date(startDate);
      if (endDate) dateCondition.$lte = new Date(endDate);

      // Additive date filtering strictly to the medical event date
      // We only fallback to createdAt if the medical event dates are explicitly missing
      query.$or = [
        { prescribedDate: dateCondition },
        { testDate: dateCondition },
        { prescribedDate: { $exists: false }, testDate: { $exists: false }, createdAt: dateCondition }
      ];
    }

    // Sort descending so the timeline is chronological (newest first)
    const records = await HealthRecord.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('Get Records Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching records'
    });
  }
}

/**
 * Controller for GET /api/profiles/:profileId/records/:recordId
 * Fetches a single health record for citation viewing.
 */
async function getRecordById(req, res) {
  try {
    const { profileId, recordId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(profileId) || !mongoose.Types.ObjectId.isValid(recordId)) {
      return res.status(400).json({ message: 'Invalid profile or record ID format.' });
    }

    const profile = await FamilyMember.findById(profileId);
    if (!profile) return res.status(404).json({ message: 'Profile not found.' });

    if (profile.accountId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view records for this profile.' });
    }

    const record = await HealthRecord.findOne({ _id: recordId, profileId });
    if (!record) return res.status(404).json({ message: 'Health record not found.' });

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    console.error('Get Record By ID Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching record details'
    });
  }
}

module.exports = { createRecord, getRecords, getRecordById };
