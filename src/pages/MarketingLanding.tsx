import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Menu,
  MessageSquareMore,
  Megaphone,
  MonitorSmartphone,
  Receipt,
  SearchCheck,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react';

const shopTypes = [
  {
    title: 'Cell phone repair',
    description: 'Book in devices, manage diagnostics, approve quotes, and move repairs from intake to collection without losing context.',
    icon: Smartphone,
    accent: 'from-[#d26a33] to-[#f0b06c]',
  },
  {
    title: 'Electronics retail',
    description: 'Sell accessories, devices, and services with proper margin visibility, customer history, and cleaner stock control.',
    icon: Store,
    accent: 'from-[#214e5f] to-[#4d7889]',
  },
  {
    title: 'Multi-branch operators',
    description: 'Run stock transfers, branch comparisons, shared reporting, and permission layers from one operating system.',
    icon: MonitorSmartphone,
    accent: 'from-[#7c4a26] to-[#214e5f]',
  },
];

const operatingSystemCards = [
  {
    eyebrow: 'Point of sale',
    title: 'Take payments, close invoices, and keep the front counter moving.',
    copy: 'Sales, invoices, customer lookup, and repair collections live in one flow instead of four disconnected tools.',
    icon: CreditCard,
  },
  {
    eyebrow: 'Repair queue',
    title: 'Run intake, diagnostics, approvals, notes, and collection reminders.',
    copy: 'Give technicians and front-desk staff one shared repair picture with better accountability and less confusion.',
    icon: Wrench,
  },
  {
    eyebrow: 'Inventory control',
    title: 'Track stock, IMEIs, stock takes, purchase orders, and transfers.',
    copy: 'Reduce shrinkage, buy with more discipline, and keep your fast-moving items under control.',
    icon: Boxes,
  },
  {
    eyebrow: 'CRM and retention',
    title: 'See every customer, device, sale, repair, warranty, and follow-up in one timeline.',
    copy: 'Appleberry OS turns customer memory into a commercial advantage instead of scattered notes and missed opportunities.',
    icon: Users,
  },
];

const growthFeatures = [
  {
    title: 'Campaigns and automations',
    copy: 'Send collection nudges, comeback offers, warranty follow-ups, and review requests from one place.',
    icon: Megaphone,
  },
  {
    title: 'WhatsApp and email',
    copy: 'Use one system for invoices, reminders, invites, approvals, and customer follow-through.',
    icon: MessageSquareMore,
  },
  {
    title: 'Reports owners actually use',
    copy: 'Track revenue, margins, stock risk, repair throughput, and branch performance without spreadsheet chaos.',
    icon: BarChart3,
  },
  {
    title: 'Safe staff onboarding',
    copy: 'Invite-only accounts, permission presets, role controls, and tighter operational access for real teams.',
    icon: ShieldCheck,
  },
];

const proofPoints = [
  { value: 'Repairs + POS + CRM', label: 'One operating system instead of disconnected store tools.' },
  { value: 'Invite-only access', label: 'Cleaner staff onboarding with permissions and owner control.' },
  { value: 'Retail to branch scale', label: 'Built for single stores now and multi-branch growth later.' },
];

const valuePillars = [
  {
    title: 'Faster front counter',
    copy: 'Move from customer intake to payment without hopping across disconnected tools.',
    icon: Receipt,
  },
  {
    title: 'Better stock discipline',
    copy: 'Use purchase orders, stock takes, transfers, and alerts to tighten operational control.',
    icon: Truck,
  },
  {
    title: 'Clear customer memory',
    copy: 'Track repairs, invoices, messages, warranties, and notes inside one customer record.',
    icon: SearchCheck,
  },
  {
    title: 'Commercial follow-through',
    copy: 'Turn everyday service activity into repeat revenue through CRM and marketing workflows.',
    icon: Sparkles,
  },
];

const pricingPlans = [
  {
    title: 'Starter',
    price: 'R799/mo',
    copy: 'For one store replacing spreadsheets, notebooks, and disconnected repair tools.',
    bullets: ['POS and invoices', 'Repair queue', 'Customer records', 'Inventory basics'],
    featured: false,
  },
  {
    title: 'Growth',
    price: 'R1,499/mo',
    copy: 'For serious operators who want CRM, reporting, stock controls, and stronger workflows.',
    bullets: ['Everything in Starter', 'Stock take and purchase orders', 'Campaigns and automations', 'Operational reporting'],
    featured: true,
  },
  {
    title: 'Multi-Branch',
    price: 'Custom',
    copy: 'For businesses running multiple teams, larger stock movement, and stricter control.',
    bullets: ['Branch-aware operations', 'Transfers and permissions', 'Migration support', 'Growth planning'],
    featured: false,
  },
];

const faqs = [
  {
    question: 'Can Appleberry OS handle both repairs and retail sales?',
    answer:
      'Yes. It is designed for stores that repair devices, sell stock, trade devices, manage parts, and need customer history in one place.',
  },
  {
    question: 'Do you support CRM and marketing tools too?',
    answer:
      'Yes. The direction includes CRM timelines, customer segmentation, WhatsApp and email campaigns, pickup reminders, and retention workflows.',
  },
  {
    question: 'Can we import from another system?',
    answer:
      'Yes. Appleberry OS already supports migration workflows for customers, inventory, repairs, sales history, and stock take data so teams can test before going live.',
  },
  {
    question: 'Is it suitable for multiple branches?',
    answer:
      'Yes. The platform is being built with branch-aware operations, transfers, permissions, reporting, and owner-level visibility in mind.',
  },
  {
    question: 'How do staff get access?',
    answer:
      'Owners and admins invite staff members, assign permissions, and send activation links. Staff then create their own password and sign in securely.',
  },
];

export default function MarketingLanding() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fbf6ef_0%,#f4ebdf_100%)]">
      <header className="sticky top-0 z-40 border-b border-[#e5d6c5] bg-[rgba(251,246,239,0.92)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="brand-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-xl font-bold text-white sm:h-12 sm:w-12">
              A
            </div>
            <div className="min-w-0">
              <p className="display-font truncate text-xl font-bold leading-none text-[#18242b] sm:text-2xl">Appleberry OS</p>
              <p className="truncate text-[10px] uppercase tracking-[0.2em] text-[#7b5c3c] sm:text-[11px] sm:tracking-[0.24em]">
                Repair Commerce Platform
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            <a href="#shop-types" className="text-sm font-medium text-[#34454d] hover:text-[#c65a22]">Shop types</a>
            <a href="#platform" className="text-sm font-medium text-[#34454d] hover:text-[#c65a22]">Platform</a>
            <a href="#growth" className="text-sm font-medium text-[#34454d] hover:text-[#c65a22]">CRM & Marketing</a>
            <a href="#pricing" className="text-sm font-medium text-[#34454d] hover:text-[#c65a22]">Pricing</a>
            <a href="#faq" className="text-sm font-medium text-[#34454d] hover:text-[#c65a22]">FAQ</a>
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl border border-[#d8c4af] bg-white/80 px-4 py-2 text-sm font-semibold text-[#214e5f] transition hover:bg-white"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="appleberry-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(198,90,34,0.18)] transition hover:opacity-90"
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-xl border border-[#d8c4af] bg-white/80 px-3 py-2 text-xs font-semibold text-[#214e5f]"
            >
              Trial
            </Link>
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-xl border border-[#d8c4af] bg-white/80 p-2.5 text-[#214e5f]"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-[#e5d6c5] bg-[rgba(251,246,239,0.98)] px-4 py-4 sm:hidden">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7b5c3c]">Explore</p>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-xl border border-[#d8c4af] bg-white/80 p-2 text-[#214e5f]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-2">
              {[
                ['Shop types', '#shop-types'],
                ['Platform', '#platform'],
                ['CRM & Marketing', '#growth'],
                ['Pricing', '#pricing'],
                ['FAQ', '#faq'],
              ].map(([label, href]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-2xl border border-[#e5d6c5] bg-white/80 px-4 py-3 text-sm font-medium text-[#34454d]"
                >
                  {label}
                </a>
              ))}
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className="mt-2 rounded-2xl border border-[#214e5f] bg-[#214e5f] px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
          <div className="absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(circle_at_top_right,rgba(33,78,95,0.18),transparent_28%),radial-gradient(circle_at_left,rgba(198,90,34,0.18),transparent_22%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1.02fr_0.98fr]">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#7b5c3c]">All-in-one POS and repair commerce software</p>
              <h1 className="display-font max-w-4xl text-4xl font-bold leading-[0.96] text-[#18242b] sm:text-6xl lg:text-7xl">
                Run repairs, retail, CRM, inventory, and growth from one operating system.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[#516068] sm:text-lg sm:leading-8">
                Appleberry OS is built for cell phone repair shops, electronics retailers, buy-sell-trade operators, and multi-branch teams who want more control and less chaos.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="appleberry-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(198,90,34,0.22)] transition hover:opacity-90"
                >
                  Start your Appleberry OS trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#platform"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#d8c4af] bg-white/75 px-6 py-4 text-base font-semibold text-[#214e5f] transition hover:bg-white"
                >
                  Explore the platform
                </a>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {proofPoints.map((point) => (
                  <div key={point.label} className="section-card rounded-[24px] p-5">
                    <p className="display-font text-2xl font-bold text-[#18242b]">{point.value}</p>
                    <p className="mt-2 text-sm leading-6 text-[#5d6468]">{point.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="hero-card relative rounded-[32px] p-4 sm:p-7">
                <div className="soft-grid absolute inset-0 rounded-[32px] opacity-35" />
                <HeroMockup />
              </div>
            </div>
          </div>
        </section>

        <section id="shop-types" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Choose your shop type</p>
              <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                Built for the businesses that repair, sell, source, and scale devices.
              </h2>
              <p className="mx-auto mt-4 max-w-3xl text-base text-[#5d6468] sm:text-lg">
                Keep the clarity CellStore gets right, but with a more modern operating system underneath the work.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {shopTypes.map(({ title, description, icon: Icon, accent }) => (
                <div key={title} className="overflow-hidden rounded-[30px] border border-[rgba(141,111,77,0.14)] bg-[#fffaf4] shadow-[0_18px_34px_rgba(79,56,30,0.07)]">
                  <div className={`h-2 bg-gradient-to-r ${accent}`} />
                  <div className="p-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#efe0ce] text-[#214e5f]">
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="mt-6 display-font text-2xl font-bold text-[#18242b] sm:text-3xl">{title}</h3>
                    <p className="mt-4 text-sm leading-6 text-[#5d6468] sm:text-base sm:leading-7">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="platform" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Platform features</p>
                <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                  More than a repair POS. This is the operating layer.
                </h2>
              </div>
              <p className="max-w-2xl text-base leading-7 text-[#5d6468] sm:text-lg sm:leading-8">
                The strongest systems do not stop at checkout. They help teams organize, remember, automate, and grow.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {operatingSystemCards.map(({ eyebrow, title, copy, icon: Icon }) => (
                <div key={title} className="section-card rounded-[30px] p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b5c3c]">{eyebrow}</p>
                      <h3 className="mt-4 display-font text-3xl font-bold leading-tight text-[#18242b] sm:text-4xl">{title}</h3>
                    </div>
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#f2e4d3] text-[#214e5f]">
                      <Icon className="h-7 w-7" />
                    </div>
                  </div>
                  <p className="mt-5 text-base leading-7 text-[#5d6468]">{copy}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <WorkflowMockup />
              <AutomationMockup />
            </div>
          </div>
        </section>

        <section id="growth" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.94fr_1.06fr]">
            <div className="hero-card rounded-[32px] p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">CRM and marketing</p>
              <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                Keep every customer memory, every follow-up, and every comeback offer in one place.
              </h2>
              <p className="mt-5 text-base leading-7 text-[#4f5a60] sm:text-lg sm:leading-8">
                Appleberry OS should feel like the next step beyond tools that only manage tickets and sales. The stronger story is retention, trust, and revenue continuity.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  'Segment customers by spend, device type, branch, repair history, and warranty activity.',
                  'Automate WhatsApp and email nudges for collection, win-back campaigns, and review requests.',
                  'Track repeat work, customer value, and operational follow-through without spreadsheet cleanup.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#eadaca] bg-white/75 px-4 py-4">
                    <BadgeCheck className="mt-0.5 h-5 w-5 text-[#c65a22]" />
                    <p className="text-sm leading-6 text-[#4f5a60]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {growthFeatures.map(({ title, copy, icon: Icon }) => (
                <div key={title} className="section-card rounded-[28px] p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#e8d8c4] text-[#214e5f]">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-[#18242b]">{title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#5d6468]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[36px] bg-[#13252e] px-6 py-10 text-white sm:px-10 lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">Why serious companies switch</p>
                <h2 className="mt-3 display-font text-4xl font-bold leading-tight sm:text-5xl">
                  Less tool sprawl. More control. Better customer follow-through.
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {valuePillars.map(({ title, copy, icon: Icon }) => (
                  <div key={title} className="rounded-[24px] border border-white/10 bg-white/6 p-5">
                    <Icon className="h-6 w-6 text-[#f0b06c]" />
                    <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/70">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Pricing direction</p>
              <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                Simple pricing for operators who want real software, not complexity.
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.title}
                  className={`rounded-[30px] p-7 ${
                    plan.featured
                      ? 'appleberry-gradient text-white shadow-[0_26px_40px_rgba(198,90,34,0.2)]'
                      : 'section-card text-[#18242b]'
                  }`}
                >
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${plan.featured ? 'text-white/70' : 'text-[#7b5c3c]'}`}>
                    {plan.title}
                  </p>
                  <p className="mt-4 display-font text-4xl font-bold sm:text-5xl">{plan.price}</p>
                  <p className={`mt-4 text-base leading-7 ${plan.featured ? 'text-white/84' : 'text-[#5d6468]'}`}>{plan.copy}</p>
                  <div className={`mt-6 h-px ${plan.featured ? 'bg-white/20' : 'bg-[#e4d2bd]'}`} />
                  <div className="mt-6 space-y-3">
                    {plan.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-3">
                        <BadgeCheck className={`mt-0.5 h-5 w-5 ${plan.featured ? 'text-[#fff0d5]' : 'text-[#c65a22]'}`} />
                        <p className={`text-sm leading-6 ${plan.featured ? 'text-white/84' : 'text-[#4f5a60]'}`}>{bullet}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/login"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold transition ${
                      plan.featured ? 'bg-white text-[#18242b] hover:bg-[#fff3df]' : 'bg-[#18242b] text-white hover:bg-[#214e5f]'
                    }`}
                  >
                    Talk to sales
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Frequently asked questions</p>
              <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                Questions serious operators ask before they switch.
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => {
                const open = openFaq === index;
                return (
                  <div key={faq.question} className="section-card overflow-hidden rounded-[24px]">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? -1 : index)}
                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                    >
                      <span className="text-base font-semibold text-[#18242b] sm:text-lg">{faq.question}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-[#214e5f] transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="border-t border-[#eadaca] px-6 py-5 text-base leading-7 text-[#5d6468]">{faq.answer}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[36px] bg-[linear-gradient(135deg,#dfe7f0_0%,#f1e6d8_52%,#f9f3ea_100%)] px-6 py-12 sm:px-10 lg:px-12">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Ready to move properly?</p>
                <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                  Launch Appleberry OS with a platform that can actually grow with your repair company.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#4f5a60] sm:text-lg sm:leading-8">
                  Bring your POS, repairs, CRM, stock control, purchase orders, transfers, reporting, and marketing into one operating system.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  to="/login"
                  className="appleberry-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-white transition hover:opacity-90"
                >
                  Request a demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="mailto:hello@appleberryos.co.za"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#d9c4ae] bg-white/75 px-6 py-4 text-base font-semibold text-[#214e5f] transition hover:bg-white"
                >
                  Contact sales
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#0f222a] px-4 py-14 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="brand-badge flex h-12 w-12 items-center justify-center rounded-[18px] text-xl font-bold text-white">A</div>
              <div>
                <p className="display-font text-2xl font-bold">Appleberry OS</p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Repair Commerce Platform</p>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm leading-7 text-white/68">
              A modern operating system for repair stores, electronics retailers, buy-sell-trade teams, and ambitious multi-branch businesses.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">Platform</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/72">
              <li>Point of Sale</li>
              <li>Repairs</li>
              <li>CRM</li>
              <li>Marketing tools</li>
              <li>Inventory control</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">Operations</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/72">
              <li>Stock take</li>
              <li>Purchase orders</li>
              <li>Transfers</li>
              <li>Staff permissions</li>
              <li>Reporting</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">Contact</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/72">
              <li>hello@appleberryos.co.za</li>
              <li>South Africa</li>
              <li>Demo-led onboarding</li>
              <li>Migration support available</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-[#13252e] p-4 text-white shadow-[0_26px_60px_rgba(17,34,41,0.22)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Live operations board</p>
          <h2 className="mt-2 display-font text-2xl font-bold sm:text-3xl">Appleberry OS</h2>
        </div>
        <div className="w-fit rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Repair + Retail + CRM
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-[#0f1d24] p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#d46a30]" />
          <span className="h-3 w-3 rounded-full bg-[#f0b06c]" />
          <span className="h-3 w-3 rounded-full bg-[#3d7688]" />
          <div className="ml-2 rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/60">app.appleberryos.co.za</div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[20px] bg-white/6 p-4">
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {['Dashboard', 'Repairs', 'Customers', 'Inventory'].map((tab, index) => (
                <div
                  key={tab}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                    index === 0 ? 'bg-[#c65a22] text-white' : 'bg-white/6 text-white/65'
                  }`}
                >
                  {tab}
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Repairs queue', '182 open jobs', 'bg-[#214e5f]'],
                ['Sales today', 'R 34,740', 'bg-[#b85b26]'],
                ['Campaigns', '12 automations live', 'bg-[#6b4e35]'],
                ['Stock alerts', '27 items need action', 'bg-[#314b58]'],
              ].map(([label, value, tone]) => (
                <div key={label} className={`rounded-2xl ${tone} p-4`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/65">{label}</p>
                  <p className="mt-3 text-xl font-semibold text-white sm:text-2xl">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[20px] bg-[#f8f0e5] p-4 text-[#18242b]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#7b5c3c]">Customer heartbeat</p>
              <div className="mt-4 space-y-3">
                {[
                  'Repair ready for collection',
                  'Warranty customer due for follow-up',
                  'Promo campaign segment: high-value shoppers',
                  'Trade-in lead responded on WhatsApp',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-[#e3cfb7] bg-white px-4 py-3 text-sm font-medium text-[#33434b]">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[20px] bg-white/8 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">Business engine</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ['POS', CreditCard],
                  ['CRM', Users],
                  ['Marketing', Megaphone],
                  ['POs', ClipboardList],
                  ['Inventory', Boxes],
                  ['Reports', BarChart3],
                ].map(([label, Icon]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/8 p-3">
                    <Icon className="h-5 w-5 text-[#f0b06c]" />
                    <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowMockup() {
  return (
    <div className="section-card rounded-[30px] p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b5c3c]">Operational workflow</p>
      <h3 className="mt-3 display-font text-3xl font-bold text-[#18242b] sm:text-4xl">
        From intake to invoice, your whole team works off the same picture.
      </h3>
      <p className="mt-4 text-base leading-7 text-[#5d6468]">
        Repairs, approvals, parts, payments, and customer follow-through should be connected instead of scattered.
      </p>

      <div className="mt-6 rounded-[28px] border border-[#e6d7c6] bg-[#13252e] p-5 text-white">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            ['Booked in', '43 today', '#214e5f'],
            ['Diagnosing', '17 active', '#2d5e70'],
            ['Awaiting approval', '9 quotes', '#8b542c'],
            ['Ready to collect', '28 complete', '#c65a22'],
          ].map(([label, value, color]) => (
            <div key={label} className="rounded-[22px] p-4" style={{ backgroundColor: color }}>
              <p className="text-xs uppercase tracking-[0.18em] text-white/70">{label}</p>
              <p className="mt-4 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.95fr]">
          <div className="rounded-[24px] bg-white/8 p-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-sm font-semibold">Repair #R-20841</p>
                <p className="text-xs text-white/55">iPhone 13 Pro Max | Jan Botha</p>
              </div>
              <div className="rounded-full bg-[#f0b06c] px-3 py-1 text-xs font-semibold text-[#18242b]">Ready to collect</div>
            </div>
            <div className="mt-4 space-y-3">
              {[
                ['09:10', 'Device booked in at front counter'],
                ['10:25', 'Battery and charging IC diagnosis completed'],
                ['11:00', 'Quote approved by customer on WhatsApp'],
                ['14:40', 'Repair completed and invoice prepared'],
              ].map(([time, text]) => (
                <div key={time} className="flex items-start gap-3">
                  <div className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/65">{time}</div>
                  <p className="text-sm text-white/78">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] bg-[#f8f0e5] p-4 text-[#18242b]">
            <p className="text-xs uppercase tracking-[0.2em] text-[#7b5c3c]">Revenue handoff</p>
            <div className="mt-4 grid gap-3">
              {[
                ['Repair revenue', 'R 2,850'],
                ['Parts used', 'Battery + charging IC'],
                ['Customer profile', '3rd repair, 2 sales, active warranty'],
                ['Next action', 'Send review request + accessory campaign'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#e4d2bd] bg-white px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8b7e73]">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-[#18242b]">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AutomationMockup() {
  return (
    <div className="hero-card rounded-[30px] p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7b5c3c]">CRM and retention</p>
      <h3 className="mt-3 display-font text-3xl font-bold text-[#18242b] sm:text-4xl">
        Turn service activity into repeat revenue.
      </h3>
      <p className="mt-4 text-base leading-7 text-[#5d6468]">
        This is where Appleberry OS should feel bigger than an old-school repair POS.
      </p>

      <div className="mt-6 space-y-4">
        <div className="rounded-[24px] border border-[#e6d7c6] bg-white/85 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#7b5c3c]">Campaign builder</p>
              <p className="mt-2 text-xl font-semibold text-[#18242b]">Back-to-school accessories push</p>
            </div>
            <div className="rounded-full bg-[#214e5f] px-3 py-1 text-xs font-semibold text-white">Live</div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ['Audience', 'Customers with iPhone repairs in last 6 months'],
              ['Channel', 'WhatsApp + email'],
              ['Open rate', '68%'],
              ['Recovered revenue', 'R 18,240'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-[#fbf4eb] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-[#8b7e73]">{label}</p>
                <p className="mt-1 text-sm font-semibold text-[#18242b]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Collection reminder', 'Auto-send after repair is ready for 24 hours'],
            ['Warranty check-in', 'Prompt customers before coverage expires'],
            ['Trade-in campaign', 'Target repeat buyers with upgrade offers'],
            ['Review request', 'Send after successful collection and invoice'],
          ].map(([title, copy]) => (
            <div key={title} className="rounded-[24px] border border-[#e6d7c6] bg-white/82 p-4">
              <p className="text-base font-semibold text-[#18242b]">{title}</p>
              <p className="mt-2 text-sm leading-6 text-[#5d6468]">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
