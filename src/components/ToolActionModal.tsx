import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme, withAlpha } from '../theme/colors';
import { PDFTool } from '../types/tool';
import { PDFEngine, ShrinkLevel } from '../lib/pdf-engine';
import { parsePageSpec } from '../lib/pages';

interface Props {
  tool: PDFTool | null;
  language: 'en' | 'hi';
  theme: AppTheme;
  onClose: () => void;
}

interface SelectedFile {
  name: string;
  uri: string;
  size?: number;
  type: 'pdf' | 'image';
}

export const ToolActionModal: React.FC<Props> = ({ tool, language, theme, onClose }) => {
  const isHindi = language === 'hi';
  const insets = useSafeAreaInsets();
  const s = styles(theme);

  const [selectedPdfs, setSelectedPdfs] = useState<SelectedFile[]>([]);
  const [selectedImages, setSelectedImages] = useState<SelectedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputFileUri, setOutputFileUri] = useState<string | null>(null);
  const [outputFileSize, setOutputFileSize] = useState(0);
  const [outputMime, setOutputMime] = useState('application/pdf');
  const [outputPhotos, setOutputPhotos] = useState<string[]>([]);
  const [outputNote, setOutputNote] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);

  const [photoPosition, setPhotoPosition] = useState<'end' | 'start'>('end');
  const [rotateDegrees, setRotateDegrees] = useState(90);
  const [watermarkText, setWatermarkText] = useState(isHindi ? 'मेरी मुहर' : 'CONFIDENTIAL');
  const [splitStart, setSplitStart] = useState('1');
  const [splitEnd, setSplitEnd] = useState('3');
  const [pageSpec, setPageSpec] = useState('');
  const [keepMode, setKeepMode] = useState<'remove' | 'keep'>('remove');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [shrinkLevel, setShrinkLevel] = useState<ShrinkLevel>('medium');
  const [signScope, setSignScope] = useState<'first' | 'last' | 'all'>('last');

  if (!tool) return null;

  const resetState = () => {
    setSelectedPdfs([]);
    setSelectedImages([]);
    setIsProcessing(false);
    setOutputFileUri(null);
    setOutputFileSize(0);
    setOutputMime('application/pdf');
    setOutputPhotos([]);
    setOutputNote(null);
    setPageCount(null);
    setPageSpec('');
    setPassword('');
  };
  const handleClose = () => {
    resetState();
    onClose();
  };

  const buzz = (style: any = Haptics.ImpactFeedbackStyle.Medium) => {
    try {
      Haptics.impactAsync(style);
    } catch {}
  };

  const refreshPageCount = async (uri: string) => {
    try {
      const info = await PDFEngine.getPdfInfo(uri);
      setPageCount(info.pageCount);
    } catch {
      setPageCount(null);
    }
  };

  const handlePickPdf = async () => {
    buzz();
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        multiple: tool.id === 'merge-pdf',
        // false: use the system's own URI (carries a fresh read grant),
        // then we copy it into our cache below.
        copyToCacheDirectory: false,
      });
    } catch {
      Alert.alert(
        isHindi ? 'फाइल नहीं खुली' : 'Picker failed',
        isHindi
          ? 'फाइल चुनने वाला नहीं खुला। Files / My Files ऐप से PDF चुनकर देखें।'
          : 'The file picker could not open. Try picking the PDF from your Files app.'
      );
      return;
    }
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    try {
      const files: SelectedFile[] = [];
      for (let i = 0; i < result.assets.length; i++) {
        const a = result.assets[i];
        const label = a.name || `doc_${i + 1}.pdf`;
        // Copy into our own cache dir so the file stays readable
        let uri = a.uri;
        try {
          uri = await PDFEngine.stabilizePickedFile(a.uri, label);
        } catch {
          // keep original uri, probe below will catch unreadable files
        }
        // Probe: make sure we can actually read it before listing it
        try {
          await PDFEngine.getPdfInfo(uri);
        } catch {
          throw new Error(
            isHindi
              ? `"${label}" पढ़ी नहीं गई। PDF को Downloads में कॉपी करके फिर चुनें।`
              : `"${label}" could not be read. Copy the PDF to Downloads and pick it again.`
          );
        }
        files.push({ name: label, uri, size: a.size, type: 'pdf' });
      }
      if (tool.id === 'merge-pdf') {
        setSelectedPdfs((prev) => [...prev, ...files]);
        setPageCount(null);
      } else {
        setSelectedPdfs(files);
        if (files.length > 0) refreshPageCount(files[0].uri);
      }
    } catch (err: any) {
      Alert.alert(isHindi ? 'अरे!' : 'Oops', err?.message || (isHindi ? 'PDF पढ़ी नहीं गई' : 'Could not read PDF'));
    }
  };

  const handlePickPhotos = async () => {
    buzz();
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          isHindi ? 'फोटो की इजाज़त चाहिए' : 'Need photo access',
          isHindi ? 'गैलरी खोलने के लिए इजाज़त दें।' : 'Please allow gallery access to pick photos.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
      });
      if (!result.canceled && result.assets) {
        const files: SelectedFile[] = result.assets.map((a, i) => ({
          name: a.fileName || `Photo_${Date.now()}_${i + 1}.jpg`,
          uri: a.uri,
          size: a.fileSize,
          type: 'image' as const,
        }));
        setSelectedImages((prev) => [...prev, ...files]);
      }
    } catch {
      Alert.alert(isHindi ? 'अरे!' : 'Oops', isHindi ? 'फोटो चुनने में दिक्कत आई' : 'Could not pick photos');
    }
  };

  const handleProcess = async () => {
    buzz(Haptics.ImpactFeedbackStyle.Heavy);
    setIsProcessing(true);
    setOutputMime('application/pdf');
    setOutputPhotos([]);
    setOutputNote(null);
    try {
      let resultUri = '';
      const need = (cond: boolean, msgEn: string, msgHi: string) => {
        if (!cond) throw new Error(isHindi ? msgHi : msgEn);
      };
      switch (tool.id) {
        case 'jpg-to-pdf':
          need(selectedImages.length > 0, 'Pick photos first', 'पहले फोटो चुनें');
          resultUri = await PDFEngine.photosToPdf(selectedImages.map((f) => f.uri));
          break;
        case 'add-photos-to-pdf':
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          need(selectedImages.length > 0, 'Pick photos too', 'फोटो भी चुनें');
          resultUri = await PDFEngine.addPhotosToPdf(
            selectedPdfs[0].uri,
            selectedImages.map((f) => f.uri),
            photoPosition
          );
          break;
        case 'merge-pdf':
          need(selectedPdfs.length >= 2, 'Pick at least 2 PDFs', 'कम से कम 2 PDF चुनें');
          resultUri = await PDFEngine.mergePdfs(selectedPdfs.map((f) => f.uri));
          break;
        case 'rotate-pdf':
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          resultUri = await PDFEngine.rotatePdf(selectedPdfs[0].uri, rotateDegrees);
          break;
        case 'add-watermark':
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          resultUri = await PDFEngine.addWatermark(selectedPdfs[0].uri, watermarkText.trim() || 'SONE_DO');
          break;
        case 'split-pdf': {
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          const st = Math.max(1, parseInt(splitStart, 10) || 1);
          const en = Math.max(st, parseInt(splitEnd, 10) || st);
          resultUri = await PDFEngine.splitPdf(selectedPdfs[0].uri, st, en);
          break;
        }
        case 'compress-pdf':
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          resultUri = await PDFEngine.compressPdf(selectedPdfs[0].uri, shrinkLevel);
          break;
        case 'compress-images':
          need(selectedImages.length > 0, 'Pick photos first', 'पहले फोटो चुनें');
          resultUri = await PDFEngine.shrinkPhotosToPdf(selectedImages.map((f) => f.uri), shrinkLevel);
          break;
        case 'reorder-pages': {
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          need(pageSpec.trim().length > 0, 'Type page numbers, e.g. 2, 4', 'पेज नंबर लिखें, जैसे 2, 4');
          const info = await PDFEngine.getPdfInfo(selectedPdfs[0].uri);
          let pages: number[];
          try {
            pages = parsePageSpec(pageSpec, info.pageCount);
          } catch (e: any) {
            throw new Error(e?.message || 'Invalid page numbers');
          }
          resultUri = await PDFEngine.filterPages(selectedPdfs[0].uri, keepMode, pages);
          break;
        }
        case 'sign-pdf':
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          need(selectedImages.length > 0, 'Pick your signature photo', 'अपने साइन की फोटो चुनें');
          resultUri = await PDFEngine.addSignature(selectedPdfs[0].uri, selectedImages[0].uri, signScope);
          break;
        case 'pdf-to-jpg': {
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          const found = await PDFEngine.extractPhotosFromPdf(selectedPdfs[0].uri);
          need(
            found.photoUris.length > 0,
            `No extractable photos in this PDF (${found.skipped} tiny items skipped). Works best on scanned / photo PDFs.`,
            `इस PDF में निकालने लायक फोटो नहीं मिली। फोटो वाली स्कैन PDF पर आज़माएं।`
          );
          setOutputPhotos(found.photoUris);
          if (found.photoUris.length === 1) {
            resultUri = found.photoUris[0];
            setOutputMime('image/jpeg');
          } else {
            resultUri = await PDFEngine.zipFiles(found.photoUris, 'SoneDo_photos');
            setOutputMime('application/zip');
          }
          setOutputNote(
            isHindi
              ? `${found.found} फोटो मिलीं — नीचे से देखें या भेजें।`
              : `Found ${found.found} photos — preview or send below.`
          );
          break;
        }
        case 'protect-pdf':
          need(selectedPdfs.length > 0, 'Pick a PDF first', 'पहले PDF चुनें');
          need(password.trim().length >= 4, 'Set a password of 4+ letters', 'कम से कम 4 अक्षर का पासवर्ड रखें');
          resultUri = await PDFEngine.lockPdfWithPassword(selectedPdfs[0].uri, password.trim());
          setOutputMime('application/zip');
          setOutputNote(
            isHindi
              ? 'यह फाइल पासवर्ड से बंद है — खोलने पर पासवर्ड मांगेगा।'
              : 'This file is password-locked — it will ask for the password to open.'
          );
          break;
        default:
          throw new Error(isHindi ? 'यह टूल अभी तैयार हो रहा है' : 'This tool is not ready yet');
      }
      if (resultUri) {
        const info = await FileSystem.getInfoAsync(resultUri);
        setOutputFileUri(resultUri);
        setOutputFileSize(info.exists && 'size' in info ? (info as any).size || 0 : 0);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      }
    } catch (err: any) {
      Alert.alert(isHindi ? 'काम नहीं हुआ' : 'Could not finish', err?.message || 'Error');
    } finally {
      setIsProcessing(false);
    }
  };

  /** Open the finished file in the phone's PDF viewer, before sharing. */
  const handlePreview = async () => {
    if (!outputFileUri) return;
    buzz();
    try {
      if (Platform.OS === 'android') {
        const contentUri = await FileSystem.getContentUriAsync(outputFileUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: 'application/pdf',
          flags: 1,
        });
      } else {
        await Sharing.shareAsync(outputFileUri, {
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch {
      Alert.alert(
        isHindi ? 'खोल नहीं पाए' : 'Cannot open preview',
        isHindi
          ? 'फोन में PDF खोलने वाला ऐप नहीं मिला। नीचे Share दबाकर देखें।'
          : 'No PDF viewer app found. Use Share below to view it.'
      );
    }
  };

  const handleShare = async () => {
    if (!outputFileUri) return;
    buzz();
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(outputFileUri, {
          mimeType: outputMime,
          dialogTitle: isHindi ? 'फाइल भेजें' : 'Send file',
        });
      }
    } catch {}
  };

  const isPdfResult = outputMime === 'application/pdf';

  const needPdf = tool.acceptTypes.includes('pdf');
  const needImg = tool.acceptTypes.includes('image');
  const pdfOk = tool.id === 'merge-pdf' ? selectedPdfs.length >= 2 : selectedPdfs.length > 0;
  const imgOk = needImg ? selectedImages.length > 0 : true;
  const filesOk = needPdf && needImg ? pdfOk && imgOk : needPdf ? pdfOk : imgOk;
  const totalPicked = selectedPdfs.length + selectedImages.length;
  const stepState = outputFileUri ? 3 : filesOk ? 2 : 1;

  const bump = (v: string, setter: (x: string) => void, delta: number) => {
    const n = Math.max(1, (parseInt(v, 10) || 1) + delta);
    setter(String(n));
  };

  const isSign = tool.id === 'sign-pdf';

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.topZone}>
          <View style={s.handle} />
          <View style={s.headRow}>
            <View style={[s.headIcon, { backgroundColor: withAlpha(tool.accent, 0.14) }]}>
              <Ionicons name={tool.icon as any} size={23} color={tool.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.headTitle}>{isHindi ? tool.titleHi : tool.titleEn}</Text>
              <Text style={s.headSub} numberOfLines={1}>
                {isHindi ? tool.helpHi : tool.helpEn}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={s.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={s.stepper}>
            {[1, 2, 3].map((n) => {
              const label = n === 1 ? (isHindi ? 'फाइल' : 'Files') : n === 2 ? (isHindi ? 'सेटिंग' : 'Options') : (isHindi ? 'तैयार' : 'Done');
              const done = stepState > n;
              const active = stepState === n;
              return (
                <View key={n} style={s.stepItem}>
                  <View
                    style={[
                      s.stepCircle,
                      done && { backgroundColor: theme.stepDone, borderColor: theme.stepDone },
                      active && { borderColor: tool.accent, backgroundColor: withAlpha(tool.accent, 0.14) },
                    ]}
                  >
                    {done ? (
                      <Ionicons name="checkmark" size={15} color="#fff" />
                    ) : (
                      <Text style={[s.stepNum, active && { color: tool.accent }]}>{n}</Text>
                    )}
                  </View>
                  <Text style={[s.stepLbl, active && { color: tool.accent, fontWeight: '800' as const }]}>
                    {label}
                  </Text>
                  {n < 3 && <View style={[s.stepLine, done && { backgroundColor: theme.stepDone }]} />}
                </View>
              );
            })}
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {outputFileUri ? (
            <View style={s.doneWrap}>
              <View style={[s.bigCheck, { backgroundColor: withAlpha(theme.success, 0.13) }]}>
                <Ionicons name="checkmark-circle" size={68} color={theme.success} />
              </View>
              <Text style={s.doneTitle}>
                {outputMime === 'image/jpeg'
                  ? isHindi
                    ? 'फोटो मिल गई!'
                    : 'Photo extracted!'
                  : outputMime === 'application/zip'
                  ? isHindi
                    ? 'हो गया! फाइल तैयार है'
                    : 'Done! File is ready'
                  : isHindi
                  ? 'हो गया! PDF तैयार है'
                  : 'Done! Your PDF is ready'}
              </Text>
              <Text style={s.doneSub}>
                {outputNote ||
                  (isHindi
                    ? 'पहले खोलकर देख लें, फिर भेजें। फाइल सिर्फ आपके फोन में बनी है।'
                    : 'Preview it first, then send. Made only on your phone.')}
              </Text>
              {outputPhotos.length > 0 && (
                <View style={s.thumbRow}>
                  {outputPhotos.slice(0, 4).map((u, i) => (
                    <Image key={i} source={{ uri: u }} style={s.thumb} />
                  ))}
                  {outputPhotos.length > 4 && (
                    <View style={s.thumbMore}>
                      <Text style={s.thumbMoreTxt}>+{outputPhotos.length - 4}</Text>
                    </View>
                  )}
                </View>
              )}
              <View style={s.fileCard}>
                <View style={[s.fileIcon, { backgroundColor: withAlpha(tool.accent, 0.13) }]}>
                  <Ionicons
                    name={outputMime === 'image/jpeg' ? 'image' : outputMime === 'application/zip' ? 'lock-closed' : 'document-text'}
                    size={22}
                    color={tool.accent}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fileName} numberOfLines={1}>
                    {(outputFileUri.split('/').pop() || 'SoneDo.pdf').replace(/_/g, ' ')}
                  </Text>
                  <Text style={s.fileSize}>
                    {(outputFileSize / 1024 / 1024).toFixed(2)} MB • {isHindi ? 'फोन में सेव' : 'Saved on phone'}
                  </Text>
                </View>
                <Ionicons name="lock-closed" size={16} color={theme.success} />
              </View>

              {/* 1. Preview first (PDFs open in viewer; zip/photo via Share) */}
              {isPdfResult ? (
                <TouchableOpacity
                  style={[s.previewBtn, { borderColor: tool.accent, backgroundColor: withAlpha(tool.accent, 0.1) }]}
                  onPress={handlePreview}
                  activeOpacity={0.85}
                >
                  <Ionicons name="eye" size={22} color={tool.accent} />
                  <View>
                    <Text style={[s.previewTitle, { color: tool.accent }]}>
                      {isHindi ? 'पहले खोलकर देखें' : 'Open & Preview'}
                    </Text>
                    <Text style={s.previewSub}>
                      {isHindi ? 'डाउनलोड से पहले जांच लें' : 'Check before downloading'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={s.readyHint}>
                  <Ionicons name={outputMime === 'image/jpeg' ? 'image' : 'lock-closed'} size={18} color={tool.accent} />
                  <Text style={[s.readyHintTxt, { color: tool.accent }]}>
                    {outputMime === 'image/jpeg'
                      ? isHindi
                        ? 'ऊपर फोटो दिख रही है — नीचे से भेजें।'
                        : 'Photo shown above — send it below.'
                      : isHindi
                      ? 'इसे Files / ZIP ऐप में पासवर्ड से खोलें।'
                      : 'Open it with the password in your Files / ZIP app.'}
                  </Text>
                </View>
              )}

              <TouchableOpacity style={s.waBtn} onPress={handleShare} activeOpacity={0.85}>
                <Ionicons name="logo-whatsapp" size={24} color="#fff" />
                <View>
                  <Text style={s.waTitle}>{isHindi ? 'WhatsApp पर भेजें' : 'Send on WhatsApp'}</Text>
                  <Text style={s.waSub}>{isHindi ? '1 बार दबाएं, सीधा शेयर' : 'One tap, straight to share'}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={s.ghostBtn} onPress={handleShare} activeOpacity={0.8}>
                <Ionicons name="share-outline" size={20} color={theme.text} />
                <Text style={s.ghostTxt}>{isHindi ? 'सेव करें / और ऐप में भेजें' : 'Save / Send to other apps'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={resetState} style={s.againHit} hitSlop={8}>
                <Ionicons name="refresh" size={16} color={tool.accent} />
                <Text style={[s.againTxt, { color: tool.accent }]}>
                  {isHindi ? 'एक और फाइल बनाएं' : 'Make another file'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {needPdf && (
                <View style={s.sec}>
                  <View style={s.secHeadRow}>
                    <View style={[s.numBadge, pdfOk && s.numBadgeOk]}>
                      <Text style={[s.numTxt, pdfOk && { color: '#fff' }]}>1</Text>
                    </View>
                    <Text style={s.secTitle}>
                      {tool.id === 'merge-pdf'
                        ? isHindi
                          ? 'अपनी PDF फाइलें चुनें (कम से कम 2)'
                          : 'Choose your PDFs (at least 2)'
                        : isHindi
                        ? 'अपनी PDF चुनें'
                        : 'Choose your PDF'}
                    </Text>
                    {pageCount !== null && tool.id !== 'merge-pdf' && (
                      <View style={s.pagesPill}>
                        <Text style={s.pagesPillTxt}>
                          {pageCount} {isHindi ? 'पेज' : 'pages'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={[s.pickBig, pdfOk && s.pickBigDone]} onPress={handlePickPdf} activeOpacity={0.8}>
                    <View style={[s.pickIcon, { backgroundColor: withAlpha(tool.accent, 0.13) }]}>
                      <Ionicons name="document-attach" size={26} color={tool.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickTitle}>
                        {selectedPdfs.length > 0
                          ? isHindi
                            ? `${selectedPdfs.length} PDF चुनी गई — और जोड़ें`
                            : `${selectedPdfs.length} PDF picked — add more`
                          : isHindi
                          ? 'यहां दबाकर PDF चुनें'
                          : 'Tap here to choose PDF'}
                      </Text>
                      <Text style={s.pickSub}>{isHindi ? 'फाइल, WhatsApp या डाउनलोड से' : 'From files, WhatsApp or downloads'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                  {selectedPdfs.map((f, i) => (
                    <View key={i} style={s.chip}>
                      <Ionicons name="document-text" size={18} color={tool.accent} />
                      <Text style={s.chipName} numberOfLines={1}>
                        {i + 1}. {f.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          const next = selectedPdfs.filter((_, x) => x !== i);
                          setSelectedPdfs(next);
                          if (next.length === 0) setPageCount(null);
                          else if (tool.id !== 'merge-pdf') refreshPageCount(next[0].uri);
                        }}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={18} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {needImg && (
                <View style={s.sec}>
                  <View style={s.secHeadRow}>
                    <View style={[s.numBadge, imgOk && s.numBadgeOk]}>
                      <Text style={[s.numTxt, imgOk && { color: '#fff' }]}>
                        {needPdf ? 2 : 1}
                      </Text>
                    </View>
                    <Text style={s.secTitle}>
                      {isSign
                        ? isHindi
                          ? 'अपने साइन की फोटो चुनें'
                          : 'Pick your signature photo'
                        : tool.id === 'add-photos-to-pdf'
                        ? isHindi
                          ? 'जोड़ने के लिए फोटो चुनें'
                          : 'Select photos to add'
                        : isHindi
                        ? 'गैलरी से फोटो चुनें'
                        : 'Pick photos from gallery'}
                    </Text>
                  </View>
                  <TouchableOpacity style={[s.pickBig, imgOk && s.pickBigDone]} onPress={handlePickPhotos} activeOpacity={0.8}>
                    <View style={[s.pickIcon, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
                      <Ionicons name={isSign ? 'pencil' : 'images'} size={26} color={isSign ? tool.accent : '#2563EB'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.pickTitle}>
                        {selectedImages.length > 0
                          ? isHindi
                            ? `${selectedImages.length} फोटो चुनी गई`
                            : `${selectedImages.length} photos picked`
                          : isHindi
                          ? 'यहां दबाकर फोटो चुनें'
                          : 'Tap here to choose photos'}
                      </Text>
                      <Text style={s.pickSub}>
                        {isSign
                          ? isHindi
                            ? 'सफेद कागज पर किया साइन सबसे अच्छा'
                            : 'Signature on white paper works best'
                          : isHindi
                          ? 'एक साथ कई फोटो चुन सकते हैं'
                          : 'You can pick many at once'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                  {selectedImages.length > 0 && (
                    <View style={s.imgCountRow}>
                      {selectedImages.slice(0, 6).map((f, i) => (
                        <View key={i} style={[s.miniThumb, { borderColor: tool.accent }]}>
                          <Ionicons name="image" size={16} color={tool.accent} />
                        </View>
                      ))}
                      {selectedImages.length > 6 && (
                        <Text style={s.moreTxt}>+{selectedImages.length - 6}</Text>
                      )}
                      <TouchableOpacity onPress={() => setSelectedImages([])} style={s.clearAll}>
                        <Text style={s.clearAllTxt}>{isHindi ? 'साफ करें' : 'Clear'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {filesOk && (
                <View style={s.sec}>
                  <View style={s.secHeadRow}>
                    <View style={s.numBadgeOk}>
                      <Text style={[s.numTxt, { color: '#fff' }]}>{needPdf && needImg ? 3 : 2}</Text>
                    </View>
                    <Text style={s.secTitle}>{isHindi ? 'छोटी सी सेटिंग' : 'One small setting'}</Text>
                  </View>

                  {tool.id === 'add-photos-to-pdf' && (
                    <View style={s.optRow}>
                      {(['end', 'start'] as const).map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[s.optPill, photoPosition === p && { backgroundColor: tool.accent, borderColor: tool.accent }]}
                          onPress={() => setPhotoPosition(p)}
                        >
                          <Text style={[s.optTxt, photoPosition === p && { color: '#fff' }]}>
                            {p === 'end' ? (isHindi ? 'आखिर में जोड़ें' : 'Add at end') : isHindi ? 'शुरू में जोड़ें' : 'Add at start'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {tool.id === 'rotate-pdf' && (
                    <View style={s.optRow}>
                      {[90, 180, 270].map((d) => (
                        <TouchableOpacity
                          key={d}
                          style={[s.optPill, rotateDegrees === d && { backgroundColor: tool.accent, borderColor: tool.accent }]}
                          onPress={() => setRotateDegrees(d)}
                        >
                          <Ionicons
                            name="refresh"
                            size={16}
                            color={rotateDegrees === d ? '#fff' : theme.textSecondary}
                          />
                          <Text style={[s.optTxt, rotateDegrees === d && { color: '#fff' }]}>{d}°</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {tool.id === 'add-watermark' && (
                    <View>
                      <Text style={s.optLabel}>{isHindi ? 'मुहर में क्या लिखें? (जैसे दुकान का नाम)' : 'What should the stamp say?'}</Text>
                      <TextInput
                        style={s.bigInput}
                        value={watermarkText}
                        onChangeText={setWatermarkText}
                        placeholder={isHindi ? 'जैसे: शर्मा जनरल स्टोर' : 'e.g. Sharma Store'}
                        placeholderTextColor={theme.textMuted}
                      />
                    </View>
                  )}

                  {tool.id === 'protect-pdf' && (
                    <View>
                      <Text style={s.optLabel}>
                        {isHindi ? 'पासवर्ड रखें (कम से कम 4 अक्षर)' : 'Set a password (min 4 characters)'}
                      </Text>
                      <View style={s.pwRow}>
                        <TextInput
                          style={[s.bigInput, { flex: 1 }]}
                          value={password}
                          onChangeText={setPassword}
                          placeholder={isHindi ? 'जैसे: 1234' : 'e.g. 1234'}
                          placeholderTextColor={theme.textMuted}
                          secureTextEntry={!showPw}
                          maxLength={32}
                        />
                        <TouchableOpacity style={s.stepBtn} onPress={() => setShowPw(!showPw)} hitSlop={8}>
                          <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={tool.accent} />
                        </TouchableOpacity>
                      </View>
                      <Text style={s.hintLine}>
                        {isHindi
                          ? 'बिना पासवर्ड फाइल नहीं खुलेगी। पासवर्ड याद रखें!'
                          : 'The file will not open without it. Remember it!'}
                      </Text>
                    </View>
                  )}

                  {tool.id === 'split-pdf' && (
                    <View style={s.rangeWrap}>
                      {[
                        { lbl: isHindi ? 'कौन से पेज से' : 'From page', v: splitStart, set: setSplitStart },
                        { lbl: isHindi ? 'कौन से पेज तक' : 'To page', v: splitEnd, set: setSplitEnd },
                      ].map((r) => (
                        <View key={r.lbl} style={s.rangeCard}>
                          <Text style={s.rangeLbl}>{r.lbl}</Text>
                          <View style={s.stepperRow}>
                            <TouchableOpacity style={s.stepBtn} onPress={() => bump(r.v, r.set, -1)}>
                              <Ionicons name="remove" size={18} color={tool.accent} />
                            </TouchableOpacity>
                            <TextInput
                              style={s.rangeNum}
                              value={r.v}
                              onChangeText={r.set}
                              keyboardType="number-pad"
                              maxLength={4}
                            />
                            <TouchableOpacity style={s.stepBtn} onPress={() => bump(r.v, r.set, 1)}>
                              <Ionicons name="add" size={18} color={tool.accent} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {tool.id === 'reorder-pages' && (
                    <View>
                      <View style={s.optRow}>
                        {(['remove', 'keep'] as const).map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[s.optPill, keepMode === m && { backgroundColor: tool.accent, borderColor: tool.accent }]}
                            onPress={() => setKeepMode(m)}
                          >
                            <Text style={[s.optTxt, keepMode === m && { color: '#fff' }]}>
                              {m === 'remove' ? (isHindi ? 'ये पेज हटाएं' : 'Remove these') : isHindi ? 'सिर्फ ये रखें' : 'Keep only these'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={[s.optLabel, { marginTop: 12 }]}>
                        {isHindi ? 'पेज नंबर लिखें (जैसे: 2, 4, 6-8)' : 'Type page numbers (e.g. 2, 4, 6-8)'}
                      </Text>
                      <TextInput
                        style={s.bigInput}
                        value={pageSpec}
                        onChangeText={setPageSpec}
                        placeholder={isHindi ? 'जैसे: 2, 5, 7-9' : 'e.g. 2, 5, 7-9'}
                        placeholderTextColor={theme.textMuted}
                        keyboardType="numbers-and-punctuation"
                      />
                      {pageCount !== null && (
                        <Text style={s.hintLine}>
                          {isHindi
                            ? `इस PDF में कुल ${pageCount} पेज हैं`
                            : `This PDF has ${pageCount} pages in total`}
                        </Text>
                      )}
                    </View>
                  )}

                  {(tool.id === 'compress-pdf' || tool.id === 'compress-images') && (
                    <View>
                      <Text style={s.optLabel}>
                        {isHindi ? 'कितना छोटा करना है?' : 'How small should it be?'}
                      </Text>
                      <View style={s.optRow3}>
                        {(['light', 'medium', 'strong'] as ShrinkLevel[]).map((lv) => (
                          <TouchableOpacity
                            key={lv}
                            style={[s.optPill, shrinkLevel === lv && { backgroundColor: tool.accent, borderColor: tool.accent }]}
                            onPress={() => setShrinkLevel(lv)}
                          >
                            <Text style={[s.optTxt, shrinkLevel === lv && { color: '#fff' }]}>
                              {lv === 'light' ? (isHindi ? 'हल्का' : 'Light') : lv === 'medium' ? (isHindi ? 'मध्यम' : 'Medium') : isHindi ? 'सबसे छोटा' : 'Smallest'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={s.hintLine}>
                        {shrinkLevel === 'light'
                          ? isHindi ? 'थोड़ा छोटा, क्वालिटी एकदम साफ' : 'Slightly smaller, best quality'
                          : shrinkLevel === 'medium'
                          ? isHindi ? 'आधा साइज, WhatsApp के लिए बढ़िया' : 'Half the size, great for WhatsApp'
                          : isHindi ? 'सबसे छोटा, भेजने में सबसे तेज' : 'Smallest file, fastest to send'}
                      </Text>
                    </View>
                  )}

                  {isSign && (
                    <View>
                      <Text style={s.optLabel}>{isHindi ? 'साइन कहां लगाना है?' : 'Where to put the signature?'}</Text>
                      <View style={s.optRow3}>
                        {(['first', 'last', 'all'] as const).map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[s.optPill, signScope === p && { backgroundColor: tool.accent, borderColor: tool.accent }]}
                            onPress={() => setSignScope(p)}
                          >
                            <Text style={[s.optTxt, signScope === p && { color: '#fff' }]}>
                              {p === 'first' ? (isHindi ? 'पहला पेज' : 'First') : p === 'last' ? (isHindi ? 'आखिरी पेज' : 'Last') : isHindi ? 'सभी पेज' : 'All'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={s.hintLine}>
                        {isHindi ? 'साइन नीचे-दाईं ओर लगेगा' : 'Signature goes at the bottom-right'}
                      </Text>
                    </View>
                  )}

                  {['jpg-to-pdf', 'merge-pdf', 'pdf-to-jpg'].includes(tool.id) && (
                    <View style={s.readyHint}>
                      <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                      <Text style={s.readyHintTxt}>
                        {isHindi ? 'सब तैयार है — नीचे बड़ा बटन दबाएं।' : 'All set — press the big button below.'}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={s.trustRow}>
                <Ionicons name="shield-checkmark" size={15} color={theme.success} />
                <Text style={s.trustTxt}>
                  {isHindi ? 'बिना इंटरनेट, बिना साइन-अप — फाइल फोन से बाहर नहीं जाती।' : 'No internet, no sign-up — files never leave your phone.'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {!outputFileUri && (
          <View style={[s.bottom, { paddingBottom: Math.max(insets.bottom, 22) }]}>
            <View style={s.countLine}>
              <Text style={s.countLineTxt}>
                {totalPicked === 0
                  ? isHindi
                    ? 'शुरू करने के लिए ऊपर से फाइल चुनें'
                    : 'Pick a file above to begin'
                  : filesOk
                  ? isHindi
                    ? 'बढ़िया! अब नीचे दबाएं'
                    : 'Nice! Now press below'
                  : isHindi
                  ? 'थोड़ा और बाकी है…'
                  : 'Almost there…'}
              </Text>
            </View>
            <TouchableOpacity
              style={[s.cta, { backgroundColor: tool.accent }, (!filesOk || isProcessing) && s.ctaOff]}
              disabled={!filesOk || isProcessing}
              onPress={handleProcess}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={s.ctaInner}>
                  <Text style={s.ctaTxt}>
                    {isHindi ? tool.ctaHi : tool.ctaEn} →
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    topZone: {
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingBottom: 12,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
    },
    handle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.sheetHandle,
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: 10,
    },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 },
    headIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    headTitle: { fontSize: 17.5, fontWeight: '800', color: theme.text },
    headSub: { fontSize: 12, color: theme.textSecondary, marginTop: 2, fontWeight: '500' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.inputBg, alignItems: 'center', justifyContent: 'center' },
    stepper: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 26, marginTop: 14 },
    stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 0 },
    stepCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: theme.stepTodo,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNum: { fontSize: 12.5, fontWeight: '800', color: theme.textMuted },
    stepLbl: { fontSize: 11, color: theme.textMuted, marginLeft: 6, fontWeight: '600', marginRight: 6 },
    stepLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: theme.stepTodo, marginRight: 6, marginLeft: 2 },
    scroll: { padding: 18, paddingBottom: 30 },
    sec: {
      backgroundColor: theme.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 15,
      marginBottom: 13,
    },
    secHeadRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    numBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: theme.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numBadgeOk: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: '#16A34A',
      alignItems: 'center',
      justifyContent: 'center',
    },
    numTxt: { fontSize: 13, fontWeight: '800', color: theme.textMuted },
    secTitle: { fontSize: 14.5, fontWeight: '800', color: theme.text, flex: 1 },
    pagesPill: {
      backgroundColor: theme.inputBg,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    pagesPillTxt: { fontSize: 11.5, fontWeight: '800', color: theme.textSecondary },
    pickBig: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.background,
      borderWidth: 1.8,
      borderStyle: 'dashed',
      borderColor: theme.border,
      borderRadius: 18,
      padding: 14,
      minHeight: 78,
    },
    pickBigDone: { borderStyle: 'solid' as const },
    pickIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    pickTitle: { fontSize: 14.5, fontWeight: '800', color: theme.text },
    pickSub: { fontSize: 11.5, color: theme.textMuted, marginTop: 2, fontWeight: '500' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      backgroundColor: theme.inputBg,
      borderRadius: 13,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginTop: 8,
    },
    chipName: { flex: 1, fontSize: 13, color: theme.text, fontWeight: '600' },
    imgCountRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
    miniThumb: {
      width: 34,
      height: 34,
      borderRadius: 11,
      borderWidth: 1.5,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    moreTxt: { fontSize: 13, fontWeight: '800', color: theme.textSecondary, marginLeft: 4 },
    clearAll: { marginLeft: 'auto' as const, paddingHorizontal: 10, paddingVertical: 6 },
    clearAllTxt: { fontSize: 12.5, fontWeight: '700', color: theme.danger },
    optRow: { flexDirection: 'row', gap: 10 },
    optRow3: { flexDirection: 'row', gap: 8 },
    optPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 15,
      paddingHorizontal: 6,
      borderRadius: 15,
      backgroundColor: theme.inputBg,
      borderWidth: 1.5,
      borderColor: theme.border,
      minHeight: 54,
    },
    optTxt: { fontSize: 13, fontWeight: '800', color: theme.textSecondary, textAlign: 'center' as const },
    optLabel: { fontSize: 13, fontWeight: '700', color: theme.text, marginBottom: 8 },
    hintLine: { fontSize: 12, color: theme.textMuted, marginTop: 8, fontWeight: '500', lineHeight: 17 },
    bigInput: {
      backgroundColor: theme.inputBg,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 15,
      paddingVertical: 14,
      fontSize: 15.5,
      color: theme.text,
      fontWeight: '600',
    },
    rangeWrap: { flexDirection: 'row', gap: 10 },
    rangeCard: { flex: 1, backgroundColor: theme.inputBg, borderRadius: 16, padding: 12, alignItems: 'center' },
    rangeLbl: { fontSize: 12, fontWeight: '700', color: theme.textSecondary, marginBottom: 8 },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepBtn: {
      width: 38,
      height: 38,
      borderRadius: 13,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rangeNum: {
      flex: 1,
      textAlign: 'center',
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      minWidth: 44,
    },
    readyHint: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: theme.successSoft, borderRadius: 13, padding: 12 },
    readyHintTxt: { fontSize: 12.5, fontWeight: '700', color: theme.success, flex: 1 },
    trustRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 6, marginTop: 4 },
    trustTxt: { flex: 1, fontSize: 11.5, color: theme.textMuted, lineHeight: 17, fontWeight: '500' },
    bottom: {
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 22,
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    countLine: { alignItems: 'center', marginBottom: 9 },
    countLineTxt: { fontSize: 12.5, color: theme.textSecondary, fontWeight: '600' },
    cta: { borderRadius: 20, minHeight: 60, alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
    ctaOff: { opacity: 0.45 },
    ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ctaTxt: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
    doneWrap: { alignItems: 'center' },
    bigCheck: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16 },
    doneTitle: { fontSize: 21, fontWeight: '800', color: theme.text, textAlign: 'center' },
    doneSub: { fontSize: 12.5, color: theme.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 18, paddingHorizontal: 20 },
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 14,
      marginTop: 18,
    },
    fileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    fileName: { fontSize: 13.5, fontWeight: '700', color: theme.text },
    fileSize: { fontSize: 11.5, color: theme.textMuted, marginTop: 2, fontWeight: '600' },
    previewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      width: '100%',
      borderWidth: 1.8,
      borderRadius: 20,
      paddingVertical: 15,
      paddingHorizontal: 18,
      marginTop: 14,
      minHeight: 68,
    },
    previewTitle: { fontSize: 16.5, fontWeight: '800' },
    previewSub: { fontSize: 11.5, color: theme.textMuted, fontWeight: '600' },
    thumbRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
    thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border },
    thumbMore: {
      width: 64,
      height: 64,
      borderRadius: 14,
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbMoreTxt: { fontSize: 14, fontWeight: '800', color: theme.textSecondary },
    pwRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    waBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      width: '100%',
      backgroundColor: theme.whatsapp,
      borderRadius: 20,
      paddingVertical: 15,
      paddingHorizontal: 18,
      marginTop: 10,
      minHeight: 68,
    },
    waTitle: { fontSize: 16.5, fontWeight: '800', color: '#fff' },
    waSub: { fontSize: 11.5, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 9,
      width: '100%',
      backgroundColor: theme.card,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderRadius: 20,
      paddingVertical: 15,
      marginTop: 10,
      minHeight: 58,
    },
    ghostTxt: { fontSize: 14.5, fontWeight: '700', color: theme.text },
    againHit: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, padding: 8 },
    againTxt: { fontSize: 14, fontWeight: '700' },
  });
