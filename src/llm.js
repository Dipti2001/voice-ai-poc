import fetch from 'node-fetch';
import config from './config.js';

/**
 * Submit a chat prompt to an LLM and return the generated text.  This
 * module supports multiple providers via environment configuration.  The
 * provider can be selected at runtime by setting `LLM_PROVIDER` in the
 * environment.  Current providers:
 *   - google: Google AI Studio (Gemini models)
 *   - openrouter: OpenRouter aggregator for various open models
 *
 * To add a new provider, implement a new case in the switch below.  Each
 * handler takes a list of messages in ChatML format and returns a string.
 *
 * @param {Array<{role: string, content: string}>} messages The chat history.
 * @returns {Promise<string>} The response text from the LLM.
 */
export async function callLLM(messages) {
  const provider = config.llm.provider;
  switch (provider) {
    case 'google':
      return callGoogleAI(messages);
    case 'openrouter':
      return callOpenRouter(messages);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

async function callGoogleAI(messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.llm.model}:generateContent`;
  const headers = {
    'Content-Type': 'application/json',
    'x-goog-api-key': config.llm.apiKey
  };
  // Convert ChatML messages to the request format expected by Google AI Studio.
  const contents = messages.map(msg => ({ parts: [{ text: msg.content }] }));
  const body = JSON.stringify({ contents });
  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google AI request failed with status ${res.status}: ${text}`);
  }
  const data = await res.json();
  // Extract text from the first candidate; adjust if using different API versions.
  const candidate = data.candidates?.[0];
  if (!candidate || !candidate.content) {
    throw new Error('No candidate response returned from Google AI');
  }
  return candidate.content.parts.map(part => part.text).join('');
}

async function callOpenRouter(messages) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.llm.apiKey}`,
    'HTTP-Referer': config.app.baseUrl,
    'X-Title': 'Voice AI POC'
  };
  const body = JSON.stringify({
    model: config.llm.model,
    messages
  });
  const res = await fetch(url, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter request failed with status ${res.status}: ${text}`);
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice || !choice.message) {
    throw new Error('No choice returned from OpenRouter');
  }
  return choice.message.content;
}