import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExchangeActiveSyncCard } from '@/components/device-detail/ExchangeActiveSyncCard';
import { DeviceExchangeActiveSync } from '@/lib/types/device-detail';

describe('ExchangeActiveSyncCard', () => {
  const mockActiveDevice: DeviceExchangeActiveSync = {
    easActivated: true,
    easDeviceId: 'ApplC39ZJ9K4N8X2',
    exchangeLastSuccessfulSyncDateTime: new Date('2026-02-10T10:30:00'),
  };

  const mockInactiveDevice: DeviceExchangeActiveSync = {
    easActivated: false,
    easDeviceId: null,
    exchangeLastSuccessfulSyncDateTime: null,
  };

  const mockEmptyDevice: DeviceExchangeActiveSync = {
    easActivated: null,
    easDeviceId: null,
    exchangeLastSuccessfulSyncDateTime: null,
  };

  it('should render card title', () => {
    render(<ExchangeActiveSyncCard data={mockActiveDevice} />);
    // Use getAllByText since "Exchange ActiveSync" appears in title and description
    const titleElements = screen.getAllByText('Exchange ActiveSync');
    expect(titleElements.length).toBeGreaterThanOrEqual(1);
  });

  it('should display activation status when active', () => {
    render(<ExchangeActiveSyncCard data={mockActiveDevice} />);
    
    expect(screen.getByText('EAS Status')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should display activation status when inactive', () => {
    render(<ExchangeActiveSyncCard data={mockInactiveDevice} />);
    
    expect(screen.getByText('EAS Status')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('should display EAS device ID', () => {
    render(<ExchangeActiveSyncCard data={mockActiveDevice} />);
    
    expect(screen.getByText('Device ID')).toBeInTheDocument();
    expect(screen.getByText('ApplC39ZJ9K4N8X2')).toBeInTheDocument();
  });

  it('should display last sync time', () => {
    render(<ExchangeActiveSyncCard data={mockActiveDevice} />);
    
    expect(screen.getByText('Last Sync')).toBeInTheDocument();
    // Date format check
    expect(screen.getByText(/Feb 10|10 Feb/)).toBeInTheDocument();
  });

  it('should handle empty data gracefully', () => {
    render(<ExchangeActiveSyncCard data={mockEmptyDevice} />);
    
    // Check that title is present
    const titleElements = screen.getAllByText('Exchange ActiveSync');
    expect(titleElements.length).toBeGreaterThanOrEqual(1);
    
    // Check for "Not available" or "Unknown" text
    const notAvailableElements = screen.queryAllByText(/Not available|Unknown/i);
    expect(notAvailableElements.length).toBeGreaterThanOrEqual(2);
  });

  it('should have appropriate email icon', () => {
    render(<ExchangeActiveSyncCard data={mockActiveDevice} />);
    
    // Get the first title element and check for icon
    const cardTitle = screen.getAllByText('Exchange ActiveSync')[0];
    const titleContainer = cardTitle.parentElement;
    expect(titleContainer?.querySelector('svg')).toBeInTheDocument();
  });
});
