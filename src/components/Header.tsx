import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '../theme/colors';

interface HeaderProps {
  language: 'en' | 'hi';
  onToggleLanguage: () => void;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  theme: AppTheme;
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onToggleLanguage,
  searchQuery,
  onSearchChange,
  theme,
  mode,
  onToggleTheme,
}) => {
  const isHindi = language === 'hi';
  const s = styles(theme);

  return (
    <View style={s.container}>
      {/* Brand row */}
      <View style={s.topRow}>
        <View style={s.brandLeft}>
          <View style={s.logoRing}>
            <Image source={require('../../assets/icon.png')} style={s.logo} />
          </View>
          <View style={{ flexShrink: 1, justifyContent: 'center' }}>
            <Text style={s.brandTitle}>Folio</Text>
          </View>
        </View>

        <View style={s.actions}>
          <TouchableOpacity
            onPress={onToggleTheme}
            style={s.iconBtn}
            activeOpacity={0.7}
            accessibilityLabel="Toggle theme"
          >
            <Ionicons
              name={mode === 'dark' ? 'sunny' : 'moon'}
              size={19}
              color={mode === 'dark' ? theme.gold : theme.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggleLanguage} style={s.langBtn} activeOpacity={0.7}>
            <Text style={[s.langMain, isHindi && s.langMainHi]}>
              {isHindi ? 'हिं' : 'EN'}
            </Text>
            <Text style={s.langSub}>{isHindi ? 'EN' : 'हिं'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Big search */}
      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <View style={s.searchIconBox}>
            <Ionicons name="search" size={19} color={theme.textMuted} />
          </View>
          <TextInput
            style={s.searchInput}
            placeholder={
              isHindi ? 'लिखें: फोटो को PDF, जोड़ें…' : 'Try: photo ko pdf, jodo…'
            }
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              onPress={() => onSearchChange('')}
              style={s.clearBtn}
              hitSlop={12}
            >
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          ) : (
            <View style={s.kbdHint}>
              <Ionicons name="mic-outline" size={18} color={theme.textMuted} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 6,
      backgroundColor: theme.background,
      maxWidth: 720,
      width: '100%' as any,
      alignSelf: 'center',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
    logoRing: {
      width: 50,
      height: 50,
      borderRadius: 17,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOpacity: theme.mode === 'light' ? 1 : 0,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: theme.mode === 'light' ? 3 : 0,
    },
    logo: { width: 38, height: 38, borderRadius: 12 },
    brandTitle: { fontSize: 21, fontWeight: '800', color: theme.text, letterSpacing: 0.2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    langBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 42,
      paddingHorizontal: 13,
      borderRadius: 14,
      backgroundColor: theme.mode === 'dark' ? theme.primarySoft : theme.primary,
      borderWidth: 1,
      borderColor: theme.mode === 'dark' ? theme.primaryBorder : theme.primary,
    },
    langMain: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.mode === 'dark' ? theme.primary : '#fff',
    },
    langMainHi: { fontSize: 15 },
    langSub: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.mode === 'dark' ? theme.textSecondary : 'rgba(255,255,255,0.75)',
    },
    searchWrap: { marginTop: 4, marginBottom: 4 },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.searchBg,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: theme.border,
      paddingLeft: 6,
      paddingRight: 8,
      minHeight: 58,
      shadowColor: theme.shadow,
      shadowOpacity: theme.mode === 'light' ? 1 : 0,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: theme.mode === 'light' ? 4 : 0,
    },
    searchIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    searchInput: { flex: 1, fontSize: 15.5, color: theme.text, paddingVertical: 10, fontWeight: '500' },
    clearBtn: { padding: 8 },
    kbdHint: { padding: 8, opacity: 0.7 },
  });
