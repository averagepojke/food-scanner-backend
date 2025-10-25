// Reusable contact button component with error handling
import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Linking } from 'react-native';
import { privacyTheme } from '../privacyTheme';

const ContactButton = ({ url, children, style, textStyle }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    setIsLoading(true);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(
          'Unable to Open',
          `Cannot open ${url}. Please check if you have the appropriate app installed.`
        );
      }
    } catch (error) {
      console.warn('Error opening URL:', error);
      Alert.alert(
        'Error',
        'Unable to open link. Please try again or contact support directly.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.button, style]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${children}`}
      accessibilityHint="Opens in external app"
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={privacyTheme.colors.primary} />
      ) : (
        <Text style={[styles.buttonText, textStyle]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: privacyTheme.colors.borderLight,
    padding: privacyTheme.spacing.md,
    borderRadius: privacyTheme.borderRadius.sm,
    marginTop: privacyTheme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Accessibility: minimum touch target
  },
  buttonText: {
    fontSize: privacyTheme.fontSize.md,
    color: privacyTheme.colors.primary,
    fontWeight: '600',
  },
});

export default ContactButton;
