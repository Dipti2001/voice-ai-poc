import { createClient } from '@deepgram/sdk';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

/**
 * Tenant-specific AI service with isolated configurations
 */
class TenantAIService {
  constructor(aiConfig, globalVoiceConfig, tenantVoiceConfig) {
    this.updateConfig(aiConfig, globalVoiceConfig, tenantVoiceConfig);
  }

  /**
   * Update AI and voice configurations
   * @param {Object} aiConfig - AI configuration
   * @param {Object} globalVoiceConfig - Global voice configuration (provider, apiKey)
   * @param {Object} tenantVoiceConfig - Tenant-specific voice configuration (voiceName, etc.)
   */
  updateConfig(aiConfig, globalVoiceConfig, tenantVoiceConfig) {
    this.aiConfig = aiConfig;
    this.voiceConfig = { ...globalVoiceConfig, ...tenantVoiceConfig };
    
    // Initialize voice service client
    if (this.voiceConfig.provider === 'deepgram') {
      this.deepgram = createClient(this.voiceConfig.apiKey);
    }
  }

  /**
   * Generate AI response
   * @param {Array} messages - Conversation messages
   * @param {string} systemPrompt - Agent prompt
   * @param {string} conversationId - Conversation ID for context
   * @returns {Promise<Object>} AI response with metadata
   */
  async generateResponse(messages, systemPrompt, conversationId) {
    try {
      const conversationMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({ role: msg.role, content: msg.content }))
      ];

      let response;
      
      switch (this.aiConfig.provider) {
        case 'openai':
          response = await this._generateOpenAIResponse(conversationMessages);
          break;
        case 'anthropic':
          response = await this._generateAnthropicResponse(conversationMessages);
          break;
        case 'openrouter':
          response = await this._generateOpenRouterResponse(conversationMessages);
          break;
        case 'azure':
          response = await this._generateAzureResponse(conversationMessages);
          break;
        default:
          throw new Error(`Unsupported AI provider: ${this.aiConfig.provider}`);
      }

      // Analyze for transfer requests and other intents
      const analysis = this._analyzeResponse(response);

      return {
        response: response.trim(),
        transferRequested: analysis.transferRequested,
        transferReason: analysis.transferReason,
        intent: analysis.intent,
        confidence: analysis.confidence
      };
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }

  /**
   * Transcribe audio using Deepgram ASR
   * @param {Buffer} audioBuffer - Audio buffer to transcribe
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioBuffer) {
    try {
      if (this.voiceConfig.provider !== 'deepgram') {
        throw new Error(`ASR only supported for Deepgram provider, got: ${this.voiceConfig.provider}`);
      }

      const response = await this.deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2', // Deepgram's latest model
          smart_format: true,
          punctuate: true,
          language: 'en-US'
        }
      );

      if (response.result && response.result.results && response.result.results.channels[0]) {
        return response.result.results.channels[0].alternatives[0].transcript || '';
      }

      return '';
    } catch (error) {
      console.error('Error transcribing audio:', error);
      return '';
    }
  }
  async generateTTS(text, voice) {
    try {
      const voiceToUse = voice || this.voiceConfig.voiceName;
      let audioUrl;
      
      switch (this.voiceConfig.provider) {
        case 'deepgram':
          audioUrl = await this._generateDeepgramTTS(text, voiceToUse);
          break;
        case 'elevenlabs':
          audioUrl = await this._generateElevenLabsTTS(text, voiceToUse);
          break;
        case 'azure':
          audioUrl = await this._generateAzureTTS(text, voiceToUse);
          break;
        default:
          throw new Error(`Unsupported voice provider: ${this.voiceConfig.provider}`);
      }

      return {
        url: audioUrl,
        text: text,
        voice: voiceToUse
      };
    } catch (error) {
      console.error('Error generating TTS:', error);
      throw error;
    }
  }

  /**
   * Analyze conversation for insights
   * @param {string} transcript - Full conversation transcript
   * @param {Array} messages - Message array
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeConversation(transcript, messages) {
    try {
      const analysisPrompt = `
        Analyze this customer service conversation and provide insights:
        
        ${transcript}
        
        Please rate the conversation on a scale of 1-10 and provide:
        1. Overall rating (1-10)
        2. Sentiment analysis
        3. Key topics discussed
        4. Resolution status
        5. Areas for improvement
        
        Respond in JSON format only.
      `;

      const analysis = await this.generateResponse(
        [{ role: 'user', content: analysisPrompt }],
        'You are a conversation analyst. Provide objective analysis in JSON format.',
        'analysis'
      );

      try {
        const parsed = JSON.parse(analysis.response);
        return {
          rating: parsed.rating || 5,
          sentiment: parsed.sentiment || 'neutral',
          topics: parsed.topics || [],
          resolved: parsed.resolved || false,
          improvements: parsed.improvements || [],
          categories: this._categorizeConversation(transcript)
        };
      } catch (parseError) {
        // Fallback analysis
        return {
          rating: 5,
          sentiment: 'neutral',
          topics: ['general inquiry'],
          resolved: false,
          improvements: ['Unable to analyze'],
          categories: ['general']
        };
      }
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      return {
        rating: 1,
        sentiment: 'error',
        topics: ['analysis failed'],
        resolved: false,
        improvements: ['Analysis error'],
        categories: ['error']
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Cleanup temporary files, close connections, etc.
    console.log('TenantAIService cleanup completed');
  }

  // Private methods for different AI providers
  async _generateOpenAIResponse(messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.aiConfig.model || 'gpt-4o-mini',
        messages: messages,
        max_tokens: this.aiConfig.maxTokens || 75,
        temperature: this.aiConfig.temperature || 0.6
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async _generateAnthropicResponse(messages) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.aiConfig.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.aiConfig.model || 'claude-3-haiku-20240307',
        max_tokens: this.aiConfig.maxTokens || 75,
        temperature: this.aiConfig.temperature || 0.6,
        messages: messages.filter(msg => msg.role !== 'system'),
        system: messages.find(msg => msg.role === 'system')?.content || ''
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  async _generateOpenRouterResponse(messages) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiConfig.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.aiConfig.model || 'openai/gpt-4o-mini',
        messages: messages,
        max_tokens: this.aiConfig.maxTokens || 75,
        temperature: this.aiConfig.temperature || 0.6
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async _generateAzureResponse(messages) {
    const response = await fetch(this.aiConfig.endpoint, {
      method: 'POST',
      headers: {
        'api-key': this.aiConfig.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: messages,
        max_tokens: this.aiConfig.maxTokens || 75,
        temperature: this.aiConfig.temperature || 0.6
      })
    });

    if (!response.ok) {
      throw new Error(`Azure API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async _generateDeepgramTTS(text, voice) {
    try {
      const response = await this.deepgram.speak.request(
        { text },
        {
          model: voice || 'aura-asteria-en',
          encoding: 'linear16',
          sample_rate: 48000
        }
      );

      const stream = await response.getStream();
      const buffer = await this._streamToBuffer(stream);
      
      // Save to temporary file
      const fileName = `tts_${uuidv4()}.wav`;
      const filePath = path.join(process.cwd(), 'temp', fileName);
      
      // Ensure temp directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, buffer);

      return `/temp/${fileName}`;
    } catch (error) {
      console.error('Deepgram TTS error:', error);
      throw error;
    }
  }

  async _generateElevenLabsTTS(text, voice) {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.voiceConfig.apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    
    // Save to temporary file
    const fileName = `tts_${uuidv4()}.mp3`;
    const filePath = path.join(process.cwd(), 'temp', fileName);
    
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    return `/temp/${fileName}`;
  }

  async _generateAzureTTS(text, voice) {
    // Implementation for Azure TTS
    throw new Error('Azure TTS not implemented yet');
  }

  _analyzeResponse(response) {
    const transferKeywords = ['transfer', 'human', 'representative', 'agent', 'speak to someone', 'escalate'];
    const lowerResponse = response.toLowerCase();
    
    const transferRequested = transferKeywords.some(keyword => 
      lowerResponse.includes(keyword)
    );

    return {
      transferRequested,
      transferReason: transferRequested ? 'Customer requested human assistance' : null,
      intent: this._detectIntent(response),
      confidence: 0.8
    };
  }

  _detectIntent(response) {
    const intents = {
      greeting: ['hello', 'hi', 'good morning', 'good afternoon'],
      question: ['what', 'how', 'when', 'where', 'why', '?'],
      complaint: ['problem', 'issue', 'wrong', 'error', 'not working'],
      compliment: ['great', 'excellent', 'good job', 'thank you'],
      goodbye: ['bye', 'goodbye', 'thank you', 'have a good day']
    };

    const lowerResponse = response.toLowerCase();
    
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerResponse.includes(keyword))) {
        return intent;
      }
    }
    
    return 'general';
  }

  _categorizeConversation(transcript) {
    const categories = {
      sales: ['buy', 'purchase', 'price', 'cost', 'order'],
      support: ['help', 'problem', 'issue', 'not working', 'broken'],
      billing: ['bill', 'payment', 'charge', 'refund', 'invoice'],
      general: ['information', 'about', 'question', 'hours']
    };

    const lowerTranscript = transcript.toLowerCase();
    const found = [];
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerTranscript.includes(keyword))) {
        found.push(category);
      }
    }
    
    return found.length > 0 ? found : ['general'];
  }

  async _streamToBuffer(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}

export { TenantAIService };