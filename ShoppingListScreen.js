import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Animated, Dimensions, Alert, Modal, TextInput, PanResponder, Easing, Keyboard, TouchableWithoutFeedback, ScrollView, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useContext, useRef, useEffect } from 'react';
import { ShoppingListContext } from './App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SwipeListView } from 'react-native-swipe-list-view';
import * as Haptics from 'expo-haptics';
import { SafeAreaView} from 'react-native-safe-area-context';
import { getTheme } from './theme';
import * as Location from 'expo-location';

const { width } = Dimensions.get('window');



function ShoppingListItem({ item, index, theme, removeFromShoppingList, markShoppingItemAsDone, unmarkShoppingItemAsDone, updateShoppingItem }) {
  const itemOpacity = React.useRef(new Animated.Value(0)).current;
  const itemScale = React.useRef(new Animated.Value(0.95)).current;
  const translateX = React.useRef(new Animated.Value(0)).current;
  const swipedAway = React.useRef(false);
  
  // Touch tracking refs
  const touchStart = React.useRef(null);
  const touchEnd = React.useRef(null);
  const minSwipeDistance = 100;
  const thresholdReached = React.useRef(false); // Track if haptic feedback was triggered

  // Swipe progress for gradual reveal (similar to Spotify)
  const swipeProgress = translateX.interpolate({
    inputRange: [-90, 0], // -90, 0 (ascending)
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Background opacity that gradually reveals
  const backgroundOpacity = translateX.interpolate({
    inputRange: [-90, -20, 0], // -90, -20, 0 (ascending)
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });

  // Icon movement - moves closer to center as user swipes (like Spotify queue)
  const iconTranslateX = translateX.interpolate({
    inputRange: [-260, -90, 0], // -260, -90, 0 (ascending)
    outputRange: [-50, -20, 0], // Moves from right edge toward center
    extrapolate: 'clamp',
  });

  // Icon scale with more dynamic feedback
  const iconScale = translateX.interpolate({
    inputRange: [-90, -40, 0], // -90, -40, 0 (ascending: -90 < -40 < 0)
    outputRange: [1.3, 1.1, 0.9],
    extrapolate: 'clamp',
  });
  
  // Icon opacity with smoother transition
  const iconOpacity = translateX.interpolate({
    inputRange: [-90, -20, 0], // -90, -20, 0 (ascending: -90 < -20 < 0)
    outputRange: [1, 0.8, 0.3],
    extrapolate: 'clamp',
  });
  
  // Shadow effect when swiping
  const shadowOpacity = translateX.interpolate({
    inputRange: [-100, -10, 0],
    outputRange: [0.15, 0.05, 0.02],
    extrapolate: 'clamp',
  });

  // For right-edge swipe (leftward motion) - use hardcoded safe values
  const SWIPE_THRESHOLD = 90; // px to trigger remove
  const SWIPE_MAX = 260; // max translate magnitude

  // Reset per item
  React.useEffect(() => {
    translateX.setValue(0);
    swipedAway.current = false;
    thresholdReached.current = false;
  }, [item.id]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(itemOpacity, {
        toValue: 1,
        duration: 600,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(itemScale, {
        toValue: 1,
        duration: 600,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleToggleDone = () => {
    if (item.isDone) {
      unmarkShoppingItemAsDone && unmarkShoppingItemAsDone(item.id);
    } else {
      markShoppingItemAsDone && markShoppingItemAsDone(item.id);
    }
  };

  const unitPrice = item.price && item.quantity ? (item.price / item.quantity) : null;

  // Touch handlers with Spotify-like behavior
  const onTouchStart = (e) => {
    touchEnd.current = null;
    touchStart.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
      time: Date.now()
    };
    thresholdReached.current = false; // Reset threshold tracking
  };

  const onTouchMove = (e) => {
    if (!touchStart.current) return;
    touchEnd.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY
    };
    
    const deltaX = e.nativeEvent.pageX - touchStart.current.x;
    const deltaY = e.nativeEvent.pageY - touchStart.current.y;
    
    // Only handle horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      // Spotify-style resistance
      let adjustedDelta = deltaX;
      if (deltaX < 0) {
        // Left swipe (delete) - linear until threshold, then resistance
        adjustedDelta = deltaX > -90 ? deltaX : -90 + (deltaX + 90) * 0.3;
        
        // Haptic feedback when threshold is reached (like Spotify)
        if (deltaX <= -90 && !thresholdReached.current) {
          thresholdReached.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (deltaX > -90 && thresholdReached.current) {
          thresholdReached.current = false;
        }
      } else {
        // Right swipe - heavy resistance (like Spotify)
        adjustedDelta = deltaX * 0.2;
        thresholdReached.current = false;
      }
      
      const clampedDistance = Math.max(-260, Math.min(0, adjustedDelta));
      translateX.setValue(clampedDistance);
    }
  };

  const onTouchEnd = () => {
    if (!touchStart.current || !touchEnd.current) return;
    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaTime = Date.now() - touchStart.current.time;
    const velocity = Math.abs(deltaX) / deltaTime; // px/ms
    
    // Spotify's logic: threshold distance OR high velocity
    const shouldDelete = deltaX < -90 || (deltaX < -50 && velocity > 0.5);
    
    if (shouldDelete && !swipedAway.current) {
      swipedAway.current = true;
      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.timing(translateX, {
        toValue: -260,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        removeFromShoppingList && removeFromShoppingList(item.id);
      });
    } else {
      // Smooth snap back with cubic-bezier (like Spotify)
      Animated.timing(translateX, {
        toValue: 0,
        duration: 300,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1), // Spotify's cubic-bezier
        useNativeDriver: true,
      }).start();
    }
    
    // Reset threshold tracking
    thresholdReached.current = false;
  };

  return (
    <View style={{ position: 'relative' }}>
      {/* Delete background with gradual reveal */}
      <Animated.View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        backgroundColor: '#ef4444', // Red background
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 20,
        opacity: backgroundOpacity, // Gradual reveal
      }}>
        {/* Moving trash icon with text */}
        <Animated.View style={{ 
          transform: [
            { scale: iconScale },
            { translateX: iconTranslateX } // Moves toward center as user swipes
          ], 
          opacity: iconOpacity,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 2,
          alignItems: 'center',
        }}>
          <MaterialCommunityIcons name="trash-can-outline" size={24} color="#fff" />
          <Animated.Text style={{
            color: '#fff',
            fontSize: 12,
            fontWeight: '600',
            marginTop: 4,
            opacity: swipeProgress, // Only show text when swiping significantly
          }}>
            {thresholdReached.current ? 'Release to delete' : 'Delete'}
          </Animated.Text>
        </Animated.View>
      </Animated.View>

      {/* Foreground item content */}
      <Animated.View
        style={[
          styles.shoppingListItem,
          {
            backgroundColor: item.isDone ? theme.success + '10' : theme.surface,
            borderColor: item.isDone ? theme.success + '30' : theme.border,
            opacity: swipedAway.current ? 0 : itemOpacity,
            transform: [{ scale: itemScale }, { translateX }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: shadowOpacity,
            shadowRadius: 4,
            elevation: 2,
            zIndex: 1, // Remove direct access to _value
          },
        ]}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <TouchableOpacity
          style={styles.itemContent}
          onPress={handleToggleDone}
          activeOpacity={0.7}
        >
          <View style={[
            styles.itemIcon, 
            { 
              backgroundColor: item.isDone 
                ? theme.success + '20' 
                : theme.primary + '20' 
            }
          ]}> 
            <MaterialCommunityIcons 
              name={item.isDone ? "check-circle" : "shopping-outline"} 
              size={20} 
              color={item.isDone ? theme.success : theme.primary} 
            />
          </View>
          <View style={styles.itemText}>
            <Text style={[
              styles.shoppingListItemName, 
              { 
                color: item.isDone ? theme.success : theme.text,
                textDecorationLine: item.isDone ? 'line-through' : 'none',
                opacity: item.isDone ? 0.7 : 1
              }
            ]}> 
              {item.name}
            </Text>
            <Text style={[
              styles.itemSubtext, 
              { 
                color: item.isDone ? theme.success : theme.textSecondary 
              }
            ]}> 
              {item.isDone ? 'Completed' : unitPrice ? `~ £${unitPrice.toFixed(2)} per unit` : 'Tap to mark complete'}
            </Text>
          </View>
        </TouchableOpacity>
        {/* Quick quantity + price controls */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
          <TouchableOpacity onPress={() => updateShoppingItem && updateShoppingItem(item.id, { quantity: Math.max(1, (item.quantity || 1) - 1) })}>
            <MaterialCommunityIcons name="minus-circle-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={{ marginHorizontal: 6, color: theme.textSecondary }}>{item.quantity || 1}</Text>
          <TouchableOpacity onPress={() => updateShoppingItem && updateShoppingItem(item.id, { quantity: (item.quantity || 1) + 1 })}>
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        
        {/* Swipe hint */}
        <View style={{ 
          alignItems: 'center', 
          justifyContent: 'center',
          paddingLeft: 12,
          opacity: 0.4
        }}>
          <Text style={{ 
            fontSize: 10, 
            color: theme.textSecondary,
            textAlign: 'center'
          }}>
            Swipe left →
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

// Skeleton Loading Components
const SkeletonShoppingItem = ({ theme }) => {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
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
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.shoppingListItem,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity,
        },
      ]}
    >
      <View style={styles.itemContent}>
        <View style={[styles.skeletonItemIcon, { backgroundColor: theme.border }]} />
        <View style={styles.itemText}>
          <View style={[styles.skeletonItemName, { backgroundColor: theme.border }]} />
          <View style={[styles.skeletonItemSubtext, { backgroundColor: theme.border }]} />
        </View>
      </View>
      <View style={[styles.skeletonRemoveButton, { backgroundColor: theme.border }]} />
    </Animated.View>
  );
};

const SkeletonSuggestionCard = ({ theme }) => {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
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
    <Animated.View style={[styles.suggestionCard, { backgroundColor: theme.surface, opacity }]}>
      <View style={styles.suggestionHeader}>
        <View style={[styles.skeletonSuggestionBadge, { backgroundColor: theme.border }]} />
      </View>
      <View style={[styles.skeletonSuggestionName, { backgroundColor: theme.border }]} />
      <View style={styles.suggestionDetails}>
        <View style={[styles.skeletonSuggestionDetail, { backgroundColor: theme.border }]} />
        <View style={[styles.skeletonSuggestionDetail, { backgroundColor: theme.border, width: '60%' }]} />
      </View>
      <View style={[styles.skeletonAddButton, { backgroundColor: theme.border }]} />
    </Animated.View>
  );
};

export default function ShoppingListScreen() {
  const navigation = useNavigation();
  const { 
    shoppingList, 
    removeFromShoppingList, 
    markShoppingItemAsDone,
    unmarkShoppingItemAsDone,
    clearCompletedItems,
    darkMode, 
    setDarkMode, 
    foodInventory, 
    addToShoppingList, 
    accentKey, 
    updateShoppingItem
  } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const isDefault = !accentKey || accentKey === 'default';
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Add item modal state
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newItemName, setNewItemName] = React.useState('');
  const [initialLoading, setInitialLoading] = React.useState(true);

  // Bulk add state
  const [inputMode, setInputMode] = React.useState('single'); // 'single' or 'bulk'
  const [bulkText, setBulkText] = React.useState('');

  // Shop locator state
  const [isLocating, setIsLocating] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [nearbyShops, setNearbyShops] = useState([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopFilter, setShopFilter] = useState('all'); // 'all', 'supermarket', 'convenience', 'grocery'
  const [favoriteShops, setFavoriteShops] = useState([]);
  const [routeEstimates, setRouteEstimates] = useState({});

  // Helper: get days until expiry
  const getDaysUntilExpiry = (expiryDate) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Smart suggestions: low or expiring soon, not in shopping list
  const SUGGESTION_EXPIRY_DAYS = 3;
  const SUGGESTION_LOW_QTY = 2;

  // Persisted preferences/ignores
  const [hideSuggestions, setHideSuggestions] = React.useState(false);
  const [isSuggestionsCollapsed, setIsSuggestionsCollapsed] = React.useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = React.useState([]);
  const HIDE_SUGGESTIONS_KEY = 'shopping_hide_suggestions_v1';
  const COLLAPSE_SUGGESTIONS_KEY = 'shopping_collapse_suggestions_v1';
  const DISMISSED_SUGGESTIONS_KEY = 'shopping_dismissed_suggestions_v1';

  useEffect(() => {
    (async () => {
      try {
        const hideRaw = await AsyncStorage.getItem(HIDE_SUGGESTIONS_KEY);
        const collapseRaw = await AsyncStorage.getItem(COLLAPSE_SUGGESTIONS_KEY);
        const dismissedRaw = await AsyncStorage.getItem(DISMISSED_SUGGESTIONS_KEY);
        if (hideRaw != null) setHideSuggestions(hideRaw === 'true');
        if (collapseRaw != null) setIsSuggestionsCollapsed(collapseRaw === 'true');
        if (dismissedRaw) setDismissedSuggestionIds(JSON.parse(dismissedRaw));
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(HIDE_SUGGESTIONS_KEY, hideSuggestions ? 'true' : 'false').catch(() => {});
  }, [hideSuggestions]);
  useEffect(() => {
    AsyncStorage.setItem(COLLAPSE_SUGGESTIONS_KEY, isSuggestionsCollapsed ? 'true' : 'false').catch(() => {});
  }, [isSuggestionsCollapsed]);
  useEffect(() => {
    AsyncStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify(dismissedSuggestionIds)).catch(() => {});
  }, [dismissedSuggestionIds]);

  const dismissSuggestion = (id) => {
    setDismissedSuggestionIds(prev => Array.from(new Set([...(prev || []), id])));
  };

  const suggestions = foodInventory.filter(item => {
    const inShoppingList = shoppingList.some(sl => 
      sl.id === item.id || 
      (sl.barcode && sl.barcode === item.barcode) ||
      sl.name?.toLowerCase() === item.name?.toLowerCase()
    );
    const isLow = (item.quantity || 1) <= SUGGESTION_LOW_QTY;
    const isExpiring = getDaysUntilExpiry(item.expiry) <= SUGGESTION_EXPIRY_DAYS;
    const dismissed = dismissedSuggestionIds.includes(item.id);
    return !inShoppingList && !dismissed && (isLow || isExpiring);
  });

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Simulate initial loading
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 1500); // Show skeleton for 1.5 seconds

    return () => clearTimeout(timer);
  }, []);

  const renderShoppingItem = ({ item, index }) => (
    <ShoppingListItem
      item={item}
      index={index}
      theme={theme}
      removeFromShoppingList={removeFromShoppingList}
      markShoppingItemAsDone={markShoppingItemAsDone}
      unmarkShoppingItemAsDone={unmarkShoppingItemAsDone}
      updateShoppingItem={updateShoppingItem}
    />
  );

  const EmptyState = () => {
    const activeItems = shoppingList.filter(item => !item.isDone);
    const completedItems = shoppingList.filter(item => item.isDone);
    
    if (completedItems.length > 0 && activeItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.success + '10' }]}>
            <MaterialCommunityIcons 
              name="check-circle" 
              size={64} 
              color={theme.success} 
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
        All items completed!
      </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Great job! You've completed all your shopping items.
      </Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '10' }]}>
          <MaterialCommunityIcons 
            name="cart-outline" 
            size={64} 
            color={theme.primary} 
          />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.text }]}>
          Your shopping list is empty
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Add items to get started with your shopping
        </Text>
      </View>
    );
  };

  // Enhanced suggestion handler with feedback
  const handleAddSuggestion = (item) => {
    try {
      // Create a shopping list item from the inventory item
      const shoppingItem = {
        id: item.id || Date.now().toString(),
        name: item.name,
        barcode: item.barcode || null,
        quantity: 1, // Default quantity for shopping
        category: item.category || 'Other',
        addedAt: new Date().toISOString(),
        fromSuggestion: true,
        originalItem: item // Keep reference to original inventory item
      };

      addToShoppingList(shoppingItem);
      
      // Optional: Show success feedback
      Alert.alert(
        'Added to Shopping List',
        `${item.name} has been added to your shopping list.`,
        [{ text: 'OK', style: 'default' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add item to shopping list. Please try again.');
    }
  };

  // Get suggestion priority and styling
  const getSuggestionStyle = (item) => {
    const daysUntilExpiry = getDaysUntilExpiry(item.expiry);
    const isLow = (item.quantity || 1) <= SUGGESTION_LOW_QTY;
    const isExpiring = daysUntilExpiry <= SUGGESTION_EXPIRY_DAYS;
    
    if (daysUntilExpiry <= 1) {
      return { color: theme.error, text: 'Expires today!', urgency: 'high' };
    } else if (isExpiring) {
      return { color: theme.warning, text: `Expires in ${daysUntilExpiry} days`, urgency: 'medium' };
    } else if (isLow) {
      return { color: theme.warning, text: 'Running low', urgency: 'medium' };
    }
    return { color: theme.textSecondary, text: 'Suggestion', urgency: 'low' };
  };

  // Enhanced suggestion component
  const SuggestionCard = ({ item }) => {
    const suggestionStyle = getSuggestionStyle(item);
    
    return (
      <View style={[
        styles.suggestionCard,
        {
          backgroundColor: theme.surface,
          borderColor: suggestionStyle.urgency === 'high' ? theme.error : theme.primary,
          borderWidth: suggestionStyle.urgency === 'high' ? 2 : 1,
        }
      ]}>
        <View style={[styles.suggestionHeader, { justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons 
              name={suggestionStyle.urgency === 'high' ? 'alert-circle' : 'lightbulb-outline'} 
              size={16} 
              color={suggestionStyle.color} 
            />
            <Text style={[styles.suggestionBadge, { color: suggestionStyle.color }]}>
              {suggestionStyle.text}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => dismissSuggestion(item.id)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{ padding: 4 }}
          >
            <MaterialCommunityIcons name="close" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
        
        <Text style={[styles.suggestionName, { color: theme.text }]}>
          {item.name}
        </Text>
        
        <View style={styles.suggestionDetails}>
          <Text style={[styles.suggestionDetailText, { color: theme.textSecondary }]}>
            Qty: {item.quantity || 1}
          </Text>
          <Text style={[styles.suggestionDetailText, { color: theme.textSecondary }]}>
            Expires: {new Date(item.expiry).toLocaleDateString()}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.addButton,
            {
              backgroundColor: suggestionStyle.urgency === 'high' ? theme.error : theme.primary,
            }
          ]}
          onPress={() => handleAddSuggestion(item)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name="plus" 
            size={16} 
            color="#fff" 
          />
          <Text style={styles.addButtonText}>Add to List</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Enhanced suggestion list with better layout
  const SkeletonSuggestionList = () => (
    hideSuggestions ? null : (
      <View style={styles.suggestionContainer}>
        <TouchableOpacity
          onPress={() => setIsSuggestionsCollapsed(c => !c)}
          activeOpacity={0.7}
          style={[styles.suggestionHeader, { 
            justifyContent: 'space-between',
            backgroundColor: theme.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginBottom: isSuggestionsCollapsed ? 0 : 8,
            shadowColor: theme.cardShadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
          }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons 
              name="lightbulb-on-outline" 
              size={20} 
              color={theme.primary} 
            />
            <Text style={[styles.suggestionTitle, { color: theme.text, marginLeft: 8 }]}>
              Smart Suggestions
            </Text>
            <Text style={[styles.suggestionSubtitle, { color: theme.textSecondary, marginLeft: 4 }]}>
              (tap to {isSuggestionsCollapsed ? 'expand' : 'minimize'})
            </Text>
            <View style={[styles.suggestionBadge, { backgroundColor: theme.primary + '20', marginLeft: 8 }]}>
              <Text style={[styles.suggestionBadgeText, { color: theme.primary }]}>3</Text>
            </View>
          </View>
          <MaterialCommunityIcons 
            name={isSuggestionsCollapsed ? 'chevron-down' : 'chevron-up'}
            size={22}
            color={theme.primary}
          />
        </TouchableOpacity>
        {!isSuggestionsCollapsed && (
          <FlatList
            data={[1, 2, 3]}
            keyExtractor={item => item.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionList}
            renderItem={() => <SkeletonSuggestionCard theme={theme} />}
          />
        )}
      </View>
    )
  );

  const SuggestionList = () => (
    hideSuggestions || suggestions.length === 0 ? null : (
      <View style={styles.suggestionContainer}>
        <TouchableOpacity
          onPress={() => setIsSuggestionsCollapsed(c => !c)}
          activeOpacity={0.7}
          style={[styles.suggestionHeader, { 
            justifyContent: 'space-between',
            backgroundColor: theme.surface,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            marginBottom: isSuggestionsCollapsed ? 0 : 8,
            shadowColor: theme.cardShadow,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
          }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons 
              name="lightbulb-on-outline" 
              size={20} 
              color={theme.primary} 
            />
            <Text style={[styles.suggestionTitle, { color: theme.text, marginLeft: 8 }]}>
              Smart Suggestions
            </Text>
            <Text style={[styles.suggestionSubtitle, { color: theme.textSecondary, marginLeft: 4 }]}>
              (tap to {isSuggestionsCollapsed ? 'expand' : 'minimize'})
            </Text>
            <View style={[styles.suggestionBadge, { backgroundColor: theme.primary + '20', marginLeft: 8 }]}>
              <Text style={[styles.suggestionBadgeText, { color: theme.primary }]}>
                {suggestions.length}
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons 
            name={isSuggestionsCollapsed ? 'chevron-down' : 'chevron-up'}
            size={22}
            color={theme.primary}
          />
        </TouchableOpacity>
        {!isSuggestionsCollapsed && (
          <FlatList
            data={suggestions}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionList}
            renderItem={({ item }) => <SuggestionCard item={item} />}
          />
        )}
      </View>
    )
  );

  // Add custom item handler
  const handleAddCustomItem = () => {
    if (!newItemName.trim()) {
      Alert.alert('Please enter an item name.');
      return;
    }
    Keyboard.dismiss();
    const customItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      quantity: 1,
      addedAt: new Date().toISOString(),
      fromCustom: true,
    };
    addToShoppingList(customItem);
    setShowAddModal(false);
    setNewItemName('');
    Alert.alert('Added to Shopping List', `${customItem.name} has been added to your shopping list.`);
  };

  // Bulk add handler
  const handleBulkAdd = () => {
    if (!bulkText.trim()) {
      Alert.alert('Please enter some items.');
      return;
    }
    
    Keyboard.dismiss();
    
    const items = bulkText
      .split(/[\n,;]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map((itemName, index) => ({
        id: (Date.now() + index).toString(),
        name: itemName,
        quantity: 1,
        addedAt: new Date().toISOString(),
        fromCustom: true,
      }));

    if (items.length === 0) {
      Alert.alert('No valid items found', 'Please enter at least one item.');
      return;
    }

    // Add all items to shopping list
    items.forEach(item => addToShoppingList(item));
    
    // Reset and close modal
    setShowAddModal(false);
    setBulkText('');
    setInputMode('single');
    
    Alert.alert(
      'Items Added Successfully', 
      `${items.length} item${items.length > 1 ? 's' : ''} added to your shopping list.`
    );
  };

  // Reset modal state when closing
  const handleCloseModal = () => {
    Keyboard.dismiss();
    setShowAddModal(false);
    setNewItemName('');
    setBulkText('');
    setInputMode('single');
  };

  // Handle mode switching with keyboard dismissal
  const handleModeSwitch = (mode) => {
    Keyboard.dismiss();
    setInputMode(mode);
  };

  // Get bulk items preview
  const getBulkItems = () => {
    return bulkText
      .split(/[\n,;]+/)
      .map(item => item.trim())
      .filter(item => item.length > 0);
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  // Shop locator function using OpenStreetMap Overpass API
  const findNearestShop = async () => {
    try {
      setIsLocating(true);

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location permissions to find nearby shops.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = location.coords;

      // Show modal and start loading shops
      setShowShopModal(true);
      setShopsLoading(true);

      // Query OpenStreetMap Overpass API for nearby grocery stores
      // Increased radius to 8000m (8km) for better coverage
      const overpassQuery = `
        [out:json][timeout:30];
        (
          node["shop"="supermarket"](around:8000,${latitude},${longitude});
          node["shop"="convenience"](around:8000,${latitude},${longitude});
          node["shop"="grocery"](around:8000,${latitude},${longitude});
          way["shop"="supermarket"](around:8000,${latitude},${longitude});
          way["shop"="convenience"](around:8000,${latitude},${longitude});
          way["shop"="grocery"](around:8000,${latitude},${longitude});
          relation["shop"="supermarket"](around:8000,${latitude},${longitude});
          relation["shop"="convenience"](around:8000,${latitude},${longitude});
          relation["shop"="grocery"](around:8000,${latitude},${longitude});
        );
        out center meta;
      `;

      // Try multiple Overpass API endpoints for better reliability
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.openstreetmap.fr/api/interpreter',
        'https://overpass.osm.ch/api/interpreter'
      ];

      let response;
      let lastError;

      for (const endpoint of endpoints) {
        try {
          console.log(`Trying Overpass API endpoint: ${endpoint}`);
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'FoodScannerApp/1.0',
            },
            body: `data=${encodeURIComponent(overpassQuery)}`,
          });

          if (response.ok) {
            break;
          } else {
            lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          console.log(`Endpoint ${endpoint} failed:`, error.message);
          lastError = error;
        }
      }

      if (!response || !response.ok) {
        throw lastError || new Error('All Overpass API endpoints failed');
      }

      const data = await response.json();

      // Process and sort shops by distance
      const shops = data.elements
        .filter(element => {
          // Ensure we have coordinates and a name
          const hasCoords = (element.lat || element.center?.lat) && (element.lon || element.center?.lon);
          const hasName = element.tags && (element.tags.name || element.tags['name:en']);
          return hasCoords && hasName;
        })
        .map(element => {
          const shopLat = element.lat || element.center?.lat;
          const shopLon = element.lon || element.center?.lon;
          const distance = calculateDistance(latitude, longitude, shopLat, shopLon);

          return {
            id: element.id,
            name: element.tags.name || element.tags['name:en'] || 'Unnamed Shop',
            type: element.tags.shop || 'shop',
            latitude: shopLat,
            longitude: shopLon,
            distance: distance,
            address: element.tags['addr:street'] ? `${element.tags['addr:street']} ${element.tags['addr:housenumber'] || ''}`.trim() : null,
            openingHours: element.tags.opening_hours || element.tags['opening_hours:covid19'] || null,
          };
        })
        .filter(shop => shop.distance <= 10 && shop.distance >= 0) // Only show shops within 10km and valid distances
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5); // Take top 5 closest shops

      console.log(`Found ${shops.length} shops within 10km`);

      setNearbyShops(shops);
      setShopsLoading(false);

    } catch (error) {
      console.error('Error finding nearest shops:', error);

      // Provide more specific error messages
      let errorMessage = 'Unable to find nearby shops. ';
      if (error.message.includes('All Overpass API endpoints failed')) {
        errorMessage += 'Network connection issue. Please check your internet and try again.';
      } else if (error.message.includes('Location')) {
        errorMessage += 'Please check your location settings and try again.';
      } else {
        errorMessage += 'Please try again later.';
      }

      Alert.alert(
        'Error Finding Shops',
        errorMessage,
        [{ text: 'OK' }]
      );
      setShowShopModal(false);
    } finally {
      setIsLocating(false);
    }
  };

  // Open shop in maps
  const openShopInMaps = (shop) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;
    Linking.openURL(mapsUrl);
  };

  // Toggle favorite shop
  const toggleFavoriteShop = (shopId) => {
    setFavoriteShops(prev => {
      const isFavorite = prev.includes(shopId);
      const newFavorites = isFavorite
        ? prev.filter(id => id !== shopId)
        : [...prev, shopId];
      return newFavorites;
    });
  };

  // Get filtered shops based on current filter
  const getFilteredShops = () => {
    if (shopFilter === 'all') return nearbyShops;
    return nearbyShops.filter(shop => shop.type === shopFilter);
  };

  // Estimate walking/driving time (rough estimates)
  const estimateTravelTime = (distanceKm, mode = 'walking') => {
    if (mode === 'walking') {
      // Average walking speed: 5 km/h
      const timeMinutes = (distanceKm / 5) * 60;
      return timeMinutes < 60 ? `${Math.round(timeMinutes)} min walk` : `${Math.round(timeMinutes / 60)}h ${Math.round(timeMinutes % 60)}min walk`;
    } else {
      // Average driving speed: 30 km/h in city
      const timeMinutes = (distanceKm / 30) * 60;
      return timeMinutes < 60 ? `${Math.round(timeMinutes)} min drive` : `${Math.round(timeMinutes / 60)}h ${Math.round(timeMinutes % 60)}min drive`;
    }
  };

  // Get shopping list suggestions based on items
  const getShoppingListSuggestions = () => {
    const activeItems = shoppingList.filter(item => !item.isDone);
    if (activeItems.length === 0) return [];

    // Simple logic: suggest larger stores for more items
    const suggestions = [];
    if (activeItems.length >= 5) {
      suggestions.push('supermarket');
    }
    if (activeItems.length >= 3) {
      suggestions.push('grocery');
    }
    suggestions.push('convenience');

    return [...new Set(suggestions)]; // Remove duplicates
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View style={[styles.header, { backgroundColor: theme.surface, opacity: headerOpacity }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={[styles.menuButton, { backgroundColor: 'rgba(0,0,0,0.1)' }]} 
            onPress={() => { 
              navigation.openDrawer(); 
            }} 
          > 
            <MaterialCommunityIcons name="menu" size={24} color={theme.text} /> 
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="cart-outline" size={22} color={isDefault ? theme.text : theme.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.headerTitle, { color: isDefault ? theme.text : theme.accent }]} numberOfLines={1} ellipsizeMode="tail">Shopping List</Text>
            </View>
            
          </View>
          <TouchableOpacity
            style={[styles.menuButton, { backgroundColor: 'rgba(0,0,0,0.1)' }]}
            onPress={findNearestShop}
            disabled={isLocating}
          >
            <MaterialCommunityIcons
              name={isLocating ? "loading" : "storefront"}
              size={24}
              color={theme.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuButton, { backgroundColor: 'rgba(0,0,0,0.1)' }]} onPress={() => navigation.navigate('Profile')}>
            <MaterialCommunityIcons name="account" size={24} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.addModalOverlay}>
            <View style={[styles.addModalContent, { backgroundColor: theme.surface }]}> 
              <ScrollView 
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <Text style={[styles.addModalTitle, { color: theme.text }]}>Add Items</Text>
                
                {/* Input Mode Toggle */}
                <View style={styles.inputModeToggle}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      {
                        backgroundColor: inputMode === 'single' ? theme.primary : theme.background,
                        borderColor: inputMode === 'single' ? theme.primary : theme.border,
                      }
                    ]}
                    onPress={() => handleModeSwitch('single')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons 
                      name="text-box-outline" 
                      size={16} 
                      color={inputMode === 'single' ? '#fff' : theme.textSecondary} 
                    />
                    <Text style={[
                      styles.modeButtonText,
                      { color: inputMode === 'single' ? '#fff' : theme.textSecondary }
                    ]}>
                      Single Item
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      {
                        backgroundColor: inputMode === 'bulk' ? theme.success : theme.background,
                        borderColor: inputMode === 'bulk' ? theme.success : theme.border,
                      }
                    ]}
                    onPress={() => handleModeSwitch('bulk')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons 
                      name="format-list-bulleted" 
                      size={16} 
                      color={inputMode === 'bulk' ? '#fff' : theme.textSecondary} 
                    />
                    <Text style={[
                      styles.modeButtonText,
                      { color: inputMode === 'bulk' ? '#fff' : theme.textSecondary }
                    ]}>
                      Bulk Add
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Single Item Input */}
                {inputMode === 'single' && (
                  <View style={styles.singleInputContainer}>
                    <TextInput
                      style={[styles.addModalInput, { 
                        color: theme.text, 
                        borderColor: theme.border, 
                        backgroundColor: theme.background 
                      }]}
                      placeholder="Enter item name"
                      placeholderTextColor={theme.textSecondary}
                      value={newItemName}
                      onChangeText={setNewItemName}
                      autoFocus
                      onSubmitEditing={handleAddCustomItem}
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                  </View>
                )}

                {/* Bulk Input */}
                {inputMode === 'bulk' && (
                  <View style={styles.bulkInputContainer}>
                    <View style={[styles.bulkInfoCard, { 
                      backgroundColor: theme.success + '10', 
                      borderColor: theme.success + '30' 
                    }]}>
                      <MaterialCommunityIcons name="information-outline" size={16} color={theme.success} />
                      <Text style={[styles.bulkInfoText, { color: theme.success }]}>
                        Enter multiple items separated by commas, semicolons, or new lines. Tap outside to dismiss keyboard.
                      </Text>
                    </View>
                    
                    <TextInput
                      style={[styles.bulkTextArea, { 
                        color: theme.text, 
                        borderColor: theme.border, 
                        backgroundColor: theme.background 
                      }]}
                      placeholder="milk, bread, apples&#10;chicken breast&#10;rice; pasta; tomatoes"
                      placeholderTextColor={theme.textSecondary}
                      value={bulkText}
                      onChangeText={setBulkText}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      autoFocus
                    />

                    {/* Preview */}
                    {bulkText.trim() && getBulkItems().length > 0 && (
                      <View style={[styles.previewContainer, { 
                        backgroundColor: theme.background, 
                        borderColor: theme.border 
                      }]}>
                        <Text style={[styles.previewTitle, { color: theme.text }]}>
                          Preview ({getBulkItems().length} items):
                        </Text>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false}
                          style={styles.previewScroll}
                        >
                          <View style={styles.previewTags}>
                            {getBulkItems().map((item, index) => (
                              <View key={index} style={[styles.previewTag, { 
                                backgroundColor: theme.primary + '15',
                                borderColor: theme.primary + '30'
                              }]}>
                                <Text style={[styles.previewTagText, { color: theme.primary }]}>
                                  {item}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.addModalButtons}>
                  <TouchableOpacity
                    style={[styles.addModalButton, { backgroundColor: theme.border }]}
                    onPress={handleCloseModal}
                  >
                    <Text style={[styles.addModalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.addModalButton, 
                      { 
                        backgroundColor: inputMode === 'single' ? theme.primary : theme.success,
                        opacity: (inputMode === 'single' ? !newItemName.trim() : getBulkItems().length === 0) ? 0.5 : 1
                      }
                    ]}
                    onPress={inputMode === 'single' ? handleAddCustomItem : handleBulkAdd}
                    disabled={inputMode === 'single' ? !newItemName.trim() : getBulkItems().length === 0}
                  >
                    <Text style={[styles.addModalButtonText, { color: '#fff' }]}>
                      {inputMode === 'single' 
                        ? 'Add Item' 
                        : `Add All (${getBulkItems().length})`
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Shop Locator Modal */}
      <Modal
        visible={showShopModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowShopModal(false)}
      >
        <View style={styles.shopModalOverlay}>
          <View style={[styles.shopModalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.shopModalHeader}>
              <Text style={[styles.shopModalTitle, { color: theme.text }]}>
                Nearby Grocery Stores
              </Text>
              <TouchableOpacity
                onPress={() => setShowShopModal(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Filter Buttons */}
            {!shopsLoading && nearbyShops.length > 0 && (
              <View style={styles.filterContainer}>
                {[
                  { key: 'all', label: 'All', icon: 'storefront' },
                  { key: 'supermarket', label: 'Super', icon: 'storefront-outline' },
                  { key: 'convenience', label: 'Convenience', icon: 'shopping' },
                  { key: 'grocery', label: 'Grocery', icon: 'basket-outline' }
                ].map(filter => (
                  <TouchableOpacity
                    key={filter.key}
                    style={[
                      styles.filterButton,
                      shopFilter === filter.key && { backgroundColor: theme.primary + '20' }
                    ]}
                    onPress={() => setShopFilter(filter.key)}
                  >
                    <MaterialCommunityIcons
                      name={filter.icon}
                      size={16}
                      color={shopFilter === filter.key ? theme.primary : theme.textSecondary}
                    />
                    <Text style={[
                      styles.filterText,
                      { color: shopFilter === filter.key ? theme.primary : theme.textSecondary }
                    ]}>
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Shopping List Suggestions */}
            {!shopsLoading && nearbyShops.length > 0 && getShoppingListSuggestions().length > 0 && (
              <View style={styles.suggestionsContainer}>
                <Text style={[styles.suggestionsTitle, { color: theme.text }]}>
                  Suggested for your list:
                </Text>
                <View style={styles.suggestionsChips}>
                  {getShoppingListSuggestions().map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.suggestionChip, { backgroundColor: theme.primary + '15' }]}
                      onPress={() => setShopFilter(type)}
                    >
                      <Text style={[styles.suggestionChipText, { color: theme.primary }]}>
                        {type === 'supermarket' ? '🏪 Supermarkets' :
                         type === 'grocery' ? '🛒 Grocery Stores' : '🏪 Convenience'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {shopsLoading ? (
              <View style={styles.loadingContainer}>
                <MaterialCommunityIcons name="loading" size={48} color={theme.primary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Finding nearby stores...
                </Text>
              </View>
            ) : getFilteredShops().length > 0 ? (
              <FlatList
                data={getFilteredShops()}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[styles.shopItem, { backgroundColor: theme.background }]}
                    onPress={() => openShopInMaps(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.shopItemLeft}>
                      <View style={[styles.shopIcon, { backgroundColor: theme.primary + '20' }]}>
                        <MaterialCommunityIcons
                          name={item.type === 'supermarket' ? 'storefront' : 'shopping'}
                          size={20}
                          color={theme.primary}
                        />
                      </View>
                      <View style={styles.shopInfo}>
                        <View style={styles.shopNameRow}>
                          <Text style={[styles.shopName, { color: theme.text }]}>
                            {item.name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => toggleFavoriteShop(item.id)}
                            style={styles.favoriteButton}
                          >
                            <MaterialCommunityIcons
                              name={favoriteShops.includes(item.id) ? "heart" : "heart-outline"}
                              size={20}
                              color={favoriteShops.includes(item.id) ? "#FF6B6B" : theme.textSecondary}
                            />
                          </TouchableOpacity>
                        </View>
                        {item.address && (
                          <Text style={[styles.shopAddress, { color: theme.textSecondary }]}>
                            {item.address}
                          </Text>
                        )}
                        {item.openingHours && (
                          <Text style={[styles.shopHours, { color: theme.textSecondary }]}>
                            🕐 {item.openingHours}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.shopItemRight}>
                      <View style={styles.distanceTimeContainer}>
                        <Text style={[styles.shopDistance, { color: theme.primary }]}>
                          {item.distance.toFixed(1)} km
                        </Text>
                        <Text style={[styles.travelTime, { color: theme.textSecondary }]}>
                          {estimateTravelTime(item.distance, 'walking')}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={[styles.shopSeparator, { backgroundColor: theme.border }]} />}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.noShopsContainer}>
                <MaterialCommunityIcons name="storefront-outline" size={64} color={theme.textSecondary} />
                <Text style={[styles.noShopsText, { color: theme.textSecondary }]}>
                  No grocery stores found nearby
                </Text>
                <Text style={[styles.noShopsSubtext, { color: theme.textSecondary }]}>
                  Try searching in a different area
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        {/* Clear Completed Button */}
        {shoppingList.some(item => item.isDone) && (
          <View style={styles.clearCompletedContainer}>
            <TouchableOpacity
              style={[styles.clearCompletedButton, { backgroundColor: theme.success + '15', borderColor: theme.success + '30' }]}
              onPress={() => {
                Alert.alert(
                  'Clear Completed Items',
                  'Are you sure you want to remove all completed items from your shopping list?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear', style: 'destructive', onPress: clearCompletedItems }
                  ]
                );
              }}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={16} color={theme.success} />
              <Text style={[styles.clearCompletedText, { color: theme.success }]}>
                Clear Completed ({shoppingList.filter(item => item.isDone).length})
              </Text>
            </TouchableOpacity>
          </View>
        )}
        
        {initialLoading ? (
          <View style={styles.listContainer}>
            <SkeletonSuggestionList />
            {[1, 2, 3, 4].map((i) => (
              <SkeletonShoppingItem key={i} theme={theme} />
            ))}
          </View>
        ) : (
          <FlatList
            ListHeaderComponent={<SuggestionList />}
            data={shoppingList.sort((a, b) => {
              // Show active items first, then completed items
              if (a.isDone && !b.isDone) return 1;
              if (!a.isDone && b.isDone) return -1;
              return 0;
            })}
            keyExtractor={item => item.id}
            renderItem={renderShoppingItem}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState />}
            ItemSeparatorComponent={({ item, index }) => {
              const activeItems = shoppingList.filter(item => !item.isDone);
              const completedItems = shoppingList.filter(item => item.isDone);
              
              // Show separator between active and completed sections
              if (index === activeItems.length - 1 && completedItems.length > 0) {
                return (
                  <View style={styles.sectionSeparator}>
                    <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
                    <Text style={[styles.separatorText, { color: theme.textSecondary }]}>
                      Completed Items
                    </Text>
                    <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
                  </View>
                );
              }
              
              return <View style={styles.separator} />;
            }}
          />
        )}
        
        {/* Floating Action Button */}
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.accent }]}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
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
  title: {
    // Remove fontSize, fontWeight, letterSpacing, marginBottom from here to avoid conflict
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  clearCompletedContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  clearCompletedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  clearCompletedText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  listContainer: {
    padding: 20,
    paddingTop: 24,
  },
  // Shopping list item styles
  shoppingListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  itemText: {
    flex: 1,
  },
  shoppingListItemName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  itemSubtext: {
    fontSize: 13,
    fontWeight: '500',
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginLeft: 12,
  },
  separator: {
    height: 12,
  },
  sectionSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Empty state styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 40,
  },
  // Enhanced suggestion styles
  suggestionContainer: {
    marginBottom: 24,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  suggestionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  suggestionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  suggestionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionList: {
    paddingBottom: 4,
  },
  suggestionCard: {
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionBadge: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 20,
  },
  suggestionDetails: {
    marginBottom: 12,
  },
  suggestionDetailText: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  addModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  addModalContent: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    padding: 24,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 18,
  },
  addModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  addModalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  // Bulk add styles
  inputModeToggle: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  singleInputContainer: {
    marginBottom: 20,
  },
  bulkInputContainer: {
    marginBottom: 20,
  },
  bulkInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  bulkInfoText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  bulkTextArea: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    maxHeight: 160,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  previewContainer: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewScroll: {
    maxHeight: 60,
  },
  previewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  previewTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  addModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addModalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Skeleton styles
  skeletonItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  skeletonItemName: {
    width: 100,
    height: 18,
    borderRadius: 4,
    marginBottom: 4,
  },
  skeletonItemSubtext: {
    width: 100,
    height: 13,
    borderRadius: 4,
  },
  skeletonRemoveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 12,
  },
  skeletonSuggestionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  skeletonSuggestionName: {
    width: 100,
    height: 18,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonSuggestionDetail: {
    width: '100%',
    height: 12,
    borderRadius: 4,
    marginBottom: 2,
  },
  skeletonAddButton: {
    width: 100,
    height: 32,
    borderRadius: 10,
    marginTop: 12,
  },

  // Shop locator modal styles
  shopModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  shopModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    minHeight: '50%',
  },
  shopModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  shopModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  shopItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  shopAddress: {
    fontSize: 14,
  },
  shopItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopDistance: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  shopSeparator: {
    height: 1,
    marginHorizontal: 16,
  },
  noShopsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noShopsText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noShopsSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Filter and suggestions styles
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    gap: 4,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  suggestionsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Enhanced shop item styles
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  favoriteButton: {
    padding: 4,
  },
  shopHours: {
    fontSize: 12,
    marginTop: 2,
  },
  distanceTimeContainer: {
    alignItems: 'flex-end',
  },
  travelTime: {
    fontSize: 11,
    marginTop: 2,
  },
});
