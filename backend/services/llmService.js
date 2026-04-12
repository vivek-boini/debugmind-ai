/**
 * LLM Service
 * Provides optional LLM-based insights using GROQ API
 * 
 * Features:
 * - Safe fallback if LLM fails (never crashes the system)
 * - Uses GROQ's llama-3.1-8b-instant model (fast, free-tier friendly)
 * - Supports JSON mode for structured output
 * - Fallback ONLY if API call fails
 * 
 * Migration: Switched from NVIDIA API to GROQ API
 */

import axios from "axios";

// Model configuration
const MODEL_NAME = "llama-3.1-8b-instant";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_CONFIG = {
  temperature: 0.3,
  maxTokens: 500,
  timeout: 15000,  // 15 second timeout
};

/**
 * Get the API key (GROQ preferred, NVIDIA as fallback)
 */
function getApiKey() {
  return process.env.GROQ_API_KEY || process.env.NVIDIA_API_KEY || null;
}

/**
 * Generate LLM insights - ALWAYS returns text if API succeeds
 * @param {string} prompt - The prompt to send to the LLM
 * @param {Object} options - Optional configuration
 * @returns {Promise<{success: boolean, text: string|null, error?: string}>}
 */
export async function generateLLMInsights(prompt, options = {}) {
  const apiKey = getApiKey();

  // Check if API key is available
  if (!apiKey) {
    console.log("[LLMService] No GROQ_API_KEY or NVIDIA_API_KEY configured, skipping LLM");
    return {
      success: false,
      text: null,
      error: "API key not configured",
    };
  }

  try {
    const requestBody = {
      model: options.model || MODEL_NAME,
      messages: [
        {
          role: "system",
          content: options.systemPrompt || "You are an expert coding mentor. Respond ONLY in valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: options.maxTokens ?? DEFAULT_CONFIG.maxTokens,
      temperature: options.temperature ?? DEFAULT_CONFIG.temperature,
    };

    // Enable JSON mode if requested
    if (options.jsonMode !== false) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await axios.post(
      GROQ_API_URL,
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: options.timeout ?? DEFAULT_CONFIG.timeout,
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;

    if (!text) {
      console.log("[LLMService] Empty response from GROQ LLM");
      return {
        success: false,
        text: null,
        error: "Empty response",
      };
    }

    console.log("[LLMService] GROQ LLM response received successfully");
    return {
      success: true,
      text: text,
    };
  } catch (error) {
    const errMsg = error.response?.data?.error?.message || error.message;
    console.log("[LLMService] GROQ LLM failed:", errMsg);
    return {
      success: false,
      text: null,
      error: errMsg,
    };
  }
}

/**
 * Parse JSON from LLM text safely
 * Returns null if parsing fails - NEVER causes errors
 */
export function tryParseJSON(text) {
  if (!text) return null;
  try {
    // Try direct parse first (GROQ JSON mode usually returns clean JSON)
    return JSON.parse(text);
  } catch {
    // Fallback: extract JSON object from text
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {
      // Silently fail - this is optional
    }
  }
  return null;
}

/**
 * Check if LLM service is available
 * @returns {boolean}
 */
export function isAvailable() {
  return !!getApiKey();
}

export { MODEL_NAME };
