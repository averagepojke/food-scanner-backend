import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Vibration,
  Alert,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { authTheme } from './authTheme';

// Use shared theme constants
const theme = authTheme;

// Password strength checker
const checkPasswordStrength = (password) => {
  if (!password) return { score: 0, text: '', color: theme.colors.border };
  
  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
  
  score = Object.values(checks).filter(Boolean).length;
  
  if (score < 2) return { score, text: 'Weak', color: theme.colors.weak };
  if (score < 4) return { score, text: 'Medium', color: theme.colors.medium };
  return { score, text: 'Strong', color: theme.colors.strong };
};

// Custom hook for registration form
const useRegistrationForm = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password);
  };

  const validateField = (field, value) => {
    switch (field) {
      case 'username':
        if (!value) return 'Username is required';
        return null;
      case 'email':
        if (!value) return 'Email is required';
        if (!validateEmail(value)) return 'Please enter a valid email address';
        return null;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])/.test(value)) return 'Password must contain lowercase letter';
        if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain uppercase letter';
        if (!/(?=.*\d)/.test(value)) return 'Password must contain a number';
        return null;
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return null;
      default:
        return null;
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Real-time validation with debouncing
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
    
    // Also validate confirm password when password changes
    if (field === 'password' && formData.confirmPassword) {
      const confirmError = formData.confirmPassword !== value ? 'Passwords do not match' : null;
      setErrors(prev => ({ ...prev, confirmPassword: confirmError }));
    }
  };

  const touchField = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(field => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });
    
    if (!acceptTerms) {
      newErrors.terms = 'Please accept the terms and conditions';
    }
    
    setErrors(newErrors);
    setTouched({ username: true, email: true, password: true, confirmPassword: true, terms: true });
    return Object.keys(newErrors).length === 0;
  };

  return {
    formData,
    errors,
    touched,
    isLoading,
    setIsLoading,
    acceptTerms,
    setAcceptTerms,
    updateField,
    touchField,
    validateForm,
  };
};

// Enhanced input component (reused from login)
const EnhancedInput = ({
  label,
  value,
  onChangeText,
  onFocus,
  onBlur,
  error,
  touched,
  autoFocus = false,
  nextInputRef,
  leftIconName,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedBorder = useRef(new Animated.Value(0)).current;
  const animatedError = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedBorder, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  useEffect(() => {
    Animated.timing(animatedError, {
      toValue: error && touched ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [error, touched]);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handleSubmitEditing = () => {
    if (nextInputRef?.current) {
      nextInputRef.current.focus();
    }
  };

  const borderColor = animatedBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.primary],
  });

  const backgroundColor = animatedBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.white, theme.colors.primaryLight],
  });

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Animated.View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor,
          },
          error && touched && styles.inputError,
        ]}
      >
        {leftIconName ? (
          <MaterialCommunityIcons name={leftIconName} size={20} color={theme.colors.textPlaceholder} style={{ marginLeft: theme.spacing.lg }} />
        ) : null}
        <TextInput
          style={[styles.input, leftIconName && { paddingLeft: theme.spacing.md }]}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitEditing}
          autoFocus={autoFocus}
          returnKeyType={nextInputRef ? 'next' : 'done'}
          accessibilityLabel={label}
          accessibilityHint={error && touched ? error : undefined}
          {...props}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.errorContainer,
          {
            opacity: animatedError,
            transform: [
              {
                translateY: animatedError.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
      >
        {error && touched && (
          <Text style={styles.errorText}>{error}</Text>
        )}
      </Animated.View>
    </View>
  );
};

// Password input with strength meter
const PasswordInputWithStrength = ({ 
  label, 
  value, 
  onChangeText, 
  onFocus, 
  onBlur, 
  error, 
  touched,
  inputRef,
  showStrengthMeter = false
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const animatedBorder = useRef(new Animated.Value(0)).current;
  const strengthAnim = useRef(new Animated.Value(0)).current;

  const passwordStrength = checkPasswordStrength(value);

  useEffect(() => {
    Animated.timing(animatedBorder, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  useEffect(() => {
    if (showStrengthMeter) {
      Animated.timing(strengthAnim, {
        toValue: passwordStrength.score / 5,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [passwordStrength.score, showStrengthMeter]);

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const borderColor = animatedBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.border, theme.colors.primary],
  });

  const backgroundColor = animatedBorder.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.white, theme.colors.primaryLight],
  });

  const strengthWidth = strengthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <Animated.View
        style={[
          styles.passwordContainer,
          {
            borderColor,
            backgroundColor,
          },
          error && touched && styles.inputError,
        ]}
      >
        <MaterialCommunityIcons name="lock-outline" size={20} color={theme.colors.textPlaceholder} style={{ marginLeft: theme.spacing.lg }} />
        <TextInput
          ref={inputRef}
          style={styles.passwordInput}
          placeholder={showStrengthMeter ? "Create a secure password" : "Confirm your password"}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={!showPassword}
          autoComplete={showStrengthMeter ? "new-password" : "password"}
          returnKeyType="next"
          placeholderTextColor={theme.colors.textPlaceholder}
          accessibilityLabel={label}
          accessibilityHint={error && touched ? error : undefined}
        />
        <TouchableOpacity 
          style={styles.showPasswordButton}
          onPress={() => setShowPassword(!showPassword)}
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
        >
          <Text style={styles.showPasswordText}>
            {showPassword ? 'Hide' : 'Show'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Password Strength Meter */}
      {showStrengthMeter && value && (
        <View style={styles.strengthMeterContainer}>
          <View style={styles.strengthMeterTrack}>
            <Animated.View 
              style={[
                styles.strengthMeterFill, 
                { 
                  width: strengthWidth,
                  backgroundColor: passwordStrength.color
                }
              ]} 
            />
          </View>
          <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
            {passwordStrength.text}
          </Text>
        </View>
      )}
      
      {error && touched && (
        <Animated.View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}
    </View>
  );
};

// Loading button component (reused from login)
const LoadingButton = ({ isLoading, onPress, disabled, children, style, textStyle }) => {
  const animatedScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(animatedScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: animatedScale }] }}>
      <TouchableOpacity 
        style={[styles.buttonBase, style, (isLoading || disabled) && styles.disabledButton]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLoading || disabled}
        accessibilityLabel={isLoading ? 'Creating account...' : 'Create account'}
        accessibilityState={{ disabled: isLoading || disabled }}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={theme.colors.white} size="small" />
            <Text style={[textStyle, { marginLeft: theme.spacing.sm }]}>
              Creating Account...
            </Text>
          </View>
        ) : (
          children
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Main registration screen component
export default function RegisterScreen({ navigation }) {
  const dynamicTheme = {
    statusBar: 'light-content',
    background: '#0a0f14',
    surface: '#0e1a14',
    text: '#E5F7EF',
    textSecondary: '#A4C9BB',
    primary: '#10B981',
    cardShadow: 'rgba(0,0,0,0.35)',
    gradient: ['#0EA5E9', '#10B981'],
  };
  const {
    formData,
    errors,
    touched,
    isLoading,
    setIsLoading,
    acceptTerms,
    setAcceptTerms,
    updateField,
    touchField,
    validateForm,
  } = useRegistrationForm();

  const { register, sendVerificationEmail, updateProfile } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const passwordInputRef = useRef(null);
  const confirmPasswordInputRef = useRef(null);

  useEffect(() => {
    // Enhanced entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!validateForm()) {
      // Haptic feedback for validation errors
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 50]);
      } else {
        Vibration.vibrate(50);
      }
      return;
    }

    setIsLoading(true);

    try {
      await register(formData.email.trim(), formData.password);

      // Set display name
      try {
        if (formData.username?.trim()) {
          await updateProfile({ displayName: formData.username.trim() });
        }
      } catch (err) {
        console.warn('Failed to set display name during registration:', err?.message);
      }

      // Send verification email
      try {
        await sendVerificationEmail();
      } catch (err) {
        console.warn('Failed to send verification email immediately after register:', err?.message);
      }

      // Success haptic feedback
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 100, 50, 100]);
      } else {
        Vibration.vibrate([100, 50, 100]);
      }

      // Clear any existing onboarding data for new user
      await AsyncStorage.multiRemove(['onboardingSelection', 'onboardingCompleted']);
      console.log('Registration successful, verification email sent, cleared onboarding data');

    } catch (e) {
      // Error haptic feedback
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 100, 100, 100]);
      } else {
        Vibration.vibrate([100, 100, 100]);
      }
      
      Alert.alert('Registration Failed', e.message || 'Please try again with different credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTermsPress = () => {
    Alert.alert(
      'Terms & Conditions',
      'By creating an account, you agree to our Terms of Service and Privacy Policy. This includes allowing us to process your food scanning data to provide personalised nutrition insights.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept', onPress: () => setAcceptTerms(true) }
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle={dynamicTheme.statusBar} backgroundColor={dynamicTheme.background} />
      <LinearGradient
        colors={dynamicTheme.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.content, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            },
            { backgroundColor: dynamicTheme.surface, shadowColor: dynamicTheme.cardShadow }
          ]}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Image source={require('../assets/Pantrify-Logo.png')} style={styles.brandLogo} accessibilityLabel="Pantrify logo" />
            </View>
            <Text style={[styles.title, { color: dynamicTheme.text }]}>Join Pantrify</Text>
            <Text style={[styles.subtitle, { color: dynamicTheme.textSecondary }]}>
              Start scanning and discover personalised nutrition info
            </Text>
          </View>

          <View style={styles.form}>
            <EnhancedInput
              label="Email Address"
              value={formData.email}
              onChangeText={(text) => updateField('email', text)}
              onFocus={() => touchField('email')}
              onBlur={() => touchField('email')}
              error={errors.email}
              touched={touched.email}
              autoFocus={true}
              nextInputRef={passwordInputRef}
              placeholder="Enter your email"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              autoComplete="email"
              placeholderTextColor={theme.colors.textPlaceholder}
              leftIconName="email-outline"
            />

            <PasswordInputWithStrength
              label="Password"
              value={formData.password}
              onChangeText={(text) => updateField('password', text)}
              onFocus={() => touchField('password')}
              onBlur={() => touchField('password')}
              error={errors.password}
              touched={touched.password}
              inputRef={passwordInputRef}
              showStrengthMeter={true}
            />

            <PasswordInputWithStrength
              label="Confirm Password"
              value={formData.confirmPassword}
              onChangeText={(text) => updateField('confirmPassword', text)}
              onFocus={() => touchField('confirmPassword')}
              onBlur={() => touchField('confirmPassword')}
              error={errors.confirmPassword}
              touched={touched.confirmPassword}
              inputRef={confirmPasswordInputRef}
              showStrengthMeter={false}
            />

            {/* Terms and Conditions */}
            <TouchableOpacity 
              style={styles.termsContainer}
              onPress={() => setAcceptTerms(!acceptTerms)}
              accessibilityLabel="Accept terms and conditions"
              accessibilityState={{ checked: acceptTerms }}
            >
              <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
                {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <View style={styles.termsTextContainer}>
                <Text style={styles.termsText}>
                  I agree to the{' '}
                  <Text style={styles.termsLink} onPress={() => navigation.navigate('Terms')}>
                    Terms of Service
                  </Text>
                  {' '}and{' '}
                  <Text style={styles.termsLink} onPress={() => navigation.navigate('Privacy')}>
                    Privacy Policy
                  </Text>
                </Text>
              </View>
            </TouchableOpacity>

            {errors.terms && touched.terms && (
              <Text style={styles.termsError}>{errors.terms}</Text>
            )}

            <LoadingButton
              isLoading={isLoading}
              onPress={handleRegister}
              style={[styles.createButton]}
              textStyle={[styles.createButtonText, { color: '#fff' }]}
              gradientColors={dynamicTheme.gradient}
            >
              <Text style={[styles.createButtonText, { color: '#fff' }]}>Create Account</Text>
            </LoadingButton>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => navigation.navigate('Login')}
              accessibilityLabel="Go to sign in"
            >
              <Text style={[styles.loginButtonText, { color: dynamicTheme.textSecondary }]}>
                Already have an account?{' '}
                <Text style={[styles.loginButtonTextBold, { color: dynamicTheme.primary }]}>Sign In</Text>
              </Text>
            </TouchableOpacity>
            <Text style={styles.legalText}>By creating an account you agree to our Terms and Privacy Policy.</Text>
          </View>
          {/* Removed blur overlay for clarity */}
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.huge,
  },
  content: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xxxl,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxxl,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
  },
  scanIcon: {
    fontSize: theme.fontSize.xl,
    marginRight: theme.spacing.xs,
  },
  foodIcon: {
    fontSize: theme.fontSize.xl,
    marginLeft: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: theme.fontSize.xl,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: '#374151',
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    padding: theme.spacing.lg,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
  },
  passwordInput: {
    flex: 1,
    padding: theme.spacing.lg,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  showPasswordButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  showPasswordText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  strengthMeterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  strengthMeterTrack: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },
  strengthMeterFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    minWidth: 60,
  },
  errorContainer: {
    marginTop: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkmark: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  termsError: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
    marginBottom: theme.spacing.sm,
  },
  buttonBase: {
    minHeight: 52,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  createButton: {
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: theme.colors.disabled,
    shadowColor: theme.colors.disabled,
  },
  createButtonText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.xxl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.divider,
  },
  dividerText: {
    color: theme.colors.textPlaceholder,
    fontSize: theme.fontSize.sm,
    marginHorizontal: theme.spacing.lg,
    fontWeight: '500',
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  loginButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  loginButtonTextBold: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  brandLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  legalText: {
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    color: '#A4C9BB',
    fontSize: 12,
  },
});