import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@utils/designSystem/tokens';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  style,
}) => {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: disabled ? colors.muted : colors.ink,
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: colors.paper,
          borderWidth: 1,
          borderColor: colors.line,
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.accentSoft,
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontFamily: typography.fonts.sans,
      fontWeight: typography.weights.semibold,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          color: disabled ? colors.line : 'white',
        };
      case 'secondary':
        return {
          ...baseStyle,
          color: colors.ink,
        };
      case 'ghost':
        return {
          ...baseStyle,
          color: colors.accent,
        };
      default:
        return baseStyle;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'small':
        return { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm };
      case 'medium':
        return { paddingHorizontal: spacing.xl, paddingVertical: spacing.md };
      case 'large':
        return { paddingHorizontal: spacing.xxxl, paddingVertical: spacing.lg };
      default:
        return { paddingHorizontal: spacing.xl, paddingVertical: spacing.md };
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), getSizeStyle(), style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[getTextStyle(), typography.sizes.small]}>{title}</Text>
    </TouchableOpacity>
  );
};
