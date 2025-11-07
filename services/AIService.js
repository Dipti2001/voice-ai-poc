import { createClient } from '@deepgram/sdk';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import config from '../src/config.js';

class AIService {
  constructor() {
    this.deepgram = createClient(config.deepgram.apiKey);
    this.llmProvider = config.llm.provider;
    this.llmApiKey = config.llm.apiKey;
    this.llmModel = config.llm.model;
  }

  async generateResponse(messages, agentPrompt) {
    try {
      const systemMessage = {
        role: 'system',
        content: agentPrompt
      };

      const payload = {
        model: this.llmModel,
        messages: [systemMessage, ...messages],
        max_tokens: config.llm.maxTokens,
        temperature: config.llm.temperature
      };

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.llmApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': config.app.baseUrl,
          'X-Title': 'Voice AI Agent System'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.llm.timeout)
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error generating LLM response:', error);
      return 'I apologize, but I\'m having trouble responding right now. Please try again.';
    }
  }

  async transcribeAudio(audioBuffer) {
    try {
      const response = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: config.deepgram.sttModel,
          smart_format: true,
          punctuate: true
        }
      );

      return response.result.results.channels[0].alternatives[0].transcript;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return '';
    }
  }

  async generateTTS(text, voice = config.deepgram.ttsModel) {
    try {
      const response = await this.deepgram.speak.request(
        { text },
        {
          model: voice,
          encoding: 'wav',
          container: 'wav'
        }
      );

      const audioBuffer = await response.getStream();
      const audioData = await this.streamToBuffer(audioBuffer);

      const filename = `${uuidv4()}.wav`;
      const filepath = path.join(config.audio.storagePath, filename);

      await fs.writeFile(filepath, audioData);

      return {
        url: `/audio/${filename}`,
        filepath,
        duration: this.estimateDuration(text)
      };
    } catch (error) {
      console.error('Error generating TTS:', error);
      throw error;
    }
  }

  async analyzeConversation(transcription, messages) {
    try {
      const analysisPrompt = `
        Analyze this conversation and provide:
        1. Rating (1-10) based on engagement and success
        2. Success factors identified
        3. Areas for improvement
        4. Key topics discussed

        Conversation:
        ${transcription}

        Response format: JSON with keys: rating, success_factors, improvements, topics
      `;

      const response = await this.generateResponse(
        [{ role: 'user', content: analysisPrompt }],
        'You are a conversation analyst. Always respond with valid JSON.'
      );

      try {
        return JSON.parse(response);
      } catch {
        return {
          rating: 5,
          success_factors: ['Conversation completed'],
          improvements: ['Analysis parsing failed'],
          topics: ['General inquiry']
        };
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      return {
        rating: 5,
        success_factors: ['Basic conversation'],
        improvements: ['Analysis failed'],
        topics: ['Unknown']
      };
    }
  }

  streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  estimateDuration(text) {
    const wordsPerMinute = 150;
    const wordCount = text.split(' ').length;
    return Math.ceil((wordCount / wordsPerMinute) * 60);
  }
}

export default AIService;