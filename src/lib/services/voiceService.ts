/**
 * Voice selection and text-to-speech service for Aria
 *
 * Requirements:
 * - Preferred voice: Microsoft Heera (en-IN).
 * - Fallback 1: Best available female-sounding English (India) voice (e.g. Neerja, Prabhat, India, en-IN).
 * - Fallback 2: Best available female-sounding English voice from other locales (Zira, Jenny, Aria, Natural, Female, Google UK English Female, etc.).
 * - Fallback 3: Any English voice.
 * - Handles asynchronous voices loading via voiceschanged event.
 * - Selects voice once and assigns consistently to every utterance.
 * - Provides diagnostic logging and diagnostic inspection helpers.
 */

export interface VoiceDiagnostic {
  name: string;
  lang: string;
  isPreferred: boolean;
  isFemaleLikely: boolean;
  voiceURI: string;
}

let cachedVoice: SpeechSynthesisVoice | null = null;
let hasLoggedSelection = false;

/**
 * Heuristic to detect female-sounding voice names
 */
export function isLikelyFemaleVoice(voice: SpeechSynthesisVoice): boolean {
  const name = voice.name.toLowerCase();
  const femaleKeywords = [
    "heera",
    "neerja",
    "veena",
    "zira",
    "jenny",
    "aria",
    "ava",
    "samantha",
    "victoria",
    "karen",
    "moira",
    "fiona",
    "serena",
    "susan",
    "female",
    "woman",
  ];
  return femaleKeywords.some((kw) => name.includes(kw));
}

/**
 * Selects the highest quality voice for Aria based on priority
 */
export function selectAriaVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const isEnIn = (v: SpeechSynthesisVoice) => {
    const lang = (v.lang || "").replace("_", "-").toLowerCase();
    const name = (v.name || "").toLowerCase();
    return lang === "en-in" || lang.startsWith("en-in") || name.includes("en-in") || name.includes("india");
  };

  // 1. Preferred Indian English named voices: Microsoft Heera or Neerja
  const heeraOrNeerja = voices.find((v) => {
    const name = v.name.toLowerCase();
    return isEnIn(v) && (name.includes("heera") || name.includes("neerja"));
  }) || voices.find((v) => {
    const name = v.name.toLowerCase();
    return name.includes("heera") || name.includes("neerja");
  });
  if (heeraOrNeerja) return heeraOrNeerja;

  // 2. Any other female English (India) voice (e.g. Veena, or en-IN with female keywords)
  const indianFemaleVoice = voices.find((v) => isEnIn(v) && isLikelyFemaleVoice(v));
  if (indianFemaleVoice) return indianFemaleVoice;

  // 3. Any available English (India) voice
  const anyIndianVoice = voices.find((v) => isEnIn(v));
  if (anyIndianVoice) return anyIndianVoice;

  // 4. Female English voice from other locales (e.g. Zira, Jenny, Aria, Samantha, Ava, Google UK English Female)
  const otherFemaleEnglishVoice = voices.find((v) => {
    const isEn = (v.lang || "").toLowerCase().startsWith("en");
    return isEn && (isLikelyFemaleVoice(v) || v.name.toLowerCase().includes("female"));
  });
  if (otherFemaleEnglishVoice) return otherFemaleEnglishVoice;

  // 5. Any other female voice from any locale
  const anyFemaleVoice = voices.find((v) => isLikelyFemaleVoice(v));
  if (anyFemaleVoice) return anyFemaleVoice;

  // 6. Any English voice
  const anyEnglishVoice = voices.find((v) => (v.lang || "").toLowerCase().startsWith("en"));
  if (anyEnglishVoice) return anyEnglishVoice;

  // 7. Fallback safely to existing first available voice without throwing
  return voices[0] || null;
}

/**
 * Initializes voice selection, listening to voiceschanged if needed
 */
export function initVoiceSelection(onVoiceSelected?: (voice: SpeechSynthesisVoice) => void): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const updateVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const selected = selectAriaVoice(voices);
      if (selected) {
        cachedVoice = selected;
        if (!hasLoggedSelection) {
          console.log(`[Aria TTS] Selected voice: "${selected.name}" (${selected.lang}) - Voice URI: ${selected.voiceURI}`);
          hasLoggedSelection = true;
        }
        if (onVoiceSelected) {
          onVoiceSelected(selected);
        }
      }
    }
  };

  // Immediate attempt
  updateVoice();

  // Listen for dynamic voice loads in Chrome / Edge / Safari
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = updateVoice;
  }
}

/**
 * Get current cached voice or select immediately from current voices
 */
export function getSelectedAriaVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoice = selectAriaVoice(voices);
      return cachedVoice;
    }
  }
  return null;
}

/**
 * Diagnostic helper returning the selected voice details
 */
export function getVoiceDiagnostic(): VoiceDiagnostic | null {
  const voice = getSelectedAriaVoice();
  if (!voice) return null;
  return {
    name: voice.name,
    lang: voice.lang,
    isPreferred: voice.name.toLowerCase().includes("heera"),
    isFemaleLikely: isLikelyFemaleVoice(voice),
    voiceURI: voice.voiceURI,
  };
}
