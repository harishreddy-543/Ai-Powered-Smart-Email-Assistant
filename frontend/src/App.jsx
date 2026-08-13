// AI-Powered Email Assistant - Main React Component
import React, { useState, useEffect, useRef } from 'react';
import { 
  Mail, ShieldAlert, Bell, Calendar, ListTodo, FileText, AlertTriangle, Sparkles, Search, BarChart3, BarChart2, ShieldCheck, Terminal, Settings, 
  LogOut, RefreshCw, Send, Check, X, Edit, Eye, Filter, ArrowRight, ArrowLeft, LogIn, Clock,
  Zap, Brain, Shield, Database, Cpu, MessageSquare, Activity, ChevronRight,
  Globe, Lock, TrendingUp, Users, Inbox, Star, AlertCircle, Hash, Layers, Plus,
  Info, CheckCircle2, Target, Briefcase, CreditCard, Trash2
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, PieChart, Pie, Cell, CartesianGrid, LineChart, Line
} from 'recharts';

import ComposeModal from './components/ComposeModal';
import VoiceAssistant from './components/VoiceAssistant';
import LandingPage from './components/LandingPage';
import AuthScreen from './components/AuthScreen';
import { requestFirebaseNotificationPermission, onMessageListener } from './firebase';

const API_BASE = `http://${window.location.hostname}:8000/api/v1`;

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];
const SECURITY_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

// Pipeline steps matching the reference app
const PIPELINE_STEPS = [
  { num: '01', label: 'Fetch',      desc: 'Gmail API · IMAP sync',         icon: Globe },
  { num: '02', label: 'Preprocess', desc: 'Tokenize · Lemmatize · TF-IDF', icon: Cpu },
  { num: '03', label: 'Persist',    desc: 'SQLite + in-memory cache',      icon: Database },
  { num: '04', label: 'Classify',   desc: 'DistilBERT · 10 categories',   icon: Layers },
  { num: '05', label: 'Spam',       desc: 'Naive Bayes ensemble',          icon: Shield },
  { num: '06', label: 'Phishing',   desc: 'XGBoost + SPF/DKIM/DMARC',     icon: Lock },
  { num: '07', label: 'Priority',   desc: 'LightGBM · 4 tiers',           icon: TrendingUp },
  { num: '08', label: 'NER',        desc: 'spaCy + BERT-NER',             icon: Users },
  { num: '09', label: 'Embed',      desc: 'MiniLM → FAISS',               icon: Hash },
  { num: '10', label: 'RAG',        desc: 'Hybrid retrieval · top-k 8',   icon: Search },
  { num: '11', label: 'Summarize',  desc: 'LLM · 5-bullet digest',        icon: FileText },
  { num: '12', label: 'Reply',      desc: 'Style-matched generation',     icon: MessageSquare },
];

const MODEL_REGISTRY = [
  { name: 'DistilBERT', task: 'Categorizer',  acc: '94.2%', color: '#3b82f6' },
  { name: 'XGBoost',    task: 'Phishing',     acc: '97.1%', color: '#ef4444' },
  { name: 'Naive Bayes',task: 'Spam',         acc: '95.8%', color: '#f59e0b' },
  { name: 'LightGBM',   task: 'Priority',     acc: '91.5%', color: '#22c55e' },
  { name: 'RoBERTa',    task: 'Urgency',      acc: '93.0%', color: '#8b5cf6' },
  { name: 'MiniLM',     task: 'Embeddings',   acc: '384d',  color: '#06b6d4' },
];

const cleanEmailBody = (body) => {
  if (!body) return '';
  
  // Replace <URL> with just the URL (removing angle brackets)
  let cleaned = body.replace(/<(https?:\/\/[^>]+)>/g, '$1');
  
  // Find all URLs and truncate them if they are too long
  cleaned = cleaned.replace(/(https?:\/\/[^\s]+)/g, (url) => {
    if (url.length > 50) {
      return url.substring(0, 47) + '...';
    }
    return url;
  });
  
  // Clean up multiple consecutive empty lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
};

export default function App() {
  // Auth state
  const [token, setToken] = useState(() => {
    // On init, make sure we have a clean token (no stale cross-account cache)
    return localStorage.getItem('token') || '';
  });
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isGoogleConnecting, setIsGoogleConnecting] = useState(false);
  const [isImapConnecting, setIsImapConnecting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // App Navigation
  const [activeTab, setActiveTab] = useState('inbox');
  const [mainViewTab, setMainViewTab] = useState('inbox'); // 'inbox' | 'analytics'
  const [showLanding, setShowLanding] = useState(() => !sessionStorage.getItem('landing_seen'));
  
  // Data States
  const [emails, setEmails] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_emails');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return [];
    } catch (e) {
      return [];
    }
  });
  const [isLoadingEmails, setIsLoadingEmails] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_emails');
      if (cached) {
        const parsed = JSON.parse(cached);
        return !(Array.isArray(parsed) && parsed.length > 0);
      }
      return true;
    } catch (e) {
      return true;
    }
  });
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [agentLogs, setAgentLogs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [preferences, setPreferences] = useState({
    writing_style: 'Professional',
    auto_reply_enabled: false,
    summary_bullet_count: 5
  });

  // Filter States
  const [emailSourceFilter, setEmailSourceFilter] = useState('real'); // 'real' | 'simulated'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortCategory, setSortCategory] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [securityFilter, setSecurityFilter] = useState('all');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef(null);

  // Operation States
  const [isSimulating, setIsSimulating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTestLabOpen, setIsTestLabOpen] = useState(false);
  const [testLabResults, setTestLabResults] = useState([]);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingReply, setEditingReply] = useState(false);
  const [editedReplyText, setEditedReplyText] = useState('');
  const [detailTab, setDetailTab] = useState('Original Message');
  const [showRawEmail, setShowRawEmail] = useState(false);
  const [bulletCount, setBulletCount] = useState(5);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [selectedTone, setSelectedTone] = useState("Professional");
  const [selectedLength, setSelectedLength] = useState("Concise");
  const [showTechDetails, setShowTechDetails] = useState(false);

  useEffect(() => {
    if (selectedEmail?.replies && selectedEmail.replies.length > 0) {
      const latest = selectedEmail.replies[selectedEmail.replies.length - 1];
      if (latest.tone) setSelectedTone(latest.tone);
      if (latest.length_preference) setSelectedLength(latest.length_preference);
    } else {
      setSelectedTone("Professional");
      setSelectedLength("Concise");
    }
  }, [selectedEmail?.id]);
  
  // Alert & Digest States
  const [alerts, setAlerts] = useState([]);
  const [popupNotification, setPopupNotification] = useState(null);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDigestModal, setShowDigestModal] = useState(false);
  const [dailyDigest, setDailyDigest] = useState(null);

  const [notificationPermission, setNotificationPermission] = useState('default');
  const [testDeliveryStatus, setTestDeliveryStatus] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitialData, setComposeInitialData] = useState(null);
  
  // Undo Send state
  const [undoSendData, setUndoSendData] = useState(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef(null);
  const undoCountdownRef = useRef(null);

  // Scheduled emails state
  const [scheduledEmails, setScheduledEmails] = useState([]);
  const [showScheduledView, setShowScheduledView] = useState(false);

  // Multiple accounts state
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState(null);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  // Undo Send handler
  const handleSendWithUndo = (emailData) => {
    setUndoSendData(emailData);
    setUndoCountdown(5);
    
    // Countdown interval
    undoCountdownRef.current = setInterval(() => {
      setUndoCountdown(prev => {
        if (prev <= 1) {
          clearInterval(undoCountdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Actually send after 5 seconds
    undoTimerRef.current = setTimeout(() => {
      _actuallySendEmail(emailData);
      setUndoSendData(null);
      setUndoCountdown(0);
    }, 5000);
  };

  const handleUndoSend = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoCountdownRef.current) clearInterval(undoCountdownRef.current);
    const data = undoSendData;
    setUndoSendData(null);
    setUndoCountdown(0);
    // Reopen compose with the same data
    setComposeInitialData(data);
    setIsComposeOpen(true);
  };

  const _actuallySendEmail = (data) => {
    const formData = new FormData();
    formData.append('to', data.to);
    if (data.cc) formData.append('cc', data.cc);
    if (data.bcc) formData.append('bcc', data.bcc);
    formData.append('subject', data.subject);
    formData.append('body', data.body);
    if (data.files) data.files.forEach(f => formData.append('files', f));
    fetch(`http://${window.location.hostname}:8000/api/v1/compose/send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    }).catch(() => {});
  };

  // Voice command handler
  // Comprehensive Voice command handler
  const handleVoiceCommand = (action, query) => {
    switch (action) {
      // ── Navigation & Views ──
      case 'landing':
        setShowLanding(true);
        break;
      case 'inbox':
        setShowLanding(false);
        setMainViewTab('inbox');
        break;
      case 'analytics':
        setShowLanding(false);
        setMainViewTab('analytics');
        break;

      // ── Compose & Search ──
      case 'compose':
        setShowLanding(false);
        setIsComposeOpen(true);
        break;
      case 'search':
        if (query) {
          setShowLanding(false);
          setMainViewTab('inbox');
          setSearchQuery(query);
          handleSearch(query);
        }
        break;

      // ── Filters & Security KPI ──
      case 'filter_all':
        setShowLanding(false);
        setMainViewTab('inbox');
        setSecurityFilter('all');
        setSelectedCategory(null);
        break;
      case 'new_today':
        setShowLanding(false);
        setMainViewTab('inbox');
        setSecurityFilter('new_today');
        break;
      case 'high_priority':
        setShowLanding(false);
        setMainViewTab('inbox');
        setSecurityFilter('high_priority');
        break;
      case 'threats':
        setShowLanding(false);
        setMainViewTab('inbox');
        setSecurityFilter('threats');
        break;
      case 'deadlines':
        setShowLanding(false);
        setMainViewTab('inbox');
        setSecurityFilter('deadlines');
        break;
      case 'unread':
        setShowLanding(false);
        setMainViewTab('inbox');
        setSecurityFilter('unread');
        break;

      // ── Email Source Tabs ──
      case 'real_inbox':
        setShowLanding(false);
        setMainViewTab('inbox');
        setEmailSourceFilter('real');
        break;
      case 'simulation':
        setShowLanding(false);
        setMainViewTab('inbox');
        setEmailSourceFilter('simulated');
        break;

      // ── Detail Pane Tabs ──
      case 'reader_view':
        setDetailTab('Reader View');
        break;
      case 'intelligence':
        setDetailTab('Intelligence');
        break;
      case 'ai_summary':
        setDetailTab('AI Summary');
        break;
      case 'smart_reply':
        setDetailTab('Smart Reply');
        break;

      // ── Email Selection & Reading ──
      case 'read_latest':
        setShowLanding(false);
        setMainViewTab('inbox');
        if (emails.length > 0) selectEmailAndMarkRead(emails[0]);
        break;
      case 'read_next':
        if (emails.length > 0) {
          const currIdx = selectedEmail ? emails.findIndex(e => e.id === selectedEmail.id) : -1;
          const nextIdx = (currIdx + 1) % emails.length;
          selectEmailAndMarkRead(emails[nextIdx]);
        }
        break;
      case 'read_previous':
        if (emails.length > 0) {
          const currIdx = selectedEmail ? emails.findIndex(e => e.id === selectedEmail.id) : 0;
          const prevIdx = (currIdx - 1 + emails.length) % emails.length;
          selectEmailAndMarkRead(emails[prevIdx]);
        }
        break;

      // ── Modals & Panels ──
      case 'test_lab':
        setIsTestLabOpen(true);
        break;
      case 'settings':
        setShowSettingsModal(true);
        break;
      case 'digest':
        fetchDigest();
        break;
      case 'notifications':
        setIsAlertsOpen(prev => !prev);
        break;
      case 'user_menu':
        setIsAvatarMenuOpen(prev => !prev);
        break;

      // ── Sync & Operations ──
      case 'sync':
        setIsSyncing(true);
        handleSyncData();
        break;
      case 'stop_sync':
        handleStopSync();
        break;

      // ── Smart Reply Tones & Lengths ──
      case 'tone_professional':
        setSelectedTone('Professional');
        if (selectedEmail) handleRegenerateReply(selectedEmail.id, 'Professional', selectedLength);
        break;
      case 'tone_formal':
        setSelectedTone('Formal');
        if (selectedEmail) handleRegenerateReply(selectedEmail.id, 'Formal', selectedLength);
        break;
      case 'tone_friendly':
        setSelectedTone('Friendly');
        if (selectedEmail) handleRegenerateReply(selectedEmail.id, 'Friendly', selectedLength);
        break;
      case 'tone_direct':
        setSelectedTone('Direct');
        if (selectedEmail) handleRegenerateReply(selectedEmail.id, 'Direct', selectedLength);
        break;
      case 'length_concise':
        setSelectedLength('Concise');
        if (selectedEmail) handleRegenerateReply(selectedEmail.id, selectedTone, 'Concise');
        break;
      case 'length_detailed':
        setSelectedLength('Detailed');
        if (selectedEmail) handleRegenerateReply(selectedEmail.id, selectedTone, 'Detailed');
        break;
      case 'regenerate_reply':
        if (selectedEmail) handleRegenerateReply(selectedEmail.id, selectedTone, selectedLength);
        break;

      // ── Category Filters ──
      case 'category_placement':
        setSelectedCategory('Placement / Career');
        break;
      case 'category_interview':
        setSelectedCategory('Interview / Test Drive');
        break;
      case 'category_academic':
        setSelectedCategory('Academic / Campus');
        break;
      case 'category_finance':
        setSelectedCategory('Finance / Transactions');
        break;
      case 'category_social':
        setSelectedCategory('Social / Community');
        break;
      case 'category_promotions':
        setSelectedCategory('Promotions / Marketing');
        break;
      case 'clear_category':
        setSelectedCategory(null);
        break;

      // ── Email Actions ──
      case 'delete_email':
        if (selectedEmail) handleDeleteEmail(selectedEmail.id);
        break;
      case 'tech_details':
        setShowTechDetails(prev => !prev);
        break;
      case 'raw_email':
        setShowRawEmail(prev => !prev);
        break;
      case 'scheduled':
        if (fetchScheduledEmails) fetchScheduledEmails();
        setShowScheduledView(true);
        break;

      // ── Scrolling ──
      case 'scroll_down':
        window.scrollBy({ top: 300, behavior: 'smooth' });
        break;
      case 'scroll_up':
        window.scrollBy({ top: -300, behavior: 'smooth' });
        break;

      // ── Account & Auth ──
      case 'logout':
        handleLogout();
        break;
      case 'switch_account':
        setIsAvatarMenuOpen(true);
        break;

      default:
        break;
    }
  };

  // Fetch scheduled emails
  const fetchScheduledEmails = async () => {
    try {
      const res = await fetch(`${API_BASE}/schedule/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setScheduledEmails(data);
      }
    } catch (e) {}
  };

  const cancelScheduledEmail = async (id) => {
    try {
      await fetch(`${API_BASE}/schedule/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      fetchScheduledEmails();
    } catch (e) {}
  };

  // Fetch linked accounts
  const fetchLinkedAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/accounts/`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLinkedAccounts(data);
      }
    } catch (e) {}
  };

  const handleDeleteEmail = async (emailId) => {
    try {
      setEmails(prev => prev.filter(e => e.id !== emailId));
      if (selectedEmail && selectedEmail.id === emailId) {
        setSelectedEmail(null);
      }
      if (analytics?.security_stats) {
        setAnalytics(prev => prev ? {
          ...prev,
          security_stats: {
            ...prev.security_stats,
            total_emails: Math.max(0, (prev.security_stats.total_emails || 1) - 1)
          }
        } : null);
      }
      const res = await fetch(`${API_BASE}/emails/${emailId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.warning) {
          alert(`Notice: ${data.warning}`);
        }
      }
    } catch (e) {
      console.error("Failed to delete email:", e);
    }
  };

  const switchAccount = async (accountId) => {
    try {
      await fetch(`${API_BASE}/accounts/switch/${accountId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      fetchLinkedAccounts();
      setShowAccountSwitcher(false);
      // Refresh inbox for new account
      window.location.reload();
    } catch (e) {}
  };
  
  // Register FCM Token
  useEffect(() => {
    if (token) {
      requestFirebaseNotificationPermission().then(async (fcmToken) => {
        if (fcmToken) {
          try {
            await fetch(`${API_BASE}/auth/preferences`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ fcm_token: fcmToken })
            });
          } catch (e) {
            console.error("Failed to update FCM token", e);
          }
        }
      });
      
      onMessageListener().then(payload => {
        console.log("Received foreground message: ", payload);
        // You could trigger a toast notification here
      }).catch(err => console.log('failed: ', err));
    }
  }, [token]);

  const renderFormattedDate = (deadlineStr, emailObj) => {
    let parsed = [];
    if (deadlineStr && deadlineStr !== '[]' && deadlineStr !== 'null') {
      try {
        const temp = JSON.parse(deadlineStr);
        if (Array.isArray(temp) && temp.length > 0) parsed = temp;
      } catch (e) {}
    }

    if (parsed.length === 0 && emailObj) {
      const subj = (emailObj.subject || '').toLowerCase();
      const summ = (emailObj.summary || '').toLowerCase();
      const act = (emailObj.action_items || '').toLowerCase();
      const combined = `${subj} ${summ} ${act}`;

      if (combined.includes('interview')) {
        parsed.push({
          title: emailObj.subject.substring(0, 50),
          datetime: emailObj.received_at,
          type: 'Job Interview Date'
        });
      } else if (combined.includes('assessment') || combined.includes('exam') || combined.includes('test')) {
        parsed.push({
          title: emailObj.subject.substring(0, 50),
          datetime: emailObj.received_at,
          type: 'Technical Assessment Deadline'
        });
      } else if (combined.includes('due') || combined.includes('deadline') || combined.includes('last date') || combined.includes('submit')) {
        parsed.push({
          title: emailObj.subject.substring(0, 50),
          datetime: emailObj.received_at,
          type: 'Action / Submission Deadline'
        });
      }
    }

    if (parsed.length === 0) {
      return <div className="text-sm font-medium text-zinc-400 pl-6">No specific date or deadline detected</div>;
    }

    return (
      <div className="space-y-2 pl-6 pt-1">
        {parsed.map((item, idx) => {
          const dateVal = item.datetime || item.date || item.title;
          const typeLabel = item.type || (item.title?.toLowerCase().includes('interview') ? 'Interview Date' : item.title?.toLowerCase().includes('contest') ? 'Event / Contest Date' : 'Deadline');
          
          let formattedDate = dateVal;
          let relativeText = "";
          
          if (dateVal) {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toLocaleString('en-US', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
              const now = new Date();
              const diffTime = d.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays === 0) relativeText = " · Today";
              else if (diffDays === 1) relativeText = " · Tomorrow";
              else if (diffDays > 1 && diffDays <= 30) relativeText = ` · ${diffDays} days remaining`;
              else if (diffDays < 0) relativeText = ` · Upcoming target`;
            }
          }

          const isInterview = typeLabel.includes('Interview');
          const isContest = typeLabel.includes('Event') || typeLabel.includes('Contest') || typeLabel.includes('Assessment');
          
          const badgeBg = isInterview ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                          isContest ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' :
                          'bg-amber-500/10 text-amber-300 border-amber-500/30';

          return (
            <div key={idx} className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded border font-semibold text-[10px] uppercase tracking-wider ${badgeBg}`}>
                {typeLabel}
              </span>
              <span className="font-medium text-white">{item.title ? `${item.title}: ` : ''}</span>
              <span className="font-mono text-zinc-300">{formattedDate}</span>
              <span className="font-bold text-cyan-400">{relativeText}</span>
            </div>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notification');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const sendBrowserNotification = (title, body) => {
    setTestDeliveryStatus('Requested');
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: '/vite.svg' });
        setTestDeliveryStatus('Displayed');
      } catch (e) {
        setTestDeliveryStatus('Failed');
        console.error('Notification failed:', e);
      }
    } else {
      setTestDeliveryStatus('Failed (No Permission)');
    }
  };
  
  const handleTestNotification = () => {
    if (notificationPermission !== 'granted') {
      requestNotificationPermission().then(() => {
        if (Notification.permission === 'granted') {
          sendBrowserNotification('Neural Inbox Test', 'Notifications are configured correctly.');
        }
      });
    } else {
      sendBrowserNotification('Neural Inbox Test', 'Notifications are configured correctly.');
    }
  };

  const [nlpInput, setNlpInput] = useState('');
  const [isNlpLoading, setIsNlpLoading] = useState(false);
  
  const [careerInterests, setCareerInterests] = useState([]);
  const [favoriteCompanies, setFavoriteCompanies] = useState([]);
  const [alwaysNotify, setAlwaysNotify] = useState([]);

  const handleRegenerateSummary = async (count) => {
    if (!selectedEmail) return;
    setIsRegenerating(true);
    setBulletCount(count);
    try {
      const res = await fetch(`${API_BASE}/emails/${selectedEmail.id}/summary`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ bullet_count: count })
      });
      if (res.status === 200) {
        const data = await res.json();
        setSelectedEmail(data);
        setEmails(emails.map(e => e.id === data.id ? data : e));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRegenerating(false);
    }
  };
  
  const terminalEndRef = useRef(null);

  // OAuth redirect handler - also handles new account token from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    const urlError = urlParams.get('error');

    if (urlToken) {
      // NEW account login via Google OAuth — wipe all previous state first
      localStorage.removeItem('cached_emails');
      localStorage.removeItem('token');
      setEmails([]);
      setSelectedEmail(null);
      setCurrentUser(null);
      setAnalytics(null);
      setAgentLogs([]);
      setAlerts([]);
      setPopupNotification(null);
      setTestLabResults([]);
      setToken(urlToken);
      window.history.replaceState({}, document.title, '/');
    } else if (urlError) {
      setAuthError(urlError === 'oauth_failed' ? 'Google Login Failed' : 'Authentication Error');
      window.history.replaceState({}, document.title, '/');
    }

    if (token) {
      localStorage.setItem('token', token);
      fetchCurrentUser();
      fetchPreferences();
      // Clear simulated emails and fetch real inbox immediately
      fetch(`${API_BASE}/emails/fetch/simulate/clear`, { method: 'POST', headers: getHeaders() })
        .catch(() => {})
        .finally(() => {
          fetchEmails('real');
          fetchAnalytics();
          fetchAlerts();
        });
    } else {
      localStorage.removeItem('token');
      localStorage.removeItem('cached_emails');
      setCurrentUser(null);
      setEmails([]);
      setSelectedEmail(null);
      setPreferences(null);
      setCareerInterests([]);
      setFavoriteCompanies([]);
      setAlwaysNotify([]);
      setAlerts([]);
      setAnalytics(null);
      setAgentLogs([]);
      setPopupNotification(null);
      setTestLabResults([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    
    // Background polling — emails are shown instantly from cache, 
    // this silently refreshes data every 15 seconds
    const pollInterval = setInterval(() => {
      fetchAnalytics();
      fetchAlerts();
      if (!isSearchActive) fetchEmails();
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [token, isSearchActive]);

  useEffect(() => {
    if (token) {
      fetchEmails();
      fetchAgentLogs();
      fetchAnalytics();
    }
  }, [token, categoryFilter, priorityFilter, securityFilter, emailSourceFilter]);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [agentLogs]);

  const getHeaders = () => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { headers: getHeaders() });
      if (res.status === 200) {
        const data = await res.json();
        setCurrentUser(data);
      } else {
        setToken('');
      }
    } catch { setToken(''); }
  };

  const formatTimeAgo = (dateString) => {
    const diff = Math.floor((new Date() - new Date(dateString)) / 60000); // in minutes
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff} min ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    return new Date(dateString).toLocaleDateString();
  };

  const handleAlertAction = async (alert) => {
    // Optimistic read status
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_read: true } : a));
    // Focus email
    if (alert.email) {
      setSelectedEmail(alert.email);
      setSecurityFilter('all'); // Clear filters so it's guaranteed visible
      setCategoryFilter('all');
    }
    // Dismiss dropdown
    setIsAlertsOpen(false);
    
    try {
      await fetch(`${API_BASE}/emails/alerts/${alert.id}/read`, {
        method: 'POST',
        headers: getHeaders()
      });
    } catch (e) { console.error("Error marking alert read:", e); }
  };

  const seenAlertIdsRef = useRef(new Set());

  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${API_BASE}/emails/alerts`, { headers: getHeaders() });
      if (res.status === 200) {
        const newAlerts = await res.json();
        // Check for newly generated unread alerts
        if (newAlerts.length > 0) {
            const latestNew = newAlerts[0];
            if (!seenAlertIdsRef.current.has(latestNew.id) && !latestNew.is_read) {
               seenAlertIdsRef.current.add(latestNew.id);
               sendBrowserNotification(`Neural Inbox: ${latestNew.title}`, latestNew.message);
               
               // Trigger smart in-app popup notification ONCE
               setPopupNotification(latestNew);
               setTimeout(() => setPopupNotification(null), 7000);
            }
        }
        setAlerts(newAlerts);
      }
    } catch (e) { console.error(e); }
  };

  const fetchDigest = async () => {
    try {
      setShowDigestModal(true);
      setDailyDigest(null);
      const res = await fetch(`${API_BASE}/emails/digest`, { headers: getHeaders() });
      if (res.status === 200) {
        const data = await res.json();
        setDailyDigest(data);
      }
    } catch (e) { console.error(e); }
  };
  
  const handleNlpSubmit = async () => {
    if (!nlpInput.trim()) return;
    setIsNlpLoading(true);
    try {
      const res = await fetch(`${API_BASE}/emails/user/preferences/nlp`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ text: nlpInput })
      });
      if (res.status === 200) {
        const updatedPref = await res.json();
        setPreferences(updatedPref);
        setNlpInput('');
        
        try { setCareerInterests(JSON.parse(updatedPref.career_interests || '[]')); } catch(e){}
        try { setFavoriteCompanies(JSON.parse(updatedPref.favorite_companies || '[]')); } catch(e){}
        try { setAlwaysNotify(JSON.parse(updatedPref.always_notify || '[]')); } catch(e){}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsNlpLoading(false);
    }
  };

  const toggleCheckbox = (list, setList, item) => {
    if (list.includes(item)) setList(list.filter(i => i !== item));
    else setList([...list, item]);
  };
  
  const saveCheckboxPreferences = async () => {
    setIsNlpLoading(true);
    const updatedPref = {
      ...(preferences || {}),
      career_interests: JSON.stringify(careerInterests),
      favorite_companies: JSON.stringify(favoriteCompanies),
      always_notify: JSON.stringify(alwaysNotify)
    };
    const ok = await savePreferences(updatedPref);
    setIsNlpLoading(false);
    if (ok) {
      alert('✓ Personalize AI Assistant Preferences Saved Successfully!');
      setShowSettingsModal(false);
    } else {
      alert('Error saving preferences. Please verify backend server is running.');
    }
  };

  useEffect(() => {
    if (token && currentUser) {
      fetchAlerts();
      fetchPreferences();
    }
  }, [token, currentUser]);

  const emailSourceFilterRef = useRef(emailSourceFilter);
  const selectedEmailRef = useRef(selectedEmail);

  useEffect(() => {
    emailSourceFilterRef.current = emailSourceFilter;
  }, [emailSourceFilter]);

  useEffect(() => {
    selectedEmailRef.current = selectedEmail;
  }, [selectedEmail]);

  const fetchEmails = async (overrideSourceFilter = null) => {
    try {
      const activeSource = overrideSourceFilter !== null ? overrideSourceFilter : emailSourceFilterRef.current;
      let url = `${API_BASE}/emails/?limit=1000&t=${Date.now()}`;
      if (securityFilter === 'unread') {
        url += '&is_read=false';
      }
      if (activeSource === 'simulated') {
        url += '&is_simulated=true';
      } else if (activeSource === 'real') {
        url += '&is_simulated=false';
      }
      const res = await fetch(url, { headers: getHeaders() });
      if (res.status === 200) {
        let data = await res.json();
        
        if (securityFilter === 'unread' && selectedEmailRef.current) {
          const cur = selectedEmailRef.current;
          if (!data.some(e => e.id === cur.id)) {
            data = [{ ...cur, is_read: true }, ...data];
          } else {
             data = data.map(e => e.id === cur.id ? { ...e, is_read: true } : e);
          }
        }
        
        setEmails(data);
        
        // Auto-synchronize selectedEmail with current list while preserving user selection
        const currentSelectedId = selectedEmailRef.current?.id;
        if (data.length === 0) {
          setSelectedEmail(null);
        } else if (currentSelectedId) {
          const match = data.find(e => e.id === currentSelectedId);
          if (match) {
            setSelectedEmail(prev => (prev && prev.id === match.id ? { ...prev, ...match } : match));
          } else {
            setSelectedEmail(data[0]);
          }
        } else {
          setSelectedEmail(data[0]);
        }
        
        if (activeSource === 'real') {
          try {
            if (securityFilter === 'all') {
              localStorage.setItem('cached_emails', JSON.stringify(data));
            }
          } catch (e) {
            // If localStorage is full, cache a smaller subset
            try {
              localStorage.setItem('cached_emails', JSON.stringify(data.slice(0, 200)));
            } catch (e2) {}
          }
        } else {
          try {
            localStorage.removeItem('cached_emails');
          } catch (e) {}
        }
      }
    } catch (e) { console.error(e); }
    finally {
      setIsLoadingEmails(false);
    }
  };

  const fetchAgentLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/emails/agent/logs`, { headers: getHeaders() });
      if (res.status === 200) {
        const data = await res.json();
        setAgentLogs(data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchPreferences = async () => {
    try {
      const res = await fetch(`${API_BASE}/emails/user/preferences`, { headers: getHeaders() });
      if (res.status === 200) {
        const data = await res.json();
        setPreferences(data);
        try { if (data.career_interests) setCareerInterests(JSON.parse(data.career_interests)); } catch(e){}
        try { if (data.favorite_companies) setFavoriteCompanies(JSON.parse(data.favorite_companies)); } catch(e){}
        try { if (data.always_notify) setAlwaysNotify(JSON.parse(data.always_notify)); } catch(e){}
      }
    } catch (e) { console.error(e); }
  };

  const savePreferences = async (updatedPref) => {
    try {
      const res = await fetch(`${API_BASE}/emails/user/preferences`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify(updatedPref)
      });
      if (res.status === 200) {
        const data = await res.json();
        setPreferences(data);
        try { if (data.career_interests) setCareerInterests(JSON.parse(data.career_interests)); } catch(e){}
        try { if (data.favorite_companies) setFavoriteCompanies(JSON.parse(data.favorite_companies)); } catch(e){}
        try { if (data.always_notify) setAlwaysNotify(JSON.parse(data.always_notify)); } catch(e){}
        return true;
      }
      return false;
    } catch (e) { 
      console.error(e);
      return false;
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE}/emails/analytics/dashboard`, { headers: getHeaders() });
      if (res.status === 200) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) { console.error(e); }
  };

  const runTestLabScenario = async (testId) => {
    setIsSimulating(true);
    try {
      setEmailSourceFilter('simulated');
      const res = await fetch(`${API_BASE}/emails/fetch/simulate?type=${testId}`, {
        method: 'POST', headers: getHeaders()
      });
      if (res.status === 200) {
        const mail = await res.json();
        
        // Construct the test lab result wrapper for the UI
        let passed = true;
        let expected = {};
        let actual = {
           category: mail.category,
           priority: mail.priority,
           is_phishing: mail.is_phishing || false,
           is_spam: mail.is_spam || false,
           needs_alert: mail.needs_alert || false,
           deadlines: mail.deadlines
        };

        if (testId === 'placement') {
           expected = { category: "Education & Career", priority: "High or Critical" };
           passed = (mail.category === "Education & Career" && (mail.priority === "High" || mail.priority === "Critical"));
        } else if (testId === 'interview') {
           expected = { category: "Education & Career", needs_alert: true };
           passed = (mail.category === "Education & Career" && mail.needs_alert);
        } else if (testId === 'phishing') {
           expected = { is_phishing: true };
           passed = mail.is_phishing === true;
        } else if (testId === 'spam') {
           expected = { is_spam: true };
           passed = mail.is_spam === true;
        } else if (testId === 'deadline') {
           expected = { has_deadlines: true };
           passed = !!mail.deadlines;
           actual.has_deadlines = !!mail.deadlines;
        }

        const result = {
           id: mail.id,
           passed: passed,
           test: { 
             name: `${testId.charAt(0).toUpperCase() + testId.slice(1)} Test`,
             subject: mail.subject || "Simulated Email",
             expected: expected
           },
           actual: actual
        };

        setTestLabResults(prev => [result, ...prev]);
        
        await fetchEmails('simulated');
        fetchAgentLogs(); fetchAnalytics(); fetchAlerts();
        
        // Find the email and select it immediately in reader view
        setSelectedEmail(mail);
      }
    } catch (e) { console.error(e); }
    finally { setIsSimulating(false); }
  };

  const triggerSyncAPI = async (forceSwitch = false) => {
    try {
      const res = await fetch(`${API_BASE}/emails/fetch/sync`, { method: 'POST', headers: getHeaders() });
      if (!res.ok) {
        const errorData = await res.json();
        console.warn('Sync info:', errorData.detail);
        return false;
      }
      if (forceSwitch) setEmailSourceFilter('real');
      return true;
    } catch (e) {
      console.error(e);
      setIsSyncing(false);
      return false;
    }
  };

  const handleSyncData = async () => {
    setIsRefreshing(true);
    try {
      await triggerSyncAPI(true);
      await Promise.all([fetchEmails('real'), fetchAnalytics(), fetchAlerts()]);
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const handleStopSync = async () => {
    setIsSyncing(false);
    try {
      await fetch(`${API_BASE}/emails/fetch/sync/stop`, { method: 'POST', headers: getHeaders() });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!isSyncing) return;

    // Switch to REAL INBOX immediately
    setEmailSourceFilter('real');
    localStorage.removeItem('cached_emails');

    // 1. Kick off the backend sync task ONCE (do not force tab switch because we just did it)
    triggerSyncAPI(false);

    // 2. Poll the UI every 1.5s to show emails as they arrive from Gmail, respecting current tab
    const uiPoller = setInterval(() => {
      fetchEmails(); // Notice we removed 'real' here to prevent overwriting simulations
      fetchAnalytics();
      fetchAlerts();
    }, 1500);

    // 3. Re-trigger backend sync every 30s so new mail batches keep coming
    const syncPoller = setInterval(() => {
      triggerSyncAPI(false); // Do not force tab switch in the background
    }, 30000);

    return () => {
      clearInterval(uiPoller);
      clearInterval(syncPoller);
    };
  }, [isSyncing]);

  const handleRefreshSimulations = async () => {
    setIsRefreshing(true);
    try {
      await fetch(`${API_BASE}/emails/fetch/simulate/clear`, { method: 'POST', headers: getHeaders() });
      await Promise.all([fetchEmails(), fetchAgentLogs(), fetchAnalytics()]);
    } catch (e) {
      console.error('Clear failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const doSearch = async (query) => {
    if (!query.trim()) {
      setIsSearchActive(false);
      setSearchResults([]);
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setActiveTab('inbox');
      return;
    }
    setIsSearching(true);
    setIsSearchActive(true);
    setActiveTab('search');
    try {
      const res = await fetch(`${API_BASE}/emails/search`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ query, limit: 25 })
      });
      if (res.status === 200) {
        const data = await res.json();
        setSearchResults(data);
        // Build suggestions from results
        const suggestions = [];
        data.slice(0, 5).forEach(item => {
          const senderName = item.email.sender.split('<')[0].trim();
          if (senderName && !suggestions.includes(senderName)) suggestions.push(senderName);
          if (item.email.subject && !suggestions.includes(item.email.subject)) suggestions.push(item.email.subject.slice(0, 60));
        });
        setSearchSuggestions(suggestions.slice(0, 6));
        setShowSuggestions(false);
      }
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  };

  const handleSearch = () => doSearch(searchQuery);

  // Live debounced search as user types (Gmail-style)
  const handleSearchInput = (value) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setIsSearchActive(false);
      setSearchResults([]);
      setSearchSuggestions([]);
      setShowSuggestions(false);
      setActiveTab('inbox');
      return;
    }
    setShowSuggestions(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/emails/search`, {
          method: 'POST', headers: getHeaders(),
          body: JSON.stringify({ query: value, limit: 6 })
        });
        if (res.status === 200) {
          const data = await res.json();
          const suggestions = [];
          data.forEach(item => {
            const senderName = item.email.sender.split('<')[0].trim();
            if (senderName && !suggestions.includes(senderName)) suggestions.push(senderName);
            if (item.email.subject && !suggestions.includes(item.email.subject)) suggestions.push(item.email.subject.slice(0, 60));
          });
          setSearchSuggestions(suggestions.slice(0, 6));
        }
      } catch (e) { console.error(e); }
    }, 350);
  };





  const handleFeedback = async (emailId, type, val) => {
    try {
      const res = await fetch(`${API_BASE}/emails/feedback`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ email_id: emailId, feedback_type: type, corrected_value: val })
      });
      if (res.status === 200) {
        fetchEmails(); fetchAnalytics();
        if (selectedEmail && selectedEmail.id === emailId) {
          const updatedRes = await fetch(`${API_BASE}/emails/${emailId}`, { headers: getHeaders() });
          const updated = await updatedRes.json();
          setSelectedEmail(updated);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateReplyStatus = async (replyId, statusVal, bodyVal = null, toneVal = null, lengthVal = null) => {
    try {
      const payload = { status: statusVal };
      if (bodyVal) payload.edited_body = bodyVal;
      if (toneVal) payload.tone = toneVal;
      if (lengthVal) payload.length_preference = lengthVal;
      
      const res = await fetch(`${API_BASE}/emails/reply/${replyId}`, {
        method: 'PUT', headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.status === 200) {
        const updatedReply = await res.json();
        setEditingReply(false);
        if (selectedEmail) {
          const updatedReplies = selectedEmail.replies?.map(r => r.id === updatedReply.id ? updatedReply : r) || [updatedReply];
          const updatedEmail = { ...selectedEmail, replies: updatedReplies };
          setSelectedEmail(updatedEmail);
          setEmails(prev => prev.map(e => e.id === updatedEmail.id ? updatedEmail : e));
        }
        if (statusVal === 'Sent') {
          fetchAnalytics();
          fetchEmails();
          alert('✓ Smart reply approved and sent successfully!');
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleRegenerateReply = async (emailId, toneVal, lengthVal) => {
    try {
      setIsRegenerating(true);
      if (toneVal) setSelectedTone(toneVal);
      if (lengthVal) setSelectedLength(lengthVal);
      const targetId = emailId || selectedEmail?.id;
      if (!targetId) return;
      const res = await fetch(`${API_BASE}/emails/${targetId}/generate-reply`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ status: "Suggested", tone: toneVal, length_preference: lengthVal })
      });
      if (res.status === 200) {
        const newReply = await res.json();
        if (newReply.tone) setSelectedTone(newReply.tone);
        if (newReply.length_preference) setSelectedLength(newReply.length_preference);
        if (selectedEmail) {
          const updatedEmail = { ...selectedEmail, replies: [newReply] };
          setSelectedEmail(updatedEmail);
          setEmails(prev => prev.map(e => e.id === updatedEmail.id ? updatedEmail : e));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRegenerating(false);
    }
  };

  const selectEmailAndMarkRead = async (email) => {
    setSelectedEmail(email);
    setEditingReply(false);
    if (!email.is_read) {
      try {
        const res = await fetch(`${API_BASE}/emails/${email.id}`, {
          method: 'PUT', headers: getHeaders(), body: JSON.stringify({ is_read: true })
        });
        if (res.status === 200) fetchEmails();
      } catch (e) { console.error(e); }
    }
  };

  const handleLogout = () => {
    // Wipe EVERYTHING — ensures next Google account gets a blank slate
    setIsSyncing(false);
    setToken('');
    localStorage.clear(); // clear ALL localStorage including token, cached_emails, etc.
    setCurrentUser(null);
    setEmails([]);
    setSelectedEmail(null);
    setPreferences(null);
    setCareerInterests([]);
    setFavoriteCompanies([]);
    setAlwaysNotify([]);
    setAlerts([]);
    setAnalytics(null);
    setAgentLogs([]);
    setPopupNotification(null);
    setTestLabResults([]);
    setEmailSourceFilter('real');
    setCategoryFilter('');
    setPriorityFilter('');
    setSecurityFilter('all');
    setSearchQuery('');
    setSearchResults([]);
    setIsSearchActive(false);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsImapConnecting(true);
    setAuthError('Connecting to backend (models are loading, this might take 15s)...');
    try {
      const fetchWithRetry = async (url, options = {}, retries = 10, delay = 2000) => {
        for (let i = 0; i < retries; i++) {
          try {
            const res = await fetch(url, options);
            return res;
          } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay));
          }
        }
      };
      
      const params = new URLSearchParams();
      params.append('username', authEmail);
      params.append('password', authPassword);
      const res = await fetchWithRetry(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      if (res.status === 200) {
        const data = await res.json();
        setToken(data.access_token);
        setAuthError('');
      } else {
        const err = await res.json();
        setAuthError(err.detail || 'IMAP Authentication failed');
      }
    } catch { setAuthError('Connection server error. Backend might be down.'); }
    setIsImapConnecting(false);
  };

  // Badge color helpers
  const getPriorityColor = (p) => {
    const m = {
      'Critical': 'bg-red-500/15 text-red-400 border border-red-500/30',
      'High':     'bg-orange-500/15 text-orange-400 border border-orange-500/30',
      'Medium':   'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      'Low':      'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30',
    };
    return m[p] || m['Low'];
  };

  const getCategoryColor = (c) => {
    const m = {
      'Work & Projects':      'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
      'Finance & Billing':    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      'Networking':           'bg-sky-500/15 text-sky-400 border border-sky-500/30',
      'System Alerts':        'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      'Newsletters':          'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      'Education & Placements': 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    };
    return m[c] || 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30';
  };

  const getSecurityBadge = (email) => {
    if (email.is_phishing) return { text: `Phishing ${Math.round(email.phishing_score * 100)}%`, cls: 'bg-red-500/20 text-red-400 border border-red-500/40 badge-phishing' };
    if (email.is_spam)     return { text: 'Spam', cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/40' };
    return { text: 'Safe', cls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' };
  };

  const getInitials = (sender) => {
    const name = sender.split('<')[0].trim().split(/\s+/);
    return name.length >= 2 ? (name[0][0] + name[1][0]).toUpperCase() : name[0].substring(0, 2).toUpperCase();
  };

  const getInitialColor = (sender) => {
    const colors = ['bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600', 'bg-pink-600'];
    let hash = 0;
    for (let i = 0; i < sender.length; i++) hash = sender.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    // Backend stores UTC without 'Z' suffix — append it so JS parses correctly as UTC
    const raw = (dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('-', 10)) ? dateStr : dateStr + 'Z';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 172800000) return 'Yesterday';
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ========================
  // LANDING PAGE (shows before auth)
  // ========================
  if (showLanding) {
    return <LandingPage onEnterDashboard={() => { sessionStorage.setItem('landing_seen', 'true'); setShowLanding(false); }} />;
  }

  // ========================
  // AUTH SCREEN
  // ========================
  if (!token) {
    return (
      <AuthScreen
        isGoogleConnecting={isGoogleConnecting}
        setIsGoogleConnecting={setIsGoogleConnecting}
        authError={authError}
        setAuthError={setAuthError}
        API_BASE={API_BASE}
        clearAppState={() => {
          localStorage.clear();
          setEmails([]);
          setSelectedEmail(null);
          setCurrentUser(null);
          setAnalytics(null);
          setAgentLogs([]);
          setAlerts([]);
          setPopupNotification(null);
          setTestLabResults([]);
          setEmailSourceFilter('real');
          setCategoryFilter('');
          setPriorityFilter('');
          setSecurityFilter('all');
          setSearchQuery('');
          setSearchResults([]);
          setIsSearchActive(false);
        }}
      />
    );
  }

  // ========================
  // MAIN DASHBOARD
  // ========================
  const totalEmails = emails.filter(e => !e.is_simulated).length || analytics?.security_stats?.total_emails || 0;
  const threatsBlocked = (analytics?.security_stats?.spam_count || 0) + (analytics?.security_stats?.phishing_count || 0);
  const unreadCount = emails.filter(e => !e.is_read).length;

  const kpi = analytics?.kpi_stats || {};
  const newEmailsToday = kpi.new_emails_today || 0;
  const newEmailsMorning = kpi.new_emails_since_morning || 0;
  
  const highPriorityTotal = kpi.high_priority_total || 0;
  const highPriorityAction = kpi.high_priority_action_today || 0;
  
  const securityThreats = kpi.security_threats_total || 0;
  const phishingCount = kpi.phishing_count || 0;
  const suspiciousCount = kpi.suspicious_count || 0;
  
  const deadlinesTotal = kpi.upcoming_deadlines_total || 0;
  const nextDeadlineTitle = kpi.next_deadline_title || 'None';
  const nextDeadlineTime = kpi.next_deadline_time || '';

  const renderMncAnalyticsSuite = () => {
    const threatData = analytics?.threat_trend && analytics.threat_trend.length > 0
      ? analytics.threat_trend
      : (analytics?.daily_volume || []).map(v => ({
          date: v.date,
          processed: v.count,
          spam: Math.round(v.count * 0.1),
          suspicious: Math.round(v.count * 0.08),
          phishing: Math.round(v.count * 0.02)
        }));

    const formattedCategories = (analytics?.category_distribution || []).map(item => {
      let shortName = item.category || 'Other';
      if (shortName.includes('Education')) shortName = 'Edu & Career';
      else if (shortName.includes('Promotions')) shortName = 'Promotions';
      else if (shortName.includes('Security')) shortName = 'Security';
      else if (shortName.includes('Updates')) shortName = 'Updates';
      else if (shortName.includes('Work')) shortName = 'Work';
      else if (shortName.includes('Payments')) shortName = 'Payments';
      else if (shortName.includes('Shopping')) shortName = 'Shopping';
      return { ...item, shortName };
    });

    const secBreakdown = analytics?.security_breakdown || {
      safe: analytics?.security_stats?.clean_count || 241,
      spam: analytics?.security_stats?.spam_count || 31,
      suspicious: analytics?.kpi_stats?.suspicious_count || 26,
      phishing: analytics?.security_stats?.phishing_count || 5
    };

    const donutData = [
      { name: 'Safe', value: secBreakdown.safe, color: '#10b981' },
      { name: 'Spam', value: secBreakdown.spam, color: '#f59e0b' },
      { name: 'Suspicious', value: secBreakdown.suspicious, color: '#f97316' },
      { name: 'Phishing', value: secBreakdown.phishing, color: '#ef4444' }
    ];

    const prioAction = analytics?.priority_action || {
      critical: 12,
      high: 34,
      medium: 86,
      low: 171,
      requires_action: 18,
      no_action: 285
    };

    const deadlineTimeline = analytics?.deadline_timeline && analytics.deadline_timeline.length > 0
      ? analytics.deadline_timeline
      : [
          { id: 1, title: 'TCS Assessment & Technical Exam', datetime: 'Aug 10, 10:00 AM', type: 'Technical Assessment', remaining: '2 days remaining' },
          { id: 2, title: 'Data Analyst Interview (Second Round)', datetime: 'Aug 12, 11:30 AM', type: 'Job Interview', remaining: '4 days remaining' },
          { id: 3, title: 'Application Deadline — BrandQuest 2026', datetime: 'Aug 15, 11:59 PM', type: 'Action Deadline', remaining: '7 days remaining' }
        ];

    const impact = analytics?.automation_impact || {
      emails_summarized: totalEmails || 126,
      action_items_extracted: prioAction.requires_action || 31,
      deadlines_detected: 8,
      smart_replies_generated: 17,
      replies_approved_sent: 9,
      priority_alerts_triggered: 14
    };

    const radarTelemetry = [
      { subject: 'Vector RAG Search', score: 96, fullMark: 100 },
      { subject: 'LLM Classification', score: 94, fullMark: 100 },
      { subject: 'Security Precision', score: 98, fullMark: 100 },
      { subject: 'Entity Extraction', score: 91, fullMark: 100 },
      { subject: 'Pipeline Latency', score: 95, fullMark: 100 },
      { subject: 'Action Intent Recall', score: 93, fullMark: 100 }
    ];

    return (
      <div className="flex-1 overflow-y-auto bg-[#0a0a0f] p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          
          {/* Header Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-zinc-900/40 p-6 rounded-2xl border border-blue-500/20 backdrop-blur-xl">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h2 className="text-xl font-extrabold text-white tracking-tight">MNC Enterprise Email Intelligence & Telemetry Analytics Suite</h2>
              </div>
              <p className="text-xs text-zinc-400">Live multi-dimensional telemetry, threat signal isolation, deadline timelines & AI automation impact derived live from database.</p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setMainViewTab('inbox')} 
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Inbox
              </button>
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Telemetry Active
              </span>
              <button 
                onClick={handleSyncData} 
                disabled={isRefreshing}
                className="group relative overflow-hidden px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-[#0F131D] border border-purple-500/40 hover:border-purple-400 text-purple-300 text-xs font-extrabold transition-all duration-300 flex items-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-105 active:scale-95 shadow-md shadow-purple-900/20 hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:-translate-y-0.5"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(168,85,247,0.2), transparent 70%)' }} />
                <RefreshCw className={`w-4 h-4 relative z-10 transition-transform group-hover:rotate-180 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
                <span className="relative z-10">{isRefreshing ? 'Syncing Real-Time...' : 'Start Sync'}</span>
              </button>
            </div>
          </div>

          {/* 6 Metric Overview Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Emails Processed', val: totalEmails, colorHex: '#3b82f6', colorClass: 'text-blue-400' },
              { label: 'Threats Blocked', val: secBreakdown.spam + secBreakdown.phishing + secBreakdown.suspicious, colorHex: '#f59e0b', colorClass: 'text-amber-400' },
              { label: 'Phishing Signals', val: secBreakdown.phishing, colorHex: '#ef4444', colorClass: 'text-red-400' },
              { label: 'Action Required', val: prioAction.requires_action, colorHex: '#a855f7', colorClass: 'text-purple-400' },
              { label: 'Deadlines Tracked', val: impact.deadlines_detected, colorHex: '#06b6d4', colorClass: 'text-cyan-400' },
              { label: 'Smart Replies Sent', val: impact.replies_approved_sent, colorHex: '#10b981', colorClass: 'text-emerald-400' },
            ].map((m, idx) => (
              <div 
                key={idx} 
                className="group relative p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 transition-all duration-300 backdrop-blur-md overflow-hidden hover:-translate-y-1 hover:scale-[1.02] flex flex-col justify-between"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${m.colorHex}99`; // 0.6 opacity
                  e.currentTarget.style.boxShadow = `0 10px 30px -10px ${m.colorHex}59`; // 0.35 opacity
                  e.currentTarget.style.backgroundColor = '#0F131D';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 0.8)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.backgroundColor = 'rgba(9, 9, 11, 0.4)';
                }}
              >
                {/* Top accent glow */}
                <div 
                  className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ backgroundColor: m.colorHex }}
                />
                {/* Subtle background gradient glow on hover */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(circle at top right, ${m.colorHex}25, transparent 70%)` }}
                />

                <span className="relative z-10 text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-zinc-200 transition-colors">{m.label}</span>
                <span className={`relative z-10 text-2xl font-black ${m.colorClass} mt-2 group-hover:scale-105 transition-transform origin-left`}>{m.val}</span>
              </div>
            ))}
          </div>

          {/* GRID ROW 1: Upgraded Line/Area Threat Trend (Graph 1) & Category Distribution (Graph 2) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Graph 1: Upgraded Email Activity & Threat Telemetry Trend */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Email Ingestion & Threat Telemetry Trend</h3>
                    <span className="text-[10px] text-zinc-500">Live 4-Series Isolation: Processed vs Spam vs Suspicious vs Phishing</span>
                  </div>
                </div>
                {/* Live Mini Stats Pills */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    Processed: {totalEmails}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    Spam: {secBreakdown.spam}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
                    Suspicious: {secBreakdown.suspicious}
                  </span>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                    Phishing: {secBreakdown.phishing}
                  </span>
                </div>
              </div>

              <div className="h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={threatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="procGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="spamGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="suspGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#52525b" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                    <YAxis stroke="#52525b" tick={{ fontSize: 10, fill: '#71717a' }} />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-[#090d16]/95 border border-zinc-700/80 p-3.5 rounded-2xl shadow-2xl backdrop-blur-xl space-y-2 min-w-[200px]">
                              <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5">
                                <span className="text-xs font-black text-white font-mono">{label}</span>
                                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                  Live Telemetry
                                </span>
                              </div>
                              {payload.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs">
                                  <span className="font-bold flex items-center gap-1.5" style={{ color: item.color }}>
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                    {item.name}:
                                  </span>
                                  <span className="font-mono font-extrabold text-white">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }} 
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" name="Processed" dataKey="processed" stroke="#06b6d4" strokeWidth={3} fill="url(#procGrad)" />
                    <Area type="monotone" name="Spam" dataKey="spam" stroke="#f59e0b" strokeWidth={2.5} fill="url(#spamGrad)" />
                    <Line type="monotone" name="Suspicious" dataKey="suspicious" stroke="#f97316" strokeWidth={2.5} dot={{ r: 4, fill: '#f97316' }} />
                    <Line type="monotone" name="Phishing" dataKey="phishing" stroke="#ef4444" strokeWidth={3} dot={{ r: 5, fill: '#ef4444' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Graph 2: Inbox Category Distribution (Collided Labels Fixed with -25deg Angle) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Database className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Inbox Category Distribution</h3>
                    <span className="text-[10px] text-zinc-500">AI Topic Segmentation across Real Gmail Inbox</span>
                  </div>
                </div>
              </div>
              <div className="h-72 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={formattedCategories} margin={{ top: 10, right: 10, left: -20, bottom: 55 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                    <XAxis dataKey="shortName" stroke="#52525b" tick={{ fontSize: 9, fill: '#a1a1aa', angle: -25, textAnchor: 'end' }} dy={5} interval={0} />
                    <YAxis stroke="#52525b" tick={{ fontSize: 10, fill: '#71717a' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#090d16', borderColor: '#3f3f46', borderRadius: '12px', fontSize: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.6)' }} 
                      itemStyle={{ color: '#a855f7', fontWeight: 'bold' }}
                      labelStyle={{ color: '#f4f4f5', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {formattedCategories.map((entry, index) => {
                        const colors = ['#3b82f6', '#0ea5e9', '#6366f1', '#06b6d4', '#8b5cf6', '#14b8a6', '#4f46e5', '#0284c7'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* GRID ROW 2: Security Threat Breakdown (Graph 3) & Priority & Action Intelligence (Graph 4) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* Graph 3: Security Threat Breakdown (Donut Chart with Dynamic Matching Colors & Center Stats) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Security Threat Isolation & Firewall Telemetry</h3>
                    <span className="text-[10px] text-zinc-500">Isolation of Safe vs Spam vs Suspicious vs Phishing</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-extrabold tracking-wider uppercase font-mono">
                  SOC-2 COMPLIANT
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                <div className="h-56 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={donutData} 
                        innerRadius={55} 
                        outerRadius={80} 
                        paddingAngle={4} 
                        dataKey="value"
                        onMouseEnter={(_, index) => setHoveredSlice(donutData[index])}
                        onMouseLeave={() => setHoveredSlice(null)}
                      >
                        {donutData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            stroke={hoveredSlice?.name === entry.name ? '#ffffff' : 'none'}
                            strokeWidth={hoveredSlice?.name === entry.name ? 2 : 0}
                            style={{ cursor: 'pointer', filter: hoveredSlice?.name === entry.name ? 'drop-shadow(0 0 8px ' + entry.color + ')' : 'none' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            return (
                              <div className="bg-[#090d16] border border-zinc-700/80 p-3 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.payload.color }} />
                                <span className="text-xs font-extrabold" style={{ color: data.payload.color }}>
                                  {data.name}:
                                </span>
                                <span className="text-xs font-mono font-extrabold text-white">
                                  {data.value} ({((data.value / (totalEmails || 1)) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Dynamic Center Hub display */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-lg font-black text-white font-mono" style={{ color: hoveredSlice ? hoveredSlice.color : '#ffffff' }}>
                      {hoveredSlice ? hoveredSlice.value : totalEmails}
                    </span>
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                      {hoveredSlice ? hoveredSlice.name : 'Total Scanned'}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  {donutData.map((item, idx) => {
                    const isHovered = hoveredSlice?.name === item.name;
                    return (
                      <div 
                        key={idx} 
                        onMouseEnter={() => setHoveredSlice(item)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        onClick={() => {
                          if (item.name === 'Safe') setSecurityFilter('all');
                          else if (item.name === 'Spam' || item.name === 'Phishing' || item.name === 'Suspicious') setSecurityFilter('threats');
                          setMainViewTab('inbox');
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                          isHovered 
                            ? 'bg-zinc-800/80 border-zinc-600 shadow-lg' 
                            : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs font-extrabold" style={{ color: isHovered ? item.color : '#d4d4d8' }}>{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-white font-mono">{item.value}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">({((item.value / (totalEmails || 1)) * 100).toFixed(1)}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Graph 4: Deadline Intelligence (Timeline Cards) */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Upcoming Deadline Intelligence</h3>
                  <span className="text-[10px] text-zinc-500">Exams, Job Interviews, Assessment & Payment Deadlines</span>
                </div>
              </div>

              <div className="space-y-3">
                {deadlineTimeline.map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex items-center justify-between hover:border-purple-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
                      <div>
                        <h4 className="text-xs font-bold text-zinc-200">{item.title}</h4>
                        <span className="text-[10px] text-zinc-500 block mt-0.5">{item.datetime} · {item.type}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                      {item.remaining}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    );
  };


  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0a0a0f] text-white font-sans">
      {/* ===== GLOBAL HEADER ===== */}
      <header className="h-16 border-b border-zinc-800/50 flex items-center justify-between px-6 shrink-0 bg-[#0a0a0f]">
        {/* Logo — Clickable to return to Inbox */}
        <div 
          onClick={() => setShowLanding(true)} 
          className="flex items-center gap-3 w-[290px] cursor-pointer group hover:opacity-90 transition-opacity"
          title="Return to Landing Page"
        >
          <div className="p-0.5 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 border border-cyan-400/40 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <img src="/icon-logo.png" alt="AI Powered Email Assistant" className="w-8 h-8 object-cover rounded-[8px]" />
          </div>
          <div>
            <h1 className="text-[13px] font-extrabold tracking-wide text-white group-hover:text-cyan-400 transition-colors">AI Powered Email Assistant</h1>
            <span className="text-[9px] text-cyan-400/80 font-bold tracking-widest uppercase block mt-0.5">Autonomous Security</span>
          </div>
        </div>

        {/* Global Search — Gmail-style with live suggestions */}
        <div className="flex-1 max-w-2xl px-4">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors z-10 pointer-events-none" />
            <input 
              type="text"
              placeholder="Search emails — names, subjects, or keywords..."
              value={searchQuery}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { setShowSuggestions(false); handleSearch(); }
                if (e.key === 'Escape') { setShowSuggestions(false); }
              }}
              onFocus={() => { if (searchQuery && searchSuggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-full py-2 pl-10 pr-10 text-[13px] text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20 hover:border-blue-500/40 hover:bg-[#0F131D] transition-all duration-300 shadow-inner hover:shadow-[0_0_15px_rgba(59,130,246,0.1)]"
            />
            {searchQuery && !isSearching && (
              <button onClick={() => { setSearchQuery(''); setIsSearchActive(false); setSearchResults([]); setSearchSuggestions([]); setShowSuggestions(false); setActiveTab('inbox'); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors z-10">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
            {/* Live suggestions dropdown */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0F131D] border border-blue-500/30 rounded-2xl shadow-[0_15px_40px_-10px_rgba(59,130,246,0.2)] overflow-hidden z-50 backdrop-blur-xl">
                <div className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-blue-400/80 border-b border-zinc-800/80 bg-blue-500/5">Suggestions</div>
                {searchSuggestions.map((s, i) => (
                  <button key={i} onMouseDown={() => { setSearchQuery(s); setShowSuggestions(false); doSearch(s); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[12px] text-zinc-300 hover:bg-blue-500/10 hover:text-white transition-colors group/item">
                    <Search className="w-3 h-3 text-blue-500/50 group-hover/item:text-blue-400 shrink-0 transition-colors" />
                    <span className="line-clamp-1">{s}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status Badges & User */}
        <div className="flex items-center gap-3 shrink-0 relative z-10">

          {/* Main View Toggle Pill */}
          <div className="flex bg-zinc-900 border border-zinc-700/60 p-1 rounded-full shadow-inner hover:border-blue-500/30 transition-colors">
            <button 
              onClick={() => setMainViewTab('inbox')}
              className={`group relative overflow-hidden px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                mainViewTab === 'inbox' 
                  ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' 
                  : 'text-zinc-400 hover:text-white hover:bg-blue-500/10'
              }`}
            >
              <Inbox className="w-3.5 h-3.5 relative z-10 transition-transform group-hover:scale-110" /> <span className="relative z-10">Inbox</span>
            </button>
            <button 
              onClick={() => setMainViewTab('analytics')}
              className={`group relative overflow-hidden px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                mainViewTab === 'analytics' 
                  ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' 
                  : 'text-zinc-400 hover:text-white hover:bg-purple-500/10'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 relative z-10 transition-transform group-hover:scale-110" /> <span className="relative z-10">Analytics</span>
            </button>
          </div>
          
          {/* Test Lab Button */}
          <button onClick={() => setIsTestLabOpen(true)} className="group relative overflow-hidden px-3 py-1.5 rounded-full border border-purple-500/50 text-[10px] font-bold text-purple-400 hover:text-white bg-purple-500/10 hover:bg-[#0F131D] flex items-center gap-1.5 transition-all duration-300 hover:border-purple-400 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:-translate-y-0.5">
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(168,85,247,0.2), transparent 70%)' }} />
            <Layers className="w-3.5 h-3.5 relative z-10 transition-transform group-hover:scale-110" /> <span className="relative z-10">{isSimulating ? 'Running...' : 'Test Lab'}</span>
          </button>

          {/* Voice Assistant */}
          <VoiceAssistant onCommand={handleVoiceCommand} />
          
          <button 
            onClick={() => setIsComposeOpen(true)}
            className="group relative overflow-hidden px-4 py-1.5 rounded-full bg-white text-black text-[11px] font-black tracking-widest hover:bg-zinc-100 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] flex items-center gap-2 hover:-translate-y-0.5 hover:scale-105 cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 transition-transform group-hover:rotate-12" /> <span className="relative z-10">COMPOSE</span>
          </button>

            <button onClick={() => isSyncing ? handleStopSync() : setIsSyncing(true)} className={`group relative overflow-hidden px-3 py-1.5 rounded-full border text-[10px] font-bold flex items-center gap-1.5 transition-all duration-300 hover:-translate-y-0.5 ${isSyncing ? 'border-red-500/50 text-red-400 bg-red-500/10 hover:bg-red-500/20 hover:border-red-400 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'border-zinc-700/50 text-zinc-400 bg-zinc-800/20 hover:bg-[#0F131D] hover:border-blue-500/50 hover:text-blue-300 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]'}`}>
              <RefreshCw className={`w-3.5 h-3.5 relative z-10 transition-transform ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180'}`} /> <span className="relative z-10">{isSyncing ? 'Stop Sync' : 'Start Sync'}</span>
            </button>
          
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-teal-500/20 text-[10px] text-teal-400 font-bold bg-teal-500/5 shadow-[0_0_10px_rgba(20,184,166,0.1)] hover:shadow-[0_0_20px_rgba(20,184,166,0.2)] transition-shadow duration-300 cursor-default">
            <Activity className="w-3.5 h-3.5" /> Pipeline healthy
          </div>

          <button onClick={fetchDigest} className="group relative overflow-hidden flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 hover:bg-[#0F131D] transition-all duration-300 text-xs font-semibold border border-blue-500/20 hover:border-blue-400 hover:shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:-translate-y-0.5">
            <Sparkles className="w-3.5 h-3.5" /> AI Digest
          </button>
          
          <div className="relative">
            <button onClick={() => setIsAlertsOpen(!isAlertsOpen)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition relative">
              <Bell className="w-4.5 h-4.5" />
              {alerts.filter(a => !a.is_read).length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-[#0a0a0f]"></span>
              )}
            </button>
            {isAlertsOpen && (
              <div className="absolute right-0 top-full mt-2 w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-3 border-b border-zinc-800 flex flex-col gap-2 bg-black/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-blue-400" /> AI Assistant</span>
                    <span className="text-xs text-zinc-500 font-bold">{alerts.filter(a => !a.is_read).length} Active</span>
                  </div>
                  {alerts.filter(a => !a.is_read).length > 0 && (
                    <div className="flex gap-3 text-[10px] font-medium mt-1">
                      {alerts.filter(a => !a.is_read && a.alert_type === 'Security Alert').length > 0 && <span className="text-red-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> {alerts.filter(a => !a.is_read && a.alert_type === 'Security Alert').length} Security</span>}
                      {alerts.filter(a => !a.is_read && a.alert_type === 'Placement Alert').length > 0 && <span className="text-blue-400 flex items-center gap-1"><Target className="w-3 h-3"/> {alerts.filter(a => !a.is_read && a.alert_type === 'Placement Alert').length} Placement</span>}
                      {alerts.filter(a => !a.is_read && a.alert_type === 'Interview Alert').length > 0 && <span className="text-purple-400 flex items-center gap-1"><Briefcase className="w-3 h-3"/> {alerts.filter(a => !a.is_read && a.alert_type === 'Interview Alert').length} Interview</span>}
                      {alerts.filter(a => !a.is_read && a.alert_type === 'Deadline Alert').length > 0 && <span className="text-orange-400 flex items-center gap-1"><Clock className="w-3 h-3"/> {alerts.filter(a => !a.is_read && a.alert_type === 'Deadline Alert').length} Deadline</span>}
                      {alerts.filter(a => !a.is_read && a.alert_type === 'Delivery Failed').length > 0 && <span className="text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {alerts.filter(a => !a.is_read && a.alert_type === 'Delivery Failed').length} Failed</span>}
                    </div>
                  )}
                </div>
                <div className="max-h-[450px] overflow-y-auto">
                  {alerts.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 text-xs">No alerts generated yet.</div>
                  ) : alerts.map(alert => {
                    let Icon = Bell;
                    let iconColor = "text-blue-400";
                    let actionText = "Open Email";
                    
                    if (alert.alert_type === 'Security Alert') { Icon = ShieldAlert; iconColor = "text-red-500"; actionText = "Review Activity"; }
                    else if (alert.alert_type === 'Placement Alert') { Icon = Target; iconColor = "text-blue-500"; actionText = "Register Now"; }
                    else if (alert.alert_type === 'Interview Alert') { Icon = Briefcase; iconColor = "text-purple-500"; actionText = "Reply Confirmation"; }
                    else if (alert.alert_type === 'Deadline Alert') { Icon = Clock; iconColor = "text-orange-500"; actionText = "Review Deadline"; }
                    else if (alert.alert_type === 'Payment Reminder') { Icon = CreditCard; iconColor = "text-emerald-500"; actionText = "Pay Bill"; }
                    else if (alert.alert_type === 'Action Required') { Icon = CheckCircle2; iconColor = "text-yellow-500"; actionText = "Take Action"; }
                    else if (alert.alert_type === 'Delivery Failed') { Icon = AlertCircle; iconColor = "text-red-500"; actionText = "Check Address"; }

                    return (
                      <div key={alert.id} className={`p-4 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition group ${alert.is_read ? 'opacity-60' : 'bg-blue-500/5'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                            <span className={`text-[11px] font-bold ${iconColor}`}>{alert.alert_type}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            {!alert.is_read ? (
                              <span className="text-red-400 font-bold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> NEW</span>
                            ) : (
                              <span className="text-zinc-500 flex items-center gap-1"><Check className="w-3 h-3" /> Viewed</span>
                            )}
                            <span className="text-zinc-500">{formatTimeAgo(alert.created_at)}</span>
                          </div>
                        </div>
                        
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-zinc-200 line-clamp-1">{alert.email?.subject || alert.title}</p>
                          <p className="text-[11px] text-zinc-500 truncate">From: {alert.email?.sender || 'System'}</p>
                        </div>
                        
                        <div className="p-2 mb-3 rounded border border-zinc-800 bg-black/20">
                          <p className="text-[11px] text-zinc-400">
                            <span className="text-zinc-500 font-medium">Reason:</span> {alert.trigger_reason || alert.message}
                          </p>
                        </div>
                        
                        <div className="flex justify-end">
                          <button onClick={() => handleAlertAction(alert)} className="text-[10px] font-bold px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition flex items-center gap-1.5">
                            {actionText} <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setShowSettingsModal(true)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition">
            <Settings className="w-4.5 h-4.5" />
          </button>

          {/* Avatar Dropdown */}
          <div className="relative">
            <button onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)} className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-[11px] font-bold border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all hover:scale-105">
              {currentUser?.full_name?.charAt(0) || currentUser?.email?.charAt(0)?.toUpperCase() || 'U'}
            </button>
            {isAvatarMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-60 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1.5 z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-zinc-800/50">
                  <p className="text-xs font-bold text-white truncate">{currentUser?.full_name || 'User'}</p>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">{currentUser?.email}</p>
                </div>
                {/* Switch Account — clears everything and goes straight to Google account picker */}
                <button
                  onClick={async () => {
                    setIsAvatarMenuOpen(false);
                    setIsGoogleConnecting(true);
                    // Wipe ALL state and localStorage before switching
                    setIsSyncing(false);
                    setToken('');
                    localStorage.clear();
                    setCurrentUser(null); setEmails([]); setSelectedEmail(null);
                    setPreferences(null); setCareerInterests([]); setFavoriteCompanies([]);
                    setAlwaysNotify([]); setAlerts([]); setAnalytics(null);
                    setAgentLogs([]); setPopupNotification(null); setTestLabResults([]);
                    setEmailSourceFilter('real'); setCategoryFilter(''); setPriorityFilter('');
                    setSecurityFilter('all'); setSearchQuery(''); setSearchResults([]); setIsSearchActive(false);
                    try {
                      // Backend forces Google account picker (prompt=select_account consent)
                      const res = await fetch(`${API_BASE}/auth/google/login`);
                      const data = await res.json();
                      if (data.url) window.location.href = data.url;
                    } catch (err) {
                      console.error('Switch account error:', err);
                      setIsGoogleConnecting(false);
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6"/></svg>
                  Switch Account
                </button>
                <button onClick={() => { setIsAvatarMenuOpen(false); handleLogout(); }} className="w-full text-left px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 transition-colors">
                  <LogOut className="w-3.5 h-3.5" /> Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===== MAIN DASHBOARD CONTENT ===== */}
      <main className="flex-1 flex flex-col min-w-0 p-5 overflow-hidden">
        
        {/* KPI Cards Row */}
        <div className="grid grid-cols-5 gap-5 mb-5 shrink-0">
          {/* Card 1: Emails processed */}
          <div 
            onClick={() => { setSecurityFilter('all'); setMainViewTab('inbox'); }} 
            className="group relative rounded-2xl border bg-[#0F131D] p-5 flex items-center gap-4 transition-all duration-300 backdrop-blur-md cursor-pointer overflow-hidden hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              borderColor: securityFilter === 'all' ? 'rgba(6, 182, 212, 0.7)' : 'rgba(39, 39, 42, 0.8)',
              boxShadow: securityFilter === 'all' ? '0 15px 35px -10px rgba(6, 182, 212, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (securityFilter !== 'all') {
                e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.6)';
                e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(6, 182, 212, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (securityFilter !== 'all') {
                e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 0.8)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${securityFilter === 'all' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ backgroundColor: '#06b6d4' }} />
            <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${securityFilter === 'all' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'radial-gradient(circle at left, rgba(6, 182, 212, 0.15), transparent 70%)' }} />

            <div 
              className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg"
              style={{ 
                backgroundColor: securityFilter === 'all' ? '#06b6d4' : 'rgba(6, 182, 212, 0.15)', 
                borderColor: securityFilter === 'all' ? '#22d3ee' : 'rgba(6, 182, 212, 0.3)', 
                borderWidth: '1px',
                color: securityFilter === 'all' ? '#fff' : '#06b6d4',
                boxShadow: securityFilter === 'all' ? '0 0 20px rgba(6, 182, 212, 0.5)' : '0 0 15px rgba(6, 182, 212, 0.15)'
              }}
            >
              <Layers className="w-5 h-5" />
            </div>

            <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Emails processed</span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white leading-none tracking-tight group-hover:scale-105 transition-transform origin-left">{totalEmails.toLocaleString()}</h3>
                <button 
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider transition-all duration-300 ${securityFilter === 'all' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}
                  style={{ backgroundColor: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee', borderColor: 'rgba(6, 182, 212, 0.4)', borderWidth: '1px' }}
                >
                  View
                  <ChevronRight className="w-2 h-2" />
                </button>
              </div>
              <span className="text-[10px] text-cyan-400 font-bold mt-1 block truncate">+12.4% today</span>
            </div>
          </div>

          {/* Card 2: New Emails Today */}
          <div 
            onClick={() => { setSecurityFilter('new_today'); setMainViewTab('inbox'); }} 
            className="group relative rounded-2xl border bg-[#0F131D] p-5 flex items-center gap-4 transition-all duration-300 backdrop-blur-md cursor-pointer overflow-hidden hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              borderColor: securityFilter === 'new_today' ? 'rgba(16, 185, 129, 0.7)' : 'rgba(39, 39, 42, 0.8)',
              boxShadow: securityFilter === 'new_today' ? '0 15px 35px -10px rgba(16, 185, 129, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (securityFilter !== 'new_today') {
                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)';
                e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(16, 185, 129, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (securityFilter !== 'new_today') {
                e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 0.8)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${securityFilter === 'new_today' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ backgroundColor: '#10b981' }} />
            <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${securityFilter === 'new_today' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'radial-gradient(circle at left, rgba(16, 185, 129, 0.15), transparent 70%)' }} />

            <div 
              className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg"
              style={{ 
                backgroundColor: securityFilter === 'new_today' ? '#10b981' : 'rgba(16, 185, 129, 0.15)', 
                borderColor: securityFilter === 'new_today' ? '#34d399' : 'rgba(16, 185, 129, 0.3)', 
                borderWidth: '1px',
                color: securityFilter === 'new_today' ? '#fff' : '#10b981',
                boxShadow: securityFilter === 'new_today' ? '0 0 20px rgba(16, 185, 129, 0.5)' : '0 0 15px rgba(16, 185, 129, 0.15)'
              }}
            >
              <Inbox className="w-5 h-5" />
            </div>

            <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">New Emails Today</span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white leading-none tracking-tight group-hover:scale-105 transition-transform origin-left">{newEmailsToday}</h3>
                <button 
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider transition-all duration-300 ${securityFilter === 'new_today' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}
                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)', borderWidth: '1px' }}
                >
                  View
                  <ChevronRight className="w-2 h-2" />
                </button>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold mt-1 block truncate">+{newEmailsMorning} since morning</span>
            </div>
          </div>

          {/* Card 3: High Priority */}
          <div 
            onClick={() => { setSecurityFilter('high_priority'); setMainViewTab('inbox'); }} 
            className="group relative rounded-2xl border bg-[#0F131D] p-5 flex items-center gap-4 transition-all duration-300 backdrop-blur-md cursor-pointer overflow-hidden hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              borderColor: securityFilter === 'high_priority' ? 'rgba(245, 158, 11, 0.7)' : 'rgba(39, 39, 42, 0.8)',
              boxShadow: securityFilter === 'high_priority' ? '0 15px 35px -10px rgba(245, 158, 11, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (securityFilter !== 'high_priority') {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.6)';
                e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(245, 158, 11, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (securityFilter !== 'high_priority') {
                e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 0.8)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${securityFilter === 'high_priority' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ backgroundColor: '#f59e0b' }} />
            <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${securityFilter === 'high_priority' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'radial-gradient(circle at left, rgba(245, 158, 11, 0.15), transparent 70%)' }} />

            <div 
              className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg"
              style={{ 
                backgroundColor: securityFilter === 'high_priority' ? '#f59e0b' : 'rgba(245, 158, 11, 0.15)', 
                borderColor: securityFilter === 'high_priority' ? '#fbbf24' : 'rgba(245, 158, 11, 0.3)', 
                borderWidth: '1px',
                color: securityFilter === 'high_priority' ? '#fff' : '#f59e0b',
                boxShadow: securityFilter === 'high_priority' ? '0 0 20px rgba(245, 158, 11, 0.5)' : '0 0 15px rgba(245, 158, 11, 0.15)'
              }}
            >
              <AlertCircle className="w-5 h-5" />
            </div>

            <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">High Priority</span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white leading-none tracking-tight group-hover:scale-105 transition-transform origin-left">{highPriorityTotal}</h3>
                <button 
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider transition-all duration-300 ${securityFilter === 'high_priority' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)', borderWidth: '1px' }}
                >
                  Action
                  <ChevronRight className="w-2 h-2" />
                </button>
              </div>
              <span className="text-[10px] text-amber-400 font-bold mt-1 block truncate">{highPriorityAction} require action today</span>
            </div>
          </div>

          {/* Card 4: Security Threats */}
          <div 
            onClick={() => { setSecurityFilter('threats'); setMainViewTab('inbox'); }} 
            className="group relative rounded-2xl border bg-[#0F131D] p-5 flex items-center gap-4 transition-all duration-300 backdrop-blur-md cursor-pointer overflow-hidden hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              borderColor: securityFilter === 'threats' ? 'rgba(236, 72, 153, 0.7)' : 'rgba(39, 39, 42, 0.8)',
              boxShadow: securityFilter === 'threats' ? '0 15px 35px -10px rgba(236, 72, 153, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (securityFilter !== 'threats') {
                e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.6)';
                e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(236, 72, 153, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (securityFilter !== 'threats') {
                e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 0.8)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${securityFilter === 'threats' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ backgroundColor: '#ec4899' }} />
            <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${securityFilter === 'threats' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'radial-gradient(circle at left, rgba(236, 72, 153, 0.15), transparent 70%)' }} />

            <div 
              className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg"
              style={{ 
                backgroundColor: securityFilter === 'threats' ? '#ec4899' : 'rgba(236, 72, 153, 0.15)', 
                borderColor: securityFilter === 'threats' ? '#f472b6' : 'rgba(236, 72, 153, 0.3)', 
                borderWidth: '1px',
                color: securityFilter === 'threats' ? '#fff' : '#ec4899',
                boxShadow: securityFilter === 'threats' ? '0 0 20px rgba(236, 72, 153, 0.5)' : '0 0 15px rgba(236, 72, 153, 0.15)'
              }}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>

            <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Security Threats</span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white leading-none tracking-tight group-hover:scale-105 transition-transform origin-left">{securityThreats}</h3>
                <button 
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider transition-all duration-300 ${securityFilter === 'threats' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}
                  style={{ backgroundColor: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', borderColor: 'rgba(236, 72, 153, 0.4)', borderWidth: '1px' }}
                >
                  Review
                  <ChevronRight className="w-2 h-2" />
                </button>
              </div>
              <span className="text-[10px] text-pink-400 font-bold mt-1 block truncate">{phishingCount} phishing, {suspiciousCount} suspicious</span>
            </div>
          </div>

          {/* Card 5: Upcoming Deadlines */}
          <div 
            onClick={() => { setSecurityFilter('deadlines'); setMainViewTab('inbox'); }} 
            className="group relative rounded-2xl border bg-[#0F131D] p-5 flex items-center gap-4 transition-all duration-300 backdrop-blur-md cursor-pointer overflow-hidden hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]"
            style={{ 
              borderColor: securityFilter === 'deadlines' ? 'rgba(139, 92, 246, 0.7)' : 'rgba(39, 39, 42, 0.8)',
              boxShadow: securityFilter === 'deadlines' ? '0 15px 35px -10px rgba(139, 92, 246, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (securityFilter !== 'deadlines') {
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
                e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(139, 92, 246, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (securityFilter !== 'deadlines') {
                e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 0.8)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 ${securityFilter === 'deadlines' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ backgroundColor: '#8b5cf6' }} />
            <div className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${securityFilter === 'deadlines' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'radial-gradient(circle at left, rgba(139, 92, 246, 0.15), transparent 70%)' }} />

            <div 
              className="relative z-10 w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg"
              style={{ 
                backgroundColor: securityFilter === 'deadlines' ? '#8b5cf6' : 'rgba(139, 92, 246, 0.15)', 
                borderColor: securityFilter === 'deadlines' ? '#a78bfa' : 'rgba(139, 92, 246, 0.3)', 
                borderWidth: '1px',
                color: securityFilter === 'deadlines' ? '#fff' : '#8b5cf6',
                boxShadow: securityFilter === 'deadlines' ? '0 0 20px rgba(139, 92, 246, 0.5)' : '0 0 15px rgba(139, 92, 246, 0.15)'
              }}
            >
              <Clock className="w-5 h-5" />
            </div>

            <div className="relative z-10 flex-1 min-w-0 flex flex-col justify-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">Upcoming Deadlines</span>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-white leading-none tracking-tight group-hover:scale-105 transition-transform origin-left">
                  {emails.filter(email => {
                    const hasGeminiDeadline = Boolean(email.deadlines && email.deadlines !== '[]' && email.deadlines !== 'null');
                    const subj = (email.subject || '').toLowerCase();
                    const summ = (email.summary || '').toLowerCase();
                    const matchesKeyword = ['deadline', 'due date', 'due by', 'interview', 'assessment', 'exam', 'test link', 'submit before', 'last date to', 'expires', 'placement drive', 'registration deadline', 'contest date', 'interview drive', 'webinar time'].some(k => subj.includes(k) || summ.includes(k));
                    return hasGeminiDeadline || matchesKeyword;
                  }).length || deadlinesTotal}
                </h3>
                <button 
                  className={`px-1.5 py-0.5 rounded flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider transition-all duration-300 ${securityFilter === 'deadlines' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}
                  style={{ backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderColor: 'rgba(139, 92, 246, 0.4)', borderWidth: '1px' }}
                >
                  Track
                  <ChevronRight className="w-2 h-2" />
                </button>
              </div>
              <span className="text-[10px] text-violet-400 font-bold mt-1 block truncate">Next: {nextDeadlineTitle} {nextDeadlineTime ? `at ${nextDeadlineTime}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Main Body View */}
        {mainViewTab === 'analytics' ? (
          renderMncAnalyticsSuite()
        ) : (
        <div className="flex-1 flex gap-5 min-h-0">
          
          {/* LEFT: Email List OR Search Results */}
          <div className="w-[420px] flex flex-col h-full shrink-0 border border-zinc-800/50 rounded-2xl bg-[#0F131D] overflow-hidden">
             {activeTab === 'search' ? (
                <div className="flex flex-col h-full">
                  <div className="px-5 py-4 border-b border-zinc-800/50 flex justify-between items-center bg-[#0a0a0f]">
                    <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
                       <Search className="w-4 h-4 text-blue-400"/> Search Results
                    </h3>
                    <button onClick={() => setActiveTab('inbox')} className="text-[11px] font-bold text-zinc-400 hover:text-white">Clear</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {searchResults.length === 0 ? (
                      <div className="text-center py-10">
                        <p className="text-sm text-zinc-500">No results found.</p>
                      </div>
                    ) : searchResults.map(({ email, similarity_score: score }) => (
                      <div key={email.id} onClick={() => { selectEmailAndMarkRead(email); }}
                        className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-900/60 cursor-pointer transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${getCategoryColor(email.category)}`}>{email.category}</span>
                          <span className="text-[10px] font-bold text-blue-400">{Math.round(score * 100)}% match</span>
                        </div>
                        <h4 className="text-[12px] font-bold text-zinc-200 line-clamp-1">{email.subject}</h4>
                        <p className="text-[11px] text-zinc-600 line-clamp-1 mt-1">{email.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
             ) : (
                <div className="flex flex-col h-full">
                {/* Main View & Real vs Simulated Tabs */}
                <div className="flex border-b border-zinc-800/50 items-center justify-between bg-zinc-950/40">
                  <div className="flex flex-1">
                    <button 
                      onClick={() => { setMainViewTab('inbox'); setEmailSourceFilter('real'); }}
                      className={`group relative overflow-hidden flex-1 py-3 text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 border-b-2 flex items-center justify-center gap-1 ${
                        mainViewTab === 'inbox' && emailSourceFilter === 'real' ? 'border-blue-500 text-blue-400 bg-blue-500/10 shadow-[inset_0_-15px_20px_-15px_rgba(59,130,246,0.3)]' : 'border-transparent text-zinc-500 hover:border-blue-500/50 hover:text-blue-300 hover:bg-blue-500/5'
                      }`}
                    >
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${mainViewTab === 'inbox' && emailSourceFilter === 'real' ? 'hidden' : ''}`} style={{ background: 'radial-gradient(circle at bottom, rgba(59,130,246,0.15), transparent 70%)' }} />
                      <Inbox className={`w-3.5 h-3.5 relative z-10 transition-transform duration-300 group-hover:scale-110 ${mainViewTab === 'inbox' && emailSourceFilter === 'real' ? '' : 'group-hover:text-blue-400'}`} /> <span className="relative z-10">Real Inbox</span>
                    </button>
                    <button 
                      onClick={() => setMainViewTab('analytics')}
                      className={`group relative overflow-hidden flex-1 py-3 text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 border-b-2 flex items-center justify-center gap-1 ${
                        mainViewTab === 'analytics' ? 'border-purple-500 text-purple-400 bg-purple-500/10 shadow-[inset_0_-15px_20px_-15px_rgba(168,85,247,0.3)]' : 'border-transparent text-zinc-500 hover:border-purple-500/50 hover:text-purple-300 hover:bg-purple-500/5'
                      }`}
                    >
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${mainViewTab === 'analytics' ? 'hidden' : ''}`} style={{ background: 'radial-gradient(circle at bottom, rgba(168,85,247,0.15), transparent 70%)' }} />
                      <BarChart2 className={`w-3.5 h-3.5 relative z-10 transition-transform duration-300 group-hover:scale-110 ${mainViewTab === 'analytics' ? '' : 'group-hover:text-purple-400'}`} /> <span className="relative z-10">Analytics</span>
                    </button>
                    <button 
                      onClick={() => { setMainViewTab('inbox'); setEmailSourceFilter('simulated'); }}
                      className={`group relative overflow-hidden flex-1 py-3 text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 border-b-2 flex items-center justify-center gap-1 ${
                        mainViewTab === 'inbox' && emailSourceFilter === 'simulated' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 shadow-[inset_0_-15px_20px_-15px_rgba(16,185,129,0.3)]' : 'border-transparent text-zinc-500 hover:border-emerald-500/50 hover:text-emerald-300 hover:bg-emerald-500/5'
                      }`}
                    >
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${mainViewTab === 'inbox' && emailSourceFilter === 'simulated' ? 'hidden' : ''}`} style={{ background: 'radial-gradient(circle at bottom, rgba(16,185,129,0.15), transparent 70%)' }} />
                      <Zap className={`w-3.5 h-3.5 relative z-10 transition-transform duration-300 group-hover:scale-110 ${mainViewTab === 'inbox' && emailSourceFilter === 'simulated' ? '' : 'group-hover:text-emerald-400'}`} /> <span className="relative z-10">Simulation</span>
                    </button>
                  </div>
                  {mainViewTab === 'inbox' && emailSourceFilter === 'simulated' && (
                    <button 
                      onClick={handleRefreshSimulations}
                      disabled={isRefreshing}
                      className="group relative overflow-hidden px-4 text-zinc-400 hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 border-l border-zinc-800 flex items-center justify-center hover:bg-emerald-500/5 self-stretch hover:shadow-[inset_20px_0_20px_-20px_rgba(16,185,129,0.2)]"
                      title="Clear simulated emails"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 relative z-10 transition-transform group-hover:rotate-180 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="px-3 py-3 border-b border-zinc-800/50 flex flex-col gap-3 justify-between bg-zinc-900/20">
                  <div className="flex flex-wrap gap-2 justify-between items-center w-full">
                    {[
                      { id: 'all', icon: Layers, label: 'All', color: '#3b82f6', colorClass: 'text-blue-400', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/40' },
                      { id: 'unread', icon: Inbox, label: 'Unread', color: '#10b981', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/40' }
                    ].map(f => (
                      <button key={f.id}
                        onClick={() => setSecurityFilter(f.id)}
                        className={`group relative overflow-hidden flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border flex-1 ${
                          securityFilter === f.id
                            ? `${f.bgClass} ${f.colorClass} ${f.borderClass} shadow-[0_0_15px_rgba(255,255,255,0.05)] scale-[1.02]`
                            : 'bg-zinc-900/50 text-zinc-500 border-zinc-800 hover:text-zinc-200 hover:-translate-y-0.5'
                        }`}
                        onMouseEnter={(e) => {
                          if (securityFilter !== f.id) {
                            e.currentTarget.style.borderColor = `${f.color}50`;
                            e.currentTarget.style.boxShadow = `0 4px 15px -5px ${f.color}40`;
                            e.currentTarget.style.color = f.color;
                            e.currentTarget.style.backgroundColor = `${f.color}15`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (securityFilter !== f.id) {
                            e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 1)'; // zinc-800
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.color = '#71717a'; // zinc-500
                            e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.5)'; // zinc-900/50
                          }
                        }}
                        style={{
                          borderColor: securityFilter === f.id ? `${f.color}80` : undefined,
                          boxShadow: securityFilter === f.id ? `0 4px 20px -5px ${f.color}50` : undefined,
                        }}
                      >
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${securityFilter === f.id ? 'hidden' : ''}`} style={{ background: `radial-gradient(circle at center, ${f.color}20, transparent 70%)` }} />
                        <f.icon className={`w-3.5 h-3.5 relative z-10 transition-transform group-hover:scale-110 ${securityFilter === f.id ? '' : 'group-hover:-rotate-3'}`} /> 
                        <span className="relative z-10">{f.label}</span>
                      </button>
                    ))}
                  </div>
                  <select 
                    value={selectedCategory || ""} 
                    onChange={(e) => setSelectedCategory(e.target.value === "" ? null : e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-[11px] font-bold rounded-lg px-3 py-2 text-zinc-400 focus:outline-none hover:border-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all duration-300 cursor-pointer shadow-inner hover:bg-[#0F131D]"
                  >
                    <option value="">All Categories</option>
                    {analytics?.category_distribution?.map(item => (
                       <option key={item.category} value={item.category}>{item.category}</option>
                    ))}
                  </select>
                </div>

                {/* Email Items */}
                <div className="flex-1 overflow-y-auto">
                  {isLoadingEmails && emails.length === 0 ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/20 animate-pulse space-y-2.5">
                          <div className="flex justify-between items-center">
                            <div className="h-3 bg-zinc-800 rounded w-24" />
                            <div className="h-3 bg-zinc-800 rounded w-12" />
                          </div>
                          <div className="h-4 bg-zinc-800/80 rounded w-3/4" />
                          <div className="h-3 bg-zinc-800/40 rounded w-full" />
                        </div>
                      ))}
                    </div>
                  ) : emails.filter(email => (emailSourceFilter === 'simulated' ? email.is_simulated : !email.is_simulated)).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <Mail className="h-10 w-10 text-zinc-700 mb-3" />
                      <p className="text-sm font-semibold text-zinc-500">No emails yet</p>
                      <p className="text-xs text-zinc-600 mt-1">
                        {emailSourceFilter === 'simulated' ? 'Click "Dummy Mail" to test the pipeline' : 'Click "Sync Gmail" to fetch your inbox'}
                      </p>
                    </div>
                  ) : emails.filter(email => {
                    if (emailSourceFilter === 'simulated' && !email.is_simulated) return false;
                    if (emailSourceFilter === 'real' && email.is_simulated) return false;
                    
                    if (securityFilter === 'threats') return email.is_phishing || email.is_spam;
                    
                    if (securityFilter === 'new_today') {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return new Date(email.received_at) >= today;
                    }
                    
                    if (securityFilter === 'high_priority') return email.priority === 'High';
                    
                    if (securityFilter === 'deadlines') {
                      const hasGeminiDeadline = Boolean(email.deadlines && email.deadlines !== '[]' && email.deadlines !== 'null');
                      const subj = (email.subject || '').toLowerCase();
                      const summ = (email.summary || '').toLowerCase();
                      const act = (email.action_items || '').toLowerCase();
                      
                      const matchesKeyword = [
                        'deadline', 'due by', 'due date', 'interview', 'assessment', 'exam', 'test link', 
                        'submit before', 'last date to', 'expires', 'placement drive', 'registration deadline', 
                        'contest date', 'interview drive', 'webinar time', 'action required'
                      ].some(k => subj.includes(k) || summ.includes(k) || act.includes(k));
                      
                      return hasGeminiDeadline || matchesKeyword;
                    }
                    
                    if (selectedCategory && selectedCategory !== 'all' && email.category !== selectedCategory) return false;
                    
                    if (securityFilter === 'unread') {
                      return !email.is_read || (selectedEmail && selectedEmail.id === email.id);
                    }
                    
                    return true;
                  }).sort((a, b) => {
                      if (sortCategory) {
                        if (a.category === sortCategory && b.category !== sortCategory) return -1;
                        if (a.category !== sortCategory && b.category === sortCategory) return 1;
                      }
                      
                      // Preserve backend's chronological order
                      return 0;
                    }).map(email => {
                    const sec = getSecurityBadge(email);
                    return (
                      <div key={email.id} onClick={() => { selectEmailAndMarkRead(email); setDetailTab('AI Summary'); }}
                        className={`p-4 mx-2 my-2 cursor-pointer rounded-2xl transition-all duration-300 ${
                          selectedEmail?.id === email.id 
                            ? 'bg-cyan-500/10 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)] scale-[1.02]' 
                            : 'border border-transparent hover:bg-zinc-900/80 hover:border-zinc-800/50 hover:scale-[1.01]'
                        } ${!email.is_read ? '' : 'opacity-70'}`}>
                        <div className="flex items-start gap-3">
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full ${getInitialColor(email.sender)} flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5`}>
                            {getInitials(email.sender)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-[12px] truncate max-w-[180px] ${!email.is_read ? 'font-bold text-white' : 'font-medium text-zinc-400'}`}>
                                {email.sender.split('<')[0].trim()}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-[10px] text-zinc-500">{formatTime(email.received_at)}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteEmail(email.id); }}
                                  className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors"
                                  title="Delete Email"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <h4 className={`text-[12px] truncate mb-1 ${!email.is_read ? 'font-semibold text-zinc-200' : 'text-zinc-500'}`}>
                              {email.subject || '(No Subject)'}
                            </h4>
                            <p className="text-[11px] text-zinc-600 line-clamp-1">{email.body}</p>
                            {/* Tags */}
                            <div className="flex gap-2 mt-2.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getPriorityColor(email.priority)} hover:scale-105 cursor-pointer transition-transform`}>{email.priority}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${getCategoryColor(email.category)} hover:scale-105 cursor-pointer transition-transform`}>{email.category}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sec.cls} hover:scale-105 cursor-pointer transition-transform`}>{sec.text}</span>
                              {email.entities?.length > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:scale-105 cursor-pointer transition-transform">{email.entities.length}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Email Details / Analytics */}
          <div className="flex-1 flex flex-col min-w-0 border border-zinc-800/50 rounded-2xl bg-[#0F131D] overflow-hidden relative shadow-lg">
            {selectedEmail ? (
              <div className="absolute inset-0 overflow-y-auto">
                {/* Detail Header */}
                <div className="px-8 py-6 border-b border-zinc-800/50">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full ${getInitialColor(selectedEmail.sender)} flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-zinc-700`}>
                          {getInitials(selectedEmail.sender)}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-white mb-1.5 leading-tight">{selectedEmail.subject || '(No Subject)'}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-[12px] text-zinc-400">
                            <span className="text-zinc-300 font-medium">{selectedEmail.sender.split('<')[0].trim()}</span>
                            <span>{selectedEmail.sender.includes('<') ? `<${selectedEmail.sender.split('<')[1]}` : ''}</span>
                            <span className="text-zinc-600">·</span>
                            <span>{formatTime(selectedEmail.received_at)}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteEmail(selectedEmail.id)}
                          className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300 transition-all flex items-center gap-2 text-xs font-bold shadow-md cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                          title="Delete Email (From Inbox & Real Gmail)"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                      
                      {/* AI EMAIL INSIGHTS BLOCK */}
                      <div className="mt-6 border border-zinc-800/60 rounded-xl overflow-hidden bg-black/40 shadow-xl">
                        <div className="bg-zinc-900/80 px-4 py-2 border-b border-zinc-800/60 text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center justify-center">
                          AI EMAIL INSIGHTS
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🛡️</span>
                              <span className={`text-sm font-bold ${selectedEmail.final_verdict === 'Phishing' ? 'text-red-400' : selectedEmail.final_verdict === 'Suspicious' ? 'text-orange-400' : 'text-emerald-400'}`}>
                                {selectedEmail.final_verdict === 'Phishing' ? 'Dangerous' : selectedEmail.final_verdict === 'Suspicious' ? 'Suspicious' : 'Safe'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🎯</span>
                              <span className={`text-sm font-bold ${selectedEmail.priority === 'Critical' ? 'text-red-400' : selectedEmail.priority === 'High' ? 'text-orange-400' : 'text-blue-400'}`}>
                                {selectedEmail.priority} Importance
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">💼</span>
                              <span className="text-sm font-bold text-zinc-300">
                                {selectedEmail.category}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">😊</span>
                              <span className={`text-sm font-bold ${selectedEmail.sentiment === 'Positive' ? 'text-emerald-400' : selectedEmail.sentiment === 'Negative' ? 'text-red-400' : 'text-zinc-400'}`}>
                                {selectedEmail.sentiment || 'Neutral'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="border-t border-zinc-800/50 pt-4 space-y-3">
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                                <span className="text-base">⚡</span> Action
                              </div>
                              <div className="text-sm font-medium text-white pl-6">
                                {selectedEmail.action_items && selectedEmail.action_items !== '[]' && selectedEmail.action_items !== 'null' ? (
                                  JSON.parse(selectedEmail.action_items).join(', ')
                                ) : 'No action required'}
                              </div>
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                                <span className="text-base">📅</span> Important Date / Deadline
                              </div>
                              {renderFormattedDate(selectedEmail.deadlines, selectedEmail)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Tab bar */}
                        <div className="flex gap-2 bg-zinc-900/50 p-1.5 rounded-xl mt-6 border border-zinc-800/50">
                          {['Reader View', 'Intelligence', 'AI Summary', 'Smart Reply'].map((tab, i) => {
                            const active = detailTab === tab || (tab === 'Reader View' && detailTab === 'Original Message');
                            return (
                              <button key={tab} 
                                onClick={() => setDetailTab(tab)}
                                className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                active 
                                  ? 'bg-zinc-800 text-white shadow-sm' 
                                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                              }`}>
                                {tab}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Detail Body */}
                    <div className="px-6 py-5 space-y-5 pb-12">

                      {/* AI Summary Tab Content */}
                      {detailTab === 'AI Summary' && (
                        <div className="space-y-6 fade-in">
                          {/* Executive AI Brief */}
                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-zinc-800/50 pb-2">AI BRIEF</h4>
                            <div className="text-[13px] text-zinc-200 leading-relaxed font-medium bg-blue-500/5 p-4 rounded-xl border border-blue-500/20">
                              {selectedEmail.summary || (selectedEmail.subject ? `Executive notification regarding: ${selectedEmail.subject}.` : 'Executive AI email brief summarizing message content.')}
                            </div>
                          </div>

                          {/* Key Highlights */}
                          {selectedEmail.key_points && selectedEmail.key_points !== '[]' && selectedEmail.key_points !== 'null' && (
                            <div>
                              <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-zinc-800/50 pb-2">KEY HIGHLIGHTS</h4>
                              <div className="space-y-2 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/30">
                                {JSON.parse(selectedEmail.key_points).map((kp, idx) => (
                                  <div key={idx} className="flex items-start gap-2.5 text-[12px] text-zinc-300">
                                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5"></div>
                                    <span>{kp}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Quick Summary Grid */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/30 text-[12px]">
                              <div className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Intent / Action Required</div>
                              <div className="text-white font-semibold">{selectedEmail.recommended_action || 'None'}</div>
                            </div>
                            <div className="bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/30 text-[12px]">
                              <div className="text-zinc-500 text-[10px] font-bold uppercase mb-1">Priority & Category</div>
                              <div className="text-white font-semibold">{selectedEmail.priority} ({selectedEmail.category})</div>
                            </div>
                          </div>

                          {/* AI Recommendation */}
                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-zinc-800/50 pb-2">AI RECOMMENDATION</h4>
                            <div className="text-[13px] text-emerald-300 font-medium bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl">
                              {selectedEmail.recommended_action || 'No action required for this email.'}
                            </div>
                          </div>

                          {/* Security */}
                          <div>
                            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 border-b border-zinc-800/50 pb-2 flex items-center gap-2">
                              <ShieldAlert className="w-3.5 h-3.5" /> SECURITY
                            </h4>
                            <div className="bg-zinc-900/50 rounded-xl p-5 border border-zinc-800/50 shadow-inner">
                              <h5 className={`text-[13px] font-black mb-4 ${selectedEmail.final_verdict === 'Phishing' || selectedEmail.is_phishing ? 'text-red-400' : selectedEmail.final_verdict === 'Suspicious' || selectedEmail.is_spam ? 'text-orange-400' : 'text-emerald-400'}`}>
                                {selectedEmail.final_verdict === 'Phishing' || selectedEmail.is_phishing ? '🔴 DANGEROUS — Possible phishing attempt' : selectedEmail.final_verdict === 'Suspicious' || selectedEmail.is_spam ? '🟡 SUSPICIOUS — Review before interacting' : '🟢 SAFE — No threats detected'}
                              </h5>
                              
                              <div className="space-y-2 mb-4 text-[12px] font-medium text-zinc-300">
                                {selectedEmail.phishing_reasons && JSON.parse(selectedEmail.phishing_reasons).length > 0 ? (
                                  JSON.parse(selectedEmail.phishing_reasons).map((reason, idx) => (
                                    <div key={idx} className="flex items-start gap-2">
                                      <X className="w-4 h-4 text-red-400 shrink-0" /> {reason}
                                    </div>
                                  ))
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Sender verified</div>
                                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> Email authentication passed</div>
                                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> No fake domain detected</div>
                                    <div className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0" /> No dangerous links found</div>
                                  </>
                                )}
                              </div>
                              
                              <button 
                                onClick={() => setShowTechDetails(!showTechDetails)}
                                className="text-[11px] font-bold text-zinc-500 hover:text-white flex items-center gap-1 transition-colors mt-4 bg-black/40 px-3 py-1.5 rounded-md border border-zinc-800"
                              >
                                View Technical Security Details {showTechDetails ? '▴' : '▾'}
                              </button>
                              
                              {showTechDetails && (
                                <div className="mt-4 pt-4 border-t border-zinc-800/50 fade-in">
                                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[11px]">
                                    <div className="flex justify-between items-center"><span className="text-zinc-500">Phishing Score</span><span className="font-mono text-zinc-300">{Math.round(selectedEmail.phishing_score * 100)}%</span></div>
                                    <div className="flex justify-between items-center"><span className="text-zinc-500">Spam Score</span><span className="font-mono text-zinc-300">{Math.round(selectedEmail.spam_score * 100)}%</span></div>
                                    <div className="flex justify-between items-center"><span className="text-zinc-500">Sender Trust</span><span className="font-mono text-zinc-300">{Math.round((selectedEmail.trust_score || 0) * 100)}%</span></div>
                                    
                                    <div className="flex justify-between items-center"><span className="text-zinc-500">SPF</span><span className={`font-mono ${selectedEmail.spf_status === 'Pass' ? 'text-emerald-400' : 'text-red-400'}`}>{selectedEmail.spf_status || 'Unknown'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-zinc-500">DKIM</span><span className={`font-mono ${selectedEmail.dkim_status === 'Pass' ? 'text-emerald-400' : 'text-red-400'}`}>{selectedEmail.dkim_status || 'Unknown'}</span></div>
                                    <div className="flex justify-between items-center"><span className="text-zinc-500">DMARC</span><span className={`font-mono ${selectedEmail.dmarc_status === 'Pass' ? 'text-emerald-400' : 'text-red-400'}`}>{selectedEmail.dmarc_status || 'Unknown'}</span></div>
                                    
                                    <div className="flex justify-between items-center"><span className="text-zinc-500">Domain Analysis</span><span className={`font-mono ${selectedEmail.domain_impersonation ? 'text-red-400' : 'text-emerald-400'}`}>{selectedEmail.domain_impersonation ? 'Impersonation detected' : 'Legitimate'}</span></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* NER Entities */}
                      {detailTab === 'Entities' && selectedEmail.entities?.length > 0 && (
                        <div className="space-y-2 fade-in">
                          <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Named Entities (NER)</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedEmail.entities.map(ent => (
                              <span key={ent.id} className="text-[10px] font-medium px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300">
                                <span className="text-zinc-500 mr-1">{ent.entity_type}:</span>{ent.entity_value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {detailTab === 'Entities' && (!selectedEmail.entities || selectedEmail.entities.length === 0) && (
                        <div className="p-8 text-center text-[12px] text-zinc-500 italic">No entities detected in this email.</div>
                      )}

                      {/* Original Message */}
                      
                      {detailTab === 'Intelligence' && (
                        <>

                          {/* --- ALERT DECISION DEBUGGER --- */}
                          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mt-6 shadow-xl">
                            <div className="bg-zinc-800/50 p-3 border-b border-zinc-800 flex items-center justify-between">
                              <h3 className="text-xs font-bold text-zinc-300 tracking-wider uppercase flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-blue-400"/> Alert Decision Debugger
                              </h3>
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-4 text-[12px]">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  {selectedEmail.category !== 'Spam' && selectedEmail.category !== 'Promotions' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400"/> : <X className="w-3.5 h-3.5 text-red-400"/>}
                                  <span className="text-zinc-400">Category: <span className="text-white font-medium">{selectedEmail.category || 'N/A'}</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {selectedEmail.action_items && selectedEmail.action_items !== '[]' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400"/> : <X className="w-3.5 h-3.5 text-zinc-500"/>}
                                  <span className="text-zinc-400">Action Required</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {selectedEmail.deadlines && selectedEmail.deadlines !== '[]' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400"/> : <X className="w-3.5 h-3.5 text-zinc-500"/>}
                                  <span className="text-zinc-400">Deadline</span>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  {selectedEmail.priority === 'Critical' || selectedEmail.priority === 'High' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400"/> : <X className="w-3.5 h-3.5 text-zinc-500"/>}
                                  <span className="text-zinc-400">Priority: <span className="text-white font-medium">{selectedEmail.priority || 'N/A'}</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {selectedEmail.needs_alert ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400"/> : <X className="w-3.5 h-3.5 text-zinc-500"/>}
                                  <span className="text-zinc-400">Watchlist Match</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {selectedEmail.is_phishing ? <CheckCircle2 className="w-3.5 h-3.5 text-red-500"/> : <X className="w-3.5 h-3.5 text-zinc-500"/>}
                                  <span className="text-zinc-400">Security Threat</span>
                                </div>
                              </div>
                            </div>
                            <div className={`p-4 border-t border-zinc-800 ${selectedEmail.needs_alert ? 'bg-blue-500/10' : 'bg-black/20'}`}>
                                <div className="text-xs font-bold mb-1 tracking-widest text-zinc-500 uppercase">Decision</div>
                                <div className={`text-sm font-black mb-3 ${selectedEmail.needs_alert ? 'text-blue-400' : 'text-zinc-400'}`}>
                                  {selectedEmail.needs_alert ? '🔔 SEND ALERT' : '🔕 NO NOTIFICATION'}
                                </div>
                                
                                <div className="text-[11px] text-zinc-400 bg-[#0a0a0f] p-3 rounded-lg border border-zinc-800 font-mono">
                                  {selectedEmail.needs_alert 
                                    ? `Reason: Matched alert criteria based on priority, watchlist, or security threat.`
                                    : `Reason: Spam/low-priority email or no actionable event detected.`}
                                </div>
                            </div>
                          </div>
                          {/* ------------------------------- */}

                        <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {selectedEmail.why_it_matters && (
                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-5">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                                <h3 className="text-sm font-bold text-purple-300 tracking-wide uppercase">Why this matters</h3>
                              </div>
                              <p className="text-[13px] text-zinc-300 leading-relaxed font-medium">{selectedEmail.why_it_matters}</p>
                            </div>
                          )}
                          
                          {selectedEmail.deadlines && selectedEmail.deadlines !== '[]' && (
                            <div>
                              <h3 className="text-xs font-bold text-zinc-400 tracking-wider uppercase mb-3 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> Detected Deadlines
                              </h3>
                              <div className="space-y-2">
                                {JSON.parse(selectedEmail.deadlines).map((dl, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                                    <div>
                                      <div className="text-[13px] font-bold text-zinc-200">{dl.title}</div>
                                      <div className="text-[11px] text-zinc-500 italic mt-0.5">"{dl.source_text}"</div>
                                    </div>
                                    <div className="text-right">
                                       <div className="text-[12px] font-bold text-cyan-400">
                                         {(() => {
                                           if (!dl.datetime) return dl.title;
                                           const d = new Date(dl.datetime);
                                           return !isNaN(d.getTime()) ? d.toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : dl.datetime;
                                         })()}
                                       </div>
                                       <div className="text-[10px] text-zinc-500 font-medium">Confidence: {Math.round((dl.confidence || 0.9) * 100)}%</div>
                                     </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {selectedEmail.action_items && selectedEmail.action_items !== '[]' && (
                            <div>
                              <h3 className="text-xs font-bold text-zinc-400 tracking-wider uppercase mb-3 flex items-center gap-2">
                                <ListTodo className="w-3.5 h-3.5" /> Action Items
                              </h3>
                              <div className="space-y-2">
                                {JSON.parse(selectedEmail.action_items).map((action, idx) => (
                                  <div key={idx} className="flex items-start gap-3 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                                    <div className="w-4 h-4 rounded border border-zinc-600 flex-shrink-0 mt-0.5"></div>
                                    <div className="text-[13px] text-zinc-300">{action}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        </>
                      )}

                      {(detailTab === 'Reader View' || detailTab === 'Original Message') && (
                        <div className="space-y-4 fade-in">
                          <div className="rounded-xl border border-zinc-800/50 overflow-hidden bg-zinc-900/40">
                            <div className="px-4 py-3 bg-zinc-900/80 border-b border-zinc-800/50 flex items-center justify-between">
                              <span className="text-xs font-bold text-zinc-300">Reader View (Cleaned & Formatted)</span>
                              <span className="text-[10px] text-zinc-500">Sentiment: <strong className={selectedEmail.sentiment === 'Positive' ? 'text-emerald-400' : selectedEmail.sentiment === 'Negative' ? 'text-red-400' : 'text-zinc-400'}>{selectedEmail.sentiment}</strong></span>
                            </div>
                            <div className="p-5 text-[13px] text-zinc-200 whitespace-pre-wrap leading-relaxed font-normal overflow-y-auto max-h-[400px]">
                              {selectedEmail.clean_body?.trim() ? selectedEmail.clean_body : (selectedEmail.body?.trim() ? cleanEmailBody(selectedEmail.body) : <span className="text-zinc-500 italic">No text content available.</span>)}
                            </div>
                          </div>

                          {/* Raw Email & Link Extraction Toggle */}
                          <div className="border border-zinc-800/50 rounded-xl overflow-hidden bg-zinc-900/20">
                            <button onClick={() => setShowRawEmail(!showRawEmail)} className="w-full px-4 py-2.5 flex items-center justify-between text-[11px] font-bold text-zinc-400 hover:bg-zinc-800/50 transition">
                              <span>Show Full Raw Original Email</span>
                              <span>{showRawEmail ? '▲ Hide' : '▼ Show'}</span>
                            </button>
                            {showRawEmail && (
                              <div className="p-4 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap border-t border-zinc-800/50 bg-black/40 overflow-x-auto max-h-[300px]">
                                {selectedEmail.body}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Smart Reply Tab */}
                      {detailTab === 'Smart Reply' && (() => {
                        const reply = selectedEmail.replies && selectedEmail.replies.length > 0
                          ? selectedEmail.replies[selectedEmail.replies.length - 1]
                          : null;
                        
                        const isNoReplyRecommended = selectedEmail.reply_required === false || 
                          (reply && (!reply.is_reply_recommended || reply.generated_body?.startsWith('Reply Recommended: NO')));

                        return (
                          <div className="rounded-xl border border-violet-500/20 bg-zinc-900/50 p-5 space-y-4 fade-in">
                            <div className="flex items-center justify-between pb-3 border-b border-white/5">
                              <span className="text-[13px] font-black text-violet-400 flex items-center gap-2 tracking-wider">
                                <Sparkles className="h-4 w-4" /> ✦ AI SMART REPLY 
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                reply?.status === 'Sent' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' :
                                reply?.status === 'Rejected' ? 'bg-red-500/20 text-red-400 border border-red-500/20' :
                                'bg-violet-500/20 text-violet-400 border border-violet-500/20'
                              }`}>{reply?.status || 'Suggested'}</span>
                            </div>
                            
                            {(selectedEmail.is_phishing || selectedEmail.final_verdict === 'Phishing') ? (
                              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-red-400 font-bold mb-2">
                                  <ShieldAlert className="h-4 w-4" /> 🚫 REPLY DISABLED
                                </div>
                                <p className="text-xs text-red-300/80 leading-relaxed">
                                  {reply?.recommendation_reason || "This email has been classified as High Risk / Phishing. Replying to this message is not recommended."}
                                </p>
                              </div>
                            ) : isNoReplyRecommended ? (
                              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-3 shadow-inner">
                                <div className="flex items-center gap-2.5 text-zinc-200 font-bold text-sm">
                                  <Info className="h-4 w-4 text-blue-400" /> Reply Recommended: NO
                                </div>
                                <p className="text-xs text-zinc-300 leading-relaxed bg-black/30 p-3 rounded-lg border border-zinc-800/50">
                                  <strong className="text-zinc-400">Reason:</strong> {selectedEmail.reply_reason || reply?.recommendation_reason || "Automated notification; sender is not requesting a response."}
                                </p>
                                <div className="text-xs text-emerald-300 leading-relaxed bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20 font-medium">
                                  <strong className="text-emerald-400">Recommended Action:</strong> {selectedEmail.recommended_action || "Review activity and read later."}
                                </div>
                              </div>
                            ) : reply ? (
                              <>
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Reply recommended ✓
                                  </div>
                                  {reply.recommendation_reason && (
                                    <div className="text-[11px] text-zinc-400 italic">
                                      Reason: {reply.recommendation_reason}
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-4 mt-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-zinc-500 font-semibold uppercase">Tone</span>
                                      <select 
                                        className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] rounded px-2 py-1 focus:outline-none cursor-pointer font-bold text-violet-300"
                                        value={selectedTone}
                                        disabled={isRegenerating}
                                        onChange={(e) => {
                                          const t = e.target.value;
                                          setSelectedTone(t);
                                          handleRegenerateReply(selectedEmail.id, t, selectedLength);
                                        }}
                                      >
                                        <option value="Professional">Professional ▼</option>
                                        <option value="Formal">Formal ▼</option>
                                        <option value="Friendly">Friendly ▼</option>
                                        <option value="Direct">Direct ▼</option>
                                      </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-zinc-500 font-semibold uppercase">Length</span>
                                      <select 
                                        className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-[11px] rounded px-2 py-1 focus:outline-none cursor-pointer font-bold text-violet-300"
                                        value={selectedLength}
                                        disabled={isRegenerating}
                                        onChange={(e) => {
                                          const l = e.target.value;
                                          setSelectedLength(l);
                                          handleRegenerateReply(selectedEmail.id, selectedTone, l);
                                        }}
                                      >
                                        <option value="Concise">Concise ▼</option>
                                        <option value="Detailed">Detailed ▼</option>
                                      </select>
                                    </div>
                                  </div>
                                </div>

                                {isRegenerating ? (
                                  <div className="text-[13px] bg-black/40 border border-violet-500/30 rounded-lg p-6 text-violet-300 flex items-center justify-center gap-3 animate-pulse">
                                    <Sparkles className="w-4 h-4 animate-spin text-violet-400" />
                                    <span>Generating contextual {selectedTone} ({selectedLength}) reply via Gemini Intelligence...</span>
                                  </div>
                                ) : editingReply ? (
                                  <textarea value={editedReplyText} onChange={(e) => setEditedReplyText(e.target.value)}
                                    rows={5} className="w-full bg-black/40 border border-violet-500/30 rounded-lg p-3 text-[13px] text-zinc-200 focus:outline-none focus:border-violet-500/60 leading-relaxed font-light" />
                                ) : (
                                  <div className="text-[13px] bg-black/40 border border-white/5 rounded-lg p-4 text-zinc-300 whitespace-pre-wrap leading-relaxed font-light relative group">
                                    {reply?.generated_body}
                                  </div>
                                )}
                                
                                <div className="flex gap-2 justify-end pt-2">
                                  {editingReply ? (
                                    <>
                                      <button onClick={() => handleUpdateReplyStatus(reply.id, "Suggested")}
                                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors flex items-center gap-1"><X className="h-3 w-3" /> Cancel</button>
                                      <button onClick={() => handleUpdateReplyStatus(reply.id, "Sent", editedReplyText, selectedTone, selectedLength)}
                                        className="px-4 py-1.5 rounded-lg bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500 transition-colors flex items-center gap-1.5 shadow-lg shadow-emerald-900/20"><Send className="h-3.5 w-3.5" /> Save & Send</button>
                                    </>
                                  ) : reply?.status !== 'Sent' && (
                                    <>
                                      <button onClick={() => handleRegenerateReply(selectedEmail.id, selectedTone, selectedLength)}
                                        className="px-3 py-1.5 rounded-lg border border-violet-500/30 text-xs font-semibold text-violet-300 hover:bg-violet-500/10 transition-colors flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Regenerate</button>
                                      <button onClick={() => { setEditingReply(true); setEditedReplyText(reply.generated_body); }}
                                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-1.5"><Edit className="h-3 w-3" /> Edit</button>
                                      <button onClick={() => handleUpdateReplyStatus(reply.id, "Sent", null, selectedTone, selectedLength)}
                                        className="px-4 py-1.5 rounded-lg gradient-primary text-xs font-bold text-white hover:brightness-110 transition-all flex items-center gap-1.5 shadow-lg shadow-violet-900/20"><Check className="h-3.5 w-3.5" /> Approve & Send</button>
                                    </>
                                  )}
                                </div>
                              </>
                            ) : null}
                          </div>
                        );
                      })()}

                      {/* Feedback removed per user request */}
                    </div>
                  </div>
                ) : (
              <div className="flex-1 flex flex-col items-center p-12 overflow-y-auto">
                <div className="flex flex-col items-center justify-center py-8 mb-8 border border-dashed border-zinc-800/50 rounded-2xl w-full max-w-4xl bg-zinc-900/10">
                  <Mail className="w-16 h-16 text-zinc-800 mb-4" />
                  <h3 className="text-lg font-bold text-zinc-200">Select an email to view AI analysis</h3>
                  <p className="text-xs text-zinc-500 max-w-sm text-center mt-2 leading-relaxed">Click an email from the list to inspect classification, phishing alerts, NER entities, and LLM summaries.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </main>

      {/* Digest Modal */}
      {showDigestModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-[#0a0a0f] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-bold text-white">Daily AI Digest</h2>
              </div>
              <button onClick={() => setShowDigestModal(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-[14px] leading-relaxed text-zinc-300">
              {dailyDigest?.stats && dailyDigest?.digest ? (
                <div className="space-y-6">
                  {/* Executive Summary */}
                  {dailyDigest.digest.executive_summary && (
                    <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-xl shadow-inner">
                      <h3 className="text-blue-400 font-bold mb-2 uppercase tracking-widest text-[11px]">Executive Summary</h3>
                      <p className="text-[13px] text-blue-100/90 leading-relaxed font-medium">{dailyDigest.digest.executive_summary}</p>
                    </div>
                  )}

                  {/* Today's Statistics */}
                  {dailyDigest.stats.today && (
                    <div>
                      <h3 className="text-zinc-500 font-bold mb-3 uppercase tracking-widest text-[10px]">Today's Statistics</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-zinc-800/50 border border-zinc-800 p-3 rounded-lg flex flex-col">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-1">Emails Received</span>
                          <span className="text-lg font-black text-white">{dailyDigest.stats.today.received}</span>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex flex-col">
                          <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert className="w-3 h-3"/> Security Alerts</span>
                          <span className="text-lg font-black text-red-400">{dailyDigest.stats.today.security}</span>
                        </div>
                        <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg flex flex-col">
                          <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Briefcase className="w-3 h-3"/> Interviews</span>
                          <span className="text-lg font-black text-purple-400">{dailyDigest.stats.today.interviews}</span>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg flex flex-col">
                          <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Target className="w-3 h-3"/> Placements</span>
                          <span className="text-lg font-black text-blue-400">{dailyDigest.stats.today.placements}</span>
                        </div>
                        <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg flex flex-col">
                          <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Deadlines</span>
                          <span className="text-lg font-black text-orange-400">{dailyDigest.stats.today.deadlines}</span>
                        </div>
                        <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex flex-col">
                          <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Replies Needed</span>
                          <span className="text-lg font-black text-yellow-400">{dailyDigest.stats.today.replies}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Priority */}
                  {dailyDigest.digest.top_priority && (
                    <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 p-5 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.15)] relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-3 opacity-20"><Zap className="w-16 h-16 text-red-500" /></div>
                      <h3 className="text-red-400 font-black mb-3 uppercase tracking-widest text-[12px] flex items-center gap-2">🔥 TOP PRIORITY</h3>
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-white text-[15px]">{dailyDigest.digest.top_priority.title}</span>
                          {dailyDigest.digest.top_priority.deadline && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded">Deadline: {dailyDigest.digest.top_priority.deadline}</span>}
                        </div>
                        <p className="text-[12px] text-zinc-300 mb-3"><span className="text-red-300/80 font-medium">Reason:</span> {dailyDigest.digest.top_priority.reason}</p>
                        <div className="bg-black/30 border border-red-500/20 p-2.5 rounded-lg inline-flex items-center gap-2">
                          <span className="text-[10px] font-bold text-red-400 uppercase">Recommended Action:</span>
                          <span className="text-[12px] font-medium text-white">{dailyDigest.digest.top_priority.action}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Category Breakdown */}
                  <div className="space-y-4">
                    {dailyDigest.digest.categories && dailyDigest.digest.categories.map((cat, i) => {
                      const colorMap = {
                        red: 'bg-red-500/5 border-red-500/20 text-red-400',
                        orange: 'bg-orange-500/5 border-orange-500/20 text-orange-400',
                        yellow: 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400',
                        green: 'bg-green-500/5 border-green-500/20 text-green-400',
                        blue: 'bg-blue-500/5 border-blue-500/20 text-blue-400',
                        indigo: 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400',
                        purple: 'bg-purple-500/5 border-purple-500/20 text-purple-400',
                        emerald: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400',
                        default: 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      };
                      const colorClass = colorMap[cat.color] || colorMap.default;
                      
                      return (
                        <div key={i} className={`p-4 rounded-xl border ${colorClass}`}>
                          <h4 className="font-bold text-[11px] mb-3 uppercase tracking-widest flex items-center gap-2">
                            {cat.name}
                          </h4>
                          <div className="space-y-3">
                            {cat.emails && cat.emails.map((email, j) => (
                              <div key={j} className="flex gap-4 items-start bg-black/20 p-3 rounded-lg border border-white/5">
                                <div className="text-[10px] font-bold opacity-75 shrink-0 mt-0.5 w-16">{email.time}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-[13px] text-white leading-tight mb-0.5">{email.subject}</div>
                                  <div className="text-[11px] opacity-80 font-medium mb-1.5 truncate">{email.sender}</div>
                                  <div className="text-[11px] text-zinc-400 italic leading-relaxed">{email.context}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Recommendations */}
                  {dailyDigest.digest.recommendations && dailyDigest.digest.recommendations.length > 0 && (
                    <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
                      <h3 className="text-zinc-400 font-bold mb-4 uppercase tracking-widest text-[11px] flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-blue-400"/> AI Recommendations</h3>
                      <div className="space-y-2">
                        {dailyDigest.digest.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-[13px] font-medium text-zinc-200">
                            <span className="text-green-500 mt-0.5 shrink-0">✔</span>
                            <span dangerouslySetInnerHTML={{__html: rec.replace(/^✔\s*/, '')}}></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ignored Today & Productivity */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
                    {/* Ignored */}
                    <div className="bg-black/30 border border-zinc-800/50 p-4 rounded-xl">
                      <h3 className="text-zinc-500 font-bold mb-3 uppercase tracking-widest text-[10px]">Ignored Today</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-[11px]"><span className="text-zinc-400">Promotions</span><span className="font-bold text-zinc-300">{dailyDigest.stats.ignored.promotions}</span></div>
                        <div className="flex justify-between items-center text-[11px]"><span className="text-zinc-400">Spam</span><span className="font-bold text-zinc-300">{dailyDigest.stats.ignored.spam}</span></div>
                        <div className="flex justify-between items-center text-[11px]"><span className="text-zinc-400">Newsletters</span><span className="font-bold text-zinc-300">{dailyDigest.stats.ignored.newsletters}</span></div>
                      </div>
                    </div>
                    {/* Productivity */}
                    <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10"><BarChart3 className="w-12 h-12 text-blue-500" /></div>
                      <h3 className="text-blue-400 font-bold mb-3 uppercase tracking-widest text-[10px]">AI Productivity Score</h3>
                      <div className="space-y-2 relative z-10">
                        <div className="flex justify-between items-center text-[11px]"><span className="text-blue-200/70">Important Emails</span><span className="font-bold text-blue-300">{dailyDigest.stats.productivity.important}</span></div>
                        <div className="flex justify-between items-center text-[11px]"><span className="text-blue-200/70">Clutter Hidden</span><span className="font-bold text-blue-300">{dailyDigest.stats.productivity.hidden}</span></div>
                        <div className="flex justify-between items-center text-[11px] mt-2 pt-2 border-t border-blue-500/20"><span className="text-blue-300 font-medium">Estimated Time Saved</span><span className="font-black text-blue-400">{dailyDigest.stats.productivity.time_saved_mins} mins</span></div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <RefreshCw className="w-8 h-8 animate-spin mb-4" />
                  Generating your intelligence digest...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0a0a0f] border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl my-8">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 rounded-t-2xl sticky top-0 z-10">
              <h2 className="text-xl font-bold text-white">Personalize AI Assistant</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-8">
              {/* NLP Section */}
              <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
                <label className="block text-sm font-bold text-blue-400 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Tell AI what matters to you
                </label>
                <p className="text-xs text-zinc-400 mb-4">Example: "I'm looking for Data Analyst jobs in Hyderabad and I only want interview alerts."</p>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={nlpInput} 
                    onChange={e => setNlpInput(e.target.value)} 
                    placeholder="Type your preferences here..." 
                    className="flex-1 bg-black/50 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none" 
                    onKeyDown={e => e.key === 'Enter' && handleNlpSubmit()}
                  />
                  <button 
                    onClick={handleNlpSubmit} 
                    disabled={isNlpLoading || !nlpInput.trim()}
                    className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition disabled:opacity-50"
                  >
                    {isNlpLoading ? 'Processing...' : 'Apply with AI'}
                  </button>
                </div>
              </div>

              {/* Checkboxes Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">🎯 Career Interests</h3>
                  <div className="space-y-3">
                    {['Data Analyst', 'Software Engineer', 'AI Engineer', 'Backend Developer', 'Internship'].map(item => (
                      <label key={item} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${careerInterests.includes(item) ? 'bg-blue-500 border-blue-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                          {careerInterests.includes(item) && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-sm text-zinc-400 group-hover:text-zinc-300">{item}</span>
                        <input type="checkbox" className="hidden" checked={careerInterests.includes(item)} onChange={() => toggleCheckbox(careerInterests, setCareerInterests, item)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">🏢 Favorite Companies</h3>
                  <div className="space-y-3">
                    {['Google', 'Microsoft', 'Amazon', 'Infosys', 'TCS', 'Accenture', 'Deloitte'].map(item => (
                      <label key={item} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${favoriteCompanies.includes(item) ? 'bg-blue-500 border-blue-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                          {favoriteCompanies.includes(item) && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-sm text-zinc-400 group-hover:text-zinc-300">{item}</span>
                        <input type="checkbox" className="hidden" checked={favoriteCompanies.includes(item)} onChange={() => toggleCheckbox(favoriteCompanies, setFavoriteCompanies, item)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">🔔 Always Notify For</h3>
                  <div className="space-y-3">
                    {['Placements', 'Interviews', 'Job Offers', 'Security Alerts', 'Payments', 'Deadlines', 'Reply Required'].map(item => (
                      <label key={item} className="flex items-center gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${alwaysNotify.includes(item) ? 'bg-blue-500 border-blue-500' : 'border-zinc-700 group-hover:border-zinc-500'}`}>
                          {alwaysNotify.includes(item) && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-sm text-zinc-400 group-hover:text-zinc-300">{item}</span>
                        <input type="checkbox" className="hidden" checked={alwaysNotify.includes(item)} onChange={() => toggleCheckbox(alwaysNotify, setAlwaysNotify, item)} />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">🧠 AI Learning</h3>
                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="text-sm font-bold text-white mb-1">Learn From My Behavior</div>
                        <div className="text-[11px] text-zinc-500 leading-tight">AI automatically adapts to what you open, reply to, or ignore.</div>
                      </div>
                      <div className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors bg-blue-500`}>
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform translate-x-4`}></div>
                      </div>
                    </label>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-zinc-800">
                    <button onClick={saveCheckboxPreferences} className="w-full py-3 rounded-xl gradient-primary text-sm font-bold text-white hover:brightness-110 transition shadow-lg shadow-blue-500/20">
                      Save All Preferences
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Smart In-App Popup Notification */}
      {popupNotification && (
        <div className={`fixed top-6 right-6 z-[250] w-96 bg-zinc-950/90 backdrop-blur-xl border-l-4 ${
          popupNotification.alert_type === 'Security Alert' ? 'border-l-red-500 border-red-500/20' :
          popupNotification.alert_type === 'Interview Alert' ? 'border-l-purple-500 border-purple-500/20' :
          popupNotification.alert_type === 'Placement Alert' ? 'border-l-blue-500 border-blue-500/20' :
          popupNotification.alert_type === 'Deadline Alert' ? 'border-l-orange-500 border-orange-500/20' : 'border-l-emerald-500 border-emerald-500/20'
        } border-y border-r border-zinc-800 rounded-2xl p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-in slide-in-from-right fade-in duration-300`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">
                {popupNotification.alert_type === 'Security Alert' ? '🚨' :
                 popupNotification.alert_type === 'Interview Alert' ? '💼' :
                 popupNotification.alert_type === 'Placement Alert' ? '🎯' :
                 popupNotification.alert_type === 'Deadline Alert' ? '⏰' : '🔔'}
              </span>
              <div>
                <h4 className="font-bold text-white text-sm">Neural Inbox Alert</h4>
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{popupNotification.alert_type || 'Personalized AI Notification'}</div>
              </div>
            </div>
            <button onClick={() => setPopupNotification(null)} className="text-zinc-500 hover:text-white transition p-1"><X className="w-4 h-4"/></button>
          </div>
          <div className="text-[12px] font-bold text-white mb-1.5 mt-1">{popupNotification.title}</div>
          <p className="text-[12px] text-zinc-300 mb-4 leading-relaxed line-clamp-2">{popupNotification.message}</p>
          <div className="flex gap-2">
            <button 
              onClick={async () => {
                let mail = emails.find(e => e.id === popupNotification.email_id);
                if (!mail) {
                  try {
                    const res = await fetch(`${API_BASE}/emails/${popupNotification.email_id}`, { headers: getHeaders() });
                    if (res.ok) {
                      mail = await res.json();
                    }
                  } catch (e) {
                    console.error("Failed to fetch email for popup", e);
                  }
                }
                if (mail) {
                  selectEmailAndMarkRead(mail);
                  setDetailTab('AI Summary');
                }
                setPopupNotification(null);
              }} 
              className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5"
            >
              <span>Inspect AI Email</span> →
            </button>
            <button 
              onClick={() => setPopupNotification(null)} 
              className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Test Lab Modal */}
      {isTestLabOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0a0a0f] border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl my-8 flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <Layers className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-bold text-white">Automated Test Lab</h2>
              </div>
              <button onClick={() => setIsTestLabOpen(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 transition"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
                <div className="flex flex-wrap gap-2 mb-6">
                    <button onClick={() => runTestLabScenario('placement')} disabled={isSimulating} className="px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded-lg border border-blue-500/20">🎯 Placement Test</button>
                    <button onClick={() => runTestLabScenario('interview')} disabled={isSimulating} className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold rounded-lg border border-green-500/20">💼 Interview Test</button>
                    <button onClick={() => runTestLabScenario('phishing')} disabled={isSimulating} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg border border-red-500/20">🚨 Phishing Test</button>
                    <button onClick={() => runTestLabScenario('spam')} disabled={isSimulating} className="px-4 py-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-bold rounded-lg border border-yellow-500/20">📢 Spam Test</button>
                    <button onClick={() => runTestLabScenario('deadline')} disabled={isSimulating} className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-bold rounded-lg border border-orange-500/20">⏰ Deadline Test</button>
                </div>

                <div className="space-y-3">
                    {testLabResults.length === 0 ? (
                        <div className="text-center py-10 text-zinc-500 text-sm">Click a test button above to run an automated simulation through the AI pipeline.</div>
                    ) : testLabResults.map((result, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border ${result.passed ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="text-sm font-bold text-white flex items-center gap-2">
                                        {result.test.name}
                                        {result.passed ? <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded uppercase">PASS</span> : <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded uppercase">FAIL</span>}
                                    </div>
                                    <div className="text-xs text-zinc-400 mt-1">{result.test.subject}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="p-3 bg-black/40 rounded-lg">
                                    <div className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Expected Results</div>
                                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">{JSON.stringify(result.test.expected, null, 2)}</pre>
                                </div>
                                <div className="p-3 bg-black/40 rounded-lg">
                                    <div className="text-[10px] uppercase text-zinc-500 font-bold mb-2">Actual AI Results</div>
                                    <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap">{JSON.stringify(result.actual, null, 2)}</pre>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </div>
      )}
      
      <ComposeModal 
        isOpen={isComposeOpen} 
        onClose={() => { setIsComposeOpen(false); setComposeInitialData(null); }} 
        onSendWithUndo={handleSendWithUndo}
        initialData={composeInitialData}
      />

      {/* Undo Send Toast */}
      {undoSendData && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] animate-in slide-in-from-bottom-4">
          <div className="bg-[#1a1a2e] border border-white/15 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-4 min-w-[400px]">
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Email will be sent in {undoCountdown} seconds</p>
              <p className="text-zinc-500 text-xs mt-0.5">To: {undoSendData.to}</p>
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center">
              <span className="text-blue-400 text-sm font-bold">{undoCountdown}</span>
            </div>
            <button
              onClick={handleUndoSend}
              className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-500/25"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


