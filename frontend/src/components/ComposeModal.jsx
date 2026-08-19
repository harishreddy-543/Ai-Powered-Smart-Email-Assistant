import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Paperclip, Loader2, Save, ChevronDown, Clock, Calendar, Sun, Sunrise } from 'lucide-react';

export default function ComposeModal({ isOpen, onClose, onSendWithUndo, initialData }) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [customHour, setCustomHour] = useState('09');
  const [customMinute, setCustomMinute] = useState('00');
  const [customAmPm, setCustomAmPm] = useState('AM');
  const scheduleRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // If reopened via Undo, pre-fill with initial data
      if (initialData) {
        setTo(initialData.to || '');
        setCc(initialData.cc || '');
        setBcc(initialData.bcc || '');
        setSubject(initialData.subject || '');
        setBody(initialData.body || '');
        setFiles([]);
      } else {
        setTo('');
        setCc('');
        setBcc('');
        setSubject('');
        setBody('');
        setFiles([]);
      }
      setError('');
      setSuccessToast('');
      setShowScheduleMenu(false);
      setShowCustomPicker(false);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCustomDate(tomorrow.toISOString().slice(0, 10));
      setCustomHour('09');
      setCustomMinute('00');
      setCustomAmPm('AM');
    }
  }, [isOpen, initialData]);

  // Close schedule menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (scheduleRef.current && !scheduleRef.current.contains(e.target)) {
        setShowScheduleMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleCustomSubmit = () => {
    if (!customDate) return;
    let hour = parseInt(customHour, 10);
    if (customAmPm === 'PM' && hour < 12) hour += 12;
    if (customAmPm === 'AM' && hour === 12) hour = 0;
    
    const [year, month, day] = customDate.split('-').map(Number);
    const scheduledDate = new Date(year, month - 1, day, hour, parseInt(customMinute, 10), 0);
    handleScheduleSend(scheduledDate);
  };

  const handleSend = () => {
    if (!to) return;
    const emailData = { to, cc, bcc, subject, body, files };
    // Pass to parent for Undo Send countdown
    if (onSendWithUndo) {
      onSendWithUndo(emailData);
    } else {
      // Fallback: fire-and-forget
      _fireAndForgetSend(emailData);
    }
    onClose();
  };

  const _fireAndForgetSend = (data) => {
    const formData = new FormData();
    formData.append('to', data.to);
    if (data.cc) formData.append('cc', data.cc);
    if (data.bcc) formData.append('bcc', data.bcc);
    formData.append('subject', data.subject);
    formData.append('body', data.body);
    if (data.files) data.files.forEach(f => formData.append('files', f));

    const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api/v1`;
    fetch(`${API_BASE}/compose/send`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    }).catch(() => {});
  };

  const handleSaveDraft = () => {
    const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api/v1`;
    const formData = new FormData();
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('body', body);

    fetch(`${API_BASE}/compose/draft`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    }).catch(() => {});

    setSuccessToast('✅ Draft saved successfully!');
    setTimeout(() => setSuccessToast(''), 3000);
  };

  const handleScheduleSend = (scheduledAt) => {
    if (!to) return;
    const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:8000/api/v1`;
    const formData = new FormData();
    formData.append('to', to);
    if (cc) formData.append('cc', cc);
    if (bcc) formData.append('bcc', bcc);
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('scheduled_at', scheduledAt.toISOString());

    fetch(`${API_BASE}/schedule/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    }).catch(() => {});

    setShowScheduleMenu(false);
    onClose();
  };

  // Schedule presets
  const getSchedulePresets = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrowMorning = new Date(tomorrow);
    tomorrowMorning.setHours(8, 0, 0, 0);

    const tomorrowAfternoon = new Date(tomorrow);
    tomorrowAfternoon.setHours(13, 0, 0, 0);

    // Next Monday
    const nextMonday = new Date(now);
    const dayOfWeek = nextMonday.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(8, 0, 0, 0);

    return [
      { label: 'Tomorrow morning', sub: tomorrowMorning.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', 8:00 AM', icon: Sunrise, date: tomorrowMorning },
      { label: 'Tomorrow afternoon', sub: tomorrowAfternoon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', 1:00 PM', icon: Sun, date: tomorrowAfternoon },
      { label: 'Monday morning', sub: nextMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', 8:00 AM', icon: Calendar, date: nextMonday },
    ];
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-[#1e1e24] w-full max-w-3xl max-h-[92vh] my-auto rounded-xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#25252b] border-b border-white/10">
          <h2 className="text-lg font-medium text-white">New Message</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSaveDraft}
              className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors"
              title="Save Draft"
            >
              <Save className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="p-4 space-y-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 w-8 text-sm">To</span>
            <input 
              type="text" 
              value={to} 
              onChange={e => setTo(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-600"
              placeholder="hr@company.com"
            />
          </div>
          
          <div className="flex items-center gap-3 border-t border-white/5 pt-3">
            <span className="text-zinc-500 w-8 text-sm">Cc</span>
            <input 
              type="text" 
              value={cc} 
              onChange={e => setCc(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-600"
            />
          </div>
          
          <div className="flex items-center gap-3 border-t border-white/5 pt-3">
            <span className="text-zinc-500 w-8 text-sm">Bcc</span>
            <input 
              type="text" 
              value={bcc} 
              onChange={e => setBcc(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-zinc-600"
            />
          </div>
          
          <div className="flex items-center gap-3 border-t border-white/5 pt-3">
            <span className="text-zinc-500 w-8 text-sm">Subj</span>
            <input 
              type="text" 
              value={subject} 
              onChange={e => setSubject(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-white font-medium placeholder-zinc-600"
              placeholder="Application for Data Analyst Role"
            />
          </div>
        </div>

        {/* Rich Text Area */}
        <div className="flex-1 min-h-[300px] p-4">
          <textarea 
            value={body}
            onChange={e => setBody(e.target.value)}
            className="w-full h-full bg-transparent border-none outline-none text-zinc-300 resize-none"
            placeholder="Write your message..."
          />
        </div>
        
        {/* Attachments Preview */}
        {files.length > 0 && (
          <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-white/10">
            {Array.from(files).map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-blue-500/20 text-blue-400 text-xs px-3 py-1.5 rounded-md">
                <Paperclip className="w-3 h-3" />
                <span>{f.name} ({(f.size/1024/1024).toFixed(2)} MB)</span>
                <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="hover:text-white ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-[#25252b] border-t border-white/10 flex flex-col gap-3">
          {error && <div className="text-red-400 text-sm px-2">{error}</div>}
          {successToast && <div className="text-green-400 text-sm px-2 bg-green-500/10 py-1.5 rounded-md border border-green-500/20">{successToast}</div>}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Send + Schedule Button Group */}
              <div className="flex items-center">
                <button 
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-l-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                  onClick={handleSend}
                  disabled={!to}
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
                
                {/* Schedule Dropdown Toggle */}
                <div className="relative" ref={scheduleRef}>
                  <button 
                    onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                    className="bg-blue-700 hover:bg-blue-600 text-white px-2 py-2 rounded-r-lg border-l border-blue-500/40 transition-colors disabled:opacity-50 h-full"
                    disabled={!to}
                    title="Schedule Send"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  {/* Schedule Dropdown Menu */}
                  {showScheduleMenu && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 bg-[#1e1e24] border border-white/15 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                      <div className="p-3 border-b border-white/10">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Schedule Send</h3>
                      </div>
                      
                      <div className="p-2 grid grid-cols-1 gap-1">
                        {getSchedulePresets().map((preset, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleScheduleSend(preset.date)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                              <preset.icon className="w-4 h-4 text-amber-400" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-white block">{preset.label}</span>
                              <span className="text-[10px] text-zinc-500">{preset.sub}</span>
                            </div>
                          </button>
                        ))}
                        
                        {/* Custom Date/Time */}
                        {!showCustomPicker ? (
                          <button
                            onClick={() => setShowCustomPicker(true)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left border-t border-white/5 mt-1 pt-3"
                          >
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-purple-400" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-white block">Pick date & time</span>
                              <span className="text-[10px] text-zinc-500">Choose a custom schedule</span>
                            </div>
                          </button>
                        ) : (
                          <div className="px-3 py-3 border-t border-white/10 mt-1 pt-3 space-y-3 bg-zinc-900/90 rounded-xl">
                            <div className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> Custom Schedule
                            </div>
                            
                            {/* Date Selector */}
                            <div>
                              <label className="text-[10px] text-zinc-400 font-semibold mb-1 block">Date</label>
                              <input
                                type="date"
                                value={customDate}
                                onChange={e => setCustomDate(e.target.value)}
                                className="w-full bg-[#181820] border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                style={{ colorScheme: 'dark' }}
                                min={new Date().toISOString().slice(0, 10)}
                              />
                            </div>

                            {/* Time Selectors: Hour : Minute AM/PM */}
                            <div>
                              <label className="text-[10px] text-zinc-400 font-semibold mb-1 block">Time</label>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={customHour}
                                  onChange={e => setCustomHour(e.target.value)}
                                  className="flex-1 bg-[#181820] border border-zinc-700/80 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                                >
                                  {['01','02','03','04','05','06','07','08','09','10','11','12'].map(h => (
                                    <option key={h} value={h}>{h}</option>
                                  ))}
                                </select>

                                <span className="text-zinc-500 font-bold">:</span>

                                <select
                                  value={customMinute}
                                  onChange={e => setCustomMinute(e.target.value)}
                                  className="flex-1 bg-[#181820] border border-zinc-700/80 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                                >
                                  {Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0')).map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>

                                <button
                                  type="button"
                                  onClick={() => setCustomAmPm(prev => prev === 'AM' ? 'PM' : 'AM')}
                                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                    customAmPm === 'AM'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30'
                                  }`}
                                >
                                  {customAmPm}
                                </button>
                              </div>
                            </div>

                            {/* Scheduled Preview */}
                            <div className="text-[10px] text-zinc-300 bg-white/5 px-2.5 py-1.5 rounded-lg text-center font-mono border border-white/5">
                              📅 {customDate} at {customHour}:{customMinute} {customAmPm}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={handleCustomSubmit}
                                disabled={!customDate}
                                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50 transition-colors shadow-md shadow-purple-600/20"
                              >
                                Schedule Send
                              </button>
                              <button
                                onClick={() => setShowCustomPicker(false)}
                                className="px-3 text-zinc-400 hover:text-white text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <label className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 transition-colors cursor-pointer" title="Attach Files">
                <Paperclip className="w-5 h-5" />
                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  onChange={e => setFiles([...files, ...Array.from(e.target.files)])}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
