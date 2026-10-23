"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { VoiceState, TranscriptMessage, CallSummary, MockOrder } from "@/types";
import {
  initVoiceSelection,
  getSelectedAriaVoice,
  getVoiceDiagnostic,
  VoiceDiagnostic,
} from "@/lib/services/voiceService";

interface UseVoiceAgentReturn {
  voiceState: VoiceState;
  isCallActive: boolean;
  transcript: TranscriptMessage[];
  currentSpeakerText: string;
  errorMessage: string | null;
  detectedOrderId: string | null;
  activeOrderCard: MockOrder | null;
  callSummary: CallSummary | null;
  callId: string | null;
  voiceDiagnostic: VoiceDiagnostic | null;
  startCall: () => void;
  endCall: () => void;
  sendTextMessage: (text: string) => Promise<void>;
  isSpeechSupported: boolean;
  clearError: () => void;
}

export function useVoiceAgent(): UseVoiceAgentReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [currentSpeakerText, setCurrentSpeakerText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedOrderId, setDetectedOrderId] = useState<string | null>(null);
  const [activeOrderCard, setActiveOrderCard] = useState<MockOrder | null>(null);
  const [callSummary, setCallSummary] = useState<CallSummary | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);
  const [voiceDiagnostic, setVoiceDiagnostic] = useState<VoiceDiagnostic | null>(null);

  // References to preserve instances across re-renders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isCallActiveRef = useRef<boolean>(false);
  const isProcessingTurnRef = useRef<boolean>(false);
  const isRecognitionActiveRef = useRef<boolean>(false);
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const detectedOrderIdRef = useRef<string | null>(null);

  // Keep refs synchronized with state
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    detectedOrderIdRef.current = detectedOrderId;
  }, [detectedOrderId]);

  // Restart speech recognition safely with guards
  const restartRecognition = useCallback(() => {
    if (!isCallActiveRef.current || isSpeakingRef.current || isProcessingTurnRef.current) return;
    if (recognitionRef.current && !isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.start();
        isRecognitionActiveRef.current = true;
        setVoiceState("listening");
      } catch (e: unknown) {
        // Recognition might already be active or starting
      }
    }
  }, []);

  // Initialize Voice and check Web Speech API on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasRecognition = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
      const hasSynthesis = "speechSynthesis" in window;
      if (!hasRecognition || !hasSynthesis) {
        setIsSpeechSupported(false);
      }

      // Initialize voice selection and cache
      initVoiceSelection(() => {
        setVoiceDiagnostic(getVoiceDiagnostic());
      });
      setVoiceDiagnostic(getVoiceDiagnostic());
    }
  }, []);

  // Helper to add a transcript item with optional order attachment
  const addTranscript = useCallback((sender: "customer" | "aria", text: string, order?: MockOrder | null) => {
    const newMsg: TranscriptMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      order: order || undefined,
    };
    setTranscript((prev) => [...prev, newMsg]);
  }, []);

  // Consistent speech synthesis with selected Aria voice
  const speakAriaResponse = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }

        // Cancel previous utterances to prevent queuing/overlapping speech
        window.speechSynthesis.cancel();

        isSpeakingRef.current = true;
        setVoiceState("responding");

        // Temporarily pause recognition while Aria speaks to prevent acoustic feedback/echo
        if (recognitionRef.current && isRecognitionActiveRef.current) {
          try {
            recognitionRef.current.abort();
            isRecognitionActiveRef.current = false;
          } catch (e) {
            // Ignore abort error
          }
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        // Explicitly assign the selected voice
        const voice = getSelectedAriaVoice();
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onend = () => {
          isSpeakingRef.current = false;
          if (isCallActiveRef.current) {
            setVoiceState("listening");
            // Delay slightly (150ms) to ensure mic clears audio hardware before restarting
            setTimeout(() => {
              restartRecognition();
            }, 150);
          } else {
            setVoiceState("idle");
          }
          resolve();
        };

        utterance.onerror = (e) => {
          console.warn("SpeechSynthesis error:", e);
          isSpeakingRef.current = false;
          if (isCallActiveRef.current) {
            setVoiceState("listening");
            setTimeout(() => {
              restartRecognition();
            }, 150);
          } else {
            setVoiceState("idle");
          }
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [restartRecognition]
  );

  // Send message to server backend API
  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!text || text.trim() === "") return;
      if (isProcessingTurnRef.current) return; // Prevent concurrent duplicate submissions

      isProcessingTurnRef.current = true;
      const userText = text.trim();
      addTranscript("customer", userText);
      setCurrentSpeakerText("");
      setVoiceState("thinking");

      // Temporarily stop recognition during thinking to avoid capturing background ambient noise
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.abort();
          isRecognitionActiveRef.current = false;
        } catch (e) {
          // Ignore
        }
      }

      try {
        const historyForApi = transcriptRef.current.map((t) => ({
          sender: t.sender,
          text: t.text,
        }));

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: userText,
            callId: callId || undefined,
            history: historyForApi,
          }),
        });

        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }

        const data = await res.json();
        const reply = data.reply || "I'm having trouble processing that right now. Please try again.";

        if (data.detectedOrderId) {
          setDetectedOrderId(data.detectedOrderId);
        }

        // Attach order card if real lookup returned an order
        let returnedOrder: MockOrder | null = null;
        if (data.toolResult?.order) {
          returnedOrder = data.toolResult.order as MockOrder;
          setActiveOrderCard(returnedOrder);
        }

        addTranscript("aria", reply, returnedOrder);

        // Speak Aria's response
        await speakAriaResponse(reply);
      } catch (err: unknown) {
        console.error("Agent chat error:", err);
        setErrorMessage("Network or connection error. Please try again.");
        setVoiceState("error");

        const fallbackErr = "I'm having trouble processing that right now. Please try again.";
        addTranscript("aria", fallbackErr);
        await speakAriaResponse(fallbackErr);
      } finally {
        isProcessingTurnRef.current = false;
        // If speaking has already ended by the time finally runs, ensure recognition restarts
        if (!isSpeakingRef.current && isCallActiveRef.current) {
          restartRecognition();
        }
      }
    },
    [addTranscript, callId, speakAriaResponse, restartRecognition]
  );

  // Initialize Speech Recognition instance
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    // Clean up previous instance if any
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      isRecognitionActiveRef.current = false;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Prefer Indian English locale for voice CX
    recognition.lang = "en-IN";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onstart = () => {
      isRecognitionActiveRef.current = true;
      if (!isSpeakingRef.current && !isProcessingTurnRef.current && isCallActiveRef.current) {
        setVoiceState("listening");
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      if (isSpeakingRef.current || isProcessingTurnRef.current) return;

      let interim = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (interim) {
        setCurrentSpeakerText(interim);
      }

      if (finalTranscript.trim()) {
        setCurrentSpeakerText("");
        sendTextMessage(finalTranscript.trim());
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      // "no-speech" and "aborted" are standard lifecycle events, not critical fatal errors
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }

      console.warn("SpeechRecognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setErrorMessage("Microphone access was denied. Please allow microphone permissions in your browser.");
        setVoiceState("error");
      } else if (event.error === "network") {
        setErrorMessage("Speech recognition network error. Please verify your internet connection.");
      }
    };

    recognition.onend = () => {
      isRecognitionActiveRef.current = false;
      // If the call is still active and neither speaking nor processing, restart recognition immediately
      if (isCallActiveRef.current && !isSpeakingRef.current && !isProcessingTurnRef.current) {
        setTimeout(() => {
          if (isCallActiveRef.current && !isSpeakingRef.current && !isProcessingTurnRef.current) {
            try {
              recognition.start();
              isRecognitionActiveRef.current = true;
              setVoiceState("listening");
            } catch (e) {
              // Ignore restart conflicts
            }
          }
        }, 100);
      } else if (!isCallActiveRef.current) {
        setVoiceState("idle");
      }
    };

    recognitionRef.current = recognition;
  }, [sendTextMessage]);

  // Start Call action
  const startCall = useCallback(() => {
    setErrorMessage(null);
    setCallSummary(null);
    setTranscript([]);
    setDetectedOrderId(null);
    setActiveOrderCard(null);

    const newCallId = `call_${Date.now()}`;
    setCallId(newCallId);
    setIsCallActive(true);
    isCallActiveRef.current = true;
    setVoiceState("responding");

    // Initialize recognition
    initSpeechRecognition();

    // Aria warm initial greeting
    const welcomeText = "Namaste! I am Aria from Aura Skincare. How can I help you today?";
    addTranscript("aria", welcomeText);
    speakAriaResponse(welcomeText);
  }, [addTranscript, initSpeechRecognition, speakAriaResponse]);

  // End Call action
  const endCall = useCallback(async () => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setVoiceState("ended");
    setCurrentSpeakerText("");

    // Stop speech synthesis immediately
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    isProcessingTurnRef.current = false;

    // Stop speech recognition cleanly and ensure no restart
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
      isRecognitionActiveRef.current = false;
    }

    const currentCallId = callId || `call_${Date.now()}`;

    // Request structured call summary from backend
    try {
      const historyToSend = transcriptRef.current.map((t) => ({
        sender: t.sender,
        text: t.text,
        timestamp: t.timestamp,
      }));

      const res = await fetch(`/api/calls/${currentCallId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: historyToSend,
          detectedOrderId: detectedOrderIdRef.current,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCallSummary(data.summary);
      }
    } catch (e) {
      console.warn("Failed to generate call summary:", e);
    }
  }, [callId]);

  return {
    voiceState,
    isCallActive,
    transcript,
    currentSpeakerText,
    errorMessage,
    detectedOrderId,
    activeOrderCard,
    callSummary,
    callId,
    voiceDiagnostic,
    startCall,
    endCall,
    sendTextMessage,
    isSpeechSupported,
    clearError: () => setErrorMessage(null),
  };
}
