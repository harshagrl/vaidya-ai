const { GoogleGenAI } = require('@google/genai');

// Lazy-initialized singleton — created on first call, not at require() time.
let ai = null;

function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Ensure dotenv has loaded before calling vision extraction.'
      );
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

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
        "dosage": 0.80,
        "frequency": 0.90,
        "duration": 0.85,
        "doctorNotes": 0.70
      }
    }
  ]
}

Rules:
1. If a field is genuinely not present (e.g., no doctor notes), set its value to null and set its corresponding confidenceScore to 0.0.
2. If a field is present but illegible due to handwriting/blur, set its value to exactly the string "UNREADABLE" and set its corresponding confidenceScore to 0.0.
3. For successfully extracted fields, confidenceScores must be floats between 0.1 and 1.0.
4. Do not output any markdown formatting, only the raw JSON block.
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
      "isAbnormalFlag": true or false,
      "confidenceScores": {
        "testName": 0.95,
        "value": 0.99,
        "unit": 0.98,
        "referenceRange": 0.90
      }
    }
  ]
}

Rules:
1. If a field is genuinely not present, set its value to null and set its corresponding confidenceScore to 0.0.
2. If a field is present but illegible, set its value to exactly the string "UNREADABLE" and set its corresponding confidenceScore to 0.0.
3. For successfully extracted fields, confidenceScores must be floats between 0.1 and 1.0.
4. Set isAbnormalFlag to true if the value falls outside the reference range, false otherwise.
5. Do not output any markdown formatting, only the raw JSON block.
`;

/**
 * Validates the basic shape of the parsed JSON from Gemini
 */
function validateShape(parsedData, type) {
  if (!parsedData || typeof parsedData !== 'object') {
    throw new Error('MALFORMED_AI_SHAPE: Output is not a valid JSON object');
  }

  if (type === 'PRESCRIPTION') {
    if (!Array.isArray(parsedData.medicines)) {
      throw new Error('MALFORMED_AI_SHAPE: Missing or invalid "medicines" array');
    }
  } else if (type === 'LAB_REPORT') {
    if (!Array.isArray(parsedData.labTests)) {
      throw new Error('MALFORMED_AI_SHAPE: Missing or invalid "labTests" array');
    }
  }
}

/**
 * Internal method to perform a single extraction attempt
 */
async function attemptExtraction(cloudinaryUrl, mimeType, type) {
  const client = getAI();

  // Fetch the file buffer from the Cloudinary URL
  const response = await fetch(cloudinaryUrl);
  if (!response.ok) throw new Error('Failed to fetch image from Cloudinary');
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const prompt = type === 'PRESCRIPTION' ? PRESCRIPTION_PROMPT : LAB_REPORT_PROMPT;

  const result = await client.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType
            }
          }
        ]
      }
    ]
  });
  const responseText = result.text;
  
  // Clean up potential markdown wrappers (e.g., ```json ... ```)
  const jsonString = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
  
  // Isolate the JSON string logic
  // Try to find the first '{' and last '}' if trailing text exists.
  // NOTE: This assumes the outermost braces bound the actual JSON object. If a field (like doctorNotes)
  // legitimately contains an unmatched '{' or '}' outside the main object, this extraction could grab the wrong boundary.
  const firstBrace = jsonString.indexOf('{');
  const lastBrace = jsonString.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('MALFORMED_AI_RESPONSE: No JSON object found in output');
  }

  const cleanJson = jsonString.substring(firstBrace, lastBrace + 1);

  let parsedData;
  try {
    parsedData = JSON.parse(cleanJson);
  } catch (parseError) {
    throw new Error('MALFORMED_AI_RESPONSE: Failed to parse JSON structure');
  }

  // Validate the required shape
  validateShape(parsedData, type);

  return parsedData;
}

/**
 * Extracts structured JSON data from a document using Gemini Vision.
 * Handles one silent retry for malformed JSON responses.
 * @param {string} cloudinaryUrl - URL of the uploaded file on Cloudinary
 * @param {string} mimeType - The mimetype of the file (e.g., 'image/jpeg', 'application/pdf')
 * @param {string} type - 'PRESCRIPTION' or 'LAB_REPORT'
 * @returns {Object} The parsed JSON object
 */
async function extractDataFromDocument(cloudinaryUrl, mimeType, type) {
  try {
    // Attempt 1
    return await attemptExtraction(cloudinaryUrl, mimeType, type);
  } catch (error) {
    if (error.message.startsWith('MALFORMED_AI_RESPONSE') || error.message.startsWith('MALFORMED_AI_SHAPE')) {
      console.warn(`Extraction Attempt 1 Failed (${error.message}). Retrying...`);
      // Attempt 2 (Silent Retry)
      try {
        return await attemptExtraction(cloudinaryUrl, mimeType, type);
      } catch (retryError) {
        console.error('Gemini Vision Extraction Error (Attempt 2):', retryError.message);
        throw retryError; // Propagate the specific MALFORMED error
      }
    }
    
    // Genuine unrecoverable error (e.g., Network, Authentication)
    console.error('Gemini Vision Critical Error:', error.message);
    throw error;
  }
}

module.exports = { extractDataFromDocument };
