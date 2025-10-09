import { Router } from 'express';
import twilio from 'twilio';
import { readPrompt } from '../prompt.js';
import { callLLM } from '../llm.js';
import { transcribeAudio, synthesiseSpeech } from '../speech.js';
import { buildSayResponse, placeCall } from '../telephony.js';
import config from '../config.js';

// Initialize Twilio client for response building
const client = twilio(config.twilio.accountSid, config.twilio.authToken);

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
    console.log('Received voice request:', {
      type: req.path.includes('inbound') ? 'inbound' : 'outbound',
      callSid: req.body?.CallSid,
      from: req.body?.From,
      to: req.body?.To
    });

    // Step 1: Get the prompt and system instructions for the agent
    const prompt = await readPrompt();
    if (!prompt) {
      console.error('No prompt available');
      throw new Error('System configuration error: No prompt available');
    }

    // For initial outbound calls or first inbound interaction, start with a greeting
    if (!req.body?.RecordingUrl) {
      console.log('Initial greeting interaction');
      const messages = [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Start the conversation with a greeting' }
      ];
      
      const llmReply = await callLLM(messages);
      console.log('Generated initial greeting:', llmReply);
      
      const xml = buildSayResponse(llmReply);
      res.type('text/xml').send(xml);
      return;
    }

    // Step 2: Handle voice input if available
    let callerTranscript = '';
    if (req.body?.RecordingUrl) {
      console.log('Processing recording from:', req.body.RecordingUrl);
      try {
        const audioRes = await fetch(req.body.RecordingUrl);
        const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
        callerTranscript = await transcribeAudio(audioBuffer);
        console.log('Transcription result:', callerTranscript);
      } catch (err) {
        console.error('Transcription error:', err);
        throw new Error('Failed to process voice input');
      }
    }

    // Step 3: Compose messages for the LLM
    const messages = [
      { role: 'system', content: prompt },
      { role: 'user', content: callerTranscript || 'Hello' }
    ];
    
    console.log('Sending messages to LLM:', messages);

    // Step 4: Get the LLM response
    const llmReply = await callLLM(messages);
    console.log('Received LLM response:', llmReply);

    // Build TwiML response using the helper
    const twimlResponse = buildSayResponse(llmReply);
    console.log('Generated TwiML response:', twimlResponse);
    res.type('text/xml').send(twimlResponse);
  } catch (err) {
    console.error('Voice handler error:', {
      error: err.message,
      stack: err.stack,
      callSid: req.body?.CallSid
    });
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(
      { voice: 'alice', language: 'en-US' },
      'I apologize, but I encountered a technical issue. Please try your request again.'
    );
    const xml = twiml.toString();
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
  
  console.log('Received outbound call request:', { to });
  console.log('Using webhook URL:', `${config.app.baseUrl}/voice/outbound`);
  console.log('Using Twilio config:', {
    accountSid: config.twilio.accountSid,
    phoneNumber: config.twilio.phoneNumber,
    // Don't log the auth token for security
  });

  try {
    const call = await placeCall(to, `${config.app.baseUrl}/voice/outbound`);
    console.log('Call placed successfully:', { callSid: call.sid, to });
    res.json({ 
      callSid: call.sid,
      status: 'initiated',
      to,
      from: config.twilio.phoneNumber
    });
  } catch (err) {
    console.error('Failed to place call:', {
      error: err.message,
      code: err.code,
      to,
      webhookUrl: `${config.app.baseUrl}/voice/outbound`
    });
    res.status(500).json({ 
      error: 'Failed to place call',
      details: err.message,
      code: err.code
    });
  }
});

export default router;