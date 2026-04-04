/**
 * LLM Service
 * Provides optional LLM-based insights using NVIDIA API
 * 
 * Features:
 * - Safe fallback if LLM fails (never crashes the system)
 * - Uses NVIDIA's meta/llama-3.3-70b-instruct model
 * - NO strict JSON parsing - always returns raw text
 * - Fallback ONLY if API call fails
 */

import axios from "axios";

// Model configuration
const MODEL_NAME = "meta/llama-3.3-70b-instruct";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_CONFIG = {
  temperature: 0.4,
  maxTokens: 400,  // Reduced for faster response
  timeout: 15000,  // 15 second timeout
};

/**
 * Generate LLM insights - ALWAYS returns text if API succeeds
 * @param {string} prompt - The prompt to send to the LLM
 * @param {Object} options - Optional configuration
 * @returns {Promise<{success: boolean, text: string|null, error?: string}>}
 */
export async function generateLLMInsights(prompt, options = {}) {
  // Check if API key is available
  if (!process.env.NVIDIA_API_KEY) {
    console.log("[LLMService] No NVIDIA_API_KEY configured, skipping LLM");
    return {
      success: false,
      text: null,
      error: "API key not configured",
    };
  }

  try {
    const response = await axios.post(
      NVIDIA_API_URL,
      {
        model: options.model || MODEL_NAME,
        messages: [
          {
            role: "system",
            content: options.systemPrompt || "You are an expert coding mentor.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: options.maxTokens ?? DEFAULT_CONFIG.maxTokens,
        temperature: options.temperature ?? DEFAULT_CONFIG.temperature,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: options.timeout ?? DEFAULT_CONFIG.timeout,
      }
    );

    const text = response.data?.choices?.[0]?.message?.content;

    if (!text) {
      console.log("[LLMService] Empty response from NVIDIA LLM");
      return {
        success: false,
        text: null,
        error: "Empty response",
      };
    }

    console.log("[LLMService] LLM response received successfully");
    return {
      success: true,
      text: text,
    };
  } catch (error) {
    console.log("[LLMService] NVIDIA LLM failed:", error.response?.data || error.message);
    return {
      success: false,
      text: null,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

/**
 * Optional: Try to parse JSON from text (non-blocking)
 * Returns null if parsing fails - NEVER causes fallback
 */
export function tryParseJSON(text) {
  if (!text) return null;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {
    // Silently fail - this is optional
  }
  return null;
}

/**
 * Check if LLM service is available
 * @returns {boolean}
 */
export function isAvailable() {
  return !!process.env.NVIDIA_API_KEY;
}

export { MODEL_NAME };
