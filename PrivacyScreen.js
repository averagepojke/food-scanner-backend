import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { PixelRatio } from 'react-native';
import PrivacySection from './food-scanner-app/components/PrivacySection';
import ContactButton from './food-scanner-app/components/ContactButton';
import { privacyTheme } from './food-scanner-app/privacyTheme';
import {
  PRIVACY_POLICY_VERSION,
  PRIVACY_POLICY_LAST_UPDATED,
  CONTACT_INFO,
  PRIVACY_SECTIONS,
  PRIVACY_INTRODUCTION,
  PRIVACY_FOOTER,
} from './food-scanner-app/privacyConstants';

// Responsive font scaling
const scaleFont = (size) => {
  const scale = PixelRatio.getFontScale();
  return size * scale;
};

export default function PrivacyScreen({ navigation }) {
  const handleBackPress = () => {
    if (navigation?.goBack) {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to previous screen"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        accessibilityRole="scrollView"
        accessibilityLabel="Privacy policy content"
      >
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.lastUpdated}>
          Effective date: {PRIVACY_POLICY_LAST_UPDATED} (v{PRIVACY_POLICY_VERSION})
        </Text>

        <Text style={styles.introduction}>
          {PRIVACY_INTRODUCTION}
        </Text>

        {PRIVACY_SECTIONS.map((section) => (
          <PrivacySection key={section.id} title={section.title}>
            {section.content}
          </PrivacySection>
        ))}

        {/* Contact section with improved buttons */}
        <PrivacySection title="10. Contact Us">
          {PRIVACY_SECTIONS.find(s => s.id === 'contact-us').content}
          <View style={styles.contactButtonsContainer}>
            <ContactButton
              url={`mailto:${CONTACT_INFO.email}`}
              style={styles.contactButton}
            >
              Email: {CONTACT_INFO.email}
            </ContactButton>
            <ContactButton
              url={CONTACT_INFO.website}
              style={styles.contactButton}
            >
              Website: {CONTACT_INFO.website}
            </ContactButton>
          </View>
        </PrivacySection>

        <View style={styles.footerBox}>
          <Text style={styles.footer}>
            {PRIVACY_FOOTER}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: privacyTheme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: privacyTheme.spacing.lg,
    paddingVertical: privacyTheme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: privacyTheme.colors.border,
    backgroundColor: privacyTheme.colors.surface,
  },
  backButton: {
    padding: privacyTheme.spacing.sm,
    minWidth: 60,
  },
  backButtonText: {
    fontSize: scaleFont(privacyTheme.fontSize.md),
    color: privacyTheme.colors.primary,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: scaleFont(privacyTheme.fontSize.lg),
    fontWeight: 'bold',
    color: privacyTheme.colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    minWidth: 60,
  },
  content: {
    padding: privacyTheme.spacing.xl,
    paddingBottom: privacyTheme.spacing.xxxl
  },
  title: {
    fontSize: scaleFont(privacyTheme.fontSize.xxxl),
    fontWeight: 'bold',
    marginBottom: privacyTheme.spacing.sm,
    color: privacyTheme.colors.text,
    textAlign: 'center'
  },
  lastUpdated: {
    fontSize: scaleFont(privacyTheme.fontSize.sm),
    color: privacyTheme.colors.textMuted,
    marginBottom: privacyTheme.spacing.lg,
    textAlign: 'center'
  },
  introduction: {
    fontSize: scaleFont(privacyTheme.fontSize.md),
    lineHeight: privacyTheme.lineHeight.md,
    marginBottom: privacyTheme.spacing.lg,
    color: privacyTheme.colors.textSecondary,
    backgroundColor: privacyTheme.colors.surface,
    padding: privacyTheme.spacing.lg,
    borderRadius: privacyTheme.borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: privacyTheme.colors.accent,
    ...privacyTheme.shadows.light,
  },
  footerBox: {
    backgroundColor: privacyTheme.colors.borderLight,
    borderRadius: privacyTheme.borderRadius.md,
    padding: privacyTheme.spacing.lg,
    marginTop: privacyTheme.spacing.md,
    ...privacyTheme.shadows.light,
  },
  contactButtonsContainer: {
    marginTop: privacyTheme.spacing.md,
    gap: privacyTheme.spacing.sm,
  },
  contactButton: {
    marginTop: 0, // Override default margin from ContactButton
  },
  footer: {
    fontSize: scaleFont(privacyTheme.fontSize.sm),
    lineHeight: privacyTheme.lineHeight.sm,
    color: privacyTheme.colors.text,
    textAlign: 'center'
  }
});
