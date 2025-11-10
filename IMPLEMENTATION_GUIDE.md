# Voice AI Workflow Processor - Implementation Guide

## Overview

This implementation provides a **streamlined voice AI workflow processor** that focuses exclusively on AI-powered voice conversations. The system accepts all necessary configurations (agent, contact, service credentials) directly in API requests and returns conversations with tenant identification.

## ✅ **What This Solves**

### **Core AI Workflow**
- ✅ **Direct Config Injection**: All configurations passed directly in API requests
- ✅ **No Persistent Storage**: No management of agents, contacts, or tenant configurations
- ✅ **Tenant Isolation**: Tenant identification via URL paths with isolated conversation storage
- ✅ **Unified Processing**: Single service handles both inbound and outbound AI calls

### **Simplified Integration**
- ✅ **Stateless Operation**: Each request contains all required data
- ✅ **Flexible Deployment**: Easy integration into existing applications
- ✅ **JSON Conversations**: Complete conversation transcripts stored as JSON
- ✅ **Webhook Support**: Twilio webhook handling with config injection

## 🏗️ **Architecture Components**

### **Core Module Structure**
```
core/
├── VoiceAIService.js         # Main service orchestrator (accepts direct configs)
├── TenantServiceFactory.js   # Service instance management with configs
├── TenantDatabase.js         # Isolated tenant conversation databases
├── VoiceAIApiServer.js       # Express.js API wrapper
├── WebhookManager.js         # URL generation for tenant-specific webhooks
├── server.js                 # Production server entry point
└── services/
    ├── TenantTwilioService.js # Tenant-specific Twilio client
    └── TenantAIService.js     # Tenant-specific AI/Voice client
```

### **Key Features**

#### **1. VoiceAIService - Main Orchestrator**
- **Direct Config Processing**: Accepts agent, contact, and service configs in each request
- **Call Orchestration**: Handle both inbound and outbound calls with provided configs
- **Tenant Isolation**: Conversation storage isolated by tenant_id from URL paths
- **Call Lifecycle**: From initiation to completion with full analytics

#### **2. Webhook URL Generation**
- **Tenant-Specific URLs**: Generate webhook URLs that include tenant identification
- **Config-Based Generation**: URLs generated using tenant details provided in requests
- **Secure URL Construction**: Proper encoding and validation of tenant parameters
- **Flexible Routing**: Support for different URL patterns based on tenant needs

## 🚀 **Quick Start Guide**

### **1. Basic Usage**

```javascript
import { VoiceAIService } from './core/VoiceAIService.js';

const voiceAI = new VoiceAIService();

// No tenant initialization needed - configs passed directly in requests
```

### **2. Make Outbound Call**

```javascript
const callResult = await fetch('/api/voice/company-abc/outbound', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contactDetails: {
      name: 'John Doe',
      phone: '+1987654321'
    },
    agentConfig: {
      name: 'Sarah',
      prompt: 'You are Sarah, a helpful customer service agent...',
      voice: 'aura-asteria-en'
    },
    twilioConfig: {
      accountSid: 'AC123...',
      authToken: 'your-token',
      phoneNumber: '+1234567890'
    },
    aiConfig: {
      provider: 'openai',
      apiKey: 'sk-...',
      model: 'gpt-4o-mini'
    },
    voiceConfig: {
      provider: 'deepgram',
      apiKey: 'your-deepgram-key',
      voiceName: 'aura-asteria-en'
    }
  })
});

const result = await callResult.json();
console.log('Call initiated:', result.callId);
```

### **3. Handle Inbound Call (Webhook)**

Twilio will POST to `/api/voice/{tenantId}/inbound` with call data. The system expects the agent config and service credentials to be provided in the webhook payload:

```javascript
// Twilio webhook payload should include:
{
  "CallSid": "CA123...",
  "From": "+1987654321",
  "To": "+1234567890",
  "agentConfig": {
    "name": "Sarah",
    "prompt": "You are Sarah, a helpful customer service agent...",
    "voice": "aura-asteria-en"
  },
  "aiConfig": {
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4o-mini"
  },
  "voiceConfig": {
    "provider": "deepgram",
    "apiKey": "your-deepgram-key",
    "voiceName": "aura-asteria-en"
  }
}
```

### **4. Get Call Results**

```javascript
const response = await fetch('/api/voice/company-abc/calls/call-123');
const result = await response.json();

console.log('Tenant ID:', result.tenantId);
console.log('Conversation:', result.conversation.transcript);
console.log('Rating:', result.conversation.analysis.rating);
console.log('Recording:', result.recording.url);
```

### **5. Production API Server**

```javascript
import { VoiceAIApiServer } from './core/VoiceAIApiServer.js';

const server = new VoiceAIApiServer({ port: 3000 });
await server.start();

// API endpoints automatically available:
// POST /api/voice/{tenant}/outbound    - Make call with all configs in request body
// GET  /api/voice/{tenant}/calls/{id}  - Get conversation results (includes tenant_id)
// GET  /api/voice/{tenant}/analytics   - Get analytics for tenant
// POST /api/voice/{tenant}/inbound     - Twilio webhook (configs in payload)
// POST /api/voice/{tenant}/calls/{id}  - Handle call interactions
// POST /api/voice/{tenant}/status      - Call status updates
// GET  /api/voice/{tenant}/calls/{id}/recording - Get call recordings
```

## 🔄 **Inbound Call Routing**

### **Tenant Identification**
Since tenant configurations are not stored, you need to identify tenants through URL routing or webhook payload data. Here are recommended approaches:

### **Option 1: URL Path Routing (Recommended)**
- **Implementation**: `yourapp.com/api/voice/{tenantId}/inbound`
- **Pros**: Simple, clear tenant identification
- **Webhook Config**: Use URL generation to create tenant-specific webhook URLs
- **Setup**: Generate URLs dynamically when configuring Twilio numbers

### **Option 2: Phone Number Mapping**
- **Implementation**: Map Twilio phone numbers to tenant IDs in your application
- **Pros**: Works with existing phone number setups
- **Cons**: Requires maintaining number-to-tenant mapping

```javascript
// Example mapping in your application
const phoneToTenant = {
  '+1234567890': 'company-a',
  '+1234567891': 'company-b'
};
```

### **Option 3: Payload-Based Routing**
- **Implementation**: Include tenant identifier in webhook payload
- **Pros**: Flexible routing logic
- **Cons**: Requires custom webhook processing

## 📊 **Response Format**

### **Call Result Response**
```typescript
interface CallResult {
  tenantId: string;           // Tenant identifier from URL path
  callId: string;             // Unique call identifier
  callSid: string;            // Twilio call SID
  status: 'completed' | 'failed' | 'in-progress';
  recording?: {
    url: string;              // Proxied recording URL
    duration: number;         // Duration in seconds
  };
  conversation: {
    transcript: Array<{       // Complete conversation as JSON array
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    analysis: {
      rating: number;         // 1-10 call quality rating
      sentiment: string;      // positive/negative/neutral
      categories: string[];   // ['sales', 'support', etc.]
      transferRequested: boolean;
      resolved: boolean;
    };
  };
  metadata: {
    startTime: string;
    endTime?: string;
    direction: 'inbound' | 'outbound';
    customerNumber: string;
    duration?: number;
  };
}
```

### **Analytics Response**
```typescript
interface TenantAnalytics {
  tenantId: string;           // Tenant identifier
  total_calls: number;        // Total calls for this tenant
  successful_calls: number;   // Successfully completed calls
  avg_rating: number;         // Average call rating
  avg_duration: number;       // Average call duration
  inbound_calls: number;      // Number of inbound calls
  outbound_calls: number;     // Number of outbound calls
  categories: Array<{         // Call categories breakdown
    category: string;
    count: number;
  }>;
}
```

## 🔒 **Security Features**

### **Data Isolation**
- **Database**: Separate SQLite file per tenant for conversation data only
- **Credentials**: No persistent storage - credentials handled in memory per request
- **API**: Tenant isolation via URL paths
- **Webhooks**: Request validation and tenant verification

### **Request Security**
- **Input Validation**: Comprehensive validation of all config parameters
- **Memory Management**: Credentials not persisted, cleaned up after each request
- **Error Handling**: Secure error messages without exposing sensitive data
- **Rate Limiting**: Per-tenant request rate limiting

## 🚀 **Deployment Options**

### **1. Single Service Deployment**
```bash
# Deploy as single service handling all tenants
npm start
# Handles requests for any tenant via URL paths
```

### **2. Load Balanced Deployment**
```bash
# Deploy multiple instances behind a load balancer
# Each instance handles requests for any tenant
# Load balancer routes based on tenant ID for session affinity if needed
```

### **3. Containerized Deployment**
```bash
# Docker deployment
docker build -t voice-ai-processor .
docker run -p 3000:3000 voice-ai-processor
```

## 📈 **Scaling Considerations**

### **Horizontal Scaling**
- **Load Balancer**: Distribute requests across multiple instances
- **Database**: Separate databases per tenant (no shared state)
- **Stateless**: Each request contains all necessary data
- **Session Affinity**: Optional for long-running calls

### **Performance Optimization**
- **Connection Pooling**: Efficient database connections per tenant
- **Caching**: Optional Redis for frequently accessed data
- **CDN**: Static assets and audio files if needed
- **Monitoring**: Request metrics and performance tracking

## 🔧 **Configuration Management**

### **Direct Config Injection**
The system no longer stores tenant configurations persistently. Instead, all required configurations (agent, AI, voice, Twilio) are provided directly in API requests. This simplifies deployment and eliminates data management overhead.

### **Request Configuration Schema**
```javascript
const callRequest = {
  contactDetails: {
    name: string,              // Contact name
    phone: string              // Contact phone number
  },
  agentConfig: {
    name: string,              // Agent name
    prompt: string,            // Agent instructions
    voice: string              // Voice model name
  },
  twilioConfig: {
    accountSid: string,        // Twilio Account SID
    authToken: string,         // Twilio Auth Token
    phoneNumber: string        // Twilio phone number
  },
  aiConfig: {
    provider: 'openai' | 'anthropic' | 'openrouter' | 'azure',
    apiKey: string,            // AI API key
    model: string,             // Model name
    maxTokens?: number,        // Response length limit
    temperature?: number       // Response creativity
  },
  voiceConfig: {
    provider: 'deepgram' | 'elevenlabs' | 'azure',
    apiKey: string,            // Voice API key
    voiceName: string          // Voice model name
  }
};
```

## 🌐 **Webhook URL Generation**

### **Tenant-Based URL Generation**
The system provides URL generation functionality that creates tenant-specific webhook URLs using tenant details provided in requests. This allows proper routing of Twilio webhooks without storing tenant configurations.

### **URL Generation with Tenant Details**
```javascript
import { WebhookManager } from './core/WebhookManager.js';

const webhookManager = new WebhookManager();

// Generate webhook URLs using tenant details
const tenantDetails = {
  tenantId: 'company-abc',
  webhookBaseUrl: 'https://your-app.com'
};

const webhooks = await webhookManager.setupTenantWebhooks(
  tenantDetails.tenantId, 
  tenantDetails.webhookBaseUrl
);

// Result:
// {
//   inbound: 'https://your-app.com/api/voice/company-abc/inbound',
//   outbound: 'https://your-app.com/api/voice/company-abc/outbound',
//   status: 'https://your-app.com/api/voice/company-abc/status',
//   recording: 'https://your-app.com/api/voice/company-abc/recording'
// }
```

### **Dynamic URL Generation for Twilio Setup**
```javascript
// When configuring Twilio numbers dynamically
async function configureTwilioForTenant(tenantDetails, twilioClient) {
  const webhookManager = new WebhookManager();
  
  // Generate URLs using tenant details
  const webhooks = await webhookManager.setupTenantWebhooks(
    tenantDetails.tenantId,
    tenantDetails.webhookBaseUrl
  );
  
  // Configure Twilio phone number with generated URLs
  const phoneConfig = webhookManager.generatePhoneNumberConfig(
    tenantDetails.tenantId,
    tenantDetails.phoneNumber
  );
  
  await twilioClient.incomingPhoneNumbers.create(phoneConfig);
  
  return webhooks;
}
```

### **URL Patterns Supported**
- **Path-based routing**: `/api/voice/{tenantId}/inbound`
- **Call-specific URLs**: `/api/voice/{tenantId}/calls/{callId}`
- **Status callbacks**: `/api/voice/{tenantId}/status`
- **Recording access**: `/api/voice/{tenantId}/calls/{callId}/recording`

### **Outbound Call Integration**
```javascript
// Example: Integrating with your CRM system
async function makeAICall(tenantId, contact, agentConfig, serviceCreds) {
  const response = await fetch(`/api/voice/${tenantId}/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contactDetails: contact,
      agentConfig: agentConfig,
      twilioConfig: serviceCreds.twilio,
      aiConfig: serviceCreds.ai,
      voiceConfig: serviceCreds.voice
    })
  });

  const result = await response.json();
  return result; // Includes tenant_id in response
}
```

### **Inbound Webhook Setup**
```javascript
// Twilio webhook handler in your application
app.post('/webhook/:tenantId', async (req, res) => {
  const { tenantId } = req.params;

  // Get configs from your system (database, env vars, etc.)
  const configs = await getTenantConfigs(tenantId);

  // Forward to AI processor with configs
  const response = await fetch(`/api/voice/${tenantId}/inbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...req.body, // Twilio webhook data
      ...configs   // Your agent/AI/voice configs
    })
  });

  const result = await response.json();
  res.json(result);
});

// URL Generation for Twilio Setup
import { WebhookManager } from './core/WebhookManager.js';

async function setupTenantPhoneNumber(tenantDetails) {
  const webhookManager = new WebhookManager();
  
  // Generate webhook URLs for this tenant
  const webhooks = await webhookManager.setupTenantWebhooks(
    tenantDetails.tenantId,
    tenantDetails.webhookBaseUrl
  );
  
  // Configure Twilio with generated URLs
  const phoneConfig = webhookManager.generatePhoneNumberConfig(
    tenantDetails.tenantId,
    tenantDetails.phoneNumber
  );
  
  return { webhooks, phoneConfig };
}
```

## 🎯 **Production Checklist**

### **Simplified Deployment**
- [ ] Single service deployment (no tenant management complexity)
- [ ] Direct config validation in API requests
- [ ] Tenant isolation via URL paths only
- [ ] JSON conversation storage validation
- [ ] Webhook URL generation for Twilio setup

### **Security**
- [ ] API request payload validation
- [ ] Credential handling in memory only (no storage)
- [ ] Rate limiting per tenant
- [ ] Input sanitization for all configs

### **Operations**
- [ ] Health check endpoints
- [ ] Error handling for missing/invalid configs
- [ ] Logging of conversation metadata
- [ ] Monitoring of call success rates

This streamlined architecture provides a **production-ready AI workflow processor** that focuses on core functionality while maintaining tenant isolation and security.