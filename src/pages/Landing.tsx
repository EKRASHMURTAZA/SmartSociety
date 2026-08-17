import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarCheck2, Check, ChevronRight, Menu, ShieldCheck, X, WalletCards, MessageSquareText } from "lucide-react";

const IMG = {
  hero: "/marby/DZDB68x0iH9gI8PIm8rsA5A3Qo.jpg",
  night: "/marby/FErs8IfWxpBcZKQWKJBGw7lGfc.jpg",
  modern: "/marby/JlWeAxSOx6k7op26IlcSI0GQPQ.jpg",
  villa: "/marby/qH5xVjb1S38d5caXLweD8Cz3ss.png",
  pool: "/marby/zoANF4gCl0veXWAJdOn0FvSQRJE.png",
};

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { threshold: 0.12 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`ss-reveal ${visible ? "is-visible" : ""} ${className}`}>{children}</div>;
}

const features = [
  { icon: ShieldCheck, title: "Security, without friction", text: "Visitor passes, QR verification, gate activity and live status stay connected." },
  { icon: WalletCards, title: "Bills made simple", text: "See dues, line items, payment status and receipts without hunting through messages." },
  { icon: CalendarCheck2, title: "Spaces that work", text: "Discover amenities, time slots and bookings from one calm, predictable workspace." },
  { icon: MessageSquareText, title: "A society that responds", text: "Raise complaints, follow progress and get useful updates from the community." },
];

export function Landing() {
  return <div className="ss-site">
    <LandingNav />
    <main>
      <section className="ss-hero"><div className="ss-hero-glow" aria-hidden="true" /><div className="ss-container ss-hero-grid">
        <Reveal className="ss-hero-copy"><div className="ss-kicker"><span /> SMART COMMUNITY MANAGEMENT</div><h1>Life in your society, <em>beautifully organised.</em></h1><p>SmartSociety brings residents, security and operations together in one elegant, secure workspace — from the front gate to the monthly bill.</p><div className="ss-actions"><Link to="/register" className="ss-button ss-button-dark">Create your account <ArrowUpRight size={17} /></Link><Link to="/login" className="ss-button ss-button-light">Sign in <ChevronRight size={17} /></Link></div><div className="ss-trust-row"><div className="ss-avatar-stack" aria-hidden="true"><img src="/avatars/resident.png" alt="" /><img src="/avatars/guard.png" alt="" /><img src="/avatars/admin.png" alt="" /><img src="/avatars/maintenance.png" alt="" /></div><span><strong>One connected community</strong><br />Residents · Security · Administration · Maintenance</span></div></Reveal>
        <Reveal className="ss-hero-art"><div className="ss-image-frame ss-image-frame-large"><img src={IMG.hero} alt="Modern residential community" /><div className="ss-image-caption"><span>01 / COMMUNITY</span><strong>Designed around everyday life.</strong></div></div><div className="ss-floating-card ss-floating-card-top"><span className="ss-live-dot" /> API &amp; services connected <strong>Live</strong></div><div className="ss-floating-card ss-floating-card-bottom"><ShieldCheck size={18} /><div><strong>Visitor approved</strong><span>QR pass · Gate 1 · verified</span></div><Check size={17} /></div></Reveal>
      </div></section>

      <section className="ss-marquee" aria-label="SmartSociety capabilities"><div className="ss-marquee-track">{Array.from({ length: 2 }).flatMap((_, group) => ["VISITORS", "SECURITY", "BILLS", "AMENITIES", "COMPLAINTS", "NOTICES", "AI ASSISTANT", "REAL-TIME UPDATES"].map(item => <span key={`${group}-${item}`}>{item} <i>✦</i></span>))}</div></section>

      <section id="features" className="ss-section ss-section-light"><div className="ss-container"><Reveal className="ss-section-heading"><div><div className="ss-kicker"><span /> ONE PLACE, EVERY DETAIL</div><h2>Everything a modern society needs.</h2></div><p>Built around real resident workflows, with role-aware access and a backend that keeps the data authoritative.</p></Reveal><div className="ss-feature-grid">{features.map(({ icon: Icon, title, text }, index) => <Reveal key={title} className="ss-feature-card"><span className="ss-feature-number">0{index + 1}</span><Icon size={25} strokeWidth={1.5} /><h3>{title}</h3><p>{text}</p><Link to="/login">Explore <ArrowUpRight size={15} /></Link></Reveal>)}</div></div></section>

      <section className="ss-section ss-dark-section"><div className="ss-container ss-split"><Reveal className="ss-split-image"><img src={IMG.night} alt="Residential building at dusk" /><span>SECURITY · 24 / 7</span></Reveal><Reveal className="ss-split-copy"><div className="ss-kicker ss-kicker-light"><span /> THE SMARTSOCIETY DIFFERENCE</div><h2>Quiet design. Serious infrastructure.</h2><p>The interface stays calm while the platform handles the complicated parts: authentication, permissions, visitor workflows, complaints, bookings, billing, notifications and AI-assisted help.</p><ul><li><Check /> Role-based access for every workspace</li><li><Check /> Live API health and notification streams</li><li><Check /> Image uploads for profiles, visitors and complaints</li><li><Check /> Multilingual Society Assistant with knowledge base support</li></ul><Link to="/how-it-works" className="ss-text-link">See how it works <ArrowUpRight size={16} /></Link></Reveal></div></section>

      <section className="ss-section ss-section-light"><div className="ss-container"><Reveal className="ss-editorial-heading"><div className="ss-kicker"><span /> MADE FOR REAL PEOPLE</div><div><h2>From the gate to the clubhouse.</h2><p>Every role gets the information and actions they actually need — without turning the society into another complicated enterprise system.</p></div></Reveal><div className="ss-editorial-grid"><div className="ss-editorial-large"><img src={IMG.modern} alt="Modern home" /><div><span>RESIDENT</span><strong>Your day, at a glance.</strong><p>Visitors, bills, amenities, complaints and community updates.</p></div></div><div className="ss-editorial-stack"><div className="ss-editorial-small"><img src={IMG.villa} alt="Residential villa" /><div><span>SECURITY</span><strong>Every entry verified.</strong></div></div><div className="ss-editorial-small"><img src={IMG.pool} alt="Luxury community pool" /><div><span>AMENITIES</span><strong>Spaces worth using.</strong></div></div></div></div></div></section>

      <section className="ss-section ss-cta-section"><div className="ss-container ss-cta"><Reveal><div className="ss-kicker"><span /> READY WHEN YOU ARE</div><h2>Your society deserves a better front door.</h2><p>Start with your account. The same secure workspace follows you from sign-in to everyday community life.</p><div className="ss-actions ss-actions-center"><Link to="/register" className="ss-button ss-button-dark">Get started <ArrowUpRight size={17} /></Link><Link to="/contact" className="ss-button ss-button-light">Talk to us <ArrowUpRight size={17} /></Link></div></Reveal></div></section>
    </main>
    <footer className="ss-footer"><div className="ss-container ss-footer-inner"><div><strong>Smart<span>Society</span></strong><p>Modern community operations, thoughtfully designed.</p></div><div className="ss-footer-links"><Link to="/about">About</Link><Link to="/how-it-works">How it works</Link><Link to="/privacy">Privacy</Link><Link to="/contact">Contact</Link></div><span>© {new Date().getFullYear()} SmartSociety</span></div></footer>
  </div>;
}

function LandingNav() {
  const [open, setOpen] = useState(false);
  return <header className="ss-nav"><div className="ss-container ss-nav-inner"><Link to="/" className="ss-wordmark">Smart<span>Society</span><small>MAPLE HEIGHTS</small></Link><nav className={open ? "ss-mobile-open" : ""}><Link to="/#features" onClick={() => setOpen(false)}>Features</Link><Link to="/how-it-works" onClick={() => setOpen(false)}>How it works</Link><Link to="/about" onClick={() => setOpen(false)}>About</Link><Link to="/contact" onClick={() => setOpen(false)}>Contact</Link><Link className="ss-nav-cta" to="/login" onClick={() => setOpen(false)}>Resident login <ArrowUpRight size={15} /></Link></nav><button className="ss-menu" onClick={() => setOpen(v => !v)} aria-label="Toggle navigation">{open ? <X /> : <Menu />}</button></div></header>;
}
