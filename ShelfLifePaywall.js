import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  StatusBar,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function ShelfLifePaywall({ visible, onSubscribed, canDismiss = false }) {
  const [showPaywall, setShowPaywall] = useState(visible);
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setShowPaywall(visible);
  }, [visible]);

  useEffect(() => {
    if (showPaywall) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation for premium badge
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start(() => pulse());
      };
      pulse();
    }
  }, [showPaywall]);

  const processSubscription = async (subscriptionType) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Generate user's unique referral code (in real app, this would come from backend)
      const userReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      let bonusMessage = '';
      if (referralCode) {
        bonusMessage = '\n\n🎉 Referral applied! Both you and your friend get 6 months free!';
      }
      
      // Here you would integrate with your payment system (Stripe, RevenueCat, etc.)
      const subscriptionData = {
        type: subscriptionType,
        referralCode: referralCode || null,
        userReferralCode: userReferralCode,
        price: '£4.99/year'
      };
      
      
      // Process the subscription
      await onSubscribed(subscriptionData);
      
      // Show success message
      Alert.alert(
        subscriptionType === 'trial' ? 'Free Trial Started!' : 'Subscription Active!',
        `Welcome to PantryPal Premium!${bonusMessage}\n\nYour referral code: ${userReferralCode}\nShare it with friends to get 6 months free!`,
        [
          {
            text: 'Continue',
            onPress: () => {
              setShowPaywall(false);
            }
          }
        ]
      );
      
    } catch (error) {
      Alert.alert(
        'Subscription Error',
        'There was a problem processing your subscription. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFreeTrial = () => {
    Alert.alert(
      'Start Free Trial',
      'You\'ll get 1 month free, then £4.99/year. Cancel anytime before your trial ends to avoid being charged.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Start Trial',
          onPress: () => processSubscription('trial')
        }
      ]
    );
  };

  const handleDirectPurchase = () => {
    Alert.alert(
      'Subscribe Now',
      'You\'ll be charged £4.99/year and get immediate access to all premium features.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Subscribe',
          onPress: () => processSubscription('subscription')
        }
      ]
    );
  };

  const validateReferralCode = (code) => {
    // Basic validation - in real app, this would check against your backend
    return code.length === 6 && /^[A-Z0-9]+$/.test(code);
  };

  if (!showPaywall) {
    return null;
  }

  return (
    <Modal 
      visible={showPaywall} 
      animationType="fade" 
      transparent={true} 
      onRequestClose={() => {
        // Only allow dismissal if canDismiss is true
        if (canDismiss) {
          setShowPaywall(false);
        }
      }}
    >
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <BlurView intensity={20} style={StyleSheet.absoluteFillObject} />
        <Animated.View 
          style={[
            styles.paywallContainer,
            {
              transform: [
                { scale: scaleAnim }
              ]
            }
          ]}
        >
          <View style={styles.content}>
            {/* Premium Badge */}
            <Animated.View style={[styles.premiumBadge, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                style={styles.badgeGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 1}}
              >
                <Ionicons name="crown" size={16} color="white" />
                <Text style={styles.badgeText}>PREMIUM REQUIRED</Text>
              </LinearGradient>
            </Animated.View>

            {/* Header Section */}
            <LinearGradient
              colors={['#667EEA', '#764BA2']}
              style={styles.headerSection}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 1}}
            >
              <View style={styles.headerContent}>
                <View style={styles.iconContainer}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
                    style={styles.iconBackground}
                  >
                    <Ionicons name="crown" size={28} color="white" />
                  </LinearGradient>
                </View>
                <Text style={styles.headerTitle}>✨ PantryPal Premium</Text>
                <Text style={styles.headerSubtitle}>This app requires a subscription to use</Text>
                <View style={styles.starsContainer}>
                  {[...Array(5)].map((_, i) => (
                    <Ionicons key={i} name="star" size={14} color="#FFD700" />
                  ))}
                  <Text style={styles.ratingText}>4.9 • 10K+ users</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Features Section */}
            <View style={styles.featuresSection}>
              {/* Price Display */}
              <View style={styles.compactPricing}>
                <Text style={styles.priceAmount}>£4.99</Text>
                <Text style={styles.pricePeriod}>per year</Text>
                <Text style={styles.priceComparison}>Just £0.41/month!</Text>
              </View>

              {/* Compact Feature List */}
              <View style={styles.compactFeatures}>
                <View style={styles.featureRow}>
                  <View style={styles.compactFeatureItem}>
                    <Ionicons name="notifications" size={16} color="#10B981" />
                    <Text style={styles.compactFeatureText}>Smart Alerts</Text>
                  </View>
                  <View style={styles.compactFeatureItem}>
                    <Ionicons name="infinite" size={16} color="#3B82F6" />
                    <Text style={styles.compactFeatureText}>Unlimited Items</Text>
                  </View>
                </View>
                <View style={styles.featureRow}>
                  <View style={styles.compactFeatureItem}>
                    <Ionicons name="cloud-done" size={16} color="#8B5CF6" />
                    <Text style={styles.compactFeatureText}>Cloud Sync</Text>
                  </View>
                  <View style={styles.compactFeatureItem}>
                    <Ionicons name="analytics" size={16} color="#F59E0B" />
                    <Text style={styles.compactFeatureText}>Analytics</Text>
                  </View>
                </View>
              </View>

              {/* Referral Code Section */}
              <View style={styles.referralSection}>
                <TouchableOpacity 
                  style={styles.referralToggle}
                  onPress={() => setShowReferralInput(!showReferralInput)}
                  activeOpacity={0.8}
                >
                  <Ionicons 
                    name={showReferralInput ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color="#667EEA" 
                  />
                  <Text style={styles.referralToggleText}>
                    Have a referral code? Get 6 months free!
                  </Text>
                </TouchableOpacity>
                
                {showReferralInput && (
                  <View style={styles.referralInputContainer}>
                    <TextInput
                      style={[
                        styles.referralInput,
                        referralCode && !validateReferralCode(referralCode) && styles.referralInputError
                      ]}
                      placeholder="Enter referral code"
                      value={referralCode}
                      onChangeText={(text) => setReferralCode(text.toUpperCase())}
                      autoCapitalize="characters"
                      maxLength={6}
                    />
                    {referralCode.length > 0 && (
                      <View style={styles.referralBenefit}>
                        <Ionicons 
                          name={validateReferralCode(referralCode) ? "checkmark-circle" : "alert-circle"} 
                          size={16} 
                          color={validateReferralCode(referralCode) ? "#10B981" : "#EF4444"} 
                        />
                        <Text style={[
                          styles.referralBenefitText,
                          { color: validateReferralCode(referralCode) ? "#059669" : "#DC2626" }
                        ]}>
                          {validateReferralCode(referralCode) 
                            ? "You and your friend will both get 6 months free!"
                            : "Invalid referral code format"
                          }
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Pricing Options */}
              <View style={styles.compactPricingOptions}>
                {/* Free Trial Option */}
                <TouchableOpacity 
                  style={[styles.primaryButton, isProcessing && styles.buttonDisabled]} 
                  onPress={handleFreeTrial}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isProcessing ? ['#9CA3AF', '#6B7280'] : ['#667EEA', '#764BA2']}
                    style={styles.compactButtonGradient}
                    start={{x: 0, y: 0}}
                    end={{x: 1, y: 0}}
                  >
                    <View style={styles.buttonContent}>
                      <Ionicons name="gift" size={18} color="white" />
                      <Text style={styles.primaryButtonText}>
                        {isProcessing ? 'Processing...' : 'Start Free Trial'}
                      </Text>
                    </View>
                    <Text style={styles.primaryButtonSubtext}>1 month free, then £4.99/year</Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Direct Purchase Option */}
                <TouchableOpacity 
                  style={[styles.compactSecondaryButton, isProcessing && styles.buttonDisabled]} 
                  onPress={handleDirectPurchase}
                  disabled={isProcessing}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="flash" size={18} color={isProcessing ? "#9CA3AF" : "#667EEA"} />
                    <Text style={[styles.secondaryButtonText, isProcessing && { color: "#9CA3AF" }]}>
                      {isProcessing ? 'Processing...' : 'Subscribe Now - £4.99/year'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Mandatory Notice */}
              <View style={styles.mandatoryNotice}>
                <Ionicons name="information-circle" size={20} color="#F59E0B" />
                <Text style={styles.mandatoryNoticeText}>
                  This app has no free plan. Cancel anytime before your trial ends to avoid being charged.
                </Text>
              </View>

              {/* Trust & Footer */}
              <View style={styles.compactFooter}>
                <View style={styles.trustItems}>
                  <Text style={styles.trustItemText}>🔒 Secure • ✅ Cancel Anytime • 💰 30-day Guarantee</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  paywallContainer: {
    backgroundColor: 'white',
    borderRadius: 24,
    maxWidth: 380,
    width: '100%',
    height: height * 0.8,
    overflow: 'hidden',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 35,
  },
  content: {
    flex: 1,
  },
  premiumBadge: {
    position: 'absolute',
    top: -5,
    alignSelf: 'center',
    zIndex: 15,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    elevation: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSection: {
    paddingTop: 30,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 12,
  },
  iconBackground: {
    borderRadius: 25,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: 'white',
    marginBottom: 4,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 2,
  },
  ratingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  featuresSection: {
    padding: 20,
    backgroundColor: 'white',
    flex: 1,
  },
  compactPricing: {
    alignItems: 'center',
    marginBottom: 20,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#667EEA',
    marginBottom: 2,
  },
  pricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 2,
  },
  priceComparison: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  compactFeatures: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  compactFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 0.48,
    gap: 6,
  },
  compactFeatureText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  referralSection: {
    marginBottom: 20,
  },
  referralToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    gap: 8,
  },
  referralToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667EEA',
  },
  referralInputContainer: {
    marginTop: 12,
    gap: 8,
  },
  referralInput: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E0E7FF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1E293B',
  },
  referralInputError: {
    borderColor: '#EF4444',
  },
  referralBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  referralBenefitText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  compactPricingOptions: {
    marginBottom: 20,
    gap: 12,
  },
  primaryButton: {
    borderRadius: 12,
    elevation: 8,
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  compactButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  primaryButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  compactSecondaryButton: {
    borderWidth: 2,
    borderColor: '#667EEA',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#667EEA',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  mandatoryNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  mandatoryNoticeText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  compactFooter: {
    alignItems: 'center',
  },
  trustItems: {
    backgroundColor: '#F0F9F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  trustItemText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    textAlign: 'center',
  },
});