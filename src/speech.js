import { createClient } from '@deepgram/sdk';
import config from './config.js';

// Initialise the Deepgram client once.  The Deepgram SDK automatically
// handles streaming and request signing.  See
// https://developers.deepgram.com for API details.
const deepgram = createClient(config.deepgram.apiKey);

/**
 * Transcribe an audio buffer into text using Deepgram.  This helper uses
 * Deepgram's synchronous transcription API for brevity.  For real‑time
 * streaming, use deepgram.transcription.live() and process events.
 *
 * @param {Buffer} audioBuffer The raw PCM or encoded audio data.
 * @returns {Promise<string>} The transcribed text.
 */
export async function transcribeAudio(audioBuffer) {
  // Using the preRecorded API which accepts a buffer.  Adjust MIME type to
  // match the audio format your telephony provider uses (e.g. 'audio/mpeg').
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    { model: 'nova-2', smart_format: true }
  );
  
  if (error) {
    throw new Error(`Deepgram transcription error: ${error.message}`);
  }
  
  const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
  return transcript;
}

/**
 * Convert text into synthetic speech using Deepgram's TTS.  Returns a
 * buffer containing the audio in MP3 format.  The voice and model used
 * can be adjusted by changing the options.  See
 * https://developers.deepgram.com/reference/speak for details.
 *
 * @param {string} text The text to synthesise.
 * @returns {Promise<Buffer>} The MP3 audio buffer.
 */
export async function synthesiseSpeech(text) {
  const response = await deepgram.speak.request(
    { text },
    {
      model: 'aura-asteria-en',
      encoding: 'linear16',
      sample_rate: 48000,
    }
  );
  
  // The response is a stream, convert it to a buffer
  const stream = await response.getStream();
  if (stream) {
    const chunks = [];
    const reader = stream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    
    return Buffer.concat(chunks);
  }
  
  throw new Error('Failed to get audio stream from Deepgram');
}