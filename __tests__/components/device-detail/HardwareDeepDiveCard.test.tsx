import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HardwareDeepDiveCard } from '@/components/device-detail/HardwareDeepDiveCard';
import { DeviceHardwareInfo } from '@/lib/types/device-detail';

describe('HardwareDeepDiveCard', () => {
  const mockMobileDevice: DeviceHardwareInfo = {
    meid: '12345678901234',
    iccid: '8901234567890123456',
    udid: 'a1b2c3d4e5f6789012345678901234abcdef',
    subscriberCarrier: 'Verizon Wireless',
    batterySerialNumber: 'ABC123456789',
    batteryChargeCycles: 245,
    batteryLevelPercentage: 87,
    residentUsersCount: 1,
    productName: 'iPhone 15 Pro',
    deviceFullQualifiedDomainName: null,
  };

  const mockDesktopDevice: DeviceHardwareInfo = {
    meid: null,
    iccid: null,
    udid: null,
    subscriberCarrier: null,
    batterySerialNumber: null,
    batteryChargeCycles: null,
    batteryLevelPercentage: null,
    residentUsersCount: 3,
    productName: 'MacBook Pro 16-inch',
    deviceFullQualifiedDomainName: 'macbook-pro.corp.example.com',
  };

  const mockEmptyDevice: DeviceHardwareInfo = {
    meid: null,
    iccid: null,
    udid: null,
    subscriberCarrier: null,
    batterySerialNumber: null,
    batteryChargeCycles: null,
    batteryLevelPercentage: null,
    residentUsersCount: null,
    productName: null,
    deviceFullQualifiedDomainName: null,
  };

  it('should render card title', () => {
    render(<HardwareDeepDiveCard data={mockMobileDevice} />);
    expect(screen.getByText('Hardware Details')).toBeInTheDocument();
  });

  it('should display mobile identifiers for mobile devices', () => {
    render(<HardwareDeepDiveCard data={mockMobileDevice} />);
    
    expect(screen.getByText('MEID')).toBeInTheDocument();
    expect(screen.getByText('12345678901234')).toBeInTheDocument();
    
    expect(screen.getByText('ICCID')).toBeInTheDocument();
    expect(screen.getByText('8901234567890123456')).toBeInTheDocument();
    
    expect(screen.getByText('UDID')).toBeInTheDocument();
    expect(screen.getByText('a1b2c3d4e5f6789012345678901234abcdef')).toBeInTheDocument();
  });

  it('should display carrier information', () => {
    render(<HardwareDeepDiveCard data={mockMobileDevice} />);
    
    expect(screen.getByText('Carrier')).toBeInTheDocument();
    expect(screen.getByText('Verizon Wireless')).toBeInTheDocument();
  });

  it('should display battery information for mobile devices', () => {
    render(<HardwareDeepDiveCard data={mockMobileDevice} />);
    
    expect(screen.getByText('Battery Serial')).toBeInTheDocument();
    expect(screen.getByText('ABC123456789')).toBeInTheDocument();
    
    expect(screen.getByText('Charge Cycles')).toBeInTheDocument();
    expect(screen.getByText('245')).toBeInTheDocument();
    
    expect(screen.getByText('Battery Level')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('should display product name', () => {
    render(<HardwareDeepDiveCard data={mockMobileDevice} />);
    
    expect(screen.getByText('Product Name')).toBeInTheDocument();
    expect(screen.getByText('iPhone 15 Pro')).toBeInTheDocument();
  });

  it('should display resident users count', () => {
    render(<HardwareDeepDiveCard data={mockDesktopDevice} />);
    
    expect(screen.getByText('Resident Users')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should display FQDN when available', () => {
    render(<HardwareDeepDiveCard data={mockDesktopDevice} />);
    
    expect(screen.getByText('Domain Name')).toBeInTheDocument();
    expect(screen.getByText('macbook-pro.corp.example.com')).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(<HardwareDeepDiveCard data={mockEmptyDevice} />);
    
    expect(screen.getByText('Hardware Details')).toBeInTheDocument();
    expect(screen.getByText('No additional hardware information available')).toBeInTheDocument();
  });

  it('should format battery level with percentage sign', () => {
    render(<HardwareDeepDiveCard data={mockMobileDevice} />);
    
    const batteryLevel = screen.getByText('87%');
    expect(batteryLevel).toBeInTheDocument();
  });

  it('should format charge cycles as number', () => {
    render(<HardwareDeepDiveCard data={mockMobileDevice} />);
    
    const chargeCycles = screen.getByText('245');
    expect(chargeCycles).toBeInTheDocument();
    expect(chargeCycles.textContent).not.toContain('%');
  });
});
