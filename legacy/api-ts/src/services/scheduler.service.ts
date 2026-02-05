// Scheduler Service - Manages periodic background tasks
import { CronJob } from 'cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import Redis from 'ioredis';
import { PermissionVerificationService } from './permission-verification.service';

const execAsync = promisify(exec);

export interface SchedulerConfig {
  enabled: boolean;
  fetcherCronSchedule: string; // Default: '*/30 * * * *' (every 30 minutes)
  permissionCronSchedule: string; // Default: '0 * * * *' (every hour)
  fetcherContainerName: string;
}

export interface SchedulerStatus {
  enabled: boolean;
  jobs: {
    fetcher: JobStatus;
    permissions: JobStatus;
  };
}

export interface JobStatus {
  schedule: string;
  nextRun?: Date;
  lastRun?: Date;
  lastResult?: 'success' | 'failed';
  lastError?: string;
  runCount: number;
}

/**
 * Scheduler Service
 * Manages periodic tasks like data fetching and permission verification
 */
export class SchedulerService {
  private fetcherJob?: CronJob;
  private permissionJob?: CronJob;
  private config: SchedulerConfig;
  private status: SchedulerStatus;
  private permissionService: PermissionVerificationService;

  constructor(config: SchedulerConfig, redisClient: Redis | null) {
    this.config = config;
    this.permissionService = new PermissionVerificationService(redisClient);
    this.status = {
      enabled: config.enabled,
      jobs: {
        fetcher: { schedule: config.fetcherCronSchedule, runCount: 0 },
        permissions: { schedule: config.permissionCronSchedule, runCount: 0 }
      }
    };
  }

  /**
   * Start the scheduler and all jobs
   */
  start(): void {
    if (!this.config.enabled) {
      console.log('[Scheduler] Disabled - not starting');
      return;
    }

    console.log('[Scheduler] Starting background jobs...');

    // 1. Fetcher Job
    this.fetcherJob = new CronJob(
      this.config.fetcherCronSchedule,
      async () => await this.runFetcher(),
      null,
      true,
      'UTC'
    );
    this.status.jobs.fetcher.nextRun = this.fetcherJob.nextDate().toJSDate();

    // 2. Permission Verification Job
    this.permissionJob = new CronJob(
      this.config.permissionCronSchedule,
      async () => await this.runPermissionCheck(),
      null,
      true,
      'UTC'
    );
    this.status.jobs.permissions.nextRun = this.permissionJob.nextDate().toJSDate();

    console.log(`[Scheduler] Fetcher job started: ${this.config.fetcherCronSchedule}`);
    console.log(`[Scheduler] Permission job started: ${this.config.permissionCronSchedule}`);
  }

  /**
   * Stop all jobs
   */
  stop(): void {
    this.fetcherJob?.stop();
    this.permissionJob?.stop();
    console.log('[Scheduler] All jobs stopped');
  }

  /**
   * Run Data Fetcher (Restart Docker container)
   */
  async runFetcher(): Promise<void> {
    const startTime = Date.now();
    const job = this.status.jobs.fetcher;
    job.lastRun = new Date();
    job.runCount++;

    console.log(`[Scheduler] Executing Fetcher Job #${job.runCount}`);

    try {
      const { stderr } = await execAsync(`docker restart ${this.config.fetcherContainerName}`);
      if (stderr) console.warn(`[Scheduler] Fetcher stderr: ${stderr}`);
      
      job.lastResult = 'success';
      job.lastError = undefined;
      console.log(`[Scheduler] Fetcher job completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] Fetcher job failed:`, msg);
      job.lastResult = 'failed';
      job.lastError = msg;
    } finally {
      if (this.fetcherJob) job.nextRun = this.fetcherJob.nextDate().toJSDate();
    }
  }

  /**
   * Run Permission Verification
   */
  async runPermissionCheck(): Promise<void> {
    const startTime = Date.now();
    const job = this.status.jobs.permissions;
    job.lastRun = new Date();
    job.runCount++;

    console.log(`[Scheduler] Executing Permission Check Job #${job.runCount}`);

    try {
      await this.permissionService.verifyAllPermissions();
      job.lastResult = 'success';
      job.lastError = undefined;
      console.log(`[Scheduler] Permission check job completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Scheduler] Permission check job failed:`, msg);
      job.lastResult = 'failed';
      job.lastError = msg;
    } finally {
      if (this.permissionJob) job.nextRun = this.permissionJob.nextDate().toJSDate();
    }
  }

  /**
   * Get current status of all jobs
   */
  getStatus(): SchedulerStatus {
    if (this.fetcherJob) this.status.jobs.fetcher.nextRun = this.fetcherJob.nextDate().toJSDate();
    if (this.permissionJob) this.status.jobs.permissions.nextRun = this.permissionJob.nextDate().toJSDate();
    return this.status;
  }

  /**
   * Manual trigger
   */
  async triggerFetcherNow(): Promise<void> {
    await this.runFetcher();
  }

  async triggerPermissionsNow(): Promise<void> {
    await this.runPermissionCheck();
  }

  /**
   * Enable/Disable
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.status.enabled = enabled;
    if (enabled) this.start();
    else this.stop();
  }
}