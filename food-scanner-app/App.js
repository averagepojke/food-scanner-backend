import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerContent } from './DrawerContent';
import { ShoppingListProvider, ShoppingListContext } from './ShoppingListContext';
import { NavigationDarkTheme, NavigationLightTheme } from './NavigationThemes';
import { AuthProvider, useAuth } from './AuthContext';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import { createStackNavigator } from '@react-navigation/stack';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props) {
  return <DrawerContent {...props} />;
}

const Stack = createStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function MainApp() {
  const { user } = useAuth();
  return user ? (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{ headerShown: true }}
      drawerContent={(props) => <CustomDrawerContent {...props} />}
    >
      {/* ... existing Drawer.Screen components ... */}
    </Drawer.Navigator>
  ) : (
    <AuthStack />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ShoppingListProvider>
        <ShoppingListContext.Consumer>
          {({ darkMode, isLoading }) => {
            if (isLoading) {
              return (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              );
            }
            return (
              <NavigationContainer theme={darkMode ? NavigationDarkTheme : NavigationLightTheme}>
                <MainApp />
              </NavigationContainer>
            );
          }}
        </ShoppingListContext.Consumer>
      </ShoppingListProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 18,
    color: '#333',
  },
}); 