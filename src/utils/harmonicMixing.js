// Camelot Wheel & Harmonic Mixing Utility
// Maps Camelot codes (1A-12A for minor, 1B-12B for major)
// Industry standard harmonic compatibility logic

export const CAMELOT_COLORS = {
  '1A': '#00bcd4', '1B': '#4dd0e1',
  '2A': '#00acc1', '2B': '#26c6da',
  '3A': '#0097a7', '3B': '#00e5ff',
  '4A': '#00838f', '4B': '#18ffff',
  '5A': '#00695c', '5B': '#64ffda',
  '6A': '#2e7d32', '6B': '#69f0ae',
  '7A': '#388e3c', '7B': '#b9f6ca',
  '8A': '#689f38', '8B': '#ccff90',
  '9A': '#fbc02d', '9B': '#ffff8d',
  '10A': '#f57c00', '10B': '#ffd180',
  '11A': '#e64a19', '11B': '#ffab91',
  '12A': '#d32f2f', '12B': '#ff8a80'
};

export function parseCamelot(camelotStr) {
  if (!camelotStr) return null;
  const match = camelotStr.trim().toUpperCase().match(/^(\d{1,2})([AB])$/);
  if (!match) return null;
  return {
    num: parseInt(match[1], 10),
    letter: match[2]
  };
}

/**
 * Returns harmonic relationship between master track and candidate track:
 * - 'exact': Same key (e.g. 8A to 8A) - Perfect harmonic lock
 * - 'adjacent': +1 or -1 on wheel (e.g. 8A to 7A or 9A) - Smooth musical transition
 * - 'relative': Same number, A <-> B (e.g. 8A to 8B) - Relative Major/Minor shift
 * - 'boost': +2 steps on wheel (e.g. 8A to 10A) - Energetic lift
 * - 'clash': Incompatible keys
 */
export function getHarmonicRelationship(masterCamelot, targetCamelot) {
  const c1 = parseCamelot(masterCamelot);
  const c2 = parseCamelot(targetCamelot);

  if (!c1 || !c2) return { type: 'unknown', label: '', score: 0, isCompatible: false };

  // 1. Exact match
  if (c1.num === c2.num && c1.letter === c2.letter) {
    return {
      type: 'exact',
      label: 'Perfect Key Lock',
      badge: 'HARMONIC MATCH',
      color: '#10b981', // emerald
      score: 100,
      isCompatible: true
    };
  }

  // 2. Relative Major / Minor (same number, A <-> B)
  if (c1.num === c2.num && c1.letter !== c2.letter) {
    return {
      type: 'relative',
      label: c2.letter === 'B' ? 'Relative Major' : 'Relative Minor',
      badge: 'RELATIVE KEY',
      color: '#06b6d4', // cyan
      score: 90,
      isCompatible: true
    };
  }

  // 3. Adjacent keys (+1 or -1 on 12-hour wheel)
  const diff = (c2.num - c1.num + 12) % 12;
  if (c1.letter === c2.letter) {
    if (diff === 1) {
      return {
        type: 'adjacent',
        label: '+1 Energy Step',
        badge: '+1 HARMONIC',
        color: '#3b82f6', // blue
        score: 85,
        isCompatible: true
      };
    }
    if (diff === 11) {
      return {
        type: 'adjacent',
        label: '-1 Energy Step',
        badge: '-1 HARMONIC',
        color: '#6366f1', // indigo
        score: 85,
        isCompatible: true
      };
    }

    // 4. Energy Boost (+2 semitones / +2 on wheel)
    if (diff === 2) {
      return {
        type: 'boost',
        label: '+2 Energy Boost',
        badge: 'ENERGY LIFT',
        color: '#f59e0b', // amber
        score: 75,
        isCompatible: true
      };
    }
  }

  // Key clash
  return {
    type: 'clash',
    label: 'Key Shift',
    badge: '',
    color: '#64748b',
    score: 20,
    isCompatible: false
  };
}
