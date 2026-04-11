import { DashboardShell } from '../components/layout/dashboard-shell';

const sections = [
  { title: 'Send via API', value: '72', suffix: 'Messages' },
  { title: 'Autoresponder', value: '0', suffix: 'Messages' },
  { title: 'Chatbot', value: '10,670', suffix: 'Messages' },
];

export default function HomePage() {
  return (
    <DashboardShell title="Whatsapp" eyebrow="Overview">
      <div className="space-y-5">
        {sections.map((section) => (
          <section key={section.title}>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-400" />
              <h2 className="text-[28px] font-semibold tracking-tight text-slate-700">{section.title}</h2>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white px-8 py-7 shadow-sm">
              <p className="text-sm text-slate-400">Sent</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight text-emerald-400">{section.value}</span>
                <span className="text-sm text-emerald-300">{section.suffix}</span>
              </div>
            </div>
          </section>
        ))}

        <section className="rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-[1.8fr_0.5fr_0.5fr] gap-4 border-b border-slate-200 px-5 py-3 text-sm font-semibold text-slate-500">
            <span>Account</span>
            <span className="text-emerald-500">Sent</span>
            <span className="text-rose-400">Failed</span>
          </div>
          {[
            ['Appleberry Care Centre (2782886110)', '2702', '1'],
            ['NEW PHONE NUMBER (27833457033)', '168', '1'],
            ['Vodacom Superstore Midlands (27769144348)', '123', '1'],
          ].map(([name, sent, failed], index) => (
            <div
              key={name}
              className={`grid grid-cols-[1.8fr_0.5fr_0.5fr] gap-4 px-5 py-4 text-sm ${
                index < 2 ? 'border-b border-slate-200' : ''
              } ${index % 2 === 0 ? 'bg-slate-50/70' : 'bg-white'}`}
            >
              <span className="text-slate-600">{name}</span>
              <span className="font-medium text-slate-700">{sent}</span>
              <span className="font-medium text-slate-700">{failed}</span>
            </div>
          ))}
        </section>
      </div>
    </DashboardShell>
  );
}
