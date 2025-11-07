import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'DEEPGRAM_API_KEY',
  'LLM_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

const config = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY,
    sttModel: process.env.DEEPGRAM_STT_MODEL || 'nova-2',
    ttsModel: process.env.DEEPGRAM_TTS_MODEL || 'aura-asteria-en'
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'openrouter',
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL || 'openai/gpt-4o',
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 150,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
    timeout: parseInt(process.env.LLM_TIMEOUT) || 10000
  },
  app: {
    port: parseInt(process.env.PORT) || 3000,
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
    env: process.env.NODE_ENV || 'development'
  },
  database: {
    path: path.join(__dirname, '..', 'database', 'voice_ai.db')
  },
  audio: {
    storagePath: path.join(__dirname, '..', 'public', 'audio'),
    maxFileSize: parseInt(process.env.MAX_AUDIO_FILE_SIZE) || 50 * 1024 * 1024, // 50MB
    cleanupInterval: parseInt(process.env.AUDIO_CLEANUP_INTERVAL) || 24 * 60 * 60 * 1000 // 24 hours
  },
  websocket: {
    port: parseInt(process.env.WS_PORT) || 8080
  },
  security: {
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    corsOrigin: process.env.CORS_ORIGIN || '*'
  }
};

export default config;