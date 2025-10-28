// Utility functions for food expiry prediction

// Categories with smart expiry prediction
export const CATEGORY_EXPIRY_DAYS = {
  dairy: 7,
  meat: 3,
  fish: 2,
  vegetables: 5,
  fruits: 4,
  bread: 3,
  'canned-goods': 365,
  'dry-goods': 180,
  beverages: 30,
  frozen: 90,
  default: 7
};

// Predict expiry date based on category
export const predictExpiryDate = (category, customDays = null) => {
  const days = customDays || CATEGORY_EXPIRY_DAYS[category] || CATEGORY_EXPIRY_DAYS.default;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);
  return expiryDate.toISOString().split('T')[0];
}; 