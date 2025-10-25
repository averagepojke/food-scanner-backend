import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
  Alert,
  Animated,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ShoppingListContext } from './App';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './food-scanner-app/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useGamification } from './Gamification';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { navigationRef } from './navigationRef';
import { getTheme, ACCENT_COLORS } from './theme';
import { useSubscription } from './ImprovedSubscriptionManager';
import SubscriptionBadge from './SubscriptionBadge';
import { SafeAreaView} from 'react-native-safe-area-context';



const ProfileOption = ({ icon, title, subtitle, onPress, theme, showArrow = true, rightComponent = null, delay = 0 }) => {
  const scaleAnim = new Animated.Value(0);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        delay: delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [theme]);

  return (
    <Animated.View
      key={`option-${theme.background}`}
      style={[
        styles.profileOption,
        { backgroundColor: theme.surface, shadowColor: theme.cardShadow },
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
      ]}
    >
      <TouchableOpacity
        style={styles.profileOptionContent}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={!onPress}
      >
        <View style={[styles.optionIconContainer, { backgroundColor: theme.primary + '20' }]}>
          <MaterialCommunityIcons name={icon} size={24} color={theme.primary} />
        </View>
        <View style={styles.optionTextContainer}>
          <Text style={[styles.optionTitle, { color: theme.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>
        {rightComponent || (showArrow && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={theme.textSecondary}
          />
        ))}
      </TouchableOpacity>
    </Animated.View>
  );
};

const ProfileSection = ({ title, children, theme, delay = 0 }) => {
  const slideAnim = new Animated.Value(20);
  const opacityAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        delay: delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [theme]);

  return (
    <Animated.View
      key={`section-${theme.background}`}
      style={[
        styles.profileSection,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </Animated.View>
  );
};

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { darkMode, setDarkMode, shoppingList, foodInventory, accentKey, setAccentKey, spendingHistory } = useContext(ShoppingListContext);
  const { logout, user, updateProfile, sendVerificationEmail, reloadUser } = useAuth();
  const { points, getUserLevel, getTieredAchievements } = useGamification();
  const { isSubscribed, getSubscriptionStatus } = useSubscription();
  const theme = getTheme(accentKey, darkMode);
  const [headerOpacity] = useState(new Animated.Value(0));
  const [profileOpacity] = useState(new Animated.Value(0));
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || null);
  const [uploading, setUploading] = useState(false);
  const [themeResetKey, setThemeResetKey] = useState(0); // dummy state for force re-render
  const [exportModalVisible, setExportModalVisible] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || '');
    setPhotoURL(user?.photoURL || null);
  }, [user]);

  // No need to load accentKey here, it's handled by context

  useEffect(() => {
    StatusBar.setBarStyle(theme.statusBar, true);
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(profileOpacity, {
        toValue: 1,
        duration: 1000,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [darkMode, accentKey, theme]);

  const handleAccentChange = async (key) => {
    if (key === 'default') {
      // Reset to default: set context state first
      setAccentKey('default');
      setDarkMode(false);
      setThemeResetKey(prev => prev + 1); // force re-render
      // Then clear AsyncStorage
      try {
        await AsyncStorage.removeItem('accentKey');
        await AsyncStorage.removeItem('darkMode');
      } catch (e) {
        // ignore
      }
    } else {
      setAccentKey(key);
      try {
        await AsyncStorage.setItem('accentKey', key);
      } catch (e) {
        // ignore
      }
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all your data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'All data has been cleared successfully.');
            } catch (error) {
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  // CSV export helpers
  function arrayToCSV(rows) {
    return rows.map(row => row.map(field => '"' + String(field).replace(/"/g, '""') + '"').join(',')).join('\n');
  }

  async function exportSpendingCSV() {
    const rows = [
      ['Date', 'Name', 'Quantity', 'Price', 'Total', 'Category'],
      ...spendingHistory.map(r => [r.dateSpent, r.name, r.quantity, r.price, (r.price * r.quantity).toFixed(2), r.category || ''])
    ];
    const csv = arrayToCSV(rows);
    const fileUri = FileSystem.cacheDirectory + 'spending_history.csv';
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      Alert.alert('Export Complete', 'CSV file saved to: ' + fileUri);
    }
  }

  async function exportInventoryCSV() {
    const rows = [
      ['Name', 'Quantity', 'Price', 'Total Value', 'Category', 'Expiry', 'Date Added'],
      ...foodInventory.map(i => [i.name, i.quantity, i.price, (i.price * (i.quantity || 1)).toFixed(2), i.category || '', i.expiry || '', i.dateAdded || ''])
    ];
    const csv = arrayToCSV(rows);
    const fileUri = FileSystem.cacheDirectory + 'food_inventory.csv';
    await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
    } else {
      Alert.alert('Export Complete', 'CSV file saved to: ' + fileUri);
    }
  }

  // Create a JSON backup of key app data and share/save it
  async function backupData() {
    try {
      const timestamp = new Date().toISOString();
      const payload = {
        schemaVersion: 1,
        createdAt: timestamp,
        user: user ? { uid: user.uid, email: user.email || null } : null,
        settings: {
          darkMode,
          accentKey,
          monthlyBudget,
        },
        data: {
          foodInventory,
          shoppingList,
          spendingHistory,
        },
      };

      const json = JSON.stringify(payload, null, 2);
      const safeTs = timestamp.replace(/[:.]/g, '-');
      const fileUri = FileSystem.cacheDirectory + `food_scanner_backup_${safeTs}.json`;

      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Share Pantrify Backup',
        });
      } else {
        Alert.alert('Backup Complete', 'Backup file saved to: ' + fileUri);
      }
    } catch (e) {
      Alert.alert('Backup Failed', e?.message || 'An error occurred while creating the backup.');
    }
  }

  const handleExportData = () => {
    setExportModalVisible(true);
  };

  const handleAbout = () => {
    Alert.alert(
      'About Pantrify',
      'Pantrify v1.0\n\nA smart food inventory management app that helps you track your food items and manage your shopping list efficiently.',
      [{ text: 'OK' }]
    );
  };

  const toggleDarkMode = async (value) => {
    setDarkMode(value);
    try {
      await AsyncStorage.setItem('darkMode', JSON.stringify(value));
    } catch (error) {
    }
  };

  const handleSaveName = async () => {
    try {
      await updateProfile({ displayName });
      setEditingName(false);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to update name');
    }
  };

  const pickImage = async () => {
    try {
      // Request permission first
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert(
          'Permission Required',
          'Permission to access camera roll is required to change your profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Show options for camera or gallery
      Alert.alert(
        'Change Profile Picture',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Camera', onPress: () => openCamera() },
          { text: 'Photo Library', onPress: () => openImagePicker() },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to request permission');
    }
  };

  const openCamera = async () => {
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      
      if (cameraPermission.granted === false) {
        Alert.alert('Permission Required', 'Camera permission is required to take a photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await updateProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const openImagePicker = async () => {
    try {
      const libPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (libPermission.granted === false) {
        Alert.alert('Permission Required', 'Photo library permission is required to choose a picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await updateProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open image picker');
    }
  };

  const updateProfilePicture = async (uri) => {
    setUploading(true);
    try {
      // In a real app, you would upload to Firebase Storage or another service
      // For now, we'll just use the local URI
      await updateProfile({ photoURL: uri });
      setPhotoURL(uri);
      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile picture');
    } finally {
      setUploading(false);
    }
  };

  // Get user level and progress
  const userLevel = getUserLevel();
  const progressPercentage = Math.round(userLevel.progress * 100);
  const subscriptionStatus = getSubscriptionStatus();

  return (
    <SafeAreaView key={themeResetKey} style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.background} />
      
      <Animated.View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
          { opacity: headerOpacity },
        ]}
      >
        <SubscriptionBadge theme={theme} />
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.overlay }]}
          onPress={() => navigation.openDrawer()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="menu" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        <View style={styles.headerSpacer} />
      </Animated.View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Info */}
        <Animated.View
          style={[styles.profileCard, { backgroundColor: theme.surface, shadowColor: theme.cardShadow }, { opacity: profileOpacity }]}
        >
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarContainer}>
            {photoURL ? (
              <>
                <Image source={{ uri: photoURL }} style={styles.avatarImage} />
                {uploading && (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}>
                <MaterialCommunityIcons name="account" size={48} color={theme.primary} />
                {uploading && (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator size="large" color={theme.primary} />
                  </View>
                )}
              </View>
            )}
            <View style={[styles.editAvatarOverlay, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MaterialCommunityIcons name="camera" size={20} color={theme.primary} />
            </View>
          </TouchableOpacity>

          {editingName ? (
            <View style={styles.editNameRow}>
              <TextInput
                style={[styles.editNameInput, { borderColor: theme.border, backgroundColor: theme.surface, color: theme.text }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your name"
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
              <TouchableOpacity onPress={handleSaveName} style={[styles.saveNameButton, { backgroundColor: theme.primary }]}>
                <Text style={styles.saveNameButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => { setEditingName(false); setDisplayName(user?.displayName || ''); }} 
                style={[styles.cancelNameButton, { backgroundColor: theme.error }]}
              >
                <Text style={styles.cancelNameButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={[styles.profileName, { color: theme.text }]}>{displayName || 'Pantrify User'}</Text>
              <TouchableOpacity onPress={() => setEditingName(true)} style={styles.editNameButton}>
                <MaterialCommunityIcons name="pencil" size={18} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{user?.email || ''}</Text>
          <Text style={[styles.profileStats, { color: theme.textSecondary }]}>
            {foodInventory?.length || 0} items in inventory • {shoppingList?.length || 0} shopping items
          </Text>

          {/* Email verification notice (non-blocking) */}
          {!user?.emailVerified && (
            <View style={[styles.verifyBanner, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '50' }]}>
              <View style={styles.verifyBannerLeft}>
                <MaterialCommunityIcons name="email-alert-outline" size={22} color={theme.accent} />
                <Text style={[styles.verifyBannerText, { color: theme.text }]}>Please verify your email to secure your account.</Text>
              </View>
              <View style={styles.verifyActions}>
                <TouchableOpacity
                  onPress={async () => {
                    try { await sendVerificationEmail(); Alert.alert('Sent', 'Verification email sent.'); } catch (e) { Alert.alert('Error', e?.message || 'Failed to send.'); }
                  }}
                  style={[styles.verifyBtn, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.verifyBtnText}>Resend</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    try { const u = await reloadUser(); if (u?.emailVerified) { Alert.alert('Verified', 'Thanks for verifying!'); } else { Alert.alert('Not verified yet', 'Open the link in your email, then tap Check again.'); } } catch (e) { Alert.alert('Error', e?.message || 'Could not refresh.'); }
                  }}
                  style={[styles.verifyBtnGhost, { borderColor: theme.accent }]}
                >
                  <Text style={[styles.verifyBtnGhostText, { color: theme.accent }]}>Check</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          
          {/* Enhanced Level Information */}
          <View style={[styles.levelContainer, { borderTopColor: theme.border }]}>
            <View style={styles.levelHeader}>
              <View style={[styles.levelIconContainer, { backgroundColor: theme.primary + '15' }]}>
                <MaterialCommunityIcons name="star" size={28} color={theme.primary} />
              </View>
              <View style={styles.levelInfo}>
                <Text style={[styles.levelTitle, { color: theme.text }]}>Level {userLevel.level}</Text>
                <Text style={[styles.pointsValue, { color: theme.textSecondary }]}>
                  {points} Points
                </Text>
              </View>
            </View>

            {/* Enhanced Progress Bar */}
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                  Progress to Level {userLevel.level + 1}
                </Text>
                <Text style={[styles.progressPercentage, { color: theme.primary }]}>
                  {progressPercentage}%
                </Text>
              </View>
              
              <View style={[styles.progressBarContainer, { backgroundColor: theme.border + '40' }]}>
                <Animated.View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      backgroundColor: theme.primary,
                      width: `${progressPercentage}%`,
                    }
                  ]} 
                />
                <View style={[styles.progressBarGlow, { backgroundColor: theme.primary + '30', width: `${progressPercentage}%` }]} />
              </View>
              
              <Text style={[styles.progressDescription, { color: theme.textSecondary }]}>
                {userLevel.pointsToNext} points needed for next level
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Preferences */}
        <ProfileSection title="Preferences" theme={theme} delay={300}>
          <ProfileOption
            key={`darkmode-${theme.background}`}
            icon="theme-light-dark"
            title="Dark Mode"
            subtitle="Toggle between light and dark theme"
            theme={theme}
            showArrow={false}
            rightComponent={
              <Switch
                value={darkMode}
                onValueChange={toggleDarkMode}
                trackColor={{ false: theme.border, true: theme.primary + '40' }}
                thumbColor={darkMode ? theme.primary : theme.textSecondary}
              />
            }
            delay={400}
          />
          {/* Accent Color Picker - moved here */}
          <View style={styles.accentRowContainer}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 8, fontSize: 14 }]}>Theme Color</Text>
            <View style={styles.accentSwatchRow}>
              {ACCENT_COLORS.map((c) => (
                <TouchableOpacity
                  key={`accent-${c.key}-${theme.background}`}
                  style={[styles.accentSwatch, { 
                    backgroundColor: c.key === 'default' ? 'transparent' : c.color, 
                    borderWidth: accentKey === c.key || (!accentKey && c.key === 'default') ? 3 : 1, 
                    borderColor: accentKey === c.key || (!accentKey && c.key === 'default') ? theme.primary : theme.border 
                  }]}
                  onPress={() => handleAccentChange(c.key)}
                  activeOpacity={0.8}
                >
                  {c.key === 'default' ? (
                    <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <ProfileOption
            key={`notifications-${theme.background}`}
            icon="bell-outline"
            title="Notifications"
            subtitle="Manage your notification preferences"
            onPress={() => Alert.alert('Notifications', 'Notification settings would be implemented here.')}
            theme={theme}
            delay={500}
          />
          <ProfileOption
            key={`reminders-${theme.background}`}
            icon="clock-outline"
            title="Expiration Reminders"
            subtitle="Get notified when items are expiring"
            onPress={() => Alert.alert('Reminders', 'Reminder settings would be implemented here.')}
            theme={theme}
            delay={600}
          />
          <ProfileOption
            key={`rechoose-features-${theme.background}`}
            icon="star-circle"
            title="Rechoose Features"
            subtitle="Change your feature selection and onboarding preferences"
            onPress={() => {
              Alert.alert(
                'Rechoose Features',
                'Are you sure you want to reselect your preferred features? The app will restart onboarding.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Rechoose', style: 'destructive', onPress: async () => {
                      await AsyncStorage.removeItem('onboardingSelection');
                      await AsyncStorage.removeItem('onboardingCompleted');
                      // Trigger RootNavigator to re-evaluate and show onboarding
                      if (global.onboardingCompletionCallback) {
                        global.onboardingCompletionCallback();
                      }
                    }
                  }
                ]
              );
            }}
            theme={theme}
            delay={650}
          />
        </ProfileSection>

        {/* Subscription */}
        <ProfileSection title="Subscription" theme={theme} delay={620}>
          <ProfileOption
            key={`subscription-${theme.background}`}
            icon="crown"
            title="Manage Subscription"
            subtitle={
              !isSubscribed
                ? 'Not subscribed'
                : (subscriptionStatus?.willCancelAtPeriodEnd
                    ? `Cancels at period end — ${subscriptionStatus.daysRemaining} days remaining`
                    : `Active — ${subscriptionStatus.daysRemaining} days remaining`)
            }
            onPress={() => navigation.navigate('ManageSubscription')}
            theme={theme}
            delay={630}
          />
        </ProfileSection>

        {/* Gamification */}
        <ProfileSection title="Achievements & Progress" theme={theme} delay={600}>
          <ProfileOption
            key={`achievements-${theme.background}`}
            icon="trophy"
            title="View All Achievements"
            subtitle="See your progress and unlocked achievements"
            onPress={() => navigation.navigate('Progress', { returnTo: 'Profile' })}
            theme={theme}
            delay={650}
          />
          
          <ProfileOption
            key={`stats-${theme.background}`}
            icon="chart-line"
            title="Statistics"
            subtitle="View detailed usage statistics"
            onPress={() => navigationRef.navigate('Statistics')}
            theme={theme}
            delay={700}
          />
        </ProfileSection>

        {/* Data Management */}
        <ProfileSection title="Data Management" theme={theme} delay={900}>

          <ProfileOption
            key={`export-${theme.background}`}
            icon="export"
            title="Export Data"
            subtitle="Save your data to a file"
            onPress={handleExportData}
            theme={theme}
            delay={1000}
          />
          <ProfileOption
            key={`backup-${theme.background}`}
            icon="backup-restore"
            title="Backup Data"
            subtitle="Create and share a backup JSON file"
            onPress={backupData}
            theme={theme}
            delay={1100}
          />
          <ProfileOption
            key={`clear-${theme.background}`}
            icon="delete-outline"
            title="Clear All Data"
            subtitle="Remove all your data from the app"
            onPress={handleClearData}
            theme={theme}
            delay={1200}
          />
        </ProfileSection>

        {/* Support */}
        <ProfileSection title="Support" theme={theme} delay={1300}>
          <ProfileOption
            key={`help-${theme.background}`}
            icon="help-circle-outline"
            title="Help & FAQ"
            subtitle="Get help and find answers"
            onPress={() => navigationRef.navigate('FAQ')}
            theme={theme}
            delay={1400}
          />
          
          {isSubscribed && (
            <ProfileOption
              key={`referral-${theme.background}`}
              icon="account-multiple-plus"
              title="Invite Friends"
              subtitle="Share your referral code and get 6 months free"
              onPress={() => navigation.navigate('ReferralScreen')}
              theme={theme}
              delay={1450}
            />
          )}
          <ProfileOption
            key={`contact-${theme.background}`}
            icon="email-outline"
            title="Contact Support"
            subtitle="Chat with a bot or send a request"
            onPress={() => navigationRef.navigate('SupportChat')}
            theme={theme}
            delay={1500}
          />
          <ProfileOption
            key={`rate-${theme.background}`}
            icon="star-outline"
            title="Rate App"
            subtitle="Rate us on the App Store"
            onPress={() => Alert.alert('Rate App', 'App Store rating would be implemented here.')}
            theme={theme}
            delay={1600}
          />
        </ProfileSection>

        {/* About */}
        <ProfileSection title="About" theme={theme} delay={1700}>
          <ProfileOption
            key={`about-${theme.background}`}
            icon="information-outline"
            title="About Pantrify"
            subtitle="Learn more about this app"
            onPress={handleAbout}
            theme={theme}
            delay={1800}
          />
          <ProfileOption
            key={`privacy-${theme.background}`}
            icon="shield-check-outline"
            title="Privacy Policy"
            subtitle="Read our privacy policy"
            onPress={() => navigationRef.navigate('Privacy')}
            theme={theme}
            delay={1900}
          />
          <ProfileOption
            key={`terms-${theme.background}`}
            icon="file-document-outline"
            title="Terms of Service"
            subtitle="Read our terms of service"
            onPress={() => navigationRef.navigate('Terms')}
            theme={theme}
            delay={2000}
          />
        </ProfileSection>

        
        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.error }]}
          onPress={logout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: theme.textSecondary }]}>
            Pantrify v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Export Modal */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 24, width: 300, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16 }}>Export Data</Text>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.primary, width: '100%', marginBottom: 12 }]} onPress={async () => { setExportModalVisible(false); await exportSpendingCSV(); }}>
              <MaterialCommunityIcons name="file-export" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Export Spending (CSV)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.accent, width: '100%' }]} onPress={async () => { setExportModalVisible(false); await exportInventoryCSV(); }}>
              <MaterialCommunityIcons name="file-export" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Export Inventory (CSV)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 16 }} onPress={() => setExportModalVisible(false)}>
              <Text style={{ color: theme.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 16,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
    position: 'relative',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 50,
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 16,
    padding: 8,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  profileStats: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  editNameButton: {
    marginLeft: 8,
    padding: 4,
  },
  editNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  editNameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 16,
    marginRight: 8,
  },
  saveNameButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 4,
  },
  saveNameButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  cancelNameButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelNameButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  levelContainer: {
    marginTop: 24,
    paddingTop: 20,
    paddingBottom: 4,
    borderTopWidth: 1,
    width: '100%',
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelIconContainer: {
    borderRadius: 20,
    padding: 12,
    marginRight: 12,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  pointsValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressSection: {
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  progressBarGlow: {
    height: '100%',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0.3,
  },
  progressDescription: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  profileSection: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  profileOption: {
    borderRadius: 12,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  accentRowContainer: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  accentSwatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  accentSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  versionContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 20,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Email verification banner styles
  verifyBanner: {
    width: '100%',
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  verifyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  verifyBannerText: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  verifyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    justifyContent: 'flex-end',
    width: '100%'
  },
  verifyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  verifyBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  verifyBtnGhost: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
  },
  verifyBtnGhostText: {
    fontWeight: '700',
    fontSize: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});