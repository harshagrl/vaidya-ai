const mongoose = require('mongoose');
const HealthRecord = require('../models/HealthRecord');
const FamilyMember = require('../models/FamilyMember');
const { checkInteractions } = require('../services/interactionService');

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

    res.status(201).json({
      success: true,
      message: 'Health record saved successfully.',
      data: newRecord
    });
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

module.exports = { createRecord, getRecords };
