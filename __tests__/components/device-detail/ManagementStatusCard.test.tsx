import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManagementStatusCard } from '@/components/device-detail/ManagementStatusCard';
import { DeviceManagementInfo } from '@/lib/types/device-detail';

describe('ManagementStatusCard', () => {
  const mockManagedDevice: DeviceManagementInfo = {
    managementAgent: 'mdm',
    managementCertificateExpirationDate: new Date('2025-12-31'),
    managementFeatures: 'DeviceConfiguration,CompliancePolicy',
    remoteAssistanceSessionUrl: 'https://help.example.com/session/abc123',
    remoteAssistanceSessionErrorDetails: null,
    requireUserEnrollmentApproval: true,
    enrollmentProfileName: 'Corporate iOS Enrollment',
  };

  const mockEmptyDevice: DeviceManagementInfo = {
    managementAgent: null,
    managementCertificateExpirationDate: null,
    managementFeatures: null,
    remoteAssistanceSessionUrl: null,
    remoteAssistanceSessionErrorDetails: null,
    requireUserEnrollmentApproval: null,
    enrollmentProfileName: null,
  };

  it('should render card title', () => {
    render(<ManagementStatusCard data={mockManagedDevice} />);
    expect(screen.getByText('Management')).toBeInTheDocument();
  });

  it('should display management agent type', () => {
    render(<ManagementStatusCard data={mockManagedDevice} />);
    
    expect(screen.getByText('Management Agent')).toBeInTheDocument();
    expect(screen.getByText('mdm')).toBeInTheDocument();
  });

  it('should display enrollment profile name', () => {
    render(<ManagementStatusCard data={mockManagedDevice} />);
    
    expect(screen.getByText('Enrollment Profile')).toBeInTheDocument();
    expect(screen.getByText('Corporate iOS Enrollment')).toBeInTheDocument();
  });

  it('should display certificate expiration date', () => {
    render(<ManagementStatusCard data={mockManagedDevice} />);
    
    expect(screen.getByText('Certificate Expires')).toBeInTheDocument();
    expect(screen.getByText(/Dec 31, 2025|31 Dec 2025/)).toBeInTheDocument();
  });

  it('should display management features', () => {
    render(<ManagementStatusCard data={mockManagedDevice} />);
    
    expect(screen.getByText('Features')).toBeInTheDocument();
    expect(screen.getByText('DeviceConfiguration,CompliancePolicy')).toBeInTheDocument();
  });

  it('should display user enrollment approval status', () => {
    render(<ManagementStatusCard data={mockManagedDevice} />);
    
    expect(screen.getByText('Requires Approval')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('should display remote assistance URL when available', () => {
    render(<ManagementStatusCard data={mockManagedDevice} />);
    
    expect(screen.getByText('Remote Assistance')).toBeInTheDocument();
    expect(screen.getByText('Session Link')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(<ManagementStatusCard data={mockEmptyDevice} />);
    
    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.getByText('No management information available')).toBeInTheDocument();
  });
});
