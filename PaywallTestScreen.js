import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSubscription } from './ImprovedSubscriptionManager';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTheme } from './theme';
import { ShoppingListContext } from './App';

export default function PaywallTestScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const isManageMode = route?.params?.mode === 'manage';
  const { 
    isSubscribed, 
    subscriptionData, 
    isFirstTime, 
    isLoading, 
    showPaywall,
    triggerPaywall,
    getSubscriptionStatus,
    cancelSubscription 
  } = useSubscription();

  const subscriptionStatus = getSubscriptionStatus();

  const handleTestSubscription = () => {
    Alert.alert(
      'Test Subscription',
      'This will simulate a successful subscription for testing purposes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Test Subscribe', 
          onPress: () => {
            // Simulate subscription data
            const testSubscription = {
              type: 'yearly',
              plan: {
                id: 'yearly',
                name: 'Yearly',
                price: '£4.99',
                period: 'per year'
              },
              price: '£4.99',
              period: 'per year',
              subscribedAt: new Date().toISOString(),
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              isActive: true,
              userId: 'test-user',
            };
            
            // This would normally be called by the paywall
            // For testing, we'll trigger it manually
            Alert.alert('Test Complete', 'Subscription would be processed here!');
          }
        }
      ]
    );
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your subscription?',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        { 
          text: 'Cancel', 
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubscription();
              Alert.alert('Cancellation scheduled', 'You will retain access until your current period ends.');
            } catch (e) {}
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.topBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="menu" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.text }]}>{isManageMode ? 'Manage Subscription' : 'Subscription'}</Text>
        <TouchableOpacity onPress={() => setMenuOpen(v => !v)} style={styles.iconBtn}>
          <MaterialCommunityIcons name="dots-vertical" size={22} color={theme.text} />
        </TouchableOpacity>
        {menuOpen && (
          <View style={[styles.overflowMenu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.overflowItem} onPress={() => { setMenuOpen(false); navigation.navigate('Terms'); }}>
              <Text style={{ color: theme.text }}>Terms & Privacy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.overflowItem} onPress={() => { setMenuOpen(false); navigation.navigate('SupportChat'); }}>
              <Text style={{ color: theme.text }}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <MaterialCommunityIcons name={isManageMode ? "crown" : "test-tube"} size={32} color="#667EEA" />
        <Text style={[styles.title, { color: theme.text }]}>{isManageMode ? 'Manage Subscription' : 'Paywall Test Screen'}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isManageMode ? 'View your premium status and manage billing' : 'Test the improved paywall system'}
        </Text>
      </View>

      {/* Status Cards */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusCard, { backgroundColor: !isSubscribed ? '#FEE2E2' : (subscriptionStatus?.willCancelAtPeriodEnd ? '#FEF3C7' : '#D1FAE5') }]}>
          <MaterialCommunityIcons 
            name={!isSubscribed ? "close-circle" : (subscriptionStatus?.willCancelAtPeriodEnd ? "clock-outline" : "check-circle")}
            size={24} 
            color={!isSubscribed ? "#DC2626" : (subscriptionStatus?.willCancelAtPeriodEnd ? "#D97706" : "#059669")} 
          />
          <Text style={styles.statusTitle}>Subscription Status</Text>
          <Text style={[styles.statusValue, { color: !isSubscribed ? "#DC2626" : (subscriptionStatus?.willCancelAtPeriodEnd ? "#D97706" : "#059669") }]}>
            {!isSubscribed ? 'Not Subscribed' : (subscriptionStatus?.willCancelAtPeriodEnd ? 'Cancels at period end' : 'Active')}
          </Text>
        </View>

        <View style={[styles.statusCard, { backgroundColor: isLoading ? '#FEF3C7' : '#E0E7FF' }]}>
          <MaterialCommunityIcons 
            name={isLoading ? "loading" : "check"} 
            size={24} 
            color={isLoading ? "#D97706" : "#3730A3"} 
          />
          <Text style={styles.statusTitle}>Loading State</Text>
          <Text style={[styles.statusValue, { color: isLoading ? "#D97706" : "#3730A3" }]}>
            {isLoading ? 'Loading...' : 'Ready'}
          </Text>
        </View>

        <View style={[styles.statusCard, { backgroundColor: isFirstTime ? '#FEF3C7' : '#E0E7FF' }]}>
          <MaterialCommunityIcons 
            name={isFirstTime ? "account-plus" : "account"} 
            size={24} 
            color={isFirstTime ? "#D97706" : "#3730A3"} 
          />
          <Text style={styles.statusTitle}>User Type</Text>
          <Text style={[styles.statusValue, { color: isFirstTime ? "#D97706" : "#3730A3" }]}>
            {isFirstTime ? 'First Time' : 'Returning'}
          </Text>
        </View>
      </View>

      {/* Subscription Details */}
      {subscriptionData && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Subscription Details</Text>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Plan:</Text>
            <Text style={styles.detailValue}>{subscriptionData.plan?.name || subscriptionData.type}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Price:</Text>
            <Text style={styles.detailValue}>{subscriptionData.price}/{subscriptionData.period}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Subscribed:</Text>
            <Text style={styles.detailValue}>
              {new Date(subscriptionData.subscribedAt).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Expires:</Text>
            <Text style={styles.detailValue}>
              {new Date(subscriptionData.expiryDate).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text style={[
              styles.detailValue,
              { color: !isSubscribed ? '#DC2626' : (subscriptionStatus?.willCancelAtPeriodEnd ? '#D97706' : '#059669') }
            ]}>
              {!isSubscribed ? 'Not Subscribed' : (subscriptionStatus?.willCancelAtPeriodEnd ? 'Cancels at period end' : 'Active')}
            </Text>
          </View>
          {subscriptionStatus && (
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Days Remaining:</Text>
              <Text style={[
                styles.detailValue,
                { color: subscriptionStatus.isExpiringSoon ? '#EF4444' : '#059669' }
              ]}>
                {subscriptionStatus.daysRemaining}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {!isManageMode && (
          <>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={triggerPaywall}>
            <MaterialCommunityIcons name="crown" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Show Paywall</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.secondaryButton, { borderColor: theme.primary }]} onPress={handleTestSubscription}>
              <MaterialCommunityIcons name="test-tube" size={20} color={theme.primary} />
              <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>Test Subscription</Text>
            </TouchableOpacity>
          </>
        )}

        {isManageMode && !isSubscribed && (
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primary }]} onPress={triggerPaywall}>
            <MaterialCommunityIcons name="crown" size={20} color="white" />
            <Text style={styles.primaryButtonText}>Subscribe</Text>
          </TouchableOpacity>
        )}

        {isSubscribed && !subscriptionStatus?.willCancelAtPeriodEnd && (
          <TouchableOpacity style={[styles.dangerButton, { backgroundColor: theme.error }]} onPress={handleCancelSubscription}>
            <MaterialCommunityIcons name="cancel" size={20} color="white" />
            <Text style={styles.dangerButtonText}>Cancel Subscription</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>How to Test:</Text>
        <Text style={styles.instructionText}>1. Tap "Show Paywall" to see the improved paywall</Text>
        <Text style={styles.instructionText}>2. Try different plans and referral codes</Text>
        <Text style={styles.instructionText}>3. Complete the subscription flow</Text>
        <Text style={styles.instructionText}>4. Check subscription status and details</Text>
        <Text style={styles.instructionText}>5. Test cancellation if needed</Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  topBar: {
    height: 48,
    borderBottomWidth: 1,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  overflowMenu: {
    position: 'absolute',
    top: 48,
    right: 8,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  overflowItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 160,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  statusContainer: {
    padding: 16,
    gap: 12,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailsContainer: {
    margin: 16,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  actionsContainer: {
    padding: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667EEA',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#667EEA',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    color: '#667EEA',
    fontSize: 16,
    fontWeight: '700',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
  instructionsContainer: {
    margin: 16,
    padding: 20,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0369A1',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#0369A1',
    marginBottom: 6,
    lineHeight: 20,
  },
});