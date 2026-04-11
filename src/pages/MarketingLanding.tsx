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
    description: 'Run intake, diagnostics, approvals, parts, and collection from one calm workflow.',
    icon: Smartphone,
    accent: 'from-[#f29f58] via-[#d26a33] to-[#87411f]',
  },
  {
    title: 'Electronics retail',
    description: 'Sell accessories, devices, and services while keeping stock, margins, and customer history connected.',
    icon: Store,
    accent: 'from-[#5fa0b8] via-[#214e5f] to-[#13252e]',
  },
  {
    title: 'Multi-branch operators',
    description: 'Use transfers, permissions, reporting, and shared operating standards to scale without chaos.',
    icon: MonitorSmartphone,
    accent: 'from-[#d9b06a] via-[#8a5a34] to-[#214e5f]',
  },
];

const platformRows = [
  {
    eyebrow: 'Counter and checkout',
    title: 'Take payments, close invoices, and keep the front counter moving.',
    copy: 'Sales, invoices, customer lookup, and repair collections live in one flow instead of four disconnected tools.',
    icon: CreditCard,
    tone: 'bg-[#fff7ef]',
  },
  {
    eyebrow: 'Repair operations',
    title: 'Track diagnostics, approvals, status changes, and technician accountability.',
    copy: 'Give your team one repair picture with cleaner handoffs, better notes, and fewer missed promises.',
    icon: Wrench,
    tone: 'bg-[#f3f7f8]',
  },
  {
    eyebrow: 'Inventory discipline',
    title: 'Control stock takes, purchase orders, IMEIs, transfers, and low-stock risk.',
    copy: 'Run inventory like an operator, not like a shop constantly reacting to surprises.',
    icon: Boxes,
    tone: 'bg-[#fff8f3]',
  },
  {
    eyebrow: 'Customer memory',
    title: 'Keep every customer, warranty, sale, device, and note in one timeline.',
    copy: 'Appleberry OS turns service history into a commercial advantage instead of scattered memory and old chats.',
    icon: Users,
    tone: 'bg-[#f6f1fb]',
  },
];

const growthFeatures = [
  {
    title: 'Campaigns and automations',
    copy: 'Send collection nudges, comeback offers, warranty follow-ups, and review requests from one system.',
    icon: Megaphone,
  },
  {
    title: 'WhatsApp and email',
    copy: 'Use the same platform for invoices, updates, invites, quote follow-up, and customer retention.',
    icon: MessageSquareMore,
  },
  {
    title: 'Owner reporting',
    copy: 'Track margins, stock risk, repair throughput, and branch performance without spreadsheet cleanup.',
    icon: BarChart3,
  },
  {
    title: 'Safer staff onboarding',
    copy: 'Invite-only access, permission presets, and role controls for serious internal operations.',
    icon: ShieldCheck,
  },
];

const proofPoints = [
  { value: 'Repairs + POS + CRM', label: 'One operating system for front counter, workshop, stock, and follow-up.' },
  { value: 'Invite-only access', label: 'Serious staff controls, permissions, and safer onboarding.' },
  { value: 'Built for growth', label: 'Structured for serious stores and multi-branch teams, not hobby workflows.' },
];

const valuePillars = [
  {
    title: 'Faster front counter',
    copy: 'Move from walk-in to payment without jumping across multiple systems.',
    icon: Receipt,
  },
  {
    title: 'Better stock control',
    copy: 'Use purchase orders, stock takes, transfers, and alerts to tighten discipline.',
    icon: Truck,
  },
  {
    title: 'Clear customer memory',
    copy: 'See customer history, warranties, notes, repairs, and invoices in one place.',
    icon: SearchCheck,
  },
  {
    title: 'Commercial follow-through',
    copy: 'Turn everyday service activity into repeat revenue through CRM and marketing workflows.',
    icon: Sparkles,
  },
];

const signalCards = [
  {
    title: 'Live operations',
    value: 'Repair queue, invoices, and customer replies in one board',
  },
  {
    title: 'Commercial follow-through',
    value: 'Campaigns, collection nudges, and repeat-revenue workflows',
  },
  {
    title: 'Stock discipline',
    value: 'IMSI, stock take, POs, transfers, and low-stock visibility',
  },
];

const pricingPlans = [
  {
    title: 'Starter',
    price: 'R799/mo',
    copy: 'For one store replacing spreadsheets and disconnected repair tools.',
    bullets: ['POS and invoices', 'Repair workflow', 'Customer records', 'Inventory basics'],
    featured: false,
  },
  {
    title: 'Growth',
    price: 'R1,499/mo',
    copy: 'For serious operators who want CRM, reporting, stock controls, and stronger workflow discipline.',
    bullets: ['Everything in Starter', 'Stock take and purchase orders', 'Campaigns and automations', 'Owner reporting'],
    featured: true,
  },
  {
    title: 'Multi-Branch',
    price: 'Custom',
    copy: 'For multi-branch teams, larger stock movement, stronger governance, and migration support.',
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
      'Yes. Appleberry OS includes CRM direction around customer timelines, segmentation, WhatsApp and email campaigns, follow-ups, and retention workflows.',
  },
  {
    question: 'Can we import from another system?',
    answer:
      'Yes. Migration workflows already support customers, inventory, repairs, sales history, and stock take data so teams can test before going live.',
  },
  {
    question: 'Is it suitable for multiple branches?',
    answer:
      'Yes. The platform is being shaped for branch-aware operations, permissions, transfers, reporting, and owner-level visibility.',
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
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4ece2_0%,#f7f2eb_28%,#efe5d8_100%)] text-[#18242b]">
      <header className="sticky top-0 z-40 border-b border-[#e3d3bf] bg-[rgba(246,239,231,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="brand-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-xl font-bold text-white sm:h-12 sm:w-12">
              A
            </div>
            <div className="min-w-0">
              <p className="display-font truncate text-xl font-bold leading-none text-[#18242b] sm:text-2xl">Appleberry OS</p>
              <p className="truncate text-[10px] uppercase tracking-[0.22em] text-[#7b5c3c] sm:text-[11px]">Repair Commerce Platform</p>
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
              className="inline-flex items-center justify-center rounded-xl border border-[#d8c4af] bg-white/85 px-3 py-2 text-xs font-semibold text-[#214e5f]"
            >
              Trial
            </Link>
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-xl border border-[#d8c4af] bg-white/85 p-2.5 text-[#214e5f]"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-[#e3d3bf] bg-[rgba(246,239,231,0.98)] px-4 py-4 sm:hidden">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#7b5c3c]">Explore</p>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileNavOpen(false)}
                className="rounded-xl border border-[#d8c4af] bg-white/85 p-2 text-[#214e5f]"
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
                  className="rounded-2xl border border-[#e5d6c5] bg-white/85 px-4 py-3 text-sm font-medium text-[#34454d]"
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
        <section className="relative overflow-hidden px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-18 lg:pt-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(33,78,95,0.15),transparent_26%),radial-gradient(circle_at_left,rgba(198,90,34,0.14),transparent_20%)]" />
          <div className="relative mx-auto max-w-7xl">
            <div className="overflow-hidden rounded-[36px] border border-[#1b323d] bg-[#101c22] px-5 py-6 text-white shadow-[0_35px_90px_rgba(18,32,39,0.24)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(242,162,95,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(95,160,184,0.14),transparent_25%)]" />
              <div className="relative grid items-start gap-8 lg:grid-cols-[1fr_0.92fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
                  Mobile-first repair commerce software
                </div>
                <h1 className="display-font mt-5 max-w-4xl text-[2.7rem] font-bold leading-[0.9] text-white sm:text-6xl lg:text-7xl">
                  The operating system for repair stores that want to look sharper and run tighter.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
                  Appleberry OS brings repairs, retail, inventory, CRM, campaigns, purchase orders, transfers, and staff control into one calm commercial layer for modern device businesses.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#f2a25f] px-6 py-4 text-base font-semibold text-[#18242b] shadow-[0_18px_34px_rgba(242,162,95,0.24)] transition hover:translate-y-[-1px] hover:bg-[#f5b173]"
                  >
                    Start your Appleberry OS trial
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a
                    href="#platform"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/8 px-6 py-4 text-base font-semibold text-white transition hover:bg-white/12"
                  >
                    Explore the platform
                  </a>
                  <Link
                    to="/whatsapp-studio"
                    className="inline-flex items-center justify-center rounded-2xl border border-[#f2a25f]/40 bg-[#1b2b33] px-6 py-4 text-base font-semibold text-[#f8d7b3] transition hover:bg-[#22353f]"
                  >
                    Open WhatsApp Studio demo
                  </Link>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {['Repairs', 'POS', 'CRM', 'Marketing', 'Stock take', 'Purchase orders'].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-medium text-white/74"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <HeroConsole />
            </div>

              <div className="relative mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="grid gap-4 md:grid-cols-3">
                  {proofPoints.map((point) => (
                    <div key={point.label} className="rounded-[24px] border border-white/10 bg-white/6 px-5 py-5 backdrop-blur-sm">
                      <p className="display-font text-2xl font-bold text-white">{point.value}</p>
                      <p className="mt-2 text-sm leading-6 text-white/65">{point.label}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">What operators feel</p>
                  <div className="mt-4 space-y-3">
                    {signalCards.map((card) => (
                      <div key={card.title} className="rounded-2xl border border-white/10 bg-black/18 px-4 py-4">
                        <p className="text-sm font-semibold text-white">{card.title}</p>
                        <p className="mt-1 text-sm leading-6 text-white/65">{card.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="shop-types" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Choose your shop type</p>
              <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                Clear fit for repair-led teams, retailers, and operators scaling past one branch.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#5d6468] sm:text-lg sm:leading-8">
                The best SaaS sites make it obvious who the product is for. Appleberry OS should feel specific, confident, and easier to trust at a glance.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {shopTypes.map(({ title, description, icon: Icon, accent }) => (
                <div key={title} className="group overflow-hidden rounded-[30px] border border-[#e4d3c1] bg-white shadow-[0_18px_40px_rgba(64,46,25,0.08)] transition hover:-translate-y-1">
                  <div className={`h-2 bg-gradient-to-r ${accent}`} />
                  <div className="p-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#f3e2d0] text-[#214e5f] transition group-hover:bg-[#214e5f] group-hover:text-white">
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
            <div className="mb-10 max-w-3xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Platform features</p>
              <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                More than a repair POS. This is the operating layer for the whole business.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#5d6468] sm:text-lg sm:leading-8">
                Front counter, repair flow, stock discipline, and customer memory should feel connected. That’s the difference between a stitched-together toolset and a serious operating system.
              </p>
            </div>

            <div className="space-y-5">
              {platformRows.map(({ eyebrow, title, copy, icon: Icon, tone }, index) => (
                <div
                  key={title}
                  className={`grid gap-5 rounded-[30px] border border-[#e5d6c5] ${tone} p-6 shadow-[0_16px_34px_rgba(79,56,30,0.05)] lg:grid-cols-[0.9fr_1.1fr] ${index % 2 === 1 ? 'lg:grid-cols-[1.1fr_0.9fr]' : ''}`}
                >
                  <div className={`${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7b5c3c]">{eyebrow}</p>
                    <h3 className="mt-3 display-font text-3xl font-bold leading-tight text-[#18242b] sm:text-4xl">{title}</h3>
                    <p className="mt-4 text-base leading-7 text-[#536169]">{copy}</p>
                  </div>
                  <div className={`${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <div className="rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#18242b] text-[#f2a25f]">
                          <Icon className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[#18242b]">Appleberry OS module</p>
                          <p className="text-sm text-[#69767d]">Practical workflows for high-volume stores</p>
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {[
                          'Cleaner handoffs',
                          'Faster staff actions',
                          'Less admin friction',
                          'Stronger customer follow-through',
                        ].map((item) => (
                          <div key={item} className="rounded-2xl border border-[#eadaca] bg-[#fbf5ed] px-4 py-3 text-sm font-medium text-[#33434b]">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="growth" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[36px] bg-[#142732] px-6 py-8 text-white shadow-[0_30px_70px_rgba(20,39,50,0.18)] sm:px-8 lg:px-10">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">CRM and marketing engine</p>
                <h2 className="mt-3 display-font text-4xl font-bold leading-tight sm:text-5xl">
                  Turn service activity into repeat revenue, not just completed tickets.
                </h2>
                <p className="mt-5 text-base leading-7 text-white/72 sm:text-lg sm:leading-8">
                  Modern operators do not want a site that sounds like old repair software. The growth story here is CRM, messaging, memory, and better follow-through after the job is finished.
                </p>
                <div className="mt-8 space-y-3">
                  {[
                    'Segment customers by spend, device type, warranty activity, and branch.',
                    'Launch WhatsApp and email follow-ups for pickups, promos, and review requests.',
                    'See which campaigns actually drive replies, visits, and recovered revenue.',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                      <BadgeCheck className="mt-0.5 h-5 w-5 text-[#f2a25f]" />
                      <p className="text-sm leading-6 text-white/74">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {growthFeatures.map(({ title, copy, icon: Icon }) => (
                  <div key={title} className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-white/10 text-[#f2a25f]">
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold text-white">{title}</h3>
                    <p className="mt-3 text-base leading-7 text-white/70">{copy}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Why companies switch</p>
              <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                Less tool sprawl. More control. Better customer follow-through.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {valuePillars.map(({ title, copy, icon: Icon }) => (
                <div key={title} className="section-card rounded-[28px] p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#f1e1cf] text-[#c65a22]">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-[#18242b]">{title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#5d6468]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b5c3c]">Pricing direction</p>
              <h2 className="mt-3 display-font text-4xl font-bold text-[#18242b] sm:text-5xl">
                Simple pricing for serious operators.
              </h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.title}
                  className={`rounded-[30px] p-7 ${
                    plan.featured
                      ? 'bg-[#18242b] text-white shadow-[0_26px_40px_rgba(24,36,43,0.18)]'
                      : 'section-card text-[#18242b]'
                  }`}
                >
                  <p className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${plan.featured ? 'text-white/60' : 'text-[#7b5c3c]'}`}>
                    {plan.title}
                  </p>
                  <p className="display-font mt-4 text-4xl font-bold sm:text-5xl">{plan.price}</p>
                  <p className={`mt-4 text-base leading-7 ${plan.featured ? 'text-white/76' : 'text-[#5d6468]'}`}>{plan.copy}</p>
                  <div className={`mt-6 h-px ${plan.featured ? 'bg-white/12' : 'bg-[#e4d2bd]'}`} />
                  <div className="mt-6 space-y-3">
                    {plan.bullets.map((bullet) => (
                      <div key={bullet} className="flex items-start gap-3">
                        <BadgeCheck className={`mt-0.5 h-5 w-5 ${plan.featured ? 'text-[#f2a25f]' : 'text-[#c65a22]'}`} />
                        <p className={`text-sm leading-6 ${plan.featured ? 'text-white/78' : 'text-[#4f5a60]'}`}>{bullet}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    to="/login"
                    className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-5 py-3.5 text-sm font-semibold transition ${
                      plan.featured ? 'bg-[#f2a25f] text-[#18242b] hover:bg-[#f5b173]' : 'bg-[#18242b] text-white hover:bg-[#214e5f]'
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
          <div className="mx-auto max-w-7xl rounded-[36px] bg-[linear-gradient(135deg,#dfebf1_0%,#f2e3d1_52%,#fbf6ef_100%)] px-6 py-12 sm:px-10 lg:px-12">
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

function HeroConsole() {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
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
                ['Campaigns', '12 live automations', 'bg-[#6b4e35]'],
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
                    <Icon className="h-5 w-5 text-[#f2a25f]" />
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
