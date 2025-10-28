import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from './food-scanner-app/AuthContext';
import { getUserData, setUserData } from './utils';
import { getTheme } from './theme';
import { useNavigation } from '@react-navigation/native';

const DEFAULTS = {
  expiryLeadDays: 3,
  perCategory: {
    dairy: true,
    vegetables: true,
    fruits: true,
    meat: true,
    fish: true,
    bread: true,
    canned: true,
    frozen: true,
    snacks: true,
    other: true,
  },
  weeklyReminderEnabled: false,
  weeklyDay: 1, // Monday
  weeklyTime: '18:00',
  shoppingNudgeEnabled: true,
};

export default function ReminderSettings() {
  const { userId } = useAuth();
  const navigation = useNavigation();
  const theme = getTheme('default', false);
  const [settings, setSettings] = useState(DEFAULTS);
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getUserData(userId, 'reminderSettings', DEFAULTS);
        setSettings({ ...DEFAULTS, ...s, perCategory: { ...DEFAULTS.perCategory, ...(s?.perCategory||{}) } });
      } catch {}
    })();
  }, [userId]);

  // Request permissions on open
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      }).catch(() => {});
    }
  }, []);

  const save = async (next) => {
    setSettings(next);
    try { await setUserData(userId, 'reminderSettings', next); } catch {}
  };

  const scheduleWeekly = async () => {
    if (!settings.weeklyReminderEnabled) return;
    const [h, m] = settings.weeklyTime.split(':').map(Number);
    const weekday = settings.weeklyDay; // 0-6, Monday=1 chosen by us
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Meal plan reminder', body: 'Plan your meals for the week' },
      trigger: { weekday: (weekday % 7) + 1, hour: h, minute: m, repeats: true },
    });
    Alert.alert('Scheduled', 'Weekly reminder scheduled.');
  };

  const onPickTime = (e, date) => {
    setTimePickerVisible(false);
    if (date) {
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      save({ ...settings, weeklyTime: `${h}:${m}` });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#0F172A' }]}> 
      <View style={[styles.header]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{'< Back'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Expiry reminders</Text>
          <View style={styles.row}> 
            <Text style={styles.label}>Lead time (days)</Text>
            <View style={styles.choicesRow}>
              {[1,3,5].map(d => (
                <TouchableOpacity key={d} style={[styles.choice, settings.expiryLeadDays===d && styles.choiceActive]} onPress={() => save({ ...settings, expiryLeadDays: d })}>
                  <Text style={[styles.choiceText, settings.expiryLeadDays===d && styles.choiceTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={[styles.label, { marginTop: 10 }]}>Categories</Text>
          <View style={{ gap: 8 }}>
            {Object.keys(settings.perCategory).map(k => (
              <View key={k} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>{k}</Text>
                <Switch value={!!settings.perCategory[k]} onValueChange={(v)=>save({ ...settings, perCategory: { ...settings.perCategory, [k]: v } })} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly meal plan</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable</Text>
            <Switch value={settings.weeklyReminderEnabled} onValueChange={(v)=>save({ ...settings, weeklyReminderEnabled: v })} />
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Day</Text>
            <View style={styles.choicesRow}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=> (
                <TouchableOpacity key={d} style={[styles.choice, settings.weeklyDay===i && styles.choiceActive]} onPress={()=>save({ ...settings, weeklyDay: i })}>
                  <Text style={[styles.choiceText, settings.weeklyDay===i && styles.choiceTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Time</Text>
            <TouchableOpacity style={[styles.choice, styles.timeBtn]} onPress={()=>setTimePickerVisible(true)}>
              <Text style={styles.choiceText}>{settings.weeklyTime}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.scheduleBtn} onPress={scheduleWeekly}>
            <Text style={styles.scheduleText}>Schedule</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <Text style={styles.cardTitle}>Shopping list nudge</Text>
            <Switch value={settings.shoppingNudgeEnabled} onValueChange={(v)=>save({ ...settings, shoppingNudgeEnabled: v })} />
          </View>
          <Text style={styles.hint}>Get nudges when items are expiring soon and missing from your shopping list.</Text>
        </View>
      </ScrollView>
      {timePickerVisible && (
        <DateTimePicker mode="time" value={new Date()} onChange={onPickTime} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#1E293B' },
  backBtn: { padding: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 16 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  label: { color: '#CBD5E1', fontSize: 14 },
  choicesRow: { flexDirection: 'row', gap: 8 },
  choice: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  choiceActive: { backgroundColor: '#334155' },
  choiceText: { color: '#CBD5E1' },
  choiceTextActive: { color: '#fff', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  toggleLabel: { color: '#E2E8F0', fontSize: 14 },
  timeBtn: { alignSelf: 'flex-end' },
  scheduleBtn: { marginTop: 8, alignSelf: 'flex-end', backgroundColor: '#6366F1', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  scheduleText: { color: '#fff', fontWeight: '700' },
  hint: { color: '#94A3B8', marginTop: 8 },
});
