/**
 * CertificateService
 *
 * Handles X.509 certificate generation for Azure App Registration authentication.
 * Provides certificate creation, storage, and rotation capabilities.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import forge from 'node-forge';

export interface CertificateInfo {
  thumbprint: string;
  publicKey: string; // PEM format
  privateKey: string; // PEM format
  pfxData: Buffer; // PKCS#12 format for Azure
  pfxPassword: string; // Password for .pfx file
  expiresAt: Date;
  createdAt: Date;
  subject: string;
}

export interface CertificateGenerationOptions {
  commonName: string;
  validityDays?: number; // Default: 365
  keySize?: number; // Default: 2048
  organization?: string;
  organizationUnit?: string;
  country?: string;
}

export interface CertificateStorage {
  certPath: string; // Path to .crt file
  keyPath: string; // Path to .key file
  pfxPath: string; // Path to .pfx file (PKCS#12)
  thumbprint: string;
}

/**
 * CertificateService - X.509 certificate operations
 *
 * Week 1: Skeleton structure with placeholders
 * Week 4: Full implementation with node-forge
 */
export class CertificateService {
  private certsDir: string;

  constructor(certsDir: string = path.join(process.cwd(), '.certs')) {
    this.certsDir = certsDir;
  }

  /**
   * Generate new X.509 certificate for Azure authentication
   *
   * @param options - Certificate generation options
   * @returns Certificate information including thumbprint and PEM keys
   */
  async generateCertificate(options: CertificateGenerationOptions): Promise<CertificateInfo> {
    const {
      commonName,
      validityDays = 365,
      keySize = 2048,
      organization = 'Device Inventory',
      organizationUnit = 'IT',
      country = 'US'
    } = options;

    // Generate RSA key pair
    const keys = forge.pki.rsa.generateKeyPair(keySize);

    // Create certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01' + crypto.randomBytes(16).toString('hex');

    // Set validity period
    const notBefore = new Date();
    const notAfter = new Date();
    notAfter.setDate(notAfter.getDate() + validityDays);

    cert.validity.notBefore = notBefore;
    cert.validity.notAfter = notAfter;

    // Set subject (self-signed, so subject = issuer)
    const attrs = [
      { name: 'commonName', value: commonName },
      { name: 'organizationName', value: organization },
      { name: 'organizationalUnitName', value: organizationUnit },
      { name: 'countryName', value: country }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Set extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
        keyEncipherment: true
      },
      {
        name: 'extKeyUsage',
        clientAuth: true
      }
    ]);

    // Self-sign certificate
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // Convert to PEM format
    const certPem = forge.pki.certificateToPem(cert);
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

    // Calculate SHA-1 thumbprint (Azure format)
    const thumbprint = this.calculateThumbprint(certPem);

    // Generate password for .pfx file
    const pfxPassword = crypto.randomBytes(16).toString('hex');

    // Create PKCS#12 (.pfx) container
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      [cert],
      pfxPassword,
      {
        algorithm: '3des', // Triple DES for compatibility
        friendlyName: commonName
      }
    );

    // Convert to binary
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const pfxData = Buffer.from(p12Der, 'binary');

    return {
      thumbprint,
      publicKey: certPem,
      privateKey: privateKeyPem,
      pfxData,
      pfxPassword,
      expiresAt: notAfter,
      createdAt: notBefore,
      subject: `CN=${commonName}, O=${organization}, OU=${organizationUnit}, C=${country}`
    };
  }

  /**
   * Store certificate and private key to disk
   *
   * @param cert - Certificate information
   * @param filename - Base filename (without extension)
   * @returns Storage paths
   */
  async storeCertificate(cert: CertificateInfo, filename: string): Promise<CertificateStorage> {
    // Ensure .certs directory exists with secure permissions
    await this.ensureCertsDirectory();

    // Paths for certificate, key, and pfx files
    const certPath = path.join(this.certsDir, `${filename}.crt`);
    const keyPath = path.join(this.certsDir, `${filename}.key`);
    const pfxPath = path.join(this.certsDir, `${filename}.pfx`);

    // Write certificate file (public, readable)
    await fs.writeFile(certPath, cert.publicKey, { mode: 0o644 });

    // Write private key file (owner read/write only)
    await fs.writeFile(keyPath, cert.privateKey, { mode: 0o600 });

    // Write .pfx file (owner read/write only - contains private key)
    await fs.writeFile(pfxPath, cert.pfxData, { mode: 0o600 });

    console.log('[CertificateService] Certificate stored:', {
      certPath,
      keyPath,
      pfxPath,
      thumbprint: cert.thumbprint,
      expiresAt: cert.expiresAt
    });

    return {
      certPath,
      keyPath,
      pfxPath,
      thumbprint: cert.thumbprint
    };
  }

  /**
   * Load certificate from disk
   *
   * @param certPath - Path to certificate file
   * @param keyPath - Path to private key file
   * @returns Certificate information
   *
   * TODO (Week 4): Implement certificate loading
   * - Read and parse PEM files
   * - Calculate thumbprint
   * - Extract expiration date
   * - Validate certificate format
   */
  async loadCertificate(certPath: string, keyPath: string): Promise<CertificateInfo> {
    // Week 1: Placeholder implementation
    throw new Error('Certificate loading not yet implemented (Week 4)');
  }

  /**
   * Calculate SHA-1 thumbprint for certificate (Azure format)
   *
   * @param certPem - Certificate in PEM format
   * @returns Thumbprint as uppercase hex string (no colons)
   */
  calculateThumbprint(certPem: string): string {
    // Parse PEM certificate
    const cert = forge.pki.certificateFromPem(certPem);

    // Convert to DER (binary format)
    const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

    // Calculate SHA-1 hash
    const md = forge.md.sha1.create();
    md.update(derBytes);
    const hash = md.digest();

    // Convert to uppercase hex string (Azure format)
    const thumbprint = hash.toHex().toUpperCase();

    return thumbprint;
  }

  /**
   * Check if certificate is expiring soon
   *
   * @param cert - Certificate information
   * @param daysThreshold - Days before expiration to warn (default: 30)
   * @returns True if expiring within threshold
   */
  isExpiringSoon(cert: CertificateInfo, daysThreshold: number = 30): boolean {
    const now = new Date();
    const daysRemaining = Math.floor(
      (cert.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysRemaining <= daysThreshold;
  }

  /**
   * Rotate certificate (generate new one, upload to Azure, update .env)
   *
   * @param appObjectId - Azure App Registration object ID
   * @param options - Certificate generation options
   * @returns New certificate information
   *
   * TODO (Week 5): Implement rotation flow
   * - Generate new certificate
   * - Upload to Azure App Registration
   * - Update .env with new thumbprint
   * - Keep old cert for grace period
   * - Clean up old cert after verification
   */
  async rotateCertificate(
    appObjectId: string,
    options: CertificateGenerationOptions
  ): Promise<CertificateInfo> {
    // Week 1: Placeholder implementation
    throw new Error('Certificate rotation not yet implemented (Week 5)');

    /*
     * Week 5 implementation plan:
     *
     * 1. Generate new certificate
     * 2. Upload to Azure using Microsoft Graph API:
     *    PATCH /applications/{appObjectId}
     *    Body: { keyCredentials: [...existing, newCert] }
     * 3. Update .env with new thumbprint
     * 4. Test authentication with new cert
     * 5. Remove old cert from Azure (after grace period)
     * 6. Delete old cert files from disk
     */
  }

  /**
   * Prepare certificate for Azure upload (base64-encoded DER)
   *
   * @param certPem - Certificate in PEM format
   * @returns Base64-encoded DER certificate for Azure API
   */
  prepareCertForAzure(certPem: string): string {
    // Parse PEM certificate
    const cert = forge.pki.certificateFromPem(certPem);

    // Convert to DER (binary format)
    const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();

    // Base64 encode for Azure (standard base64, not URL-safe)
    const base64Cert = Buffer.from(derBytes, 'binary').toString('base64');

    return base64Cert;
  }

  /**
   * List all certificates in storage directory
   *
   * @returns Array of certificate file pairs
   */
  async listCertificates(): Promise<Array<{ certPath: string; keyPath: string }>> {
    try {
      const files = await fs.readdir(this.certsDir);
      const certFiles = files.filter(f => f.endsWith('.crt'));

      const pairs = [];
      for (const certFile of certFiles) {
        const baseName = certFile.replace('.crt', '');
        const keyFile = `${baseName}.key`;

        const certPath = path.join(this.certsDir, certFile);
        const keyPath = path.join(this.certsDir, keyFile);

        // Check if key file exists
        try {
          await fs.access(keyPath);
          pairs.push({ certPath, keyPath });
        } catch {
          // Key file missing, skip this cert
          continue;
        }
      }

      return pairs;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return []; // Directory doesn't exist
      }
      throw error;
    }
  }

  /**
   * Delete certificate files from disk
   *
   * @param certPath - Path to certificate file
   * @param keyPath - Path to private key file
   */
  async deleteCertificate(certPath: string, keyPath: string): Promise<void> {
    try {
      await fs.unlink(certPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    try {
      await fs.unlink(keyPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  /**
   * Ensure certificates directory exists with secure permissions
   */
  async ensureCertsDirectory(): Promise<void> {
    await fs.mkdir(this.certsDir, { recursive: true, mode: 0o700 });
  }
}

// Export singleton instance
export const certificateService = new CertificateService();
