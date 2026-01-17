import { useState, useRef, useCallback } from 'react';
import { useCaptureStore } from '@/lib/store';
import { useSpeech } from '@/lib/speech';

export function CaptureSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const { isRecording, transcript, setRecording, setTranscript, saveThought } = useCaptureStore();
  const recordingStartTime = useRef<number>(0);
  
  const handleResult = useCallback((text: string, isFinal: boolean) => {
    setTranscript(text);
  }, [setTranscript]);
  
  const handleError = useCallback((error: string) => {
    console.error('Speech error:', error);
    setRecording(false);
  }, [setRecording]);
  
  const handleEnd = useCallback(() => {
    if (isRecording && transcript) {
      const duration = Date.now() - recordingStartTime.current;
      saveThought(transcript, duration);
    }
    setRecording(false);
  }, [isRecording, transcript, saveThought, setRecording]);
  
  const { isSupported, start, stop } = useSpeech({
    onResult: handleResult,
    onError: handleError,
    onEnd: handleEnd,
  });
  
  const toggleRecording = () => {
    if (isRecording) {
      stop();
    } else {
      recordingStartTime.current = Date.now();
      if (start()) {
        setRecording(true);
      }
    }
  };
  
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand-600 hover:bg-brand-500 rounded-full shadow-lg shadow-brand-600/30 flex items-center justify-center transition-colors z-40"
      >
        <PlusIcon className="w-6 h-6" />
      </button>
    );
  }
  
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl p-6 pb-safe animate-slide-up">
        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-6" />
        
        <div className="flex flex-col items-center gap-6">
          {/* Recording button */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={toggleRecording}
              disabled={!isSupported}
              className={`btn-record ${isRecording ? 'recording' : ''}`}
            >
              {isRecording ? (
                <StopIcon className="w-8 h-8" />
              ) : (
                <MicIcon className="w-8 h-8" />
              )}
            </button>
            
            <p className="text-sm text-slate-400">
              {isRecording ? 'Tap to stop' : 'Tap to record a thought'}
            </p>
            
            {!isSupported && (
              <p className="text-xs text-red-400">
                Speech recognition not supported in this browser
              </p>
            )}
          </div>
          
          {/* Transcript preview */}
          {transcript && (
            <div className="w-full bg-slate-800/50 rounded-xl p-4">
              <p className="text-slate-300 text-sm">{transcript}</p>
            </div>
          )}
          
          {/* Divider */}
          <div className="flex items-center gap-4 w-full">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>
          
          {/* Quick scrawl */}
          <QuickScrawl onComplete={() => setIsOpen(false)} />
        </div>
      </div>
    </div>
  );
}

function QuickScrawl({ onComplete }: { onComplete: () => void }) {
  const [text, setText] = useState('');
  const { saveScrawl } = useCaptureStore();
  
  const handleSave = async () => {
    if (text.trim()) {
      await saveScrawl(text.trim());
      setText('');
      onComplete();
    }
  };
  
  return (
    <div className="w-full">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a quick note..."
        className="input resize-none h-24"
      />
      <button
        onClick={handleSave}
        disabled={!text.trim()}
        className="btn-primary w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save Scrawl
      </button>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
