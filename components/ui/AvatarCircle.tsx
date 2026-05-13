import { View, Text } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Fonts } from '@/constants/Typography';

const PALETTE = [
  ['#FCE7F5', '#D81FB8'],
  ['#DCFCE7', '#16A34A'],
  ['#DBEAFE', '#2563EB'],
  ['#FEF3C7', '#D97706'],
  ['#EDE9FE', '#7C3AED'],
  ['#FFE4E6', '#E11D48'],
  ['#CFFAFE', '#0E7490'],
  ['#FCE7F3', '#BE185D'],
];

function hashIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % PALETTE.length;
}

interface AvatarCircleProps {
  name: string;
  size?: number;
}

export function AvatarCircle({ name, size = 44 }: AvatarCircleProps) {
  const { isDark } = useTheme();
  const [bg, fg] = PALETTE[hashIndex(name)];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isDark ? fg + '33' : bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: fg, fontFamily: Fonts.extrabold, fontSize: size * 0.4 }}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
