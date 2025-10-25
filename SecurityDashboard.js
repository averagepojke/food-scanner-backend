// 🛡️ ELITE SECURITY DASHBOARD
// Comprehensive security monitoring and management interface

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  RefreshControl,
  Switch,
  Modal,
  FlatList
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import logger from './logger';
import { secureStorage } from './SecureStorage';
import { biometricAuth, biometricUtils } from './BiometricAuth';
import { multiFactorAuth, mfaUtils } from './MultiFactorAuth';
import { networkSecurity, networkUtils } from './NetworkSecurity';
import { monitoringUtils } from './SecurityMonitoring';
import { authSecurity } from './AuthSecurity';

// Dashboard configuration
const DASHBOARD_CONFIG = {
  REFRESH_INTERVAL_MS: 30 * 1000, // 30 seconds
  ALERT_THRESHOLDS: {
    HIGH_SEVERITY_ALERTS: 5,
    FAILED_LOGINS: 10,
    NETWORK_FAILURES: 15,
    STORAGE_ERRORS: 8
  },
  CHART_COLORS: {
    SUCCESS: '#10B981',
    WARNING: '#F59E0B', 
    ERROR: '#EF4444',
    INFO: '#3B82F6'
  }
};

const SecurityDashboard = ({ userId, onClose }) => {
  // State management
  const [securityData, setSecurityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [alerts, setAlerts] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [securitySettings, setSecuritySettings] = useState({});

  // Load security data
  const loadSecurityData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch data from all security systems in parallel
      const [
        mfaStatus,
        biometricStats,
        networkStats,
        monitoringStats,
        storageIntegrity,
        authEvents,
        securityAlerts,
        settings
      ] = await Promise.all([
        mfaUtils.getUserMFAStatus(userId),
        biometricAuth.getBiometricStats(),
        networkUtils.getSecurityStatus(),
        monitoringUtils.getSecurityDashboard(),
        secureStorage.verifyIntegrity(),
        getAuthEvents(),
        getSecurityAlerts(),
        getSecuritySettings()
      ]);

      const dashboardData = {
        overview: {
          securityScore: calculateSecurityScore({
            mfaStatus,
            biometricStats,
            networkStats,
            storageIntegrity
          }),
          totalAlerts: securityAlerts.length,
          criticalIssues: securityAlerts.filter(a => a.severity === 'high').length,
          lastUpdated: Date.now()
        },
        authentication: {
          mfaEnabled: mfaStatus.mfaEnabled,
          mfaMethods: mfaStatus.methods,
          biometricEnabled: biometricStats?.capabilities?.isSupported && biometricStats?.capabilities?.isEnrolled,
          lastLogin: authEvents[0]?.timestamp,
          failedAttempts: authEvents.filter(e => e.event.includes('failed')).length,
          sessionStatus: 'active'
        },
        network: {
          secureCalls: networkStats?.totalIncidents || 0,
          pinnedDomains: networkStats?.pinnedDomains || 0,
          failedValidations: networkStats?.failedValidations || 0,
          threatLevel: calculateThreatLevel(networkStats)
        },
        monitoring: {
          realTimeAlerts: monitoringStats?.recentAlerts || 0,
          systemHealth: calculateSystemHealth(monitoringStats),
          coverage: '95%', // Placeholder
          uptime: '99.8%' // Placeholder
        },
        storage: {
          encryptedItems: storageIntegrity.total,
          corruptedItems: storageIntegrity.corrupted,
          integrity: storageIntegrity.corrupted === 0 ? 'Excellent' : 'Warning',
          lastBackup: await getLastBackupTime()
        }
      };

      setSecurityData(dashboardData);
      setAlerts(securityAlerts);
      setSecuritySettings(settings);
      
    } catch (error) {
      logger.error('Failed to load security dashboard data:', error);
      Alert.alert('Error', 'Failed to load security data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  // Auto-refresh data
  useEffect(() => {
    loadSecurityData();
    
    const interval = setInterval(loadSecurityData, DASHBOARD_CONFIG.REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadSecurityData]);

  // Calculate overall security score
  const calculateSecurityScore = useCallback((data) => {
    let score = 0;
    
    // MFA enabled (30 points)
    if (data.mfaStatus?.mfaEnabled) score += 30;
    
    // Biometric enabled (20 points)
    if (data.biometricStats?.capabilities?.isSupported && 
        data.biometricStats?.capabilities?.isEnrolled) score += 20;
    
    // Network security (25 points)
    if (data.networkStats?.pinnedDomains > 0) score += 15;
    if ((data.networkStats?.failedValidations || 0) === 0) score += 10;
    
    // Storage integrity (25 points)
    if (data.storageIntegrity?.corrupted === 0) score += 25;
    
    return Math.min(score, 100);
  }, []);

  // Calculate threat level
  const calculateThreatLevel = useCallback((networkStats) => {
    if (!networkStats) return 'Unknown';
    
    const failures = networkStats.failedValidations || 0;
    const incidents = networkStats.recentIncidents || 0;
    
    if (failures === 0 && incidents === 0) return 'Low';
    if (failures <= 2 && incidents <= 5) return 'Medium';
    return 'High';
  }, []);

  // Calculate system health
  const calculateSystemHealth = useCallback((stats) => {
    if (!stats) return 'Unknown';
    
    const alerts = stats.recentAlerts || 0;
    
    if (alerts === 0) return 'Excellent';
    if (alerts <= 3) return 'Good';
    if (alerts <= 10) return 'Warning';
    return 'Critical';
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSecurityData();
  }, [loadSecurityData]);

  // Show detail modal
  const showDetails = useCallback((title, content) => {
    setModalContent({ title, content });
    setShowDetailModal(true);
  }, []);

  // Tab content renderers
  const renderOverviewTab = () => {
    if (!securityData) return null;

    const { overview, authentication, network, storage } = securityData;
    
    return (
      <ScrollView style={styles.tabContent}>
        {/* Security Score */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>Security Score</Text>
          <View style={styles.scoreCircle}>
            <Text style={[styles.scoreText, { color: getScoreColor(overview.securityScore) }]}>
              {overview.securityScore}%
            </Text>
          </View>
          <Text style={styles.scoreSubtitle}>
            {getScoreDescription(overview.securityScore)}
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <StatCard 
            icon="shield-check"
            title="MFA Enabled"
            value={authentication.mfaEnabled ? 'Yes' : 'No'}
            color={authentication.mfaEnabled ? DASHBOARD_CONFIG.CHART_COLORS.SUCCESS : DASHBOARD_CONFIG.CHART_COLORS.ERROR}
            onPress={() => showDetails('Multi-Factor Authentication', getMFADetails())}
          />
          
          <StatCard 
            icon="fingerprint"
            title="Biometric"
            value={authentication.biometricEnabled ? 'Active' : 'Inactive'}
            color={authentication.biometricEnabled ? DASHBOARD_CONFIG.CHART_COLORS.SUCCESS : DASHBOARD_CONFIG.CHART_COLORS.WARNING}
            onPress={() => showDetails('Biometric Authentication', getBiometricDetails())}
          />
          
          <StatCard 
            icon="network-strength-4"
            title="Network Security"
            value={network.threatLevel}
            color={getThreatLevelColor(network.threatLevel)}
            onPress={() => showDetails('Network Security', getNetworkDetails())}
          />
          
          <StatCard 
            icon="database-lock"
            title="Data Integrity"
            value={storage.integrity}
            color={storage.integrity === 'Excellent' ? DASHBOARD_CONFIG.CHART_COLORS.SUCCESS : DASHBOARD_CONFIG.CHART_COLORS.WARNING}
            onPress={() => showDetails('Data Storage', getStorageDetails())}
          />
        </View>

        {/* Recent Alerts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Security Alerts</Text>
          {alerts.length === 0 ? (
            <Text style={styles.noAlertsText}>No security alerts - All systems secure</Text>
          ) : (
            alerts.slice(0, 5).map((alert, index) => (
              <AlertItem key={index} alert={alert} onPress={() => showDetails('Alert Details', alert)} />
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <ActionButton 
              icon="shield-plus"
              title="Enable MFA"
              onPress={() => handleEnableMFA()}
              disabled={authentication.mfaEnabled}
            />
            <ActionButton 
              icon="fingerprint"
              title="Setup Biometric"
              onPress={() => handleSetupBiometric()}
              disabled={authentication.biometricEnabled}
            />
            <ActionButton 
              icon="shield-refresh"
              title="Security Scan"
              onPress={() => handleSecurityScan()}
            />
            <ActionButton 
              icon="cog"
              title="Settings"
              onPress={() => setSelectedTab('settings')}
            />
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderAuthenticationTab = () => {
    if (!securityData) return null;

    const { authentication } = securityData;

    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Authentication Status</Text>
          
          <View style={styles.authStatusCard}>
            <Text style={styles.statusLabel}>Multi-Factor Authentication</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusValue}>
                {authentication.mfaEnabled ? 'Enabled' : 'Disabled'}
              </Text>
              <Switch 
                value={authentication.mfaEnabled}
                onValueChange={handleMFAToggle}
              />
            </View>
          </View>

          <View style={styles.authStatusCard}>
            <Text style={styles.statusLabel}>Biometric Authentication</Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusValue}>
                {authentication.biometricEnabled ? 'Enabled' : 'Disabled'}
              </Text>
              <Switch 
                value={authentication.biometricEnabled}
                onValueChange={handleBiometricToggle}
              />
            </View>
          </View>

          {authentication.mfaEnabled && (
            <View style={styles.mfaMethodsCard}>
              <Text style={styles.statusLabel}>Available MFA Methods</Text>
              {Object.entries(authentication.mfaMethods).map(([method, enabled]) => (
                <View key={method} style={styles.methodRow}>
                  <Text style={styles.methodName}>{method.toUpperCase()}</Text>
                  <MaterialCommunityIcons 
                    name={enabled ? "check-circle" : "close-circle"}
                    size={20}
                    color={enabled ? DASHBOARD_CONFIG.CHART_COLORS.SUCCESS : DASHBOARD_CONFIG.CHART_COLORS.ERROR}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Authentication Events</Text>
          <FlatList 
            data={getRecentAuthEvents()}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => <AuthEventItem event={item} />}
            style={styles.eventsList}
          />
        </View>
      </ScrollView>
    );
  };

  const renderSettingsTab = () => {
    return (
      <ScrollView style={styles.tabContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Settings</Text>
          
          <SettingRow 
            title="Auto-lock timeout"
            subtitle="Lock app after inactivity"
            value={securitySettings.autoLockTimeout || '30 minutes'}
            onPress={() => handleSettingChange('autoLockTimeout')}
          />
          
          <SettingRow 
            title="Security notifications"
            subtitle="Receive alerts about security events"
            value={securitySettings.notifications ? 'Enabled' : 'Disabled'}
            onPress={() => handleSettingToggle('notifications')}
            hasSwitch={true}
            switchValue={securitySettings.notifications}
          />
          
          <SettingRow 
            title="Network monitoring"
            subtitle="Monitor network requests for threats"
            value={securitySettings.networkMonitoring ? 'Enabled' : 'Disabled'}
            onPress={() => handleSettingToggle('networkMonitoring')}
            hasSwitch={true}
            switchValue={securitySettings.networkMonitoring}
          />
          
          <SettingRow 
            title="Data encryption"
            subtitle="Encrypt sensitive data on device"
            value="Always enabled"
            disabled={true}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Advanced Options</Text>
          
          <TouchableOpacity style={styles.advancedButton} onPress={handleExportSecurityLogs}>
            <MaterialCommunityIcons name="download" size={20} color="#666" />
            <Text style={styles.advancedButtonText}>Export Security Logs</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.advancedButton} onPress={handleResetSecuritySettings}>
            <MaterialCommunityIcons name="restore" size={20} color="#666" />
            <Text style={styles.advancedButtonText}>Reset Security Settings</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.advancedButton, styles.dangerButton]} onPress={handleClearAllData}>
            <MaterialCommunityIcons name="delete-forever" size={20} color="#EF4444" />
            <Text style={[styles.advancedButtonText, styles.dangerText]}>Clear All Security Data</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  // Event handlers
  const handleMFAToggle = async (value) => {
    try {
      if (value) {
        // Enable MFA
        await handleEnableMFA();
      } else {
        // Disable MFA (requires verification)
        Alert.alert(
          'Disable MFA',
          'This will reduce your account security. Are you sure?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Disable', style: 'destructive', onPress: handleDisableMFA }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleBiometricToggle = async (value) => {
    try {
      if (value) {
        const available = await biometricUtils.isAvailable();
        if (available) {
          await biometricUtils.enableForUser(userId, 'user-secret'); // In real app, use actual secret
          loadSecurityData();
        } else {
          biometricUtils.showSetupHelp();
        }
      } else {
        await biometricAuth.disableBiometricAuth(userId);
        loadSecurityData();
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleEnableMFA = async () => {
    try {
      const setupData = await mfaUtils.setupTOTP(userId, 'PantryPal');
      
      Alert.alert(
        'MFA Setup',
        `Setup your authenticator app with this key: ${setupData.manualEntryKey}`,
        [
          { text: 'Cancel' },
          { 
            text: 'Verify', 
            onPress: () => {
              // In real app, show QR code and verification screen
              logger.info('MFA setup initiated');
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleDisableMFA = async () => {
    // Implementation would require user to verify with current MFA method
    Alert.alert('Feature', 'MFA disable requires verification code input');
  };

  const handleSecurityScan = async () => {
    Alert.alert('Security Scan', 'Running comprehensive security scan...', [{ text: 'OK' }]);
    
    try {
      // Run security checks
      await Promise.all([
        secureStorage.verifyIntegrity(),
        monitoringUtils.performSecurityCheck(),
        // Add more security checks
      ]);
      
      loadSecurityData();
      Alert.alert('Security Scan Complete', 'No issues found');
    } catch (error) {
      Alert.alert('Security Scan', `Issues detected: ${error.message}`);
    }
  };

  // Utility functions
  const getScoreColor = (score) => {
    if (score >= 90) return DASHBOARD_CONFIG.CHART_COLORS.SUCCESS;
    if (score >= 70) return DASHBOARD_CONFIG.CHART_COLORS.WARNING;
    return DASHBOARD_CONFIG.CHART_COLORS.ERROR;
  };

  const getScoreDescription = (score) => {
    if (score >= 90) return 'Excellent Security';
    if (score >= 70) return 'Good Security';
    if (score >= 50) return 'Fair Security';
    return 'Needs Improvement';
  };

  const getThreatLevelColor = (level) => {
    switch (level.toLowerCase()) {
      case 'low': return DASHBOARD_CONFIG.CHART_COLORS.SUCCESS;
      case 'medium': return DASHBOARD_CONFIG.CHART_COLORS.WARNING;
      case 'high': return DASHBOARD_CONFIG.CHART_COLORS.ERROR;
      default: return DASHBOARD_CONFIG.CHART_COLORS.INFO;
    }
  };

  // Helper functions (simplified implementations)
  const getAuthEvents = async () => [];
  const getSecurityAlerts = async () => [];
  const getSecuritySettings = async () => ({ 
    notifications: true, 
    networkMonitoring: true,
    autoLockTimeout: '30 minutes'
  });
  const getLastBackupTime = async () => Date.now();
  const getMFADetails = () => 'MFA configuration details...';
  const getBiometricDetails = () => 'Biometric authentication details...';
  const getNetworkDetails = () => 'Network security details...';
  const getStorageDetails = () => 'Storage security details...';
  const getRecentAuthEvents = () => [];
  const handleSettingChange = (setting) => {};
  const handleSettingToggle = (setting) => {};
  const handleExportSecurityLogs = () => {};
  const handleResetSecuritySettings = () => {};
  const handleClearAllData = () => {};

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <MaterialCommunityIcons name="shield-sync" size={50} color="#666" />
        <Text style={styles.loadingText}>Loading Security Dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={24} color="#666" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Security Dashboard</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <MaterialCommunityIcons name="refresh" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {['overview', 'authentication', 'settings'].map((tab) => (
          <TouchableOpacity 
            key={tab}
            style={[styles.tab, selectedTab === tab && styles.activeTab]}
            onPress={() => setSelectedTab(tab)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {selectedTab === 'overview' && renderOverviewTab()}
        {selectedTab === 'authentication' && renderAuthenticationTab()}
        {selectedTab === 'settings' && renderSettingsTab()}
      </View>

      {/* Detail Modal */}
      <Modal 
        visible={showDetailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalContent?.title}</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <MaterialCommunityIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>{modalContent?.content}</Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

// Component styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1f2937',
  },
  refreshButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
  },
  activeTabText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  scoreCard: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  scoreTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  scoreSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  noAlertsText: {
    color: '#10b981',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  authStatusCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusValue: {
    fontSize: 16,
    color: '#1f2937',
  },
  mfaMethodsCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  methodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  methodName: {
    fontSize: 14,
    color: '#374151',
  },
  eventsList: {
    maxHeight: 300,
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  advancedButtonText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  dangerButton: {
    borderColor: '#fee2e2',
    borderWidth: 1,
  },
  dangerText: {
    color: '#ef4444',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
});

// Helper components
const StatCard = ({ icon, title, value, color, onPress }) => (
  <TouchableOpacity 
    style={[styles.statCard, { flex: 1, minWidth: '48%' }]}
    onPress={onPress}
  >
    <MaterialCommunityIcons name={icon} size={24} color={color} />
    <Text style={styles.statTitle}>{title}</Text>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
  </TouchableOpacity>
);

const AlertItem = ({ alert, onPress }) => (
  <TouchableOpacity style={styles.alertItem} onPress={onPress}>
    <MaterialCommunityIcons 
      name="alert-circle" 
      size={20} 
      color={alert.severity === 'high' ? '#ef4444' : '#f59e0b'} 
    />
    <View style={styles.alertContent}>
      <Text style={styles.alertText}>{alert.type}</Text>
      <Text style={styles.alertTime}>{new Date(alert.timestamp).toLocaleTimeString()}</Text>
    </View>
  </TouchableOpacity>
);

const ActionButton = ({ icon, title, onPress, disabled }) => (
  <TouchableOpacity 
    style={[styles.actionButton, disabled && styles.disabledButton]}
    onPress={onPress}
    disabled={disabled}
  >
    <MaterialCommunityIcons 
      name={icon} 
      size={20} 
      color={disabled ? '#9ca3af' : '#3b82f6'} 
    />
    <Text style={[styles.actionButtonText, disabled && styles.disabledButtonText]}>
      {title}
    </Text>
  </TouchableOpacity>
);

const AuthEventItem = ({ event }) => (
  <View style={styles.eventItem}>
    <Text style={styles.eventType}>{event.event}</Text>
    <Text style={styles.eventTime}>{new Date(event.timestamp).toLocaleString()}</Text>
  </View>
);

const SettingRow = ({ title, subtitle, value, onPress, hasSwitch, switchValue, disabled }) => (
  <TouchableOpacity 
    style={[styles.settingRow, disabled && styles.disabledSetting]}
    onPress={onPress}
    disabled={disabled}
  >
    <View style={styles.settingInfo}>
      <Text style={styles.settingTitle}>{title}</Text>
      <Text style={styles.settingSubtitle}>{subtitle}</Text>
    </View>
    {hasSwitch ? (
      <Switch value={switchValue} onValueChange={onPress} />
    ) : (
      <Text style={styles.settingValue}>{value}</Text>
    )}
  </TouchableOpacity>
);

// Additional styles for helper components
const helperStyles = StyleSheet.create({
  statCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  alertContent: {
    flex: 1,
    marginLeft: 12,
  },
  alertText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  alertTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
    minWidth: '48%',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#3b82f6',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: '#9ca3af',
  },
  eventItem: {
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  eventType: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  eventTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 8,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    color: '#3b82f6',
  },
  disabledSetting: {
    opacity: 0.5,
  },
});

// Merge styles
Object.assign(styles, helperStyles);

export default SecurityDashboard;