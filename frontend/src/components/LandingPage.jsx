import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Shield, Zap, Brain, Lock, Mail, Sparkles, ChevronRight } from 'lucide-react';

const LandingPage = ({ onEnterDashboard }) => {
  const canvasRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Particle & Sparkle Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let particles = [];
    let mouse = { x: -1000, y: -1000 };

    const handleWindowMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleWindowMouseMove);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create 220 rich sparkle particles
    const colors = ['#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#10b981', '#ffffff', '#ec4899'];
    for (let i = 0; i < 220; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        size: Math.random() * 2.5 + 0.5,
        baseAlpha: Math.random() * 0.6 + 0.2,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.04,
        color: colors[Math.floor(Math.random() * colors.length)],
        isSparkle: Math.random() > 0.4,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        // Move particle
        p.x += p.vx;
        p.y += p.vy;

        // Wrap edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Mouse gentle push force field
        const dxMouse = mouse.x - p.x;
        const dyMouse = mouse.y - p.y;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        if (distMouse < 150) {
          const angle = Math.atan2(dyMouse, dxMouse);
          const force = (150 - distMouse) / 150;
          p.x -= Math.cos(angle) * force * 1.5;
          p.y -= Math.sin(angle) * force * 1.5;
        }

        // Real-time pulse / twinkle
        p.pulsePhase += p.pulseSpeed;
        const currentAlpha = p.baseAlpha + Math.sin(p.pulsePhase) * 0.3;
        const alpha = Math.max(0.1, Math.min(1, currentAlpha));

        // Draw particle glow aura
        ctx.save();
        ctx.shadowBlur = p.isSparkle ? 12 : 4;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw 4-point star flare for sparkle dots
        if (p.isSparkle && p.size > 1.8) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 0.8;
          const flareSize = p.size * 3;
          ctx.beginPath();
          ctx.moveTo(p.x - flareSize, p.y);
          ctx.lineTo(p.x + flareSize, p.y);
          ctx.moveTo(p.x, p.y - flareSize);
          ctx.lineTo(p.x, p.y + flareSize);
          ctx.stroke();
        }
        ctx.restore();

        // Draw dynamic constellation connecting lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - dist / 130) * 0.15 * alpha;
            ctx.lineWidth = 0.6;
            ctx.stroke();
            ctx.restore();
          }
        }
      });

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleWindowMouseMove);
    };
  }, []);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 20,
    });
  };

  const handleEnter = () => {
    setIsTransitioning(true);
    setTimeout(() => onEnterDashboard(), 600);
  };

  const stats = [
    { label: 'Emails Processed', value: '10K+', icon: Mail, color: '#06b6d4', badge: 'Live Feed' },
    { label: 'Threat Detection', value: '99.2%', icon: Shield, color: '#22c55e', badge: 'SOC-2 Shield' },
    { label: 'AI Models Active', value: '12', icon: Brain, color: '#8b5cf6', badge: 'Neural Net' },
    { label: 'Response Time', value: '<2s', icon: Zap, color: '#f59e0b', badge: 'Ultra-Fast' },
  ];

  const features = [
    { 
      title: 'Smart Classification', 
      desc: 'DistilBERT-powered 10-category email classification with 94.2% accuracy', 
      icon: Brain, 
      color: '#3b82f6',
      tag: 'DistilBERT v2'
    },
    { 
      title: 'Phishing Shield', 
      desc: 'XGBoost + SPF/DKIM/DMARC verification for real-time threat neutralization', 
      icon: Shield, 
      color: '#ef4444',
      tag: 'XGBoost Firewall'
    },
    { 
      title: 'Neural Search', 
      desc: 'MiniLM embeddings with FAISS vector search for instant semantic retrieval', 
      icon: Sparkles, 
      color: '#8b5cf6',
      tag: 'FAISS Vector DB'
    },
    { 
      title: 'Privacy Fortress', 
      desc: 'Zero external data sharing. All processing happens locally on your machine', 
      icon: Lock, 
      color: '#22c55e',
      tag: 'Local Isolation'
    },
  ];

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#030308] overflow-y-auto overflow-x-hidden transition-all duration-600 ${isTransitioning ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
      onMouseMove={handleMouseMove}
    >
      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      {/* Gradient orbs */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/8 blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-600/8 blur-[120px] pointer-events-none z-0" />
      <div className="fixed top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none z-0" />

      {/* ===== TOP NAV BAR ===== */}
      <nav className={`relative z-10 flex items-center justify-between px-8 py-5 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`}>
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleEnter}>
          <div className="p-0.5 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-purple-600 border border-cyan-400/40 shadow-lg shadow-cyan-500/30 group-hover:scale-105 transition-transform duration-300">
            <img src="/icon-logo.png" alt="AI Powered Email Assistant" className="w-10 h-10 object-cover rounded-[10px]" />
          </div>
          <div>
            <span className="text-white font-extrabold text-lg tracking-tight group-hover:text-cyan-400 transition-colors">AI Powered Email Assistant</span>
            <span className="block text-[10px] text-cyan-400/80 font-bold tracking-widest uppercase">Autonomous Email Protection</span>
          </div>
        </div>
        <button
          onClick={handleEnter}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm group"
        >
          Go to Dashboard
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 pt-8 lg:pt-20 pb-16 lg:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* Left: Text Content */}
          <div className={`transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mb-6 sm:mb-8">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] sm:text-[11px] font-bold text-cyan-400 uppercase tracking-widest">AI-Powered Email Command Center</span>
            </div>

            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-4 sm:mb-6">
              <span className="text-white">Secure</span>
              <br />
              <span className="text-white">Your Inbox</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                With AI
              </span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Intelligence
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base lg:text-lg text-zinc-400 leading-relaxed max-w-lg mb-8 sm:mb-10">
              Next-generation AI email assistant. Harnessing 12 machine learning models for real-time classification, phishing detection, smart replies, and autonomous email management.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleEnter}
                className="group relative flex items-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm sm:text-base shadow-2xl shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center gap-3">
                  <Sparkles className="w-5 h-5" />
                  Launch Dashboard
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl border border-zinc-800/80 text-zinc-400 text-xs sm:text-sm font-medium">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>SOC-2 Compliant · Zero Data Leaks</span>
              </div>
            </div>
          </div>

          {/* Right: High Visual 3D Shield Hero Image */}
          <div className={`flex items-center justify-center transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-16 scale-90'}`}>
            <div
              className="relative group cursor-pointer"
              style={{
                transform: `perspective(1000px) rotateY(${mousePos.x * 0.4}deg) rotateX(${-mousePos.y * 0.4}deg)`,
                transition: 'transform 0.15s ease-out',
              }}
            >
              {/* Multi-layered neon glow effects */}
              <div className="absolute inset-[-40px] rounded-full bg-gradient-to-tr from-cyan-500/30 via-blue-600/20 to-purple-600/30 blur-[75px] animate-pulse pointer-events-none" />
              <div className="absolute inset-[-20px] rounded-3xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-[30px] opacity-75 group-hover:opacity-100 transition-opacity pointer-events-none" />
              
              {/* Glassmorphic Cyber Frame for Hero Shield Image */}
              <div className="relative rounded-3xl p-3 bg-gradient-to-b from-white/10 via-white/[0.03] to-cyan-500/10 border border-cyan-500/30 shadow-[0_0_60px_rgba(6,182,212,0.3)] backdrop-blur-xl overflow-hidden z-10">
                <img
                  src="/hero-logo.png"
                  alt="AI Mail Assistant - Secure Emails"
                  className="w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] lg:w-[450px] lg:h-[450px] object-contain rounded-2xl drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)] group-hover:scale-[1.02] transition-transform duration-500"
                />
                
                {/* Subtle sheen highlight */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
              </div>

              {/* Floating glass badges */}
              <div className="absolute top-6 right-[-20px] px-4 py-2 rounded-xl bg-[#090d16]/90 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 backdrop-blur-xl animate-bounce z-20" style={{ animationDuration: '3.2s' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-extrabold text-emerald-400 tracking-wider uppercase font-mono">✓ VERIFIED SECURE</span>
                </div>
              </div>

              <div className="absolute bottom-10 left-[-25px] px-4 py-2 rounded-xl bg-[#090d16]/90 border border-blue-500/40 shadow-lg shadow-blue-500/10 backdrop-blur-xl animate-bounce z-20" style={{ animationDuration: '4s', animationDelay: '1s' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                  <span className="text-[11px] font-extrabold text-blue-400 tracking-wider uppercase font-mono">12 AI MODELS</span>
                </div>
              </div>

              <div className="absolute top-[48%] right-[-35px] px-4 py-2 rounded-xl bg-[#090d16]/90 border border-purple-500/40 shadow-lg shadow-purple-500/10 backdrop-blur-xl animate-bounce z-20" style={{ animationDuration: '3.6s', animationDelay: '0.5s' }}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  <span className="text-[11px] font-extrabold text-purple-400 tracking-wider uppercase font-mono">REAL-TIME</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className={`relative z-10 max-w-6xl mx-auto px-8 mb-20 transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              onClick={handleEnter}
              className="group relative p-5 rounded-2xl bg-white/[0.02] border border-zinc-800/80 hover:border-zinc-700 transition-all duration-300 backdrop-blur-md cursor-pointer overflow-hidden hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.98]"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = stat.color + '60';
                e.currentTarget.style.boxShadow = `0 10px 30px -10px ${stat.color}35`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 0.8)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Top accent glow */}
              <div 
                className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: stat.color }}
              />

              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: stat.color + '15', borderColor: stat.color + '30', borderWidth: '1px' }}
                  >
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider group-hover:text-zinc-200 transition-colors">{stat.label}</span>
                </div>
                <span 
                  className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase font-mono tracking-wider opacity-60 group-hover:opacity-100 transition-all duration-300"
                  style={{ backgroundColor: stat.color + '15', color: stat.color, borderColor: stat.color + '30', borderWidth: '1px' }}
                >
                  {stat.badge}
                </span>
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-3xl font-black text-white tracking-tight group-hover:scale-105 transition-transform origin-left">{stat.value}</span>
                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-white flex items-center gap-1 transition-colors">
                  Dashboard <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section className={`relative z-10 max-w-6xl mx-auto px-8 pb-20 transition-all duration-1000 delay-900 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}>
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-widest">Core Intelligence</span>
          </span>
          <h2 className="text-3xl lg:text-4xl font-black text-white tracking-tight">
            Enterprise-Grade AI Protection
          </h2>
          <p className="text-zinc-500 text-sm mt-2 max-w-lg mx-auto">
            Military-level email security powered by cutting-edge machine learning models
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {features.map((feat, i) => (
            <div
              key={i}
              onClick={handleEnter}
              className="group relative p-6 rounded-2xl bg-white/[0.015] border border-zinc-800/80 hover:border-zinc-700/80 transition-all duration-300 backdrop-blur-md cursor-pointer overflow-hidden hover:-translate-y-2 hover:scale-[1.01] active:scale-[0.99]"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = feat.color + '70';
                e.currentTarget.style.boxShadow = `0 15px 35px -10px ${feat.color}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(39, 39, 42, 0.8)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Subtle background gradient glow on hover */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `radial-gradient(circle at top left, ${feat.color}12, transparent 70%)` }}
              />

              <div className="relative z-10 flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shadow-lg"
                  style={{ backgroundColor: feat.color + '20', borderColor: feat.color + '40', borderWidth: '1px', boxShadow: `0 0 20px ${feat.color}25` }}
                >
                  <feat.icon className="w-6 h-6" style={{ color: feat.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-base font-extrabold text-white group-hover:text-white transition-colors">{feat.title}</h3>
                    <span 
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold font-mono tracking-wider transition-all duration-300"
                      style={{ backgroundColor: feat.color + '18', color: feat.color, borderColor: feat.color + '35', borderWidth: '1px' }}
                    >
                      {feat.tag}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400 group-hover:text-zinc-300 leading-relaxed transition-colors mb-4">{feat.desc}</p>
                  
                  {/* Interactive Button Bar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button 
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-1.5 group-hover:translate-x-1"
                      style={{ backgroundColor: feat.color + '20', color: feat.color, borderColor: feat.color + '40', borderWidth: '1px' }}
                    >
                      <span>Explore Feature</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                    </button>
                    <span className="text-[10px] text-zinc-500 font-semibold ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-300">Click to Open</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>





      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/40 py-6 text-center">
        <p className="text-[11px] text-zinc-600 font-medium">
          © 2026 Neural Inbox · AI Email Intelligence Platform · All Rights Reserved
        </p>
      </footer>

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default LandingPage;
