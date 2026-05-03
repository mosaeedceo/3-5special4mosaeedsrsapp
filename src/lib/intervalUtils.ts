import { DEFAULT_INTERVALS } from '@/types/lesson';

const PRESETS: Record<string, number[]> = {
  'Standard': [1, 1, 4, 7, 14, 30],
  'Aggressive': [1, 2, 4, 7, 14],
  'Relaxed': [1, 3, 7, 14, 30, 60],
};

export const getPresetName = (intervals: number[] | undefined, globalIntervals?: number[]): string => {
  if (!intervals) {
    // Using global settings - check what preset the global matches
    const checkIntervals = globalIntervals || DEFAULT_INTERVALS;
    for (const [name, preset] of Object.entries(PRESETS)) {
      if (JSON.stringify(checkIntervals) === JSON.stringify(preset)) {
        return name;
      }
    }
    return 'Custom';
  }
  
  // Check if custom intervals match any preset
  for (const [name, preset] of Object.entries(PRESETS)) {
    if (JSON.stringify(intervals) === JSON.stringify(preset)) {
      return name;
    }
  }
  
  return 'Custom';
};
