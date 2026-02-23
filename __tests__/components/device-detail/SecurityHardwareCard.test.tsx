import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SecurityHardwareCard } from '@/components/device-detail/SecurityHardwareCard';
import { DeviceSecurityHardware } from '@/lib/types/device-detail';

describe('SecurityHardwareCard', () => {
  const mockSecureDevice: DeviceSecurityHardware = {
    tpmPresent: true,
    secureBootEnabled: true,
    codeIntegrityEnabled: true,
    bootDebuggingEnabled: false,
  };

  const mockInsecureDevice: DeviceSecurityHardware = {
    tpmPresent: false,
    secureBootEnabled: false,
    codeIntegrityEnabled: false,
    bootDebuggingEnabled: true, // Security risk!
  };

  const mockEmptyDevice: DeviceSecurityHardware = {
    tpmPresent: null,
    secureBootEnabled: null,
    codeIntegrityEnabled: null,
    bootDebuggingEnabled: null,
  };

  it('should render card title', () => {
    render(<SecurityHardwareCard data={mockSecureDevice} />);
    expect(screen.getByText('Security Hardware')).toBeInTheDocument();
  });

  it('should display TPM status when present', () => {
    render(<SecurityHardwareCard data={mockSecureDevice} />);
    
    expect(screen.getByText('TPM Present')).toBeInTheDocument();
    // TPM Present = true shows "Enabled" badge
    const enabledBadges = screen.getAllByText('Enabled');
    expect(enabledBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should display TPM status when not present', () => {
    render(<SecurityHardwareCard data={mockInsecureDevice} />);
    
    expect(screen.getByText('TPM Present')).toBeInTheDocument();
    // When TPM is false, it should show "Not Present" badge
    const notPresentBadges = screen.getAllByText('Not Present');
    expect(notPresentBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should display Secure Boot status', () => {
    render(<SecurityHardwareCard data={mockSecureDevice} />);
    
    expect(screen.getByText('Secure Boot')).toBeInTheDocument();
    // Secure Boot enabled shows "Enabled" badge
    const enabledBadges = screen.getAllByText('Enabled');
    expect(enabledBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should show security alert when boot debugging is enabled', () => {
    render(<SecurityHardwareCard data={mockInsecureDevice} />);
    
    expect(screen.getByText('Boot Debugging')).toBeInTheDocument();
    // Boot debugging enabled shows "Security Risk" badge
    // Check that "Security Risk" text exists somewhere on the page
    const pageContent = document.body.textContent;
    expect(pageContent).toContain('Security Risk');
  });

  it('should show overall security status as secure for compliant devices', () => {
    render(<SecurityHardwareCard data={mockSecureDevice} />);
    
    expect(screen.getByText('Overall Security')).toBeInTheDocument();
    expect(screen.getByText('Secure')).toBeInTheDocument();
  });

  it('should show overall security status as at-risk for non-compliant devices', () => {
    render(<SecurityHardwareCard data={mockInsecureDevice} />);
    
    expect(screen.getByText('Overall Security')).toBeInTheDocument();
    expect(screen.getByText('At Risk')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(<SecurityHardwareCard data={mockEmptyDevice} />);
    
    expect(screen.getByText('Security Hardware')).toBeInTheDocument();
    // When all data is null, features show "Unknown" badge
    expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(1);
  });

  it('should have appropriate security icon', () => {
    render(<SecurityHardwareCard data={mockSecureDevice} />);
    
    const cardTitle = screen.getByText('Security Hardware');
    const titleContainer = cardTitle.parentElement;
    expect(titleContainer?.querySelector('svg')).toBeInTheDocument();
  });
});
