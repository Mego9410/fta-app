import FontAwesome from '@expo/vector-icons/FontAwesome';
import { StyleSheet, TextInput, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { ui } from '@/src/ui/theme';

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
}) {
  const containerStyle = {
    borderRadius: ui.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#E5E5E5',
    minHeight: 44,
    width: '100%',
  };
  
  const iconColor = '#333333';
  const placeholderColor = '#666666';
  const textColor = '#000000';
  
  return (
    <View style={containerStyle}>
      <FontAwesome name="search" size={16} color={iconColor} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? 'Search'}
        placeholderTextColor={placeholderColor}
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: textColor,
          backgroundColor: 'transparent',
          padding: 0,
          margin: 0,
        }}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        underlineColorAndroid="transparent"
      />
    </View>
  );
}

