import { VoiceAIService } from './VoiceAIService.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

/**
 * Multi-Tenant Voice AI API Server
 * Express.js wrapper for the VoiceAIService core module
 */
class VoiceAIApiServer {
  constructor(options = {}) {
    this.app = express();
    this.port = options.port || 3000;
    this.voiceAI = new VoiceAIService();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", "https:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      }
    }));

    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });

    // Tenant authentication middleware
    this.app.use('/api/voice/:tenantId/*', this.authenticateTenant.bind(this));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Voice AI operations - Core workflow only
    this.app.post('/api/voice/:tenantId/outbound', this.makeOutboundCall.bind(this));
    this.app.get('/api/voice/:tenantId/calls/:callId', this.getCallResult.bind(this));
    this.app.get('/api/voice/:tenantId/analytics', this.getTenantAnalytics.bind(this));

    // Webhook endpoints for Twilio
    this.app.post('/api/voice/:tenantId/inbound', this.handleInboundCall.bind(this));
    this.app.post('/api/voice/:tenantId/calls/:callId', this.handleCallInteraction.bind(this));
    this.app.post('/api/voice/:tenantId/status', this.handleCallStatus.bind(this));
    this.app.get('/api/voice/:tenantId/calls/:callId/recording', this.getCallRecording.bind(this));

    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }

  // Middleware
  async authenticateTenant(req, res, next) {
    try {
      const tenantId = req.params.tenantId;
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;

      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      // Validate tenant exists and API key is correct
      // In production, this would check against a secure tenant registry
      const isValid = await this.validateTenantApiKey(tenantId, apiKey);
      
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid tenant or API key' });
      }

      req.tenantId = tenantId;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Authentication error' });
    }
  }

  // Route handlers
    async makeOutboundCall(req, res) {
      try {
        const { tenantId } = req.params;
        const callConfig = req.body;
        
        const result = await this.voiceAI.makeOutboundCall(tenantId, callConfig);
        
        res.status(201).json(result);
      } catch (error) {
        console.error('Error making outbound call:', error);
        res.status(400).json({ error: error.message });
      }
    }
  
    async getCallResult(req, res) {
      try {
        const { tenantId, callId } = req.params;
        
        const result = await this.voiceAI.getCallResult(tenantId, callId);
        
        res.json(result);
      } catch (error) {
        console.error('Error getting call result:', error);
        res.status(404).json({ error: error.message });
      }
    }
  
    async getTenantAnalytics(req, res) {
      try {
        const { tenantId } = req.params;
        const filters = req.query;
        
        const analytics = await this.voiceAI.getTenantAnalytics(tenantId, filters);
        
        res.json(analytics);
      } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({ error: error.message });
      }
    }
  
    async handleInboundCall(req, res) {
      try {
        const { tenantId } = req.params;
        const callConfig = req.body.callConfig || {}; // Configs passed in request body
        
        const twiml = await this.voiceAI.handleInboundCall(tenantId, req.body, callConfig);
        
        res.type('text/xml').send(twiml);
      } catch (error) {
        console.error('Error handling inbound call:', error);
        const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response>
          <Say voice="alice">I'm sorry, we're experiencing technical difficulties. Please try calling again later.</Say>
          <Hangup/>
        </Response>`;
        res.type('text/xml').send(errorTwiml);
      }
    }
  
    async handleCallInteraction(req, res) {
      try {
        const { tenantId, callId } = req.params;
        
        const twiml = await this.voiceAI.handleCallInteraction(tenantId, callId, req.body);
        
        res.type('text/xml').send(twiml);
      } catch (error) {
        console.error('Error handling call interaction:', error);
        const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?><Response>
          <Say voice="alice">I'm sorry, there was an error. Please try again.</Say>
          <Hangup/>
        </Response>`;
        res.type('text/xml').send(errorTwiml);
      }
    }
  
    async handleCallStatus(req, res) {
      try {
        const { CallSid, CallStatus, RecordingUrl, CallDuration } = req.body;
        
        if (CallStatus === 'completed') {
          await this.voiceAI.handleCallCompletion(CallSid, {
            callDuration: CallDuration,
            recordingUrl: RecordingUrl
          });
        }
        
        res.sendStatus(200);
      } catch (error) {
        console.error('Error handling call status:', error);
        res.sendStatus(200); // Always respond 200 to Twilio
      }
    }
  
    async getCallRecording(req, res) {
      try {
        const { tenantId, callId } = req.params;
        
        const result = await this.voiceAI.getCallResult(tenantId, callId);
        
        if (!result.recording) {
          return res.status(404).json({ error: 'Recording not found' });
        }
        
        // Proxy the recording from Twilio
        const recordingResponse = await fetch(result.recording.url);
        
        if (!recordingResponse.ok) {
          return res.status(404).json({ error: 'Recording not accessible' });
        }
        
        const contentType = recordingResponse.headers.get('content-type') || 'audio/wav';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        recordingResponse.body.pipe(res);
      } catch (error) {
        console.error('Error getting call recording:', error);
        res.status(500).json({ error: 'Failed to get recording' });
      }
    }
  
    // Error handler
    errorHandler(error, req, res, next) {
      console.error('Unhandled error:', error);
      
      if (res.headersSent) {
        return next(error);
      }
      
      res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  
    // Utility methods
    async validateTenantApiKey(tenantId, apiKey) {
      // In production, this would check against a secure tenant registry
      // For now, we'll just check if the tenant exists
      try {
        await this.voiceAI.configManager.getTenantConfig(tenantId);
        return true; // Simplified validation
      } catch (error) {
        return false;
      }
    }
  
    // Server lifecycle
    async start() {
      try {
        // Initialize the voice AI service
        await this.voiceAI.configManager.initialize();
        
        // Start the server
        this.server = this.app.listen(this.port, () => {
          console.log(`Multi-Tenant Voice AI API Server running on port ${this.port}`);
          console.log(`Health check: http://localhost:${this.port}/health`);
        });
        
        return this.server;
      } catch (error) {
        console.error('Error starting server:', error);
        throw error;
      }
    }
  
    async stop() {
      if (this.server) {
        return new Promise((resolve) => {
          this.server.close(() => {
            console.log('Server stopped');
            resolve();
          });
        });
      }
    }
  }
  
  export { VoiceAIApiServer };