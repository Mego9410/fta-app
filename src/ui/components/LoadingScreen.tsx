import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

export function LoadingScreen({ compact = false, fadeOut = false }: { compact?: boolean; fadeOut?: boolean }) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.95);
  const containerOpacity = useSharedValue(1);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Reset animation values when component mounts
    opacity.value = 0;
    scale.value = 0.95;
    containerOpacity.value = 1;
    
    // Fade in and scale up animation on mount
    opacity.value = withTiming(1, { duration: 800 });
    scale.value = withSequence(
      withTiming(1, { duration: 800 }),
      withDelay(
        200,
        withRepeat(
          withSequence(
            withTiming(1.02, { duration: 1500 }),
            withTiming(1, { duration: 1500 })
          ),
          -1,
          false
        )
      )
    );
  }, []);

  useEffect(() => {
    if (fadeOut) {
      // Fade out the entire container smoothly
      containerOpacity.value = withTiming(0, { duration: 600 });
    }
  }, [fadeOut]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: containerOpacity.value,
    };
  });

  if (compact) {
    return (
      <View style={styles.containerCompact}>
        <Animated.View style={animatedStyle}>
          <Image
            accessibilityLabel="Frank Taylor & Associates logo"
            source={require('../../../assets/images/FTA.jpg')}
            style={styles.logoCompact}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[styles.container, containerAnimatedStyle]}
      pointerEvents={fadeOut ? 'none' : 'auto'}>
      <Animated.View style={animatedStyle}>
        <Image
          accessibilityLabel="Frank Taylor & Associates logo"
          source={require('../../../assets/images/FTA.jpg')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerCompact: {
    width: '100%',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  logo: {
    width: 200,
    height: 200,
    maxWidth: '80%',
    maxHeight: '40%',
  },
  logoCompact: {
    width: 120,
    height: 120,
    maxWidth: '60%',
  },
});
