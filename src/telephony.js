import twilio from 'twilio';
import config from './config.js';

// Create a Twilio client with account credentials.  All outbound calls and
// webhook responses will use this client.  The phoneNumber from the
// configuration should be a verified Twilio number.
const client = twilio(config.twilio.accountSid, config.twilio.authToken);

/**
 * Place an outbound voice call to the specified number.  The call will
 * immediately connect to the given URL, which should return TwiML (XML)
 * instructing Twilio how to handle the call.  The TwiML can in turn
 * instruct Twilio to stream audio to your service, record the call,
 * play generated audio or route to a live agent.
 *
 * @param {string} to Destination phone number (E.164 format).
 * @param {string} url URL of your webhook that returns TwiML.
 * @returns {Promise<object>} The Twilio call resource.
 */
export function placeCall(to, url) {
  return client.calls.create({
    to,
    from: config.twilio.phoneNumber,
    url
  });
}

/**
 * Twilio's `<Say>` verb to read out a message and then ends the call.  For
 * interactive calls you would instead return a `<Connect><Stream>` verb to
 * pipe the audio to your application for AI processing via websockets.
 *
 * @param {string} message The message to speak to the caller.
 * @returns {string} The XML string Twilio will execute.
 */
export function buildSayResponse(message, audioUrl = null) {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Start recording for Deepgram ASR
  twiml.start();
  
  // Connect a stream for real-time audio processing
  const connect = twiml.connect();
  connect.stream({
    url: `${config.app.baseUrl}/voice/stream`,
    trackDuplicates: true
  });
  
  if (audioUrl) {
    // Play the Deepgram synthesized audio
    twiml.play(audioUrl);
  }
  
  // Add gather for capturing the response
  const gather = twiml.gather({
    input: 'speech',
    action: '/voice/inbound',
    method: 'POST',
    timeout: 3,
    speechTimeout: 'auto'
  });
  
  twiml.hangup();
  return twiml.toString();
}