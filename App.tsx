import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DarkTheme, LightTheme, AppTheme, withAlpha } from './src/theme/colors';
import { ThemeProvider } from './src/theme/ThemeContext';
import { Header } from './src/components/Header';
import { CategoryBlock } from './src/components/CategoryBlock';
import { ToolActionModal } from './src/components/ToolActionModal';
import { CATEGORIES, TOOLS, POPULAR_IDS } from './src/data/tools';
import { smartSearch } from './src/lib/smart-search';
import { PDFTool, ToolCategory } from './src/types/tool';

type Tab = 'home' | 'tools' | 'settings';

export default function App() {
  return <Root />;
}

function Root() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const theme = mode === 'dark' ? DarkTheme : LightTheme;
  return (
    <SafeAreaProvider>
      <ThemeProvider theme={theme}>
        <ThemedApp theme={theme} mode={mode} onToggleTheme={() => setMode(mode === 'dark' ? 'light' : 'dark')} setMode={setMode} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp({
  theme,
  mode,
  onToggleTheme,
  setMode,
}: {
  theme: AppTheme;
  mode: 'light' | 'dark';
  onToggleTheme: () => void;
  setMode: (m: 'light' | 'dark') => void;
}) {
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'all'>('all');
  const [activeTool, setActiveTool] = useState<PDFTool | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const isHindi = language === 'hi';
  const insets = useSafeAreaInsets();
  const s = styles(theme);
  const { width } = useWindowDimensions();

  const filteredTools = useMemo(() => {
    const base =
      selectedCategory === 'all' ? TOOLS : TOOLS.filter((t) => t.category === selectedCategory);
    if (!searchQuery.trim()) return base;
    // smart offline search understands "photo ko pdf", "jodo", "chhota karo" etc.
    const hits = smartSearch(TOOLS, searchQuery);
    if (selectedCategory === 'all') return hits;
    const ids = new Set(hits.map((t) => t.id));
    return base.filter((t) => ids.has(t.id));
  }, [searchQuery, selectedCategory]);

  const popular = useMemo(() => POPULAR_IDS.map((id) => TOOLS.find((t) => t.id === id)!).filter(Boolean), []);

  const buzz = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };

  const openTool = (t: PDFTool) => {
    buzz();
    setActiveTool(t);
  };

  const searching = searchQuery.trim().length > 0;
  const maxW = Math.min(width, 720);
  const gap = 11;
  const quickW = (maxW - 36 - gap) / 2;

  const visibleCats =
    activeTab === 'home'
      ? CATEGORIES.filter((c) => selectedCategory === 'all' || selectedCategory === c.id)
      : CATEGORIES.filter((c) => selectedCategory === 'all' || selectedCategory === c.id);

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.background}
      />
      <Header
        language={language}
        onToggleLanguage={() => {
          buzz();
          setLanguage(language === 'en' ? 'hi' : 'en');
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        theme={theme}
        mode={mode}
        onToggleTheme={onToggleTheme}
      />

      {activeTab === 'settings' ? (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.pageNarrow}>
            <Text style={s.pageTitle}>{isHindi ? 'सेटिंग और जानकारी' : 'Settings & info'}</Text>

            {/* Appearance */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{isHindi ? 'दिखावट चुनें' : 'Choose look'}</Text>
              <Text style={s.cardSub}>
                {isHindi ? 'आंखों के आराम के हिसाब से दिन या रात वाला रंग।' : 'Day or night colours — whatever feels easy on eyes.'}
              </Text>
              <View style={s.themeRow}>
                {(['light', 'dark'] as const).map((m) => {
                  const on = mode === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[s.themeOpt, on && { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}
                      onPress={() => setMode(m)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={m === 'light' ? 'sunny' : 'moon'}
                        size={22}
                        color={on ? theme.primary : theme.textMuted}
                      />
                      <Text style={[s.themeOptTxt, on && { color: theme.primary }]}>
                        {m === 'light' ? (isHindi ? 'दिन (उजाला)' : 'Day (Light)') : isHindi ? 'रात (अंधेरा)' : 'Night (Dark)'}
                      </Text>
                      {on && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Language */}
            <View style={s.card}>
              <Text style={s.cardTitle}>{isHindi ? 'भाषा' : 'Language'}</Text>
              <View style={s.themeRow}>
                {(['en', 'hi'] as const).map((l) => {
                  const on = language === l;
                  return (
                    <TouchableOpacity
                      key={l}
                      style={[s.themeOpt, on && { borderColor: theme.primary, backgroundColor: theme.primarySoft }]}
                      onPress={() => setLanguage(l)}
                    >
                      <Text style={[s.langBig, on && { color: theme.primary }]}>
                        {l === 'en' ? 'English' : 'हिंदी'}
                      </Text>
                      {on && <Ionicons name="checkmark-circle" size={18} color={theme.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Trust */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Folio • {isHindi ? 'प्राइवेट और ऑफलाइन' : 'Private & Offline'}</Text>
              <Text style={s.cardSub}>
                {isHindi
                  ? 'आप आराम करें — सारा PDF काम फोन के अंदर ही होता है। इंटरनेट, साइन-अप या विज्ञापन कुछ नहीं।'
                  : 'You relax — every PDF job happens inside your phone. No internet, no sign-up, no ads.'}
              </Text>
              {[
                { i: 'shield-checkmark', t: isHindi ? 'फाइल फोन से बाहर नहीं जाती' : 'Files never leave your phone' },
                { i: 'airplane', t: isHindi ? 'हवाई जहाज मोड में भी चलता है' : 'Works even in airplane mode' },
                { i: 'logo-whatsapp', t: isHindi ? '1 बार दबाकर WhatsApp पर भेजें' : 'One tap share to WhatsApp' },
              ].map((r) => (
                <View key={r.i} style={s.trustRow}>
                  <Ionicons name={r.i as any} size={19} color={theme.success} />
                  <Text style={s.trustTxt}>{r.t}</Text>
                </View>
              ))}
              <View style={s.verRow}>
                <Text style={s.verTxt}>Folio v1.0 • Offline PDF Studio</Text>
              </View>
            </View>
            <View style={{ height: 30 }} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.pageNarrow}>
            {/* Quick — most used */}
            {!searching && (
              <View style={s.quickHead}>
                <Text style={s.secH}>{isHindi ? 'सबसे ज्यादा काम के' : 'Most useful'}</Text>
                <TouchableOpacity onPress={() => { buzz(); setActiveTab('tools'); setSelectedCategory('all'); }}>
                  <Text style={s.seeAll}>{isHindi ? 'सभी देखें →' : 'See all →'}</Text>
                </TouchableOpacity>
              </View>
            )}
            {!searching && (
              <View style={s.quickGrid}>
                {popular.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[s.quickCard, { width: quickW }]}
                    onPress={() => openTool(t)}
                    activeOpacity={0.85}
                  >
                    <View style={[s.quickIcon, { backgroundColor: withAlpha(t.accent, 0.13) }]}>
                      <Ionicons name={t.icon as any} size={26} color={t.accent} />
                    </View>
                    <Text style={s.quickTitle} numberOfLines={2}>
                      {isHindi ? t.titleHi : t.titleEn}
                    </Text>
                    <Text style={s.quickSub} numberOfLines={1}>
                      {isHindi ? t.ctaHi : t.ctaEn} →
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Category chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
              <TouchableOpacity
                style={[s.chip, selectedCategory === 'all' && s.chipOn]}
                onPress={() => setSelectedCategory('all')}
              >
                <Ionicons
                  name="apps"
                  size={15}
                  color={selectedCategory === 'all' ? '#fff' : theme.textSecondary}
                />
                <Text style={[s.chipTxt, selectedCategory === 'all' && s.chipTxtOn]}>
                  {isHindi ? 'सभी' : 'All'}
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map((c) => {
                const on = selectedCategory === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[s.chip, on && { backgroundColor: c.color, borderColor: c.color }]}
                    onPress={() => setSelectedCategory(on ? 'all' : c.id)}
                  >
                    <Ionicons name={c.icon as any} size={15} color={on ? '#fff' : c.color} />
                    <Text style={[s.chipTxt, on && s.chipTxtOn]}>
                      {isHindi ? c.titleHi : c.titleEn}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Search results or grouped tools */}
            {searching ? (
              <View style={{ marginTop: 6 }}>
                <Text style={s.resultH}>
                  {isHindi ? `${filteredTools.length} काम मिले` : `${filteredTools.length} found`}
                </Text>
                {filteredTools.map((t) => (
                  <TouchableOpacity key={t.id} style={s.resultCard} onPress={() => openTool(t)} activeOpacity={0.8}>
                    <View style={[s.resultIcon, { backgroundColor: withAlpha(t.accent, 0.12) }]}>
                      <Ionicons name={t.icon as any} size={21} color={t.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.resultTitle}>{isHindi ? t.titleHi : t.titleEn}</Text>
                      <Text style={s.resultDesc} numberOfLines={1}>
                        {isHindi ? t.descHi : t.descEn}
                      </Text>
                    </View>
                    <View style={[s.resultGo, { backgroundColor: withAlpha(t.accent, 0.12) }]}>
                      <Ionicons name="arrow-forward" size={17} color={t.accent} />
                    </View>
                  </TouchableOpacity>
                ))}
                {filteredTools.length === 0 && (
                  <View style={s.empty}>
                    <Ionicons name="search-outline" size={42} color={theme.textMuted} />
                    <Text style={s.emptyT}>{isHindi ? 'कुछ नहीं मिला' : 'Nothing found'}</Text>
                    <Text style={s.emptyS}>
                      {isHindi ? 'जैसे लिखें: फोटो, जोड़ें, छोटा' : 'Try: photo, join, shrink'}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              visibleCats.map((cat) => (
                <CategoryBlock
                  key={cat.id}
                  category={cat}
                  tools={TOOLS.filter((t) => t.category === cat.id).filter((t) =>
                    activeTab === 'home' ? true : true
                  )}
                  language={language}
                  theme={theme}
                  onSelectTool={openTool}
                />
              ))
            )}

            {/* Trust strip */}
            {!searching && (
              <View style={s.strip}>
                <Ionicons name="shield-checkmark" size={18} color={theme.success} />
                <Text style={s.stripTxt}>
                  {isHindi ? 'बिना इंटरनेट • बिना साइन-अप • WhatsApp शेयर' : 'No internet • No sign-up • WhatsApp share'}
                </Text>
              </View>
            )}
            <View style={{ height: 26 }} />
          </View>
        </ScrollView>
      )}

      {/* Floating bottom bar */}
      <View style={[s.tabWrap, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={s.tabBar}>
          {(
            [
              { id: 'home', en: 'Home', hi: 'होम', icon: 'home' },
              { id: 'tools', en: 'All tools', hi: 'सभी काम', icon: 'grid' },
              { id: 'settings', en: 'Settings', hi: 'सेटिंग', icon: 'settings' },
            ] as const
          ).map((t) => {
            const on = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.tabItem, on && s.tabItemOn]}
                onPress={() => {
                  buzz();
                  setActiveTab(t.id as Tab);
                  if (t.id !== 'settings') setSelectedCategory('all');
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={(on ? t.icon : `${t.icon}-outline`) as any}
                  size={21}
                  color={on ? '#fff' : theme.textMuted}
                />
                <Text style={[s.tabLbl, on && s.tabLblOn]}>{isHindi ? t.hi : t.en}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {activeTool && (
        <ToolActionModal
          tool={activeTool}
          language={language}
          theme={theme}
          onClose={() => setActiveTool(null)}
        />
      )}
    </View>
  );
}

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    scroll: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 110 },
    pageNarrow: { maxWidth: 720, width: '100%' as any, alignSelf: 'center' },
    pageTitle: { fontSize: 23, fontWeight: '800', color: theme.text, marginTop: 6, marginBottom: 14 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 17,
      marginBottom: 13,
    },
    cardTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
    cardSub: { fontSize: 12.5, color: theme.textSecondary, marginTop: 5, lineHeight: 18 },
    themeRow: { flexDirection: 'row', gap: 10, marginTop: 13 },
    themeOpt: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 15,
      borderRadius: 16,
      backgroundColor: theme.inputBg,
      borderWidth: 1.5,
      borderColor: theme.border,
      minHeight: 56,
    },
    themeOptTxt: { fontSize: 13.5, fontWeight: '800', color: theme.textSecondary },
    langBig: { fontSize: 15, fontWeight: '800', color: theme.textSecondary },
    trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    trustTxt: { fontSize: 13.5, color: theme.text, fontWeight: '600' },
    verRow: { marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: theme.border, alignItems: 'center' },
    verTxt: { fontSize: 11.5, color: theme.textMuted, fontWeight: '600' },
    hero: {
      borderRadius: 26,
      padding: 19,
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      overflow: 'hidden',
      position: 'relative',
    },
    heroGlow: {
      position: 'absolute',
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: 'rgba(129,140,248,0.28)',
      top: -80,
      right: -50,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(255,255,255,0.14)',
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 10,
    },
    heroBadgeTxt: { fontSize: 11, fontWeight: '700', color: '#E0E7FF' },
    heroTitle: { fontSize: 22.5, fontWeight: '800', color: '#fff', lineHeight: 29, letterSpacing: -0.3 },
    heroSub: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 7, fontWeight: '600' },
    heroArt: { width: 104, height: 122, alignItems: 'center', justifyContent: 'center' },
    heroDoc: {
      width: 74,
      height: 92,
      borderRadius: 15,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    heroDocLines: { gap: 4, alignItems: 'center' },
    hl: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
    zzz: {
      position: 'absolute',
      top: -2,
      right: 2,
      backgroundColor: '#FBBF24',
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    zzzTxt: { fontSize: 12, fontWeight: '900', color: '#451A03' },
    waFloat: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#25D366',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2.5,
      borderColor: '#fff',
    },
    quickHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 19, marginBottom: 11, paddingHorizontal: 2 },
    secH: { fontSize: 17, fontWeight: '800', color: theme.text },
    seeAll: { fontSize: 13, fontWeight: '700', color: theme.primary },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
    quickCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: theme.border,
      padding: 15,
      minHeight: 132,
      shadowColor: theme.shadow,
      shadowOpacity: theme.mode === 'light' ? 1 : 0,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: theme.mode === 'light' ? 3 : 0,
    },
    quickIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    quickTitle: { fontSize: 14.5, fontWeight: '800', color: theme.text, lineHeight: 19 },
    quickSub: { fontSize: 12, fontWeight: '700', color: theme.textMuted, marginTop: 4 },
    chips: { gap: 8, paddingVertical: 14, paddingRight: 10 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 15,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.card,
      borderWidth: 1.5,
      borderColor: theme.border,
      marginRight: 8,
    },
    chipOn: { backgroundColor: theme.text, borderColor: theme.text },
    chipTxt: { fontSize: 13, fontWeight: '700', color: theme.textSecondary },
    chipTxtOn: { color: theme.mode === 'dark' ? '#0B1220' : '#fff' },
    resultH: { fontSize: 13, fontWeight: '700', color: theme.textMuted, marginBottom: 10, paddingHorizontal: 2 },
    resultCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.card,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 13,
      marginBottom: 9,
      minHeight: 72,
    },
    resultIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    resultTitle: { fontSize: 14.5, fontWeight: '800', color: theme.text },
    resultDesc: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
    resultGo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', paddingVertical: 50 },
    emptyT: { fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 12 },
    emptyS: { fontSize: 12.5, color: theme.textMuted, marginTop: 4 },
    strip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 18,
      backgroundColor: theme.successSoft,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    stripTxt: { fontSize: 12, fontWeight: '700', color: theme.success },
    tabWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 18, paddingTop: 8 },
    tabBar: {
      flexDirection: 'row',
      backgroundColor: theme.mode === 'dark' ? '#182036' : '#1C1917',
      borderRadius: 26,
      padding: 6,
      gap: 4,
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
      maxWidth: 400,
    },
    tabItem: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 11, paddingHorizontal: 18, borderRadius: 20 },
    tabItemOn: { backgroundColor: theme.mode === 'dark' ? '#818CF8' : '#4338CA' },
    tabLbl: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
    tabLblOn: { color: '#fff', fontWeight: '800' },
  });
