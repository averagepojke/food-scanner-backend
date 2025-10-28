---
description: Repository Information Overview
alwaysApply: true
---

# Food Scanner App Information

## Summary
Food Scanner is a mobile application built with React Native and Expo that allows users to track expiry dates, scan barcodes, and manage their food inventory with AI-powered insights. The app includes features like barcode scanning, receipt scanning, meal planning, shopping lists, and subscription-based premium features.

## Structure
- **Root**: Main React Native app files and components
- **assets**: App icons, images, and splash screens
- **food-scanner-backend**: Express.js backend server for OCR and recipe services
- **__tests__**: Jest test files for security and error handling
- **.expo**: Expo configuration and cache files
- **.zencoder**: Rules and configuration for Zencoder

## Language & Runtime
**Language**: JavaScript (React Native)
**Version**: React Native 0.79.5, React 19.0.0, Expo SDK 53.0.16
**Build System**: Expo EAS
**Package Manager**: npm

## Dependencies
**Main Dependencies**:
- expo: ~53.0.16
- react-native: 0.79.5
- react: 19.0.0
- firebase: ^11.10.0
- @react-navigation/native: ^7.1.14
- @react-navigation/stack: ^7.4.2
- @react-navigation/drawer: ^7.5.2
- expo-barcode-scanner: ^13.0.1
- expo-camera: ~16.1.10
- @google-cloud/vision: ^5.3.1
- @google-cloud/documentai: ^9.3.0
- openai: ^5.10.1

**Development Dependencies**:
- jest: ^29.7.0
- jest-expo: ~51.0.4
- @testing-library/react-native: ^12.4.3
- @testing-library/jest-native: ^5.4.3

## Build & Installation
```bash
npm install
npm start
```

For mobile builds:
```bash
npm install -g eas-cli
eas build --platform ios
eas build --platform android
```

## Testing
**Framework**: Jest with React Native Testing Library
**Test Location**: `__tests__` directory
**Naming Convention**: `*.test.js`
**Configuration**: jest.config.js, jest.setup.js
**Run Command**:
```bash
npm test
npm run test:security
npm run test:auth
npm run test:coverage
```

## Backend Services
**Server**: Express.js
**APIs**: 
- Google Cloud Vision API for image recognition
- Google Document AI for receipt scanning
- OpenAI API for AI-powered insights
**Configuration**: Environment variables in .env files

## Mobile App Configuration
**iOS Bundle ID**: com.foodscanner.app
**Android Package**: com.foodscanner.app
**Expo Config**: app.json defines permissions, splash screens, and app metadata
**Build Profiles**: eas.json contains development, preview, and production build configurations

## Security Features
**Authentication**: Firebase authentication with multi-factor support
**Secure Storage**: expo-secure-store for sensitive data
**Biometric Auth**: Local authentication for app access
**Security Testing**: Dedicated security test suite and validation scripts