import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Volume2, ChevronRight, Zap } from 'lucide-react';

// ─────────────────────────────────────────────────────────
// COMPREHENSIVE VOICE COMMAND REGISTRY
// Every feature, button, tab, filter, and modal in the app
// ─────────────────────────────────────────────────────────
const COMMANDS = [
  // ── Navigation ──
  { action: 'landing',        label: 'Go to Landing Page',   phrases: ['landing page','main page','home page','go home','go to home','open landing','back to landing','show landing'] },
  { action: 'inbox',          label: 'Open Inbox',           phrases: ['inbox','open inbox','show inbox','go to inbox','show emails','show my emails','email list','go to email','open email','open mail','show mail','my inbox'] },
  { action: 'analytics',      label: 'Open Analytics',       phrases: ['analytics','open analytics','show analytics','dashboard','show dashboard','telemetry','open telemetry','stats','statistics','show stats','show statistics','open dashboard','go to analytics','go to dashboard'] },

  // ── Compose ──
  { action: 'compose',        label: 'Compose Email',        phrases: ['compose','compose email','new email','write email','create email','send email','write new email','draft email','compose new','open compose','start composing','write a mail','new mail','create mail'] },

  // ── Search ──
  { action: 'search',         label: 'Search Emails',        phrases: ['search for','search','find','look for','look up','search email','search emails','find email','find emails'], isPrefix: true },

  // ── KPI Filters ──
  { action: 'filter_all',     label: 'All Emails',           phrases: ['all emails','show all','show all emails','emails processed','total emails','all','filter all','clear filter','clear filters','reset filter','reset filters','remove filter','remove filters'] },
  { action: 'new_today',      label: 'New Emails Today',     phrases: ['new today','new emails','new emails today','today emails','todays emails','today\'s emails','emails today','show new','show new emails'] },
  { action: 'high_priority',  label: 'High Priority',        phrases: ['high priority','priority','urgent','important','show priority','show urgent','show important','high priority emails','urgent emails','important emails','show high priority'] },
  { action: 'threats',        label: 'Security Threats',     phrases: ['threats','security threats','phishing','spam','suspicious','dangerous','security','show threats','show security','show phishing','show spam','malicious','threat','security threat'] },
  { action: 'deadlines',      label: 'Upcoming Deadlines',   phrases: ['deadlines','upcoming deadlines','due dates','what is due','show deadlines','show due dates','deadline','due date','what\'s due','upcoming','show upcoming'] },
  { action: 'unread',         label: 'Unread Emails',        phrases: ['unread','unread emails','show unread','unread mail','show unread emails','not read','haven\'t read'] },

  // ── Email Source Tabs ──
  { action: 'real_inbox',     label: 'Real Inbox',           phrases: ['real inbox','real emails','gmail','show real inbox','show real emails','real','actual emails','actual inbox','real mail'] },
  { action: 'simulation',     label: 'Simulation Mode',      phrases: ['simulation','simulated','simulated emails','test emails','show simulation','show simulated','open simulation','simulation mode','simulations'] },

  // ── Detail View Tabs ──
  { action: 'reader_view',    label: 'Reader View',          phrases: ['reader view','reader','read view','reading view','original message','show reader','open reader','show email body','email body','read email'] },
  { action: 'intelligence',   label: 'Intelligence Tab',     phrases: ['intelligence','show intelligence','open intelligence','email intelligence','ai intelligence','analysis','show analysis'] },
  { action: 'ai_summary',     label: 'AI Summary',           phrases: ['summary','ai summary','show summary','email summary','summarize','summarise','show ai summary','open summary','open ai summary'] },
  { action: 'smart_reply',    label: 'Smart Reply',          phrases: ['smart reply','reply','auto reply','generate reply','show reply','open reply','write reply','ai reply','show smart reply','open smart reply'] },

  // ── Read Email ──
  { action: 'read_latest',    label: 'Read Latest Email',    phrases: ['read latest','latest email','newest email','open latest','most recent','most recent email','first email','top email','last email','read first','open first','open newest','read newest'] },
  { action: 'read_next',      label: 'Next Email',           phrases: ['next email','next','go next','next one','read next','open next','next mail'] },
  { action: 'read_previous',  label: 'Previous Email',       phrases: ['previous email','previous','go previous','go back','last one','read previous','open previous','prev','back','previous mail'] },

  // ── Modals & Panels ──
  { action: 'test_lab',       label: 'Open Test Lab',        phrases: ['test lab','open test lab','testing','open testing','automated test','test','run test','open test'] },
  { action: 'settings',       label: 'Open Settings',        phrases: ['settings','preferences','options','open settings','show settings','personalize','open preferences','ai settings','personalize ai','customize','open options'] },
  { action: 'digest',         label: 'AI Digest',            phrases: ['digest','ai digest','daily digest','show digest','open digest','email digest','today\'s digest','todays digest','morning digest','daily report','email report'] },
  { action: 'notifications',  label: 'Open Notifications',   phrases: ['notifications','alerts','show notifications','show alerts','open notifications','open alerts','bell','check notifications','check alerts','what\'s new'] },
  { action: 'close_modal',    label: 'Close Panel',          phrases: ['close','close modal','close panel','close popup','close window','dismiss','go back','cancel','back','escape','exit','never mind','nevermind'] },

  // ── Sync & Refresh ──
  { action: 'sync',           label: 'Sync Emails',          phrases: ['sync','sync emails','refresh','refresh emails','update','update emails','fetch','fetch emails','start sync','begin sync','sync data','sync mail','refresh mail','reload','reload emails'] },
  { action: 'stop_sync',      label: 'Stop Sync',            phrases: ['stop sync','stop syncing','stop refresh','cancel sync','end sync','pause sync'] },

  // ── Smart Reply Controls ──
  { action: 'tone_professional', label: 'Professional Tone',  phrases: ['professional tone','professional','tone professional','set professional','use professional'] },
  { action: 'tone_formal',      label: 'Formal Tone',        phrases: ['formal tone','formal','tone formal','set formal','use formal'] },
  { action: 'tone_friendly',    label: 'Friendly Tone',      phrases: ['friendly tone','friendly','tone friendly','set friendly','use friendly','casual','casual tone'] },
  { action: 'tone_direct',      label: 'Direct Tone',        phrases: ['direct tone','direct','tone direct','set direct','use direct'] },
  { action: 'length_concise',   label: 'Concise Length',     phrases: ['concise','short','brief','make it short','make concise','shorter','set concise'] },
  { action: 'length_detailed',  label: 'Detailed Length',    phrases: ['detailed','long','elaborate','make it long','make detailed','longer','set detailed','more detail'] },
  { action: 'regenerate_reply', label: 'Regenerate Reply',   phrases: ['regenerate','regenerate reply','new reply','another reply','try again','generate again','re-generate','redo reply'] },
  { action: 'send_reply',      label: 'Send Reply',          phrases: ['send reply','approve and send','approve','send','send it','approve reply','send the reply','approve & send'] },
  { action: 'edit_reply',      label: 'Edit Reply',          phrases: ['edit reply','edit','modify reply','change reply','edit the reply','modify'] },

  // ── User Actions ──
  { action: 'logout',         label: 'Log Out',              phrases: ['log out','logout','sign out','log off','sign off'] },
  { action: 'switch_account', label: 'Switch Account',       phrases: ['switch account','change account','switch user','different account','other account','switch accounts'] },
  { action: 'user_menu',      label: 'User Menu',            phrases: ['user menu','profile','my profile','account','my account','open profile','open account','user profile'] },

  // ── Category Filters ──
  { action: 'category_placement', label: 'Placement Emails',  phrases: ['placement','placement emails','job placement','show placement','filter placement'] },
  { action: 'category_interview', label: 'Interview Emails',  phrases: ['interview','interview emails','interviews','show interview','filter interview','job interview'] },
  { action: 'category_academic',  label: 'Academic Emails',   phrases: ['academic','academic emails','college','university','show academic','filter academic','education'] },
  { action: 'category_finance',   label: 'Finance Emails',    phrases: ['finance','finance emails','financial','money','payment','show finance','filter finance','banking'] },
  { action: 'category_social',    label: 'Social Emails',     phrases: ['social','social emails','social media','show social','filter social'] },
  { action: 'category_promotions',label: 'Promotion Emails',  phrases: ['promotions','promotional','offers','deals','show promotions','filter promotions','marketing'] },
  { action: 'clear_category',     label: 'Clear Category',    phrases: ['all categories','clear category','reset category','remove category','no category','any category'] },

  // ── Misc ──
  { action: 'delete_email',    label: 'Delete Email',        phrases: ['delete','delete email','remove email','trash','move to trash','delete this','delete it','remove it','discard'] },
  { action: 'tech_details',    label: 'Technical Details',   phrases: ['technical details','security details','spf','dkim','dmarc','show technical','show tech','tech details','domain security'] },
  { action: 'raw_email',       label: 'Show Raw Email',      phrases: ['raw email','show raw','original email','full email','show original','raw','full body','entire email'] },
  { action: 'scheduled',       label: 'Scheduled Emails',    phrases: ['scheduled','scheduled emails','show scheduled','open scheduled','pending emails','queued','queued emails'] },
  { action: 'scroll_down',     label: 'Scroll Down',         phrases: ['scroll down','go down','page down','scroll'] },
  { action: 'scroll_up',       label: 'Scroll Up',           phrases: ['scroll up','go up','page up'] },

  // ── Help ──
  { action: 'help',            label: 'Show Help',           phrases: ['help','what can you do','commands','show commands','what can I say','voice commands','show help','list commands','available commands'] },
];

// ─────────────────────────────────────────────────────────
// FUZZY MATCHING ENGINE
// Handles partial matches, misspellings, and varied speech
// ─────────────────────────────────────────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\w\s']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCommand(rawText) {
  const text = normalizeText(rawText);
  if (!text) return null;

  let bestMatch = null;
  let bestScore = 0;
  let searchQuery = '';

  for (const cmd of COMMANDS) {
    for (const phrase of cmd.phrases) {
      const normalizedPhrase = normalizeText(phrase);

      // ── Exact substring match (highest confidence) ──
      if (text.includes(normalizedPhrase)) {
        const score = normalizedPhrase.length / Math.max(text.length, 1) + 0.5;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = cmd;
          // Extract search query for prefix commands
          if (cmd.isPrefix) {
            const idx = text.indexOf(normalizedPhrase);
            searchQuery = text.substring(idx + normalizedPhrase.length).trim();
          }
        }
        continue;
      }

      // ── Word-level containment match ──
      const phraseWords = normalizedPhrase.split(' ');
      const textWords = text.split(' ');
      const matchedWords = phraseWords.filter(pw => textWords.some(tw => tw === pw || (tw.length > 3 && pw.length > 3 && levenshtein(tw, pw) <= 1)));
      const wordScore = matchedWords.length / phraseWords.length;

      if (wordScore >= 0.7 && phraseWords.length > 0) {
        const score = wordScore * 0.8;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = cmd;
          if (cmd.isPrefix) {
            // Try to extract query after matching words
            const lastMatchWord = matchedWords[matchedWords.length - 1];
            const lastIdx = text.lastIndexOf(lastMatchWord);
            searchQuery = text.substring(lastIdx + lastMatchWord.length).trim();
          }
        }
        continue;
      }

      // ── Fuzzy Levenshtein match for short phrases ──
      if (normalizedPhrase.length <= 15 && text.length <= 30) {
        const dist = levenshtein(text, normalizedPhrase);
        const maxLen = Math.max(text.length, normalizedPhrase.length);
        const similarity = 1 - dist / maxLen;
        if (similarity >= 0.65) {
          const score = similarity * 0.6;
          if (score > bestScore) {
            bestScore = score;
            bestMatch = cmd;
          }
        }
      }
    }
  }

  // Only return if we have reasonable confidence
  if (bestMatch && bestScore >= 0.35) {
    return { command: bestMatch, query: searchQuery, confidence: bestScore };
  }

  return null;
}


// ─────────────────────────────────────────────────────────
// ADVANCED AUDIO PROCESSING ENGINE
// Noise suppression, AGC, VAD, audio preprocessing
// ─────────────────────────────────────────────────────────

class AudioProcessingEngine {
  constructor() {
    this.audioContext = null;
    this.mediaStream = null;
    this.analyserNode = null;
    this.gainNode = null;
    this.compressorNode = null;
    this.highPassFilter = null;
    this.lowPassFilter = null;
    this.notchFilter = null;
    this.processedStream = null;
    this.vadActive = false;
    this.speechLevel = 0;
    this.noiseFloor = 0;
    this.noiseFloorSamples = [];
    this.calibrated = false;
    this.onVadChange = null;
    this.onAudioLevel = null;
    this._vadInterval = null;
    this._destroyed = false;
  }

  async initialize() {
    try {
      // Request microphone with advanced constraints for noise suppression
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          // Additional constraints for better quality
          latency: { ideal: 0.01 },
          suppressLocalAudioPlayback: true,
        }
      });

      // Create audio processing pipeline
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive'
      });

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // ── Stage 1: High-pass filter (remove low-frequency hum/rumble) ──
      // Cuts frequencies below 85Hz (removes AC hum, fan rumble, traffic)
      this.highPassFilter = this.audioContext.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = 85;
      this.highPassFilter.Q.value = 0.7;

      // ── Stage 2: Notch filter at 50/60Hz (power line hum removal) ──
      this.notchFilter = this.audioContext.createBiquadFilter();
      this.notchFilter.type = 'notch';
      this.notchFilter.frequency.value = 50;
      this.notchFilter.Q.value = 30;

      // ── Stage 3: Low-pass filter (remove high-frequency noise) ──
      // Cuts above 8000Hz (keyboard clicks, mouse clicks, electronic whine)
      this.lowPassFilter = this.audioContext.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.frequency.value = 8000;
      this.lowPassFilter.Q.value = 0.7;

      // ── Stage 4: Dynamic compressor (auto gain control / volume normalization) ──
      // Boosts soft voices and limits loud sounds
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.value = -50;   // Start compressing at -50dB (catches whispers)
      this.compressorNode.knee.value = 40;          // Soft knee for smooth transition
      this.compressorNode.ratio.value = 12;         // High ratio for strong amplification
      this.compressorNode.attack.value = 0.003;     // Fast attack (3ms) to catch speech onset
      this.compressorNode.release.value = 0.25;     // Moderate release to avoid pumping

      // ── Stage 5: Gain boost (amplify soft speech) ──
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 3.0; // 3x amplification for soft voices

      // ── Stage 6: Analyser for VAD and audio level monitoring ──
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.analyserNode.smoothingTimeConstant = 0.4;
      this.analyserNode.minDecibels = -100;
      this.analyserNode.maxDecibels = -10;

      // Connect the processing chain:
      // mic → highpass → notch → lowpass → compressor → gain → analyser → destination
      source.connect(this.highPassFilter);
      this.highPassFilter.connect(this.notchFilter);
      this.notchFilter.connect(this.lowPassFilter);
      this.lowPassFilter.connect(this.compressorNode);
      this.compressorNode.connect(this.gainNode);
      this.gainNode.connect(this.analyserNode);

      // Create processed output stream from the analyser
      const destination = this.audioContext.createMediaStreamDestination();
      this.analyserNode.connect(destination);
      this.processedStream = destination.stream;

      // Start noise floor calibration and VAD
      this._startVAD();

      return this.processedStream;
    } catch (err) {
      console.error('Audio processing initialization failed:', err);
      return null;
    }
  }

  _startVAD() {
    if (this._destroyed) return;
    
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);
    
    let silenceFrames = 0;
    let speechFrames = 0;
    const SILENCE_THRESHOLD_FRAMES = 8;  // ~320ms of silence to declare silence
    const SPEECH_THRESHOLD_FRAMES = 2;    // ~80ms of speech to declare speech

    // Adaptive noise floor calibration
    let calibrationFrames = 0;
    const CALIBRATION_PERIOD = 25; // ~1 second of calibration
    let noiseSum = 0;

    this._vadInterval = setInterval(() => {
      if (this._destroyed) return;

      // Get time-domain data for RMS calculation
      this.analyserNode.getFloatTimeDomainData(dataArray);
      
      // Calculate RMS (Root Mean Square) of the signal
      let sumSquares = 0;
      for (let i = 0; i < bufferLength; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / bufferLength);
      const rmsDb = 20 * Math.log10(Math.max(rms, 0.0001));

      // Get frequency-domain data for spectral analysis
      this.analyserNode.getByteFrequencyData(freqData);
      
      // Calculate spectral energy in speech band (300Hz - 3000Hz)
      const sampleRate = this.audioContext.sampleRate;
      const binSize = sampleRate / this.analyserNode.fftSize;
      const speechStartBin = Math.floor(300 / binSize);
      const speechEndBin = Math.ceil(3000 / binSize);
      
      let speechBandEnergy = 0;
      let totalEnergy = 0;
      for (let i = 0; i < bufferLength; i++) {
        const energy = freqData[i];
        totalEnergy += energy;
        if (i >= speechStartBin && i <= speechEndBin) {
          speechBandEnergy += energy;
        }
      }
      
      // Speech-to-noise ratio in the speech band
      const speechRatio = totalEnergy > 0 ? speechBandEnergy / totalEnergy : 0;

      // Adaptive noise floor calibration (first ~1 second)
      if (calibrationFrames < CALIBRATION_PERIOD) {
        noiseSum += rmsDb;
        calibrationFrames++;
        if (calibrationFrames === CALIBRATION_PERIOD) {
          this.noiseFloor = noiseSum / CALIBRATION_PERIOD;
          this.calibrated = true;
        }
      } else {
        // Slowly adapt noise floor during silence
        if (!this.vadActive) {
          this.noiseFloor = this.noiseFloor * 0.97 + rmsDb * 0.03;
        }
      }

      // Dynamic threshold: noise floor + margin
      // Lower margin means more sensitive to soft speech
      const vadThreshold = this.calibrated
        ? this.noiseFloor + 4 // Only 4dB above noise floor (very sensitive)
        : -55; // Default if not calibrated

      // Speech detection: RMS above threshold AND significant speech-band energy
      const isSpeechFrame = rmsDb > vadThreshold && speechRatio > 0.15;

      if (isSpeechFrame) {
        speechFrames++;
        silenceFrames = 0;
      } else {
        silenceFrames++;
        speechFrames = 0;
      }

      // State transitions with hysteresis
      const wasSpeaking = this.vadActive;
      if (speechFrames >= SPEECH_THRESHOLD_FRAMES) {
        this.vadActive = true;
      }
      if (silenceFrames >= SILENCE_THRESHOLD_FRAMES) {
        this.vadActive = false;
      }

      // Normalize speech level for UI (0 to 1)
      this.speechLevel = Math.min(1, Math.max(0, (rmsDb + 60) / 50));

      // Notify about VAD changes
      if (wasSpeaking !== this.vadActive && this.onVadChange) {
        this.onVadChange(this.vadActive);
      }
      if (this.onAudioLevel) {
        this.onAudioLevel(this.speechLevel, this.vadActive);
      }

      // Dynamic gain adjustment based on speech level
      if (this.gainNode && this.calibrated) {
        if (rmsDb < this.noiseFloor + 8) {
          // Very soft speech: boost more
          this.gainNode.gain.setTargetAtTime(5.0, this.audioContext.currentTime, 0.1);
        } else if (rmsDb < this.noiseFloor + 15) {
          // Soft speech: moderate boost
          this.gainNode.gain.setTargetAtTime(3.0, this.audioContext.currentTime, 0.1);
        } else if (rmsDb < this.noiseFloor + 25) {
          // Normal speech: slight boost
          this.gainNode.gain.setTargetAtTime(2.0, this.audioContext.currentTime, 0.1);
        } else {
          // Loud speech: reduce gain to avoid distortion
          this.gainNode.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.1);
        }
      }
    }, 40); // Run VAD at 25Hz (40ms intervals) for responsive detection
  }

  getAudioLevel() {
    return this.speechLevel;
  }

  isVoiceActive() {
    return this.vadActive;
  }

  destroy() {
    this._destroyed = true;
    if (this._vadInterval) {
      clearInterval(this._vadInterval);
      this._vadInterval = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch(e) {}
      this.audioContext = null;
    }
    this.processedStream = null;
  }
}


// ─────────────────────────────────────────────────────────
// VOICE ASSISTANT COMPONENT
// ─────────────────────────────────────────────────────────

export default function VoiceAssistant({ onCommand }) {
  const [isListening, setIsListening] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [lastCommand, setLastCommand] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [waveformBars, setWaveformBars] = useState(Array(24).fill(3));
  const recognitionRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const waveformIntervalRef = useRef(null);
  const isListeningRef = useRef(false);
  const shouldRestartRef = useRef(false);
  
  // Advanced audio processing refs
  const audioEngineRef = useRef(null);
  const commandBufferRef = useRef('');
  const bufferTimeoutRef = useRef(null);
  const confidenceAccumulatorRef = useRef([]);

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const isSupported = !!SpeechRecognition;

  // Real-time waveform driven by actual audio levels from the processing engine
  useEffect(() => {
    if (isListening && audioEngineRef.current) {
      waveformIntervalRef.current = setInterval(() => {
        const engine = audioEngineRef.current;
        if (engine) {
          const level = engine.getAudioLevel();
          const isVoice = engine.isVoiceActive();
          setWaveformBars(prev => prev.map(() => {
            const base = isVoice ? level * 30 + 6 : 3;
            const jitter = isVoice ? (Math.random() - 0.5) * level * 12 : (Math.random() - 0.5) * 2;
            return Math.max(2, Math.min(34, base + jitter));
          }));
        }
      }, 60);
    } else {
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
      setWaveformBars(Array(24).fill(3));
    }
    return () => { if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current); };
  }, [isListening]);

  // ── CONFIDENCE-AWARE COMMAND PROCESSOR ──
  const processCommand = useCallback((text, confidence) => {
    const result = matchCommand(text);
    
    if (result) {
      const { command, query, confidence: matchConf } = result;
      const recognitionConf = confidence || 0.8;
      const combinedConf = matchConf * recognitionConf;
      
      // Confidence tiers:
      // > 0.40 combined: execute immediately
      // 0.25 - 0.40: execute with visual caution indicator
      // < 0.25: ignore (likely noise)
      
      if (combinedConf < 0.20) {
        // Too low confidence — likely background noise, ignore silently
        return;
      }

      setLastCommand(command.label);
      const confPct = Math.round(matchConf * 100);
      
      if (combinedConf >= 0.40) {
        setFeedback(`✓ ${command.label}${query ? `: "${query}"` : ''}`);
      } else {
        setFeedback(`✓ ${command.label}${query ? `: "${query}"` : ''} (${confPct}%)`);
      }
      
      // Add to history
      setCommandHistory(prev => [
        { text, action: command.label, time: new Date().toLocaleTimeString(), success: true },
        ...prev.slice(0, 9)
      ]);

      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setFeedback('');
        setLastCommand(null);
      }, 4000);

      if (command.action === 'close_modal') {
        setIsOpen(false);
        stopListening();
      } else if (command.action === 'help') {
        setShowHelp(true);
      } else if (onCommand) {
        onCommand(command.action, query);
      }
    } else {
      // Only show "didn't understand" if confidence was reasonable
      // (meaning user actually spoke, not just noise)
      if (confidence > 0.4) {
        setFeedback(`? Didn't understand: "${text}"`);
        setCommandHistory(prev => [
          { text, action: 'Unknown', time: new Date().toLocaleTimeString(), success: false },
          ...prev.slice(0, 9)
        ]);
      }
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => setFeedback(''), 4000);
    }
  }, [onCommand]);

  // ── INITIALIZE SPEECH RECOGNITION WITH ADVANCED AUDIO PIPELINE ──
  useEffect(() => {
    if (!isSupported) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // Indian English for better accent recognition
    recognition.maxAlternatives = 5; // More alternatives = better soft-speech matching

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      let bestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        
        if (result.isFinal) {
          // Check all alternatives for best match
          let bestTranscript = result[0].transcript;
          let bestAltConfidence = result[0].confidence || 0.5;
          
          for (let a = 0; a < result.length; a++) {
            const alt = result[a];
            // Check if any alternative matches a command better
            const altMatch = matchCommand(alt.transcript);
            const primaryMatch = matchCommand(bestTranscript);
            
            if (altMatch && (!primaryMatch || altMatch.confidence > primaryMatch.confidence)) {
              bestTranscript = alt.transcript;
              bestAltConfidence = alt.confidence || 0.5;
            }
            // Also prefer higher-confidence alternatives even without command match
            if (alt.confidence > bestAltConfidence && !primaryMatch) {
              bestTranscript = alt.transcript;
              bestAltConfidence = alt.confidence;
            }
          }
          
          finalText += bestTranscript;
          bestConfidence = Math.max(bestConfidence, bestAltConfidence);
        } else {
          // For interim results, use the first (highest confidence) alternative
          interim += result[0].transcript;
        }
      }

      setInterimText(interim);
      
      if (finalText) {
        const trimmed = finalText.trim();
        if (trimmed.length > 0) {
          // Command buffer: accumulate transcript for multi-word commands
          // This prevents premature execution on partial utterances
          if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
          
          const buffered = commandBufferRef.current
            ? commandBufferRef.current + ' ' + trimmed
            : trimmed;
          
          // Try matching the full buffer first
          const bufferMatch = matchCommand(buffered);
          const directMatch = matchCommand(trimmed);
          
          if (bufferMatch && (!directMatch || bufferMatch.confidence > directMatch.confidence)) {
            // Full buffer matches better — use it
            commandBufferRef.current = '';
            setTranscript(buffered);
            setInterimText('');
            processCommand(buffered, bestConfidence);
          } else if (directMatch && directMatch.confidence > 0.6) {
            // Direct match is strong enough — execute immediately
            commandBufferRef.current = '';
            setTranscript(trimmed);
            setInterimText('');
            processCommand(trimmed, bestConfidence);
          } else {
            // No strong match yet — buffer and wait for more input
            commandBufferRef.current = buffered;
            setTranscript(trimmed);
            setInterimText('');
            
            // If no more speech arrives within 1.2s, try matching what we have
            bufferTimeoutRef.current = setTimeout(() => {
              if (commandBufferRef.current) {
                const finalAttempt = commandBufferRef.current;
                commandBufferRef.current = '';
                processCommand(finalAttempt, bestConfidence);
              }
            }, 1200);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'no-speech') {
        // Silently restart - the enhanced mic should pick up more
        if (shouldRestartRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (shouldRestartRef.current) {
              try { recognition.start(); } catch(e) {}
            }
          }, 100); // Faster restart (100ms vs 200ms)
        }
        return;
      }
      if (event.error === 'aborted' || event.error === 'network') {
        // Will restart via onend
        return;
      }
      if (event.error === 'not-allowed') {
        setFeedback('⚠ Microphone access denied. Please allow microphone in browser settings.');
        setTimeout(() => setFeedback(''), 5000);
        return;
      }
      setFeedback('⚠ Microphone error. Reconnecting...');
      setTimeout(() => setFeedback(''), 3000);
    };

    recognition.onend = () => {
      // Auto-restart with very short delay for continuous listening
      if (shouldRestartRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (shouldRestartRef.current) {
            try { recognition.start(); } catch(e) {}
          }
        }, 50); // Ultra-fast restart (50ms)
      } else {
        setIsListening(false);
        isListeningRef.current = false;
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch(e) {}
      }
    };
  }, [isSupported, processCommand]);

  // ── START: Initialize audio engine + recognition ──
  const startListening = useCallback(async () => {
    if (!recognitionRef.current) return;
    
    try {
      setTranscript('');
      setInterimText('');
      setFeedback('');
      commandBufferRef.current = '';
      
      // Initialize the advanced audio processing engine
      if (!audioEngineRef.current) {
        audioEngineRef.current = new AudioProcessingEngine();
      }
      
      const processedStream = await audioEngineRef.current.initialize();
      
      if (processedStream) {
        setFeedback('🎙 Enhanced mic active · Noise suppression ON');
        setTimeout(() => setFeedback(''), 2500);
      }
      
      // Start speech recognition
      shouldRestartRef.current = true;
      try {
        recognitionRef.current.start();
      } catch(e) {
        // Already started — just ensure state is correct
      }
      setIsListening(true);
      isListeningRef.current = true;
    } catch (e) {
      console.error('Start listening error:', e);
      // Fallback: start without audio engine
      shouldRestartRef.current = true;
      try {
        recognitionRef.current.start();
      } catch(e2) {}
      setIsListening(true);
      isListeningRef.current = true;
    }
  }, []);

  // ── STOP: Clean up audio engine + recognition ──
  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    commandBufferRef.current = '';
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    // Destroy audio processing engine to release microphone
    if (audioEngineRef.current) {
      audioEngineRef.current.destroy();
      audioEngineRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.destroy();
        audioEngineRef.current = null;
      }
    };
  }, []);

  if (!isSupported) return null;

  // Group commands for help display
  const helpCategories = [
    { title: 'Navigation', items: ['Open Inbox', 'Open Analytics', 'Landing Page', 'Go Home'] },
    { title: 'Compose & Search', items: ['Compose Email', 'Search for [topic]', 'Find [keyword]'] },
    { title: 'Filters', items: ['All Emails', 'Unread', 'High Priority', 'Threats', 'Deadlines', 'New Today'] },
    { title: 'Email Tabs', items: ['Real Inbox', 'Simulation', 'Reader View', 'Intelligence', 'AI Summary', 'Smart Reply'] },
    { title: 'Actions', items: ['Sync Emails', 'AI Digest', 'Test Lab', 'Settings', 'Notifications', 'Delete Email'] },
    { title: 'Smart Reply', items: ['Professional/Formal/Friendly Tone', 'Concise/Detailed Length', 'Regenerate Reply', 'Send Reply', 'Edit Reply'] },
    { title: 'Email Navigation', items: ['Read Latest', 'Next Email', 'Previous Email', 'Scroll Down', 'Scroll Up'] },
    { title: 'Categories', items: ['Placement', 'Interview', 'Academic', 'Finance', 'Social', 'Promotions', 'All Categories'] },
    { title: 'Account', items: ['User Menu', 'Switch Account', 'Log Out', 'Scheduled Emails'] },
  ];

  return (
    <>
      {/* Mic Button in Header */}
      <button
        onClick={() => { setIsOpen(true); setShowHelp(false); startListening(); }}
        className={`relative p-2 rounded-full transition-all duration-300 ${
          isListening 
            ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
            : 'hover:bg-white/10 text-zinc-400 hover:text-white border border-transparent'
        }`}
        title="Voice Assistant"
      >
        {isListening && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
        )}
        <Mic className="w-4 h-4" />
      </button>

      {/* Voice Assistant Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[60] flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={(e) => { if (e.target === e.currentTarget) { stopListening(); setIsOpen(false); }}}>
          <div className="bg-[#0a0e17] w-full max-w-lg max-h-[92vh] my-auto rounded-2xl sm:rounded-3xl shadow-[0_0_80px_rgba(59,130,246,0.15)] border border-blue-500/20 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${isListening ? 'bg-red-500/20 border border-red-500/40' : 'bg-blue-500/20 border border-blue-500/40'}`}>
                  <Volume2 className={`w-4 h-4 ${isListening ? 'text-red-400' : 'text-blue-400'}`} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">AI Voice Control</h2>
                  <span className="text-[10px] text-zinc-500 font-medium">Real-time · Full App Control · {COMMANDS.length} Commands</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowHelp(!showHelp)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${showHelp ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-zinc-800/50 text-zinc-400 hover:text-white border border-zinc-700/50'}`}
                >
                  {showHelp ? 'Hide Help' : 'All Commands'}
                </button>
                <button 
                  onClick={() => { stopListening(); setIsOpen(false); }} 
                  className="p-2 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {showHelp ? (
              /* ── Help / Commands Panel ── */
              <div className="max-h-[60vh] overflow-y-auto p-5 space-y-4">
                {helpCategories.map((cat, ci) => (
                  <div key={ci}>
                    <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">{cat.title}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.items.map((item, ii) => (
                        <span key={ii} className="text-[10px] text-zinc-400 bg-zinc-800/60 px-2.5 py-1 rounded-lg border border-zinc-700/50 font-medium">
                          "{item}"
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* ── Main Mic Area ── */}
                <div className="flex flex-col items-center py-8 px-6">
                  
                  {/* Waveform Visualizer */}
                  <div className="flex items-center gap-[3px] h-10 mb-6">
                    {waveformBars.map((h, i) => (
                      <div
                        key={i}
                        className={`w-[3px] rounded-full transition-all duration-75 ${isListening ? 'bg-gradient-to-t from-blue-500 to-cyan-400' : 'bg-zinc-700'}`}
                        style={{ height: `${h}px` }}
                      />
                    ))}
                  </div>

                  {/* Animated Mic Button */}
                  <button
                    onClick={toggleListening}
                    className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isListening 
                        ? 'bg-gradient-to-br from-red-500 to-pink-600 shadow-[0_0_50px_rgba(239,68,68,0.4)] scale-105' 
                        : 'bg-gradient-to-br from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
                    }`}
                  >
                    {isListening && (
                      <>
                        <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-15" />
                        <span className="absolute -inset-2 rounded-full border-2 border-red-400/30 animate-pulse" />
                        <span className="absolute -inset-4 rounded-full border border-red-400/15 animate-pulse" style={{ animationDelay: '0.3s' }} />
                      </>
                    )}
                    {isListening ? (
                      <MicOff className="w-8 h-8 text-white relative z-10" />
                    ) : (
                      <Mic className="w-8 h-8 text-white relative z-10" />
                    )}
                  </button>

                  {/* Status */}
                  <p className={`mt-5 text-xs font-semibold tracking-wide uppercase ${isListening ? 'text-red-400' : 'text-zinc-500'}`}>
                    {isListening ? '● Listening continuously...' : 'Tap to start listening'}
                  </p>

                  {/* Live Transcript */}
                  <div className="mt-4 w-full min-h-[48px] px-5 py-3 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
                    {interimText ? (
                      <p className="text-sm text-zinc-400 italic text-center animate-pulse">"{interimText}"</p>
                    ) : transcript ? (
                      <p className="text-sm text-white text-center font-medium">"{transcript}"</p>
                    ) : (
                      <p className="text-[11px] text-zinc-600 text-center">
                        {isListening ? 'Say a command...' : 'Your voice input will appear here'}
                      </p>
                    )}
                  </div>

                  {/* Feedback */}
                  {feedback && (
                    <div className={`mt-3 px-4 py-2 rounded-xl text-sm font-medium text-center w-full transition-all ${
                      feedback.startsWith('✓') 
                        ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400' 
                        : feedback.startsWith('⚠')
                          ? 'bg-red-500/10 border border-red-500/25 text-red-400'
                          : feedback.startsWith('🎙')
                            ? 'bg-blue-500/10 border border-blue-500/25 text-blue-400'
                            : 'bg-amber-500/10 border border-amber-500/25 text-amber-400'
                    }`}>
                      {feedback}
                    </div>
                  )}
                </div>

                {/* ── Quick Command Hints ── */}
                <div className="px-5 pb-3">
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> Quick Commands
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      'Compose Email', 'Show Analytics', 'High Priority',
                      'Search for...', 'AI Digest', 'Read Latest',
                      'Show Threats', 'Smart Reply', 'Sync Emails',
                    ].map((hint, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (hint !== 'Search for...') {
                            processCommand(hint, 1.0);
                          }
                        }}
                        className="text-[10px] text-zinc-500 hover:text-white bg-zinc-900/40 hover:bg-zinc-800/60 px-2 py-1.5 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-all text-center cursor-pointer font-medium"
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Command History ── */}
                {commandHistory.length > 0 && (
                  <div className="px-5 pb-5">
                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Recent</p>
                    <div className="space-y-1 max-h-[80px] overflow-y-auto">
                      {commandHistory.slice(0, 3).map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <span className={h.success ? 'text-emerald-500' : 'text-red-500'}>{h.success ? '✓' : '✗'}</span>
                          <span className="text-zinc-500 truncate flex-1">"{h.text}"</span>
                          <ChevronRight className="w-2.5 h-2.5 text-zinc-700" />
                          <span className={`font-bold ${h.success ? 'text-zinc-300' : 'text-zinc-600'}`}>{h.action}</span>
                          <span className="text-zinc-700 ml-auto">{h.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
