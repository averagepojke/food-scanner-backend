import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export default function FAQScreen() {
  const [expanded, setExpanded] = useState({});
  const navigation = useNavigation();

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const QA = ({ q, children, id }) => (
    <View style={styles.item}>
      <TouchableOpacity onPress={() => toggle(id)} style={styles.itemHeader}>
        <Text style={styles.question}>{q}</Text>
        <Text style={styles.expand}>{expanded[id] ? '−' : '+'}</Text>
      </TouchableOpacity>
      {expanded[id] && <View style={styles.answer}>{children}</View>}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Help & FAQ</Text>
        <Text style={styles.subtitle}>Quick answers to common questions</Text>

        <QA id="scan" q="How do I scan items?">
          <Text style={styles.text}>
            Tap the scanner icon from the main app or use the menu option "Scanner". Align the barcode within the frame and wait for it to detect. If scanning fails, try better lighting or manual entry.
          </Text>
        </QA>

        <QA id="manual" q="Can I add items manually?">
          <Text style={styles.text}>
            Yes. Go to your inventory and use the "+" button to add a new item with name, quantity, category, price, and optional expiry date.
          </Text>
        </QA>

        <QA id="shopping" q="How do I manage my shopping list?">
          <Text style={styles.text}>
            From the Shopping List screen, add items you need and check them off while shopping. Items can be moved to inventory after purchase.
          </Text>
        </QA>

        <QA id="budget" q="How do budgets and spending work?">
          <Text style={styles.text}>
            Set a monthly budget in Finance. Each purchase you add contributes to your spending history so you can track totals and trends.
          </Text>
        </QA>

        <QA id="reminders" q="How do I enable reminders and notifications?">
          <Text style={styles.text}>
            Open Profile -> Reminders to configure notifications for expiring items and shopping reminders. Make sure app notifications are enabled in your device settings.
          </Text>
        </QA>

        <QA id="subscription" q="What features require a subscription?">
          <Text style={styles.text}>
            Advanced features like statistics, chat support, and premium automation may require an active subscription. You can manage your plan from the paywall prompts or Profile.
          </Text>
        </QA>

        <QA id="sync" q="Is my data synced across devices?">
          <Text style={styles.text}>
            When signed in, your data is stored per user and persists across sessions. If you use multiple devices, ensure you are logged in with the same account.
          </Text>
        </QA>

        <QA id="privacy" q="Where can I read the Privacy Policy and Terms?">
          <Text style={styles.text}>
            You can find both in Profile -> About section. Tap Privacy Policy or Terms of Service to read the full documents.
          </Text>
        </QA>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.supportBtn} onPress={() => navigation.navigate('SupportChat')}>
            <Text style={styles.supportBtnText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 16 },
  item: { backgroundColor: '#fff', borderRadius: 8, marginBottom: 12, overflow: 'hidden', elevation: 1 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fafafa', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  question: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1, paddingRight: 10 },
  expand: { fontSize: 20, color: '#2563eb', fontWeight: 'bold', width: 24, textAlign: 'center' },
  answer: { padding: 16 },
  text: { fontSize: 15, lineHeight: 22, color: '#374151' },
  footer: { marginTop: 8, alignItems: 'center' },
  supportBtn: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10 },
  supportBtnText: { color: '#fff', fontWeight: '600' },
});