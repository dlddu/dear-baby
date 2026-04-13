import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { transcribeAudio } from '../src/api/diary';
import { colors } from '../src/theme/colors';

export default function ConvertingScreen() {
  const router = useRouter();
  const { audioUri, duration } = useLocalSearchParams<{
    audioUri: string;
    duration: string;
  }>();
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinAnim]);

  useEffect(() => {
    if (!audioUri) return;

    transcribeAudio(audioUri)
      .then((text) => {
        router.replace({
          pathname: '/edit',
          params: {
            transcribedText: text,
            audioUri,
            duration: duration ?? '0',
            entryType: 'voice',
          },
        });
      })
      .catch(() => {
        // On failure, still navigate to edit screen so user can type manually
        router.replace({
          pathname: '/edit',
          params: {
            transcribedText: '',
            audioUri,
            duration: duration ?? '0',
            entryType: 'voice',
          },
        });
      });
  }, [audioUri, duration, router]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.screen}>
      <View style={styles.animContainer}>
        <Animated.View
          style={[styles.ring, { transform: [{ rotate: spin }] }]}
        />
        <Text style={styles.icon}>✨</Text>
      </View>
      <Text style={styles.title}>음성을 텍스트로 변환 중</Text>
      <Text style={styles.sub}>
        AI가 엄마의 목소리를{'\n'}정성스럽게 기록하고 있어요
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgCream,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  animContainer: {
    width: 100,
    height: 100,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.bgWarm,
    borderTopColor: colors.accentPeach,
    position: 'absolute',
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});
