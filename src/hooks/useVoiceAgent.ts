"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { VoiceState, TranscriptMessage, CallSummary } from "@/types";

interface UseVoiceAgentReturn {
  voiceState: VoiceState;
  isCallActive: boolean;
  transcript: TranscriptMessage[];
  currentSpeakerText: string;
  errorMessage: string | null;
  detectedOrderId: string | null;
  callSummary: CallSummary | null;
  callId: string | null;
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
  const [callSummary, setCallSummary] = useState<CallSummary | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);

  // References to preserve instances across re-renders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isCallActiveRef = useRef<boolean>(false);
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const detectedOrderIdRef = useRef<string | null>(null);

  // Keep ref synchronized with state for callback closures
  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    detectedOrderIdRef.current = detectedOrderId;
  }, [detectedOrderId]);

  // Check Web Speech API availability on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasRecognition = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
      const hasSynthesis = "speechSynthesis" in window;
      if (!hasRecognition || !hasSynthesis) {
        setIsSpeechSupported(false);
      }
    }
  }, []);

  // Helper to add a transcript item
  const addTranscript = useCallback((sender: "customer" | "aria", text: string) => {
    const newMsg: TranscriptMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
    setTranscript((prev) => [...prev, newMsg]);
  }, []);

  // Browser speech synthesis function
  const speakAriaResponse = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }

        // Cancel any pending speech
        window.speechSynthesis.cancel();

        isSpeakingRef.current = true;
        setVoiceState("speaking");

        // Pause speech recognition while Aria speaks to avoid acoustic feedback
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {
            // Ignore abort error
          }
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;

        // Try to pick an en-IN or pleasant English voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find((v) => v.lang.includes("en-IN") || v.name.includes("India")) ||
          voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Female"))) ||
          voices.find((v) => v.lang.startsWith("en"));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
          isSpeakingRef.current = false;
          if (isCallActiveRef.current) {
            setVoiceState("listening");
            // Restart speech recognition cleanly after Aria finishes speaking
            restartRecognition();
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
            restartRecognition();
          } else {
            setVoiceState("idle");
          }
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Send message to server backend API
  const sendTextMessage = useCallback(
    async (text: string) => {
      if (!text || text.trim() === "") return;

      const userText = text.trim();
      addTranscript("customer", userText);
      setCurrentSpeakerText("");
      setVoiceState("thinking");

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
        const reply = data.reply || "I am here to help you with your order. How can I assist?";

        if (data.detectedOrderId) {
          setDetectedOrderId(data.detectedOrderId);
        }

        addTranscript("aria", reply);

        // Speak aloud
        await speakAriaResponse(reply);
      } catch (err: unknown) {
        console.error("Agent chat error:", err);
        setErrorMessage("Network or connection error. Please try again.");
        setVoiceState("error");

        const fallbackErr = "I am having trouble with the connection. Could you please repeat that?";
        addTranscript("aria", fallbackErr);
        await speakAriaResponse(fallbackErr);
      }
    },
    [addTranscript, callId, speakAriaResponse]
  );

  // Restart speech recognition safely
  const restartRecognition = useCallback(() => {
    if (!isCallActiveRef.current || isSpeakingRef.current) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e: unknown) {
        // Recognition might already be active or starting
      }
    }
  }, []);

  // Initialize Speech Recognition instance
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Prefer Indian English
    recognition.lang = "en-IN";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      if (isSpeakingRef.current) return;

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
      console.warn("SpeechRecognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setErrorMessage("Microphone access was denied. Please allow microphone permissions in your browser.");
        setVoiceState("error");
      } else if (event.error === "no-speech") {
        // Normal quiet pause, continue listening
      } else if (event.error === "network") {
        setErrorMessage("Speech recognition network error. Please verify your internet connection.");
      }
    };

    recognition.onend = () => {
      // If the call is still active and Aria isn't speaking, restart recognition
      if (isCallActiveRef.current && !isSpeakingRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Ignore restart conflicts
        }
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

    const newCallId = `call_${Date.now()}`;
    setCallId(newCallId);
    setIsCallActive(true);
    isCallActiveRef.current = true;
    setVoiceState("listening");

    // Initialize recognition
    initSpeechRecognition();

    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (e) {
      console.warn("Error starting speech recognition:", e);
    }

    // Aria warm greeting
    const welcomeText = "Namaste! I am Aria from Aura Skincare. How can I help you today?";
    addTranscript("aria", welcomeText);
    speakAriaResponse(welcomeText);
  }, [addTranscript, initSpeechRecognition, speakAriaResponse]);

  // End Call action
  const endCall = useCallback(async () => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setVoiceState("idle");
    setCurrentSpeakerText("");

    // Stop speech synthesis immediately
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;

    // Stop speech recognition cleanly
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
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
    callSummary,
    callId,
    startCall,
    endCall,
    sendTextMessage,
    isSpeechSupported,
    clearError: () => setErrorMessage(null),
  };
}
