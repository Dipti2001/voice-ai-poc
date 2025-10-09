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
export async function placeCall(to, url) {
  console.log('Attempting to place call:', { to, from: config.twilio.phoneNumber, url });
  try {
    const call = await client.calls.create({
      to,
      from: config.twilio.phoneNumber,
      url
    });
    console.log('Call placed successfully:', call.sid);
    return call;
  } catch (error) {
    console.error('Failed to place call:', error.message);
    throw error;
  }
}

/**
 * Build a basic TwiML response for inbound calls.  This helper uses
 * Twilio's `<Say>` verb to read out a message and then ends the call.  For
 * interactive calls you would instead return a `<Connect><Stream>` verb to
 * pipe the audio to your application for AI processing via websockets.
 *
 * @param {string} message The message to speak to the caller.
 * @returns {string} The XML string Twilio will execute.
 */
export function buildSayResponse(message) {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: 'alice', language: 'en-US' }, message);
  twiml.hangup();
  return twiml.toString();
}