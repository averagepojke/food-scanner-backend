
// Update the meal plan saving effect to be more robust
useEffect(() => {
  const saveMealPlan = async () => {
    try {
      if (userId) {
        await setUserData(userId, 'mealPlan', mealPlan);
        console.log('✅ Meal plan saved for user:', userId, 'entries:', Object.keys(mealPlan).length);
      } else {
        await AsyncStorage.setItem('mealPlan', JSON.stringify(mealPlan));
        console.log('✅ Meal plan saved to fallback storage, entries:', Object.keys(mealPlan).length);
      }
    } catch (e) {
      console.warn('❌ Failed to save meal plan to storage', e);
    }
  };

  // Only save if mealPlan has been loaded (not empty initial state)
  if (Object.keys(mealPlan).length > 0) {
    saveMealPlan();
  }
}, [mealPlan, userId]);

// Update the addMealToPlan function to use weekTab instead of currentWeek
const addMealToPlan = useCallback((dayIndex, mealType, recipe) => {
  const key = `${weekTab}-${dayIndex}-${mealType}`;
  console.log('Adding meal to plan with key:', key, 'recipe:', recipe.name);
  setMealPlan(prev => ({
    ...prev,
    [key]: recipe
  }));
  setSelectedMeal(null);
}, [weekTab]);

// Update removeMealFromPlan to use weekTab
const removeMealFromPlan = useCallback((dayIndex, mealType) => {
  Alert.alert(
    "Remove Meal",
    "Are you sure you want to remove this meal from your plan?",
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Remove", 
        style: "destructive",
        onPress: () => {
          const key = `${weekTab}-${dayIndex}-${mealType}`;
          console.log('Removing meal from plan with key:', key);
          setMealPlan(prev => {
            const newPlan = { ...prev };
            delete newPlan[key];
            return newPlan;
          });
        }
      }
    ]
  );
}, [weekTab]);

// Update the meal rendering to use weekTab
{mealTypes.map((mealType) => {
  const key = `${weekTab}-${currentDay}-${mealType}`;
  const plannedMeal = mealPlan[key];
  // ... rest of the rendering logic
})}
