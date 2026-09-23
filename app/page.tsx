import Link from "next/link";
import { MessageSquarePlus, Search, Wrench, ShieldCheck } from "lucide-react";

const TILES = [
  {
    href: "/complaint",
    icon: MessageSquarePlus,
    title: "Raise a complaint",
    titleHi: "शिकायत दर्ज करें",
    desc: "Report a problem in your quarter. You get a token on the spot.",
    descHi: "अपने क्वार्टर की समस्या बताएं। तुरंत टोकन मिलेगा।",
  },
  {
    href: "/status",
    icon: Search,
    title: "Check status",
    titleHi: "स्थिति देखें",
    desc: "Look up a complaint with its token, or by your address if you lost it.",
    descHi: "टोकन से देखें, या टोकन खो जाने पर अपने पते से।",
  },
  {
    href: "/resolve",
    icon: Wrench,
    title: "Record work done",
    titleHi: "किया गया कार्य दर्ज करें",
    desc: "For staff — close a resident's complaint, or log road cleaning and garbage rounds.",
    descHi: "कर्मचारी — निवासी की शिकायत बंद करें, या सड़क सफाई व कचरा संग्रहण दर्ज करें।",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Town Office Portal
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            SCP Township Help Desk
          </h1>
          <p className="hi mt-1 text-sm text-muted">
            एससीपी टाउनशिप हेल्प डेस्क
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <ul className="grid gap-3">
          {TILES.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="flex items-start gap-4 rounded-card border border-border bg-surface p-4 shadow-sm transition hover:border-primary hover:shadow-md active:scale-[0.995]"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <t.icon size={24} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{t.title}</span>
                  <span className="hi block text-sm text-muted">{t.titleHi}</span>
                  <span className="mt-1.5 block text-sm text-muted">{t.desc}</span>
                  <span className="hi block text-sm text-muted">{t.descHi}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/admin"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted hover:text-text"
        >
          <ShieldCheck size={16} />
          Town office dashboard
        </Link>
      </main>

      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">
        Every complaint is logged and tracked to closure.
        <span className="hi block">हर शिकायत दर्ज होती है और बंद होने तक ट्रैक की जाती है।</span>
      </footer>
    </div>
  );
}
