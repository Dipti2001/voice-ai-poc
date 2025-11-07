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
    this.llmMaxTokens = config.llm.maxTokens;
    this.llmTemperature = config.llm.temperature;
  }

  async generateResponse(messages, agentPrompt, conversationId = null) {
    try {
      const lastMessage = messages[messages.length - 1];
      const userInput = lastMessage?.content?.toLowerCase() || '';

      // Check for human transfer requests
      const transferKeywords = [
        'speak to a human', 'talk to a human', 'transfer to human',
        'speak to a person', 'talk to a person', 'transfer to person',
        'human representative', 'live person', 'real person',
        'customer service', 'speak to manager', 'talk to manager'
      ];

      const wantsTransfer = transferKeywords.some(keyword => userInput.includes(keyword));

      if (wantsTransfer) {
        return {
          response: "I understand you'd like to speak with a human representative. I'll arrange for a callback from our team. When would be a good time for us to reach you?",
          transferRequested: true,
          transferReason: 'Customer requested human assistance'
        };
      }

      // Add voice conversation instructions for concise responses
      const voiceInstructions = `You are a voice assistant. Keep your responses CONCISE and CONVERSATIONAL - aim for 1-2 sentences maximum. Avoid long explanations. Be natural and friendly, like you're talking to someone on the phone. Respond quickly and to the point.

${agentPrompt}`;

      const systemMessage = {
        role: 'system',
        content: voiceInstructions
      };

      const payload = {
        model: this.llmModel,
        messages: [systemMessage, ...messages],
        max_tokens: Math.min(this.llmMaxTokens, 75), // Cap at 75 tokens for voice responses
        temperature: this.llmTemperature
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
      return {
        response: data.choices[0].message.content,
        transferRequested: false
      };
    } catch (error) {
      console.error('Error generating LLM response:', error);
      return {
        response: 'I apologize, but I\'m having trouble responding right now. Please try again.',
        transferRequested: false
      };
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
          encoding: 'linear16',
          container: 'wav'
        }
      );

      const audioStream = await response.getStream();
      if (!audioStream) {
        throw new Error('No audio stream received from Deepgram');
      }

      const audioData = await this.streamToBuffer(audioStream);

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

      // Use a separate method for analysis that doesn't have voice constraints
      const response = await this.generateAnalysisResponse(
        [{ role: 'user', content: analysisPrompt }],
        'You are a conversation analyst. Always respond with valid JSON.'
      );

      try {
        const result = JSON.parse(response);
        // Ensure rating is a valid number
        if (typeof result.rating !== 'number' || result.rating < 1 || result.rating > 10) {
          result.rating = 5;
        }
        return result;
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

  async generateAnalysisResponse(messages, systemPrompt) {
    try {
      const systemMessage = {
        role: 'system',
        content: systemPrompt
      };

      const payload = {
        model: this.llmModel,
        messages: [systemMessage, ...messages],
        max_tokens: 200, // More tokens for analysis
        temperature: 0.3 // Lower temperature for consistent analysis
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
        signal: AbortSignal.timeout(5000) // 5 seconds for analysis
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error generating analysis response:', error);
      throw error;
    }
  }

  streamToBuffer(stream) {
    return new Promise(async (resolve, reject) => {
      try {
        const chunks = [];
        const reader = stream.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }

        reader.releaseLock();
        resolve(Buffer.concat(chunks));
      } catch (error) {
        reject(error);
      }
    });
  }

  estimateDuration(text) {
    const wordsPerMinute = 150;
    const wordCount = text.split(' ').length;
    return Math.ceil((wordCount / wordsPerMinute) * 60);
  }
}

export default AIService;