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
    // When TPM is false, it should show "No" badge
    const noBadges = screen.getAllByText('No');
    expect(noBadges.length).toBeGreaterThanOrEqual(1);
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
    // Boot debugging enabled shows "Enabled (Security Risk)" text
    const pageContent = document.body.textContent;
    expect(pageContent).toContain('Enabled (Security Risk)');
  });

  it('should render all security hardware fields for secure device', () => {
    render(<SecurityHardwareCard data={mockSecureDevice} />);
    
    expect(screen.getByText('TPM Present')).toBeInTheDocument();
    expect(screen.getByText('Secure Boot')).toBeInTheDocument();
    expect(screen.getByText('Code Integrity')).toBeInTheDocument();
    expect(screen.getByText('Boot Debugging')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(<SecurityHardwareCard data={mockEmptyDevice} />);
    
    expect(screen.getByText('Security Hardware')).toBeInTheDocument();
    // When all data is null, it shows "No security hardware information available"
    expect(screen.getByText('No security hardware information available')).toBeInTheDocument();
  });

  it('should have appropriate security icon', () => {
    render(<SecurityHardwareCard data={mockSecureDevice} />);
    
    const cardTitle = screen.getByText('Security Hardware');
    const titleContainer = cardTitle.parentElement;
    expect(titleContainer?.querySelector('svg')).toBeInTheDocument();
  });
});
