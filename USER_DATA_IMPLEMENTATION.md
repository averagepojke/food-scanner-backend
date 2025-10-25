# User-Specific Data Implementation

This document describes the implementation of user-specific data storage for the Food Scanner App.

## Overview

The app now supports user-specific data storage, ensuring that each user's data (food inventory, shopping lists, meal plans, calorie logs, etc.) is isolated and private to their account.

## Key Components

### 1. Utility Functions (`utils.js`)

The core utility functions for user-specific storage:

- `getUserStorageKey(userId, key)`: Creates user-specific storage keys
- `getUserData(userId, key, defaultValue)`: Retrieves user-specific data
- `setUserData(userId, key, data)`: Saves user-specific data
- `removeUserData(userId, key)`: Removes specific user data
- `clearUserData(userId)`: Clears all data for a user (used during logout)
- `migrateToUserStorage(userId, oldKey, newKey)`: Migrates existing data to user-specific storage

### 2. Authentication Context (`food-scanner-app/AuthContext.js`)

Updated to include:
- `userId`: Current user's unique identifier
- Standard `logout()` function that preserves user data for future logins

### 3. Updated Components

All major components now use user-specific storage:

#### ShoppingListContext (App.js)
- Food inventory
- Shopping lists
- Spending history
- Dark mode preference
- Accent key preference

#### Gamification (Gamification.js)
- Achievements
- Points
- Streaks
- Challenges
- Statistics
- Last login date

#### Calorie Counter (Calorie.js)
- Daily consumed foods
- Calorie logs per date

#### Meal Maker (MealMaker.js)
- User-created meals
- Custom recipes

#### Meal Planner (MealPlanner.js)
- Meal plans
- User meals (shared with MealMaker)

## Data Migration

The implementation includes automatic data migration:

1. When a user logs in, the system checks for existing non-user-specific data
2. If found, it migrates the data to user-specific storage
3. The old data is then removed to prevent conflicts

## Storage Key Format

User-specific data is stored with keys in the format:
```
user_{userId}_{dataKey}
```

Examples:
- `user_abc123_foodInventory`
- `user_abc123_shoppingList`
- `user_abc123_achievements`

## Fallback Support

For non-authenticated users, the app falls back to the original non-user-specific storage to maintain functionality.

## Testing

A test component (`UserDataTest.js`) is included to verify:
- Data isolation between users
- Proper data migration
- Data persistence across login sessions

## Security Considerations

- User data is isolated by user ID
- Data persists across login sessions
- No cross-user data access
- Fallback to non-user-specific storage for non-authenticated users

## Usage Examples

### Saving User Data
```javascript
import { setUserData } from './utils';
import { useAuth } from './food-scanner-app/AuthContext';

const { userId } = useAuth();
await setUserData(userId, 'foodInventory', inventoryData);
```

### Loading User Data
```javascript
import { getUserData } from './utils';
import { useAuth } from './food-scanner-app/AuthContext';

const { userId } = useAuth();
const data = await getUserData(userId, 'foodInventory', []);
```

### Migrating Existing Data
```javascript
import { migrateToUserStorage } from './utils';

await migrateToUserStorage(userId, 'oldKey', 'newKey');
```

## Benefits

1. **Data Privacy**: Each user's data is completely isolated
2. **Multi-User Support**: Multiple users can use the same device
3. **Data Persistence**: User data persists across app sessions
4. **Automatic Migration**: Existing users' data is automatically migrated
5. **Backward Compatibility**: Non-authenticated users still have full functionality 