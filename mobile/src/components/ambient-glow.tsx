import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

// Soft radial glows behind the glass cards, matching the design's blurred blob backdrop.
// Rendered as true SVG gradients (not solid circles) so the edges fade out smoothly.
const BLOBS = [
  { id: 'glow-a', cx: '8%', cy: '0%', r: '55%', color: '#0B6FB8', opacity: 0.5 },
  { id: 'glow-b', cx: '100%', cy: '35%', r: '55%', color: '#154A7A', opacity: 0.45 },
  { id: 'glow-c', cx: '15%', cy: '100%', r: '50%', color: '#103256', opacity: 0.4 },
];

export function AmbientGlow() {
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Defs>
        {BLOBS.map((b) => (
          <RadialGradient key={b.id} id={b.id} cx={b.cx} cy={b.cy} r={b.r}>
            <Stop offset="0" stopColor={b.color} stopOpacity={b.opacity} />
            <Stop offset="1" stopColor={b.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {BLOBS.map((b) => (
        <Rect key={b.id} x="0" y="0" width="100%" height="100%" fill={`url(#${b.id})`} />
      ))}
    </Svg>
  );
}
