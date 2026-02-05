// Analytics & Dashboard Routes for Frontend
import { Router, Request, Response, NextFunction } from 'express';
import type { Client } from '@opensearch-project/opensearch';
import type Redis from 'ioredis';
import { INDICES } from '../config/opensearch';
import { RECOMMENDATION_THRESHOLDS, RecommendationCard } from '../config/recommendations.config';

export function createAnalyticsRoutes(client: Client, redisClient?: Redis): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v2/analytics/status:
   *   get:
   *     tags: [Analytics]
   *     summary: Get license/onboarding status for UX Analytics
   *     description: Returns the status of userExperienceAnalytics features from the last fetch
   */
  router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!redisClient) {
        return res.json({ success: true, data: { state: 'healthy', isLicensed: true, missingFeatures: [] } });
      }
      
      const statusStr = await redisClient.get('system:status:uxa');
      const status = statusStr ? JSON.parse(statusStr) : { state: 'healthy', isLicensed: true, missingFeatures: [] };
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/dashboard:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get comprehensive dashboard data
   *     description: Returns all dashboard metrics including device counts, user stats, security overview, and compliance data
   *     responses:
   *       200:
   *         description: Dashboard analytics data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     devices:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 2247
   *                         by_os:
   *                           type: array
   *                           items:
   *                             type: object
   *                         by_manufacturer:
   *                           type: array
   *                           items:
   *                             type: object
   *                         online_last_24h:
   *                           type: number
   *                         online_last_7d:
   *                           type: number
   *                     users:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: number
   *                           example: 2641
   *                         active:
   *                           type: number
   *                         by_department:
   *                           type: array
   *                           items:
   *                             type: object
   *                     security:
   *                       type: object
   *                       properties:
   *                         encrypted:
   *                           type: number
   *                         not_encrypted:
   *                           type: number
   *                         encryption_rate:
   *                           type: string
   *                           example: "95.2"
   *                     compliance:
   *                       type: object
   *                       properties:
   *                         compliant:
   *                           type: number
   *                         non_compliant:
   *                           type: number
   *                         compliance_rate:
   *                           type: string
   *                           example: "87.5"
   */
  router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Run multiple queries in parallel
      const [devicesStats, usersStats, securityStats, complianceStats, orgStats] = await Promise.all([
        // Devices overview
        client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              total: { value_count: { field: 'id' } },
              by_os: { terms: { field: 'operatingSystem', size: 10 } },
              by_manufacturer: { terms: { field: 'manufacturer', size: 10 } },
              online_last_24h: {
                filter: {
                  range: {
                    lastSyncDateTime: {
                      gte: 'now-24h'
                    }
                  }
                }
              },
              online_last_7d: {
                filter: {
                  range: {
                    lastSyncDateTime: {
                      gte: 'now-7d'
                    }
                  }
                }
              }
            }
          }
        }),
        // Users overview - calculate from devices
        client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              total_users: {
                cardinality: { field: 'userPrincipalName' }
              },
              active_users: {
                filter: {
                  range: {
                    lastSyncDateTime: { gte: 'now-7d' }
                  }
                },
                aggs: {
                  unique_active: {
                    cardinality: { field: 'userPrincipalName' }
                  }
                }
              },
              by_department: {
                terms: {
                  field: 'user.department',
                  size: 50,
                  missing: 'Unassigned'
                }
              },
              by_department_old: {
                terms: {
                  field: 'userDetails.department',
                  size: 10,
                  min_doc_count: 1
                }
              }
            }
          }
        }),
        // Security overview
        client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              encrypted: {
                filter: { term: { isEncrypted: true } }
              },
              not_encrypted: {
                filter: { term: { isEncrypted: false } }
              },
              supervised: {
                filter: { term: { isSupervised: true } }
              },
              jailbroken: {
                filter: { term: { jailBroken: 'True' } }
              }
            }
          }
        }),
        // Compliance overview
        client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              compliant: {
                filter: { term: { isCompliant: true } }
              },
              non_compliant: {
                filter: { term: { isCompliant: false } }
              },
              compliance_by_os: {
                terms: { field: 'operatingSystem', size: 10 },
                aggs: {
                  compliant_count: {
                    filter: { term: { isCompliant: true } }
                  }
                }
              }
            }
          }
        }),
        // Organization overview (ALL users)
        client.search({
          index: INDICES.USERS,
          body: {
            size: 0,
            aggs: {
              by_department: {
                terms: { 
                  field: 'employment.department', 
                  size: 20,
                  missing: 'Unassigned'
                }
              }
            }
          }
        })
      ]);

      const deviceAggs = devicesStats.body.aggregations;
      const userAggs = usersStats.body.aggregations;
      const securityAggs = securityStats.body.aggregations;
      const complianceAggs = complianceStats.body.aggregations;
      const orgAggs = orgStats.body.aggregations;

      res.json({
        success: true,
        data: {
          devices: {
            total: deviceAggs.total.value,
            by_os: deviceAggs.by_os.buckets,
            by_manufacturer: deviceAggs.by_manufacturer.buckets,
            online_last_24h: deviceAggs.online_last_24h.doc_count,
            online_last_7d: deviceAggs.online_last_7d.doc_count
          },
          users: {
            total: userAggs.total_users.value,
            active: userAggs.active_users.unique_active.value,
            by_department: userAggs.by_department.buckets,
            org_distribution: orgAggs.by_department.buckets
          },
          security: {
            encrypted: securityAggs.encrypted.doc_count,
            not_encrypted: securityAggs.not_encrypted.doc_count,
            supervised: securityAggs.supervised.doc_count,
            jailbroken: securityAggs.jailbroken.doc_count,
            encryption_rate: (securityAggs.encrypted.doc_count / deviceAggs.total.value * 100).toFixed(1)
          },
          compliance: {
            compliant: complianceAggs.compliant.doc_count,
            non_compliant: complianceAggs.non_compliant.doc_count,
            compliance_rate: (complianceAggs.compliant.doc_count / deviceAggs.total.value * 100).toFixed(1),
            by_os: complianceAggs.compliance_by_os.buckets
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/trends:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get trend data over time
   *     parameters:
   *       - in: query
   *         name: interval
   *         schema:
   *           type: string
   *           default: day
   *         description: Aggregation interval (day, week, month)
   *       - in: query
   *         name: range
   *         schema:
   *           type: string
   *           default: 30d
   *         description: Time range (e.g., 30d, 7d)
   *     responses:
   *       200:
   *         description: Trend data buckets
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   */
  router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { interval = 'day', range = '30d' } = req.query;

      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          size: 0,
          aggs: {
            over_time: {
              date_histogram: {
                field: 'lastSyncDateTime',
                calendar_interval: interval as string,
                min_doc_count: 0,
                extended_bounds: {
                  min: `now-${range}`,
                  max: 'now'
                }
              },
              aggs: {
                compliant: {
                  filter: { term: { isCompliant: true } }
                },
                encrypted: {
                  filter: { term: { isEncrypted: true } }
                },
                online: {
                  filter: {
                    range: {
                      lastSyncDateTime: {
                        gte: 'now-24h'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      res.json({
        success: true,
        data: response.body.aggregations.over_time.buckets
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/top-issues:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get top issues and anomalies
   *     description: Returns breakdown of non-compliant, unencrypted, jailbroken, and stale devices
   *     responses:
   *       200:
   *         description: Top issues data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     non_compliant:
   *                       type: object
   *                     not_encrypted:
   *                       type: object
   *                     jailbroken:
   *                       type: object
   *                     stale_devices:
   *                       type: object
   */
  router.get('/top-issues', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [nonCompliant, notEncrypted, jailbroken, staleDevices] = await Promise.all([
        // Non-compliant devices
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { term: { isCompliant: false } },
            size: 10,
            sort: [{ lastSyncDateTime: 'desc' }],
            _source: ['id', 'deviceName', 'userPrincipalName', 'operatingSystem', 'lastSyncDateTime']
          }
        }),
        // Not encrypted devices
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { term: { isEncrypted: false } },
            size: 10,
            sort: [{ lastSyncDateTime: 'desc' }],
            _source: ['id', 'deviceName', 'userPrincipalName', 'operatingSystem', 'isEncrypted']
          }
        }),
        // Jailbroken devices
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { term: { jailBroken: 'True' } },
            size: 10,
            _source: ['id', 'deviceName', 'userPrincipalName', 'operatingSystem', 'jailBroken']
          }
        }),
        // Stale devices (not synced in 7+ days)
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: {
              range: {
                lastSyncDateTime: {
                  lte: 'now-7d'
                }
              }
            },
            size: 10,
            sort: [{ lastSyncDateTime: 'asc' }],
            _source: ['id', 'deviceName', 'userPrincipalName', 'lastSyncDateTime']
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          non_compliant: {
            count: nonCompliant.body.hits.total.value,
            devices: nonCompliant.body.hits.hits.map((h: any) => h._source)
          },
          not_encrypted: {
            count: notEncrypted.body.hits.total.value,
            devices: notEncrypted.body.hits.hits.map((h: any) => h._source)
          },
          jailbroken: {
            count: jailbroken.body.hits.total.value,
            devices: jailbroken.body.hits.hits.map((h: any) => h._source)
          },
          stale_devices: {
            count: staleDevices.body.hits.total.value,
            devices: staleDevices.body.hits.hits.map((h: any) => h._source)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/inventory:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get device inventory breakdown
   *     description: Inventory stats by manufacturer/model, OS version, and storage usage
   *     responses:
   *       200:
   *         description: Inventory breakdown
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     by_manufacturer_model:
   *                       type: object
   *                     by_os_version:
   *                       type: object
   *                     storage:
   *                       type: object
   *                     free_storage:
   *                       type: object
   */
  router.get('/inventory', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          size: 0,
          aggs: {
            by_manufacturer_model: {
              terms: { field: 'manufacturer', size: 20 },
              aggs: {
                models: {
                  terms: { field: 'model', size: 20 }
                }
              }
            },
            by_os_version: {
              terms: { field: 'operatingSystem', size: 10 },
              aggs: {
                versions: {
                  terms: { field: 'osVersion', size: 20 }
                }
              }
            },
            storage: {
              stats: { field: 'totalStorageSpaceInBytes' }
            },
            free_storage: {
              stats: { field: 'freeStorageSpaceInBytes' }
            }
          }
        }
      });

      res.json({
        success: true,
        data: response.body.aggregations
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/users-devices:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get user-to-device mapping analytics
   *     description: Stats on users with multiple devices and average devices per user
   *     responses:
   *       200:
   *         description: User-device mapping stats
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     users_with_multiple_devices:
   *                       type: array
   *                     unique_users:
   *                       type: number
   */
  router.get('/users-devices', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          size: 0,
          aggs: {
            users_with_multiple_devices: {
              terms: {
                field: 'userPrincipalName',
                min_doc_count: 2,
                size: 50,
                order: { _count: 'desc' }
              }
            },
            devices_per_user: {
              cardinality: {
                field: 'userPrincipalName'
              }
            }
          }
        }
      });

      res.json({
        success: true,
        data: {
          users_with_multiple_devices: response.body.aggregations.users_with_multiple_devices.buckets,
          unique_users: response.body.aggregations.devices_per_user.value
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/recommendations:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get actionable recommendations
   *     description: Returns recommendation cards for battery health alerts, BSOD/critical errors, expiring warranties, and policy failures
   *     responses:
   *       200:
   *         description: Actionable recommendations
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     battery_health:
   *                       type: object
   *                       properties:
   *                         count:
   *                           type: number
   *                         severity:
   *                           type: string
   *                           enum: [critical, warning, info]
   *                     bsod_errors:
   *                       type: object
   *                     expiring_warranties:
   *                       type: object
   *                     policy_failures:
   *                       type: object
   */
  router.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Run multiple recommendation queries in parallel
      const [
        batteryHealth,
        bsodErrors,
        expiringWarranties,
        policyFailures,
        offlineDevices,
        lowStorage,
        outdatedOS,
        excessiveCrashes,
        pendingReboot,
        zombieLicenses,
        unassignedLicenses,
        bitLockerDisabled,
        pendingUpdates,
        jailbrokenDevices,
        vipPoorExperience,
        inactiveUsers,
        deviceHoarders,
        poorHealthDevices,
        slowStartupDevices,
        frequentRestartDevices,
        legacyStorageDevices,
        underutilizedLicenses,
        highCostWasteLicenses,
        staleSignInUsers
      ] = await Promise.all([
        // 1. Battery health issues
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { range: { batteryHealthPercentage: { lt: RECOMMENDATION_THRESHOLDS.BATTERY_WARNING } } },
            size: 0,
            aggs: {
              severity_breakdown: {
                range: {
                  field: 'batteryHealthPercentage',
                  ranges: [
                    { key: 'critical', to: RECOMMENDATION_THRESHOLDS.BATTERY_CRITICAL },
                    { key: 'warning', from: RECOMMENDATION_THRESHOLDS.BATTERY_CRITICAL, to: RECOMMENDATION_THRESHOLDS.BATTERY_WARNING }
                  ]
                }
              },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ batteryHealthPercentage: { order: 'asc', unmapped_type: 'integer', missing: '_last' } }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'batteryHealthPercentage']
                }
              }
            }
          }
        }),
        // 2. BSOD/Critical errors
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { range: { 'analytics.startup.blueScreenCount': { gt: 0 } } },
            size: 0,
            aggs: {
              error_count: { value_count: { field: 'id' } },
              severity_breakdown: {
                range: {
                  field: 'analytics.startup.blueScreenCount',
                  ranges: [
                    { key: 'critical', from: RECOMMENDATION_THRESHOLDS.BSOD_CRITICAL_COUNT },
                    { key: 'warning', from: RECOMMENDATION_THRESHOLDS.BSOD_WARNING_COUNT, to: RECOMMENDATION_THRESHOLDS.BSOD_CRITICAL_COUNT }
                  ]
                }
              },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ 'analytics.startup.blueScreenCount': { order: 'desc', unmapped_type: 'integer', missing: '_last' } }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'operatingSystem', 'analytics.startup.blueScreenCount']
                }
              }
            }
          }
        }),
        // 3. Expiring warranties
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { range: { 'warranty.endDate': { lte: `now+${RECOMMENDATION_THRESHOLDS.WARRANTY_EXPIRING_DAYS}d` } } },
            size: 0,
            aggs: {
              status_breakdown: {
                range: {
                  field: 'warranty.endDate',
                  ranges: [
                    { key: 'expired', to: 'now' },
                    { key: 'expiring_soon', from: 'now', to: `now+${RECOMMENDATION_THRESHOLDS.WARRANTY_EXPIRING_DAYS}d` }
                  ]
                }
              },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ 'warranty.endDate': 'asc' }],
                  _source: ['id', 'deviceName', 'serialNumber', 'warranty.endDate', 'warranty.status']
                }
              }
            }
          }
        }),
// ... (policy failures remains same)
        // 4. Policy/Compliance failures
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { term: { isCompliant: false } },
            size: 0,
            aggs: {
              total_non_compliant: { value_count: { field: 'id' } },
              by_os: { terms: { field: 'operatingSystem', size: 10 } },
              top_devices: {
                top_hits: {
                  size: 5,
                  _source: ['id', 'deviceName', 'userPrincipalName', 'operatingSystem', 'complianceState']
                }
              }
            }
          }
        }),
        // 5. Offline devices
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { range: { lastSyncDateTime: { lte: `now-${RECOMMENDATION_THRESHOLDS.STALE_DEVICE_DAYS}d` } } },
            size: 0,
            aggs: {
              total_offline: { value_count: { field: 'id' } },
              offline_breakdown: {
                range: {
                  field: 'lastSyncDateTime',
                  ranges: [
                    { key: 'critical_30d+', to: `now-${RECOMMENDATION_THRESHOLDS.GHOST_DEVICE_DAYS}d` },
                    { key: 'warning_7-30d', from: `now-${RECOMMENDATION_THRESHOLDS.GHOST_DEVICE_DAYS}d`, to: `now-${RECOMMENDATION_THRESHOLDS.STALE_DEVICE_DAYS}d` }
                  ]
                }
              },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ lastSyncDateTime: 'asc' }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'lastSyncDateTime']
                }
              }
            }
          }
        }),
        // 6. Low storage
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: {
              bool: {
                must: [
                  { exists: { field: 'hardware.totalStorageSpaceInBytes' } },
                  { range: { 'hardware.freeStorageSpaceInBytes': { gt: 0 } } },
                  { range: { 'hardware.totalStorageSpaceInBytes': { gt: 0 } } }
                ],
                filter: {
                  script: {
                    script: {
                      source: `(doc['hardware.freeStorageSpaceInBytes'].value.doubleValue() / doc['hardware.totalStorageSpaceInBytes'].value.doubleValue()) < ${RECOMMENDATION_THRESHOLDS.STORAGE_FREE_PERCENT}`,
                      lang: 'painless'
                    }
                  }
                }
              }
            },
            size: 0,
            aggs: {
              total_low_storage: { value_count: { field: 'id' } },
              top_devices: {
                top_hits: {
                  size: 5,
                  _source: ['id', 'deviceName', 'userPrincipalName', 'hardware.totalStorageSpaceInBytes', 'hardware.freeStorageSpaceInBytes']
                }
              }
            }
          }
        }),
// ... (outdated OS remains same)
        // 7. Outdated OS
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: {
              bool: {
                must: [
                  { term: { operatingSystem: 'Windows' } },
                  { prefix: { osVersion: '10.0.19' } }
                ]
              }
            },
            size: 0,
            aggs: {
              total_outdated: { value_count: { field: 'id' } },
              by_version: { terms: { field: 'osVersion', size: 10 } },
              top_devices: {
                top_hits: {
                  size: 5,
                  _source: ['id', 'deviceName', 'userPrincipalName', 'operatingSystem', 'osVersion']
                }
              }
            }
          }
        }),
        // 8. Excessive crashes
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { range: { 'analytics.startup.blueScreenCount': { gte: RECOMMENDATION_THRESHOLDS.BSOD_CRITICAL_COUNT } } },
            size: 0,
            aggs: {
              total_crashes: { value_count: { field: 'id' } },
              severity_breakdown: {
                range: {
                  field: 'analytics.startup.blueScreenCount',
                  ranges: [
                    { key: 'severe', from: 10 },
                    { key: 'moderate', from: RECOMMENDATION_THRESHOLDS.BSOD_CRITICAL_COUNT, to: 10 }
                  ]
                }
              },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ 'analytics.startup.blueScreenCount': { order: 'desc', unmapped_type: 'integer', missing: '_last' } }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'operatingSystem', 'analytics.startup.blueScreenCount']
                }
              }
            }
          }
        }),
        // 9. Pending Reboot
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { term: { 'security.protection.rebootRequired': true } },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_devices: { top_hits: { size: 5, _source: ['id', 'deviceName', 'userPrincipalName', 'security.protection.rebootRequired'] } }
            }
          }
        }),
        // 10. Zombie Licenses (Disabled Users with Licenses)
        client.search({
          index: INDICES.USERS,
          body: {
            query: {
              bool: {
                must: [
                  { term: { 'account.enabled': false } },
                  { nested: { path: 'licenses.assigned', query: { match_all: {} } } }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_users: { top_hits: { size: 5, _source: ['id', 'displayName', 'userPrincipalName', 'licenses.assigned'] } }
            }
          }
        }),
        // 11. Unassigned Licenses (Unused > 0)
        client.search({
          index: INDICES.LICENSES,
          body: {
            query: { range: { unused: { gt: 0 } } },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_licenses: { top_hits: { size: 5, sort: [{ monthlyWaste: 'desc' }], _source: ['id', 'displayName', 'skuPartNumber', 'unused', 'monthlyWaste'] } }
            }
          }
        }),
        // 12. BitLocker/Encryption Disabled (across all platforms)
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: {
              term: { isEncrypted: false }  // Matches all platforms where encryption is false
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_devices: { top_hits: { size: 5, _source: ['id', 'deviceName', 'userPrincipalName', 'isEncrypted', 'operatingSystem'] } }
            }
          }
        }),
        // 13. Pending Updates
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { range: { 'security.protection.pendingUpdates': { gt: 0 } } },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_devices: { 
                top_hits: { 
                  size: 5, 
                  sort: [{ 'security.protection.pendingUpdates': 'desc' }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'security.protection.pendingUpdates'] 
                } 
              }
            }
          }
        }),
        // 14. Jailbroken Devices
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: { term: { jailBroken: 'True' } },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_devices: { top_hits: { size: 5, _source: ['id', 'deviceName', 'userPrincipalName', 'operatingSystem'] } }
            }
          }
        }),
        // 15. VIP Poor Experience
        client.search({
          index: INDICES.USERS,
          body: {
            query: {
              bool: {
                must: [
                  { range: { 'analytics.overall.averageScore': { lt: RECOMMENDATION_THRESHOLDS.VIP_SCORE_THRESHOLD } } },
                  {
                    bool: {
                      should: [
                        { match_phrase: { 'employment.jobTitle': 'Director' } },
                        { match_phrase: { 'employment.jobTitle': 'VP' } },
                        { match_phrase: { 'employment.jobTitle': 'President' } },
                        { match_phrase: { 'employment.jobTitle': 'Chief' } },
                        { match_phrase: { 'employment.jobTitle': 'Head' } }
                      ],
                      minimum_should_match: 1
                    }
                  }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_users: {
                top_hits: {
                  size: 5,
                  sort: [{ 'analytics.overall.averageScore': 'asc' }],
                  _source: ['id', 'displayName', 'employment.jobTitle', 'analytics.overall.averageScore']
                }
              }
            }
          }
        }),

        // 16. Inactive Users (Ghost Users)
        // Users with 0 devices, >INACTIVE_USER_DAYS days inactivity, and disabled account
        client.search({
          index: INDICES.USERS,
          body: {
            query: {
              bool: {
                must: [
                  { term: { 'account.enabled': false } },
                  {
                    bool: {
                      should: [
                        { term: { 'devices.summary.totalDevices': 0 } },
                        { bool: { must_not: { exists: { field: 'devices.summary.totalDevices' } } } }
                      ]
                    }
                  },
                  { range: { 'dataQuality.lastEnrichedAt': { lte: `now-${RECOMMENDATION_THRESHOLDS.INACTIVE_USER_DAYS}d` } } }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_users: {
                top_hits: {
                  size: 5,
                  sort: [{ 'dataQuality.lastEnrichedAt': 'asc' }],
                  _source: ['id', 'displayName', 'userPrincipalName', 'account.enabled', 'devices.summary.totalDevices', 'dataQuality.lastEnrichedAt']
                }
              }
            }
          }
        }),

        // 17. Device Hoarders
        // Users with more than DEVICE_HOARDER_LIMIT devices
        client.search({
          index: INDICES.USERS,
          body: {
            query: {
              range: { 'devices.summary.totalDevices': { gt: RECOMMENDATION_THRESHOLDS.DEVICE_HOARDER_LIMIT } }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_users: {
                top_hits: {
                  size: 5,
                  sort: [{ 'devices.summary.totalDevices': { order: 'desc' } }],
                  _source: ['id', 'displayName', 'userPrincipalName', 'devices.summary.totalDevices', 'employment.department']
                }
              }
            }
          }
        }),

        // 18. Poor Device Health Score
        // Devices with overall health score < POOR_HEALTH_SCORE
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: {
              bool: {
                must: [
                  { term: { 'managedBy': 'intune' } },
                  { range: { 'analytics.scores.overall': { lt: RECOMMENDATION_THRESHOLDS.POOR_HEALTH_SCORE, gte: 0 } } }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              severity_breakdown: {
                range: {
                  field: 'analytics.scores.overall',
                  ranges: [
                    { key: 'critical', to: 50 },
                    { key: 'warning', from: 50, to: RECOMMENDATION_THRESHOLDS.POOR_HEALTH_SCORE }
                  ]
                }
              },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ 'analytics.scores.overall': { order: 'asc' } }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'analytics.scores']
                }
              },
              by_os: {
                terms: { field: 'operatingSystem.keyword', size: 10 }
              }
            }
          }
        }),

        // 19. Slow Startup Performance
        // Devices with startup score < POOR_STARTUP_SCORE
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: {
              bool: {
                must: [
                  { term: { 'managedBy': 'intune' } },
                  { range: { 'analytics.scores.startup': { lt: RECOMMENDATION_THRESHOLDS.POOR_STARTUP_SCORE, gte: 0 } } }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              severity_breakdown: {
                range: {
                  field: 'analytics.scores.startup',
                  ranges: [
                    { key: 'critical', to: 40 },
                    { key: 'warning', from: 40, to: RECOMMENDATION_THRESHOLDS.POOR_STARTUP_SCORE }
                  ]
                }
              },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ 'analytics.scores.startup': { order: 'asc' } }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'analytics.scores.startup', 'analytics.startup']
                }
              },
              by_os: {
                terms: { field: 'operatingSystem.keyword', size: 10 }
              }
            }
          }
        }),

        // 20. Frequent Restart Devices
        // Devices with > FREQUENT_RESTART_COUNT restarts
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: {
              bool: {
                must: [
                  { term: { 'managedBy': 'intune' } },
                  { range: { 'analytics.startup.restartCount': { gt: RECOMMENDATION_THRESHOLDS.FREQUENT_RESTART_COUNT } } }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              severity_breakdown: {
                range: {
                  field: 'analytics.startup.restartCount',
                  ranges: [
                    { key: 'critical', from: 50 },
                    { key: 'warning', from: RECOMMENDATION_THRESHOLDS.FREQUENT_RESTART_COUNT, to: 50 }
                  ]
                }
              },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ 'analytics.startup.restartCount': { order: 'desc' } }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'analytics.startup.restartCount', 'analytics.startup.blueScreenCount']
                }
              },
              by_os: {
                terms: { field: 'operatingSystem.keyword', size: 10 }
              }
            }
          }
        }),

        // 21. Legacy Storage (Non-SSD)
        // Devices using HDDs instead of SSDs
        client.search({
          index: INDICES.DEVICES,
          body: {
            query: {
              bool: {
                must: [
                  { term: { 'managedBy': 'intune' } },
                  { term: { 'operatingSystem.keyword': 'Windows' } }
                ],
                must_not: [
                  { term: { 'analytics.startup.diskType.keyword': 'ssd' } }
                ],
                filter: [
                  { exists: { field: 'analytics.startup.diskType' } }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_devices: {
                top_hits: {
                  size: 5,
                  sort: [{ 'enrolledDateTime': { order: 'asc' } }],
                  _source: ['id', 'deviceName', 'userPrincipalName', 'analytics.startup.diskType', 'model', 'manufacturer']
                }
              },
              by_manufacturer: {
                terms: { field: 'manufacturer.keyword', size: 10 }
              }
            }
          }
        }),

        // 22. Underutilized Licenses
        // Licenses with < LOW_UTILIZATION_PERCENT utilization and > MIN_LICENSES_FOR_ALERT total
        client.search({
          index: INDICES.LICENSES,
          body: {
            query: {
              bool: {
                must: [
                  { range: { utilizationRate: { lt: RECOMMENDATION_THRESHOLDS.LOW_UTILIZATION_PERCENT } } },
                  { range: { total: { gt: RECOMMENDATION_THRESHOLDS.MIN_LICENSES_FOR_ALERT } } }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'skuId' } },
              total_waste: { sum: { field: 'monthlyWaste' } },
              top_licenses: {
                top_hits: {
                  size: 5,
                  sort: [{ 'utilizationRate': { order: 'asc' } }],
                  _source: ['skuId', 'displayName', 'total', 'assigned', 'unused', 'utilizationRate', 'monthlyWaste']
                }
              }
            }
          }
        }),

        // 23. High-Cost Waste Licenses
        // Licenses wasting > HIGH_WASTE_COST/month
        client.search({
          index: INDICES.LICENSES,
          body: {
            query: {
              range: { monthlyWaste: { gt: RECOMMENDATION_THRESHOLDS.HIGH_WASTE_COST } }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'skuId' } },
              total_waste: { sum: { field: 'monthlyWaste' } },
              top_licenses: {
                top_hits: {
                  size: 5,
                  sort: [{ 'monthlyWaste': { order: 'desc' } }],
                  _source: ['skuId', 'displayName', 'total', 'assigned', 'unused', 'monthlyWaste', 'annualWaste']
                }
              }
            }
          }
        }),

        // 24. Stale Sign-Ins
        // Enabled accounts with no sign-in > INACTIVE_USER_DAYS days
        client.search({
          index: INDICES.USERS,
          body: {
            query: {
              bool: {
                must: [
                  { term: { 'account.enabled': true } },
                  { range: { 'signInActivity.lastSignInDateTime': { lte: `now-${RECOMMENDATION_THRESHOLDS.INACTIVE_USER_DAYS}d` } } }
                ]
              }
            },
            size: 0,
            aggs: {
              count: { value_count: { field: 'id' } },
              top_users: {
                top_hits: {
                  size: 5,
                  sort: [{ 'signInActivity.lastSignInDateTime': { order: 'asc' } }],
                  _source: ['id', 'displayName', 'userPrincipalName', 'account.enabled', 'signInActivity.lastSignInDateTime', 'devices.summary.totalDevices']
                }
              }
            }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          battery_health: {
            count: batteryHealth.body.hits.total.value,
            severity: batteryHealth.body.hits.total.value > 0 ? (batteryHealth.body.aggregations.severity_breakdown.buckets.find((b: any) => b.key === 'critical')?.doc_count > 0 ? 'critical' : 'warning') : 'ok',
            breakdown: batteryHealth.body.aggregations.severity_breakdown.buckets,
            top_affected: batteryHealth.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          bsod_errors: {
            count: bsodErrors.body.aggregations.error_count.value,
            severity: bsodErrors.body.aggregations.severity_breakdown.buckets.find((b: any) => b.key === 'critical')?.doc_count > 0 ? 'critical' : (bsodErrors.body.aggregations.error_count.value > 0 ? 'warning' : 'ok'),
            breakdown: bsodErrors.body.aggregations.severity_breakdown.buckets,
            top_affected: bsodErrors.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          expiring_warranties: {
            count: expiringWarranties.body.hits.total.value,
            severity: expiringWarranties.body.hits.total.value > 0 ? 'warning' : 'ok',
            breakdown: expiringWarranties.body.aggregations.status_breakdown.buckets,
            top_affected: expiringWarranties.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          policy_failures: {
            count: policyFailures.body.aggregations.total_non_compliant.value,
            severity: policyFailures.body.aggregations.total_non_compliant.value > 0 ? 'critical' : 'ok',
            breakdown: policyFailures.body.aggregations.by_os.buckets,
            top_affected: policyFailures.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          offline_devices: {
            count: offlineDevices.body.aggregations.total_offline.value,
            severity: offlineDevices.body.aggregations.total_offline.value > 50 ? 'warning' : (offlineDevices.body.aggregations.total_offline.value > 0 ? 'info' : 'ok'),
            breakdown: offlineDevices.body.aggregations.offline_breakdown.buckets,
            top_affected: offlineDevices.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          low_storage: {
            count: lowStorage.body.aggregations.total_low_storage.value,
            severity: lowStorage.body.aggregations.total_low_storage.value > 100 ? 'warning' : (lowStorage.body.aggregations.total_low_storage.value > 0 ? 'info' : 'ok'),
            top_affected: lowStorage.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          outdated_os: {
            count: outdatedOS.body.aggregations.total_outdated.value,
            severity: outdatedOS.body.aggregations.total_outdated.value > 0 ? 'info' : 'ok',
            breakdown: outdatedOS.body.aggregations.by_version.buckets,
            top_affected: outdatedOS.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          excessive_crashes: {
            count: excessiveCrashes.body.aggregations.total_crashes.value,
            severity: excessiveCrashes.body.aggregations.total_crashes.value > 0 ? 'critical' : 'ok',
            breakdown: excessiveCrashes.body.aggregations.severity_breakdown.buckets,
            top_affected: excessiveCrashes.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          pending_reboot: {
            count: pendingReboot.body.aggregations.count.value,
            severity: pendingReboot.body.aggregations.count.value > 50 ? 'warning' : (pendingReboot.body.aggregations.count.value > 0 ? 'info' : 'ok'),
            top_affected: pendingReboot.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          zombie_licenses: {
            count: zombieLicenses.body.aggregations.count.value,
            severity: zombieLicenses.body.aggregations.count.value > 0 ? 'critical' : 'ok',
            top_affected: zombieLicenses.body.aggregations.top_users.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          unassigned_licenses: {
            count: unassignedLicenses.body.aggregations.count.value,
            severity: unassignedLicenses.body.aggregations.count.value > 0 ? 'info' : 'ok',
            top_affected: unassignedLicenses.body.aggregations.top_licenses.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          bitlocker_disabled: {
            count: bitLockerDisabled.body.aggregations.count.value,
            severity: bitLockerDisabled.body.aggregations.count.value > 0 ? 'critical' : 'ok',
            top_affected: bitLockerDisabled.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          pending_updates: {
            count: pendingUpdates.body.aggregations.count.value,
            severity: pendingUpdates.body.aggregations.count.value > 100 ? 'warning' : (pendingUpdates.body.aggregations.count.value > 0 ? 'info' : 'ok'),
            top_affected: pendingUpdates.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          jailbroken_devices: {
            count: jailbrokenDevices.body.aggregations.count.value,
            severity: jailbrokenDevices.body.aggregations.count.value > 0 ? 'critical' : 'ok',
            top_affected: jailbrokenDevices.body.aggregations.top_devices.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          vip_poor_experience: {
            count: vipPoorExperience.body.aggregations.count.value,
            severity: vipPoorExperience.body.aggregations.count.value > 0 ? 'warning' : 'ok',
            top_affected: vipPoorExperience.body.aggregations.top_users.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          inactive_users: {
            count: inactiveUsers.body.aggregations.count.value,
            severity: inactiveUsers.body.aggregations.count.value > 10 ? 'warning' : (inactiveUsers.body.aggregations.count.value > 0 ? 'info' : 'ok'),
            top_affected: inactiveUsers.body.aggregations.top_users.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          device_hoarders: {
            count: deviceHoarders.body.aggregations.count.value,
            severity: deviceHoarders.body.aggregations.count.value > 20 ? 'warning' : (deviceHoarders.body.aggregations.count.value > 0 ? 'info' : 'ok'),
            top_affected: deviceHoarders.body.aggregations.top_users.hits.hits.map((h: any) => h._source)
          } as RecommendationCard,
          poor_health: {
            count: poorHealthDevices.body.aggregations.count.value,
            severity: poorHealthDevices.body.aggregations.severity_breakdown.buckets.find((b: any) => b.key === 'critical')?.doc_count > 0 ? 'critical' : (poorHealthDevices.body.aggregations.count.value > 0 ? 'warning' : 'ok'),
            breakdown: poorHealthDevices.body.aggregations.severity_breakdown.buckets,
            top_affected: poorHealthDevices.body.aggregations.top_devices.hits.hits.map((h: any) => h._source),
            meta: { by_os: poorHealthDevices.body.aggregations.by_os.buckets }
          } as RecommendationCard,
          slow_startup: {
            count: slowStartupDevices.body.aggregations.count.value,
            severity: slowStartupDevices.body.aggregations.severity_breakdown.buckets.find((b: any) => b.key === 'critical')?.doc_count > 0 ? 'critical' : (slowStartupDevices.body.aggregations.count.value > 0 ? 'warning' : 'ok'),
            breakdown: slowStartupDevices.body.aggregations.severity_breakdown.buckets,
            top_affected: slowStartupDevices.body.aggregations.top_devices.hits.hits.map((h: any) => h._source),
            meta: { by_os: slowStartupDevices.body.aggregations.by_os.buckets }
          } as RecommendationCard,
          frequent_restarts: {
            count: frequentRestartDevices.body.aggregations.count.value,
            severity: frequentRestartDevices.body.aggregations.severity_breakdown.buckets.find((b: any) => b.key === 'critical')?.doc_count > 0 ? 'critical' : (frequentRestartDevices.body.aggregations.count.value > 0 ? 'warning' : 'ok'),
            breakdown: frequentRestartDevices.body.aggregations.severity_breakdown.buckets,
            top_affected: frequentRestartDevices.body.aggregations.top_devices.hits.hits.map((h: any) => h._source),
            meta: { by_os: frequentRestartDevices.body.aggregations.by_os.buckets }
          } as RecommendationCard,
          legacy_storage: {
            count: legacyStorageDevices.body.aggregations.count.value,
            severity: legacyStorageDevices.body.aggregations.count.value > 50 ? 'warning' : (legacyStorageDevices.body.aggregations.count.value > 0 ? 'info' : 'ok'),
            top_affected: legacyStorageDevices.body.aggregations.top_devices.hits.hits.map((h: any) => h._source),
            meta: { by_manufacturer: legacyStorageDevices.body.aggregations.by_manufacturer.buckets }
          } as RecommendationCard,
          underutilized_licenses: {
            count: underutilizedLicenses.body.aggregations.count.value,
            severity: underutilizedLicenses.body.aggregations.count.value > 5 ? 'warning' : (underutilizedLicenses.body.aggregations.count.value > 0 ? 'info' : 'ok'),
            top_affected: underutilizedLicenses.body.aggregations.top_licenses.hits.hits.map((h: any) => h._source),
            meta: { total_waste: underutilizedLicenses.body.aggregations.total_waste.value }
          } as RecommendationCard,
          high_cost_waste: {
            count: highCostWasteLicenses.body.aggregations.count.value,
            severity: highCostWasteLicenses.body.aggregations.count.value > 3 ? 'critical' : (highCostWasteLicenses.body.aggregations.count.value > 0 ? 'warning' : 'ok'),
            top_affected: highCostWasteLicenses.body.aggregations.top_licenses.hits.hits.map((h: any) => h._source),
            meta: { total_waste: highCostWasteLicenses.body.aggregations.total_waste.value }
          } as RecommendationCard,
          stale_signins: {
            count: staleSignInUsers.body.aggregations.count.value,
            severity: staleSignInUsers.body.aggregations.count.value > 20 ? 'warning' : (staleSignInUsers.body.aggregations.count.value > 0 ? 'info' : 'ok'),
            top_affected: staleSignInUsers.body.aggregations.top_users.hits.hits.map((h: any) => h._source)
          } as RecommendationCard
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/metrics-trends:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get time-series metrics for graphs
   *     description: Returns trend data for compliance, encryption, online status, and performance metrics over time
   *     parameters:
   *       - in: query
   *         name: days
   *         schema:
   *           type: integer
   *           default: 30
   *         description: Number of days to look back
   *       - in: query
   *         name: interval
   *         schema:
   *           type: string
   *           enum: [hour, day, week, month]
   *           default: day
   *         description: Time interval for aggregation
   *     responses:
   *       200:
   *         description: Time-series metrics data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     compliance_trend:
   *                       type: array
   *                       items:
   *                         type: object
   *                     encryption_trend:
   *                       type: array
   *                     online_trend:
   *                       type: array
   */
  router.get('/metrics-trends', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days = '30', interval = 'day' } = req.query;
      const response = await client.search({
        index: INDICES.DEVICES,
        body: {
          size: 0,
          query: {
            range: {
              lastSyncDateTime: {
                gte: '2020-01-01' // Filter out invalid/historic dates to prevent too_many_buckets_exception
              }
            }
          },
          aggs: {
            over_time: {
              date_histogram: {
                field: 'lastSyncDateTime',
                calendar_interval: interval as string,
                min_doc_count: 0,
                extended_bounds: {
                  min: `now-${days}d`,
                  max: 'now'
                }
              },
              aggs: {
                total_devices: {
                  value_count: { field: 'id' }
                },
                compliant: {
                  filter: { term: { isCompliant: true } }
                },
                non_compliant: {
                  filter: { term: { isCompliant: false } }
                },
                encrypted: {
                  filter: { term: { isEncrypted: true } }
                },
                not_encrypted: {
                  filter: { term: { isEncrypted: false } }
                },
                online_24h: {
                  filter: {
                    range: {
                      lastSyncDateTime: {
                        gte: 'now-24h'
                      }
                    }
                  }
                },
                avg_battery: {
                  avg: { field: 'batteryHealthPercentage' }
                }
              }
            }
          }
        }
      });

      const buckets = response.body.aggregations.over_time.buckets;

      res.json({
        success: true,
        data: {
          compliance_trend: buckets.map((b: any) => ({
            timestamp: b.key_as_string || b.key,
            total: b.total_devices.value,
            compliant: b.compliant.doc_count,
            non_compliant: b.non_compliant.doc_count,
            compliance_rate: b.total_devices.value > 0
              ? (b.compliant.doc_count / b.total_devices.value * 100).toFixed(1)
              : '0'
          })),
          encryption_trend: buckets.map((b: any) => ({
            timestamp: b.key_as_string || b.key,
            total: b.total_devices.value,
            encrypted: b.encrypted.doc_count,
            not_encrypted: b.not_encrypted.doc_count,
            encryption_rate: b.total_devices.value > 0
              ? (b.encrypted.doc_count / b.total_devices.value * 100).toFixed(1)
              : '0'
          })),
          online_trend: buckets.map((b: any) => ({
            timestamp: b.key_as_string || b.key,
            total: b.total_devices.value,
            online: b.online_24h.doc_count,
            online_rate: b.total_devices.value > 0
              ? (b.online_24h.doc_count / b.total_devices.value * 100).toFixed(1)
              : '0'
          })),
          battery_trend: buckets.map((b: any) => ({
            timestamp: b.key_as_string || b.key,
            avg_battery_health: b.avg_battery.value ? b.avg_battery.value.toFixed(1) : null
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/user-insights:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get user-device correlation insights
   *     description: Identifies device hoarders, ghost users, and provides user activity insights
   *     responses:
   *       200:
   *         description: User insights data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     users:
   *                       type: array
   *                       items:
   *                         type: object
   *                     summary:
   *                       type: object
   *                       properties:
   *                         total_users:
   *                           type: number
   *                         device_hoarders:
   *                           type: number
   *                         ghost_users:
   *                           type: number
   *                         avg_devices_per_user:
   *                           type: string
   *                     device_hoarders:
   *                       type: array
   *                     ghost_users:
   *                       type: array
   */
  router.get('/user-insights', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get users with their device counts
      const usersWithDevices = await client.search({
        index: INDICES.USERS,
        body: {
          size: 1000, // Adjust based on org size
          _source: [
            'id',
            'userPrincipalName',
            'displayName',
            'employment.department',
            'employment.jobTitle',
            'devices.summary.totalDevices',
            'devices.managed',
            'account.enabled',
            'dataQuality.lastEnrichedAt'
          ],
        }
      });

      const insights = usersWithDevices.body.hits.hits.map((hit: any) => {
        const user = hit._source;
        const deviceCount = user.devices?.summary?.totalDevices || 0;
        const lastEnriched = user.dataQuality?.lastEnrichedAt
          ? new Date(user.dataQuality.lastEnrichedAt)
          : null;
        const daysSinceActivity = lastEnriched
          ? Math.floor((Date.now() - lastEnriched.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        return {
          id: user.id,
          userPrincipalName: user.userPrincipalName,
          displayName: user.displayName,
          department: user.employment?.department,
          jobTitle: user.employment?.jobTitle,
          deviceCount,
          devices: user.devices?.managed || [],
          accountEnabled: user.account?.enabled ?? true,
          daysSinceActivity,
          // Insight flags
          isDeviceHoarder: deviceCount > 3,
          isGhostUser: deviceCount === 0 && daysSinceActivity > 90,
        };
      });

      // Summary stats
      const deviceHoarders = insights.filter((u: any) => u.isDeviceHoarder);
      const ghostUsers = insights.filter((u: any) => u.isGhostUser);

      res.json({
        success: true,
        data: {
          users: insights,
          summary: {
            total_users: insights.length,
            device_hoarders: deviceHoarders.length,
            ghost_users: ghostUsers.length,
            avg_devices_per_user: (insights.reduce((sum: number, u: any) => sum + u.deviceCount, 0) / insights.length).toFixed(2),
          },
          device_hoarders: deviceHoarders,
          ghost_users: ghostUsers,
        }
      });
    } catch (error) {
      console.error('Error fetching user insights:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user insights',
      });
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/distributions:
   *   get:
   *     tags:
   *       - Analytics
   *     summary: Get deep-dive distribution metrics
   *     description: Returns aggregated data for OS versions, compliance drivers, app stability, and sync freshness
   *     responses:
   *       200:
   *         description: Distribution metrics data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     compliance_drivers:
   *                       type: array
   *                     os_versions:
   *                       type: array
   *                     app_stability:
   *                       type: array
   *                     sync_freshness:
   *                       type: array
   */
  router.get('/distributions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [complianceDrivers, osVersions, appStability, syncFreshness] = await Promise.all([
        // 1. Top Compliance Drivers (Settings causing failure)
        client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              policies_agg: {
                nested: { path: 'compliance.policies' },
                aggs: {
                  setting_states_agg: {
                    nested: { path: 'compliance.policies.settingStates' },
                    aggs: {
                      filter_failures: {
                        filter: { 
                          terms: { 
                            'compliance.policies.settingStates.state': ['nonCompliant', 'error', 'noncompliant'] 
                          } 
                        },
                        aggs: {
                          top_settings: {
                            terms: { field: 'compliance.policies.settingStates.setting', size: 10 }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }),
        // 2. OS Version Fragmentation (Windows 10/11 versions)
        client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              by_os: {
                terms: { field: 'operatingSystem', size: 5 },
                aggs: {
                  versions: {
                    terms: { field: 'osVersion', size: 10 }
                  }
                }
              }
            }
          }
        }),
        // 3. App Stability Hotspots (Top Crashing Apps)
        client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              top_crashes: {
                terms: { field: 'crashes.summary.topApp', size: 10 }
              }
            }
          }
        }),
        // 4. Sync Freshness (Real Online Status)
        client.search({
          index: INDICES.DEVICES,
          body: {
            size: 0,
            aggs: {
              freshness: {
                date_range: {
                  field: 'lastSyncDateTime',
                  ranges: [
                    { key: 'Active (< 24h)', from: 'now-24h' },
                    { key: 'Recent (1-7 days)', from: 'now-7d', to: 'now-24h' },
                    { key: 'Stale (7-30 days)', from: 'now-30d', to: 'now-7d' },
                    { key: 'Ghost (> 30 days)', to: 'now-30d' }
                  ]
                }
              }
            }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          compliance_drivers: complianceDrivers.body.aggregations.policies_agg.setting_states_agg.filter_failures.top_settings.buckets,
          os_versions: osVersions.body.aggregations.by_os.buckets,
          app_stability: appStability.body.aggregations.top_crashes.buckets,
          sync_freshness: syncFreshness.body.aggregations.freshness.buckets
        }
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/device/{id}:
   *   get:
   *     tags: [Analytics]
   *     summary: Get analytics for a specific device
   *     description: Returns historical experience metrics for a device
   */
  router.get('/device/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { range = '30d' } = req.query;

      const response = await client.search({
        index: INDICES.EXPERIENCE_METRICS,
        body: {
          size: 100,
          sort: [{ timestamp: 'desc' }],
          query: {
            bool: {
              must: [
                { term: { deviceId: id } },
                { range: { timestamp: { gte: `now-${range}` } } }
              ]
            }
          }
        }
      });

      res.json({
        success: true,
        data: response.body.hits.hits.map((h: any) => h._source)
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/user/{id}:
   *   get:
   *     tags: [Analytics]
   *     summary: Get analytics for a specific user
   *     description: Returns historical experience metrics for a user's devices
   */
  router.get('/user/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { range = '30d' } = req.query;

      const response = await client.search({
        index: INDICES.EXPERIENCE_METRICS,
        body: {
          size: 100,
          sort: [{ timestamp: 'desc' }],
          query: {
            bool: {
              must: [
                { term: { userId: id } },
                { range: { timestamp: { gte: `now-${range}` } } }
              ]
            }
          }
        }
      });

      res.json({
        success: true,
        data: response.body.hits.hits.map((h: any) => h._source)
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/v2/analytics/events/{id}:
   *   get:
   *     tags: [Analytics]
   *     summary: Get experience events for a device or user
   *     description: Returns events like crashes, hangs, and slow boots for timeline
   */
  router.get('/events/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { range = '30d' } = req.query;

      const response = await client.search({
        index: INDICES.EXPERIENCE_EVENTS,
        body: {
          size: 50,
          sort: [{ timestamp: 'desc' }],
          query: {
            bool: {
              must: [
                { range: { timestamp: { gte: `now-${range}` } } },
                {
                  bool: {
                    should: [
                      { term: { deviceId: id } },
                      { term: { userId: id } }
                    ],
                    minimum_should_match: 1
                  }
                }
              ]
            }
          }
        }
      });

      res.json({
        success: true,
        data: response.body.hits.hits.map((h: any) => h._source)
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
