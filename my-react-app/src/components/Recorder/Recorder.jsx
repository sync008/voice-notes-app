import React, { useState, useRef, useEffect } from 'react';
import { normalizeNumbers } from '../../utils/textUtils';
import './Recorder.css';

const Recorder = ({ onTranscriptComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [showFilipinoWarning, setShowFilipinoWarning] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const isStoppedManually = useRef(false);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);
  }, []);

  const startNewChunk = () => {
    if (isStoppedManually.current || !isRecording) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let final = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          final += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }

      if (final) {
        const clean = normalizeNumbers(final.trim());
        setTranscript(prev => prev + clean + ' ');
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = () => {};
    recognition.onend = () => {
      if (isRecording && !isStoppedManually.current) {
        timeoutRef.current = setTimeout(startNewChunk, 80);
      }
    };

    try { 
      recognition.start(); 
    } catch (e) {}
    
    recognitionRef.current = recognition;

    setTimeout(() => {
      if (recognitionRef.current && isRecording && !isStoppedManually.current) {
        try { 
          recognitionRef.current.stop(); 
        } catch (e) {}
      }
    }, 60000);
  };

  useEffect(() => {
    if (isRecording) {
      setTranscript('');
      setInterimTranscript('');
      setFinalTranscript('');
      isStoppedManually.current = false;
      startNewChunk();
    }

    return () => {
      isStoppedManually.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isRecording, language]);

  const startRecording = () => setIsRecording(true);

  const stopRecording = () => {
    isStoppedManually.current = true;
    setIsRecording(false);
    setInterimTranscript('');
    setFinalTranscript(transcript.trim());
  };

  const saveNote = () => {
    if (finalTranscript) {
      onTranscriptComplete(normalizeNumbers(finalTranscript));
      setFinalTranscript('');
      setTranscript('');
    }
  };

  const discard = () => {
    setFinalTranscript('');
    setTranscript('');
  };

  const handleLanguageClick = (lang) => {
    if (isRecording) return;
    if (lang === 'fil-PH' && isIOS) {
      setShowFilipinoWarning(true);
      setLanguage('en-US');
    } else {
      setShowFilipinoWarning(false);
      setLanguage(lang);
    }
  };

  return (
    <div className="recorder">
      <h2 className="title">Voice Recorder</h2>

      <div className="language-section">
        <h3 className="section-title">Language:</h3>
        <div className="language-buttons">
          <button 
            onClick={() => handleLanguageClick('en-US')} 
            className={`button language-button ${language === 'en-US' ? 'active' : ''}`}
          >
            English
          </button>
          <button 
            onClick={() => handleLanguageClick('fil-PH')} 
            className={`button language-button ${language === 'fil-PH' ? 'active' : ''}`}
          >
            Filipino/Tagalog
          </button>
        </div>
      </div>

      {showFilipinoWarning && (
        <div className="language-note warning-ios">
          Filipino not supported on iPhone → using English
        </div>
      )}

      <div className="controls">
        {!isRecording ? (
          <button onClick={startRecording} className="button start-button">
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="button stop-button">
            Stop Recording
          </button>
        )}
      </div>

      {isRecording && (
        <>
          <div className="recording-indicator">
            <span className="recording-dot">●</span> LISTENING ({language === 'en-US' ? 'English' : 'Filipino'})
          </div>
          <div className="transcript-box live">
            {transcript}
            {interimTranscript && <span className="interim-text">{interimTranscript}...</span>}
          </div>
        </>
      )}

      {!isRecording && finalTranscript && (
        <div className="transcript-section">
          <h3>Ready to save:</h3>
          <div className="transcript-box final">{finalTranscript}</div>
          <div className="transcript-actions">
            <button onClick={saveNote} className="button save-button">Save Note</button>
            <button onClick={discard} className="button discard-button">Discard</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recorder;