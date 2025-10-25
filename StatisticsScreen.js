import React, { useContext, useMemo, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet,  
  TouchableOpacity, 
  Dimensions,
  RefreshControl,
  Alert,
  Animated
} from 'react-native';
import { ShoppingListContext } from './App';
import { getTheme } from './theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { SafeAreaView} from 'react-native-safe-area-context';
const { width: screenWidth } = Dimensions.get('window');

const TIMEFRAMES = [
  { key: '7', label: '7D', days: 7 },
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 }
];

export default function StatisticsScreen() {
  const { foodInventory, shoppingList, spendingHistory, darkMode, accentKey } = useContext(ShoppingListContext);
  const theme = getTheme(accentKey, darkMode);
  const [selectedTimeframe, setSelectedTimeframe] = useState('30');
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const formatCurrency = useCallback((amount) => `£${amount.toFixed(2)}`, []);
  const formatPercent = useCallback((value) => `${value.toFixed(1)}%`, []);

  const statistics = useMemo(() => {
    const timeframeDays = parseInt(selectedTimeframe);
    const cutoffDate = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000);
    const today = new Date();
    
    // Enhanced inventory analysis
    const inventoryAnalysis = foodInventory.reduce((acc, item) => {
      const expiry = new Date(item.expiry);
      const daysLeft = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      const quantity = item.quantity || 1;
      
      acc.totalItems++;
      acc.totalQuantity += quantity;
      acc.totalValue += (item.price || 0) * quantity;
      
      if (daysLeft <= 0) {
        acc.expired.count++;
        acc.expired.value += (item.price || 0) * quantity;
      } else if (daysLeft <= 3) {
        acc.expiringSoon.count++;
        acc.expiringSoon.value += (item.price || 0) * quantity;
      } else if (daysLeft <= 7) {
        acc.expiringWeek.count++;
        acc.expiringWeek.value += (item.price || 0) * quantity;
      } else {
        acc.fresh.count++;
        acc.fresh.value += (item.price || 0) * quantity;
      }
      
      return acc;
    }, {
      totalItems: 0,
      totalQuantity: 0,
      totalValue: 0,
      expired: { count: 0, value: 0 },
      expiringSoon: { count: 0, value: 0 },
      expiringWeek: { count: 0, value: 0 },
      fresh: { count: 0, value: 0 }
    });

    // Smart spending analysis with trends
    const recentSpending = spendingHistory.filter(item => 
      new Date(item.dateSpent) >= cutoffDate
    ).sort((a, b) => new Date(b.dateSpent) - new Date(a.dateSpent));

    const spendingByDay = {};
    const spendingByCategory = {};
    let totalSpent = 0;
    let totalItems = 0;

    recentSpending.forEach(item => {
      const amount = item.price * (item.quantity || 1);
      const category = item.category || 'Other';
      
      totalSpent += amount;
      totalItems += item.quantity || 1;
      
      spendingByCategory[category] = (spendingByCategory[category] || 0) + amount;
      
      if (!spendingByDay[item.dateSpent]) {
        spendingByDay[item.dateSpent] = 0;
      }
      spendingByDay[item.dateSpent] += amount;
    });

    // Generate daily spending chart data (last 7 days)
    const chartData = [];
    const chartLabels = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const amount = spendingByDay[dateStr] || 0;
      
      chartData.push(amount);
      chartLabels.push(date.toLocaleDateString('en-GB', { 
        weekday: 'short',
        day: 'numeric'
      }));
    }

    // Calculate trends and insights
    const avgDailySpend = totalSpent / timeframeDays;
    const avgItemCost = totalItems > 0 ? totalSpent / totalItems : 0;
    const wasteRate = inventoryAnalysis.totalItems > 0 
      ? (inventoryAnalysis.expired.count / inventoryAnalysis.totalItems) * 100 
      : 0;
    const wasteValue = inventoryAnalysis.expired.value;

    // Smart recommendations
    const recommendations = [];
    if (wasteRate > 10) {
      recommendations.push({
        icon: 'alert-circle',
        text: `${formatPercent(wasteRate)} food waste - consider buying smaller quantities`,
        color: '#FF5722'
      });
    }
    if (inventoryAnalysis.expiringSoon.count > 0) {
      recommendations.push({
        icon: 'clock-alert',
        text: `${inventoryAnalysis.expiringSoon.count} items expiring soon - use them first!`,
        color: '#FF9800'
      });
    }
    if (avgDailySpend > 20) {
      recommendations.push({
        icon: 'trending-up',
        text: `High daily spend (${formatCurrency(avgDailySpend)}) - review your budget`,
        color: '#2196F3'
      });
    }
    if (shoppingList.length === 0 && inventoryAnalysis.totalItems < 5) {
      recommendations.push({
        icon: 'cart-plus',
        text: 'Low inventory - time to go shopping!',
        color: '#4CAF50'
      });
    }

    return {
      inventory: inventoryAnalysis,
      spending: {
        total: totalSpent,
        avgDaily: avgDailySpend,
        avgPerItem: avgItemCost,
        transactions: recentSpending.length,
        chartData,
        chartLabels,
        byCategory: spendingByCategory
      },
      insights: {
        wasteRate,
        wasteValue,
        recommendations,
        totalSavings: inventoryAnalysis.totalValue - wasteValue,
        efficiency: inventoryAnalysis.totalItems > 0 
          ? ((inventoryAnalysis.fresh.count + inventoryAnalysis.expiringWeek.count) / inventoryAnalysis.totalItems) * 100 
          : 0
      },
      recentPurchases: recentSpending.slice(0, 8)
    };
  }, [foodInventory, shoppingList, spendingHistory, selectedTimeframe]);

  const chartConfig = useMemo(() => ({
    backgroundColor: 'transparent',
    backgroundGradientFrom: theme.surface,
    backgroundGradientTo: theme.surface,
    decimalPlaces: 0,
    color: (opacity = 1) => {
      const rgb = theme.primary.replace('#', '').match(/.{2}/g).map(hex => parseInt(hex, 16));
      return `rgba(${rgb.join(', ')}, ${opacity})`;
    },
    labelColor: (opacity = 0.8) => {
      const rgb = theme.textSecondary.replace('#', '').match(/.{2}/g).map(hex => parseInt(hex, 16));
      return `rgba(${rgb.join(', ')}, ${opacity})`;
    },
    strokeWidth: 3,
    barPercentage: 0.7,
    fillShadowGradient: theme.primary,
    fillShadowGradientOpacity: 0.3,
    propsForBackgroundLines: {
      strokeDasharray: "5,5",
      stroke: theme.textSecondary,
      strokeOpacity: 0.2
    }
  }), [theme]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const MetricCard = ({ icon, value, label, subtitle, color, trend, onPress }) => (
    <TouchableOpacity 
      style={[styles.metricCard, { backgroundColor: theme.surface }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.metricHeader}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        {trend && (
          <MaterialCommunityIcons 
            name={trend > 0 ? 'trending-up' : 'trending-down'} 
            size={16} 
            color={trend > 0 ? '#4CAF50' : '#F44336'} 
          />
        )}
      </View>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>{label}</Text>
      {subtitle && (
        <Text style={[styles.metricSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      )}
    </TouchableOpacity>
  );

  const RecommendationCard = ({ icon, text, color }) => (
    <View style={[styles.recommendationCard, { backgroundColor: `${color}10`, borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text style={[styles.recommendationText, { color: theme.text }]}>{text}</Text>
    </View>
  );

  const PurchaseItem = ({ item, index }) => (
    <View style={[styles.purchaseItem, { backgroundColor: theme.surface }]}>
      <View style={styles.purchaseLeft}>
        <View style={[styles.purchaseIcon, { backgroundColor: `${theme.primary}15` }]}>
          <MaterialCommunityIcons name="shopping" size={16} color={theme.primary} />
        </View>
        <View style={styles.purchaseDetails}>
          <Text style={[styles.purchaseName, { color: theme.text }]}>{item.name}</Text>
          <Text style={[styles.purchaseDate, { color: theme.textSecondary }]}>
            {new Date(item.dateSpent).toLocaleDateString('en-GB', { 
              month: 'short', 
              day: 'numeric' 
            })}
            {item.quantity > 1 && ` • ${item.quantity}x`}
          </Text>
        </View>
      </View>
      <Text style={[styles.purchaseAmount, { color: theme.primary }]}>
        {formatCurrency(item.price * (item.quantity || 1))}
      </Text>
    </View>
  );

  if (statistics.inventory.totalItems === 0 && statistics.spending.transactions === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
          <MaterialCommunityIcons name="chart-box-outline" size={80} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Ready for insights!</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Add items to your inventory and make some purchases to unlock powerful analytics
          </Text>
          <TouchableOpacity style={[styles.emptyButton, { backgroundColor: theme.primary }]}>
            <Text style={[styles.emptyButtonText, { color: theme.background }]}>Get Started</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const pieData = [
    { name: 'Fresh', population: statistics.inventory.fresh.count, color: '#4CAF50', legendFontColor: theme.text, legendFontSize: 11 },
    { name: 'This Week', population: statistics.inventory.expiringWeek.count, color: '#FF9800', legendFontColor: theme.text, legendFontSize: 11 },
    { name: 'Soon', population: statistics.inventory.expiringSoon.count, color: '#FF5722', legendFontColor: theme.text, legendFontSize: 11 },
    { name: 'Expired', population: statistics.inventory.expired.count, color: '#9E9E9E', legendFontColor: theme.text, legendFontSize: 11 }
  ].filter(item => item.population > 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Analytics</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Smart insights for better food management
            </Text>
          </View>

          {/* Timeframe Selector */}
          <View style={styles.timeframeContainer}>
            {TIMEFRAMES.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.timeframeButton,
                  { 
                    backgroundColor: selectedTimeframe === key ? theme.primary : 'transparent',
                    borderColor: theme.primary
                  }
                ]}
                onPress={() => setSelectedTimeframe(key)}
              >
                <Text style={[
                  styles.timeframeText,
                  { color: selectedTimeframe === key ? theme.background : theme.primary }
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Key Metrics */}
          <View style={styles.metricsGrid}>
            <MetricCard
              icon="food-variant"
              value={statistics.inventory.totalItems}
              label="Items in Stock"
              subtitle={`${statistics.inventory.totalQuantity} total units`}
              color={theme.primary}
            />
            <MetricCard
              icon="cash-multiple"
              value={formatCurrency(statistics.spending.total)}
              label={`Spent (${selectedTimeframe}D)`}
              subtitle={`${statistics.spending.transactions} purchases`}
              color="#4CAF50"
            />
            <MetricCard
              icon="chart-line"
              value={formatPercent(statistics.insights.efficiency)}
              label="Efficiency Score"
              subtitle="Fresh + good condition"
              color="#2196F3"
            />
            <MetricCard
              icon="delete-variant"
              value={formatCurrency(statistics.insights.wasteValue)}
              label="Waste Cost"
              subtitle={`${formatPercent(statistics.insights.wasteRate)} waste rate`}
              color="#FF5722"
            />
          </View>

          {/* Smart Recommendations */}
          {statistics.insights.recommendations.length > 0 && (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                💡 Smart Recommendations
              </Text>
              {statistics.insights.recommendations.map((rec, index) => (
                <RecommendationCard key={index} {...rec} />
              ))}
            </View>
          )}

          {/* Spending Trend */}
          {statistics.spending.chartData.some(val => val > 0) && (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                📊 Spending Pattern (7 Days)
              </Text>
              <LineChart
                data={{
                  labels: statistics.spending.chartLabels,
                  datasets: [{ data: statistics.spending.chartData }]
                }}
                width={screenWidth - 60}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withDots={true}
                withShadow={false}
                withInnerLines={false}
                withOuterLines={false}
                getDotColor={() => theme.primary}
              />
              <View style={styles.chartInsight}>
                <Text style={[styles.chartInsightText, { color: theme.textSecondary }]}>
                  Daily average: {formatCurrency(statistics.spending.avgDaily)}
                </Text>
              </View>
            </View>
          )}

          {/* Food Status Breakdown */}
          {pieData.length > 0 && (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                🥬 Food Freshness Breakdown
              </Text>
              <PieChart
                data={pieData}
                width={screenWidth - 60}
                height={180}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                style={styles.chart}
              />
            </View>
          )}

          {/* Category Spending */}
          {Object.keys(statistics.spending.byCategory).length > 0 && (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                🛒 Category Breakdown
              </Text>
              {Object.entries(statistics.spending.byCategory)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([category, amount]) => {
                  const percentage = (amount / statistics.spending.total) * 100;
                  return (
                    <View key={category} style={styles.categoryRow}>
                      <View style={styles.categoryLeft}>
                        <Text style={[styles.categoryName, { color: theme.text }]}>{category}</Text>
                        <View style={[styles.categoryBar, { backgroundColor: theme.background }]}>
                          <View 
                            style={[
                              styles.categoryProgress, 
                              { backgroundColor: theme.primary, width: `${percentage}%` }
                            ]} 
                          />
                        </View>
                      </View>
                      <Text style={[styles.categoryAmount, { color: theme.text }]}>
                        {formatCurrency(amount)}
                      </Text>
                    </View>
                  );
                })}
            </View>
          )}

          {/* Recent Purchases */}
          {statistics.recentPurchases.length > 0 && (
            <View style={[styles.section, { backgroundColor: theme.surface }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                🧾 Recent Purchases
              </Text>
              <View style={styles.purchasesList}>
                {statistics.recentPurchases.map((item, index) => (
                  <PurchaseItem key={`${item.name}-${index}`} item={item} index={index} />
                ))}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Last updated: {new Date().toLocaleTimeString('en-GB', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  scrollView: {
    flex: 1
  },
  content: { 
    paddingHorizontal: 20,
    paddingBottom: 40
  },
  
  header: {
    paddingTop: 20,
    paddingBottom: 10
  },
  title: { 
    fontSize: 34, 
    fontWeight: 'bold',
    letterSpacing: -0.5
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
    opacity: 0.8
  },
  
  timeframeContainer: {
    flexDirection: 'row',
    marginVertical: 24,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 25,
    padding: 4,
    alignSelf: 'center'
  },
  timeframeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 2
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '600'
  },
  
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12
  },
  metricCard: {
    width: '48%',
    padding: 20,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  metricValue: { 
    fontSize: 24, 
    fontWeight: 'bold',
    marginBottom: 4
  },
  metricLabel: { 
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8
  },
  metricSubtitle: { 
    fontSize: 11,
    marginTop: 2,
    opacity: 0.6
  },
  
  section: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold',
    marginBottom: 20
  },
  
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4
  },
  recommendationText: {
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20
  },
  
  chart: { 
    borderRadius: 16,
    marginVertical: 8
  },
  chartInsight: {
    alignItems: 'center',
    marginTop: 12
  },
  chartInsightText: {
    fontSize: 13,
    fontStyle: 'italic'
  },
  
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  categoryLeft: {
    flex: 1,
    marginRight: 16
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8
  },
  categoryBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  categoryProgress: {
    height: '100%',
    borderRadius: 3
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: 'bold'
  },
  
  purchasesList: {
    gap: 8
  },
  purchaseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  purchaseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  purchaseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  purchaseDetails: {
    marginLeft: 12,
    flex: 1
  },
  purchaseName: {
    fontSize: 14,
    fontWeight: '600'
  },
  purchaseDate: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7
  },
  purchaseAmount: {
    fontSize: 15,
    fontWeight: 'bold'
  },
  
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
    opacity: 0.8
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    marginTop: 32
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: 'bold'
  },
  
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10
  },
  footerText: {
    fontSize: 12,
    opacity: 0.6
  }
});