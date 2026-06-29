const mongoose = require('mongoose');
const { GoogleGenAI } = require('@google/genai');
const FamilyMember = require('../models/FamilyMember');
const VectorChunk = require('../models/VectorChunk');
const MedicineKB = require('../models/MedicineKB');
const ChatSession = require('../models/ChatSession');
const { generateEmbedding } = require('../services/embeddingService');

// Lazy-initialized singleton — created on first call, not at require() time.
let ai = null;

function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Ensure dotenv has loaded before calling chat.'
      );
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

// Strict Grounding Threshold (Named constant as requested)
const GROUNDING_THRESHOLD = 0.70;

/**
 * Executes a vector search on a MongoDB collection.
 */
async function vectorSearch(Model, embedding, limit, filter = {}) {
  // $vectorSearch requires an Atlas index to be configured.
  // We use aggregate pipeline for vector search
  try {
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: embedding,
          numCandidates: limit * 10,
          limit: limit,
          filter: filter
        }
      },
      {
        $project: {
          _id: 1,
          text: 1,
          chunkText: 1, // Depending on model
          brandName: 1,
          genericComposition: 1,
          uses: 1,
          recordId: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ];
    const results = await Model.aggregate(pipeline);
    return { results, error: false };
  } catch (error) {
    console.error(`\n[VECTOR SEARCH ERROR — INDEX MAY BE MISSING OR MISCONFIGURED] Failed on ${Model.modelName}:`, error.message, '\n');
    return { results: [], error: true };
  }
}

/**
 * Controller for POST /api/profiles/:profileId/chat
 */
async function sendMessage(req, res) {
  try {
    const { profileId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: 'Message is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: 'Invalid profile ID.' });
    }

    const profile = await FamilyMember.findById(profileId);
    if (!profile) return res.status(404).json({ message: 'Profile not found.' });

    if (profile.accountId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to chat for this profile.' });
    }

    // 1. Embed the user's message
    const messageEmbedding = await generateEmbedding(message);

    // 2. Retrieve from Personal VectorChunks
    const personalSearch = await vectorSearch(VectorChunk, messageEmbedding, 5, { 
      profileId: new mongoose.Types.ObjectId(profileId) 
    });

    // 3. Retrieve from Shared MedicineKB
    const kbSearch = await vectorSearch(MedicineKB, messageEmbedding, 3, {});

    // If either search hard-failed, surface the error for debugging
    if (personalSearch.error || kbSearch.error) {
      return res.status(500).json({
        success: false,
        message: 'A backend retrieval error occurred. Please verify that the MongoDB Atlas Vector Search indexes have been created.'
      });
    }

    const personalChunks = personalSearch.results;
    const kbChunks = kbSearch.results;

    // 4. Strict Grounding Validation
    let maxScore = 0;
    const allChunks = [...personalChunks, ...kbChunks];
    for (const chunk of allChunks) {
      if (chunk.score > maxScore) maxScore = chunk.score;
    }

    if (maxScore < GROUNDING_THRESHOLD) {
      // Short-circuit without calling Gemini
      return res.json({
        success: true,
        response: "I cannot answer that based on the provided health records. Please consult a doctor for medical advice.",
        citations: [] // none
      });
    }

    // 5. Build Context and Track Valid IDs
    const validCitationIds = new Set();
    let contextString = "You are a helpful medical assistant strictly grounded in the following retrieved context.\n\n";

    if (personalChunks.length > 0) {
      contextString += "--- PERSONAL HEALTH RECORDS ---\n";
      personalChunks.forEach(chunk => {
        const idStr = chunk.recordId.toString();
        validCitationIds.add(idStr);
        contextString += `[SOURCE:${idStr}] ${chunk.text}\n\n`;
      });
    }

    if (kbChunks.length > 0) {
      contextString += "--- GENERAL MEDICAL KNOWLEDGE ---\n";
      kbChunks.forEach(chunk => {
        const idStr = chunk._id.toString();
        validCitationIds.add(idStr);
        contextString += `[SOURCE:${idStr}] Medicine: ${chunk.brandName}. Generic: ${chunk.genericComposition.join(', ')}. Uses: ${chunk.uses}\n\n`;
      });
    }

    contextString += `
INSTRUCTIONS:
1. Answer the user's question using ONLY the context provided above.
2. If the context does not contain the answer, say "I cannot answer that based on the provided health records."
3. When you use information from a specific chunk, you MUST append its source ID at the end of the sentence like this: [SOURCE:id].
4. DO NOT make up source IDs. Only use the IDs explicitly provided in the context above.
`;

    // 6. Manage Chat History
    let chatSession = await ChatSession.findOne({ profileId });
    if (!chatSession) {
      chatSession = new ChatSession({ profileId, history: [] });
    }

    // Prepare history for Gemini
    let geminiHistory = chatSession.history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.parts[0].text }]
    }));

    // Enforce a sliding context window to prevent token overflow
    // Keep the last 10 messages (5 turns) to stay within limits
    const CONTEXT_WINDOW_LIMIT = 10;
    if (geminiHistory.length > CONTEXT_WINDOW_LIMIT) {
      geminiHistory = geminiHistory.slice(-CONTEXT_WINDOW_LIMIT);
    }

    // Initialize Gemini Chat
    const client = getAI();
    const chat = client.chats.create({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction: contextString
      },
      history: geminiHistory
    });

    // 7. Execute LLM
    const result = await chat.sendMessage({ message });
    let llmResponse = result.text;

    // 8. Citation ID Validation & Stripping Hallucinations
    // Regex matches [SOURCE:id]
    const citationRegex = /\[SOURCE:([a-zA-Z0-9_]+)\]/g;
    
    llmResponse = llmResponse.replace(citationRegex, (match, id) => {
      if (validCitationIds.has(id)) {
        return match; // Keep valid citation
      } else {
        console.warn(`[HALLUCINATION DETECTED] Stripping invalid citation ID: ${id}`);
        return ''; // Strip hallucinated citation
      }
    });

    // 9. Save History
    chatSession.history.push({ role: 'user', parts: [{ text: message }] });
    chatSession.history.push({ role: 'model', parts: [{ text: llmResponse }] });
    await chatSession.save();

    res.json({
      success: true,
      response: llmResponse
    });

  } catch (error) {
    console.error('Chat Error:', error);
    res.status(500).json({ success: false, message: 'Server error processing chat message.' });
  }
}

/**
 * Controller for GET /api/profiles/:profileId/chat
 */
async function getHistory(req, res) {
  try {
    const { profileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(profileId)) {
      return res.status(400).json({ message: 'Invalid profile ID.' });
    }

    const profile = await FamilyMember.findById(profileId);
    if (!profile) return res.status(404).json({ message: 'Profile not found.' });

    if (profile.accountId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to view chat history for this profile.' });
    }

    const chatSession = await ChatSession.findOne({ profileId });
    res.json({
      success: true,
      history: chatSession ? chatSession.history : []
    });
  } catch (error) {
    console.error('Get Chat History Error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching chat history.' });
  }
}

module.exports = {
  sendMessage,
  getHistory
};
