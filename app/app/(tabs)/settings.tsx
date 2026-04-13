import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/auth/AuthContext';
import { colors, radius } from '../../src/theme/colors';

export default function SettingsTab() {
  const { user, signOut } = useAuth();
  return (
    <View style={styles.container} testID="settings-tab">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>마이</Text>
      </View>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{user?.name || '사용자'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <Pressable style={styles.signOutBtn} onPress={signOut} testID="sign-out-button">
        <Text style={styles.signOutText}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    marginHorizontal: 20,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accentSoftPink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.accentRose,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  signOutBtn: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
