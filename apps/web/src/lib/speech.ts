// Speech recognition hook for voice capture
// Uses Web Speech API (SpeechRecognition)

interface UseSpeechOptions {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  language?: string;
  continuous?: boolean;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

// SpeechRecognition type for Web Speech API
type SpeechRecognitionType = {
  new (): SpeechRecognitionType;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

let recognition: SpeechRecognitionType | null = null;

export function useSpeech({
  onResult,
  onError,
  onEnd,
  language = 'en-US',
  continuous = true,
}: UseSpeechOptions) {
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  
  const start = () => {
    if (!isSupported) {
      onError?.('Speech recognition not supported');
      return false;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.lang = language;
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        onResult(finalTranscript, true);
      } else if (interimTranscript) {
        onResult(interimTranscript, false);
      }
    };
    
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      onError?.(event.error);
    };
    
    recognition.onend = () => {
      onEnd?.();
    };
    
    recognition.start();
    return true;
  };
  
  const stop = () => {
    if (recognition) {
      recognition.stop();
      recognition = null;
    }
  };
  
  return {
    isSupported,
    start,
    stop,
  };
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionType;
    webkitSpeechRecognition: SpeechRecognitionType;
  }
}
