// Reusable component for privacy policy sections
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { privacyTheme } from '../privacyTheme';

const PrivacySection = ({ title, children, style }) => {
  const renderChildren = (child) => {
    if (typeof child === 'string') {
      return <Text key={child} style={styles.sectionText}>{child}</Text>;
    }
    return child;
  };

  return (
    <View
      style={[styles.section, style]}
      accessibilityRole="summary"
      accessibilityLabel={title}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {React.Children.map(children, renderChildren)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    backgroundColor: privacyTheme.colors.surface,
    borderRadius: privacyTheme.borderRadius.md,
    padding: privacyTheme.spacing.lg,
    marginBottom: privacyTheme.spacing.md,
    borderWidth: 1,
    borderColor: privacyTheme.colors.border,
    ...privacyTheme.shadows.light,
  },
  sectionTitle: {
    fontSize: privacyTheme.fontSize.xl,
    fontWeight: 'bold',
    marginBottom: privacyTheme.spacing.sm,
    color: privacyTheme.colors.text,
  },
  sectionContent: {
    flex: 1,
  },
  sectionText: {
    fontSize: privacyTheme.fontSize.md,
    lineHeight: privacyTheme.lineHeight.md,
    color: privacyTheme.colors.textSecondary,
    marginBottom: privacyTheme.spacing.md,
  },
});

export default PrivacySection;
