const mongoose = require('mongoose');
const HealthRecord = require('../models/HealthRecord');
const FamilyMember = require('../models/FamilyMember');

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

      recordData.prescribedDate = prescribedDate;
      recordData.prescribingDoctor = prescribingDoctor;
      recordData.medicines = medicines;
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

module.exports = { createRecord };
