import { TenantServiceFactory } from './TenantServiceFactory.js';
import { ConfigurationManager } from './ConfigurationManager.js';
import { TenantDatabase } from './TenantDatabase.js';
import { WebhookManager } from './WebhookManager.js';
import { v4 as uuidv4 } from 'uuid';
import { globalConfig, validateGlobalConfig } from '../config/global-config.js';

/**
 * Multi-Tenant Voice AI Service
 * Core module for handling voice AI operations across multiple tenants
 */
class VoiceAIService {
  constructor() {
    this.serviceFactory = new TenantServiceFactory();
    this.configManager = new ConfigurationManager();
    this.webhookManager = new WebhookManager();
    this.activeCalls = new Map();
    this.globalConfig = globalConfig;
  }

  /**
   * Initialize the service (loads global config)
   */
  async initialize() {
    try {
      // Validate global configuration
      validateGlobalConfig(this.globalConfig);

      // Store global configuration in encrypted storage
      await this.configManager.storeGlobalConfig(this.globalConfig);

      console.log('Voice AI Service initialized with global configuration');
    } catch (error) {
      console.error('Error initializing Voice AI Service:', error);
      throw error;
    }
  }

  /**
   * Make an outbound call for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {Object} callConfig - Call configuration with agent and contact data
   * @returns {Promise<Object>} Call result
   */
  async makeOutboundCall(tenantId, callConfig) {
    const {
      contactDetails,
      agentConfig, // Now passed directly in request
      twilioConfig, // Twilio credentials passed directly
      aiConfig, // AI config passed directly
      voiceConfig // Voice config passed directly
    } = callConfig;

    try {
      // Get tenant services with provided configs
      const services = await this.serviceFactory.createTenantServicesWithConfig(
        tenantId, 
        { twilioConfig, aiConfig, voiceConfig }
      );

      // Generate unique call ID
      const callId = uuidv4();

      // Create webhook URL for this specific call
      const webhookUrl = this.webhookManager.generateCallWebhookUrl(tenantId, callId);

      // Initialize call in database
      const conversation = await services.database.createConversation({
        id: callId,
        tenantId,
        direction: 'outbound',
        customerNumber: contactDetails.phone,
        agentConfig: agentConfig,
        status: 'initiated'
      });

      // Make the call via Twilio
      const callResult = await services.twilio.makeOutboundCall(
        contactDetails.phone,
        callId,
        webhookUrl
      );

      // Store call mapping
      this.activeCalls.set(callResult.callSid, {
        tenantId,
        callId,
        conversation,
        services
      });

      return {
        tenantId,
        callId,
        callSid: callResult.callSid,
        status: 'initiated',
        metadata: {
          startTime: new Date().toISOString(),
          direction: 'outbound',
          customerNumber: contactDetails.phone
        }
      };
    } catch (error) {
      console.error(`Error making outbound call for tenant ${tenantId}:`, error);
      throw new Error(`Failed to initiate call: ${error.message}`);
    }
  }

  /**
   * Handle inbound call for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {Object} twilioRequest - Twilio webhook request
   * @param {Object} callConfig - Call configuration with agent and service configs
   * @returns {Promise<string>} TwiML response
   */
  async handleInboundCall(tenantId, twilioRequest, callConfig = {}) {
    const {
      agentConfig,
      twilioConfig,
      aiConfig,
      voiceConfig
    } = callConfig;

    try {
      // Get tenant services with provided configs
      const services = await this.serviceFactory.createTenantServicesWithConfig(
        tenantId,
        { twilioConfig, aiConfig, voiceConfig }
      );

      // Generate unique call ID
      const callId = uuidv4();

      // Create conversation record
      const conversation = await services.database.createConversation({
        id: callId,
        tenantId,
        direction: 'inbound',
        customerNumber: twilioRequest.from,
        callSid: twilioRequest.callSid,
        agentConfig: agentConfig,
        status: 'active'
      });

      // Store call mapping
      this.activeCalls.set(twilioRequest.callSid, {
        tenantId,
        callId,
        conversation,
        services
      });

      // Generate initial TwiML (consent flow)
      const webhookUrl = this.webhookManager.generateCallWebhookUrl(tenantId, callId);
      return services.twilio.generateConsentTwiml(webhookUrl);
    } catch (error) {
      console.error(`Error handling inbound call for tenant ${tenantId}:`, error);
      const services = await this.serviceFactory.createTenantServicesWithConfig(
        tenantId,
        { twilioConfig, aiConfig, voiceConfig }
      );
      return services.twilio.generateErrorTwiml();
    }
  }

  /**
   * Handle ongoing call interaction
   * @param {string} tenantId - Tenant identifier
   * @param {string} callId - Call identifier
   * @param {Object} twilioRequest - Twilio webhook request
   * @returns {Promise<string>} TwiML response
   */
  async handleCallInteraction(tenantId, callId, twilioRequest) {
    try {
      const callData = this.activeCalls.get(twilioRequest.callSid);
      if (!callData || callData.tenantId !== tenantId) {
        throw new Error('Call not found or tenant mismatch');
      }

      const { services, conversation } = callData;

      // Process the interaction
      if (twilioRequest.speechResult) {
        // Add user message
        await services.database.addMessage(callId, 'user', twilioRequest.speechResult);

        // Get conversation history
        const messages = await services.database.getMessages(callId);

        // Generate AI response
        const aiResult = await services.ai.generateResponse(
          messages,
          conversation.agentConfig.prompt,
          callId
        );

        // Add AI response
        await services.database.addMessage(callId, 'assistant', aiResult.response);

        // Generate TTS
        const ttsResult = await services.ai.generateTTS(
          aiResult.response,
          conversation.agentConfig.voice
        );

        // Handle special cases (transfer, etc.)
        if (aiResult.transferRequested) {
          await this._handleTransferRequest(callData, aiResult);
          return services.twilio.generateTransferTwiml(
            ttsResult.url,
            this.webhookManager.generateCallWebhookUrl(tenantId, callId, 'transfer')
          );
        }

        // Generate standard response TwiML
        return services.twilio.generateTwiml(
          ttsResult.url,
          this.webhookManager.generateCallWebhookUrl(tenantId, callId)
        );
      }

      // Handle other interaction types (DTMF, etc.)
      return services.twilio.generateTwiml();
    } catch (error) {
      console.error(`Error handling call interaction:`, error);
      const services = await this.serviceFactory.getTenantServices(tenantId);
      return services.twilio.generateErrorTwiml();
    }
  }

  /**
   * Get call result for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {string} callId - Call identifier
   * @returns {Promise<Object>} Call result
   */
  async getCallResult(tenantId, callId) {
    try {
      const services = await this.serviceFactory.getTenantServices(tenantId);
      const conversation = await services.database.getConversation(callId);
      
      if (!conversation || conversation.tenantId !== tenantId) {
        throw new Error('Call not found or access denied');
      }

      // Parse transcription JSON or fall back to querying messages
      let messages = [];
      if (conversation.transcription) {
        try {
          messages = JSON.parse(conversation.transcription);
        } catch (error) {
          console.warn('Failed to parse transcription JSON, falling back to message query');
          messages = await services.database.getMessages(callId);
        }
      } else {
        messages = await services.database.getMessages(callId);
      }
      
      // Generate analysis if not already done
      let analysis = conversation.analysis;
      if (!analysis && conversation.status === 'completed') {
        const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        analysis = await services.ai.analyzeConversation(transcript, messages);
        
        // Store analysis
        await services.database.updateConversation(callId, {
          analysis: JSON.stringify(analysis),
          rating: analysis.rating
        });
      }

      return {
        tenantId,
        callId,
        callSid: conversation.callSid,
        status: conversation.status,
        recording: conversation.recordingUrl ? {
          url: `/api/voice/${tenantId}/calls/${callId}/recording`,
          duration: conversation.duration
        } : null,
        conversation: {
          transcript: messages,
          analysis: analysis ? JSON.parse(analysis) : null
        },
        metadata: {
          startTime: conversation.createdAt,
          endTime: conversation.completedAt,
          direction: conversation.direction,
          customerNumber: conversation.customerNumber,
          duration: conversation.duration
        }
      };
    } catch (error) {
      console.error(`Error getting call result for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Handle call completion
   * @param {string} callSid - Twilio call SID
   * @param {Object} statusData - Call status data from Twilio
   */
  async handleCallCompletion(callSid, statusData) {
    const callData = this.activeCalls.get(callSid);
    if (!callData) {
      console.warn(`Call completion received for unknown call: ${callSid}`);
      return;
    }

    try {
      const { tenantId, callId, services } = callData;

      // Get all messages for this conversation
      const messages = await services.database.getMessages(callId);
      
      // Build JSON transcription array
      const transcriptionJson = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      // Update conversation with final status and consolidated transcription
      await services.database.updateConversation(callId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        duration: statusData.callDuration,
        recordingUrl: statusData.recordingUrl,
        transcription: JSON.stringify(transcriptionJson)
      });

      // Generate final analysis
      if (messages.length > 0) {
        const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const analysis = await services.ai.analyzeConversation(transcript, messages);
        
        await services.database.updateConversation(callId, {
          analysis: JSON.stringify(analysis),
          rating: analysis.rating,
          success: analysis.rating >= 7
        });
      }

      // Clean up active call
      this.activeCalls.delete(callSid);

      console.log(`Call completed for tenant ${tenantId}: ${callId}`);
    } catch (error) {
      console.error(`Error handling call completion:`, error);
    }
  }

  /**
   * Get tenant analytics
   * @param {string} tenantId - Tenant identifier
   * @param {Object} filters - Analytics filters
   * @returns {Promise<Object>} Analytics data
   */
  async getTenantAnalytics(tenantId, filters = {}) {
    try {
      // For analytics, we need to create services with default/global config
      // This is a simplified approach - in production you'd want proper tenant config
      const services = await this.serviceFactory.createTenantServicesWithConfig(
        tenantId,
        this.globalConfig
      );
      const analytics = await services.database.getAnalytics(filters);
      return {
        tenantId,
        ...analytics
      };
    } catch (error) {
      console.error(`Error getting analytics for tenant ${tenantId}:`, error);
      throw error;
    }
  }  // Private methods
  _validateTenantConfig(config) {
    const required = ['tenantId', 'twilioCredentials', 'aiConfig', 'voiceConfig', 'agentConfig'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }

    // Validate nested objects
    if (!config.twilioCredentials.accountSid || !config.twilioCredentials.authToken) {
      throw new Error('Invalid Twilio credentials');
    }

    if (!config.aiConfig.provider || !config.aiConfig.apiKey) {
      throw new Error('Invalid AI configuration');
    }

    if (!config.voiceConfig.voiceName) {
      throw new Error('Voice configuration must include voiceName');
    }

    if (!config.agentConfig.name || !config.agentConfig.prompt) {
      throw new Error('Invalid agent configuration');
    }
  }

  async _handleTransferRequest(callData, aiResult) {
    const { tenantId, callId, services } = callData;
    
    // Create callback request
    await services.database.createCallbackRequest({
      conversationId: callId,
      tenantId,
      reason: aiResult.transferReason,
      status: 'pending'
    });

    console.log(`Transfer requested for tenant ${tenantId}, call ${callId}`);
  }
}

export { VoiceAIService };