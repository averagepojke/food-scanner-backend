import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Compact buttons for meal cards
const CompactMealButtons = ({ meal, theme, showMissing, onAddMissing, onPlan }) => {
  return (
    <View style={styles.container}>
      {showMissing && onAddMissing && meal.missingIngredients && meal.missingIngredients.length > 0 && (
        <TouchableOpacity 
          style={[styles.addMissingButton, { backgroundColor: theme.accent }]} 
          onPress={onAddMissing} 
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="playlist-plus" size={10} color="#fff" />
          <Text style={styles.addMissingText}>Add {meal.missingIngredients.length}</Text>
        </TouchableOpacity>
      )}
      {onPlan && (
        <TouchableOpacity 
          style={[styles.planButton, { backgroundColor: theme.primary }]} 
          onPress={onPlan} 
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="calendar-plus" size={10} color="#fff" />
          <Text style={styles.planButtonText}>Plan</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  addMissingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
    minWidth: 40,
    maxWidth: 100,
  },
  addMissingText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0,
    minWidth: 40,
    maxWidth: 60,
  },
  planButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default CompactMealButtons;