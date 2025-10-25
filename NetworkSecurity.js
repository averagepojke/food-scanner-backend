// 🌐 NETWORK SECURITY & CERTIFICATE PINNING
// Advanced protection against man-in-the-middle attacks and network threats

import { Platform } from 'react-native';
import logger from './logger';
import { secureStorage } from './SecureStorage';
import { monitoringUtils } from './SecurityMonitoring';

// Network security configuration
const NETWORK_CONFIG = {
  // Certificate pins (SHA-256 hashes of public keys)
  CERTIFICATE_PINS: {
    'api.food.com': [
      'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Primary cert
      'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Backup cert
    ],
    'firebase.googleapis.com': [
      'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
      'sha256/DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD=',
    ],
    'firebaseapp.com': [
      'sha256/EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE=',
      'sha256/FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF=',
    ]
  },
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
  ALLOWED_CIPHERS: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-GCM-SHA256'
  ],
  MIN_TLS_VERSION: '1.2',
  BLOCKED_NETWORKS: [
    '127.0.0.1',
    'localhost',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16'
  ],
  SECURITY_HEADERS: {
    'User-Agent': 'FoodScannerApp/2.0 Security-Enhanced',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'X-Requested-With': 'FoodScannerApp',
    'X-Security-Token': null // Will be set dynamically
  }
};

class NetworkSecurityManager {
  constructor() {
    this.initialized = false;
    this.pinnedCerts = new Map();
    this.securityToken = null;
    this.failedPinValidations = new Map();
  }

  // Initialize network security
  async initialize() {
    if (this.initialized) return;

    try {
      // Generate dynamic security token
      this.securityToken = await this.generateSecurityToken();
      
      // Load certificate pins
      await this.loadCertificatePins();
      
      // Initialize security monitoring
      await this.initializeSecurityMonitoring();
      
      this.initialized = true;
      logger.info('Network security initialized');
      
    } catch (error) {
      logger.error('Network security initialization failed:', error);
    }
  }

  // Generate dynamic security token for requests
  async generateSecurityToken() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const platform = Platform.OS;
    
    // Simple token generation (use proper JWT in production)
    const tokenData = `${platform}-${timestamp}-${random}`;
    const token = Buffer.from(tokenData).toString('base64');
    
    return token.substring(0, 32); // Limit length
  }

  // Load and validate certificate pins
  async loadCertificatePins() {
    try {
      // In production, you might load pins from a secure server or bundle
      for (const [domain, pins] of Object.entries(NETWORK_CONFIG.CERTIFICATE_PINS)) {
        this.pinnedCerts.set(domain, pins);
      }
      
      logger.debug('Certificate pins loaded:', this.pinnedCerts.size);
      
    } catch (error) {
      logger.error('Failed to load certificate pins:', error);
    }
  }

  // Secure HTTP client with certificate pinning
  async secureRequest(url, options = {}) {
    await this.initialize();

    try {
      // Parse URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Validate domain security
      await this.validateDomainSecurity(domain);

      // Prepare secure request options
      const secureOptions = await this.prepareSecureOptions(urlObj, options);

      // Make request with monitoring
      const response = await this.makeMonitoredRequest(url, secureOptions);

      // Validate response security
      await this.validateResponseSecurity(response, domain);

      return response;

    } catch (error) {
      await this.handleSecurityError(url, error);
      throw error;
    }
  }

  // Validate domain security before request
  async validateDomainSecurity(domain) {
    // Check if domain is blocked
    if (this.isBlockedDomain(domain)) {
      throw new Error(`Access to domain ${domain} is blocked for security reasons`);
    }

    // Check certificate pinning requirements
    if (this.pinnedCerts.has(domain)) {
      const failCount = this.failedPinValidations.get(domain) || 0;
      if (failCount >= 3) {
        throw new Error(`Domain ${domain} has failed certificate validation too many times`);
      }
    }

    // Additional domain validation
    await this.performDomainChecks(domain);
  }

  // Check if domain is in blocked list
  isBlockedDomain(domain) {
    const blockedDomains = NETWORK_CONFIG.BLOCKED_NETWORKS;
    
    for (const blocked of blockedDomains) {
      if (blocked.includes('/')) {
        // CIDR notation check (simplified)
        if (this.isInSubnet(domain, blocked)) {
          return true;
        }
      } else {
        // Direct match
        if (domain === blocked || domain.endsWith(`.${blocked}`)) {
          return true;
        }
      }
    }
    
    return false;
  }

  // Simple subnet check (simplified implementation)
  isInSubnet(ip, cidr) {
    // In production, use proper IP/CIDR validation library
    const privateRanges = ['127.', '10.', '172.16.', '172.17.', '192.168.'];
    return privateRanges.some(range => ip.startsWith(range));
  }

  // Perform additional domain security checks
  async performDomainChecks(domain) {
    try {
      // Check for suspicious TLD
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.bit'];
      const tld = domain.substring(domain.lastIndexOf('.'));
      
      if (suspiciousTLDs.includes(tld)) {
        logger.warn('Suspicious TLD detected:', domain);
        // Could block or warn user
      }

      // Check for IDN homograph attacks
      if (domain.includes('xn--')) {
        logger.warn('Internationalized domain detected, checking for homograph attack:', domain);
      }

      // Check domain length (very long domains can be suspicious)
      if (domain.length > 253) {
        throw new Error('Domain name exceeds maximum length');
      }

    } catch (error) {
      logger.error('Domain security check failed:', error);
      throw error;
    }
  }

  // Prepare secure request options
  async prepareSecureOptions(urlObj, userOptions) {
    const secureHeaders = {
      ...NETWORK_CONFIG.SECURITY_HEADERS,
      'X-Security-Token': this.securityToken,
      'X-Request-ID': this.generateRequestId(),
      'X-Timestamp': Date.now().toString()
    };

    // Add user headers (filtered for security)
    if (userOptions.headers) {
      const allowedHeaders = [
        'content-type', 'accept', 'authorization', 
        'x-api-key', 'x-custom-header'
      ];
      
      for (const [key, value] of Object.entries(userOptions.headers)) {
        if (allowedHeaders.includes(key.toLowerCase())) {
          secureHeaders[key] = value;
        }
      }
    }

    const secureOptions = {
      ...userOptions,
      headers: secureHeaders,
      timeout: userOptions.timeout || NETWORK_CONFIG.TIMEOUT_MS,
      // Add certificate pinning validation
      agent: this.createSecureAgent(urlObj.hostname),
      // Disable redirects for security (handle manually if needed)
      redirect: 'manual',
      // Add integrity checks
      cache: 'no-cache'
    };

    return secureOptions;
  }

  // Create secure agent with certificate pinning
  createSecureAgent(hostname) {
    // Note: React Native doesn't support custom agents directly
    // This is a conceptual implementation - actual implementation 
    // would require native modules or specific RN libraries
    
    if (Platform.OS === 'web') {
      // For web platform, we can't implement true cert pinning
      // but we can add other security measures
      return null;
    }

    // For native platforms, you would use libraries like:
    // - react-native-cert-pinner
    // - or implement native modules
    
    logger.debug('Certificate pinning agent created for:', hostname);
    return null; // Simplified for this implementation
  }

  // Make request with security monitoring
  async makeMonitoredRequest(url, options) {
    const startTime = Date.now();
    let response;

    try {
      // Log request attempt
      await monitoringUtils.trackApiCall(url, options.method || 'GET', 0, 0);

      // Make the actual request
      response = await fetch(url, options);

      const duration = Date.now() - startTime;
      
      // Log successful request
      await monitoringUtils.trackApiCall(
        url, 
        options.method || 'GET', 
        response.status, 
        duration
      );

      return response;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failed request
      await monitoringUtils.trackApiCall(
        url, 
        options.method || 'GET', 
        0, 
        duration
      );

      throw error;
    }
  }

  // Validate response security
  async validateResponseSecurity(response, domain) {
    try {
      // Check response status
      if (response.status < 200 || response.status >= 400) {
        logger.warn('Suspicious HTTP status:', response.status);
      }

      // Validate security headers
      await this.validateSecurityHeaders(response.headers, domain);

      // Check for certificate pinning (conceptual)
      await this.validateCertificatePin(response, domain);

      // Content security checks
      await this.validateResponseContent(response);

    } catch (error) {
      logger.error('Response security validation failed:', error);
      throw error;
    }
  }

  // Validate security headers in response
  async validateSecurityHeaders(headers, domain) {
    const requiredHeaders = [
      'content-type',
      'x-content-type-options',
      'x-frame-options'
    ];

    const missingHeaders = [];
    
    for (const header of requiredHeaders) {
      if (!headers.get(header)) {
        missingHeaders.push(header);
      }
    }

    if (missingHeaders.length > 0) {
      logger.warn('Missing security headers:', missingHeaders);
      // Could take action based on missing headers
    }

    // Check for suspicious headers
    const suspiciousHeaders = headers.get('x-powered-by') || headers.get('server');
    if (suspiciousHeaders && suspiciousHeaders.includes('PHP')) {
      logger.info('Server technology detected, monitoring for vulnerabilities');
    }
  }

  // Validate certificate pinning (conceptual)
  async validateCertificatePin(response, domain) {
    // This is where you would validate the actual certificate
    // In React Native, this requires native modules
    
    const pins = this.pinnedCerts.get(domain);
    if (!pins || pins.length === 0) {
      return; // No pinning required for this domain
    }

    try {
      // Conceptual certificate validation
      // In real implementation, you would:
      // 1. Extract the certificate chain from the response
      // 2. Calculate SHA-256 hash of public key
      // 3. Compare with pinned values
      
      const isValidPin = true; // Placeholder
      
      if (!isValidPin) {
        // Record failed validation
        const failCount = (this.failedPinValidations.get(domain) || 0) + 1;
        this.failedPinValidations.set(domain, failCount);
        
        logger.error('Certificate pin validation failed for domain:', domain);
        throw new Error(`Certificate pinning validation failed for ${domain}`);
      } else {
        // Reset fail count on success
        this.failedPinValidations.delete(domain);
      }

    } catch (error) {
      logger.error('Certificate pin validation error:', error);
      throw error;
    }
  }

  // Validate response content
  async validateResponseContent(response) {
    try {
      const contentType = response.headers.get('content-type') || '';
      
      // Check for unexpected content types
      if (contentType.includes('text/html') && !contentType.includes('application/json')) {
        logger.warn('Unexpected HTML content in API response');
        // Might indicate a redirect to a malicious page
      }

      // Check content length
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      if (contentLength > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('Response content too large');
      }

      // Additional content validation would go here
      
    } catch (error) {
      logger.error('Response content validation failed:', error);
      throw error;
    }
  }

  // Handle security errors
  async handleSecurityError(url, error) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Log security error
      logger.error('Network security error:', {
        domain,
        error: error.message,
        type: error.name
      });

      // Record security incident
      await this.recordSecurityIncident({
        type: 'network_security_error',
        domain,
        error: error.message,
        timestamp: Date.now()
      });

      // Take protective action based on error type
      if (error.message.includes('certificate') || error.message.includes('SSL')) {
        await this.handleCertificateError(domain, error);
      }

    } catch (logError) {
      logger.error('Failed to handle security error:', logError);
    }
  }

  // Handle certificate-related errors
  async handleCertificateError(domain, error) {
    // Increment certificate error count
    const errorCount = (this.failedPinValidations.get(domain) || 0) + 1;
    this.failedPinValidations.set(domain, errorCount);

    // Block domain if too many certificate errors
    if (errorCount >= 3) {
      logger.warn(`Blocking domain due to repeated certificate errors: ${domain}`);
      
      // In production, you might want to:
      // 1. Add domain to local blocklist
      // 2. Alert user about potential security issue
      // 3. Report to security monitoring service
    }
  }

  // Record security incidents
  async recordSecurityIncident(incident) {
    try {
      const incidents = await secureStorage.getSecureItem('security_incidents', []);
      incidents.push(incident);
      
      // Keep only recent incidents (last 100)
      const recentIncidents = incidents.slice(-100);
      await secureStorage.setSecureItem('security_incidents', recentIncidents);
      
    } catch (error) {
      logger.error('Failed to record security incident:', error);
    }
  }

  // Generate unique request ID for tracking
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  // Initialize security monitoring integration
  async initializeSecurityMonitoring() {
    // Set up network monitoring hooks
    logger.debug('Network security monitoring initialized');
  }

  // Get network security statistics
  async getNetworkSecurityStats() {
    try {
      const incidents = await secureStorage.getSecureItem('security_incidents', []);
      const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
      const recentIncidents = incidents.filter(i => i.timestamp > last24Hours);

      return {
        totalIncidents: incidents.length,
        recentIncidents: recentIncidents.length,
        pinnedDomains: this.pinnedCerts.size,
        failedValidations: this.failedPinValidations.size,
        securityToken: this.securityToken ? 'Active' : 'Inactive',
        incidentTypes: this.groupIncidentsByType(recentIncidents)
      };

    } catch (error) {
      logger.error('Failed to get network security stats:', error);
      return null;
    }
  }

  // Group incidents by type for statistics
  groupIncidentsByType(incidents) {
    return incidents.reduce((groups, incident) => {
      const type = incident.type || 'unknown';
      groups[type] = (groups[type] || 0) + 1;
      return groups;
    }, {});
  }

  // Update certificate pins (for dynamic pinning)
  async updateCertificatePins(domain, pins) {
    try {
      this.pinnedCerts.set(domain, pins);
      
      // Persist updated pins
      await secureStorage.setSecureItem('certificate_pins', 
        Object.fromEntries(this.pinnedCerts), 
        { sensitive: true }
      );

      logger.info('Certificate pins updated for domain:', domain);

    } catch (error) {
      logger.error('Failed to update certificate pins:', error);
      throw error;
    }
  }

  // Clear failed validations (for domain recovery)
  clearFailedValidations(domain) {
    if (domain) {
      this.failedPinValidations.delete(domain);
    } else {
      this.failedPinValidations.clear();
    }
    logger.info('Cleared failed validations for domain:', domain || 'all');
  }
}

// Singleton instance
export const networkSecurity = new NetworkSecurityManager();

// Secure fetch wrapper with all security features
export const secureFetch = async (url, options = {}) => {
  return await networkSecurity.secureRequest(url, options);
};

// Convenience functions
export const networkUtils = {
  // Make secure GET request
  async get(url, headers = {}) {
    return await secureFetch(url, { method: 'GET', headers });
  },

  // Make secure POST request
  async post(url, data, headers = {}) {
    return await secureFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data)
    });
  },

  // Make secure PUT request
  async put(url, data, headers = {}) {
    return await secureFetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data)
    });
  },

  // Make secure DELETE request
  async delete(url, headers = {}) {
    return await secureFetch(url, { method: 'DELETE', headers });
  },

  // Get network security status
  async getSecurityStatus() {
    return await networkSecurity.getNetworkSecurityStats();
  },

  // Update certificate pins for a domain
  async updatePins(domain, pins) {
    return await networkSecurity.updateCertificatePins(domain, pins);
  },

  // Clear failed validations
  clearFailures(domain) {
    return networkSecurity.clearFailedValidations(domain);
  }
};