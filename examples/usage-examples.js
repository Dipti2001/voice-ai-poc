import { VoiceAIService } from './core/VoiceAIService.js';

/**
 * Usage Examples for Multi-Tenant Voice AI Service
 * 
 * This file demonstrates how to use the VoiceAIService for various operations
 * such as initializing the service, setting up tenants, making calls, and more.
 */

// Example 1: Initialize the service
const voiceAI = new VoiceAIService();

// Initialize the service (loads global config automatically)
async function initializeService() {
  try {
    await voiceAI.initialize();
    console.log('Voice AI Service initialized');
  } catch (error) {
    console.error('Error initializing service:', error);
  }
}

// Example 2: Setup a new tenant
const tenantConfig = {
  tenantId: 'company-abc-123',
  twilioCredentials: {
    accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with your Twilio Account SID
    authToken: 'your-twilio-auth-token',
    phoneNumber: '+1234567890'
  },
  aiConfig: {
    provider: 'openrouter', // or 'openai', 'anthropic', 'azure'
    apiKey: 'your-ai-api-key',
    model: 'openai/gpt-4o-mini',
    maxTokens: 75,
    temperature: 0.6
  },
  voiceConfig: {
    voiceName: 'aura-asteria-en' // Deepgram voice model (aura-asteria-en, aura-luna-en, etc.)
  },
  agentConfig: {
    name: 'Sarah',
    type: 'both', // 'inbound', 'outbound', or 'both'
    prompt: `You are Sarah, a friendly customer service representative for Company ABC. 
             You help customers with their inquiries and can transfer them to a human agent if needed.
             Keep responses concise and helpful.`,
    description: 'Customer service agent for Company ABC'
  },
  webhookBaseUrl: 'https://your-domain.com' // Your public webhook URL
};\n\n// Initialize tenant\nasync function setupTenant() {\n  try {\n    // First initialize the service if not already done\n    await initializeService();\n    \n    const tenantId = await voiceAI.initializeTenant(tenantConfig);\n    console.log('Tenant initialized:', tenantId);\n    return tenantId;\n  } catch (error) {\n    console.error('Error setting up tenant:', error);\n  }\n}\n\n// Example 3: Make an outbound call\nasync function makeOutboundCall(tenantId) {\n  try {\n    const callConfig = {\n      contactDetails: {\n        name: 'John Doe',\n        phone: '+1987654321',\n        email: 'john@example.com'\n      },\n      agentOverride: null // Optional: override default agent config\n    };\n\n    const result = await voiceAI.makeOutboundCall(tenantId, callConfig);\n    console.log('Outbound call initiated:', result);\n    \n    /*\n    Result format:\n    {\n      tenantId: 'company-abc-123',\n      callId: 'call-uuid-here',\n      callSid: 'CA1234567890abcdef1234567890abcdef',\n      status: 'initiated',\n      metadata: {\n        startTime: '2025-11-09T10:30:00.000Z',\n        direction: 'outbound',\n        customerNumber: '+1987654321'\n      }\n    }\n    */\n    \n    return result;\n  } catch (error) {\n    console.error('Error making outbound call:', error);\n  }\n}\n\n// Example 4: Get call result after completion\nasync function getCallResult(tenantId, callId) {\n  try {\n    const result = await voiceAI.getCallResult(tenantId, callId);\n    console.log('Call result:', result);\n    \n    /*\n    Result format:\n    {\n      tenantId: 'company-abc-123',\n      callId: 'call-uuid-here',\n      callSid: 'CA1234567890abcdef1234567890abcdef',\n      status: 'completed',\n      recording: {\n        url: '/api/voice/company-abc-123/calls/call-uuid-here/recording',\n        duration: 120\n      },\n      conversation: {\n        transcript: [\n          {\n            role: 'assistant',\n            content: 'Hello! This is Sarah from Company ABC. How can I help you today?',\n            timestamp: '2025-11-09T10:30:05.000Z'\n          },\n          {\n            role: 'user',\n            content: 'I have a question about my recent order.',\n            timestamp: '2025-11-09T10:30:10.000Z'\n          }\n          // ... more messages\n        ],\n        analysis: {\n          rating: 8,\n          sentiment: 'positive',\n          topics: ['order inquiry', 'customer support'],\n          resolved: true,\n          improvements: [],\n          categories: ['support']\n        }\n      },\n      metadata: {\n        startTime: '2025-11-09T10:30:00.000Z',\n        endTime: '2025-11-09T10:32:00.000Z',\n        direction: 'outbound',\n        customerNumber: '+1987654321',\n        duration: 120\n      }\n    }\n    */\n    \n    return result;\n  } catch (error) {\n    console.error('Error getting call result:', error);\n  }\n}\n\n// Example 5: Handle inbound calls (webhook handler)\nasync function handleInboundCall(tenantId, twilioRequest) {\n  try {\n    const twiml = await voiceAI.handleInboundCall(tenantId, twilioRequest);\n    \n    // Return TwiML to Twilio\n    return twiml;\n  } catch (error) {\n    console.error('Error handling inbound call:', error);\n    // Return error TwiML\n    return `<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response>\n      <Say voice=\"alice\">I'm sorry, we're experiencing technical difficulties.</Say>\n      <Hangup/>\n    </Response>`;\n  }\n}\n\n// Example 6: Get tenant analytics\nasync function getTenantAnalytics(tenantId) {\n  try {\n    const analytics = await voiceAI.getTenantAnalytics(tenantId, {\n      startDate: '2025-11-01',\n      endDate: '2025-11-09'\n    });\n    \n    console.log('Tenant analytics:', analytics);\n    \n    /*\n    Analytics format:\n    {\n      total_calls: 150,\n      successful_calls: 120,\n      avg_rating: 7.8,\n      avg_duration: 180,\n      inbound_calls: 100,\n      outbound_calls: 50,\n      categories: [\n        { category: 'support', count: 80 },\n        { category: 'sales', count: 40 },\n        { category: 'billing', count: 30 }\n      ]\n    }\n    */\n    \n    return analytics;\n  } catch (error) {\n    console.error('Error getting analytics:', error);\n  }\n}\n\n// Example 7: Complete workflow\nasync function completeWorkflowExample() {\n  try {\n    // 1. Setup tenant\n    const tenantId = await setupTenant();\n    \n    // 2. Make outbound call\n    const callResult = await makeOutboundCall(tenantId);\n    \n    // 3. Wait for call to complete (in real scenario, this would be via webhook)\n    // Simulating call completion after 2 minutes\n    await new Promise(resolve => setTimeout(resolve, 2000));\n    \n    // 4. Get call result\n    const finalResult = await getCallResult(tenantId, callResult.callId);\n    \n    // 5. Get analytics\n    const analytics = await getTenantAnalytics(tenantId);\n    \n    console.log('Workflow completed successfully!');\n    console.log('Final call result:', finalResult);\n    console.log('Analytics:', analytics);\n    \n  } catch (error) {\n    console.error('Workflow error:', error);\n  }\n}\n\n// Example 8: Multiple tenants with different voice configurations\nasync function multiTenantExample() {\n  const tenants = [\n    {\n      id: 'company-a',\n      name: 'Company A',\n      twilioPhone: '+1111111111'\n    },\n    {\n      id: 'company-b', \n      name: 'Company B',\n      twilioPhone: '+2222222222'\n    }\n  ];\n  \n  // Setup multiple tenants with different voice configurations\n  for (const tenant of tenants) {\n    const config = {\n      ...tenantConfig,\n      tenantId: tenant.id,\n      twilioCredentials: {\n        ...tenantConfig.twilioCredentials,\n        phoneNumber: tenant.twilioPhone\n      },\n      agentConfig: {\n        ...tenantConfig.agentConfig,\n        name: `Agent for ${tenant.name}`\n      }\n    };\n    \n    await voiceAI.initializeTenant(config);\n    console.log(`Tenant ${tenant.id} initialized with voice: ${tenant.voiceName}`);\n  }\n  \n  // Make calls for different tenants\n  const calls = await Promise.all(\n    tenants.map(tenant => \n      makeOutboundCall(tenant.id)\n    )\n  );\n  \n  console.log('All tenant calls initiated with their respective voices:', calls);\n}\n\n// Export functions for use\nexport {\n  setupTenant,\n  makeOutboundCall,\n  getCallResult,\n  handleInboundCall,\n  getTenantAnalytics,\n  completeWorkflowExample,\n  multiTenantExample\n};\n\n// Run examples if this file is executed directly\nif (import.meta.url === `file://${process.argv[1]}`) {\n  console.log('Running Voice AI Service examples...');\n  \n  // Uncomment to run specific examples:\n  // await completeWorkflowExample();\n  // await multiTenantExample();\n}"
