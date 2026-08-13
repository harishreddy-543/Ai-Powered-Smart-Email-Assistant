import React, { useState, useEffect, useRef } from 'react';
import { Shield, Zap, Brain, Lock, ChevronRight, Cloud, User, RefreshCw, ShieldCheck } from 'lucide-react';

export default function AuthScreen({ isGoogleConnecting, setIsGoogleConnecting, authError, setAuthError, API_BASE, clearAppState }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // ═══ ADVANCED VISUAL EFFECTS CANVAS ═══
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let time = 0;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    // ── Interactive Sparkle Stars & Constellation System ──
    const stars = [];
    const starColors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#10b981', '#ffffff', '#ec4899'];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.2 + 0.4,
        baseAlpha: Math.random() * 0.5 + 0.2,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        isSparkle: Math.random() > 0.4,
      });
    }

    // ── Floating Neon Email Envelopes ──
    const envelopes = [];
    for (let i = 0; i < 14; i++) {
      envelopes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 14 + Math.random() * 18,
        speed: 0.12 + Math.random() * 0.25,
        drift: Math.random() * Math.PI * 2,
        driftSpeed: 0.003 + Math.random() * 0.005,
        opacity: 0.15 + Math.random() * 0.2,
        color: ['#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#10b981'][Math.floor(Math.random() * 5)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.008,
      });
    }

    // ── Circuit Nodes ──
    const nodes = [];
    for (let i = 0; i < 25; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        pulsePhase: Math.random() * Math.PI * 2,
        size: 2 + Math.random() * 2.5,
        color: ['#06b6d4', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 3)],
      });
    }

    // ── Traveling Light Pulses on Lines ──
    const pulses = [];
    for (let i = 0; i < 6; i++) {
      const startNode = Math.floor(Math.random() * nodes.length);
      const endNode = Math.floor(Math.random() * nodes.length);
      pulses.push({
        startIdx: startNode,
        endIdx: endNode === startNode ? (endNode + 1) % nodes.length : endNode,
        progress: 0,
        speed: 0.005 + Math.random() * 0.01,
        color: ['#06b6d4', '#3b82f6', '#8b5cf6'][Math.floor(Math.random() * 3)],
        size: 3 + Math.random() * 2.5,
      });
    }

    const drawEnvelope = (ctx, x, y, size, color, rotation, opacity) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
      // Envelope body
      ctx.beginPath();
      ctx.rect(-size / 2, -size / 3, size, size * 0.65);
      ctx.stroke();
      // Flap
      ctx.beginPath();
      ctx.moveTo(-size / 2, -size / 3);
      ctx.lineTo(0, size * 0.08);
      ctx.lineTo(size / 2, -size / 3);
      ctx.stroke();
      ctx.restore();
    };

    const animate = () => {
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── Draw Glowing AI Frequency Sine Waves ──
      const waveY = canvas.height * 0.85;
      [
        { color: '#06b6d4', speed: 0.015, amp: 25, freq: 0.008, alpha: 0.12 },
        { color: '#8b5cf6', speed: 0.01, amp: 35, freq: 0.005, alpha: 0.09 },
        { color: '#3b82f6', speed: 0.02, amp: 20, freq: 0.01, alpha: 0.1 },
      ].forEach(w => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, waveY);
        for (let x = 0; x <= canvas.width; x += 10) {
          const y = waveY + Math.sin(x * w.freq + time * w.speed) * w.amp;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 1.8;
        ctx.globalAlpha = w.alpha;
        ctx.shadowBlur = 15;
        ctx.shadowColor = w.color;
        ctx.stroke();
        ctx.restore();
      });

      // ── Draw Sparkle Stars & Constellations ──
      stars.forEach((s, i) => {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = canvas.width;
        if (s.x > canvas.width) s.x = 0;
        if (s.y < 0) s.y = canvas.height;
        if (s.y > canvas.height) s.y = 0;

        s.pulsePhase += s.pulseSpeed;
        const currentAlpha = s.baseAlpha + Math.sin(s.pulsePhase) * 0.25;
        const alpha = Math.max(0.05, Math.min(0.85, currentAlpha));

        ctx.save();
        ctx.shadowBlur = s.isSparkle ? 12 : 4;
        ctx.shadowColor = s.color;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        if (s.isSparkle && s.size > 1.4) {
          ctx.strokeStyle = s.color;
          ctx.lineWidth = 0.5;
          const flare = s.size * 2.8;
          ctx.beginPath();
          ctx.moveTo(s.x - flare, s.y);
          ctx.lineTo(s.x + flare, s.y);
          ctx.moveTo(s.x, s.y - flare);
          ctx.lineTo(s.x, s.y + flare);
          ctx.stroke();
        }
        ctx.restore();

        // Constellation lines between nearby stars
        for (let j = i + 1; j < stars.length; j++) {
          const s2 = stars[j];
          const dx = s.x - s2.x;
          const dy = s.y - s2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 95) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.strokeStyle = s.color;
            ctx.globalAlpha = (1 - dist / 95) * 0.08 * alpha;
            ctx.lineWidth = 0.4;
            ctx.stroke();
            ctx.restore();
          }
        }
      });

      // ── Draw Circuit Connections ──
      nodes.forEach((n, i) => {
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          const dx = n.x - n2.x, dy = n.y - n2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 220) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            const midX = (n.x + n2.x) / 2;
            ctx.lineTo(midX, n.y);
            ctx.lineTo(midX, n2.y);
            ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = n.color;
            ctx.globalAlpha = (1 - dist / 220) * 0.1;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();
          }
        }
      });

      // ── Draw Circuit Nodes with Pulse ──
      nodes.forEach(n => {
        n.pulsePhase += 0.03;
        const pulse = 0.4 + Math.sin(n.pulsePhase) * 0.3;
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = pulse;
        ctx.shadowBlur = 15;
        ctx.shadowColor = n.color;
        ctx.fill();
        ctx.restore();
      });

      // ── Draw Traveling Light Pulses ──
      pulses.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) {
          p.progress = 0;
          p.startIdx = Math.floor(Math.random() * nodes.length);
          p.endIdx = Math.floor(Math.random() * nodes.length);
          if (p.startIdx === p.endIdx) p.endIdx = (p.endIdx + 1) % nodes.length;
        }
        const s = nodes[p.startIdx], e = nodes[p.endIdx];
        if (!s || !e) return;
        const midX = (s.x + e.x) / 2;
        let px, py;
        if (p.progress < 0.33) {
          const t = p.progress / 0.33;
          px = s.x + (midX - s.x) * t;
          py = s.y;
        } else if (p.progress < 0.66) {
          const t = (p.progress - 0.33) / 0.33;
          px = midX;
          py = s.y + (e.y - s.y) * t;
        } else {
          const t = (p.progress - 0.66) / 0.34;
          px = midX + (e.x - midX) * t;
          py = e.y;
        }
        ctx.save();
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.shadowBlur = 25;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();
      });

      // ── Draw Floating Envelopes ──
      envelopes.forEach(env => {
        env.y -= env.speed;
        env.drift += env.driftSpeed;
        env.x += Math.sin(env.drift) * 0.5;
        env.rotation += env.rotSpeed;
        if (env.y < -40) { env.y = canvas.height + 40; env.x = Math.random() * canvas.width; }
        drawEnvelope(ctx, env.x, env.y, env.size, env.color, env.rotation, env.opacity);
      });

      // ── Central Radar Sweep ──
      const cx = canvas.width / 2, cy = canvas.height * 0.42;
      const sweepAngle = (time * 0.012) % (Math.PI * 2);
      const sweepGrad = ctx.createConicalGradient ? null : null; // Fallback
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 300, sweepAngle, sweepAngle + 0.5);
      ctx.closePath();
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300);
      grad.addColorStop(0, 'rgba(6,182,212,0.12)');
      grad.addColorStop(1, 'rgba(6,182,212,0)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();

      // ── Concentric Pulse Rings ──
      for (let r = 0; r < 3; r++) {
        const phase = (time * 0.8 + r * 80) % 300;
        const radius = phase * 1.5;
        const alpha = Math.max(0, 0.25 - phase / 300 * 0.25);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = r === 0 ? '#06b6d4' : r === 1 ? '#3b82f6' : '#8b5cf6';
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: ((e.clientX - rect.left) / rect.width - 0.5) * 20, y: ((e.clientY - rect.top) / rect.height - 0.5) * 20 });
  };

  const handleGoogleClick = async () => {
    setIsGoogleConnecting(true);
    if (clearAppState) clearAppState();
    try {
      const fetchWithRetry = async (url, options = {}, retries = 10, delay = 2000) => {
        for (let i = 0; i < retries; i++) { try { const res = await fetch(url, options); return res; } catch (err) { if (i === retries - 1) throw err; await new Promise(r => setTimeout(r, delay)); } }
      };
      const res = await fetchWithRetry(`${API_BASE}/auth/google/login`);
      if (!res.ok) throw new Error('Login fetch failed');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('Login error:', err);
      if (setAuthError) setAuthError('Backend server is starting up (takes ~10s). Please try again.');
      setIsGoogleConnecting(false);
    }
  };

  const features = [
    { icon: ShieldCheck, label: 'Secure', desc: 'Your data is protected', color: '#06b6d4' },
    { icon: Zap, label: 'Fast', desc: 'One-tap sign in', color: '#8b5cf6' },
    { icon: Cloud, label: 'Anywhere', desc: 'Across all your devices', color: '#06b6d4' },
    { icon: User, label: 'Personal', desc: 'Built for you', color: '#3b82f6' },
    { icon: RefreshCw, label: 'Seamless', desc: 'Smooth experience', color: '#8b5cf6' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050810] overflow-y-auto overflow-x-hidden" onMouseMove={handleMouseMove}>
      
      {/* ═══ VISUAL EFFECTS CANVAS ═══ */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[1]" />

      <style>{`
        @keyframes float-smooth { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-14px); } }
        @keyframes float-alt { 0%, 100% { transform: translateY(0px) translateX(0px); } 50% { transform: translateY(-10px) translateX(6px); } }
        @keyframes hero-glow-pulse { 0%, 100% { box-shadow: 0 0 60px rgba(6,182,212,0.25), 0 0 120px rgba(59,130,246,0.1); } 50% { box-shadow: 0 0 80px rgba(6,182,212,0.4), 0 0 160px rgba(59,130,246,0.2); } }
        @keyframes beam-rotate { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes scanline-move { 0% { top: -2px; } 100% { top: 100%; } }
        .auth-float { animation: float-smooth 5s ease-in-out infinite; }
        .auth-float-alt { animation: float-alt 6.5s ease-in-out infinite; }
        .hero-glow-animate { animation: hero-glow-pulse 4s ease-in-out infinite; }
      `}</style>

      {/* ── ROTATING LIGHT BEAMS BEHIND HERO ── */}
      <div className="fixed pointer-events-none z-0" style={{ top: '42%', left: '50%', width: '900px', height: '900px', transform: 'translate(-50%, -50%)', animation: 'beam-rotate 30s linear infinite' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '3px', height: '450px', background: 'linear-gradient(to bottom, rgba(6,182,212,0.2), transparent)', transformOrigin: '50% 0%', transform: 'translate(-50%, 0) rotate(0deg)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '3px', height: '450px', background: 'linear-gradient(to bottom, rgba(139,92,246,0.15), transparent)', transformOrigin: '50% 0%', transform: 'translate(-50%, 0) rotate(60deg)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '3px', height: '450px', background: 'linear-gradient(to bottom, rgba(59,130,246,0.15), transparent)', transformOrigin: '50% 0%', transform: 'translate(-50%, 0) rotate(120deg)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '3px', height: '450px', background: 'linear-gradient(to bottom, rgba(6,182,212,0.12), transparent)', transformOrigin: '50% 0%', transform: 'translate(-50%, 0) rotate(180deg)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '3px', height: '450px', background: 'linear-gradient(to bottom, rgba(139,92,246,0.12), transparent)', transformOrigin: '50% 0%', transform: 'translate(-50%, 0) rotate(240deg)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '3px', height: '450px', background: 'linear-gradient(to bottom, rgba(59,130,246,0.12), transparent)', transformOrigin: '50% 0%', transform: 'translate(-50%, 0) rotate(300deg)' }} />
      </div>

      {/* ── TOP NAV BAR ── */}
      <nav className={`relative z-10 flex items-center justify-between px-8 py-5 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="p-0.5 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 border border-cyan-400/40 shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform duration-300">
            <img src="/icon-logo.png" alt="AI Powered Email Assistant" className="w-10 h-10 object-cover rounded-[10px]" />
          </div>
          <div>
            <span className="text-white font-extrabold text-lg tracking-tight group-hover:text-cyan-400 transition-colors">AI Powered Email Assistant</span>
            <span className="block text-[10px] text-cyan-400/80 font-bold tracking-widest uppercase">Autonomous Email Protection</span>
          </div>
        </div>
      </nav>

      {/* ═══ MAIN HERO SECTION ═══ */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-4 pb-8 flex flex-col items-center">

        {/* ── HERO IMAGE ── */}
        <div className={`relative mb-8 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-16 scale-90'}`}>
          <div
            className="relative group cursor-pointer"
            style={{
              transform: `perspective(1000px) rotateY(${mousePos.x * 0.3}deg) rotateX(${-mousePos.y * 0.3}deg)`,
              transition: 'transform 0.15s ease-out',
            }}
          >
            {/* Animated glow frame */}
            <div className="absolute inset-[-3px] rounded-3xl bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 opacity-40 group-hover:opacity-70 blur-sm transition-opacity duration-500 pointer-events-none hero-glow-animate" />

            {/* Platform glow */}
            <div className="absolute bottom-[-25px] left-1/2 -translate-x-1/2 w-[75%] h-[40px] rounded-full bg-cyan-500/30 blur-2xl group-hover:bg-cyan-500/45 transition-all duration-500 pointer-events-none" />

            {/* Hero Image */}
            <div className="relative z-10 rounded-3xl overflow-hidden">
              <img
                src="/gmail-hero.jpg"
                alt="Sign in with Google - AI Email Assistant"
                className="w-[420px] h-[315px] sm:w-[550px] sm:h-[412px] lg:w-[650px] lg:h-[487px] object-cover rounded-3xl group-hover:scale-[1.015] transition-transform duration-500"
              />
              
              {/* Animated scanline */}
              <div className="absolute left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent pointer-events-none" style={{ animation: 'scanline-move 3s linear infinite' }} />
              
              {/* Vignette overlay */}
              <div className="absolute inset-0 rounded-3xl shadow-[inset_0_0_80px_rgba(0,0,0,0.6)] pointer-events-none" />
            </div>

            {/* ── FLOATING BADGES (AUTHENTICATION & CLOUD RELEVANT) ── */}
            <div className="auth-float absolute top-5 right-[-15px] sm:right-[-30px] px-4 py-2.5 rounded-xl bg-[#0a0f1a]/95 border border-emerald-500/30 shadow-[0_4px_25px_rgba(16,185,129,0.2)] backdrop-blur-xl z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                <span className="text-[11px] font-extrabold text-emerald-400 tracking-wider uppercase font-mono">🔐 GOOGLE OAUTH 2.0</span>
              </div>
            </div>

            <div className="auth-float-alt absolute bottom-14 left-[-15px] sm:left-[-30px] px-4 py-2.5 rounded-xl bg-[#0a0f1a]/95 border border-cyan-500/30 shadow-[0_4px_25px_rgba(6,182,212,0.2)] backdrop-blur-xl z-20" style={{ animationDelay: '1.5s' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                <span className="text-[11px] font-extrabold text-cyan-400 tracking-wider uppercase font-mono">☁️ GMAIL SYNC READY</span>
              </div>
            </div>

            <div className="auth-float absolute top-[50%] right-[-20px] sm:right-[-40px] px-4 py-2.5 rounded-xl bg-[#0a0f1a]/95 border border-purple-500/30 shadow-[0_4px_25px_rgba(168,85,247,0.2)] backdrop-blur-xl z-20" style={{ animationDelay: '3s' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.9)]" />
                <span className="text-[11px] font-extrabold text-purple-400 tracking-wider uppercase font-mono">🛡️ ZERO-DATA LEAK</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── SIGN IN TEXT ── */}
        <div className={`text-center mb-8 transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-3 text-white">
            Sign in with <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">Google</span>
          </h1>
          <p className="text-base sm:text-lg text-transparent bg-clip-text bg-gradient-to-r from-cyan-400/80 to-purple-400/80 font-semibold tracking-wide">
            Access anywhere. Anytime.
          </p>
        </div>

        {/* ── GOOGLE SIGN-IN BUTTON ── */}
        <div className={`mb-10 transition-all duration-1000 delay-600 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <button
            disabled={isGoogleConnecting}
            onClick={handleGoogleClick}
            className="group relative flex items-center gap-3 px-10 py-4.5 rounded-2xl bg-white hover:bg-zinc-50 text-zinc-900 font-bold text-base shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(59,130,246,0.35)] hover:scale-[1.04] active:scale-[0.97] transition-all duration-300 overflow-hidden border border-white/80"
          >
            <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/60 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-in-out pointer-events-none"></span>
            {isGoogleConnecting ? (
              <span className="relative flex items-center gap-2.5 text-zinc-800 font-bold">
                <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                Connecting to backend (might take 15s)...
              </span>
            ) : (
              <span className="relative flex items-center gap-3">
                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span className="text-lg tracking-wide">Continue with Google</span>
                <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
          {authError && (
            <p className="mt-4 text-xs text-center font-semibold py-2.5 px-4 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 max-w-md mx-auto">{authError}</p>
          )}
        </div>

        {/* ── DIVIDER ── */}
        <div className={`w-full max-w-3xl mb-8 transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        </div>

        {/* ── FEATURE ICONS ROW ── */}
        <div className={`grid grid-cols-2 sm:grid-cols-5 gap-6 sm:gap-4 w-full max-w-3xl transition-all duration-1000 delay-800 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {features.map((f, i) => (
            <div key={i} className="flex flex-col items-center text-center group cursor-default">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 border transition-all duration-300 group-hover:scale-110"
                style={{ borderColor: `${f.color}30`, backgroundColor: `${f.color}08` }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 25px ${f.color}30`; e.currentTarget.style.backgroundColor = `${f.color}15`; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.backgroundColor = `${f.color}08`; }}
              >
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <span className="text-sm font-bold text-white mb-0.5">{f.label}</span>
              <span className="text-[11px] text-zinc-500 font-medium">{f.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
