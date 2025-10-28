import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingListContext } from './App';
import { getTheme } from './theme';

const ReferralScreen = ({ navigation }) => {
  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);

  const [userReferralCode, setUserReferralCode] = useState('');
  const [inputReferralCode, setInputReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState({
    referralCount: 0,
    bonusMonths: 0,
    totalEarned: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasUsedReferral, setHasUsedReferral] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReferralData();
  }, []);

  const generateReferralCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const loadReferralData = async () => {
    try {
      setIsLoading(true);
      
      // Load or generate user's referral code
      let storedCode = await AsyncStorage.getItem('userReferralCode');
      if (!storedCode) {
        storedCode = generateReferralCode();
        await AsyncStorage.setItem('userReferralCode', storedCode);
      }
      setUserReferralCode(storedCode);

      // Load referral stats
      const storedStats = await AsyncStorage.getItem('referralStats');
      if (storedStats) {
        setReferralStats(JSON.parse(storedStats));
      }

      // Check if user has already used a referral code
      const hasUsedReferralCode = await AsyncStorage.getItem('hasUsedReferralCode');
      setHasUsedReferral(!!hasUsedReferralCode);
    } catch (error) {
      console.error('Error loading referral data:', error);
      // Generate a temporary code if storage fails
      setUserReferralCode(generateReferralCode());
    } finally {
      setIsLoading(false);
    }
  };

  const shareReferralCode = async () => {
    try {
      const referralLink = `https://Pantrify.app/r/${userReferralCode}`;
      const message = `Join me on Pantrify 🤳🏻🍎! Use my referral code "${userReferralCode}" and we both get 6 months FREE! ${referralLink}`;

      await Share.share({
        message,
        title: 'Get 6 months free with Pantrify Premium!',
      });
    } catch (error) {
      console.error('Error sharing referral code:', error);
      Alert.alert(
        'Sharing Error',
        'Unable to share your referral code. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const copyReferralCode = async () => {
    try {
      await Clipboard.setStringAsync(userReferralCode);
      Alert.alert('Copied', 'Your referral code has been copied to the clipboard.');
    } catch (error) {
      console.error('Error copying referral code:', error);
      Alert.alert('Error', 'Unable to copy referral code. Please try again.', [{ text: 'OK' }]);
    }
  };

  const validateReferralCode = (code) => {
    return code && code.length === 6 && /^[A-Z0-9]+$/.test(code);
  };

  const submitReferralCode = async () => {
    if (!inputReferralCode.trim()) {
      Alert.alert('Missing Code', 'Please enter a referral code.');
      return;
    }

    if (!validateReferralCode(inputReferralCode)) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-character referral code.');
      return;
    }

    if (inputReferralCode === userReferralCode) {
      Alert.alert('Error', 'You cannot use your own referral code.');
      return;
    }

    if (hasUsedReferral) {
      Alert.alert(
        'Already Used', 
        'You have already used a referral code. Each user can only use one referral code.'
      );
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mark that user has used a referral code
      await AsyncStorage.setItem('hasUsedReferralCode', 'true');
      await AsyncStorage.setItem('usedReferralCode', inputReferralCode);
      setHasUsedReferral(true);

      // Update referral stats (in a real app, this would update the referrer's stats)
      const newStats = {
        ...referralStats,
        referralCount: referralStats.referralCount + 1,
        bonusMonths: referralStats.bonusMonths + 6,
        totalEarned: referralStats.totalEarned + 6
      };
      setReferralStats(newStats);
      await AsyncStorage.setItem('referralStats', JSON.stringify(newStats));

      Alert.alert(
        'Success!',
        `Congratulations! Both you and your friend get 6 months FREE added to your subscriptions!\n\nYour referral code: ${userReferralCode}`,
        [
          {
            text: 'Awesome!',
            onPress: () => {
              setInputReferralCode('');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error applying referral code:', error);
      Alert.alert(
        'Error', 
        'There was a problem applying the referral code. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const SettingItem = ({
    title,
    subtitle,
    icon,
    onPress,
    rightComponent
  }) => (
    <TouchableOpacity
      style={[styles.settingItem, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: theme.primary + '20' }]}>
          <MaterialCommunityIcons name={icon} size={24} color={theme.primary} />
        </View>
        <View style={styles.settingContent}>
          <Text style={[styles.settingTitle, { color: theme.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.settingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightComponent || (onPress && <MaterialCommunityIcons name="chevron-right" size={24} color={theme.textSecondary} />)}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.gradient, { backgroundColor: theme.background }]}>
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.text }]}>Generating your unique referral code...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.gradient, { backgroundColor: theme.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.openDrawer()}
          >
            <MaterialCommunityIcons name="menu" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Referral Program</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Referral Stats */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Referral Stats</Text>
            <View style={[styles.sectionContent, { shadowColor: theme.cardShadow }]}>
              <SettingItem
                title="Total Referrals"
                subtitle={`${referralStats.referralCount} friends invited`}
                icon="account-multiple"
                onPress={() => Alert.alert('Stats', 'View detailed referral statistics')}
              />
              <SettingItem
                title="Successful Referrals"
                subtitle={`${referralStats.bonusMonths} bonus months earned`}
                icon="check-circle"
                onPress={() => Alert.alert('Stats', 'View detailed referral statistics')}
              />
              <SettingItem
                title="Total Earnings"
                subtitle={`${referralStats.totalEarned} earned`}
                icon="cash"
                onPress={() => Alert.alert('Stats', 'View detailed referral statistics')}
              />
            </View>
          </View>

          {/* Your Referral Code */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Referral Code</Text>
            <View style={[styles.sectionContent, { shadowColor: theme.cardShadow }]}>
              <SettingItem
                title="Referral Code"
                subtitle={userReferralCode}
                icon="qrcode"
                onPress={copyReferralCode}
                rightComponent={
                  <TouchableOpacity onPress={copyReferralCode} style={styles.copyButton}>
                    <MaterialCommunityIcons name="content-copy" size={20} color="#667eea" />
                  </TouchableOpacity>
                }
              />
              <SettingItem
                title="Share Code"
                subtitle="Share via message, email, or social media"
                icon="share-variant"
                onPress={shareReferralCode}
              />
            </View>
          </View>

          {/* Enter Referral Code */}
          {!hasUsedReferral && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Have a Referral Code?</Text>
              <View style={[styles.sectionContent, { shadowColor: theme.cardShadow }]}>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      [styles.codeInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }],
                      inputReferralCode && !validateReferralCode(inputReferralCode) && [styles.codeInputError, { borderColor: theme.error, backgroundColor: theme.error + '20' }]
                    ]}
                    placeholder="Enter 6-character code"
                    placeholderTextColor={theme.textSecondary}
                    value={inputReferralCode}
                    onChangeText={(text) => {
                      const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                      setInputReferralCode(cleaned);
                    }}
                    autoCapitalize="characters"
                    maxLength={6}
                    editable={!isProcessing}
                  />
                  <TouchableOpacity
                    style={[
                      [styles.submitButton, { backgroundColor: theme.primary }],
                      {
                        opacity: (validateReferralCode(inputReferralCode) && !isProcessing) ? 1 : 0.5
                      }
                    ]}
                    onPress={submitReferralCode}
                    disabled={!validateReferralCode(inputReferralCode) || isProcessing}
                  >
                    <MaterialCommunityIcons name="check" size={22} color="white" />
                  </TouchableOpacity>
                </View>

                {inputReferralCode && !validateReferralCode(inputReferralCode) && (
                  <View style={[styles.errorContainer, { backgroundColor: theme.error + '20' }]}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color={theme.error} />
                    <Text style={[styles.errorText, { color: theme.error }]}>
                      Please enter a valid 6-character code (letters and numbers only)
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Already Used Referral Message */}
          {hasUsedReferral && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Referral Status</Text>
              <View style={[styles.sectionContent, { shadowColor: theme.cardShadow }]}>
                <SettingItem
                  title="Referral Code Applied"
                  subtitle="You've already used a referral code and received your bonus"
                  icon="check-circle"
                />
              </View>
            </View>
          )}

          {/* How It Works */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>How It Works</Text>
            <View style={[styles.sectionContent, { shadowColor: theme.cardShadow }]}>
              <SettingItem
                title="Step 1: Share Your Code"
                subtitle="Send your unique referral code to friends"
                icon="share-variant"
              />
              <SettingItem
                title="Step 2: Friend Signs Up"
                subtitle="Your friend downloads and creates an account"
                icon="account-plus"
              />
              <SettingItem
                title="Step 3: You Get Rewarded"
                subtitle="Earn premium features and exclusive benefits"
                icon="gift"
              />
            </View>
          </View>

          {/* Terms */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Terms & Conditions</Text>
            <View style={[styles.sectionContent, { shadowColor: theme.cardShadow }]}>
              <SettingItem
                title="Referral Terms"
                subtitle="Read the referral program terms"
                icon="file-document-outline"
                onPress={() => Alert.alert('Referral Terms', 'Referral program terms and conditions')}
              />
              <SettingItem
                title="Privacy Policy"
                subtitle="Learn how we protect your data"
                icon="shield-check"
                onPress={() => Alert.alert('Privacy Policy', 'Privacy policy information')}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  sectionContent: {
    marginHorizontal: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  copyButton: {
    padding: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  codeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  codeInputError: {
    borderColor: '#dc3545',
    backgroundColor: '#f8d7da',
  },
  submitButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ReferralScreen;