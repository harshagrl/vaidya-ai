const { extractDataFromDocument } = require('../services/geminiVisionService');
const { cloudinary } = require('../utils/cloudinary');

/**
 * Controller for POST /api/upload/parse
 * Handles the initial upload to Cloudinary, enforces type-specific file extensions,
 * and calls Gemini Vision for extraction. Returns the parsed JSON without saving to DB.
 */
async function parseDocument(req, res) {
  try {
    const { type } = req.body;
    const file = req.file;

    if (!type || !['PRESCRIPTION', 'LAB_REPORT'].includes(type)) {
      // If validation fails after upload, clean up the orphaned file
      if (file && file.filename) {
        try {
          // multer-storage-cloudinary stores the Cloudinary public_id in file.filename
          await cloudinary.uploader.destroy(file.filename);
        } catch (cleanupErr) {
          console.warn('Failed to clean up orphaned file after type validation:', cleanupErr);
        }
      }
      return res.status(400).json({ message: 'Invalid or missing document type. Must be PRESCRIPTION or LAB_REPORT.' });
    }

    if (!file) {
      return res.status(400).json({ message: 'No document uploaded.' });
    }

    const cloudinaryUrl = file.path; // Set by multer-storage-cloudinary

    // Enforce file extension constraints at the controller level using mimetype from multer.
    // Cloudinary natively allows PDFs in our multer config since Lab Reports need them.
    // We must reject PDFs explicitly here if the user claims it's a PRESCRIPTION,
    // and clean up the already-uploaded file from Cloudinary so it doesn't become orphaned.
    if (type === 'PRESCRIPTION' && file.mimetype === 'application/pdf') {
      try {
        await cloudinary.uploader.destroy(file.filename);
      } catch (cleanupErr) {
        console.warn('Failed to clean up orphaned PDF file:', cleanupErr);
      }
      return res.status(400).json({ 
        message: 'Prescriptions must be images (JPG/PNG/WEBP). PDF is only supported for Lab Reports.' 
      });
    }

    // Call Gemini Vision Service, passing mimetype directly instead of sniffing the URL
    const extractedData = await extractDataFromDocument(cloudinaryUrl, file.mimetype, type);

    // Return the successful extraction.  
    // We attach the cloudinaryUrl so the frontend can display it in the confirmation UI
    // and eventually send it back when saving the final CONFIRMED record.
    return res.status(200).json({
      success: true,
      sourceImageUrl: cloudinaryUrl,
      type: type,
      extractedData: extractedData
    });

  } catch (error) {
    console.error('Parse Document Error:', error);

    // Differentiate between our explicit MALFORMED errors and general failures
    if (error.message && (error.message.startsWith('MALFORMED_AI_RESPONSE') || error.message.startsWith('MALFORMED_AI_SHAPE'))) {
      return res.status(422).json({
        success: false,
        message: 'The AI could not properly extract data from this document. Please review the image clarity or enter manually.',
        errorType: 'AI_EXTRACTION_FAILED'
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while processing the document.' 
    });
  }
}

module.exports = { parseDocument };
