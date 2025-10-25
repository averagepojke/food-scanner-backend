import { StyleSheet } from 'react-native';

export const calorieStyles = StyleSheet.create({
  // Essential styles that are referenced in the component
  progressTextSvg: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caloriesNumber: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  caloriesLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressPercentage: {
    fontSize: 10,
    fontWeight: '500',
  },
  emptyChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyChartText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyChartSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  macroChartContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  macroChartTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  pieChartWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  macroLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  macroLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  macroLegendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  macroLegendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  quickMacroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  quickMacroItem: {
    alignItems: 'center',
  },
  quickMacroValue: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickMacroLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  quickAddSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  quickAddRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAddButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  quickAddText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  compactProgressCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 20,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressLeft: {
    flex: 1,
  },
  progressRight: {
    flex: 1,
    alignItems: 'center',
  },
  compactGoalButton: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
});