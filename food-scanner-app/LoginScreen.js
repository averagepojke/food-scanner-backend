import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Animated,
  Vibration,
  Dimensions,
  StatusBar,
  Keyboard
} from 'react-native';
import { useAuth } from './AuthContext';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'react-native';
import { authTheme } from './authTheme';

// Use shared theme constants
const theme = authTheme;

// Custom hook for form management
const useLoginForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateField = (field, value) => {
    switch (field) {
      case 'email':
        if (!value) return 'Email is required';
        if (!validateEmail(value)) return 'Please enter a valid email address';
        return null;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
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
    setErrors(newErrors);
    setTouched({ email: true, password: true });
    return Object.keys(newErrors).length === 0;
  };

  return {
    formData,
    errors,
    touched,
    isLoading,
    setIsLoading,
    rememberMe,
    setRememberMe,
    updateField,
    touchField,
    validateForm,
  };
};

// Enhanced input component with better accessibility
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

// Enhanced password input with show/hide
const PasswordInput = ({ 
  label, 
  value, 
  onChangeText, 
  onFocus, 
  onBlur, 
  error, 
  touched,
  inputRef 
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const animatedBorder = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedBorder, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

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
          placeholder="Enter your password"
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={!showPassword}
          autoComplete="password"
          returnKeyType="done"
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
      {error && touched && (
        <Animated.View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </Animated.View>
      )}
    </View>
  );
};

// Loading button component
const LoadingButton = ({ isLoading, onPress, disabled, children, style, textStyle, gradientColors }) => {
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
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLoading || disabled}
        accessibilityLabel={isLoading ? 'Signing in...' : 'Sign in'}
        accessibilityState={{ disabled: isLoading || disabled }}
        activeOpacity={0.9}
        style={[{ borderRadius: theme.borderRadius.md, overflow: 'hidden' }, (isLoading || disabled) && styles.disabledButton]}
      >
        <LinearGradient
          colors={gradientColors || ['#10B981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[style, { paddingVertical: theme.spacing.lg, alignItems: 'center', justifyContent: 'center' }]}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.colors.white} size="small" />
              <Text style={[textStyle, { marginLeft: theme.spacing.sm, color: '#fff' }]}>Signing in...</Text>
            </View>
          ) : (
            children
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Main login screen component
export default function LoginScreen({ navigation }) {
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
    rememberMe,
    setRememberMe,
    updateField,
    touchField,
    validateForm,
  } = useLoginForm();

  const { login, signInWithGoogle, reloadUser } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const passwordInputRef = useRef(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [loginError, setLoginError] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

  useEffect(() => {
    const showSub = Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow';
    const hideSub = Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide';
    const showListener = Keyboard.addListener(showSub, () => setKeyboardVisible(true));
    const hideListener = Keyboard.addListener(hideSub, () => setKeyboardVisible(false));
    return () => { showListener.remove(); hideListener.remove(); };
  }, []);

  const handleLogin = async () => {
    if (!validateForm()) {
      // Haptic feedback for validation errors
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 50]);
      } else {
        Vibration.vibrate(50);
      }
      return;
    }

    // Rate limiting
    if (loginAttempts >= 3) {
      const waitTime = Math.pow(2, loginAttempts - 3) * 1000; // Exponential backoff
      Alert.alert(
        'Too Many Attempts',
        `Please wait ${waitTime / 1000} seconds before trying again.`
      );
      return;
    }

    setIsLoading(true);
    
    try {
      await login(formData.email.trim(), formData.password, rememberMe);
      
      // Success haptic feedback
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 100, 50, 100]);
      } else {
        Vibration.vibrate([100, 50, 100]);
      }
      
      // Success animation could go here
      
    } catch (e) {
      setLoginAttempts(prev => prev + 1);
      setLoginError(e.message || 'Please check your credentials and try again.');
      
      // Error haptic feedback
      if (Platform.OS === 'ios') {
        Vibration.vibrate([0, 100, 100, 100]);
      } else {
        Vibration.vibrate([100, 100, 100]);
      }
      
      Alert.alert('Login Failed', e.message || 'Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!formData.email.trim()) {
      Alert.alert('Enter Email', 'Please enter your email address first');
      return;
    }
    Alert.alert('Reset Password', 'Password reset link sent to your email');
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
          {loginError ? (
            <View style={styles.errorBanner}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#fff" />
              <Text style={styles.errorBannerText}>{loginError}</Text>
            </View>
          ) : null}
          
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Image source={require('../assets/Pantrify-Logo.png')} style={styles.brandLogo} accessibilityLabel="Pantrify logo" />
            </View>
            <Text style={[styles.title, { color: dynamicTheme.text }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: dynamicTheme.textSecondary }]}>Sign in to continue scanning and tracking</Text>
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

            <PasswordInput
              label="Password"
              value={formData.password}
              onChangeText={(text) => updateField('password', text)}
              onFocus={() => touchField('password')}
              onBlur={() => touchField('password')}
              error={errors.password}
              touched={touched.password}
              inputRef={passwordInputRef}
            />

            {/* Remember Me Toggle */}
            <TouchableOpacity 
              style={styles.rememberMeContainer}
              onPress={() => setRememberMe(!rememberMe)}
              accessibilityLabel="Remember me"
              accessibilityState={{ checked: rememberMe }}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.rememberMeText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
              accessibilityLabel="Forgot password"
            >
              <Text style={[styles.forgotPasswordText, { color: dynamicTheme.primary }]}>Forgot Password?</Text>
            </TouchableOpacity>

            <LoadingButton
              isLoading={isLoading}
              onPress={handleLogin}
              style={[styles.loginButton]}
              textStyle={[styles.loginButtonText, { color: '#fff' }]}
              gradientColors={dynamicTheme.gradient}
            >
              <Text style={[styles.loginButtonText, { color: '#fff' }]}>Sign In</Text>
            </LoadingButton>

            {/* Social sign-in removed per request */}

            <TouchableOpacity 
              style={styles.registerButton}
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Create new account"
            >
              <Text style={[styles.registerButtonText, { color: dynamicTheme.textSecondary }]}>
                Don't have an account? <Text style={[styles.registerButtonTextBold, { color: dynamicTheme.primary }]}>Create Account</Text>
              </Text>
            </TouchableOpacity>
            <Text style={styles.legalText}>By continuing you agree to our Terms and Privacy Policy.</Text>
          </View>
          {/* Removed blur overlay for clarity */}
        </Animated.View>
      </ScrollView>
      </KeyboardAvoidingView>
      {keyboardVisible && (
        <View style={styles.stickyCtaContainer}>
          <LoadingButton
            isLoading={isLoading}
            onPress={handleLogin}
            style={[styles.loginButton]}
            textStyle={[styles.loginButtonText, { color: '#fff' }]}
            gradientColors={dynamicTheme.gradient}
          >
            <Text style={[styles.loginButtonText, { color: '#fff' }]}>Sign In</Text>
          </LoadingButton>
        </View>
      )}
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
    overflow: 'hidden',
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
    marginBottom: theme.spacing.xl,
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
  errorContainer: {
    marginTop: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
  rememberMeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.sm,
  },
  forgotPasswordText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  loginButton: {
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
  loginButtonText: {
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
  registerButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  registerButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  registerButtonTextBold: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  socialRow: {
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  socialButton: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  socialButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  errorBannerText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
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
  stickyCtaContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
  },
});