"use client";

import type { Granularity, RepSnapshot } from "@/lib/ae-activity/types";
import {
  buildKpis,
  fmtEURCompact,
  revenueAttainment,
  ragColor,
  PERIOD_WORD,
  type Delta,
  type Kpi,
} from "./helpers";
import {
  ChartCard,
  VolumeChart,
  CallOutcomeChart,
  MeetingsPipelineChart,
  MeetingSourceChart,
  FunnelChart,
  LostReasonsChart,
  RevenueChart,
} from "./charts";

function DeltaBadge({ delta }: { delta?: Delta }) {
  if (!delta) return null;
  const color = delta.dir === "up" ? "#16a34a" : delta.dir === "down" ? "#dc2626" : "#888";
  const arrow = delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : "→";
  const text = delta.pct == null ? "new" : `${Math.abs(delta.pct)}%`;
  return (
    <span className="text-[10px] font-semibold ml-1" style={{ color }} title="vs période précédente">
      {arrow} {text}
    </span>
  );
}

function KpiCard({ kpi, accent }: { kpi: Kpi; accent: string }) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: "#eee", background: "#fff" }}>
      <div className="flex items-baseline">
        <span className="text-lg font-bold leading-tight" style={{ color: kpi.accentValue ? accent : "#111" }}>
          {kpi.value}
        </span>
        <DeltaBadge delta={kpi.delta} />
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: "#666" }}>
        {kpi.label}
      </div>
      {kpi.sub && (
        <div className="text-[10px] mt-0.5" style={{ color: "#aaa" }}>
          {kpi.sub}
        </div>
      )}
    </div>
  );
}

function RevenueCard({
  label,
  billed,
  target,
}: {
  label: string;
  billed: number | null;
  target: number | null;
}) {
  const att = revenueAttainment(billed, target);
  const rag = ragColor(att);
  return (
    <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: "#eee", background: "#fff" }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: "#666" }}>
          {label}
        </span>
        {att != null && (
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
            style={{ color: rag.fg, background: rag.bg }}
          >
            {att}%
          </span>
        )}
      </div>
      <div className="text-xl font-bold mt-1" style={{ color: "#111" }}>
        {fmtEURCompact(billed)}
      </div>
      <div className="text-[10px] mt-0.5" style={{ color: "#aaa" }}>
        objectif {fmtEURCompact(target)}
      </div>
      {att != null && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#f0f0f0" }}>
          <div style={{ width: `${Math.min(att, 100)}%`, height: "100%", background: rag.fg }} />
        </div>
      )}
    </div>
  );
}

export function RepBlock({
  rep,
  gran,
  aggregate = false,
}: {
  rep: RepSnapshot;
  gran: Granularity;
  aggregate?: boolean;
}) {
  const buckets = rep.byGranularity[gran] ?? [];
  const kpis = buildKpis(buckets);
  const rev = rep.revenue;
  const showRenew = rev.matched && (rev.renewTarget != null || rev.renewBilled != null);

  return (
    <div style={{ minWidth: 0 }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: rep.accent }} />
        <h2 className="text-[15px] font-semibold" style={{ color: "#111" }}>
          {rep.repName}
        </h2>
        <a
          href="/deals"
          className="text-[11px] ml-1"
          style={{ color: rep.accent }}
          title="Ouvrir le pipeline"
        >
          → Deals
        </a>
        {rep.dataWarnings.length > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto"
            style={{ color: "#b45309", background: "#fef3c7" }}
            title={`Métriques incomplètes : ${rep.dataWarnings.join(", ")}`}
          >
            ⚠ {rep.dataWarnings.length} incomplet(s)
          </span>
        )}
      </div>

      {/* Revenu vs objectifs (Sheet) */}
      {rev.matched ? (
        <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: showRenew ? "1fr 1fr" : "1fr" }}>
          <RevenueCard label="New facturé 2026" billed={rev.newBilled} target={rev.newTarget} />
          {showRenew && <RevenueCard label="Renew facturé 2026" billed={rev.renewBilled} target={rev.renewTarget} />}
        </div>
      ) : (
        <div
          className="text-[11px] mb-4 rounded-lg px-3 py-2"
          style={{ color: "#888", background: "#f7f7f8" }}
        >
          Revenu/objectifs non trouvés dans le Sheet pour {rep.repName.split(" ")[0]}.
        </div>
      )}

      {/* KPI grid */}
      <div className="text-[11px] mb-1.5" style={{ color: "#aaa" }}>
        Chiffre = {PERIOD_WORD[gran]} · <span style={{ fontWeight: 600 }}>▲▼</span> vs période précédente · sous-texte = cumul depuis le 1er janv.
      </div>
      <div
        className="grid gap-2 mb-4"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))" }}
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} kpi={k} accent={rep.accent} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        <ChartCard
          title="Volume de prospection"
          subtitle="appels sortants & emails de prospection"
          note="Emails = emails sortants vers un contact 'sans email entrant' (on n'a jamais reçu d'email de lui), donc de la prospection à froid. Tous canaux logués dans HubSpot."
        >
          <VolumeChart buckets={buckets} accent={rep.accent} />
        </ChartCard>
        <ChartCard title="Appels par issue" subtitle="dispositions des appels sortants">
          <CallOutcomeChart buckets={buckets} />
        </ChartCard>
        <ChartCard title="Meetings & pipeline" subtitle="bookés, tenus, deals fermés">
          <MeetingsPipelineChart buckets={buckets} accent={rep.accent} />
        </ChartCard>
        <ChartCard
          title="Meetings : source"
          subtitle="inbound vs self-sourced + Slack"
          note="Inbound = meeting rattaché à un lead marketing (contact/deal, sinon nom ou email du contact). La ligne noire = meetings déclarés dans Slack #new-meetings. Ces signaux ne coïncident pas exactement, c'est normal."
        >
          <MeetingSourceChart buckets={buckets} accent={rep.accent} />
        </ChartCard>
        <ChartCard
          title="Funnel par étape"
          subtitle="deals créés depuis janvier, par étape actuelle"
          note="Distribution actuelle des deals créés cette année (closed-lost exclu)."
        >
          <FunnelChart funnel={rep.funnel} accent={rep.accent} />
        </ChartCard>
        <ChartCard
          title="Funnel leads"
          subtitle="leads marketing validés → deal → étapes"
          note="Depuis les leads marketing (validés). Combien ont un deal et jusqu'à quelle étape (Discovery, Demo…). Étape = snapshot au moment de l'analyse du lead, pas le live."
        >
          <FunnelChart funnel={rep.leadsFunnel} accent={rep.accent} />
        </ChartCard>
        <ChartCard title="Pourquoi les deals sont perdus" subtitle="raisons de closed-lost depuis janvier">
          <LostReasonsChart lostReasons={rep.lostReasons} accent={rep.accent} />
        </ChartCard>
        {rev.matched && rev.quarters.length > 0 && (
          <ChartCard title="Revenu New vs objectif" subtitle="par trimestre (source : Sheet revenue)">
            <RevenueChart quarters={rev.quarters} accent={rep.accent} />
          </ChartCard>
        )}
      </div>

      {/* Coaching (par rep uniquement, pas en vue agrégée) */}
      {!aggregate && (
      <div className="rounded-xl border p-4 mt-3" style={{ borderColor: "#eee", background: "#fff" }}>
        <h3 className="text-[13px] font-semibold mb-2" style={{ color: "#111" }}>
          Objections & coaching
        </h3>
        {rep.coaching.insights.length > 0 ? (
          <>
            <ul className="list-disc pl-4 space-y-1.5">
              {rep.coaching.insights.map((t, i) => (
                <li key={i} className="text-[12.5px] leading-snug" style={{ color: "#333" }}>
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-[11px] mt-2.5 rounded-lg px-2.5 py-1.5" style={{ color: "#888", background: "#f7f7f8" }}>
              Synthétisé automatiquement depuis {rep.coaching.meetingsAnalyzed} meeting(s) analysé(s) par Sales Coach.
            </p>
          </>
        ) : (
          <p className="text-[12px]" style={{ color: "#aaa" }}>
            Pas encore d&apos;analyses Sales Coach exploitables sur la période.
          </p>
        )}
      </div>
      )}
    </div>
  );
}
