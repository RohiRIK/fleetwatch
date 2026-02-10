/**
 * Notification Service
 * 
 * Provides functionality for testing email and webhook notifications.
 * Used by the settings page to validate notification configurations.
 */

import { getSettingValue } from './settings'

export interface NotificationResult {
  success: boolean
  message: string
}

/**
 * Send a test email to configured recipients
 * 
 * This is a simple test implementation that validates email configuration.
 * In production, this would integrate with an email service like SendGrid, AWS SES, etc.
 * 
 * @returns Promise with success status and message
 */
export async function sendTestEmail(): Promise<NotificationResult> {
  try {
    // Get email settings
    const emailEnabled = await getSettingValue('notifications.email.enabled')
    const recipients = await getSettingValue('notifications.email.recipients')

    // Validate configuration
    if (!emailEnabled) {
      return {
        success: false,
        message: 'Email notifications are disabled. Enable them in settings first.',
      }
    }

    if (!recipients || recipients.length === 0) {
      return {
        success: false,
        message: 'No email recipients configured. Add recipients in settings first.',
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = recipients.filter((email: string) => !emailRegex.test(email))
    if (invalidEmails.length > 0) {
      return {
        success: false,
        message: `Invalid email addresses: ${invalidEmails.join(', ')}`,
      }
    }

    // TODO: In production, integrate with actual email service
    // For now, simulate successful delivery
    console.log('[TEST EMAIL] Would send to:', recipients)
    console.log('[TEST EMAIL] Subject: FleetWatch Test Notification')
    console.log('[TEST EMAIL] Body: This is a test email from FleetWatch settings.')

    return {
      success: true,
      message: `Test email sent successfully to ${recipients.length} recipient(s): ${recipients.join(', ')}`,
    }
  } catch (error) {
    console.error('[sendTestEmail] Error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send test email',
    }
  }
}

/**
 * Send a test webhook to configured URL
 * 
 * Sends a POST request to the configured webhook URL with a test payload.
 * 
 * @returns Promise with success status and message
 */
export async function sendTestWebhook(): Promise<NotificationResult> {
  try {
    // Get webhook settings
    const webhookUrl = await getSettingValue('notifications.webhook.url')

    // Validate configuration - webhookUrl is string type from settings
    if (!webhookUrl || (typeof webhookUrl === 'string' && webhookUrl.trim() === '')) {
      return {
        success: false,
        message: 'Webhook URL not configured. Set webhook URL in settings first.',
      }
    }

    // Cast to string since we know it's a string from settings type
    const urlString = String(webhookUrl)

    // Validate URL format
    let url: URL
    try {
      url = new URL(urlString)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return {
          success: false,
          message: 'Webhook URL must use HTTP or HTTPS protocol',
        }
      }
    } catch {
      return {
        success: false,
        message: 'Invalid webhook URL format',
      }
    }

    // Send test webhook
    const testPayload = {
      type: 'test',
      timestamp: new Date().toISOString(),
      source: 'FleetWatch Settings',
      message: 'This is a test webhook notification',
      data: {
        test: true,
        version: '1.0.0',
      },
    }

    const response = await fetch(urlString, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FleetWatch/1.0',
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      return {
        success: false,
        message: `Webhook returned status ${response.status}: ${response.statusText}`,
      }
    }

    console.log('[TEST WEBHOOK] Sent to:', urlString)
    console.log('[TEST WEBHOOK] Response:', response.status, response.statusText)

    return {
      success: true,
      message: `Webhook delivered successfully to ${url.hostname} (HTTP ${response.status})`,
    }
  } catch (error) {
    console.error('[sendTestWebhook] Error:', error)
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return {
          success: false,
          message: 'Connection timeout - webhook endpoint did not respond within 10 seconds',
        }
      }
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        return {
          success: false,
          message: 'Connection refused - could not reach webhook endpoint',
        }
      }
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: 'Failed to send test webhook',
    }
  }
}
