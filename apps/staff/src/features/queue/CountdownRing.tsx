/**
 * CountdownRing — a 20px SVG ring around the notified-hold bell (§9.3A).
 * `progress` is 0..1 (1 = full hold remaining, 0 = expired). The ring is the
 * host's at-a-glance "how long is this table held" indicator, in the notified
 * (amber) colour. Static SVG — no per-second animation (respects Reduce Motion
 * for free; the parent card already re-renders on the ticker interval).
 */
import Svg, { Circle } from 'react-native-svg';
import { clamp } from '@stoliq/core';

interface CountdownRingProps {
  /** fraction of hold time remaining, 0..1 */
  progress: number;
  color: string;
  size?: number;
  /** stroke width in px */
  stroke?: number;
}

export function CountdownRing({ progress, color, size = 24, stroke = 2.5 }: CountdownRingProps) {
  const p = clamp(progress, 0, 1);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * p;

  return (
    <Svg width={size} height={size}>
      {/* track */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeOpacity={0.22}
        strokeWidth={stroke}
        fill="none"
      />
      {/* remaining arc, drawn from 12 o'clock clockwise */}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}
