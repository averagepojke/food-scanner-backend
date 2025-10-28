import React, { useState, useCallback, useMemo, useRef, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Keyboard,
  RefreshControl,
  StatusBar,
  Dimensions,
  Animated,
  PanGestureHandler,
  State,
  Switch,
  Platform,
  Pressable,
  ScrollView
} from 'react-native';
import { SafeAreaView} from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { ShoppingListContext } from './App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SwipeListView } from 'react-native-swipe-list-view';
import { getTheme } from './theme';
import { useGamification } from './Gamification';
import BarcodeScannerModal from './BarcodeScannerModal';
import ReceiptScannerModal from './ReceiptScannerModal';

const { width, height } = Dimensions.get('window');

// Constants
const DAYS_UNTIL_EXPIRY_WARNING = 3;
const DEFAULT_EXPIRY_DAYS = 7;
const MAX_BARCODE_LENGTH = 18;
const MIN_BARCODE_LENGTH = 8;

// Categories with smart expiry prediction
const CATEGORY_EXPIRY_DAYS = {
  dairy: 7,
  meat: 3,
  fish: 2,
  vegetables: 5,
  fruits: 4,
  bread: 3,
  'canned-goods': 365,
  'dry-goods': 180,
  beverages: 30,
  frozen: 90,
  default: 7
};

// Helper functions
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

const getDaysUntilExpiry = (expiryDate) => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

  const getExpiryStatus = (expiryDate, theme) => {
    const daysLeft = getDaysUntilExpiry(expiryDate);
    if (daysLeft < 0) return { status: 'expired', color: theme.error || '#EF4444', text: 'Expired' };
    if (daysLeft <= DAYS_UNTIL_EXPIRY_WARNING) return { status: 'warning', color: theme.warning || '#F59E0B', text: `${daysLeft} days left` };
    return { status: 'good', color: theme.success || '#10B981', text: `${daysLeft} days left` };
  };

const validateBarcode = (barcode) => {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) return { isValid: false, error: 'Please enter a barcode' };
  if (!/^\d+$/.test(cleanBarcode)) return { isValid: false, error: 'Barcode must contain only numbers' };
  if (cleanBarcode.length < MIN_BARCODE_LENGTH || cleanBarcode.length > MAX_BARCODE_LENGTH) {
    return { isValid: false, error: `Barcode must be ${MIN_BARCODE_LENGTH}-${MAX_BARCODE_LENGTH} digits` };
  }
  return { isValid: true };
};

const predictExpiryDate = (category, customDays = null) => {
  const days = customDays || CATEGORY_EXPIRY_DAYS[category] || CATEGORY_EXPIRY_DAYS.default;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate.toISOString().split('T')[0];
};

const parseExpiryInput = (input) => {
  if (!input || !input.trim()) return predictExpiryDate('default');
  const parts = input.trim().split('/');
  const currentYear = new Date().getFullYear();
  if (parts.length === 3) {
    let [dd, mm, yyyy] = parts.map(p => p.trim());
    if (yyyy.length === 2) yyyy = '20' + yyyy;
    const dateStr = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    // Basic validation
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return dateStr;
  } else if (parts.length === 2) {
    let [dd, mm] = parts.map(p => p.trim());
    const dateStr = `${currentYear}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return dateStr;
  } else if (parts.length === 1) {
    let yyyy = parts[0].trim();
    if (yyyy.length === 2) yyyy = '20' + yyyy;
    const dateStr = `${yyyy}-12-31`;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return dateStr;
  }
  return predictExpiryDate('default');
};

// Shelf-life hint extraction from Open Food Facts product
const parseShelfLifeDaysFromOFF = (product) => {
  try {
    const textFields = [
      product.conservation_conditions,
      product.labels,
      product.ingredients_text,
      product.generic_name,
      product.packaging_text,
      product.packaging
    ]
      .filter(Boolean)
      .map(String)
      .join(' \n ')
      .toLowerCase();

    // Look for patterns like: 3 days, 1 week, 2 weeks, 1 month, 2 months
    const dayMatch = textFields.match(/(\d{1,2})\s*(day|days|d)\b/);
    if (dayMatch) return Math.min(60, parseInt(dayMatch[1], 10));

    const weekMatch = textFields.match(/(\d{1,2})\s*(week|weeks|wk|w)\b/);
    if (weekMatch) return Math.min(180, parseInt(weekMatch[1], 10) * 7);

    const monthMatch = textFields.match(/(\d{1,2})\s*(month|months|mo|m)\b/);
    if (monthMatch) return Math.min(365, parseInt(monthMatch[1], 10) * 30);
  } catch {}
  return null;
};

// Expiry adjustment persistence (learning offsets)
const EXPIRY_OFFSET_KEY = 'expiry_offsets_v1';
const normalizeKey = (s) => String(s || '').trim().toLowerCase();
const todayYmd = () => new Date().toISOString().split('T')[0];
const daysBetween = (fromYmd, toYmd = todayYmd()) => {
  try {
    const a = new Date(fromYmd);
    const b = new Date(toYmd);
    return Math.round((a - b) / (1000 * 60 * 60 * 24));
  } catch { return 0; }
};

const loadExpiryOffsets = async () => {
  try {
    const raw = await AsyncStorage.getItem(EXPIRY_OFFSET_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveExpiryOffsets = async (map) => {
  try {
    await AsyncStorage.setItem(EXPIRY_OFFSET_KEY, JSON.stringify(map));
  } catch {}
};

const getExpiryOffsetForKey = async (key) => {
  const map = await loadExpiryOffsets();
  return Number.isFinite(map[key]) ? map[key] : 0;
};

const setExpiryOffsetForKey = async (key, offsetDays) => {
  const map = await loadExpiryOffsets();
  map[key] = offsetDays;
  await saveExpiryOffsets(map);
};

// Custom hook for animations
const useAnimatedValue = (initialValue = 0) => {
  const animatedValue = useRef(new Animated.Value(initialValue)).current;
  return animatedValue;
};

// Item Detail Modal Component
const ItemDetailModal = ({ visible, item, onClose, onEdit, onDelete, onAddToShoppingList, theme }) => {
  const slideAnim = useAnimatedValue(height);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!item) return null;

  const expiryInfo = getExpiryStatus(item.expiry, theme);
  const daysLeft = getDaysUntilExpiry(item.expiry);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View 
          style={[
            styles.detailModal, 
            { 
              backgroundColor: theme.surface,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <View style={styles.modalHandle} />
          {/* Close (cross) button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityLabel="Close"
          >
            <MaterialCommunityIcons name="close" size={28} color={theme.textSecondary} />
          </TouchableOpacity>
          <ScrollView style={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={styles.detailHeader}>
              <Text style={[styles.detailTitle, { color: theme.text }]}>{item.name}</Text>
              {item.brand && <Text style={[styles.detailBrand, { color: theme.textSecondary }]}>{item.brand}</Text>}
            </View>

            <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Expiry Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: expiryInfo.color }]}>
                  <Text style={styles.statusText}>{expiryInfo.text}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Expires On</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{formatDate(item.expiry)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Quantity</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{item.quantity || 1}</Text>
              </View>

              {item.category && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Category</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>{item.category}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Added</Text>
                <Text style={[styles.detailValue, { color: theme.text }]}>{formatDate(item.dateAdded)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Barcode</Text>
                <Text style={[styles.detailValue, { color: theme.text, fontFamily: 'monospace' }]}>
                  {item.barcode}
                </Text>
              </View>
            </View>

            {item.ingredients && (
              <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
                <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Ingredients</Text>
                <Text style={[styles.detailText, { color: theme.textSecondary }]}>{item.ingredients}</Text>
              </View>
            )}

            {item.nutrition && Object.keys(item.nutrition).length > 0 && (
              <View style={[styles.detailCard, { backgroundColor: theme.background }]}>
                <Text style={[styles.detailSectionTitle, { color: theme.text }]}>Nutrition</Text>
                {Object.entries(item.nutrition).slice(0, 5).map(([key, value]) => (
                  <View key={key} style={styles.nutritionRow}>
                    <Text style={[styles.nutritionLabel, { color: theme.textSecondary }]}>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Text>
                    <Text style={[styles.nutritionValue, { color: theme.text }]}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={[styles.detailActions, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                onEdit(item);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.addToListButton, { backgroundColor: theme.success }]}
              onPress={() => {
                onAddToShoppingList(item);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>Add to List</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton, { backgroundColor: theme.error }]}
              onPress={() => {
                onDelete(item.id);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Enhanced Item Component with swipe actions
const InventoryItem = ({ item, onPress, theme, onDelete, onMarkAsUsed, onAddToShoppingList, selectionMode, selectedItems, setSelectedItems, onIncrement, onDecrement }) => {
  const expiryInfo = getExpiryStatus(item.expiry, theme);
  const fadeAnim = useAnimatedValue(1);
  const scaleAnim = useAnimatedValue(1);

  const handlePress = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    onPress(item);
  }, [item, onPress, scaleAnim]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(item.id) }
      ]
    );
  }, [item, onDelete]);

  const handleMarkAsUsed = useCallback(() => {
    Alert.alert(
      'Mark as Used',
      `Mark "${item.name}" as used?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark Used', onPress: () => onMarkAsUsed(item.id) }
      ]
    );
  }, [item, onMarkAsUsed]);

  const handleAddToShoppingList = useCallback(() => {
    onAddToShoppingList(item);
  }, [item, onAddToShoppingList]);

  return (
    <Animated.View 
      style={[
        styles.item, 
        { 
          backgroundColor: theme.surface,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <TouchableOpacity
        style={styles.itemContent}
        onPress={() => {
          if (selectionMode) {
            if (selectedItems.includes(item.id)) {
              setSelectedItems(selectedItems.filter(id => id !== item.id));
            } else {
              setSelectedItems([...selectedItems, item.id]);
            }
          } else {
            handlePress();
          }
        }}
        activeOpacity={0.7}
      >
        {selectionMode && (
          <MaterialCommunityIcons
            name={selectedItems.includes(item.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={24}
            color={selectedItems.includes(item.id) ? theme.success : theme.textSecondary}
            style={{ marginRight: 8 }}
          />
        )}
        {/* Status indicator bar */}
        <View style={[styles.statusBar, { backgroundColor: expiryInfo.color }]} />
        
        {/* Main content */}
        <View style={styles.itemMain}>
          {/* Header with name and status */}
          <View style={styles.itemHeader}>
            <View style={styles.nameContainer}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
                {item.name}
              </Text>
              {item.brand && (
                <Text style={[styles.brand, { color: theme.textSecondary }]}>
                  {item.brand}
                </Text>
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: expiryInfo.color }]}> 
              <Text style={styles.statusText}>{expiryInfo.text}</Text>
            </View>
          </View>

          {/* Details section */}
          <View style={styles.itemDetails}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.textSecondary} />
                <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                  {formatDate(item.expiry)}
                </Text>
              </View>
              
              <View style={[styles.detailItem, { gap: 8 }]}>
                <TouchableOpacity
                  onPress={onDecrement}
                  style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#eee' }}
                >
                  <Text style={{ fontSize: 16, color: '#666' }}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.detailText, { color: theme.text, fontWeight: '700', minWidth: 16, textAlign: 'center' }]}>
                  {item.quantity || 1}
                </Text>
                <TouchableOpacity
                  onPress={onIncrement}
                  style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#eee' }}
                >
                  <Text style={{ fontSize: 16, color: '#666' }}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category and barcode */}
            <View style={styles.metaRow}>
              {item.category && (
                <View style={[styles.categoryChip, { backgroundColor: theme.background }]}>
                  <Text style={[styles.categoryText, { color: theme.textSecondary }]}>
                    {item.category}
                  </Text>
                </View>
              )}
              {item.barcode && (
                <Text style={[styles.barcode, { color: theme.textSecondary }]}>
                  #{item.barcode.slice(-8)}
                </Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Skeleton Loading Components
const SkeletonItem = ({ theme }) => {
  const shimmerAnim = useAnimatedValue(0);
  
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.9],
  });

  // Create a shimmer translateX for sweeping effect
  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 120],
  });

  const Shimmer = ({ style }) => (
    <View style={[{ overflow: 'hidden', backgroundColor: theme.background }, style]}>
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 80,
          transform: [{ translateX }],
          backgroundColor: theme.border,
          opacity,
        }}
      />
    </View>
  );

  return (
    <Animated.View 
      style={[
        styles.item, 
        { 
          backgroundColor: theme.surface,
        }
      ]}
    >
      <View style={styles.itemContent}>
        {/* Skeleton status bar */}
        <Shimmer style={[styles.skeletonStatusBar, { backgroundColor: theme.border }]} />
        
        <View style={styles.itemMain}>
          {/* Skeleton header */}
          <View style={styles.itemHeader}>
            <View style={styles.nameContainer}>
              <Shimmer style={[styles.skeletonText, { backgroundColor: theme.border, width: '80%', height: 16 }]} />
              <Shimmer style={[styles.skeletonText, { backgroundColor: theme.border, width: '60%', height: 12, marginTop: 4 }]} />
            </View>
            <Shimmer style={[styles.skeletonBadge, { backgroundColor: theme.border }]} />
          </View>

          {/* Skeleton details with qty controls placeholder */}
          <View style={styles.itemDetails}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Shimmer style={[styles.skeletonIcon, { backgroundColor: theme.border }]} />
                <Shimmer style={[styles.skeletonText, { backgroundColor: theme.border, width: 80, height: 12 }]} />
              </View>
              <View style={[styles.detailItem, { gap: 8 }]}>
                <Shimmer style={{ width: 24, height: 18, borderRadius: 6, backgroundColor: theme.border }} />
                <Shimmer style={{ width: 24, height: 12, borderRadius: 4, backgroundColor: theme.border }} />
                <Shimmer style={{ width: 24, height: 18, borderRadius: 6, backgroundColor: theme.border }} />
              </View>
            </View>

            <View style={styles.metaRow}>
              <Shimmer style={[styles.skeletonChip, { backgroundColor: theme.border }]} />
              <Shimmer style={[styles.skeletonText, { backgroundColor: theme.border, width: 70, height: 10 }]} />
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const SkeletonStats = ({ theme }) => {
  const shimmerAnim = useAnimatedValue(0);
  
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <Animated.View style={[styles.statsContainer, { opacity }]}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.statItem}>
          <View style={[styles.skeletonStatNumber, { backgroundColor: theme.border }]} />
          <View style={[styles.skeletonStatLabel, { backgroundColor: theme.border }]} />
        </View>
      ))}
    </Animated.View>
  );
};

const SkeletonQuickActions = ({ theme }) => {
  const shimmerAnim = useAnimatedValue(0);
  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] });
  const translateX = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 240] });

  const Shimmer = ({ style }) => (
    <View style={[{ overflow: 'hidden', backgroundColor: theme.background }, style]}>
      <Animated.View
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, transform: [{ translateX }], backgroundColor: theme.border, opacity }}
      />
    </View>
  );

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
      <View style={{ flex: 1, marginHorizontal: 4 }}>
        <Shimmer style={{ height: 44, borderRadius: 8, backgroundColor: theme.border }} />
      </View>
      <View style={{ flex: 1, marginHorizontal: 4 }}>
        <Shimmer style={{ height: 44, borderRadius: 8, backgroundColor: theme.border }} />
      </View>
      <View style={{ flex: 1, marginHorizontal: 4 }}>
        <Shimmer style={{ height: 44, borderRadius: 8, backgroundColor: theme.border }} />
      </View>
    </View>
  );
};

// Enhanced Loading Overlay with better animations
const EnhancedLoadingOverlay = ({ visible, theme, message = "Looking up product...", subMessage = "This may take a few seconds" }) => {
  const scaleAnim = useAnimatedValue(0.8);
  const opacityAnim = useAnimatedValue(0);
  const rotationAnim = useAnimatedValue(0);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous rotation for the spinner
      const rotation = Animated.loop(
        Animated.timing(rotationAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      rotation.start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.8,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Animated.View style={[styles.loadingOverlay, { backgroundColor: theme.overlay, opacity: opacityAnim }]}>
      <Animated.View 
        style={[
          styles.loadingCard, 
          { 
            backgroundColor: theme.surface,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <MaterialCommunityIcons name="loading" size={32} color={theme.primary} />
        </Animated.View>
        <Text style={[styles.loadingText, { color: theme.text }]}>
          {message}
        </Text>
        <Text style={[styles.loadingSubtext, { color: theme.textSecondary }]}>
          {subMessage}
        </Text>
        
        {/* Progress dots */}
        <View style={styles.progressDots}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.progressDot,
                { 
                  backgroundColor: theme.primary,
                  transform: [{
                    scale: rotationAnim.interpolate({
                      inputRange: [0, 0.33, 0.66, 1],
                      outputRange: [1, 1.2, 1, 1],
                    })
                  }]
                }
              ]}
            />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const parseReceiptText = (text) => {
  const ignoreKeywords = [
    'TOTAL', 'BALANCE', 'DISCOUNT', 'CARD', 'PAYMENT', 'CHANGE', 'SUBTOTAL', 'VISA', 'MASTERCARD', 'CASH', 'OFFER', 'DUE', 'PAN', 'CONTACTLESS', 'MANAGER', 'SUPERMARKET', 'SINCE', 'PLC', 'WWW', 'DELIVERY', 'TAKEAWAY', 'EGG', 'AMOUNT', 'PRICE', 'DESCRIPTION', 'QTY', 'ITEMS', 'TO', 'ADD', 'AT:', 'CONTACT', 'US', 'AT', 'MANAGER', 'LEE', 'WILD', 'HELPHUB', 'DOORSTEP', 'CAFE', 'ANLABY', 'MORRISONS', 'MORIIEONS', 'SINCE', '1399', 'ABV'
  ];
  const lines = text.split(/\r?\n/);
  const items = [];
  const priceRegex = /[£€]?\s?(\d+\.\d{2})/g;

  lines.forEach((line) => {
    const upper = line.toUpperCase();
    if (ignoreKeywords.some(k => upper.includes(k))) return;

    // Find all prices in the line
    const prices = [];
    let match;
    while ((match = priceRegex.exec(line)) !== null) {
      prices.push({ value: parseFloat(match[1]), index: match.index });
    }
    if (prices.length === 0 || prices.length > 3) return; // skip lines with too many prices

    // Item name is everything before the last price
    const lastPrice = prices[prices.length - 1];
    let name = line.slice(0, lastPrice.index)
      .replace(/[^A-Za-z0-9 \-']/g, ' ') // keep numbers and dashes
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 2) return;

    // Use the last price as the actual price
    const price = lastPrice.value;
    if (!isNaN(price)) {
          items.push({ name, price });
    }
  });

  // Remove duplicates by name+price
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const key = item.name.toLowerCase() + '-' + item.price.toFixed(2);
    if (!seen.has(key)) {
      unique.push(item);
      seen.add(key);
    }
  }
  return unique;
};

// Main Component
export default function HomeScreen(props) {
  const navigation = useNavigation();
  const { shoppingList, addToShoppingList, removeFromShoppingList, darkMode, setDarkMode, foodInventory, setFoodInventory, addSpendingRecord, accentKey } = useContext(ShoppingListContext);
  const { updateStats, checkAchievements, unlockAchievement } = useGamification();
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState('expiry');
  const [manualBarcode, setManualBarcode] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Looking up product...');
  const [loadingSubMessage, setLoadingSubMessage] = useState('This may take a few seconds');
  const [themeResetKey, setThemeResetKey] = useState(0);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', quantity: 1, price: '', weight: '', expiry: '' });
  // Add state for receipt review modal
  const [receiptReviewModalVisible, setReceiptReviewModalVisible] = useState(false);
  const [receiptReviewItems, setReceiptReviewItems] = useState([]);

  // Edit item modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', quantity: 1, expiry: todayYmd(), price: '', category: '' });

  // Quantity adjusters for inventory list
  const incrementItemQuantity = useCallback((itemId) => {
    setFoodInventory(prev => prev.map(it => it.id === itemId ? { ...it, quantity: (it.quantity || 1) + 1 } : it));
  }, [setFoodInventory]);

  const decrementItemQuantity = useCallback((itemId) => {
    setFoodInventory(prev => prev.flatMap(it => {
      if (it.id !== itemId) return it;
      const current = it.quantity || 1;
      if (current > 1) return { ...it, quantity: current - 1 };
      // when reaching 0, remove the item
      return [];
    }));
  }, [setFoodInventory]);

  // Get theme based on accent and dark mode
  const theme = getTheme(accentKey, darkMode);
  const isDefault = !accentKey || accentKey === 'default';

  // Force re-render when accentKey or darkMode changes
  useEffect(() => {
    setThemeResetKey(prev => prev + 1);
  }, [accentKey, darkMode]);

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 2000); // Show skeleton for 2 seconds

    return () => clearTimeout(timer);
  }, []);

  // Enhanced API functions
  const fetchProductData = useCallback(async (barcode) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      setLoading(true);
      setLoadingMessage('Looking up product...');
      setLoadingSubMessage('Searching our database...');
      
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setLoadingMessage('Processing product data...');
      setLoadingSubMessage('Extracting nutrition information...');
      
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        const product = data.product;
        const category = product.categories_tags?.[0]?.replace('en:', '').replace(/-/g, ' ') || '';

        // Try to parse shelf-life hints from OFF text fields
        const shelfLifeDays = parseShelfLifeDaysFromOFF(product);

        // Extract price information
        let price = 0;
        if (product.prices && product.prices.length > 0) {
          // Use the first available price
          price = parseFloat(product.prices[0].price) || 0;
        } else if (product.price && product.price !== '') {
          // Fallback to general price field
          price = parseFloat(product.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
        }
        
        return {
          name: product.product_name || 'Unknown Product',
          brand: product.brands?.split(',')[0]?.trim() || '',
          category: category,
          ingredients: product.ingredients_text || '',
          nutrition: product.nutriments || {},
          imageUrl: product.image_url || null,
          price: price, // Add price to the product data
          predictedExpiry: predictExpiryDate(category, shelfLifeDays || undefined),
          shelfLifeDays
        };
      } else {
        throw new Error('Product not found in database');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your internet connection.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Enhanced duplicate handling
  const handleDuplicateProduct = useCallback((existingItem, barcode, productData) => {
    Alert.alert(
      'Duplicate Product Found',
      `${existingItem.name} is already in your inventory.\n\nCurrent quantity: ${existingItem.quantity || 1}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Increase Quantity', 
          onPress: () => {
            setFoodInventory(prevItems => 
              prevItems.map(item => 
                item.id === existingItem.id 
                  ? { ...item, quantity: (item.quantity || 1) + 1 }
                  : item
              )
            );
            Alert.alert('Success', `Quantity increased to ${(existingItem.quantity || 1) + 1}`);
          }
        },
        { 
          text: 'Add New Entry', 
          onPress: () => addNewItem(barcode, productData || { name: 'Unknown Product' })
        }
      ]
    );
  }, []);

  // Enhanced add product function
  const addProductToInventory = useCallback(async (barcode, productData = null) => {
    const existingItem = foodInventory.find(item => item.barcode === barcode);
    if (existingItem) {
      handleDuplicateProduct(existingItem, barcode, productData);
      return;
    }

    try {
      let finalProductData = productData;
      
      if (!finalProductData) {
        finalProductData = await fetchProductData(barcode);
      }
      
      addNewItem(barcode, finalProductData);
      
    } catch (error) {
      Alert.alert(
        'Product Not Found',
        error.message || 'Could not find product information for this barcode.',
        [
          { text: 'Cancel' },
          { 
            text: 'Add Manually', 
            onPress: () => addNewItem(barcode, { name: 'Unknown Product' })
          }
        ]
      );
    }
  }, [foodInventory, fetchProductData, handleDuplicateProduct]);

  const addNewItem = useCallback(async (barcode, productData) => {
    // Build a learning key from brand + normalized category
    const learnKey = normalizeKey(`${productData.brand || ''}|${productData.category || ''}`);

    // Base predicted expiry from category or shelf-life hint
    let expiryDate = productData.predictedExpiry || predictExpiryDate(productData.category, productData.shelfLifeDays || undefined);

    // Apply learned offset if any
    try {
      const offsetDays = await getExpiryOffsetForKey(learnKey);
      if (offsetDays && Number.isFinite(offsetDays)) {
        const d = new Date(expiryDate);
        d.setDate(d.getDate() + offsetDays);
        expiryDate = d.toISOString().split('T')[0];
      }
    } catch {}
    
    // Set pending product and show price input modal
    setPendingProduct({
      name: productData.name,
      brand: productData.brand || '',
      expiry: expiryDate,
      category: productData.category || '',
      ingredients: productData.ingredients || '',
      nutrition: productData.nutrition || {},
      imageUrl: productData.imageUrl || null,
      dateAdded: new Date().toISOString().split('T')[0],
      _learnKey: learnKey, // carry for later adjustment persistence
      _basePredicted: productData.predictedExpiry || null
    });
    setPendingBarcode(barcode);
    setShowPriceInput(true);
  }, []);

  // Handle price input submission
  const handlePriceSubmit = useCallback(async () => {
    if (!pendingProduct || !manualPrice.trim()) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const price = parseFloat(manualPrice);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Error', 'Please enter a valid price (must be a positive number)');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      ...pendingProduct,
      barcode: pendingBarcode,
      quantity: 1,
      price: price,
    };

    // Learn user-adjusted expiry offset if base prediction exists
    try {
      if (pendingProduct._basePredicted && pendingProduct._learnKey) {
        const predictedDaysFromNow = daysBetween(pendingProduct._basePredicted, pendingProduct.dateAdded);
        const chosenDaysFromNow = daysBetween(newItem.expiry, newItem.dateAdded);
        const offset = chosenDaysFromNow - predictedDaysFromNow;
        if (Number.isFinite(offset) && Math.abs(offset) <= 120) {
          await setExpiryOffsetForKey(pendingProduct._learnKey, offset);
        }
      }
    } catch {}

    setFoodInventory(prevItems => [newItem, ...prevItems]);
    addSpendingRecord(newItem);

    updateStats('itemsAdded');
    updateStats('barcodesScanned');
    if (newItem.category) updateStats('categoryUsed', newItem.category);
    unlockAchievement('FIRST_ITEM');
    unlockAchievement('BARCODE_SCANNER');
    checkAchievements();

    setShowPriceInput(false);
    setPendingProduct(null);
    setPendingBarcode('');
    setManualPrice('');

    Alert.alert(
      'Product Added! 🎉',
      `${pendingProduct.name} has been added to your inventory.\n\nPredicted expiry: ${formatDate(pendingProduct.expiry)}\nPrice: £${price.toFixed(2)}`,
      [{ text: 'Great!' }]
    );
  }, [pendingProduct, pendingBarcode, manualPrice, setFoodInventory]);

  const handlePriceSkip = useCallback(async () => {
    if (!pendingProduct) return;

    const newItem = {
      id: Date.now().toString(),
      ...pendingProduct,
      barcode: pendingBarcode,
      quantity: 1,
      // no price provided
    };

    // Learn user-adjusted expiry offset even if price is skipped
    try {
      if (pendingProduct._basePredicted && pendingProduct._learnKey) {
        const predictedDaysFromNow = daysBetween(pendingProduct._basePredicted, pendingProduct.dateAdded);
        const chosenDaysFromNow = daysBetween(newItem.expiry, newItem.dateAdded);
        const offset = chosenDaysFromNow - predictedDaysFromNow;
        if (Number.isFinite(offset) && Math.abs(offset) <= 120) {
          await setExpiryOffsetForKey(pendingProduct._learnKey, offset);
        }
      }
    } catch {}

    setFoodInventory(prevItems => [newItem, ...prevItems]);

    updateStats('itemsAdded');
    updateStats('barcodesScanned');
    if (newItem.category) updateStats('categoryUsed', newItem.category);
    unlockAchievement('FIRST_ITEM');
    unlockAchievement('BARCODE_SCANNER');
    checkAchievements();

    setShowPriceInput(false);
    setPendingProduct(null);
    setPendingBarcode('');
    setManualPrice('');

    Alert.alert(
      'Product Added',
      `${pendingProduct.name} has been added without a price.`,
      [{ text: 'OK' }]
    );
  }, [pendingProduct, pendingBarcode, setFoodInventory]);

  // Item actions
  const openItemDetail = useCallback((item) => {
    setSelectedItem(item);
    setShowItemDetail(true);
  }, []);

  const editItem = useCallback((item) => {
    setShowItemDetail(false);
    // Open edit modal with current item values
    setEditTarget(item);
    setEditForm({
      name: item.name || '',
      quantity: item.quantity || 1,
      expiry: item.expiry || todayYmd(),
      price: item.price != null ? String(item.price) : '',
      category: item.category || ''
    });
    setShowEditModal(true);
  }, []);

  const deleteItem = useCallback((itemId) => {
    setShowItemDetail(false);
    Alert.alert(
      'Delete Item',
      'Are you sure you want to remove this item from your inventory?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            setFoodInventory(prevItems => prevItems.filter(item => item.id !== itemId));
          }
        }
      ]
    );
  }, [setFoodInventory]);

  const markItemAsUsed = useCallback((itemId) => {
    setFoodInventory(prevItems => {
      return prevItems.map(item => {
        if (item.id === itemId) {
          if (item.quantity > 1) {
            // Reduce quantity by 1
            return { ...item, quantity: item.quantity - 1 };
          } else {
            // Remove item if quantity is 1
            return null;
          }
        }
        return item;
      }).filter(Boolean); // Remove null items
    });
    
    // Mark as consumed in spending history
    const item = foodInventory.find(item => item.id === itemId);
    if (item) {
      addSpendingRecord(item);
      
      // Gamification triggers
      updateStats('itemsUsed');
      unlockAchievement('WASTE_WARRIOR');
      checkAchievements();
    }
  }, [setFoodInventory, foodInventory, addSpendingRecord, updateStats, unlockAchievement, checkAchievements]);

  // Manual barcode entry
  const handleManualBarcodeSubmit = useCallback(async () => {
    const validation = validateBarcode(manualBarcode);
    if (!validation.isValid) {
      Alert.alert('Invalid Barcode', validation.error);
      return;
    }
    
    setShowManualEntry(false);
    await addProductToInventory(manualBarcode.trim());
    setManualBarcode('');
  }, [manualBarcode, addProductToInventory]);

  // Add product to inventory from scanner modal (merge duplicates)
  const handleProductScanned = (product) => {
    if (product) {
      // Ensure safe defaults
      const safeProduct = {
        ...product,
        name: product.name && String(product.name).trim() ? product.name : 'Unknown Product',
        quantity: Number(product.quantity) || 1,
      };

      setFoodInventory(prev => {
        // Prefer matching by barcode; if no barcode, fall back to case-insensitive name match
        const matchIndex = prev.findIndex(i =>
          (safeProduct.barcode && i.barcode && i.barcode === safeProduct.barcode) ||
          (!safeProduct.barcode && i.name && safeProduct.name && String(i.name).toLowerCase() === String(safeProduct.name).toLowerCase())
        );

        if (matchIndex !== -1) {
          const existing = prev[matchIndex];
          const updated = {
            ...existing,
            quantity: (Number(existing.quantity) || 1) + (Number(safeProduct.quantity) || 1),
            // Keep earliest expiry if both exist
            expiry: (existing.expiry && safeProduct.expiry)
              ? (Date.parse(existing.expiry) <= Date.parse(safeProduct.expiry) ? existing.expiry : safeProduct.expiry)
              : (existing.expiry || safeProduct.expiry || null),
            // Update price to latest if provided
            price: safeProduct.price != null ? safeProduct.price : existing.price,
          };
          const next = [...prev];
          next[matchIndex] = updated;
          return next;
        }

        // No match: add new item
        return [safeProduct, ...prev];
      });

      // Add to spending history if it's a new item or if price is provided
      if (safeProduct.price != null && safeProduct.price > 0) {
        addSpendingRecord(safeProduct);
      }

      // Show success message
      Alert.alert(
        'Product Added! 🎉',
        `Added ${safeProduct.name}${safeProduct.barcode ? ' (merged if duplicate)' : ''}.`,
        [{ text: 'Great!' }]
      );
    } else {
      Alert.alert('Error', 'Failed to add product. Please try again.');
    }
    // Note: Don't close the scanner here - let the modal handle its own closing
  };

  // Add this handler to add parsed receipt items to inventory
  const handleReceiptItemsParsed = useCallback((items) => {
    const today = new Date().toISOString().split('T')[0];
    const newItems = items.map(item => ({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      name: item.name,
      price: item.price,
      dateAdded: today,
      expiry: predictExpiryDate('default'),
      quantity: item.quantity,
      barcode: '',
      brand: '',
      category: '',
      ingredients: '',
      nutrition: {},
      imageUrl: null,
    }));
    setFoodInventory(prev => [...newItems, ...prev]);
    newItems.forEach(item => addSpendingRecord(item));
    Alert.alert('Items Added', `${newItems.length} items added from receipt!`);
  }, [setFoodInventory, addSpendingRecord]);

  // Handler for confirming reviewed items
  const handleConfirmReceiptReview = useCallback(() => {
    const itemsToAdd = [...receiptReviewItems]; // Make a local copy to avoid stale closure
    setFoodInventory(prev => [...itemsToAdd, ...prev]);
    itemsToAdd.forEach(item => addSpendingRecord(item));
    setReceiptReviewModalVisible(false);
    setReceiptReviewItems([]);
    Alert.alert('Items Added', `${itemsToAdd.length} items added from receipt!`);
  }, [receiptReviewItems, setFoodInventory, addSpendingRecord]);

  // Handler for editing a field in a receipt review item
  const handleEditReceiptReviewItem = (index, field, value) => {
    setReceiptReviewItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Refresh function
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Sorting and filtering
  const sortedItems = useMemo(() => {
    const toTime = (value) => {
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY; // push invalid/missing dates to the end
    };
    const sorted = [...foodInventory].sort((a, b) => {
      switch (sortBy) {
        case 'expiry': {
          const diff = toTime(a.expiry) - toTime(b.expiry);
          if (diff !== 0) return diff; // earlier expiry first
          // tie-breakers for stability
          const nameDiff = String(a.name || '').localeCompare(String(b.name || ''));
          if (nameDiff !== 0) return nameDiff;
          return (a.id || '').localeCompare(b.id || '');
        }
        case 'name':
          return String(a.name || '').localeCompare(String(b.name || ''));
        case 'dateAdded':
          return (Date.parse(b.dateAdded) || 0) - (Date.parse(a.dateAdded) || 0);
        case 'quantity':
          return (b.quantity || 1) - (a.quantity || 1);
        default:
          return 0;
      }
    });
    return sorted;
  }, [foodInventory, sortBy]);

  // Sort control UI
  const sortOptions = [
    { key: 'expiry', label: 'Expiry' },
    { key: 'name', label: 'Name' },
    { key: 'dateAdded', label: 'Date Added' },
    { key: 'quantity', label: 'Quantity' },
  ];

  // Get inventory stats
  const inventoryStats = useMemo(() => {
    const total = foodInventory.length;
    const totalQuantity = foodInventory.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const expiringSoon = foodInventory.filter(item => {
      const days = getDaysUntilExpiry(item.expiry);
      return days <= DAYS_UNTIL_EXPIRY_WARNING && days >= 0;
    }).length;
    const expired = foodInventory.filter(item => getDaysUntilExpiry(item.expiry) < 0).length;
    
    // Calculate total value
    const totalValue = foodInventory.reduce((sum, item) => {
      const itemPrice = item.price || 0;
      const itemQuantity = item.quantity || 1;
      return sum + (itemPrice * itemQuantity);
    }, 0);
    
    // Count unique categories
    const categories = new Set(foodInventory.map(item => item.category).filter(Boolean));
    const categoryCount = categories.size;
    
    return { total, totalQuantity, expiringSoon, expired, totalValue, categoryCount };
  }, [foodInventory]);

  // Empty state component
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🍎</Text>
      <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>No items in inventory</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Scan or add products to get started!</Text>
    </View>
  );

  // Skeleton loading state
  const renderSkeletonList = () => (
    <View style={styles.listContent}>
      {[1, 2, 3, 4, 5].map((i) => (
        <SkeletonItem key={i} theme={theme} />
      ))}
    </View>
  );

  // Replace handleScanReceipt with this:
  const handleScanReceipt = useCallback(() => {
    setReceiptModalVisible(true);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView key={themeResetKey} style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.background} />

        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={[styles.menuButton, { backgroundColor: theme.surface + '20' }]}
              onPress={() => {
                navigation.openDrawer();
              }}
            >
              <MaterialCommunityIcons name="menu" size={24} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.titleContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="food-apple" size={22} color={theme.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.headerTitle, { color: theme.text }]}>Food Inventory</Text>
              </View>
              <Text style={[styles.subtitle, { color: theme.textSecondary, marginTop: 2 }]}>
                {inventoryStats.total} items • {inventoryStats.totalQuantity} total quantity
              </Text>
            </View>
            <TouchableOpacity style={[styles.menuButton, { backgroundColor: theme.surface + '20' }]} onPress={() => navigation.navigate('Profile')}>
              <MaterialCommunityIcons name="account" size={24} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, { backgroundColor: theme.primary + '20' }]}
              onPress={() => {
                Alert.alert(
                  'Sort Options',
                  'Choose how to sort your inventory:',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'By Expiry Date', onPress: () => setSortBy('expiry') },
                    { text: 'By Name', onPress: () => setSortBy('name') },
                    { text: 'By Date Added', onPress: () => setSortBy('dateAdded') },
                    { text: 'By Quantity', onPress: () => setSortBy('quantity') },
                  ]
                );
              }}
            >
              <MaterialCommunityIcons name="sort-variant" size={20} color={theme.primary} />
            </TouchableOpacity>
          </View>
          
          {/* Sort Controls */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 12 }}>
            {sortOptions.map(option => (
              <TouchableOpacity
                key={option.key}
                onPress={() => setSortBy(option.key)}
                style={{
                  backgroundColor: sortBy === option.key ? theme.primary : theme.surface,
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  marginHorizontal: 4,
                  borderWidth: 1,
                  borderColor: sortBy === option.key ? theme.primary : theme.border,
                }}
              >
                <Text style={{ color: sortBy === option.key ? '#fff' : theme.text, fontWeight: '600', fontSize: 14 }}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Enhanced Stats */}
          {initialLoading ? (
            <SkeletonStats theme={theme} />
          ) : (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.primary }]}>
                  {inventoryStats.total}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Items</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.primary }]}>
                  {inventoryStats.totalQuantity}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Qty</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.primary }]}>
                  {inventoryStats.categoryCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Categories</Text>
              </View>
              {inventoryStats.expiringSoon > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: theme.warning || '#F59E0B' }]}>
                    {inventoryStats.expiringSoon}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Expiring Soon</Text>
                </View>
              )}
              {inventoryStats.expired > 0 && (
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, { color: theme.error || '#EF4444' }]}>
                    {inventoryStats.expired}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Expired</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Quick Actions Row (skeleton during initial loading) */}
        {initialLoading ? (
          <SkeletonQuickActions theme={theme} />
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12, marginBottom: 8 }}>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primary, marginHorizontal: 4, paddingVertical: 12, borderRadius: 8 }}
              onPress={() => setScannerVisible(true)}
            >
              <MaterialCommunityIcons name="barcode-scan" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 10 }}>Scan Barcode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.success || '#10B981', marginHorizontal: 4, paddingVertical: 12, borderRadius: 8 }}
              onPress={handleScanReceipt}
            >
              <MaterialCommunityIcons name="receipt" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 10 }}>Scan Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.warning || '#F59E0B', marginHorizontal: 4, paddingVertical: 12, borderRadius: 8 }}
              onPress={() => setShowCustomItemModal(true)}
            >
              <MaterialCommunityIcons name="plus" size={24} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 6, fontSize: 9 }}>Custom Item</Text>
            </TouchableOpacity>
          </View>
        )}

        {showCustomItemModal && (
  <Modal visible={showCustomItemModal} transparent animationType="slide" onRequestClose={() => setShowCustomItemModal(false)}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.overlay }}>
      <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 24, width: 320 }}>
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12, color: theme.text }}>Add Custom Item</Text>
        <TextInput
          placeholder="Item Name"
          value={customItem.name}
          onChangeText={text => setCustomItem({ ...customItem, name: text })}
          style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12, color: theme.text, backgroundColor: theme.background }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ marginRight: 8, color: theme.textSecondary }}>Quantity:</Text>
          <TouchableOpacity
            style={{ padding: 4, marginRight: 6, backgroundColor: theme.background, borderRadius: 6, borderWidth: 1, borderColor: theme.border }}
            onPress={() => {
              if (customItem.quantity > 1) setCustomItem({ ...customItem, quantity: customItem.quantity - 1 });
            }}
          >
            <Text style={{ fontSize: 18, color: theme.text }}>-</Text>
          </TouchableOpacity>
          <Text style={{ width: 40, textAlign: 'center', fontSize: 16, color: theme.text }}>{customItem.quantity}</Text>
          <TouchableOpacity
            style={{ padding: 4, marginLeft: 6, backgroundColor: theme.background, borderRadius: 6, borderWidth: 1, borderColor: theme.border }}
            onPress={() => setCustomItem({ ...customItem, quantity: customItem.quantity + 1 })}
          >
            <Text style={{ fontSize: 18, color: theme.text }}>+</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          placeholder="Weight (e.g. 500g, 1kg)"
          value={customItem.weight || ''}
          onChangeText={text => setCustomItem({ ...customItem, weight: text })}
          style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12, color: theme.text, backgroundColor: theme.background }}
        />
        <TextInput
          placeholder="Price"
          value={customItem.price}
          onChangeText={text => setCustomItem({ ...customItem, price: text })}
          keyboardType="decimal-pad"
          style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12, color: theme.text, backgroundColor: theme.background }}
        />
        <TextInput
          placeholder="Expiry date (optional, e.g., 25/12/24 or 25/12)"
          value={customItem.expiry}
          onChangeText={text => setCustomItem({ ...customItem, expiry: text })}
          keyboardType="default"
          style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12, color: theme.text, backgroundColor: theme.background }}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
          <TouchableOpacity onPress={() => setShowCustomItemModal(false)}>
            <Text style={{ color: theme.error, fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (!customItem.name.trim()) {
                Alert.alert('Error', 'Please enter an item name.');
                return;
              }
              const newCustomItem = {
                id: Date.now().toString(),
                name: customItem.name.trim(),
                quantity: customItem.quantity || 1,
                weight: customItem.weight || '',
                price: parseFloat(customItem.price) || 0,
                expiry: parseExpiryInput(customItem.expiry),
                dateAdded: new Date().toISOString().split('T')[0],
              };
              setFoodInventory(prev => {
                const updatedInventory = [newCustomItem, ...prev];
                return updatedInventory;
              });
              addSpendingRecord(newCustomItem);
              setShowCustomItemModal(false);
              setCustomItem({ name: '', quantity: 1, price: '', weight: '', expiry: '' });
            }}
          >
            <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
)}

        {/* Remove the floating FABs for selection mode */}
        {/* Add a normal button above the inventory list, aligned right */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginRight: 16, marginBottom: 8 }}>
          {!selectionMode ? (
            <TouchableOpacity onPress={() => setSelectionMode(true)} activeOpacity={0.7}>
              <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>Select</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedItems([]); }} activeOpacity={0.7}>
              <Text style={{ color: theme.error || '#EF4444', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {initialLoading ? (
          <View style={[styles.list, { backgroundColor: theme.background }]}>
            {renderSkeletonList()}
          </View>
        ) : (
          <SwipeListView
            data={sortedItems}
            keyExtractor={(item, index) => {
              const id = item?.id ?? item?.barcode ?? `${item?.name ?? 'item'}-${index}`;
              return String(id);
            }}
            renderItem={({ item }) => (
              <InventoryItem
                item={item}
                onPress={openItemDetail}
                theme={theme}
                onDelete={deleteItem}
                onMarkAsUsed={markItemAsUsed}
                onAddToShoppingList={addToShoppingList}
                selectionMode={selectionMode}
                selectedItems={selectedItems}
                setSelectedItems={setSelectedItems}
                onIncrement={() => incrementItemQuantity(item.id)}
                onDecrement={() => decrementItemQuantity(item.id)}
              />
            )}
            renderHiddenItem={({ item }, rowMap) => (
              <View style={styles.swipeActions}>
                <TouchableOpacity
                  style={[styles.swipeAction, styles.swipeActionUsed, { backgroundColor: theme.success }]}
                  onPress={() => {
                    rowMap[item.id]?.closeRow();
                    markItemAsUsed(item.id);
                  }}
                >
                  <MaterialCommunityIcons name="check" size={20} color="white" />
                  <Text style={styles.swipeActionText}>Used</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.swipeAction, styles.swipeActionShopping, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    rowMap[item.id]?.closeRow();
                    addToShoppingList(item);
                  }}
                >
                  <MaterialCommunityIcons name="cart-plus" size={20} color="white" />
                  <Text style={styles.swipeActionText}>Add</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.swipeAction, styles.swipeActionDelete, { backgroundColor: theme.error }]}
                  onPress={() => {
                    rowMap[item.id]?.closeRow();
                    deleteItem(item.id);
                  }}
                >
                  <MaterialCommunityIcons name="delete" size={20} color="white" />
                  <Text style={styles.swipeActionText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
            rightOpenValue={-150}
            disableRightSwipe
            style={[styles.list, { backgroundColor: theme.background }]}
            contentContainerStyle={foodInventory.length === 0 ? styles.listEmpty : styles.listContent}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            getItemLayout={(data, index) => ({
              length: 120,
              offset: 120 * index,
              index,
            })}
          />
        )}

        {selectionMode && selectedItems.length > 0 && (
  <View style={{
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  }}>
    <TouchableOpacity
      style={{ backgroundColor: theme.error || '#EF4444', padding: 12, borderRadius: 8, minWidth: 60, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
      onPress={() => {
        setFoodInventory(prev => prev.filter(item => !selectedItems.includes(item.id)));
        setSelectedItems([]);
        setSelectionMode(false);
      }}
    >
      <MaterialCommunityIcons name="trash-can-outline" size={22} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Delete</Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={{ backgroundColor: theme.primary, padding: 12, borderRadius: 8, minWidth: 180, alignItems: 'center' }}
      onPress={() => {
        const itemsToAdd = foodInventory.filter(item => selectedItems.includes(item.id));
        itemsToAdd.forEach(addToShoppingList);
        setSelectedItems([]);
        setSelectionMode(false);
      }}
    >
      <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add to Shopping List</Text>
    </TouchableOpacity>
  </View>
)}

        {/* Enhanced Manual Barcode Entry Modal */}
        <Modal
          visible={showManualEntry}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowManualEntry(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Barcode</Text>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Enter the barcode number found on the product package
              </Text>
              <Text style={[styles.exampleText, { color: theme.textSecondary }]}>
                Example: 3017620422003
              </Text>
              <TextInput
                style={[
                  styles.barcodeInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text
                  }
                ]}
                value={manualBarcode}
                onChangeText={setManualBarcode}
                placeholder="Enter barcode number"
                placeholderTextColor={theme.textSecondary}
                keyboardType="numeric"
                autoFocus={true}
                maxLength={MAX_BARCODE_LENGTH}
                returnKeyType="done"
                onSubmitEditing={handleManualBarcodeSubmit}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalCancelButton, { backgroundColor: theme.border }]}
                  onPress={() => {
                    setShowManualEntry(false);
                    setManualBarcode('');
                  }}
                >
                  <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSubmitButton,
                    { backgroundColor: manualBarcode.trim() ? (theme.success || '#10B981') : theme.border }
                  ]}
                  onPress={handleManualBarcodeSubmit}
                  disabled={!manualBarcode.trim()}
                >
                  <Text style={[
                    styles.modalSubmitText,
                    { color: manualBarcode.trim() ? '#fff' : theme.textSecondary }
                  ]}>
                    Add Product
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Price Input Modal */}
        <Modal
          visible={showPriceInput}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowPriceInput(false)}
        >
          <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Price</Text>
              <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {pendingProduct?.name}
              </Text>
              <Text style={[styles.exampleText, { color: theme.textSecondary }]}>
                Enter the price you paid for this item
              </Text>
              <TextInput
                style={[
                  styles.barcodeInput,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                    color: theme.text
                  }
                ]}
                value={manualPrice}
                onChangeText={(txt) => {
                  const sanitized = txt.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
                  setManualPrice(sanitized);
                }}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                autoFocus={true}
                returnKeyType="done"
                onSubmitEditing={handlePriceSubmit}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalCancelButton, { backgroundColor: theme.border }]}
                  onPress={handlePriceSkip}
                >
                  <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSubmitButton,
                    { backgroundColor: manualPrice.trim() ? (theme.success || '#10B981') : theme.border }
                  ]}
                  onPress={handlePriceSubmit}
                  disabled={!manualPrice.trim()}
                >
                  <Text style={[
                    styles.modalSubmitText,
                    { color: manualPrice.trim() ? '#fff' : theme.textSecondary }
                  ]}>
                    OK
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Item Detail Modal */}
        <ItemDetailModal
          visible={showItemDetail}
          item={selectedItem}
          onClose={() => setShowItemDetail(false)}
          onEdit={editItem}
          onDelete={deleteItem}
          onAddToShoppingList={addToShoppingList}
          theme={theme}
        />

        {/* Custom Item Modal */}
        {showCustomItemModal && (
          <Modal visible={showCustomItemModal} transparent animationType="slide" onRequestClose={() => setShowCustomItemModal(false)}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.overlay }}>
              <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 24, width: 320 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12, color: theme.text }}>Add Custom Item</Text>
                <TextInput
                  placeholder="Item Name"
                  value={customItem.name}
                  onChangeText={text => setCustomItem({ ...customItem, name: text })}
                  style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12, color: theme.text, backgroundColor: theme.background }}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ marginRight: 8, color: theme.textSecondary }}>Quantity:</Text>
                  <TouchableOpacity
                    style={{ padding: 4, marginRight: 6, backgroundColor: theme.background, borderRadius: 6, borderWidth: 1, borderColor: theme.border }}
                    onPress={() => {
                      if (customItem.quantity > 1) setCustomItem({ ...customItem, quantity: customItem.quantity - 1 });
                    }}
                  >
                    <Text style={{ fontSize: 18, color: theme.text }}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ width: 40, textAlign: 'center', fontSize: 16, color: theme.text }}>{customItem.quantity}</Text>
                  <TouchableOpacity
                    style={{ padding: 4, marginLeft: 6, backgroundColor: theme.background, borderRadius: 6, borderWidth: 1, borderColor: theme.border }}
                    onPress={() => setCustomItem({ ...customItem, quantity: customItem.quantity + 1 })}
                  >
                    <Text style={{ fontSize: 18, color: theme.text }}>+</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  placeholder="Weight (e.g. 500g, 1kg)"
                  value={customItem.weight || ''}
                  onChangeText={text => setCustomItem({ ...customItem, weight: text })}
                  style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12, color: theme.text, backgroundColor: theme.background }}
                />
                <TextInput
                  placeholder="Price"
                  value={customItem.price}
                  onChangeText={text => setCustomItem({ ...customItem, price: text })}
                  keyboardType="decimal-pad"
                  style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12, color: theme.text, backgroundColor: theme.background }}
                />
                <TextInput
                  placeholder="Expiry date (optional, e.g., 25/12/24 or 25/12)"
                  value={customItem.expiry}
                  onChangeText={text => setCustomItem({ ...customItem, expiry: text })}
                  keyboardType="default"
                  style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, marginBottom: 12, color: theme.text, backgroundColor: theme.background }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                  <TouchableOpacity onPress={() => setShowCustomItemModal(false)}>
                    <Text style={{ color: theme.error || '#EF4444', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (!customItem.name.trim()) {
                        Alert.alert('Error', 'Please enter an item name.');
                        return;
                      }
                      const newCustomItem = {
                        id: Date.now().toString(),
                        name: customItem.name.trim(),
                        quantity: customItem.quantity || 1,
                        weight: customItem.weight || '',
                        price: parseFloat(customItem.price) || 0,
                        expiry: parseExpiryInput(customItem.expiry),
                        dateAdded: new Date().toISOString().split('T')[0],
                      };
                      setFoodInventory(prev => {
                        const updatedInventory = [newCustomItem, ...prev];
                        return updatedInventory;
                      });
                      addSpendingRecord(newCustomItem);
                      setShowCustomItemModal(false);
                      setCustomItem({ name: '', quantity: 1, price: '', weight: '', expiry: '' });
                    }}
                  >
                    <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 16 }}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Edit Inventory Item Modal */}
        {showEditModal && (
          <Modal
            visible={showEditModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowEditModal(false)}
          >
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}
            >
              <Pressable onPress={() => {}} style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 20, width: Math.min(width - 32, 360) }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: theme.text }}>Edit Item</Text>

                {/* Name */}
                <Text style={{ color: theme.textSecondary, marginBottom: 6 }}>Name</Text>
                <TextInput
                  value={editForm.name}
                  onChangeText={(t) => setEditForm(f => ({ ...f, name: t }))}
                  placeholder="Item name"
                  placeholderTextColor={theme.textSecondary}
                  style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, backgroundColor: theme.background, marginBottom: 12 }}
                />

                {/* Quantity */}
                <Text style={{ color: theme.textSecondary, marginBottom: 6 }}>Quantity</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <TouchableOpacity onPress={() => setEditForm(f => ({ ...f, quantity: Math.max(1, (parseInt(f.quantity) || 1) - 1) }))} style={{ padding: 8, backgroundColor: theme.background, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}>
                    <Text style={{ color: theme.text, fontSize: 18 }}>-</Text>
                  </TouchableOpacity>
                  <TextInput
                    value={String(editForm.quantity)}
                    onChangeText={(t) => {
                      const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
                      setEditForm(f => ({ ...f, quantity: isNaN(n) ? 1 : Math.max(1, n) }));
                    }}
                    keyboardType="number-pad"
                    style={{ marginHorizontal: 8, width: 60, textAlign: 'center', borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingVertical: 8, color: theme.text, backgroundColor: theme.background }}
                    maxLength={4}
                  />
                  <TouchableOpacity onPress={() => setEditForm(f => ({ ...f, quantity: (parseInt(f.quantity) || 1) + 1 }))} style={{ padding: 8, backgroundColor: theme.background, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}>
                    <Text style={{ color: theme.text, fontSize: 18 }}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Expiry */}
                <Text style={{ color: theme.textSecondary, marginBottom: 6 }}>Expiry Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={editForm.expiry}
                  onChangeText={(t) => setEditForm(f => ({ ...f, expiry: t.replace(/[^0-9-]/g, '').slice(0, 10) }))}
                  placeholder={todayYmd()}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="numbers-and-punctuation"
                  style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, backgroundColor: theme.background, marginBottom: 12, fontFamily: 'monospace' }}
                />

                {/* Price */}
                <Text style={{ color: theme.textSecondary, marginBottom: 6 }}>Price (£)</Text>
                <TextInput
                  value={editForm.price}
                  onChangeText={(t) => setEditForm(f => ({ ...f, price: t.replace(/[^0-9.]/g, '') }))}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  blurOnSubmit={true}
                  style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, backgroundColor: theme.background, marginBottom: 12 }}
                />

                {/* Category */}
                <Text style={{ color: theme.textSecondary, marginBottom: 6 }}>Category</Text>
                <TextInput
                  value={editForm.category}
                  onChangeText={(t) => setEditForm(f => ({ ...f, category: t }))}
                  placeholder="e.g. Dairy"
                  placeholderTextColor={theme.textSecondary}
                  style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 10, color: theme.text, backgroundColor: theme.background, marginBottom: 16 }}
                />

                {/* Actions */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                  <TouchableOpacity onPress={() => setShowEditModal(false)}>
                    <Text style={{ color: theme.error, fontWeight: 'bold', paddingTop: 10 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (!editTarget) return setShowEditModal(false);
                      const parsedQty = parseInt(editForm.quantity, 10) || 1;
                      const cleanExpiry = editForm.expiry && /^\d{4}-\d{2}-\d{2}$/.test(editForm.expiry) ? editForm.expiry : todayYmd();
                      const parsedPrice = editForm.price === '' ? undefined : parseFloat(editForm.price) || 0;
                      setFoodInventory(prev => prev.map(it => it.id === editTarget.id ? {
                        ...it,
                        name: editForm.name.trim() || it.name,
                        quantity: Math.max(1, parsedQty),
                        expiry: cleanExpiry,
                        price: parsedPrice,
                        category: editForm.category.trim() || it.category,
                      } : it));
                      setShowEditModal(false);
                    }}
                    style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.primary }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Enhanced Action Buttons */}
        <View style={styles.buttonContainer}>
          {/* Removed the old buttonContainer */}
        </View>

        {/* Enhanced Loading Overlay */}
        {loading && (
          <EnhancedLoadingOverlay
            visible={loading}
            theme={theme}
            message={loadingMessage}
            subMessage={loadingSubMessage}
          />
        )}
        <BarcodeScannerModal
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onProductScanned={handleProductScanned}
          accentKey={accentKey}
          darkMode={darkMode}
        />
        <ReceiptScannerModal
          visible={receiptModalVisible}
          onClose={() => setReceiptModalVisible(false)}
          onItemsParsed={handleReceiptItemsParsed}
          accentKey={accentKey}
          darkMode={darkMode}
        />
        {receiptReviewModalVisible && (
  <Modal visible={receiptReviewModalVisible} transparent animationType="slide" onRequestClose={() => setReceiptReviewModalVisible(false)}>
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: 320 }}>
        <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Add Custom Item</Text>
        <ScrollView style={{ maxHeight: 350 }}>
          {receiptReviewItems.map((item, idx) => (
            <View key={item.id} style={{ marginBottom: 16, borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 8 }}>
              <TextInput
                placeholder="Item Name"
                value={item.name}
                onChangeText={text => handleEditReceiptReviewItem(idx, 'name', text)}
                style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ marginRight: 8 }}>Quantity:</Text>
                <TouchableOpacity
                  style={{ padding: 4, marginRight: 6, backgroundColor: '#eee', borderRadius: 6 }}
                  onPress={() => {
                    if (item.quantity > 1) handleEditReceiptReviewItem(idx, 'quantity', item.quantity - 1);
                  }}
                >
                  <Text style={{ fontSize: 18, color: '#888' }}>-</Text>
                </TouchableOpacity>
                <TextInput
                  value={item.quantity.toString()}
                  onChangeText={text => {
                    // Only allow positive integers
                    const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
                    handleEditReceiptReviewItem(idx, 'quantity', isNaN(num) ? 1 : num);
                  }}
                  keyboardType="number-pad"
                  style={{ width: 40, textAlign: 'center', fontSize: 16, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, marginHorizontal: 4, paddingVertical: 2, backgroundColor: '#fff' }}
                  maxLength={4}
                />
                <TouchableOpacity
                  style={{ padding: 4, marginLeft: 6, backgroundColor: '#eee', borderRadius: 6 }}
                  onPress={() => handleEditReceiptReviewItem(idx, 'quantity', item.quantity + 1)}
                >
                  <Text style={{ fontSize: 18, color: '#888' }}>+</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                placeholder="Price"
                value={item.price?.toString()}
                onChangeText={text => handleEditReceiptReviewItem(idx, 'price', parseFloat(text) || 0)}
                keyboardType="decimal-pad"
                style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 12 }}
              />
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
          <TouchableOpacity onPress={() => setReceiptReviewModalVisible(false)}>
            <Text style={{ color: '#F87171', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleConfirmReceiptReview}>
            <Text style={{ color: isDefault ? '#3B82F6' : theme.accent, fontWeight: 'bold', fontSize: 16 }}>Add Items</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
)}
      </SafeAreaView>
      
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    // backgroundColor moved to inline style
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  shoppingListButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: '#FFC94D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    flexWrap: 'wrap',
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  sortLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    flex: 1,
    // backgroundColor moved to inline style
  },
  listContent: {
    paddingBottom: 140,
    paddingTop: 8,
  },
  listEmpty: {
    flex: 1,
    paddingBottom: 140,
  },
  item: {
    borderRadius: 14,
    marginBottom: 8,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
    minHeight: 100, // Increased height
    paddingVertical: 14, // Add more vertical padding for space
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingHorizontal: 12,
  },
  nameContainer: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 2,
  },
  brand: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  itemDetails: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  barcode: {
    fontSize: 10,
    fontFamily: 'monospace',
    opacity: 0.6,
  },
  statusBar: {
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginBottom: 8,
  },
  itemMain: {
    flex: 1,
  },
  swipeActionsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    height: '100%',
    paddingRight: 0,
    gap: 19,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80, // Smaller width
    height: '100%',
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    marginLeft: 0, // Remove extra margin
    paddingVertical: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    gap: 12,
  },
  scanButton: {
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  scanReceiptButton: {
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  addButton: {
    padding: 18,
    borderRadius: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    padding: 32,
    borderRadius: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 12,
    minWidth: 220,
  },
  loadingText: {
    fontSize: 17,
    marginTop: 16,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 15,
    marginTop: 6,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(34,43,69,0.18)',
  },
  modalContent: {
    padding: 28,
    borderRadius: 22,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 18,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 17,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  exampleText: {
    fontSize: 15,
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  barcodeInput: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 18,
    fontSize: 19,
    marginBottom: 28,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 14,
  },
  modalCancelButton: {
    flex: 1,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 22,
    // backgroundColor moved to inline style
  },
  // Detail Modal styles
  detailModal: {
    flex: 1,
    marginTop: 80,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 18,
  },
  detailContent: {
    flex: 1,
    padding: 24,
  },
  detailHeader: {
    marginBottom: 22,
  },
  detailTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailBrand: {
    fontSize: 19,
    fontStyle: 'italic',
  },
  detailCard: {
    padding: 18,
    borderRadius: 14,
    marginBottom: 18,
  },
  detailLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  detailSectionTitle: {
    fontSize: 21,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nutritionLabel: {
    fontSize: 15,
  },
  nutritionValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  detailActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    // borderTopColor moved to inline style
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 24,
    marginHorizontal: 2,
    elevation: 0,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  editButton: {
    // backgroundColor moved to inline style
  },
  addToListButton: {
    // backgroundColor moved to inline style
  },
  deleteButton: {
    // backgroundColor moved to inline style
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    backgroundColor: 'transparent',
    padding: 4,
  },
  fabThemeToggle: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 0,
    zIndex: 100,
  },
  // Swipe action styles
  swipeActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    height: 92, // Make swipe area more compact
    paddingRight: 8,
    gap: 0,
    marginTop: 5, // Move action buttons down a little
  },
  swipeActionUsed: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  swipeActionShopping: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  swipeActionDelete: {},
  swipeActionText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  skeletonStatusBar: {
    height: 3,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginBottom: 8,
  },
  skeletonText: {
    height: 12,
    borderRadius: 6,
  },
  skeletonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  skeletonIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  skeletonChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
  },
  skeletonStatNumber: {
    width: 40,
    height: 20,
    borderRadius: 10,
    marginBottom: 4,
  },
  skeletonStatLabel: {
    width: 50,
    height: 12,
    borderRadius: 6,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    // backgroundColor moved to inline style
  },
});