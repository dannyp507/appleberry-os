import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  ChevronDown,
  ClipboardList,
  CreditCard,
  MessageSquareMore,
  Megaphone,
  MonitorSmartphone,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Users,
  Wrench,
} from 'lucide-react';

const productTabs = ['Dashboard', 'Repairs', 'Customers', 'Inventory'];

const featureCards = [
  {
    eyebrow: 'Point of sale',
    title: 'Take payments, track margins, and close jobs without losing context.',
    description: 'Appleberry OS connects sales, invoices, repairs, and stock movement in one flow so your front counter stays fast.',
    icon: CreditCard,
    accent: 'from-[#d46a30] to-[#f0a45b]',
  },
  {
    eyebrow: 'Repair operations',
    title: 'Run intake, diagnostics, approvals, and collections from one queue.',
    description: 'Give your technicians a calm system with statuses, timelines, notes, and device history that customers can trust.',
    icon: Wrench,
    accent: 'from-[#214e5f] to-[#4d7787]',
  },
  {
    eyebrow: 'CRM and retention',
    title: 'See every customer, warranty, sale, repair, and follow-up in one record.',
    description: 'Use customer memory like a competitive advantage instead of digging through notes, old chats, or disconnected tools.',
    icon: Users,
    accent: 'from-[#a64d20] to-[#214e5f]',
  },
  {
    eyebrow: 'Inventory control',
    title: 'Track parts, devices, IMEIs, stock takes, transfers, and purchase orders.',
    description: 'Reduce shrinkage, buy smarter, and keep high-volume stores moving with operational discipline.',
    icon: Boxes,
    accent: 'from-[#2d5e70] to-[#d98a3a]',
  },
];

const operations = [
  {
    title: 'Repair shops',
    text: 'Book in devices, assign technicians, track turnaround time, and message customers as jobs move.',
    icon: Smartphone,
  },
  {
    title: 'Retail stores',
    text: 'Sell accessories, phones, gadgets, and services while keeping accurate stock and margin visibility.',
    icon: Store,
  },
  {
    title: 'Multi-branch operators',
    text: 'Manage branches, transfer stock, compare performance, and standardize how your teams operate.',
    icon: MonitorSmartphone,
  },
];

const growthTools = [
  {
    title: 'CRM timeline',
    copy: 'Customer history, notes, warranties, spend, and repair activity live in one profile.',
    icon: Users,
  },
  {
    title: 'Marketing automation',
    copy: 'Win back inactive customers, send collection reminders, and launch targeted promotions.',
    icon: Megaphone,
  },
  {
    title: 'WhatsApp and email',
    copy: 'Send invoices, staff invites, status updates, and quote approvals from the same platform.',
    icon: MessageSquareMore,
  },
  {
    title: 'Owner reporting',
    copy: 'Track revenue, profit, technician output, stock risk, and branch performance without spreadsheet chaos.',
    icon: BarChart3,
  },
];

const valuePillars = [
  {
    title: 'Faster front counter',
    copy: 'Get from walk-in to payment without hopping across disconnected tools.',
    icon: Receipt,
  },
  {
    title: 'Operational discipline',
    copy: 'Approvals, stock counts, posting controls, permissions, and audit history built in.',
    icon: ShieldCheck,
  },
  {
    title: 'Better customer experience',
    copy: 'Track every promise, every device, and every conversation with less friction.',
    icon: BadgeCheck,
  },
  {
    title: 'Room to scale',
    copy: 'Built for serious repair companies that want a platform they can grow and sell from.',
    icon: Sparkles,
  },
];

const faqs = [
  {
    question: 'Can Appleberry OS handle both repairs and retail sales?',
    answer:
      'Yes. It is built for stores that repair devices, sell stock, trade devices, manage parts, and need customer history in one place.',
  },
  {
    question: 'Do you support CRM and marketing tools too?',
    answer:
      'Yes. The platform direction includes CRM timelines, customer segmentation, follow-ups, WhatsApp and email campaigns, and retention workflows for repair and retail businesses.',
  },
  {
    question: 'Can we import from another system?',
    answer:
      'Yes. Appleberry OS supports migration workflows for customers, inventory, repairs, sales history, and stock take records so you can test before going live.',
  },
  {
    question: 'Is Appleberry OS suitable for multiple branches?',
    answer:
      'Yes. The roadmap and architecture support multi-branch growth with transfers, branch reporting, permissions, and operational controls.',
  },
  {
    question: 'How do staff get access?',
    answer:
      'Admins create staff members, assign permissions, and send invite links. Staff activate their account and set their own password.',
  },
];

export default function MarketingLanding() {
  const [openFaq, setOpenFaq] = useState(0);

  const stats = useMemo(
    () => [
      { value: 'All-in-one', label: 'operations stack for repair, retail, CRM, and stock control' },
      { value: 'Invite-only', label: 'staff onboarding, permissions, and secure internal access' },
      { value: 'Built to scale', label: 'for serious repair companies and multi-branch growth' },
    ],
    [],
  );

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-[#e6d7c6] bg-[rgba(255,249,241,0.9)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="brand-badge flex h-12 w-12 items-center justify-center rounded-[18px] text-xl font-bold text-white">A</div>
              <div>
                <p className="display-font text-2xl font-bold leading-none text-[#18242b]">Appleberry OS</p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c]">Repair Commerce Platform</p>
              </div>
            </Link>

            <nav className="hidden items-center gap-8 lg:flex">
              <a href="#features" className="text-sm font-medium text-[#33434b] hover:text-[#c65a22]">Features</a>
              <a href="#solutions" className="text-sm font-medium text-[#33434b] hover:text-[#c65a22]">Solutions</a>
              <a href="#growth" className="text-sm font-medium text-[#33434b] hover:text-[#c65a22]">CRM & Marketing</a>
              <a href="#pricing" className="text-sm font-medium text-[#33434b] hover:text-[#c65a22]">Pricing</a>
              <a href="#faq" className="text-sm font-medium text-[#33434b] hover:text-[#c65a22]">FAQ</a>
            </nav>

            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden rounded-xl border border-[#d9c4ae] bg-white/80 px-4 py-2 text-sm font-semibold text-[#214e5f] transition hover:bg-white md:inline-flex"
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
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
          <div className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_right,rgba(33,78,95,0.18),transparent_28%),radial-gradient(circle_at_left,rgba(198,90,34,0.16),transparent_24%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative z-10">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.34em] text-[#7b5c3c]">Appleberry OS for repair-led commerce</p>
              <h1 className="display-font max-w-4xl text-5xl font-bold leading-[0.95] text-[#18242b] sm:text-6xl lg:text-7xl">
                Run your repair company, retail floor, CRM, and marketing from one operating system.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4f5a60]">
                Built for mobile phone repair stores, electronics retailers, buy-sell-trade operators, and multi-branch businesses that want better control, better customer memory, and better revenue systems.
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
                  href="#features"
                  className="inline-flex items-center justify-center rounded-2xl border border-[#d8c5af] bg-white/75 px-6 py-4 text-base font-semibold text-[#214e5f] transition hover:bg-white"
                >
                  Explore the platform
                </a>
              </div>

              <div className="mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="section-card rounded-[24px] p-5">
                    <p className="display-font text-2xl font-bold text-[#18242b]">{stat.value}</p>
                    <p className="mt-2 text-sm leading-6 text-[#5d6468]">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <div className="hero-card relative rounded-[36px] p-5 sm:p-7">
                <div className="soft-grid absolute inset-0 rounded-[36px] opacity-35" />
                <HeroMockup />
              </div>
            </div>
          </div>
        </section>

        <section id="solutions" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold">Built for serious operators</p>
              <h2 className="mt-3 display-font text-5xl font-bold text-[#18242b]">Choose the business model you want to scale.</h2>
              <p className="mx-auto mt-4 max-w-3xl text-lg text-[#5d6468]">
                Appleberry OS is designed for stores that repair, retail, trade, source, and grow customer relationships around devices and electronics.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {operations.map(({ title, text, icon: Icon }) => (
                <div key={title} className="section-card rounded-[28px] p-6 transition hover:-translate-y-1">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#efe0ce] text-[#c65a22]">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-6 display-font text-3xl font-bold text-[#18242b]">{title}</h3>
                  <p className="mt-4 text-base leading-7 text-[#5d6468]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold">Platform features</p>
                <h2 className="mt-3 display-font text-5xl font-bold text-[#18242b]">More than a repair POS. This is the operating layer.</h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-[#5d6468]">
                The best systems do not just help you transact. They help you organize, remember, automate, market, and scale.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {featureCards.map(({ eyebrow, title, description, icon: Icon, accent }) => (
                <div key={title} className="overflow-hidden rounded-[30px] border border-[rgba(141,111,77,0.14)] bg-[#fffaf4] shadow-[0_18px_34px_rgba(79,56,30,0.07)]">
                  <div className={`h-2 bg-gradient-to-r ${accent}`} />
                  <div className="p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c] font-semibold">{eyebrow}</p>
                        <h3 className="mt-4 display-font text-4xl font-bold leading-tight text-[#18242b]">{title}</h3>
                      </div>
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#f2e4d3] text-[#214e5f]">
                        <Icon className="h-7 w-7" />
                      </div>
                    </div>
                    <p className="mt-5 max-w-2xl text-base leading-7 text-[#5d6468]">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <WorkflowMockup />
              <AutomationMockup />
            </div>
          </div>
        </section>

        <section id="growth" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="hero-card rounded-[32px] p-8">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold">Growth engine</p>
              <h2 className="mt-3 display-font text-5xl font-bold text-[#18242b]">CRM, marketing, retention, and customer memory built into operations.</h2>
              <p className="mt-5 text-lg leading-8 text-[#4f5a60]">
                You asked for more than store software. Appleberry OS can be positioned as the customer engine behind your business, not just the till in the corner.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  'Segment customers by purchase history, device type, warranty status, or branch.',
                  'Automate WhatsApp and email campaigns for collections, promos, and follow-ups.',
                  'Track repeat buyers, repair return rates, and service quality from one dashboard.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#eadaca] bg-white/75 px-4 py-4">
                    <BadgeCheck className="mt-0.5 h-5 w-5 text-[#c65a22]" />
                    <p className="text-sm leading-6 text-[#4f5a60]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {growthTools.map(({ title, copy, icon: Icon }) => (
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
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Why companies switch</p>
                <h2 className="mt-3 display-font text-5xl font-bold leading-tight">Less tool sprawl. More control. Better customer follow-through.</h2>
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
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold">Pricing direction</p>
              <h2 className="mt-3 display-font text-5xl font-bold text-[#18242b]">Simple pricing for operators who want real software, not complexity.</h2>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {[
                {
                  title: 'Starter',
                  price: 'R799/mo',
                  copy: 'Single-store teams getting off spreadsheets and disconnected tools.',
                  bullets: ['POS and invoicing', 'Repair workflows', 'Inventory and stock take', 'Customer records'],
                },
                {
                  title: 'Growth',
                  price: 'R1,499/mo',
                  copy: 'For serious repair and retail stores that want CRM, reporting, and better control.',
                  bullets: ['Everything in Starter', 'Purchase orders and transfers', 'Sales and repairs reports', 'CRM and campaign tools'],
                  featured: true,
                },
                {
                  title: 'Multi-Branch',
                  price: 'Custom',
                  copy: 'For operators running multiple locations, larger teams, and stronger governance.',
                  bullets: ['Branch operations', 'Role and permission layers', 'Advanced reporting', 'Migration and onboarding support'],
                },
              ].map((plan) => (
                <div
                  key={plan.title}
                  className={`rounded-[30px] p-7 ${plan.featured ? 'appleberry-gradient text-white shadow-[0_26px_40px_rgba(198,90,34,0.2)]' : 'section-card text-[#18242b]'}`}
                >
                  <p className={`text-[11px] uppercase tracking-[0.24em] font-semibold ${plan.featured ? 'text-white/70' : 'text-[#7b5c3c]'}`}>{plan.title}</p>
                  <p className="mt-4 display-font text-5xl font-bold">{plan.price}</p>
                  <p className={`mt-4 text-base leading-7 ${plan.featured ? 'text-white/80' : 'text-[#5d6468]'}`}>{plan.copy}</p>
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
                      plan.featured
                        ? 'bg-white text-[#18242b] hover:bg-[#fff3df]'
                        : 'bg-[#18242b] text-white hover:bg-[#214e5f]'
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
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold">Frequently asked questions</p>
              <h2 className="mt-3 display-font text-5xl font-bold text-[#18242b]">Questions serious operators ask before they switch.</h2>
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
                      <span className="text-lg font-semibold text-[#18242b]">{faq.question}</span>
                      <ChevronDown className={`h-5 w-5 shrink-0 text-[#214e5f] transition ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="border-t border-[#eadaca] px-6 py-5 text-base leading-7 text-[#5d6468]">
                        {faq.answer}
                      </div>
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
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#7b5c3c] font-semibold">Ready to move properly?</p>
                <h2 className="mt-3 display-font text-5xl font-bold text-[#18242b]">Launch Appleberry OS with a platform that can actually grow with your repair company.</h2>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-[#4f5a60]">
                  Bring your POS, repairs, CRM, staff onboarding, stock control, purchase orders, transfers, reporting, and marketing into one operating system.
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
    <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-[#13252e] p-5 text-white shadow-[0_26px_60px_rgba(17,34,41,0.22)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.26em] text-white/60">Live operations board</p>
          <h2 className="mt-2 display-font text-3xl font-bold">Appleberry OS</h2>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
          Repair + Retail + CRM
        </div>
      </div>

      <div className="rounded-[24px] border border-white/10 bg-[#0f1d24] p-4">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#d46a30]" />
          <span className="h-3 w-3 rounded-full bg-[#f0b06c]" />
          <span className="h-3 w-3 rounded-full bg-[#3d7688]" />
          <div className="ml-3 rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/60">app.appleberryos.co.za</div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[20px] bg-white/6 p-4">
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {productTabs.map((tab, index) => (
                <div
                  key={tab}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${index === 0 ? 'bg-[#c65a22] text-white' : 'bg-white/6 text-white/65'}`}
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
                  <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
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
                  ['Purchase orders', ClipboardList],
                  ['Inventory', Boxes],
                  ['Reporting', BarChart3],
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
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c] font-semibold">Workflow preview</p>
      <h3 className="mt-3 display-font text-4xl font-bold text-[#18242b]">From intake to invoice, your whole team works off the same picture.</h3>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[#5d6468]">
        Instead of separate counters, notebooks, and chats, Appleberry OS gives each job a visible lifecycle with ownership, status, approvals, and commercial follow-through.
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
      <p className="text-[11px] uppercase tracking-[0.24em] text-[#7b5c3c] font-semibold">CRM & marketing automation</p>
      <h3 className="mt-3 display-font text-4xl font-bold text-[#18242b]">Turn service activity into repeat revenue.</h3>
      <p className="mt-4 text-base leading-7 text-[#5d6468]">
        This is where Appleberry OS separates itself from software that stops at the checkout button.
      </p>

      <div className="mt-6 space-y-4">
        <div className="rounded-[24px] border border-[#e6d7c6] bg-white/85 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#7b5c3c]">Campaign builder</p>
              <p className="mt-2 text-xl font-semibold text-[#18242b]">Back-to-school screen protector push</p>
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
