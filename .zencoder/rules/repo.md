---
description: Repository Information Overview
alwaysApply: true
---

# Repository Information Overview

## Repository Summary
PantryPal is a comprehensive food management mobile application built with React Native and Expo. The repository contains both the mobile app frontend and a Node.js Express backend service for receipt scanning, recipe search, and AI-powered meal suggestions.

## Repository Structure
- **Root**: Main React Native app files and components
- **assets**: App icons, images, and splash screens
- **components**: Reusable UI components
- **food-scanner-backend**: Express.js backend server for OCR and recipe services
- **__tests__**: Jest test files for security and error handling
- **hooks**: Custom React hooks for data management
- **recipes**: Recipe data and utilities
- **utils**: Utility functions and helpers

### Main Repository Components
- **Mobile App**: React Native/Expo application for iOS and Android
- **Backend API**: Express.js server for OCR, recipe search, and AI features
- **Security Framework**: Comprehensive security testing and validation

## Projects

### Mobile App (PantryPal)
**Configuration File**: package.json, app.json

#### Language & Runtime
**Language**: JavaScript (React Native)
**Version**: React Native 0.81.4, React 19.1.0, Expo SDK 54.0.4
**Build System**: Expo EAS
**Package Manager**: npm

#### Dependencies
**Main Dependencies**:
- expo: 54.0.4
- react-native: 0.81.4
- react: 19.1.0
- firebase: ^11.10.0
- @react-navigation/native: ^7.1.14
- @react-navigation/stack: ^7.4.2
- expo-barcode-scanner: ^13.0.1
- expo-camera: ~17.0.7
- expo-secure-store: ~15.0.7
- expo-local-authentication: ~17.0.7

**Development Dependencies**:
- jest: ^29.7.0
- jest-expo: ~54.0.11
- @testing-library/react-native: ^12.4.3

#### Build & Installation
```bash
npm install
npm start
```

For production builds:
```bash
npm install -g eas-cli
eas build --platform ios --profile production
eas build --platform android --profile production
```

#### Testing
**Framework**: Jest with React Native Testing Library
**Test Location**: `__tests__` directory
**Naming Convention**: `*.test.js`
**Run Command**:
```bash
npm test
npm run test:security
npm run test:auth
```

### Backend API (Food Scanner Backend)
**Configuration File**: food-scanner-backend/package.json

#### Language & Runtime
**Language**: JavaScript (Node.js)
**Version**: Node.js 18+ (specified in engines)
**Framework**: Express.js 5.1.0
**Package Manager**: npm

#### Dependencies
**Main Dependencies**:
- express: ^5.1.0
- @google-cloud/documentai: ^9.3.0
- @google-cloud/vision: ^5.3.1
- openai: ^5.10.1
- cors: ^2.8.5
- dotenv: ^17.2.2
- firebase-admin: ^13.5.0

**Development Dependencies**:
- nodemon: ^3.0.0

#### Build & Installation
```bash
cd food-scanner-backend
npm install
npm start
```

#### Docker
**Dockerfile**: food-scanner-backend/Dockerfile
**Image**: Node.js 18 Alpine
**Configuration**: Exposes port 3001, runs as non-root user

```bash
cd food-scanner-backend
docker build -t food-scanner-backend .
docker run -p 3001:3001 food-scanner-backend
```

#### Deployment
**Platform**: Railway (recommended)
**Command**:
```bash
cd food-scanner-backend
./deploy.sh
```

## Mobile App Features
**Core Functionality**:
- Barcode scanning for food items
- Receipt scanning and parsing
- Food inventory management with expiry tracking
- Shopping list creation and management
- Meal planning and recipe suggestions
- Calorie and nutrition tracking
- User authentication and profile management
- Premium subscription features

**Security Features**:
- Firebase authentication with multi-factor support
- Secure storage for sensitive data
- Biometric authentication
- Comprehensive security testing suite
- Offline data persistence
- Network security monitoring

## Backend API Endpoints
**Main Services**:
- Receipt OCR & Parsing (Google Document AI)
- Recipe Search (Spoonacular, TheMealDB)
- Food Database (Open Food Facts)
- AI Meal Suggestions (OpenAI)
- Support System

**Configuration**:
- Environment variables in .env files
- Google Cloud service account credentials
- API keys for third-party services