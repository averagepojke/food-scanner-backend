import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView} from 'react-native-safe-area-context';
export default function TermsScreen() {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const Section = ({ title, children, id }) => (
    <View style={styles.section}>
      <TouchableOpacity onPress={() => toggleSection(id)} style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.expandIcon}>
          {expandedSections[id] ? '−' : '+'}
        </Text>
      </TouchableOpacity>
      {expandedSections[id] && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Terms of Service</Text>
        
        <View style={styles.badgeRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>Plain Language</Text></View>
          <View style={[styles.badge, styles.badgeInfo]}><Text style={styles.badgeText}>Effective date: January 2025</Text></View>
        </View>

        <Text style={styles.introduction}>
          Welcome to Pantrify! These Terms of Service ("Terms") govern your use of our mobile application and services. Please read them carefully before using our app.
        </Text>

        <Section title="1. Acceptance of Terms" id="acceptance">
          <Text style={styles.text}>
            By downloading, installing, or using Pantrify, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use our service.
          </Text>
        </Section>

        <Section title="2. Description of Service" id="service">
          <Text style={styles.text}>
            Pantrify is a mobile application that helps users scan food products, track nutritional information, and manage dietary preferences. The app may include features such as barcode scanning, nutritional analysis, and personal tracking.
          </Text>
        </Section>

        <Section title="3. User Account and Registration" id="account">
          <Text style={styles.text}>
            • You are responsible for maintaining the confidentiality of your account information{'\n'}
            • You must provide accurate and complete information during registration{'\n'}
            • You are responsible for all activities under your account{'\n'}
            • You must notify us immediately of any unauthorised use
          </Text>
        </Section>

        <Section title="4. Acceptable Use" id="use">
          <Text style={styles.text}>
            You agree to use Pantrify only for lawful purposes and in accordance with these Terms. You may not:{'\n\n'}
            • Use the service for commercial purposes without authorization{'\n'}
            • Attempt to reverse engineer or hack the application{'\n'}
            • Upload malicious content or spam{'\n'}
            • Violate any applicable laws or regulations{'\n'}
            • Interfere with the service's functionality
          </Text>
        </Section>

        <Section title="5. Privacy and Data" id="privacy">
          <Text style={styles.text}>
            Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using our service, you consent to our data practices as described in the Privacy Policy.
          </Text>
        </Section>

        <Section title="6. User-Generated Content" id="content">
          <Text style={styles.text}>
            You retain ownership of content you submit to Pantrify, but grant us a license to use, modify, and distribute such content as necessary to provide our services. You are responsible for ensuring your content does not violate any third-party rights.
          </Text>
        </Section>

        <Section title="7. Disclaimers and Limitations" id="disclaimers">
          <Text style={styles.text}>
            • Pantrify is provided "as-is" without warranties of any kind{'\n'}
            • Nutritional information may not be 100% accurate - consult healthcare providers for medical advice{'\n'}
            • We do not guarantee uninterrupted or error-free service{'\n'}
            • Our liability is limited to the maximum extent permitted by law
          </Text>
        </Section>

        <Section title="8. Intellectual Property" id="ip">
          <Text style={styles.text}>
            Pantrify and its content are protected by copyright, trademark, and other intellectual property laws. You may not use our intellectual property without express written permission.
          </Text>
        </Section>

        <Section title="9. Termination" id="termination">
          <Text style={styles.text}>
            We reserve the right to suspend or terminate your access to  Pantrify at any time, with or without cause. You may also terminate your account at any time through the app settings.
          </Text>
        </Section>

        <Section title="10. Changes to Terms" id="changes">
          <Text style={styles.text}>
            We may modify these Terms at any time. We will notify users of material changes through the app or email. Continued use after changes constitutes acceptance of the new Terms.
          </Text>
        </Section>

        <Section title="11. Governing Law and Disputes" id="law">
          <Text style={styles.text}>
            These Terms are governed by [YOUR JURISDICTION] law. Any disputes will be resolved through binding arbitration in [YOUR LOCATION], except where prohibited by law.
          </Text>
        </Section>

        <Section title="12. Contact Information" id="contact">
          <Text style={styles.text}>
            For questions about these Terms, please contact us at:{'\n\n'}
            Email: legal@Pantrify.com{'\n'}
            
          </Text>
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using Pantrify, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa' 
  },
  content: { padding: 20, paddingBottom: 40 },
  title: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 8,
    color: '#1a1a1a',
    textAlign: 'center'
  },
  badgeRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  badge: { backgroundColor: '#E5F6F0', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  badgeInfo: { backgroundColor: '#EEF2FF' },
  badgeText: { color: '#0F766E', fontWeight: '600', fontSize: 12 },
  introduction: {
    fontSize: 16,
    lineHeight: 24,
    color: '#424242',
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10B981'
  },
  section: {
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0'
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1
  },
  expandIcon: {
    fontSize: 20,
    color: '#2196f3',
    fontWeight: 'bold',
    width: 24,
    textAlign: 'center'
  },
  sectionContent: {
    padding: 16
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: '#424242'
  },
  footer: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 8
  },
  footerText: {
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500'
  }
});