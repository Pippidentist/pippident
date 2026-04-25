"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

/* ── Design tokens (cyan theme, matching Claude Design handoff) ──────── */
const THEME = {
  accent: "#00E5FF",
  accent2: "#00FF9F",
  bg: "#05090F",
  glowRgb: "0,229,255",
} as const;

/* ── Global reveal-on-scroll + 3D tilt on feature cards ──────────────── */
function useGlobalReveal() {
  useEffect(() => {
    // Reveal observer
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    const attach = () => {
      document.querySelectorAll(".landing .reveal").forEach((el) => obs.observe(el));
    };
    attach();
    const t1 = window.setTimeout(attach, 100);
    const t2 = window.setTimeout(attach, 400);

    // Tilt on feature cards
    const tiltHandler = (e: MouseEvent) => {
      const card = e.currentTarget as HTMLElement;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(700px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(8px)`;
    };
    const tiltLeave = (e: MouseEvent) => {
      const el = e.currentTarget as HTMLElement;
      el.style.transition = "transform .5s ease";
      el.style.transform = "";
      window.setTimeout(() => {
        if (el) el.style.transition = "";
      }, 500);
    };
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".landing .feat-card")
    );
    const t3 = window.setTimeout(() => {
      cards.forEach((el) => {
        el.addEventListener("mousemove", tiltHandler);
        el.addEventListener("mouseleave", tiltLeave);
      });
    }, 300);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      obs.disconnect();
      cards.forEach((el) => {
        el.removeEventListener("mousemove", tiltHandler);
        el.removeEventListener("mouseleave", tiltLeave);
      });
    };
  }, []);
}

/* ── Phone frame (iPhone-style bezel) ─────────────────────────────────── */
function PhoneFrame({
  src,
  alt,
  floatClass = "float-l",
  glowColor,
}: {
  src: string;
  alt: string;
  floatClass?: "float-l" | "float-r";
  glowColor: string;
}) {
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      <div
        className="glow-blob"
        style={{
          width: 420,
          height: 420,
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
        }}
      />
      <div
        className={`phone-wrap ${floatClass}`}
        style={{
          boxShadow: `0 0 0 1px rgba(255,255,255,0.07), 0 36px 72px rgba(0,0,0,0.7), 0 0 60px ${glowColor}`,
        }}
      >
        <div className="phone-screen">
          <Image
            src={src}
            alt={alt}
            width={248}
            height={520}
            priority={false}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── AI Hero Graphic — animated robot + bubbles + sound waves ─────────── */
function AIHeroGraphic() {
  const accent = THEME.accent;
  const glowRgb = THEME.glowRgb;
  return (
    <div
      className="lp-ai-hero-graphic"
      style={{
        position: "relative",
        width: 420,
        height: 420,
        animation: "lp-floatPhone 7s ease-in-out infinite",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `1px solid rgba(${glowRgb},0.12)`,
          animation: "lp-glowPulse 3s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 30,
          borderRadius: "50%",
          border: `1px solid rgba(${glowRgb},0.07)`,
        }}
      />
      <div
        className="glow-blob"
        style={{
          width: 380,
          height: 380,
          background: `radial-gradient(circle, rgba(${glowRgb},0.13) 0%, transparent 70%)`,
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
        }}
      />

      {/* Center robot card */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 200,
          height: 224,
          background: "linear-gradient(145deg,#111a13,#0d1610)",
          border: `1.5px solid rgba(${glowRgb},0.22)`,
          borderRadius: 32,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          boxShadow: `0 0 60px rgba(${glowRgb},0.18), 0 24px 48px rgba(0,0,0,0.6)`,
        }}
      >
        <svg width="90" height="86" viewBox="0 0 90 86" fill="none" xmlns="http://www.w3.org/2000/svg">
          <line x1="45" y1="2" x2="45" y2="13" stroke={accent} strokeWidth="2" strokeLinecap="round" />
          <circle cx="45" cy="2" r="3" fill={accent} />
          <rect x="13" y="13" width="64" height="52" rx="14" fill="#0d1610" stroke={accent} strokeWidth="1.5" strokeOpacity="0.55" />
          <rect x="22" y="27" width="17" height="13" rx="4" fill={accent} opacity="0.9" />
          <rect x="51" y="27" width="17" height="13" rx="4" fill={accent} opacity="0.9" />
          <rect x="25" y="29" width="5" height="4" rx="2" fill="white" opacity="0.5" />
          <rect x="54" y="29" width="5" height="4" rx="2" fill="white" opacity="0.5" />
          <rect x="27" y="48" width="36" height="8" rx="4" fill="none" stroke={accent} strokeWidth="1.4" strokeOpacity="0.55" />
          <rect x="31" y="50" width="6" height="4" rx="2" fill={accent} opacity="0.5" />
          <rect x="42" y="50" width="6" height="4" rx="2" fill={accent} opacity="0.5" />
          <rect x="53" y="50" width="6" height="4" rx="2" fill={accent} opacity="0.5" />
          <rect x="35" y="65" width="20" height="8" rx="4" fill={accent} opacity="0.25" />
          <rect x="22" y="73" width="46" height="13" rx="8" fill={accent} opacity="0.07" />
        </svg>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            background: `rgba(${glowRgb},0.1)`,
            border: `1px solid rgba(${glowRgb},0.25)`,
            borderRadius: 50,
            padding: "5px 13px",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: accent,
              display: "inline-block",
              animation: "lp-dotPulse 1.5s infinite",
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: 0.5 }}>
            IN CHIAMATA
          </span>
        </div>
      </div>

      {/* Sound waves left */}
      {[0, 1, 2].map((i) => (
        <div
          key={`wl${i}`}
          style={{
            position: "absolute",
            top: "50%",
            left: 62 - i * 18,
            transform: "translateY(-50%)",
            width: 3,
            height: 16 + i * 14,
            borderRadius: 4,
            background: accent,
            opacity: 0.12 + i * 0.14,
            animation: `lp-glowPulse ${1.2 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      {[0, 1, 2].map((i) => (
        <div
          key={`wr${i}`}
          style={{
            position: "absolute",
            top: "50%",
            right: 62 - i * 18,
            transform: "translateY(-50%)",
            width: 3,
            height: 16 + i * 14,
            borderRadius: 4,
            background: accent,
            opacity: 0.12 + i * 0.14,
            animation: `lp-glowPulse ${1.2 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${i * 0.2 + 0.6}s`,
          }}
        />
      ))}

      {/* Caller bubble */}
      <div
        style={{
          position: "absolute",
          top: 44,
          right: 20,
          background: "rgba(10,18,12,0.92)",
          border: `1px solid rgba(${glowRgb},0.18)`,
          borderRadius: 16,
          padding: "10px 14px",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ fontSize: 10.5, color: "#7A9A82", marginBottom: 2 }}>
          Paziente in chiamata
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#EEF8F1" }}>
          Marco Bianchi
        </div>
        <div style={{ fontSize: 11, color: accent, marginTop: 3 }}>📞 Prenota visita</div>
      </div>

      {/* AI reply bubble */}
      <div
        style={{
          position: "absolute",
          bottom: 56,
          left: 14,
          background: `rgba(${glowRgb},0.07)`,
          border: `1px solid rgba(${glowRgb},0.2)`,
          borderRadius: 16,
          padding: "10px 14px",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          maxWidth: 164,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontSize: 10.5, color: accent, marginBottom: 3, fontWeight: 700 }}>
          AI Pippident
        </div>
        <div style={{ fontSize: 12, color: "#AACBB5", lineHeight: 1.55 }}>
          Ho trovato lunedì 28 alle 10:30. Confermo?
        </div>
      </div>

      {/* Clock bubble */}
      <div
        style={{
          position: "absolute",
          bottom: 46,
          right: 24,
          background: "rgba(10,18,12,0.88)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12,
          padding: "8px 12px",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontSize: 10, color: "#3A5542" }}>Fuori orario</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#EEF8F1" }}>22:14</div>
      </div>
    </div>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────── */
function Nav() {
  return (
    <nav className="lp-nav">
      <Link href="/" className="lp-nav-logo">
        <Image
          src="/landing/logo.png"
          alt="Pippident logo"
          width={28}
          height={28}
          style={{ objectFit: "contain" }}
        />
        Pippident
      </Link>
      <div className="lp-nav-links">
        <a href="#features">Funzionalità</a>
        <a href="#prezzi">Prezzi</a>
        <Link href="/login" className="lp-nav-login">
          Accedi
        </Link>
      </div>
      <a href="#prezzi" className="btn-pill">
        Prova gratis
      </a>
    </nav>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        paddingTop: 100,
        paddingBottom: 80,
        position: "relative",
        zIndex: 1,
      }}
    >
      <div
        className="wrap lp-hero-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 64,
          alignItems: "center",
          width: "100%",
        }}
      >
        <div>
          <div className="reveal" style={{ marginBottom: 24, transitionDelay: "0ms" }}>
            <span className="lp-badge lp-badge-green">
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: THEME.accent,
                  display: "inline-block",
                  animation: "lp-dotPulse 2s infinite",
                }}
              />
              Agente AI vocale per dentisti italiani
            </span>
          </div>
          <h1
            className="reveal"
            style={{
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: "-2.5px",
              marginBottom: 22,
              textWrap: "pretty",
              transitionDelay: "80ms",
              fontSize: "clamp(40px, 6vw, 58px)",
            }}
          >
            Il primo assistente
            <br />
            che lavora <span style={{ color: THEME.accent }}>24/7</span>
            <br />
            e ti riempie l&apos;agenda.
          </h1>
          <p
            className="reveal"
            style={{
              fontSize: 17,
              lineHeight: 1.75,
              color: "#7A9A82",
              marginBottom: 38,
              maxWidth: 480,
              textWrap: "pretty",
              transitionDelay: "160ms",
            }}
          >
            Recupera fino al{" "}
            <strong style={{ color: "#EEF8F1" }}>30% degli appuntamenti</strong> che
            oggi perdi perché l&apos;ufficio è chiuso o le linee sono occupate.
          </p>
          <div
            className="reveal"
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 20,
              transitionDelay: "240ms",
            }}
          >
            <a href="#prezzi" className="btn-primary">
              Inizia gratis — 15 giorni
            </a>
            <a href="#features" className="btn-ghost">
              Scopri come funziona
            </a>
          </div>
          <p
            className="reveal"
            style={{
              fontSize: 12.5,
              color: "#3A5542",
              letterSpacing: 0.2,
              transitionDelay: "300ms",
            }}
          >
            Nessuna carta richiesta · Cancella quando vuoi
          </p>
        </div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          <AIHeroGraphic />
        </div>
      </div>
    </section>
  );
}

/* ── Stats ───────────────────────────────────────────────────────────── */
function Stats() {
  const data = [
    { v: "24/7", l: "Sempre disponibile" },
    { v: "−30%", l: "Riduzione no-show" },
    { v: "4h", l: "Risparmiate a settimana" },
    { v: "0", l: "App da installare" },
  ];
  return (
    <section style={{ position: "relative", zIndex: 1, padding: "0 36px 100px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          className="reveal lp-stats-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            background: `rgba(${THEME.glowRgb},0.05)`,
            border: `1px solid rgba(${THEME.glowRgb},0.1)`,
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          {data.map((s, i) => (
            <div
              key={i}
              style={{
                padding: "28px 20px",
                textAlign: "center",
                borderRight:
                  i < 3 ? `1px solid rgba(${THEME.glowRgb},0.07)` : "none",
              }}
            >
              <div
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  letterSpacing: -2,
                  color: THEME.accent,
                  marginBottom: 5,
                }}
              >
                {s.v}
              </div>
              <div style={{ fontSize: 13.5, color: "#5A7A62" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ────────────────────────────────────────────────────────── */
function Features() {
  const feats = [
    {
      icon: "◉",
      title: "Rubrica Pazienti",
      desc: "Anagrafica dedicata alla relazione col paziente, separata dal gestionale clinico. Cerca per nome, telefono o codice fiscale.",
    },
    {
      icon: "⬡",
      title: "Agenda Appuntamenti",
      desc: "Vista giornaliera, settimanale e mensile. Drag-and-drop con notifica automatica via WhatsApp.",
    },
    {
      icon: "◎",
      title: "Storico Contatti",
      desc: "Traccia tutto ciò che è stato comunicato a ogni paziente e quali richiami sono già partiti.",
    },
    {
      icon: "↻",
      title: "Richiami Automatici",
      desc: "Ricorda ai pazienti igiene e controlli periodici via WhatsApp. Nessun paziente dimenticato.",
    },
    {
      icon: "◆",
      title: "Bot WhatsApp",
      desc: "I pazienti prenotano, confermano e ricevono promemoria su WhatsApp. Zero app da scaricare.",
      wide: true,
    },
  ];
  return (
    <section
      id="features"
      style={{ position: "relative", zIndex: 1, padding: "0 36px 110px" }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div className="reveal" style={{ marginBottom: 52 }}>
          <span
            className="lp-badge lp-badge-green"
            style={{ marginBottom: 16, display: "inline-flex" }}
          >
            Funzionalità
          </span>
          <h2
            style={{
              fontSize: "clamp(28px,3.8vw,50px)",
              fontWeight: 700,
              letterSpacing: -1.5,
              textWrap: "pretty",
              maxWidth: 580,
            }}
          >
            Il lato paziente del tuo studio,{" "}
            <span style={{ color: THEME.accent }}>in un posto solo</span>
          </h2>
        </div>
        <div className="feat-grid">
          {feats.map((f, i) => (
            <div
              key={i}
              className="feat-card reveal"
              data-wide={f.wide ? "true" : "false"}
              style={{
                gridColumn: f.wide ? "span 2" : "span 1",
                transitionDelay: `${i * 80}ms`,
              }}
            >
              <span className="feat-icon">{f.icon}</span>
              <div className="feat-title">{f.title}</div>
              <div className="feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── WhatsApp Section (hardcoded green) ──────────────────────────────── */
function WhatsAppSection() {
  return (
    <section style={{ position: "relative", zIndex: 1, padding: "0 36px 120px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          className="lp-whats-grid"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,255,127,0.09) 0%, rgba(0,255,127,0.04) 100%)",
            border: "1.5px solid #00FF7F",
            borderRadius: 28,
            padding: "56px 64px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 72,
            alignItems: "center",
            boxShadow: "0 0 60px rgba(0,255,127,0.07)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PhoneFrame
              src="/landing/whatsapp-mockup.png"
              alt="WhatsApp bot Pippident"
              floatClass="float-r"
              glowColor="rgba(0,255,127,0.55)"
            />
          </div>
          <div className="reveal">
            <span
              className="lp-badge lp-badge-green"
              style={{ marginBottom: 20, display: "inline-flex", color: "#00FF7F" }}
            >
              WhatsApp integrato
            </span>
            <h2
              style={{
                fontSize: "clamp(26px,3.5vw,46px)",
                fontWeight: 700,
                letterSpacing: -1.5,
                marginBottom: 18,
                textWrap: "pretty",
                color: "#FFFFFF",
              }}
            >
              I tuoi pazienti usano già{" "}
              <span style={{ color: "#00FF7F" }}>WhatsApp</span>.{" "}
              <span style={{ color: "#FFFFFF" }}>Pippident anche.</span>
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "#7A9A82",
                lineHeight: 1.8,
                marginBottom: 32,
                textWrap: "pretty",
              }}
            >
              Il bot invia promemoria automatici, gestisce le conferme e permette ai
              pazienti di prenotare direttamente dal telefono — senza scaricare nessuna
              app.
            </p>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 13 }}>
              {[
                "Conferma appuntamenti con un semplice messaggio",
                "Promemoria automatici 48h e 2h prima",
                "Richiami periodici per igiene e controlli",
                "Prenotazione guidata direttamente in chat",
              ].map((t, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 11,
                    fontSize: 14.5,
                    color: "#00FF7F",
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ marginTop: 2, flexShrink: 0 }}>✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── AI Voice Section (hardcoded cyan) ───────────────────────────────── */
function AISection() {
  return (
    <section style={{ position: "relative", zIndex: 1, padding: "0 36px 120px" }}>
      <div
        className="lp-ai-grid"
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 72,
          alignItems: "center",
        }}
      >
        <div className="reveal">
          <span className="lp-badge lp-badge-text" style={{ marginBottom: 20, display: "inline-flex" }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#EEF8F1",
                display: "inline-block",
              }}
            />
            Agente AI Vocale
          </span>
          <h2
            style={{
              fontSize: "clamp(26px,3.5vw,46px)",
              fontWeight: 700,
              letterSpacing: -1.5,
              marginBottom: 18,
              textWrap: "pretty",
              color: "#FFFFFF",
            }}
          >
            Quando lo studio è chiuso,
            <br />
            risponde l&apos;<span style={{ color: "#00E5FF" }}>AI</span>
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#7A9A82",
              lineHeight: 1.8,
              marginBottom: 32,
              textWrap: "pretty",
            }}
          >
            L&apos;agente vocale risponde alle chiamate fuori orario, prenota o
            cancella appuntamenti e riduce i no-show — supportando il tuo team nelle
            ore in cui non puoi esserci.
          </p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 13 }}>
            {[
              "Prenota appuntamenti in autonomia",
              "Gestisce cancellazioni e modifiche",
              "Attivo solo fuori orario di studio",
              "Riduce i no-show con promemoria vocali",
            ].map((t, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 11,
                  fontSize: 14.5,
                  alignItems: "flex-start",
                  color: "#00E5FF",
                }}
              >
                <span style={{ marginTop: 2, flexShrink: 0, color: "#00E5FF" }}>✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <PhoneFrame
            src="/landing/ai-call-mockup.png"
            alt="Mockup chiamata AI"
            floatClass="float-l"
            glowColor="rgba(0,229,255,0.18)"
          />
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ─────────────────────────────────────────────────────────── */
function Pricing() {
  const plans = [
    {
      id: "base",
      name: "Base",
      sub: "Solo gestore pazienti",
      price: 99,
      feats: [
        "Rubrica pazienti",
        "Agenda appuntamenti",
        "Storico contatti e richiami",
        "Supporto via email",
      ],
    },
    {
      id: "growth",
      name: "Growth",
      sub: "Fino a 1.000 pazienti",
      price: 349,
      feats: [
        "Tutto il piano Base",
        "WhatsApp Bot integrato",
        "150 chiamate AI/mese",
        "Promemoria via WhatsApp",
        "Prenotazioni via WhatsApp",
      ],
      hot: true,
    },
    {
      id: "pro",
      name: "Pro",
      sub: "Fino a 2.500 pazienti",
      price: 599,
      feats: [
        "Tutto il piano Growth",
        "250 chiamate AI/mese",
        "Supporto prioritario",
      ],
    },
    {
      id: "clinic",
      name: "Clinic",
      sub: "Fino a 6.000 pazienti",
      price: 799,
      feats: [
        "Tutto il piano Pro",
        "500 chiamate AI/mese",
        "Supporto dedicato",
        "Onboarding personalizzato",
      ],
    },
  ];

  return (
    <section
      id="prezzi"
      style={{ position: "relative", zIndex: 1, padding: "0 36px 120px" }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 56 }}>
          <span
            className="lp-badge lp-badge-green"
            style={{ marginBottom: 16, display: "inline-flex" }}
          >
            Prezzi
          </span>
          <h2
            style={{
              fontSize: "clamp(28px,4vw,52px)",
              fontWeight: 700,
              letterSpacing: -1.5,
            }}
          >
            Piani semplici e trasparenti
          </h2>
          <p style={{ color: "#5A7A62", marginTop: 10, fontSize: 16 }}>
            Nessun costo nascosto. Disdici quando vuoi.
          </p>
        </div>
        <div className="pricing-grid">
          {plans.map((p, i) => (
            <div
              key={p.id}
              className={`price-card reveal ${p.hot ? "featured" : ""}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              {p.hot && <div className="price-badge">PIÙ SCELTO</div>}
              <div style={{ fontSize: 12, color: "#3A5542", marginBottom: 6 }}>
                {p.sub}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  marginBottom: 14,
                  letterSpacing: -0.3,
                }}
              >
                {p.name}
              </div>
              <div style={{ marginBottom: 22 }}>
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 700,
                    color: p.hot ? THEME.accent : "#EEF8F1",
                    letterSpacing: -1.5,
                  }}
                >
                  €{p.price}
                </span>
                <span style={{ fontSize: 13, color: "#3A5542" }}>/mese</span>
              </div>
              <ul
                style={{
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  marginBottom: 24,
                }}
              >
                {p.feats.map((f, j) => (
                  <li
                    key={j}
                    style={{
                      display: "flex",
                      gap: 9,
                      fontSize: 13,
                      color: "#7A9A82",
                      alignItems: "flex-start",
                    }}
                  >
                    <span style={{ color: THEME.accent, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/checkout?plan=${p.id}`}
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "12px",
                  borderRadius: 12,
                  fontWeight: 700,
                  fontSize: 13.5,
                  textDecoration: "none",
                  background: p.hot ? THEME.accent : "rgba(255,255,255,0.04)",
                  color: p.hot ? THEME.bg : "#EEF8F1",
                  border: p.hot ? "none" : "1px solid rgba(255,255,255,0.08)",
                  transition: "all .2s",
                }}
              >
                Inizia gratis
              </Link>
            </div>
          ))}
        </div>
        <p
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 12.5,
            color: "#3A5542",
          }}
        >
          Chiamate extra +€0.50/call · 15 giorni di prova gratuita per tutti i piani ·
          Aggiorna o cancella in qualsiasi momento
        </p>
      </div>
    </section>
  );
}

/* ── Testimonials ────────────────────────────────────────────────────── */
function Testimonials() {
  const items = [
    {
      q: "Pippident si è affiancato senza toccare il resto: tre ore a settimana risparmiate e no-show calati del 40%.",
      name: "Dott. Marco Ferretti",
      role: "Titolare, Studio Ferretti — Milano",
      init: "MF",
    },
    {
      q: "I pazienti ricevono i promemoria su WhatsApp, nessuno scarica app, e la segreteria passa molto meno tempo al telefono.",
      name: "Dott.ssa Laura Conti",
      role: "Ortodontista — Roma",
      init: "LC",
    },
    {
      q: "Con Pippident ho finalmente una vista ordinata di appuntamenti e richiami in scadenza, senza dover cambiare il resto.",
      name: "Dott. Gianluca Russo",
      role: "Studio Russo & Partners — Napoli",
      init: "GR",
    },
  ];
  return (
    <section style={{ position: "relative", zIndex: 1, padding: "0 36px 110px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 52 }}>
          <span
            className="lp-badge lp-badge-green"
            style={{ marginBottom: 16, display: "inline-flex" }}
          >
            Testimonianze
          </span>
          <h2
            style={{
              fontSize: "clamp(26px,3.5vw,46px)",
              fontWeight: 700,
              letterSpacing: -1.5,
            }}
          >
            Cosa dicono i dentisti che lo usano
          </h2>
        </div>
        <div className="lp-testi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {items.map((t, i) => (
            <div
              key={i}
              className="testi-card reveal"
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <p
                style={{
                  fontSize: 14.5,
                  color: "#AACBB5",
                  lineHeight: 1.78,
                  marginBottom: 22,
                  fontStyle: "italic",
                }}
              >
                &ldquo;{t.q}&rdquo;
              </p>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div className="testi-avatar">{t.init}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "#3A5542", marginTop: 2 }}>
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Trust ───────────────────────────────────────────────────────────── */
function Trust() {
  const items = [
    {
      icon: "⚿",
      t: "GDPR Compliant",
      d: "I dati sanitari dei pazienti sono protetti secondo la normativa europea.",
    },
    {
      icon: "◈",
      t: "99.5% Uptime",
      d: "Infrastruttura su Vercel + Neon DB con backup automatici giornalieri.",
    },
    {
      icon: "⊕",
      t: "Si affianca, non sostituisce",
      d: "Convive col tuo gestionale clinico: gestisci i pazienti senza cambiare workflow.",
    },
  ];
  return (
    <section style={{ position: "relative", zIndex: 1, padding: "0 36px 110px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          className="reveal lp-trust-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            background: `rgba(${THEME.glowRgb},0.04)`,
            border: `1px solid rgba(${THEME.glowRgb},0.09)`,
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {items.map((t, i) => (
            <div
              key={i}
              style={{
                padding: "34px 28px",
                borderRight:
                  i < 2 ? `1px solid rgba(${THEME.glowRgb},0.07)` : "none",
              }}
            >
              <div
                style={{ fontSize: 26, marginBottom: 14, color: THEME.accent }}
              >
                {t.icon}
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  marginBottom: 9,
                  letterSpacing: -0.2,
                }}
              >
                {t.t}
              </div>
              <p style={{ fontSize: 13.5, color: "#5A7A62", lineHeight: 1.7 }}>
                {t.d}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── CTA ─────────────────────────────────────────────────────────────── */
function CTA() {
  return (
    <section style={{ position: "relative", zIndex: 1, padding: "0 36px 100px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          className="reveal"
          style={{
            background: `linear-gradient(135deg, rgba(${THEME.glowRgb},0.1) 0%, rgba(0,229,255,0.06) 100%)`,
            border: `1px solid rgba(${THEME.glowRgb},0.18)`,
            borderRadius: 28,
            padding: "68px 56px",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            className="glow-blob"
            style={{
              width: 600,
              height: 280,
              background: `radial-gradient(ellipse, rgba(${THEME.glowRgb},0.1) 0%, transparent 70%)`,
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              animation: "lp-glowPulse 4s ease-in-out infinite",
            }}
          />
          <h2
            style={{
              fontSize: "clamp(26px,4vw,54px)",
              fontWeight: 700,
              letterSpacing: -2,
              marginBottom: 14,
              position: "relative",
              zIndex: 1,
              textWrap: "pretty",
            }}
          >
            Pronto ad affiancare Pippident
            <br />
            al tuo gestionale?
          </h2>
          <p
            style={{
              fontSize: 17,
              color: "#7A9A82",
              marginBottom: 36,
              position: "relative",
              zIndex: 1,
            }}
          >
            Inizia oggi con 15 giorni gratuiti. Nessuna carta di credito richiesta.
          </p>
          <a
            href="#prezzi"
            className="btn-primary"
            style={{
              fontSize: 16,
              padding: "16px 38px",
              position: "relative",
              zIndex: 1,
            }}
          >
            Inizia gratis ora
          </a>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ position: "relative", zIndex: 1, padding: "0 36px 48px" }}>
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: 28,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: -0.5,
            color: "#FFFFFF",
          }}
        >
          pip<span style={{ color: THEME.accent }}>p</span>ident
        </div>
        <div style={{ fontSize: 12.5, color: "#2A3D2E" }}>
          © 2026 Pippident. Tutti i diritti riservati.
        </div>
        <div style={{ display: "flex", gap: 20, fontSize: 12.5 }}>
          <a href="#" style={{ color: "#3A5542", textDecoration: "none" }}>
            Privacy Policy
          </a>
          <a href="#" style={{ color: "#3A5542", textDecoration: "none" }}>
            Termini di Servizio
          </a>
          <Link href="/login" style={{ color: "#3A5542", textDecoration: "none" }}>
            Accedi
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ── Root component ──────────────────────────────────────────────────── */
export function LandingPage() {
  useGlobalReveal();
  return (
    <div className="landing">
      <div className="bg-mesh" />
      <div className="bg-grid" />
      <Nav />
      <main>
        <Hero />
        <Stats />
        <Features />
        <WhatsAppSection />
        <AISection />
        <Pricing />
        <Testimonials />
        <Trust />
        <CTA />
        <Footer />
      </main>
    </div>
  );
}
