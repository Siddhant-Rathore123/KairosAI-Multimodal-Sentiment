// Language detection and translation service
import * as franc from 'franc-min';

// Supported languages with their codes and names
export const SUPPORTED_LANGUAGES = {
  en: { name: 'English', nativeName: 'English', flag: '🇺🇸', direction: 'ltr', model: 'mamba-130m' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', direction: 'ltr', model: 'mamba-130m' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷', direction: 'ltr', model: 'mamba-130m' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', direction: 'ltr', model: 'mamba-130m' },
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', direction: 'ltr', model: 'mamba-130m' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', direction: 'ltr', model: 'mamba-130m' },
  nl: { name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', direction: 'ltr', model: 'mamba-130m' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', direction: 'ltr', model: 'mamba-130m' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳', direction: 'ltr', model: 'mamba-130m' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', direction: 'ltr', model: 'mamba-130m' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷', direction: 'ltr', model: 'mamba-130m' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', direction: 'rtl', model: 'mamba-130m' },
  he: { name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', direction: 'rtl', model: 'mamba-130m' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', direction: 'ltr', model: 'mamba-130m' },
  tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', direction: 'ltr', model: 'mamba-130m' },
  pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', direction: 'ltr', model: 'mamba-130m' },
  uk: { name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', direction: 'ltr', model: 'mamba-130m' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', direction: 'ltr', model: 'mamba-130m' },
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', direction: 'ltr', model: 'mamba-130m' },
};

// Sentiment translations for display
export const SENTIMENT_TRANSLATIONS = {
  en: { POSITIVE: 'Positive', NEGATIVE: 'Negative', NEUTRAL: 'Neutral' },
  es: { POSITIVE: 'Positivo', NEGATIVE: 'Negativo', NEUTRAL: 'Neutral' },
  fr: { POSITIVE: 'Positif', NEGATIVE: 'Négatif', NEUTRAL: 'Neutre' },
  de: { POSITIVE: 'Positiv', NEGATIVE: 'Negativ', NEUTRAL: 'Neutral' },
  it: { POSITIVE: 'Positivo', NEGATIVE: 'Negativo', NEUTRAL: 'Neutrale' },
  pt: { POSITIVE: 'Positivo', NEGATIVE: 'Negativo', NEUTRAL: 'Neutro' },
  nl: { POSITIVE: 'Positief', NEGATIVE: 'Negatief', NEUTRAL: 'Neutraal' },
  ru: { POSITIVE: 'Позитивный', NEGATIVE: 'Негативный', NEUTRAL: 'Нейтральный' },
  zh: { POSITIVE: '积极', NEGATIVE: '消极', NEUTRAL: '中性' },
  ja: { POSITIVE: 'ポジティブ', NEGATIVE: 'ネガティブ', NEUTRAL: 'ニュートラル' },
  ko: { POSITIVE: '긍정적', NEGATIVE: '부정적', NEUTRAL: '중립적' },
  ar: { POSITIVE: 'إيجابي', NEGATIVE: 'سلبي', NEUTRAL: 'محايد' },
  he: { POSITIVE: 'חיובי', NEGATIVE: 'שלילי', NEUTRAL: 'ניטרלי' },
  hi: { POSITIVE: 'सकारात्मक', NEGATIVE: 'नकारात्मक', NEUTRAL: 'तटस्थ' },
  tr: { POSITIVE: 'Olumlu', NEGATIVE: 'Olumsuz', NEUTRAL: 'Nötr' },
  pl: { POSITIVE: 'Pozytywny', NEGATIVE: 'Negatywny', NEUTRAL: 'Neutralny' },
  uk: { POSITIVE: 'Позитивний', NEGATIVE: 'Негативний', NEUTRAL: 'Нейтральний' },
  vi: { POSITIVE: 'Tích cực', NEGATIVE: 'Tiêu cực', NEUTRAL: 'Trung tính' },
  th: { POSITIVE: 'เชิงบวก', NEGATIVE: 'เชิงลบ', NEUTRAL: 'เป็นกลาง' },
};

// Detect language from text
export const detectLanguage = (text) => {
  if (!text || text.trim().length < 10) {
    return 'en'; // Default to English for short texts
  }
  
  try {
    const detected = franc(text);
    // Map franc codes to our supported languages
    const languageMap = {
      'eng': 'en', 'spa': 'es', 'fra': 'fr', 'deu': 'de', 'ita': 'it',
      'por': 'pt', 'nld': 'nl', 'rus': 'ru', 'cmn': 'zh', 'jpn': 'ja',
      'kor': 'ko', 'ara': 'ar', 'heb': 'he', 'hin': 'hi', 'tur': 'tr',
      'pol': 'pl', 'ukr': 'uk', 'vie': 'vi', 'tha': 'th'
    };
    
    return languageMap[detected] || 'en';
  } catch (error) {
    console.error('Language detection failed:', error);
    return 'en';
  }
};

// Get language display name
export const getLanguageDisplay = (langCode) => {
  const lang = SUPPORTED_LANGUAGES[langCode];
  return lang ? `${lang.flag} ${lang.nativeName}` : '🇺🇸 English';
};

// Translate sentiment based on language
export const translateSentiment = (sentiment, langCode) => {
  const translations = SENTIMENT_TRANSLATIONS[langCode];
  if (translations && translations[sentiment]) {
    return translations[sentiment];
  }
  return SENTIMENT_TRANSLATIONS.en[sentiment];
};

// Get text direction (RTL for Arabic/Hebrew)
export const getTextDirection = (langCode) => {
  const lang = SUPPORTED_LANGUAGES[langCode];
  return lang ? lang.direction : 'ltr';
};

// Language-specific sentiment prompts for better analysis
export const getLanguagePrompts = (langCode) => {
  const prompts = {
    en: { positive: 'happy, joyful, excellent', negative: 'sad, angry, terrible', neutral: 'okay, normal, fine' },
    es: { positive: 'feliz, alegre, excelente', negative: 'triste, enojado, terrible', neutral: 'normal, bien, regular' },
    fr: { positive: 'heureux, joyeux, excellent', negative: 'triste, en colère, terrible', neutral: 'normal, bien, correct' },
    de: { positive: 'glücklich, fröhlich, ausgezeichnet', negative: 'traurig, wütend, schrecklich', neutral: 'normal, gut, in Ordnung' },
    ar: { positive: 'سعيد، فرح، ممتاز', negative: 'حزين، غاضب، فظيع', neutral: 'عادي، جيد، لا بأس' },
    he: { positive: 'שמח, עליז, מצוין', negative: 'עצוב, כועס, נורא', neutral: 'רגיל, טוב, בסדר' },
  };
  return prompts[langCode] || prompts.en;
};