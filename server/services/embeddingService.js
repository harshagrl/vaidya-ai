const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ensure you have GEMINI_API_KEY in your .env
const apiKey = process.env.GEMINI_API_KEY;

let genAI;
if (apiKey) {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn("GEMINI_API_KEY not found in environment. Embeddings will fail.");
}

/**
 * Generates a 768-dimensional vector embedding for the given text.
 * Uses the recommended Google text-embedding-004 model.
 * 
 * @param {string} text - The text to embed
 * @returns {Promise<number[]>} - The 768-d vector array
 */
async function generateEmbedding(text) {
  if (!genAI) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  
  try {
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

module.exports = {
  generateEmbedding
};
