import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Manages tenant configurations with encryption and validation
 */
class ConfigurationManager {
  constructor(storageType = 'file', options = {}) {
    this.storageType = storageType;
    this.options = options;
    this.configPath = options.configPath || path.join(process.cwd(), 'tenant-configs');
    this.globalConfigPath = options.globalConfigPath || path.join(process.cwd(), 'global-config.json');
    this.encryptionKey = options.encryptionKey || this._generateEncryptionKey();
    this.configs = new Map();
    this.globalConfig = null;
  }

  /**
   * Initialize the configuration manager
   */
  async initialize() {
    if (this.storageType === 'file') {
      try {
        await fs.mkdir(this.configPath, { recursive: true });
        // Load global config if exists
        await this._loadGlobalConfig();
      } catch (error) {
        console.error('Error creating config directory:', error);
      }
    }
  }

  /**
   * Store tenant configuration
   * @param {string} tenantId - Tenant identifier
   * @param {Object} config - Configuration object
   */
  async storeTenantConfig(tenantId, config) {
    try {
      // Validate configuration
      this._validateConfig(config);

      // Encrypt sensitive data
      const encryptedConfig = this._encryptSensitiveData(config);
      
      // Store in memory
      this.configs.set(tenantId, encryptedConfig);

      // Persist to storage
      if (this.storageType === 'file') {
        await this._saveConfigToFile(tenantId, encryptedConfig);
      } else if (this.storageType === 'database') {
        await this._saveConfigToDatabase(tenantId, encryptedConfig);
      }

      console.log(`Configuration stored for tenant ${tenantId}`);
    } catch (error) {
      console.error(`Error storing config for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get tenant configuration
   * @param {string} tenantId - Tenant identifier
   * @returns {Object} Decrypted configuration
   */
  async getTenantConfig(tenantId) {
    try {
      // Check memory cache first
      let config = this.configs.get(tenantId);
      
      if (!config) {
        // Load from storage
        if (this.storageType === 'file') {
          config = await this._loadConfigFromFile(tenantId);
        } else if (this.storageType === 'database') {
          config = await this._loadConfigFromDatabase(tenantId);
        }
        
        if (!config) {
          throw new Error(`Configuration not found for tenant ${tenantId}`);
        }
        
        // Cache in memory
        this.configs.set(tenantId, config);
      }

      // Decrypt sensitive data
      return this._decryptSensitiveData(config);
    } catch (error) {
      console.error(`Error getting config for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Update tenant configuration
   * @param {string} tenantId - Tenant identifier
   * @param {Object} updates - Configuration updates
   */
  async updateTenantConfig(tenantId, updates) {
    try {
      const currentConfig = await this.getTenantConfig(tenantId);
      const updatedConfig = { ...currentConfig, ...updates };
      
      await this.storeTenantConfig(tenantId, updatedConfig);
    } catch (error) {
      console.error(`Error updating config for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Remove tenant configuration
   * @param {string} tenantId - Tenant identifier
   */
  async removeTenantConfig(tenantId) {
    try {
      // Remove from memory
      this.configs.delete(tenantId);

      // Remove from storage
      if (this.storageType === 'file') {
        await this._removeConfigFromFile(tenantId);
      } else if (this.storageType === 'database') {
        await this._removeConfigFromDatabase(tenantId);
      }

      console.log(`Configuration removed for tenant ${tenantId}`);
    } catch (error) {
      console.error(`Error removing config for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * List all tenant configurations
   * @returns {Array} List of tenant IDs
   */
  async listTenants() {
    if (this.storageType === 'file') {
      try {
        const files = await fs.readdir(this.configPath);
        return files
          .filter(file => file.endsWith('.json'))
          .map(file => file.replace('.json', ''));
      } catch (error) {
        return [];
      }
    } else if (this.storageType === 'database') {
      return await this._listTenantsFromDatabase();
    }
    
    return Array.from(this.configs.keys());
  }

  /**
   * Store global configuration
   * @param {Object} config - Global configuration object
   */
  async storeGlobalConfig(config) {
    try {
      // Validate global configuration
      this._validateGlobalConfig(config);

      // Encrypt sensitive data
      const encryptedConfig = this._encryptGlobalSensitiveData(config);
      
      // Store in memory
      this.globalConfig = encryptedConfig;

      // Persist to storage
      if (this.storageType === 'file') {
        await this._saveGlobalConfigToFile(encryptedConfig);
      }

      console.log('Global configuration stored');
    } catch (error) {
      console.error('Error storing global config:', error);
      throw error;
    }
  }

  /**
   * Get global configuration
   * @returns {Object} Decrypted global configuration
   */
  async getGlobalConfig() {
    try {
      if (!this.globalConfig) {
        if (this.storageType === 'file') {
          this.globalConfig = await this._loadGlobalConfigFromFile();
        }
        
        if (!this.globalConfig) {
          throw new Error('Global configuration not found');
        }
      }

      // Decrypt sensitive data
      return this._decryptGlobalSensitiveData(this.globalConfig);
    } catch (error) {
      console.error('Error getting global config:', error);
      throw error;
    }
  }

  // Private methods
  _validateConfig(config) {
    const required = ['twilioCredentials', 'aiConfig', 'voiceConfig', 'agentConfig'];
    const missing = required.filter(field => !config[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }

    // Validate specific fields
    if (!config.twilioCredentials.accountSid || !config.twilioCredentials.authToken || !config.twilioCredentials.phoneNumber) {
      throw new Error('Invalid Twilio credentials');
    }
    if (!config.aiConfig.type || !config.aiConfig.apiKey) {
      throw new Error('Invalid AI configuration');
    }
    if (!config.voiceConfig.voiceName) {
      throw new Error('Voice configuration must include voiceName');
    }
    if (!config.agentConfig.name || !config.agentConfig.prompt) {
      throw new Error('Invalid agent configuration');
    }
  }

  _validateGlobalConfig(config) {
    if (!config.voiceConfig || !config.voiceConfig.provider || !config.voiceConfig.apiKey) {
      throw new Error('Global configuration must include voice provider and API key');
    }
  }

  _encryptGlobalSensitiveData(config) {
    const sensitiveFields = [
      'voiceConfig.apiKey'
    ];

    const encrypted = JSON.parse(JSON.stringify(config));
    
    sensitiveFields.forEach(field => {
      const value = this._getNestedValue(encrypted, field);
      if (value) {
        this._setNestedValue(encrypted, field, this._encrypt(value));
      }
    });

    return encrypted;
  }

  _decryptGlobalSensitiveData(config) {
    const sensitiveFields = [
      'voiceConfig.apiKey'
    ];

    const decrypted = JSON.parse(JSON.stringify(config));
    
    sensitiveFields.forEach(field => {
      const value = this._getNestedValue(decrypted, field);
      if (value && typeof value === 'string' && value.includes(':')) {
        try {
          this._setNestedValue(decrypted, field, this._decrypt(value));
        } catch (error) {
          console.warn(`Failed to decrypt global field ${field}:`, error.message);
        }
      }
    });

    return decrypted;
  }

  _encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  _decrypt(text) {
    const algorithm = 'aes-256-gcm';
    const [ivHex, authTagHex, encrypted] = text.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  _generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => current[key] = current[key] || {}, obj);
    target[lastKey] = value;
  }

  async _saveGlobalConfigToFile(config) {
    await fs.writeFile(this.globalConfigPath, JSON.stringify(config, null, 2));
  }

  async _loadGlobalConfigFromFile() {
    try {
      const data = await fs.readFile(this.globalConfigPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  async _loadGlobalConfig() {
    this.globalConfig = await this._loadGlobalConfigFromFile();
  }

  // Database storage methods (placeholder for future implementation)
  async _saveConfigToDatabase(tenantId, config) {
    // TODO: Implement database storage
    throw new Error('Database storage not implemented yet');
  }

  async _loadConfigFromDatabase(tenantId) {
    // TODO: Implement database loading
    throw new Error('Database storage not implemented yet');
  }

  async _removeConfigFromDatabase(tenantId) {
    // TODO: Implement database removal
    throw new Error('Database storage not implemented yet');
  }

  async _listTenantsFromDatabase() {
    // TODO: Implement database listing
    throw new Error('Database storage not implemented yet');
  }
}

export { ConfigurationManager };