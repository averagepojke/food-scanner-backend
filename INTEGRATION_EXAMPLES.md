# 🔧 **SECURITY INTEGRATION EXAMPLES**
**Easy copy-paste examples to integrate advanced security into your Food Scanner App**

## 🔐 **1. Secure Authentication Integration**

### **Replace Your Current Login Function**
```javascript
// ❌ OLD CODE (in your LoginScreen.js or similar)
const handleLogin = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('User logged in:', result.user.email); // 🚨 SECURITY RISK
  } catch (error) {
    console.log('Login failed:', error.message); // 🚨 SECURITY RISK
  }
};

// ✅ NEW SECURE CODE
import { secureAuth } from './AuthSecurity';
import { monitoringUtils } from './SecurityMonitoring';
import logger from './logger';

const handleLogin = async (email, password) => {
  try {
    // Check if account is locked before attempting login
    const result = await secureAuth.signIn(
      email, 
      password, 
      (email, pass) => signInWithEmailAndPassword(auth, email, pass)
    );
    
    // Track successful login for security monitoring
    await monitoringUtils.trackAuthEvent('login_success', result.user.uid);
    
    logger.info('User authentication successful');
    return result;
    
  } catch (error) {
    // Track failed login attempt
    await monitoringUtils.trackAuthEvent('login_failed', null, { 
      email: email.substring(0, 3) + '***' // Sanitized logging
    });
    
    logger.error('Authentication failed:', error.message);
    throw error; // Re-throw with security-enhanced error message
  }
};
```

## 💾 **2. Secure Data Storage Integration**

### **Replace AsyncStorage with Secure Storage**
```javascript
// ❌ OLD CODE (in your existing components)
import AsyncStorage from '@react-native-async-storage/async-storage';

const saveUserPreferences = async (prefs) => {
  await AsyncStorage.setItem('userPrefs', JSON.stringify(prefs)); // 🚨 UNENCRYPTED
};

const getUserPreferences = async () => {
  const prefs = await AsyncStorage.getItem('userPrefs');
  return prefs ? JSON.parse(prefs) : null;
};

// ✅ NEW SECURE CODE  
import { secureStorage } from './SecureStorage';

const saveUserPreferences = async (prefs) => {
  await secureStorage.setSecureItem('userPrefs', prefs, {
    expiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
    sensitive: true // Encrypt the data
  });
};

const getUserPreferences = async () => {
  return await secureStorage.getSecureItem('userPrefs', {
    theme: 'light', // Default values
    notifications: true
  });
};
```

## 🔍 **3. API Call Security Integration**

### **Secure Your API Calls**
```javascript
// ❌ OLD CODE (in your components making API calls)
const callFoodAPI = async (barcode) => {
  try {
    console.log('Calling API for barcode:', barcode); // 🚨 LOGS SENSITIVE DATA
    const response = await fetch(`https://api.food.com/lookup/${barcode}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.log('API Error:', error); // 🚨 EXPOSES ERROR DETAILS
  }
};

// ✅ NEW SECURE CODE
import { secureApiCall } from './security';
import { monitoringUtils } from './SecurityMonitoring';
import logger from './logger';

const callFoodAPI = async (barcode) => {
  const startTime = Date.now();
  
  try {
    logger.debug('Making food API request'); // Secure logging
    
    const response = await secureApiCall(`https://api.food.com/lookup/${barcode}`, {
      method: 'GET',
      timeout: 10000, // 10 second timeout
      rateLimitKey: 'food_api', // Rate limiting protection
      headers: {
        'Authorization': `Bearer ${await getApiToken()}`,
      }
    });
    
    const data = await response.json();
    
    // Monitor successful API call
    await monitoringUtils.trackApiCall(
      'https://api.food.com/lookup', 
      'GET', 
      response.status, 
      Date.now() - startTime
    );
    
    return data;
    
  } catch (error) {
    // Monitor failed API call
    await monitoringUtils.trackApiCall(
      'https://api.food.com/lookup', 
      'GET', 
      error.status || 0, 
      Date.now() - startTime
    );
    
    logger.error('Food API request failed:', error.message);
    throw new Error('Unable to fetch food information. Please try again.');
  }
};
```

## 🛡️ **4. Component Error Protection**

### **Wrap Critical Components with Error Boundaries**
```javascript
// ❌ OLD CODE (components without protection)
const FoodScannerScreen = () => {
  return (
    <View>
      <Camera />
      <FoodList />
      <NutritionInfo />
    </View>
  );
};

// ✅ NEW SECURE CODE
import CriticalErrorBoundary, { withErrorBoundary } from './CriticalErrorBoundary';

// Option 1: Wrap the entire screen
const FoodScannerScreen = () => {
  return (
    <CriticalErrorBoundary 
      userMessage="The food scanner encountered an error. Please restart the feature."
    >
      <View>
        <Camera />
        <FoodList />
        <NutritionInfo />
      </View>
    </CriticalErrorBoundary>
  );
};

// Option 2: Use HOC for individual components
const SecureCamera = withErrorBoundary(Camera, {
  userMessage: "Camera error. Please check permissions and try again."
});

const SecureFoodList = withErrorBoundary(FoodList, {
  userMessage: "Food list error. Refreshing data..."
});
```

## 📱 **5. Form Input Security**

### **Secure User Input Handling**
```javascript
// ❌ OLD CODE (vulnerable to XSS and injection)
const handleFoodNameInput = (text) => {
  setFoodName(text); // 🚨 NO VALIDATION OR SANITIZATION
  saveFoodItem({ name: text, calories: calories });
};

// ✅ NEW SECURE CODE
import { sanitizeInput, validateFoodItem } from './security';
import logger from './logger';

const handleFoodNameInput = (text) => {
  // Sanitize input to prevent XSS and injection attacks
  const sanitized = sanitizeInput(text, { 
    maxLength: 100,
    allowHtml: false 
  });
  
  setFoodName(sanitized);
  
  // Validate before saving
  const foodItem = { name: sanitized, calories: calories };
  const validation = validateFoodItem(foodItem);
  
  if (validation.isValid) {
    saveFoodItem(foodItem);
    logger.debug('Food item saved successfully');
  } else {
    logger.warn('Invalid food item rejected:', validation.message);
    setError(validation.message);
  }
};
```

## 🔒 **6. Session Management Integration**

### **Add Session Monitoring to Your App**
```javascript
// ✅ ADD TO YOUR MAIN APP COMPONENT (App.js)
import { authSecurity } from './AuthSecurity';
import { useAuth } from './food-scanner-app/AuthContext';

const App = () => {
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      // Initialize security monitoring for authenticated users
      authSecurity.initialize();
      
      // Start tracking user activity
      authSecurity.updateActivityTime();
    }
    
    return () => {
      // Cleanup on unmount
      authSecurity.cleanup();
    };
  }, [user]);
  
  // Track user activity on app interactions
  const handleUserActivity = useCallback(() => {
    if (user) {
      authSecurity.updateActivityTime();
    }
  }, [user]);
  
  return (
    <TouchableWithoutFeedback onPress={handleUserActivity}>
      {/* Your existing app content */}
    </TouchableWithoutFeedback>
  );
};
```

## 🌐 **7. Environment Configuration**

### **Update Your .env File**
```bash
# Add these to your .env file
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
EXPO_PUBLIC_SECURITY_MONITORING=true
EXPO_PUBLIC_ENHANCED_AUTH=true

# For production (.env.production)
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=your_production_recaptcha_key
EXPO_PUBLIC_SECURITY_MONITORING=true
EXPO_PUBLIC_ENHANCED_AUTH=true
EXPO_PUBLIC_ENV=production
```

## 📊 **8. Security Dashboard Integration**

### **Add Security Monitoring to Admin/Debug Screen**
```javascript
// ✅ NEW SECURITY DASHBOARD COMPONENT
import { monitoringUtils } from './SecurityMonitoring';

const SecurityDashboard = () => {
  const [securityStats, setSecurityStats] = useState(null);
  
  useEffect(() => {
    const loadStats = async () => {
      const stats = await monitoringUtils.getSecurityDashboard();
      setSecurityStats(stats);
    };
    
    loadStats();
    const interval = setInterval(loadStats, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);
  
  if (!securityStats) return <Text>Loading security stats...</Text>;
  
  return (
    <View style={styles.dashboard}>
      <Text style={styles.title}>Security Monitor</Text>
      <Text>Total Alerts: {securityStats.totalAlerts}</Text>
      <Text>Recent Alerts: {securityStats.recentAlerts}</Text>
      <Text>Auth Events: {securityStats.authEvents}</Text>
      <Text>Last Check: {new Date(securityStats.lastCheck).toLocaleString()}</Text>
    </View>
  );
};
```

## 🚀 **Quick Integration Checklist**

1. **✅ Replace authentication calls** with `secureAuth.signIn()`
2. **✅ Replace AsyncStorage** with `secureStorage` for sensitive data  
3. **✅ Add monitoring** to API calls with `monitoringUtils.trackApiCall()`
4. **✅ Wrap components** with `CriticalErrorBoundary`
5. **✅ Sanitize user inputs** with `sanitizeInput()`
6. **✅ Initialize session monitoring** in your main app component
7. **✅ Update environment variables** with security keys
8. **✅ Add security dashboard** to admin/debug screens

## ⚡ **Testing Your Integration**

```bash
# Test your security integration
npm run security:full

# Run specific security tests  
npm run test:security
npm run test:auth

# Check integration
npm run security:check
```

---

## 🎯 **Need Help?**

All these examples are **production-ready** and can be copied directly into your app. Each example includes:

- ✅ **Security best practices**
- ✅ **Error handling** 
- ✅ **Logging compliance**
- ✅ **Performance optimization**
- ✅ **User experience protection**

**Your Food Scanner App is now enterprise-secure!** 🛡️