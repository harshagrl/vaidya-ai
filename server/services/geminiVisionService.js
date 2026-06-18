const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const PRESCRIPTION_PROMPT = `
You are a highly precise medical extraction AI.
Analyze the provided prescription image. Extract the following fields into structured JSON:
{
  "prescribedDate": "ISO date string or UNREADABLE",
  "prescribingDoctor": "Doctor name or UNREADABLE",
  "medicines": [
    {
      "medicineName": "Name or UNREADABLE",
      "dosage": "e.g., 500mg, or UNREADABLE",
      "frequency": "e.g., 1-0-1, or UNREADABLE",
      "duration": "e.g., 5 days, or UNREADABLE",
      "doctorNotes": "Any specific instructions, or UNREADABLE",
      "confidenceScores": {
        "medicineName": 0.95,
        "dosage": 0.80
      }
    }
  ]
}
If a field is genuinely not present (e.g., no doctor notes), set its value to null.
If a field is present but illegible due to handwriting/blur, set its value to exactly the string "UNREADABLE".
Ensure confidenceScores are floats between 0.0 and 1.0 for each string field in the medicine.
Do not output any markdown formatting, only the raw JSON block.
`;

const LAB_REPORT_PROMPT = `
You are a highly precise medical extraction AI.
Analyze the provided lab report image or PDF. Extract the following fields into structured JSON:
{
  "testDate": "ISO date string or UNREADABLE",
  "labTests": [
    {
      "testName": "Name or UNREADABLE",
      "value": "Value or UNREADABLE",
      "unit": "e.g., mg/dL, or UNREADABLE",
      "referenceRange": "e.g., 70-100, or UNREADABLE",
      "isAbnormalFlag": true/false,
      "confidenceScores": {
        "testName": 0.95,
        "value": 0.99
      }
    }
  ]
}
If a field is genuinely not present, set its value to null.
If a field is present but illegible, set its value to exactly the string "UNREADABLE".
Set isAbnormalFlag to true if the value falls outside the reference range, false otherwise.
Ensure confidenceScores are floats between 0.0 and 1.0 for each field in the labTest.
Do not output any markdown formatting, only the raw JSON block.
`;

/**
 * Extracts structured JSON data from a document using Gemini Vision.
 * @param {string} cloudinaryUrl - URL of the uploaded file on Cloudinary
 * @param {string} type - 'PRESCRIPTION' or 'LAB_REPORT'
 * @returns {Object} The parsed JSON object
 */
async function extractDataFromDocument(cloudinaryUrl, type) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

    // Fetch the file buffer from the Cloudinary URL
    const response = await fetch(cloudinaryUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Infer mime type from extension
    const ext = cloudinaryUrl.split('.').pop().toLowerCase();
    const mimeType = ext === 'pdf' ? 'application/pdf' : (ext === 'png' ? 'image/png' : (ext === 'webp' ? 'image/webp' : 'image/jpeg'));

    const prompt = type === 'PRESCRIPTION' ? PRESCRIPTION_PROMPT : LAB_REPORT_PROMPT;

    const filePart = {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType
      }
    };

    const result = await model.generateContent([prompt, filePart]);
    const responseText = result.response.text();
    
    // Clean up potential markdown wrappers (e.g., ```json ... ```)
    const jsonString = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Gemini Vision Extraction Error:', error);
    throw new Error('Failed to extract data from document');
  }
}

module.exports = { extractDataFromDocument };
