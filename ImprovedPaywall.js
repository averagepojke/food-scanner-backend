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
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

export default function ImprovedPaywall({ visible, onSubscribed, onClose, theme }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [referralCode, setReferralCode] = useState('');
  const [showReferralInput, setShowReferralInput] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
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
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const plans = {
    yearly: {
      id: 'yearly',
      name: 'Yearly',
      price: '£4.99',
      period: 'per year',
      monthlyEquivalent: '£0.41/month',
      savings: 'Save 67%',
      popular: true,
      features: ['Unlimited food scanning', 'Smart expiration alerts', 'Cloud sync', 'Analytics dashboard', 'Priority support']
    },
    monthly: {
      id: 'monthly',
      name: 'Monthly',
      price: '£1.99',
      period: 'per month',
      monthlyEquivalent: null,
      savings: null,
      popular: false,
      features: ['Unlimited food scanning', 'Smart expiration alerts', 'Cloud sync']
    }
  };

  const processPayment = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const selectedPlanData = plans[selectedPlan];
      const subscriptionData = {
        type: selectedPlan,
        plan: selectedPlanData,
        price: selectedPlanData.price,
        period: selectedPlanData.period,
        referralCode: referralCode || null,
        subscribedAt: new Date().toISOString(),
        expiryDate: selectedPlan === 'yearly' 
          ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        userId: 'current-user', // In real app, get from auth context
      };

      // Call the subscription handler
      await onSubscribed(subscriptionData);
      
      // Show success message
      Alert.alert(
        '🎉 Welcome to Premium!',
        `Your ${selectedPlanData.name.toLowerCase()} subscription is now active. Enjoy unlimited access to all premium features!`,
        [{ text: 'Get Started', onPress: () => onClose && onClose() }]
      );
      
    } catch (error) {
      Alert.alert(
        'Payment Failed',
        'There was an issue processing your payment. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const validateReferralCode = (code) => {
    return code.length >= 4 && /^[A-Z0-9]+$/.test(code);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <BlurView intensity={20} style={StyleSheet.absoluteFillObject} />
        
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ]
            }
          ]}
        >
          {/* Header */}
          <LinearGradient
            colors={['#667EEA', '#764BA2']}
            style={styles.header}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
          >
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="crown" size={32} color="#FFD700" />
              </View>
              <Text style={styles.title}>Unlock Premium Features</Text>
              <Text style={styles.subtitle}>Get unlimited access to all features</Text>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Features List */}
            <View style={styles.featuresContainer}>
              <Text style={styles.featuresTitle}>What you'll get:</Text>
              {plans[selectedPlan].features.slice(0, 3).map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <MaterialCommunityIcons name="check-circle" size={18} color="#10B981" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
              {plans[selectedPlan].features.length > 3 && (
                <Text style={styles.moreFeaturesText}>
                  + {plans[selectedPlan].features.length - 3} more
                </Text>
              )}
            </View>

            {/* Plan Selection */}
            <View style={styles.plansContainer}>
              <Text style={styles.plansTitle}>Choose your plan:</Text>
              
              {Object.values(plans).map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    selectedPlan === plan.id && styles.planCardSelected,
                    plan.popular && styles.planCardPopular
                  ]}
                  onPress={() => setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularText}>MOST POPULAR</Text>
                    </View>
                  )}
                  
                  <View style={styles.planHeader}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    {plan.savings && (
                      <Text style={styles.savingsText}>{plan.savings}</Text>
                    )}
                  </View>
                  
                  <View style={styles.planPricing}>
                    <Text style={styles.planPrice}>{plan.price}</Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                  
                  {plan.monthlyEquivalent && (
                    <Text style={styles.monthlyEquivalent}>{plan.monthlyEquivalent}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Referral Code */}
            <View style={styles.referralContainer}>
              <TouchableOpacity 
                style={styles.referralToggle}
                onPress={() => setShowReferralInput(!showReferralInput)}
              >
                <MaterialCommunityIcons 
                  name={showReferralInput ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#667EEA" 
                />
                <Text style={styles.referralToggleText}>Have a referral code?</Text>
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
                    maxLength={8}
                  />
                  {referralCode.length > 0 && (
                    <View style={styles.referralBenefit}>
                      <MaterialCommunityIcons 
                        name={validateReferralCode(referralCode) ? "check-circle" : "alert-circle"} 
                        size={16} 
                        color={validateReferralCode(referralCode) ? "#10B981" : "#EF4444"} 
                      />
                      <Text style={[
                        styles.referralBenefitText,
                        { color: validateReferralCode(referralCode) ? "#059669" : "#DC2626" }
                      ]}>
                        {validateReferralCode(referralCode) 
                          ? "You'll get 1 month free!"
                          : "Invalid referral code"
                        }
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Subscribe Button */}
            <TouchableOpacity
              style={[styles.subscribeButton, isProcessing && styles.subscribeButtonDisabled]}
              onPress={processPayment}
              disabled={isProcessing}
            >
              <LinearGradient
                colors={isProcessing ? ['#9CA3AF', '#6B7280'] : ['#667EEA', '#764BA2']}
                style={styles.subscribeGradient}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
              >
                {isProcessing ? (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="small" color="white" />
                    <Text style={styles.subscribeButtonText}>Processing...</Text>
                  </View>
                ) : (
                  <Text style={styles.subscribeButtonText}>
                    Subscribe for {plans[selectedPlan].price}/{plans[selectedPlan].period}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Trust Indicators */}
            <View style={styles.trustContainer}>
              <View style={styles.trustItem}>
                <MaterialCommunityIcons name="shield-check" size={16} color="#10B981" />
                <Text style={styles.trustText}>Secure Payment</Text>
              </View>
              <View style={styles.trustItem}>
                <MaterialCommunityIcons name="cancel" size={16} color="#10B981" />
                <Text style={styles.trustText}>Cancel Anytime</Text>
              </View>
              <View style={styles.trustItem}>
                <MaterialCommunityIcons name="clock" size={16} color="#10B981" />
                <Text style={styles.trustText}>Instant Access</Text>
              </View>
            </View>

            {/* Terms */}
            <Text style={styles.termsText}>
              By subscribing, you agree to our Terms of Service and Privacy Policy. 
              Subscription automatically renews unless cancelled.
            </Text>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: 'white',
    borderRadius: 24,
    maxWidth: 400,
    width: '100%',
    maxHeight: height * 0.9,
    overflow: 'hidden',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.3,
    shadowRadius: 35,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  content: {
    padding: 20,
  },
  contentInner: {
    paddingBottom: 16,
  },
  featuresContainer: {
    marginBottom: 15,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    fontWeight: '500',
  },
  plansContainer: {
    marginBottom: 24,
  },
  plansTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  planCard: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#667EEA',
    backgroundColor: '#F8FAFF',
  },
  planCardPopular: {
    borderColor: '#10B981',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  planPricing: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#667EEA',
  },
  planPeriod: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  monthlyEquivalent: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
  referralContainer: {
    marginBottom: 24,
  },
  referralToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  referralToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667EEA',
    marginLeft: 8,
  },
  referralInputContainer: {
    marginTop: 12,
  },
  referralInput: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E0E7FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#1F2937',
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
    borderRadius: 8,
    marginTop: 8,
  },
  referralBenefitText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  subscribeButton: {
    borderRadius: 16,
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  subscribeButtonDisabled: {
    opacity: 0.7,
  },
  subscribeGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 8,
  },
  trustContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  termsText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
});