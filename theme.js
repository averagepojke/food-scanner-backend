// Theme configuration and utilities
// Separated from Profile.js to avoid circular dependencies

const ACCENT_COLORS = [
  { key: 'default', label: 'Default', color: '#3B82F6' },
  { key: 'blue', label: 'Blue', color: '#3B82F6' },
  { key: 'green', label: 'Green', color: '#10B981' },
  { key: 'pink', label: 'Pink', color: '#EC4899' },
  { key: 'purple', label: 'Purple', color: '#8B5CF6' },
  { key: 'orange', label: 'Orange', color: '#F59E0B' },
];

export function getTheme(accentKey = 'default', darkMode = false) {
  let accent;
  if (!accentKey || accentKey === 'default') {
    accent = ACCENT_COLORS[0]; // Default blue
  } else {
    accent = ACCENT_COLORS.find(c => c.key === accentKey) || ACCENT_COLORS[0];
  }
  
  if (!darkMode) {
    return {
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#1E293B',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      primary: accent.color,
      primaryLight: '#DBEAFE',
      secondary: '#10B981',
      secondaryLight: '#D1FAE5',
      accent: accent.color,
      accentLight: '#FEF3C7',
      error: '#EF4444',
      warning: '#F59E0B',
      success: '#10B981',
      overlay: 'rgba(15, 23, 42, 0.05)',
      statusBar: 'dark-content',
      gradient: [accent.color, '#1D4ED8'],
      cardShadow: 'rgba(15, 23, 42, 0.08)',
    };
  } else {
    return {
      background: '#0F172A',
      surface: '#1E293B',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
      border: '#334155',
      primary: accent.color,
      primaryLight: '#1E3A8A',
      secondary: '#34D399',
      secondaryLight: '#064E3B',
      accent: accent.color,
      accentLight: '#92400E',
      error: '#F87171',
      warning: '#FBBF24',
      success: '#34D399',
      overlay: 'rgba(248, 250, 252, 0.05)',
      statusBar: 'light-content',
      gradient: [accent.color, '#3B82F6'],
      cardShadow: 'rgba(0, 0, 0, 0.25)',
    };
  }
}

export { ACCENT_COLORS };
