# Multi-Tenant Voice AI Backend Architecture

## Overview
Transform the current voice AI system into a modular, multi-tenant backend service that can be integrated into larger applications.

## Core Module: VoiceAIService

### Input Parameters
```typescript
interface TenantConfig {
  tenantId: string;
  twilioCredentials: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  aiConfig: {
    provider: 'openai' | 'anthropic' | 'openrouter' | 'azure';
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
  };
  voiceConfig: {
    provider: 'deepgram' | 'elevenlabs' | 'azure';
    apiKey: string;
    voiceName: string;
  };
  agentConfig: {
    name: string;
    type: 'inbound' | 'outbound' | 'both';
    prompt: string;
    description?: string;
  };
  contactDetails?: {
    name?: string;
    phone: string;
    email?: string;
  };
}
```

### Output Response
```typescript
interface CallResult {
  tenantId: string;
  callId: string;
  callSid: string;
  status: 'completed' | 'failed' | 'in-progress';
  recording?: {
    url: string;
    duration: number;
  };
  conversation: {
    transcript: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    analysis: {
      rating: number;
      sentiment: string;
      categories: string[];
      transferRequested: boolean;
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

## Architecture Components

### 1. Multi-Tenant Database Design
- **Tenant Isolation**: Schema per tenant or tenant_id column approach
- **Dynamic Connection Pool**: Per-tenant database connections
- **Data Encryption**: Tenant-specific encryption keys

### 2. Service Factory Pattern
- **TenantServiceFactory**: Creates isolated service instances per tenant
- **ConfigurationManager**: Manages tenant-specific configurations
- **ResourcePool**: Manages AI/Twilio resources per tenant

### 3. API Gateway Layer
- **Authentication**: Tenant API key validation
- **Rate Limiting**: Per-tenant rate limits
- **Request Routing**: Route requests to correct tenant instance

### 4. Webhook Management
- **Dynamic URL Generation**: Tenant-specific webhook URLs
- **Request Validation**: Verify requests belong to correct tenant
- **Event Routing**: Route webhooks to correct tenant handler

## Inbound vs Outbound Handling

### Single Service Approach (Recommended)
One unified service handling both inbound and outbound with configuration:

**Advantages:**
- Shared conversation logic
- Unified analytics
- Simpler deployment
- Common security model

### Separate Services Approach
Split into InboundVoiceAI and OutboundVoiceAI services:

**Advantages:**
- Specialized optimizations
- Different scaling requirements
- Isolated failure domains

### Multi-Tenant Inbound Handling Options

#### Option 1: Subdomain Routing
```
tenant1.voiceai.com/webhook -> Tenant 1
tenant2.voiceai.com/webhook -> Tenant 2
```

#### Option 2: Path-based Routing
```
api.voiceai.com/webhook/tenant1 -> Tenant 1
api.voiceai.com/webhook/tenant2 -> Tenant 2
```

#### Option 3: Phone Number Mapping
- Map Twilio phone numbers to tenants
- Route based on called number
- Support multiple numbers per tenant

## Implementation Strategy

### Phase 1: Core Module Extraction
1. Extract VoiceAIService class
2. Implement tenant configuration
3. Add multi-tenant database layer

### Phase 2: Service Factory
1. Create TenantServiceFactory
2. Implement resource pooling
3. Add configuration management

### Phase 3: API Gateway
1. Build REST API wrapper
2. Add authentication layer
3. Implement webhook routing

### Phase 4: Production Features
1. Monitoring and logging
2. Error handling and recovery
3. Scaling and load balancing

## Deployment Options

### 1. Microservice Architecture
- Separate service per tenant
- Auto-scaling based on usage
- Isolated resource consumption

### 2. Shared Multi-Tenant Service
- Single service instance
- Tenant isolation through configuration
- Shared resource pooling

### 3. Hybrid Approach
- Shared service for small tenants
- Dedicated instances for large tenants
- Migration path between approaches