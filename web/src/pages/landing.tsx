import { FormEvent, useState, type ReactNode } from "react";
import { CircleCheck, MessageSquare, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AssistantChrome } from "../components/assistant-chrome";
import { BrandLink } from "../components/brand";
import { useSession } from "../lib/auth";

const NAV_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
] as const;

const HOW_CARDS = [
  {
    title: "Connect the team",
    description:
      "Invite the people who need the record so proposals, comments, and outcomes stay in one vault.",
    icon: <Users className="size-4" strokeWidth={2.1} />,
    featured: false,
  },
  {
    title: "Capture decisions",
    description:
      "Write what was considered and why, then keep review on the decision instead of a disappearing thread.",
    icon: <CircleCheck className="size-4" strokeWidth={2.1} />,
    featured: true,
  },
  {
    title: "Ask with approved context",
    description:
      "Once signed off, the assistant answers from that approved record — not from whoever still remembers the thread.",
    icon: <MessageSquare className="size-4" strokeWidth={2.1} />,
    featured: false,
  },
] as const;

function NavPill({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "landing-nav-pill landing-nav-pill-compact" : "landing-nav-pill"}>
      {NAV_LINKS.map((item, index) => (
        <a
          className={index === 0 ? "is-active" : undefined}
          href={item.href}
          key={`${item.href}-${compact ? "mobile" : "desktop"}`}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}

function HowCard({
  title,
  description,
  icon,
  featured = false,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  featured?: boolean;
}) {
  return (
    <article className={featured ? "how-card is-featured" : "how-card"}>
      <div className="how-card-head">
        <span className="how-card-icon" aria-hidden="true">
          {icon}
        </span>
        <h3>{title}</h3>
      </div>
      <p>{description}</p>
    </article>
  );
}

export function LandingPage() {
  const session = useSession();
  const navigate = useNavigate();
  const signedIn = Boolean(session.data?.user);
  const [prompt, setPrompt] = useState("");
  const [grounded, setGrounded] = useState(true);

  function onAsk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(signedIn ? "/app" : "/sign-up");
  }

  return (
    <main className="landing-page" id="home">
      <nav className="landing-nav">
        <div className="landing-nav-row">
          <BrandLink className="landing-logo" to="/" />
          <div className="landing-nav-center">
            <NavPill />
          </div>
          <div className="landing-nav-actions">
            {signedIn ? (
              <Link className="landing-cta" to="/app">
                Open workspace
              </Link>
            ) : (
              <>
                <Link className="landing-sign-in" to="/sign-in">
                  Sign In
                </Link>
                <Link className="landing-cta" to="/sign-up">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="landing-nav-mobile">
          <NavPill compact />
        </div>
      </nav>

      <section className="landing-hero">
        <h1>Experience the Next Era of Shared Decisions.</h1>
        <p>
          Keep proposals, reasoning, and outcomes in one reviewable place. Connect your team,
          approve with context, and let the assistant answer from what you already decided.
        </p>

        <AssistantChrome
          variant="hero"
          mode="preview"
          prompt={prompt}
          onPromptChange={setPrompt}
          onSubmit={onAsk}
          submitAriaLabel={signedIn ? "Open workspace" : "Get started"}
          grounded={grounded}
          onGroundedChange={setGrounded}
        />
      </section>

      <section className="landing-section landing-how" id="features">
        <p className="landing-how-badge">How it works</p>
        <h2>Explore Mindvault&apos;s power in real time.</h2>
        <p className="landing-how-copy">
          Connect the team, capture the decision, then ask with the context you already approved.
        </p>
        <div className="landing-how-grid">
          {HOW_CARDS.map((card) => (
            <HowCard
              description={card.description}
              featured={card.featured}
              icon={card.icon}
              key={card.title}
              title={card.title}
            />
          ))}
        </div>
      </section>

      <section className="landing-section landing-section-last" id="workflow">
        <p className="landing-kicker">Workflow</p>
        <h2>Propose, review, then ask with confidence.</h2>
        <div className="landing-grid landing-grid-steps">
          <article className="landing-card">
            <span>01</span>
            <h3>Write the decision</h3>
            <p>Start from a proposal so the record includes what was considered, not only what shipped.</p>
          </article>
          <article className="landing-card">
            <span>02</span>
            <h3>Review together</h3>
            <p>Comments and status stay on the decision, with roles that match how your team actually works.</p>
          </article>
          <article className="landing-card">
            <span>03</span>
            <h3>Ask the vault</h3>
            <p>Once approved, the assistant can explain the choice using the context your team already signed off on.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
