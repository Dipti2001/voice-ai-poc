import twilio from 'twilio';
import config from './config.js';
import { logger } from './logger.js';

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
  
  if (audioUrl) {
    const fullUrl = `${config.app.baseUrl}${audioUrl}`;
    logger.call('Playing audio from URL', { url: fullUrl });
    
    // Play a quick beep followed by the synthesized audio
    twiml.play({ digits: '1' }); // Quick beep to ensure audio is working
    twiml.play(fullUrl);
    logger.call('Added audio playback to response');
  } else {
    // Fallback to basic TTS
    twiml.say({ voice: 'alice', language: 'en-US' }, message);
    logger.call('Using TTS fallback');
  }

  // Add gather for speech input with reduced timeouts
  const gather = twiml.gather({
    input: 'speech',
    timeout: 2,
    action: '/voice/inbound',
    method: 'POST',
    speechTimeout: 1,
    language: 'en-US',
    speechModel: 'phone_call'
  });
  
  // If no input is received, try again
  twiml.redirect('/voice/outbound');
  
  return twiml.toString();
}