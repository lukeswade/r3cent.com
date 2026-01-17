import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaptureStore } from '@/lib/store';
import { useSpeech } from '@/lib/speech';

export function CaptureSheet() {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'voice' | 'scrawl'>('menu');
  const { isRecording, transcript, setRecording, setTranscript, saveThought, saveScrawl } = useCaptureStore();
  const recordingStartTime = useRef<number>(0);
  const navigate = useNavigate();

  const handleResult = useCallback((text: string, _isFinal: boolean) => {
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
      setIsOpen(false);
      setMode('menu');
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
      setTranscript('');
      if (start()) {
        setRecording(true);
      }
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stop();
    }
    setIsOpen(false);
    setMode('menu');
    setTranscript('');
  };

  const openVoice = () => {
    setMode('voice');
    // Auto-start recording
    recordingStartTime.current = Date.now();
    setTranscript('');
    if (start()) {
      setRecording(true);
    }
  };

  // Floating action button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand-600 hover:bg-brand-500 rounded-full shadow-lg shadow-brand-600/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40"
      >
        <PlusIcon className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {mode === 'menu' && (
        <SpeedDial
          onVoice={openVoice}
          onScrawl={() => setMode('scrawl')}
          onChat={() => { handleClose(); navigate('/ask'); }}
          onClose={handleClose}
          isSupported={isSupported}
        />
      )}

      {mode === 'voice' && (
        <VoiceCapture
          isRecording={isRecording}
          transcript={transcript}
          isSupported={isSupported}
          onToggle={toggleRecording}
          onClose={handleClose}
        />
      )}

      {mode === 'scrawl' && (
        <ScrawlCapture
          onSave={async (text) => {
            await saveScrawl(text);
            handleClose();
          }}
          onClose={handleClose}
        />
      )}
    </div>
  );
}

// Speed dial menu radiating from bottom-right
function SpeedDial({ 
  onVoice, 
  onScrawl, 
  onChat, 
  onClose,
  isSupported 
}: { 
  onVoice: () => void; 
  onScrawl: () => void; 
  onChat: () => void; 
  onClose: () => void;
  isSupported: boolean;
}) {
  return (
    <div className="absolute bottom-24 right-4 flex flex-col-reverse items-center gap-3">
      {/* Close button (where + was) */}
      <button
        onClick={onClose}
        className="w-14 h-14 bg-slate-700 hover:bg-slate-600 rounded-full shadow-lg flex items-center justify-center transition-all"
      >
        <XIcon className="w-6 h-6 text-white" />
      </button>

      {/* Options radiating upward */}
      <div className="flex flex-col gap-3 animate-fade-in">
        {/* Chat with AI */}
        <button
          onClick={onChat}
          className="flex items-center gap-3 group"
        >
          <span className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Chat with AI
          </span>
          <div className="w-12 h-12 bg-brand-600 hover:bg-brand-500 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110">
            <ChatIcon className="w-5 h-5 text-white" />
          </div>
        </button>

        {/* Write a scrawl */}
        <button
          onClick={onScrawl}
          className="flex items-center gap-3 group"
        >
          <span className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Write a note
          </span>
          <div className="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110">
            <PenIcon className="w-5 h-5 text-white" />
          </div>
        </button>

        {/* Record a thought */}
        <button
          onClick={onVoice}
          disabled={!isSupported}
          className="flex items-center gap-3 group disabled:opacity-50"
        >
          <span className="px-3 py-1.5 bg-slate-800 text-slate-300 text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {isSupported ? 'Record a thought' : 'Voice not supported'}
          </span>
          <div className="w-12 h-12 bg-red-600 hover:bg-red-500 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 disabled:hover:scale-100">
            <MicIcon className="w-5 h-5 text-white" />
          </div>
        </button>
      </div>
    </div>
  );
}

// Voice capture sheet
function VoiceCapture({
  isRecording,
  transcript,
  isSupported,
  onToggle,
  onClose,
}: {
  isRecording: boolean;
  transcript: string;
  isSupported: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl p-6 pb-safe animate-slide-up">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white">
        <XIcon className="w-5 h-5" />
      </button>
      
      <div className="flex flex-col items-center gap-6 pt-4">
        <h3 className="text-lg font-semibold">Record a thought</h3>
        
        <button
          onClick={onToggle}
          disabled={!isSupported}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            isRecording 
              ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' 
              : 'bg-red-600 hover:bg-red-500'
          }`}
        >
          {isRecording ? (
            <StopIcon className="w-8 h-8 text-white" />
          ) : (
            <MicIcon className="w-8 h-8 text-white" />
          )}
        </button>
        
        <p className="text-sm text-slate-400">
          {isRecording ? 'Tap to stop and save' : 'Tap to start recording'}
        </p>
        
        {transcript && (
          <div className="w-full bg-slate-800/50 rounded-xl p-4 max-h-32 overflow-y-auto">
            <p className="text-slate-300 text-sm">{transcript}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Scrawl capture sheet
function ScrawlCapture({
  onSave,
  onClose,
}: {
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    await onSave(text.trim());
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl p-6 pb-safe animate-slide-up">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white">
        <XIcon className="w-5 h-5" />
      </button>
      
      <div className="flex flex-col gap-4 pt-4">
        <h3 className="text-lg font-semibold">Write a note</h3>
        
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind?"
          className="input resize-none h-32"
          autoFocus
        />
        
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          className="btn-primary w-full disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

function PenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12c0 4.5-4 8-9 8a9.5 9.5 0 0 1-3-.5L3 21l1.5-4.5C3.5 15 3 13.5 3 12c0-4.5 4-8 9-8s9 3.5 9 8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
