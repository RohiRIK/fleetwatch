'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

type Frequency = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface CronBuilderProps {
  value: string;
  onChange: (value: string) => void;
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string; cron: string }[] = [
  { value: 'hourly', label: 'Every hour', cron: '0 * * * *' },
  { value: 'hourly', label: 'Every 2 hours', cron: '0 */2 * * *' },
  { value: 'hourly', label: 'Every 6 hours', cron: '0 */6 * * *' },
  { value: 'hourly', label: 'Every 12 hours', cron: '0 */12 * * *' },
  { value: 'daily', label: 'Daily at midnight', cron: '0 0 * * *' },
  { value: 'daily', label: 'Daily at 6 AM', cron: '0 6 * * *' },
  { value: 'daily', label: 'Daily at noon', cron: '0 12 * * *' },
  { value: 'daily', label: 'Daily at 6 PM', cron: '0 18 * * *' },
  { value: 'weekly', label: 'Every Monday', cron: '0 9 * * 1' },
  { value: 'weekly', label: 'Every Friday', cron: '0 17 * * 5' },
  { value: 'monthly', label: '1st of month', cron: '0 9 1 * *' },
  { value: 'monthly', label: '15th of month', cron: '0 9 15 * *' },
];

function parseCronToParts(cron: string): { minute: string; hour: string; dayOfMonth: string; month: string; dayOfWeek: string } {
  const parts = cron.split(' ');
  return {
    minute: parts[0] || '*',
    hour: parts[1] || '*',
    dayOfMonth: parts[2] || '*',
    month: parts[3] || '*',
    dayOfWeek: parts[4] || '*',
  };
}

function buildCron(minute: string, hour: string, dayOfMonth: string, month: string, dayOfWeek: string): string {
  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

function validateCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  
  const patterns = [
    /^(\*|(\*\/[1-9]\d*)|([0-9]{1,2}(-[0-9]{1,2})?(,[0-9]{1,2}(-[0-9]{1,2})?)*))$/,
    /^(\*|(\*\/[1-9]\d*)|([0-9]{1,2}(-[0-9]{1,2})?(,[0-9]{1,2}(-[0-9]{1,2})?)*))$/,
    /^(\*|(\*\/[1-9]\d*)|([1-9]{1,2}(-[1-9]{1,2})?(,[1-9]{1,2}(-[1-9]{1,2})?)*))$/,
    /^(\*|(\*\/[1-9]\d*)|([1-9]{1,2}(-[1-9]{1,2})?(,[1-9]{1,2}(-[1-9]{1,2})?)*))$/,
    /^(\*|(\*\/[1-7])|([0-7](-[0-7])?(,[0-7](-[0-7])?)*))$/,
  ];
  
  return parts.every((part, i) => patterns[i].test(part));
}

function getNextRuns(cron: string, count: number = 5): Date[] {
  if (!validateCron(cron)) return [];
  
  const runs: Date[] = [];
  const parts = parseCronToParts(cron);
  
  let current = new Date();
  current.setSeconds(0, 0);
  
  const maxIterations = 10000;
  let iterations = 0;
  
  while (runs.length < count && iterations < maxIterations) {
    iterations++;
    current = new Date(current.getTime() + 60 * 1000);
    
    const matchesMinute = matchesField(current.getMinutes(), parts.minute);
    const matchesHour = matchesField(current.getHours(), parts.hour);
    const matchesDayOfMonth = matchesField(current.getDate(), parts.dayOfMonth);
    const matchesMonth = matchesField(current.getMonth() + 1, parts.month);
    const matchesDayOfWeek = matchesField(current.getDay(), parts.dayOfWeek);
    
    const dayMatch = parts.dayOfMonth === '*' && parts.dayOfWeek === '*' 
      ? true 
      : parts.dayOfMonth === '*' 
        ? matchesDayOfWeek 
        : parts.dayOfWeek === '*' 
          ? matchesDayOfMonth 
          : matchesDayOfMonth || matchesDayOfWeek;
    
    if (matchesMinute && matchesHour && dayMatch && matchesMonth) {
      runs.push(new Date(current));
    }
  }
  
  return runs;
}

function matchesField(value: number, field: string): boolean {
  if (field === '*') return true;
  
  if (field.startsWith('*/')) {
    const interval = parseInt(field.slice(2));
    return value % interval === 0;
  }
  
  if (field.includes(',')) {
    return field.split(',').some(f => matchesField(value, f));
  }
  
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }
  
  return value === parseInt(field);
}

function formatNextRun(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', weekday: 'short' });
  
  if (hours < 24) {
    return `${timeStr} (in ${hours}h ${minutes}m)`;
  }
  const days = Math.floor(hours / 24);
  return `${timeStr} (in ${days}d ${hours % 24}h)`;
}

export function CronBuilder({ value, onChange }: CronBuilderProps) {
  const [customMode, setCustomMode] = useState(false);
  const [minute, setMinute] = useState('0');
  const [hour, setHour] = useState('*');
  const [dayOfMonth, setDayOfMonth] = useState('*');
  const [month, setMonth] = useState('*');
  const [dayOfWeek, setDayOfWeek] = useState('*');
  
  const parts = useMemo(() => parseCronToParts(value), [value]);
  const isValid = useMemo(() => validateCron(value), [value]);
  const nextRuns = useMemo(() => getNextRuns(value, 5), [value]);
  
  useEffect(() => {
    if (!customMode) {
      setMinute(parts.minute);
      setHour(parts.hour);
      setDayOfMonth(parts.dayOfMonth);
      setMonth(parts.month);
      setDayOfWeek(parts.dayOfWeek);
    }
  }, [customMode, parts]);
  
  const handlePresetChange = (presetCron: string) => {
    onChange(presetCron);
    const presetParts = parseCronToParts(presetCron);
    setMinute(presetParts.minute);
    setHour(presetParts.hour);
    setDayOfMonth(presetParts.dayOfMonth);
    setMonth(presetParts.month);
    setDayOfWeek(presetParts.dayOfWeek);
  };
  
  const handleManualChange = (newValue: string) => {
    onChange(newValue);
  };
  
  const handlePartChange = (part: 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek', newValue: string) => {
    let updatedValue: string;
    switch (part) {
      case 'minute':
        updatedValue = buildCron(newValue, hour, dayOfMonth, month, dayOfWeek);
        setMinute(newValue);
        break;
      case 'hour':
        updatedValue = buildCron(minute, newValue, dayOfMonth, month, dayOfWeek);
        setHour(newValue);
        break;
      case 'dayOfMonth':
        updatedValue = buildCron(minute, hour, newValue, month, dayOfWeek);
        setDayOfMonth(newValue);
        break;
      case 'month':
        updatedValue = buildCron(minute, hour, dayOfMonth, newValue, dayOfWeek);
        setMonth(newValue);
        break;
      case 'dayOfWeek':
        updatedValue = buildCron(minute, hour, dayOfMonth, month, newValue);
        setDayOfWeek(newValue);
        break;
    }
    onChange(updatedValue);
  };
  
  const presetOptions = useMemo(() => {
    const seen = new Set<string>();
    return FREQUENCY_OPTIONS.filter(opt => {
      if (seen.has(opt.cron)) return false;
      seen.add(opt.cron);
      return true;
    });
  }, []);
  
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Schedule Builder
        </CardTitle>
        <CardDescription>
          Choose a preset or customize your sync schedule
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Select
            value={customMode ? 'custom' : value}
            onValueChange={(val) => {
              if (val === 'custom') {
                setCustomMode(true);
              } else {
                setCustomMode(false);
                handlePresetChange(val);
              }
            }}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select schedule" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom">Custom</SelectItem>
              {presetOptions.map((opt) => (
                <SelectItem key={opt.cron} value={opt.cron}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {isValid ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Valid
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Invalid
            </Badge>
          )}
        </div>
        
        {customMode && (
          <div className="grid grid-cols-5 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Minute</Label>
              <Input
                value={minute}
                onChange={(e) => handlePartChange('minute', e.target.value)}
                placeholder="*"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hour</Label>
              <Input
                value={hour}
                onChange={(e) => handlePartChange('hour', e.target.value)}
                placeholder="*"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Day</Label>
              <Input
                value={dayOfMonth}
                onChange={(e) => handlePartChange('dayOfMonth', e.target.value)}
                placeholder="*"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Month</Label>
              <Input
                value={month}
                onChange={(e) => handlePartChange('month', e.target.value)}
                placeholder="*"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Weekday</Label>
              <Input
                value={dayOfWeek}
                onChange={(e) => handlePartChange('dayOfWeek', e.target.value)}
                placeholder="*"
                className="font-mono"
              />
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <Label className="text-sm">Cron Expression</Label>
          <Input
            value={value}
            onChange={(e) => {
              setCustomMode(true);
              handleManualChange(e.target.value);
            }}
            placeholder="0 */6 * * *"
            className="font-mono max-w-[200px]"
          />
        </div>
        
        {isValid && nextRuns.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Next runs:</Label>
            <div className="flex flex-wrap gap-2">
              {nextRuns.map((run, i) => (
                <Badge key={i} variant="outline" className="font-normal">
                  {formatNextRun(run)}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Format:</strong> minute hour day-of-month month day-of-week</p>
          <p><strong>Examples:</strong> <code className="bg-muted px-1 rounded">0 * * * *</code> (hourly) | <code className="bg-muted px-1 rounded">0 9 * * 1</code> (Monday 9am)</p>
        </div>
      </CardContent>
    </Card>
  );
}
