import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '@utils/designSystem/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'medium',
}) => {
  const getPaddingStyle = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return {};
      case 'small':
        return { padding: spacing.md };
      case 'medium':
        return { padding: spacing.lg };
      case 'large':
        return { padding: spacing.xxl };
      default:
        return { padding: spacing.lg };
    }
  };

  return (
    <View
      style={[
        styles.card,
        getPaddingStyle(),
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.phoneBg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: borderRadius.xl,
  },
});
