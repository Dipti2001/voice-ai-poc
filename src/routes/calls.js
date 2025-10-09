import { Router } from 'express';
import { readPrompt } from '../prompt.js';
import { callLLM } from '../llm.js';
import { transcribeAudio, synthesiseSpeech } from '../speech.js';
import { buildSayResponse, placeCall } from '../telephony.js';
import config from '../config.js';

/**
 * Router for call-related endpoints.  Defines two main routes:
 *
 *   POST /voice/inbound  – Twilio webhook for inbound calls.  Reads the
 *                          incoming audio (if streaming enabled), sends it
 *                          through ASR and LLM, synthesises a response, and
 *                          returns TwiML to play the audio back.
 *
 *   POST /voice/outbound – Called by Twilio when you initiate an
 *                          outbound call via placeCall().  For this POC the
 *                          behaviour is the same as inbound.
 */
const router = Router();

// Helper: handle an inbound or outbound voice request from Twilio
async function handleVoiceRequest(req, res) {
  try {
    // Step 1: Get the prompt and system instructions for the agent
    const prompt = await readPrompt();

    // Step 2: Use Deepgram for real-time ASR
    let callerTranscript = '';
    if (req.body && req.body.SpeechResult) {
      // Use the direct speech result if available
      callerTranscript = req.body.SpeechResult;
    } else if (req.body && req.body.MediaUrl) {
      try {
        const audioRes = await fetch(req.body.MediaUrl);
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        callerTranscript = await transcribeAudio(audioBuffer);
      } catch (err) {
        console.warn('Failed to transcribe audio:', err.message);
      }
    }

    // Step 3: Compose messages for the LLM.  The system prompt gives the
    // assistant instructions; the user message contains the caller's speech.
    const messages = [];
    if (prompt) messages.push({ role: 'system', content: prompt });
    if (callerTranscript) messages.push({ role: 'user', content: callerTranscript });
    else messages.push({ role: 'user', content: 'Hello' });

    // Step 4: Get the LLM response
    const llmReply = await callLLM(messages);

    // Step 5: Synthesise the response into audio via Deepgram
    const audioBuffer = await synthesiseSpeech(llmReply);

    // Step 6: Serve the audio to Twilio.  Twilio can play back audio from a
    // URL via <Play>.  Here you would need to store audioBuffer in a
    // temporary file or object storage and return its URL in TwiML.  For
    // simplicity, this POC just speaks the text using TwiML's <Say>.
    const xml = buildSayResponse(llmReply);
    res.type('text/xml').send(xml);
  } catch (err) {
    console.error('Voice handler error:', err);
    const xml = buildSayResponse('Sorry, something went wrong.');
    res.type('text/xml').send(xml);
  }
}

// Twilio invokes this webhook on inbound calls
router.post('/voice/inbound', (req, res) => {
  handleVoiceRequest(req, res);
});

// Twilio invokes this webhook on outbound calls
router.post('/voice/outbound', (req, res) => {
  handleVoiceRequest(req, res);
});

// Expose a REST endpoint to trigger an outbound call from your application.
// Example: POST /call { "to": "+15551234567" }
router.post('/call', async (req, res) => {
  const to = req.body?.to;
  if (!to) {
    return res.status(400).json({ error: 'Missing required field: to' });
  }
  try {
    const call = await placeCall(to, `${config.app.baseUrl}/voice/outbound`);
    res.json({ callSid: call.sid });
  } catch (err) {
    console.error('Failed to place call:', err);
    res.status(500).json({ error: 'Failed to place call' });
  }
});

// Handle real-time audio streaming with Deepgram
router.post('/voice/stream', async (req, res) => {
  try {
    // Create a Deepgram live transcription session
    const deepgramLive = deepgram.transcription.live({
      punctuate: true,
      smart_format: true,
      model: 'nova-2',
      language: 'en-US'
    });

    // Handle the transcription results
    deepgramLive.addListener('transcriptReceived', async (transcription) => {
      const transcript = transcription?.channel?.alternatives?.[0]?.transcript || '';
      if (transcript) {
        // Process the transcript through LLM
        const messages = [
          { role: 'system', content: await readPrompt() },
          { role: 'user', content: transcript }
        ];
        
        const llmReply = await callLLM(messages);
        
        // Synthesize speech using Deepgram
        const audioBuffer = await synthesiseSpeech(llmReply);
        
        // Here you would need to store the audio buffer and create a URL
        // that Twilio can access to play it back
        // For now, we'll use Twilio's say as fallback
        const twiml = buildSayResponse(llmReply);
        res.type('text/xml').send(twiml);
      }
    });

    // Pipe the incoming audio to Deepgram
    req.pipe(deepgramLive);

  } catch (err) {
    console.error('Streaming error:', err);
    const twiml = buildSayResponse('Sorry, there was an error processing your speech.');
    res.type('text/xml').send(twiml);
  }
});

export default router;