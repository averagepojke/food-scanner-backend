import React from 'react';
import { View, StyleSheet } from 'react-native';
import ShelfLifePaywall from './ShelfLifePaywall';

export default function TestShelfLifePaywall() {
  return (
    <View style={styles.container}>
      <ShelfLifePaywall />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});