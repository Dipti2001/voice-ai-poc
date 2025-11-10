# Global Configuration

This directory contains the global configuration for the Multi-Tenant Voice AI Service.

## Files

- `global-config.js` - Global configuration settings that apply to all tenants

## Global Configuration

The `global-config.js` file contains shared settings that are constant across all tenants:

```javascript
export const globalConfig = {
  voiceConfig: {
    provider: 'elevenlabs', // Voice provider (elevenlabs, deepgram, azure)
    apiKey: 'your-global-voice-api-key' // API key for the voice provider
  }
};
```

## How It Works

1. **Global Voice Settings**: The voice provider and API key are shared across all tenants to reduce costs and simplify management.

2. **Tenant-Specific Voices**: Each tenant can specify their preferred `voiceName` (e.g., ElevenLabs voice ID) in their tenant configuration.

3. **Automatic Loading**: The VoiceAIService automatically loads and validates the global configuration when initialized.

## Configuration Options

### Voice Providers

- `elevenlabs` - ElevenLabs TTS service
- `deepgram` - Deepgram TTS service  
- `azure` - Azure Cognitive Services TTS

### Validation

The global configuration is automatically validated when the service starts. Make sure to:

1. Choose a supported voice provider
2. Provide a valid API key for your chosen provider
3. Update the API key with your actual credentials

## Security Note

The global configuration contains sensitive API keys. In production:

1. Use environment variables for API keys
2. Never commit actual API keys to version control
3. Use encrypted storage for sensitive configuration

## Example Usage

```javascript
import { VoiceAIService } from './core/VoiceAIService.js';

const voiceAI = new VoiceAIService();
await voiceAI.initialize(); // Automatically loads global config

// Now setup tenants with their specific voice names
await voiceAI.initializeTenant({
  tenantId: 'tenant-1',
  // ... other config
  voiceConfig: {
    voiceName: '21m00Tcm4TlvDq8ikWAM' // ElevenLabs voice ID
  }
});
```