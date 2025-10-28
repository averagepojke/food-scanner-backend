import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from './config';
import { ShoppingListContext } from './App';
import { getTheme } from './theme';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView} from 'react-native-safe-area-context';
function createInitialBotMessage() {
  return {
    id: 'm-hello',
    role: 'bot',
    text: "Hi! I'm here to help with Food Scanner. Ask me about scanning receipts, your inventory, shopping list, or settings.",
    timestamp: Date.now(),
  };
}

function getQuickAnswer(userText) {
  const text = userText.toLowerCase();
  const matchers = [
    {
      keywords: ['scan', 'receipt', 'ocr', 'camera'],
      answer:
        'If scanning fails, try these: (1) Move to better lighting, (2) Place the receipt flat and avoid glare, (3) Try Upload Image from your gallery, (4) Hold steady for a second. If it keeps failing, please send us a photo via this chat.',
    },
    {
      keywords: ['default', 'theme', 'color', 'accent'],
      answer:
        'You can change the app’s color in Profile > Preferences > Theme Color. Choosing Default resets to the original app color.',
    },
    {
      keywords: ['export', 'csv', 'data'],
      answer:
        'To export your data, go to Profile > Data Management > Export Data and choose Spending or Inventory (CSV).',
    },
    {
      keywords: ['login', 'auth', 'sign', 'register', 'password'],
      answer:
        'If you can’t sign in, please check your internet connection and try closing and reopening the app. If you forgot your password, use the reset option if available.',
    },
  ];
  for (const m of matchers) {
    if (m.keywords.some((k) => text.includes(k))) return { ok: true, text: m.answer };
  }
  return { ok: false };
}

export default function SupportChatScreen() {
  const navigation = useNavigation();
  const { darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const [messages, setMessages] = useState([createInitialBotMessage()]);
  const [input, setInput] = useState('');
  const [awaitingContact, setAwaitingContact] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [typingStep, setTypingStep] = useState(0);
  const listRef = useRef(null);

  useEffect(() => {
    // Auto scroll to bottom on new message
    listRef.current?.scrollToEnd?.({ animated: true });
  }, [messages]);

  function append(role, text, extra = {}) {
    setMessages((prev) => [
      ...prev,
      { id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role, text, timestamp: Date.now(), ...extra },
    ]);
  }

  // Compute a more natural typing delay based on message length
  function getTypingDelay(text) {
    const baseMs = 900; // base pause
    const perCharMs = 20; // additional per character
    const minMs = 900;
    const maxMs = 2400;
    const len = typeof text === 'string' ? text.length : 0;
    const jitter = Math.floor(Math.random() * 350); // 0-349ms
    const computed = baseMs + len * perCharMs + jitter;
    return Math.min(maxMs, Math.max(minMs, computed));
  }

  function processMessage(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    append('user', trimmed);
    setIsBotTyping(true);
    const delay = getTypingDelay(trimmed);
    setTimeout(() => {
      const quick = getQuickAnswer(trimmed);
      if (quick.ok) {
        append('bot', quick.text);
      } else {
        append(
          'bot',
          "I might not have the answer right now. Please share your name and email and I'll pass this to our support team."
        );
        setAwaitingContact(true);
      }
      setIsBotTyping(false);
    }, delay);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    processMessage(trimmed);
  }

  function isValidEmail(value) {
    return /.+@.+\..+/.test(value);
  }

  async function submitSupportRequest() {
    if (!name.trim() || !isValidEmail(email.trim())) {
      Alert.alert('Missing info', 'Please enter a valid name and email.');
      return;
    }
    setSending(true);
    try {
      const history = messages.map(({ role, text, timestamp, imageBase64, mimeType }) => ({ role, text, timestamp, imageBase64, mimeType }));
      const res = await fetch(`${API_BASE_URL}/api/support-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), history }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Support request failed (${res.status}): ${t}`);
      }
      append('bot', 'Thanks! Your message has been sent. We\'ll get back to you via email.');
      setAwaitingContact(false);
      setName('');
      setEmail('');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to send request.');
    } finally {
      setSending(false);
    }
  }

  // Typing dots animation
  useEffect(() => {
    if (!isBotTyping) return;
    const id = setInterval(() => setTypingStep((s) => (s + 1) % 3), 300);
    return () => clearInterval(id);
  }, [isBotTyping]);

  async function handleAttachImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const isPng = (asset.uri || '').toLowerCase().endsWith('.png');
        const mimeType = isPng ? 'image/png' : 'image/jpeg';
        append('user', '', { imageUri: asset.uri, imageBase64: asset.base64, mimeType });
        setIsBotTyping(true);
        const delay = 1200 + Math.floor(Math.random() * 500); // 1200-1700ms
        setTimeout(() => {
          append('bot', 'Thanks! I\'ve received your image. If you can, please describe the issue briefly.');
          setIsBotTyping(false);
        }, delay);
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Could not pick an image');
    }
  }

  const renderItem = ({ item }) => (
    <View style={[styles.messageRow, item.role === 'user' ? styles.messageRowRight : styles.messageRowLeft]}>
      {item.role === 'bot' && (
        <View style={[styles.avatar, { backgroundColor: theme.primary + '22' }]}>
          <MaterialCommunityIcons name="lifebuoy" size={16} color={theme.primary} />
        </View>
      )}
      <View style={[
        styles.bubble,
        item.role === 'user'
          ? { backgroundColor: theme.primary }
          : { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }
      ]}>
        {item.imageUri ? (
          <Image source={{ uri: item.imageUri }} style={{ width: 200, height: 200, borderRadius: 10, marginBottom: item.text ? 8 : 0 }} resizeMode="cover" />
        ) : null}
        {item.text ? (
          <Text style={[styles.bubbleText, item.role === 'user' ? { color: '#FFFFFF' } : { color: theme.text }]}>{item.text}</Text>
        ) : null}
        <Text style={[styles.timestamp, { color: theme.textSecondary }]}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      {item.role === 'user' && (
        <View style={[styles.avatar, { backgroundColor: theme.primary + '22' }]}>
          <MaterialCommunityIcons name="account" size={16} color={theme.primary} />
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <TouchableOpacity style={styles.headerBack} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Support Chat</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 6 }} />
            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Online</Text>
          </View>
        </View>

        {/* Quick suggestions */}
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {[
              "My receipt won't scan",
              'How do I export data?',
              'Change theme color',
              "I can't sign in",
            ].map((q) => (
              <TouchableOpacity
                key={q}
                onPress={() => processMessage(q)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 14,
                  marginRight: 8,
                  marginBottom: 8,
                  backgroundColor: theme.primary + '22',
                }}
              >
                <Text style={{ color: theme.text }}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(m) => m.id}
          style={[styles.list]}
          contentContainerStyle={{ padding: 16 }}
        />

        {/* Typing indicator */}
        {isBotTyping && (
          <View style={[styles.messageRow, styles.messageRowLeft, { paddingHorizontal: 16, marginTop: -8 }] }>
            <View style={[styles.avatar, { backgroundColor: theme.primary + '22' }]}>
              <MaterialCommunityIcons name="lifebuoy" size={16} color={theme.primary} />
            </View>
            <View style={[styles.bubble, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary }}>
                Typing{'.'.repeat(typingStep + 1)}
              </Text>
            </View>
          </View>
        )}

        {awaitingContact ? (
          <View style={[styles.contactBox, { backgroundColor: theme.surface, borderTopColor: theme.border }] }>
            <Text style={[styles.contactTitle, { color: theme.text }]}>Share your details</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Your name"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Your email"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.primary }]} onPress={submitSupportRequest} disabled={sending}>
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="#fff" />
                  <Text style={styles.submitText}>Send to Support</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.composer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <TouchableOpacity onPress={handleAttachImage} style={[styles.attachButton, { borderColor: theme.border }]}>
              <MaterialCommunityIcons name="image-outline" size={22} color={theme.primary} />
            </TouchableOpacity>
            <TextInput
              style={[styles.composerInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
              placeholder="Type your message..."
              placeholderTextColor={theme.textSecondary}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: theme.primary }]} onPress={handleSend}>
              <MaterialCommunityIcons name="send" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  headerBack: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  messageRow: { marginVertical: 6, flexDirection: 'row', paddingHorizontal: 6 },
  messageRowLeft: { justifyContent: 'flex-start' },
  messageRowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  timestamp: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  composerInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  contactBox: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  contactTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  submitButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitText: { color: '#FFFFFF', fontWeight: '700', marginLeft: 6 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
});
