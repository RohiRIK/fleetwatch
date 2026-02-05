/**
 * Recommendation Engine Configuration
 * Centralized thresholds and constants for analytical queries.
 */

export const RECOMMENDATION_THRESHOLDS = {
  // Device Thresholds
  BATTERY_CRITICAL: 50,      // Below 50% capacity
  BATTERY_WARNING: 80,       // Below 80% capacity
  STORAGE_FREE_PERCENT: 0.20, // Below 20% free space
  STALE_DEVICE_DAYS: 7,      // No sync for 7 days
  GHOST_DEVICE_DAYS: 30,     // No sync for 30 days
  WARRANTY_EXPIRING_DAYS: 30, // Expiring within 30 days
  BSOD_CRITICAL_COUNT: 5,    // More than 5 BSODs
  BSOD_WARNING_COUNT: 1,     // More than 1 BSOD
  FREQUENT_RESTART_COUNT: 20, // More than 20 restarts
  POOR_HEALTH_SCORE: 70,     // Health score below 70
  POOR_STARTUP_SCORE: 60,    // Startup score below 60
  
  // User Thresholds
  INACTIVE_USER_DAYS: 90,    // No activity for 90 days
  DEVICE_HOARDER_LIMIT: 3,   // More than 3 devices per user
  VIP_SCORE_THRESHOLD: 50,   // VIP score below 50
  
  // License Thresholds
  LOW_UTILIZATION_PERCENT: 0.50, // Below 50% used
  HIGH_WASTE_COST: 500,          // Wasting > $500/month
  MIN_LICENSES_FOR_ALERT: 10,    // Only alert if org has > 10 licenses
};

/**
 * Standardized response structure for recommendation cards
 */
export interface RecommendationCard {
  count: number;
  severity: 'critical' | 'warning' | 'info' | 'ok';
  top_affected: any[]; // Top 5 affected items (devices, users, or licenses)
  breakdown?: any;     // Optional aggregations (by OS, by version, etc.)
  meta?: any;          // Extra stats (e.g., total_waste)
}
