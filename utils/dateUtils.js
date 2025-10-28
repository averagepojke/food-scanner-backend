import { format } from 'date-fns';

export const toLocalDateKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getTodayKey = () => {
  const now = new Date();
  return toLocalDateKey(now);
};

export const formatDisplayDate = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00');
  return format(d, 'EEE, MMM d, yyyy');
};

export const formatShortDate = (dateStr) => {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  
  if (dateStr === toLocalDateKey(today)) {
    return 'Today';
  }
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (dateStr === toLocalDateKey(yesterday)) {
    return 'Yesterday';
  }
  
  return format(d, 'MMM d');
};

export const getCalorieStatus = (remainingCalories) => {
  if (remainingCalories > 500) {
    return {
      text: 'On track',
      color: '#2E7D32',
      backgroundColor: '#E8F5E9'
    };
  } else if (remainingCalories > 200) {
    return {
      text: 'Getting low',
      color: '#EF6C00',
      backgroundColor: '#FFF3E0'
    };
  } else if (remainingCalories > 0) {
    return {
      text: 'Very low',
      color: '#D32F2F',
      backgroundColor: '#FFEBEE'
    };
  } else {
    return {
      text: 'Goal reached',
      color: '#2E7D32',
      backgroundColor: '#E8F5E9'
    };
  }
};

export const getWeekDays = (startDate = new Date()) => {
  const days = [];
  const start = new Date(startDate);
  
  // Get Monday of the current week
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push({
      date: toLocalDateKey(date),
      dayName: format(date, 'EEE'),
      dayShort: format(date, 'E'),
      isToday: toLocalDateKey(date) === getTodayKey()
    });
  }
  
  return days;
};