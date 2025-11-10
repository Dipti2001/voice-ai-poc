/**
 * Manages webhook routing and URL generation for multi-tenant setup
 */
class WebhookManager {
  constructor() {
    this.tenantWebhooks = new Map();
    this.baseUrl = process.env.WEBHOOK_BASE_URL || 'https://your-domain.com';
  }

  /**
   * Setup webhook endpoints for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {string} webhookBaseUrl - Base URL for webhooks
   */
  async setupTenantWebhooks(tenantId, webhookBaseUrl) {
    const webhooks = {
      inbound: `${webhookBaseUrl || this.baseUrl}/api/voice/${tenantId}/inbound`,
      outbound: `${webhookBaseUrl || this.baseUrl}/api/voice/${tenantId}/outbound`,
      status: `${webhookBaseUrl || this.baseUrl}/api/voice/${tenantId}/status`,
      recording: `${webhookBaseUrl || this.baseUrl}/api/voice/${tenantId}/recording`
    };

    this.tenantWebhooks.set(tenantId, webhooks);
    console.log(`Webhooks configured for tenant ${tenantId}:`, webhooks);
    
    return webhooks;
  }

  /**
   * Generate call-specific webhook URL
   * @param {string} tenantId - Tenant identifier
   * @param {string} callId - Call identifier
   * @param {string} action - Action type (optional)
   * @returns {string} Webhook URL
   */
  generateCallWebhookUrl(tenantId, callId, action = null) {
    const webhooks = this.tenantWebhooks.get(tenantId);
    if (!webhooks) {
      throw new Error(`Webhooks not configured for tenant ${tenantId}`);
    }

    let url = `${this.baseUrl}/api/voice/${tenantId}/calls/${callId}`;
    
    if (action) {
      url += `?action=${action}`;
    }
    
    return url;
  }

  /**
   * Get inbound webhook URL for tenant
   * @param {string} tenantId - Tenant identifier
   * @returns {string} Inbound webhook URL
   */
  getInboundWebhookUrl(tenantId) {
    const webhooks = this.tenantWebhooks.get(tenantId);
    return webhooks ? webhooks.inbound : null;
  }

  /**
   * Get status webhook URL for tenant
   * @param {string} tenantId - Tenant identifier
   * @returns {string} Status webhook URL
   */
  getStatusWebhookUrl(tenantId) {
    const webhooks = this.tenantWebhooks.get(tenantId);
    return webhooks ? webhooks.status : null;
  }

  /**
   * Parse webhook request to extract tenant and call information
   * @param {string} url - Request URL
   * @returns {Object} Parsed webhook data
   */
  parseWebhookRequest(url) {
    const urlParts = new URL(url);
    const pathParts = urlParts.pathname.split('/');
    
    // Expected format: /api/voice/{tenantId}/calls/{callId}
    // or /api/voice/{tenantId}/inbound
    if (pathParts[1] === 'api' && pathParts[2] === 'voice') {
      const tenantId = pathParts[3];
      const endpoint = pathParts[4];
      
      if (endpoint === 'calls' && pathParts[5]) {
        return {
          tenantId,
          callId: pathParts[5],
          endpoint: 'call',
          action: urlParts.searchParams.get('action')
        };
      } else {
        return {
          tenantId,
          endpoint,
          callId: null,
          action: null
        };
      }
    }
    
    throw new Error(`Invalid webhook URL format: ${url}`);
  }

  /**
   * Validate webhook signature for security
   * @param {string} tenantId - Tenant identifier
   * @param {string} signature - Webhook signature
   * @param {string} url - Request URL
   * @param {Object} params - Request parameters
   * @returns {boolean} Signature validity
   */
  validateWebhookSignature(tenantId, signature, url, params) {
    // This would typically validate using tenant-specific Twilio auth token
    // Implementation depends on how tenant credentials are stored
    return true; // Placeholder
  }

  /**
   * Generate webhook routing configuration
   * @param {string} tenantId - Tenant identifier
   * @returns {Object} Routing configuration
   */
  generateRoutingConfig(tenantId) {
    const webhooks = this.tenantWebhooks.get(tenantId);
    if (!webhooks) {
      throw new Error(`Webhooks not configured for tenant ${tenantId}`);
    }

    return {
      tenantId,
      routes: [
        {
          pattern: `/api/voice/${tenantId}/inbound`,
          handler: 'handleInboundCall',
          method: 'POST'
        },
        {
          pattern: `/api/voice/${tenantId}/calls/:callId`,
          handler: 'handleCallInteraction',
          method: 'POST'
        },
        {
          pattern: `/api/voice/${tenantId}/status`,
          handler: 'handleCallStatus',
          method: 'POST'
        },
        {
          pattern: `/api/voice/${tenantId}/calls/:callId/recording`,
          handler: 'getCallRecording',
          method: 'GET'
        }
      ]
    };
  }

  /**
   * Update webhook URLs for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {Object} newUrls - New webhook URLs
   */
  async updateTenantWebhooks(tenantId, newUrls) {
    const existing = this.tenantWebhooks.get(tenantId) || {};
    const updated = { ...existing, ...newUrls };
    
    this.tenantWebhooks.set(tenantId, updated);
    console.log(`Webhooks updated for tenant ${tenantId}`);
    
    return updated;
  }

  /**
   * Remove webhook configuration for a tenant
   * @param {string} tenantId - Tenant identifier
   */
  async cleanupTenantWebhooks(tenantId) {
    this.tenantWebhooks.delete(tenantId);
    console.log(`Webhooks cleaned up for tenant ${tenantId}`);
  }

  /**
   * Get all configured webhooks
   * @returns {Object} All tenant webhooks
   */
  getAllWebhooks() {
    const webhooks = {};
    for (const [tenantId, config] of this.tenantWebhooks) {
      webhooks[tenantId] = config;
    }
    return webhooks;
  }

  /**
   * Generate Twilio phone number webhook configuration
   * @param {string} tenantId - Tenant identifier
   * @param {string} phoneNumber - Twilio phone number
   * @returns {Object} Phone number configuration
   */
  generatePhoneNumberConfig(tenantId, phoneNumber) {
    const webhooks = this.tenantWebhooks.get(tenantId);
    if (!webhooks) {
      throw new Error(`Webhooks not configured for tenant ${tenantId}`);
    }

    return {
      phoneNumber,
      voiceUrl: webhooks.inbound,
      voiceMethod: 'POST',
      statusCallback: webhooks.status,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    };
  }
}

export { WebhookManager };