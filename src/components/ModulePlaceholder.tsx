import { Check, type LucideIcon } from 'lucide-react';
import { Badge, Card, PageHeader } from './ui/primitives';

interface ModulePlaceholderProps {
  title: string;
  description: string;
  phase: string;
  icon: LucideIcon;
  features: string[];
}

export function ModulePlaceholder({
  title,
  description,
  phase,
  icon: Icon,
  features,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coming soon"
        title={title}
        description={description}
        actions={<Badge variant="info">{phase}</Badge>}
      />

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <Icon className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Scheduled for {phase}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              The local database, shop settings, bilingual shell and backup
              system are already live. This module will be connected in {phase}.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
