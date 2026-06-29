const { GoogleGenAI } = require('@google/genai');

// Lazy-initialized singleton — created on first call, not at require() time.
// This avoids load-order bugs where dotenv hasn't populated process.env yet.
let ai = null;

function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Ensure dotenv has loaded before calling generateEmbedding().'
      );
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

/**
 * Generates a 768-dimensional vector embedding for the given text.
 * Uses the Google gemini-embedding-001 model with outputDimensionality
 * pinned to 768 to match our Atlas Vector Search index.
 * 
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} - The 768-d vector array
 */
async function generateEmbedding(text) {
  const client = getAI();

  try {
    const result = await client.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: {
        outputDimensionality: 768
      }
    });
    return result.embeddings[0].values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

module.exports = {
  generateEmbedding
};
