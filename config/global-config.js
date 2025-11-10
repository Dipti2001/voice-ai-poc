/**
 * Global Configuration for Multi-Tenant Voice AI Service
 *
 * This file contains shared configuration that applies to all tenants.
 * Sensitive data is encrypted when stored, but this file contains
 * the plaintext configuration for initial setup.
 */

export const globalConfig = {
  // Voice configuration shared across all tenants
  voiceConfig: {
    provider: 'deepgram', // Deepgram for both ASR and TTS
    apiKey: 'your-deepgram-api-key' // Replace with your actual Deepgram API key
  },

  // Add other global settings here as needed
  // For example:
  // defaultSettings: {
  //   maxCallDuration: 300, // seconds
  //   recordingEnabled: true,
  //   analyticsEnabled: true
  // }
};

/**
 * Validation function for global config
 */
export function validateGlobalConfig(config) {
  const required = ['voiceConfig'];
  const missing = required.filter(field => !config[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required global configuration fields: ${missing.join(', ')}`);
  }

  if (!config.voiceConfig.provider || !config.voiceConfig.apiKey) {
    throw new Error('Global voice configuration must include provider and apiKey');
  }

  const validProviders = ['elevenlabs', 'deepgram', 'azure'];
  if (!validProviders.includes(config.voiceConfig.provider)) {
    throw new Error(`Invalid voice provider. Must be one of: ${validProviders.join(', ')}`);
  }

  return true;
}

/**
 * Initialize global config validation
 */
if (validateGlobalConfig(globalConfig)) {
  console.log('Global configuration validated successfully');
}