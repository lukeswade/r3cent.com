import { useState, useRef, useCallback } from 'react';
import { useCaptureStore } from '@/lib/store';
import { useSpeech } from '@/lib/speech';

export function Capture() {
  const {
    isRecording,
    transcript,
    scrawlText,
    setRecording,
    setTranscript,
    setScrawlText,
    saveThought,
    saveScrawl,
  } = useCaptureStore();
  
  const recordingStartTime = useRef<number>(0);
  const [activeTab, setActiveTab] = useState<'voice' | 'text'>('voice');
  
  const handleResult = useCallback((text: string, isFinal: boolean) => {
    setTranscript(text);
  }, [setTranscript]);
  
  const handleError = useCallback((error: string) => {
    console.error('Speech error:', error);
    setRecording(false);
  }, [setRecording]);
  
  const handleEnd = useCallback(() => {
    // Don't auto-save on end, let user decide
    setRecording(false);
  }, [setRecording]);
  
  const { isSupported, start, stop } = useSpeech({
    onResult: handleResult,
    onError: handleError,
    onEnd: handleEnd,
  });
  
  const toggleRecording = () => {
    if (isRecording) {
      stop();
    } else {
      setTranscript('');
      recordingStartTime.current = Date.now();
      if (start()) {
        setRecording(true);
      }
    }
  };
  
  const handleSaveThought = async () => {
    if (transcript) {
      const duration = Date.now() - recordingStartTime.current;
      await saveThought(transcript, duration);
    }
  };
  
  const handleSaveScrawl = async () => {
    if (scrawlText.trim()) {
      await saveScrawl(scrawlText.trim());
    }
  };
  
  return (
    <div className="p-4">
      {/* Header */}
      <header className="py-4">
        <h1 className="text-2xl font-bold">Capture</h1>
        <p className="text-slate-400 text-sm">Record thoughts or jot down notes</p>
      </header>
      
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('voice')}
          className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'voice'
              ? 'bg-brand-600 text-white'
              : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
          }`}
        >
          🎙 Voice
        </button>
        <button
          onClick={() => setActiveTab('text')}
          className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
            activeTab === 'text'
              ? 'bg-brand-600 text-white'
              : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'
          }`}
        >
          ✍️ Text
        </button>
      </div>
      
      {/* Voice capture */}
      {activeTab === 'voice' && (
        <div className="flex flex-col items-center py-8">
          <button
            onClick={toggleRecording}
            disabled={!isSupported}
            className={`btn-record mb-6 ${isRecording ? 'recording' : ''}`}
          >
            {isRecording ? (
              <StopIcon className="w-10 h-10" />
            ) : (
              <MicIcon className="w-10 h-10" />
            )}
          </button>
          
          <p className="text-slate-400 mb-6">
            {isRecording ? 'Listening...' : 'Tap to start recording'}
          </p>
          
          {!isSupported && (
            <p className="text-sm text-red-400 mb-4">
              Speech recognition is not supported in this browser. Try Chrome or Safari.
            </p>
          )}
          
          {/* Transcript display */}
          {transcript && (
            <div className="w-full bg-slate-800/50 rounded-xl p-4 mb-4">
              <p className="text-slate-300">{transcript}</p>
            </div>
          )}
          
          {/* Save button */}
          {transcript && !isRecording && (
            <button onClick={handleSaveThought} className="btn-primary w-full">
              Save Thought
            </button>
          )}
        </div>
      )}
      
      {/* Text capture */}
      {activeTab === 'text' && (
        <div className="py-4">
          <textarea
            value={scrawlText}
            onChange={(e) => setScrawlText(e.target.value)}
            placeholder="What's on your mind?"
            className="input resize-none h-48 mb-4"
            autoFocus
          />
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">
              {scrawlText.length} characters
            </span>
            <button
              onClick={handleSaveScrawl}
              disabled={!scrawlText.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Scrawl
            </button>
          </div>
        </div>
      )}
    </div>
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
