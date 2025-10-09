# Voice AI POC

This repository contains a proof‑of‑concept Node.js application that
demonstrates how to build a multi‑tenant voice‑assistant platform using
Twilio for telephony, Deepgram for speech recognition and synthesis, and
an easily configurable large language model (LLM) for conversation
handling.  The goal is to give every tenant the ability to specify
their own prompt in a text file, creating customised voice agents
without changing code.

## Features

* **Inbound and outbound call handling:** The Express server exposes
  webhooks for Twilio to POST on inbound and outbound calls.  Both
  routes use the same processing pipeline: transcribe caller speech,
  generate a reply via an LLM, synthesise the reply, and return
  TwiML to speak the reply.
* **Prompt configuration via file:** Tenants can modify the text in
  `prompts/default_prompt.txt` or create additional files in the
  `prompts/` directory.  The server reads the prompt at runtime.
* **Pluggable LLM provider:** Choose between Google AI Studio or
  OpenRouter by setting `LLM_PROVIDER` and `LLM_MODEL` in `.env`.  The
  code is structured to support additional providers by adding a case
  in `src/llm.js`.
* **Deepgram ASR/TTS:** Uses the Deepgram SDK to transcribe
  recordings and generate natural‑sounding audio responses.  The
  `src/speech.js` module encapsulates this functionality.
* **Outbound call API:** A REST endpoint `/call` allows your backend
  or UI to trigger a voice call to any number.  The call is handled
  through the same AI pipeline.

## Project structure

```
voice-ai-poc/
├── prompts/
│   └── default_prompt.txt  # Default prompt for agents
├── src/
│   ├── config.js           # Loads environment variables
│   ├── index.js            # Express server entrypoint
│   ├── llm.js              # Calls the configured LLM provider
│   ├── prompt.js           # Reads prompts from text files
│   ├── routes/
│   │   └── calls.js        # Inbound/outbound call handlers
│   ├── speech.js           # Deepgram ASR/TTS helpers
│   └── telephony.js        # Twilio integration and helpers
├── .env.example            # Template for runtime configuration
├── package.json            # Project metadata and dependencies
└── README.md               # This file
```

## Setup and usage

1. **Install dependencies**

   ```sh
   npm install
   ```

2. **Create a `.env` file**

   Copy `.env.example` to `.env` and fill in your Twilio, Deepgram and
   LLM API keys.  Set `APP_BASE_URL` to the public URL of this
   server (e.g. the URL configured in your Twilio console).  See
   [Best free AI APIs for 2025](https://madappgang.com/blog/best-free-ai-apis-for-2025-build-with-llms-without/) for
   options like Google AI Studio, Groq, Together AI and OpenRouter【47585137785060†L53-L64】.

3. **Run the server**

   ```sh
   npm start
   ```

4. **Configure Twilio webhooks**

   In the Twilio console, set the Voice webhook for your phone number to
   `POST /voice/inbound` on your server.  For outbound calls, the
   application will automatically instruct Twilio to hit `/voice/outbound`.

5. **Trigger an outbound call**

   Send a POST request to `/call` with JSON `{ "to": "+123456789" }`.  The
   server will place a call via Twilio, and when answered, the call
   will invoke the AI pipeline.

## Notes

* **Real‑time audio streaming:** This POC handles recorded calls for
  simplicity.  To support fully interactive conversations, use Twilio’s
  `<Stream>` verb to pipe live audio to your backend and Deepgram’s
  streaming API.  The same pipeline architecture applies, but with
  asynchronous event handling.
* **Multi‑tenancy:** In a production system you would store tenant
  configuration (prompts, voice settings, API keys) in a database and
  use a tenant ID to select the correct config.  The folder structure
  and modular code here are designed to be extended in that direction.
* **LLM providers:** The article cited above lists several free and
  paid LLM APIs available in 2025.  Google AI Studio, Groq, Together
  AI and OpenRouter provide generous free tiers【47585137785060†L53-L64】.  The
  `src/llm.js` module can be extended to support any HTTP‑based LLM API.

## License

This project is provided for educational purposes and carries no
warranty.  Feel free to modify and integrate it into your own SaaS.