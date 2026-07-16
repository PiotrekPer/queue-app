/**
 * QueueButton — a chunky, one-handed action button for the Kolejka rail (§9.3A).
 * Big touch targets (≥48px, primary 56px), instant press feedback, and colour
 * that means status (§9.2). Never says OK/Wyślij — the label is the verb (§9.5).
 */
import { Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'ready' | 'danger' | 'neutral';

interface QueueButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  /** small inline variant for the hold-expired 3-button row */
  compact?: boolean;
  color?: string;
}

const VARIANT_BG: Record<Variant, string> = {
  primary: 'bg-notified-dark',
  ready: 'bg-ready-fill',
  danger: 'bg-danger-dark',
  neutral: 'bg-walnut-hi',
};

export function QueueButton({
  label,
  variant = 'primary',
  compact = false,
  color,
  ...rest
}: QueueButtonProps) {
  const bg = color ? '' : VARIANT_BG[variant];
  const textClass =
    variant === 'neutral' ? 'text-steam' : 'text-espresso';

  return (
    <Pressable
      accessibilityRole="button"
      className={`${bg} items-center justify-center rounded-control ${
        compact ? 'h-touch-min px-3' : 'h-touch-primary px-5'
      } active:opacity-80`}
      style={color ? { backgroundColor: color } : undefined}
      {...rest}
    >
      <Text
        className={`font-ui text-body ${textClass}`}
        style={{ fontWeight: '600' }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
