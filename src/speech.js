import { createClient } from '@deepgram/sdk';
import { logger } from './logger.js';
import config from './config.js';

// Initialise the Deepgram client once.  The Deepgram SDK automatically
// handles streaming and request signing.  See
// https://developers.deepgram.com for API details.
const deepgram = createClient(config.deepgram.apiKey);

/**
 * Creates a live streaming connection to Deepgram for real-time transcription.
 *
 * @returns {Promise<WebSocket>} The Deepgram WebSocket connection.
 */
export async function createLiveTranscriptionStream() {
  const options = {
    model: 'nova-2',
    smart_format: true,
    encoding: 'linear16',
    sample_rate: 8000,
    channels: 1,
    interim_results: true
  };

  logger.speech('Creating live transcription stream', { options });

  try {
    const connection = await deepgram.listen.live(options);
    
    connection.addListener('transcriptReceived', (transcription) => {
      const transcript = transcription?.channel?.alternatives?.[0]?.transcript ?? '';
      if (transcript) {
        logger.speech('Live transcription received', { transcript });
      }
    });

    connection.addListener('error', (error) => {
      logger.error('Deepgram live stream error', error);
    });

    connection.addListener('close', () => {
      logger.speech('Live transcription stream closed');
    });

    logger.speech('Live transcription stream created successfully');
    return connection;
  } catch (error) {
    logger.error('Failed to create live transcription stream', error);
    throw error;
  }
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
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty for speech synthesis');
  }

  logger.speech('Starting speech synthesis', { text, model: 'aura-2-en' });
  
  try {
    const response = await deepgram.speak.request(
      { text },
      {
    model: 'aura-2-en',
    encoding: 'linear16',
    voice: 'aura',
    speed: 1.15,
    quality: 'real-time',
    streaming: true
  }
    );
    
    logger.speech('Speech synthesis response received');
    
    // The response is a stream, convert it to a buffer
    const stream = await response.getStream();
    if (!stream) {
      throw new Error('No audio stream received from Deepgram');
    }

    const chunks = [];
    const reader = stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    
    const audioBuffer = Buffer.concat(chunks);
    if (audioBuffer.length === 0) {
      throw new Error('Generated audio buffer is empty');
    }

    logger.speech('Audio synthesis completed', { bufferSize: audioBuffer.length });
    return audioBuffer;
  } catch (error) {
    logger.error('Speech synthesis failed', { error: error.message, text });
    throw error;
  }
}