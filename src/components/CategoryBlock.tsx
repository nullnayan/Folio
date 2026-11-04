import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { AppTheme, withAlpha } from '../theme/colors';
import { CategoryInfo, PDFTool } from '../types/tool';

interface Props {
  category: CategoryInfo;
  tools: PDFTool[];
  language: 'en' | 'hi';
  theme: AppTheme;
  onSelectTool: (tool: PDFTool) => void;
}

export const CategoryBlock: React.FC<Props> = ({
  category,
  tools,
  language,
  theme,
  onSelectTool,
}) => {
  const isHindi = language === 'hi';
  const { width } = useWindowDimensions();
  const s = styles(theme);
  if (tools.length === 0) return null;

  const maxW = Math.min(width, 720);
  const gap = 11;
  const cardW = (maxW - 36 - gap) / 2;

  const tap = (t: PDFTool) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onSelectTool(t);
  };

  return (
    <View style={s.wrap}>
      <View style={s.secHead}>
        <View style={[s.secDot, { backgroundColor: category.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={s.secTitle}>{isHindi ? category.titleHi : category.titleEn}</Text>
          <Text style={s.secDesc}>{isHindi ? category.descHi : category.descEn}</Text>
        </View>
        <View style={[s.countPill, { backgroundColor: withAlpha(category.color, 0.12) }]}>
          <Text style={[s.countTxt, { color: category.color }]}>{tools.length}</Text>
        </View>
      </View>

      <View style={s.grid}>
        {tools.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={[s.card, { width: cardW }]}
            onPress={() => tap(tool)}
            activeOpacity={0.82}
          >
            {tool.badge ? (
              <View style={[s.badge, { backgroundColor: tool.accent }]}>
                <Text style={s.badgeTxt}>{tool.badge}</Text>
              </View>
            ) : null}
            <View
              style={[s.iconTile, { backgroundColor: withAlpha(tool.accent, 0.13) }]}
            >
              <Ionicons name={tool.icon as any} size={25} color={tool.accent} />
            </View>
            <Text style={s.cardTitle} numberOfLines={2}>
              {isHindi ? tool.titleHi : tool.titleEn}
            </Text>
            <Text style={s.cardDesc} numberOfLines={2}>
              {isHindi ? tool.descHi : tool.descEn}
            </Text>
            <View style={s.goRow}>
              <Text style={[s.goTxt, { color: tool.accent }]}>
                {isHindi ? 'शुरू करें' : 'Start'}
              </Text>
              <Ionicons name="arrow-forward-circle" size={19} color={tool.accent} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { marginTop: 18 },
    secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11, paddingHorizontal: 2 },
    secDot: { width: 5, height: 28, borderRadius: 3 },
    secTitle: { fontSize: 17.5, fontWeight: '800', color: theme.text, letterSpacing: -0.2 },
    secDesc: { fontSize: 12, color: theme.textMuted, marginTop: 1, fontWeight: '500' },
    countPill: { minWidth: 30, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
    countTxt: { fontSize: 12.5, fontWeight: '800' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 15,
      paddingTop: 16,
      minHeight: 178,
      shadowColor: theme.shadow,
      shadowOpacity: theme.mode === 'light' ? 1 : 0,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: theme.mode === 'light' ? 3 : 0,
      position: 'relative',
      overflow: 'hidden',
    },
    badge: {
      position: 'absolute',
      top: 0,
      right: 0,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderBottomLeftRadius: 12,
    },
    badgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
    iconTile: {
      width: 52,
      height: 52,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 11,
    },
    cardTitle: { fontSize: 15, fontWeight: '800', color: theme.text, lineHeight: 20, letterSpacing: -0.1 },
    cardDesc: { fontSize: 11.5, color: theme.textSecondary, marginTop: 4, lineHeight: 16, fontWeight: '500' },
    goRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 'auto' as any, paddingTop: 10 },
    goTxt: { fontSize: 12.5, fontWeight: '800' },
  });
