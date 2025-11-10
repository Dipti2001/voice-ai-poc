import { TenantTwilioService } from './services/TenantTwilioService.js';
import { TenantAIService } from './services/TenantAIService.js';
import { TenantDatabase } from './TenantDatabase.js';

/**
 * Factory for creating and managing tenant-specific services
 */
class TenantServiceFactory {
  constructor() {
    this.tenantServices = new Map();
  }

  /**
   * Create services for a tenant with configs provided directly
   * @param {string} tenantId - Tenant identifier
   * @param {Object} configs - Service configurations
   * @returns {Object} Tenant services
   */
  async createTenantServicesWithConfig(tenantId, configs) {
    // Use existing services if they exist, or create new ones
    if (this.tenantServices.has(tenantId)) {
      return this.tenantServices.get(tenantId);
    }

    const services = {
      twilio: new TenantTwilioService(configs.twilioConfig || configs),
      ai: new TenantAIService(
        configs.aiConfig || configs, 
        configs.voiceConfig || configs, 
        configs.voiceConfig || configs
      ),
      database: new TenantDatabase(tenantId)
    };

    // Initialize services
    await services.database.initialize();
    
    this.tenantServices.set(tenantId, services);
    console.log(`Services created for tenant ${tenantId} with provided configs`);
    
    return services;
  }

  /**
   * Get services for a tenant
   * @param {string} tenantId - Tenant identifier
   * @returns {Object} Tenant services
   */
  async getTenantServices(tenantId) {
    const services = this.tenantServices.get(tenantId);
    if (!services) {
      throw new Error(`Services not found for tenant ${tenantId}`);
    }
    return services;
  }

  /**
   * Update services configuration for a tenant
   * @param {string} tenantId - Tenant identifier
   * @param {Object} newConfig - New configuration
   * @param {Object} globalVoiceConfig - Global voice configuration
   */
  async updateTenantServices(tenantId, newConfig, globalVoiceConfig) {
    const services = this.tenantServices.get(tenantId);
    if (!services) {
      throw new Error(`Services not found for tenant ${tenantId}`);
    }

    // Update configurations
    if (newConfig.twilioCredentials) {
      services.twilio.updateCredentials(newConfig.twilioCredentials);
    }
    
    if (newConfig.aiConfig || newConfig.voiceConfig || globalVoiceConfig) {
      services.ai.updateConfig(newConfig.aiConfig, globalVoiceConfig, newConfig.voiceConfig);
    }

    console.log(`Services updated for tenant ${tenantId}`);
  }

  /**
   * Clean up services for a tenant
   * @param {string} tenantId - Tenant identifier
   */
  async cleanupTenantServices(tenantId) {
    const services = this.tenantServices.get(tenantId);
    if (!services) {
      return;
    }

    // Cleanup database connections
    if (services.database && typeof services.database.close === 'function') {
      await services.database.close();
    }

    // Cleanup other resources
    if (services.ai && typeof services.ai.cleanup === 'function') {
      await services.ai.cleanup();
    }

    this.tenantServices.delete(tenantId);
    console.log(`Services cleaned up for tenant ${tenantId}`);
  }

  /**
   * Get all active tenants
   * @returns {Array} List of tenant IDs
   */
  getActiveTenants() {
    return Array.from(this.tenantServices.keys());
  }

  /**
   * Get service health status for all tenants
   * @returns {Object} Health status by tenant
   */
  async getHealthStatus() {
    const status = {};
    
    for (const [tenantId, services] of this.tenantServices) {
      try {
        // Check database connection
        const dbHealth = await services.database.healthCheck();
        
        status[tenantId] = {
          database: dbHealth ? 'healthy' : 'unhealthy',
          services: 'healthy',
          lastChecked: new Date().toISOString()
        };
      } catch (error) {
        status[tenantId] = {
          database: 'error',
          services: 'error',
          error: error.message,
          lastChecked: new Date().toISOString()
        };
      }
    }
    
    return status;
  }
}

export { TenantServiceFactory };