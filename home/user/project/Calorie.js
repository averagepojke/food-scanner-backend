// Replace the problematic useEffect with this corrected version
useEffect(() => {
  let isMounted = true; // Prevent state updates if component unmounts
  
  const loadConsumedFoodsForDate = async (dateKey) => {
    console.log('🔄 Loading consumed foods for date:', dateKey, 'userId:', userId);
    
    try {
      setIsLoadingData(true);
      setCalorieDataLoaded(false);
      
      let stored = [];
      
      if (userId) {
        // Migrate existing data to user-specific storage
        await migrateToUserStorage(userId, `consumedFoods-${dateKey}`, `consumedFoods-${dateKey}`);
        stored = await getUserData(userId, `consumedFoods-${dateKey}`, []);
        console.log('📱 Loaded from user storage:', stored.length, 'items for', dateKey);
      } else {
        const data = await AsyncStorage.getItem(`consumedFoods-${dateKey}`);
        if (data) {
          stored = JSON.parse(data);
          console.log('💾 Loaded from fallback storage:', stored.length, 'items for', dateKey);
        } else {
          console.log('📭 No data found for date:', dateKey);
        }
      }
      
      // Only update state if component is still mounted and this is for the current logDate
      if (isMounted && dateKey === logDate) {
        setConsumedFoods(stored);
        setCalorieDataLoaded(true);
        console.log('✅ Successfully loaded', stored.length, 'consumed foods for', dateKey);
      }
    } catch (error) {
      console.warn('❌ Failed to load consumed foods for', dateKey, error);
      if (isMounted && dateKey === logDate) {
        setConsumedFoods([]);
        setCalorieDataLoaded(true);
      }
    } finally {
      if (isMounted && dateKey === logDate) {
        setIsLoadingData(false);
      }
    }
  };

  loadConsumedFoodsForDate(logDate);
  
  return () => {
    isMounted = false;
  };
}, [logDate, userId]);

// Update the saving effect to be more precise
useEffect(() => {
  const saveConsumedFoods = async () => {
    // Don't save during initial loading or if data hasn't been loaded yet
    if (!calorieDataLoaded || isLoadingData) {
      console.log('⏳ Skipping save - data not ready for date:', logDate);
      return;
    }

    const storageKey = `consumedFoods-${logDate}`;
    console.log('💾 Saving consumed foods for date:', logDate, 'count:', consumedFoods.length);

    try {
      if (userId) {
        await setUserData(userId, storageKey, consumedFoods);
        console.log('✅ Saved to user storage:', storageKey, 'count:', consumedFoods.length);
      } else {
        await AsyncStorage.setItem(storageKey, JSON.stringify(consumedFoods));
        console.log('✅ Saved to fallback storage:', storageKey, 'count:', consumedFoods.length);
      }
    } catch (error) {
      console.warn('❌ Failed to save consumed foods for', logDate, error);
    }
  };

  saveConsumedFoods();
}, [consumedFoods, logDate, userId, calorieDataLoaded, isLoadingData]);

// Add a function to change dates with proper animation and data loading
const changeDate = useCallback((direction) => {
  const currentDate = new Date(logDate);
  const newDate = new Date(currentDate);
  newDate.setDate(currentDate.getDate() + direction);
  
  const newDateKey = formatDateKey(newDate);
  const todayKey = getTodayKey();
  
  // Set swipe direction for animation
  swipeDirection.current = direction;
  
  // Update date state
  setLogDate(newDateKey);
  setIsToday(newDateKey === todayKey);
  
  console.log('📅 Changed date from', logDate, 'to', newDateKey, 'direction:', direction);
}, [logDate]);

// Add navigation buttons to your date header
const DateNavigationHeader = () => (
  <View style={[styles.dateNavHeader, { backgroundColor: theme.surface }]}>
    <TouchableOpacity 
      style={styles.dateNavButton} 
      onPress={() => changeDate(-1)}
    >
      <MaterialCommunityIcons name="chevron-left" size={24} color={theme.primary} />
    </TouchableOpacity>
    
    <View style={styles.dateNavCenter}>
      <Text style={[styles.dateNavText, { color: theme.text }]}>
        {formatDisplayDate(logDate)}
      </Text>
      {isToday && (
        <Text style={[styles.todayIndicator, { color: theme.primary }]}>Today</Text>
      )}
    </View>
    
    <TouchableOpacity 
      style={styles.dateNavButton} 
      onPress={() => changeDate(1)}
    >
      <MaterialCommunityIcons name="chevron-right" size={24} color={theme.primary} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  // ... existing styles
  
  dateNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  
  dateNavButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  
  dateNavCenter: {
    alignItems: 'center',
  },
  
  dateNavText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  todayIndicator: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});

return (
  <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
    {/* Header */}
    <View style={[styles.header, { backgroundColor: theme.surface }]}>
      {/* ... existing header content */}
    </View>

    {/* Add Date Navigation */}
    <DateNavigationHeader />

    {/* Rest of your component */}
    {/* ... */}
  </SafeAreaView>
);