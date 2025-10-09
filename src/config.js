import dotenv from 'dotenv';

// Load environment variables from a .env file if present.  The .env.example
// file in the project root documents all of the settings required to run
// the application.  Copy it to .env and adjust the values to your
// environment.
dotenv.config();

const config = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER
  },
  deepgram: {
    apiKey: process.env.DEEPGRAM_API_KEY
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'google',
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL || 'gemini-2.0-pro'
  },
  app: {
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000'
  }
};

export default config;