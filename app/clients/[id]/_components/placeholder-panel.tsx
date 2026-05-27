import { COLORS } from "@/lib/design/tokens";

// Placeholder réutilisé pour Recap deal, Health/Actions, News : sections qui
// existent dans le schéma mais qui ne sont pas encore générées en batch 1.
// Évite des trous dans la fiche tout en signalant clairement le statut.

export function PlaceholderPanel({
  title,
  description,
  comingIn,
}: {
  title: string;
  description: string;
  comingIn: string;
}) {
  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px dashed ${COLORS.lineStrong}`,
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink2 }}>{title}</h3>
        <span
          style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 4,
            background: COLORS.bgSoft,
            color: COLORS.ink3,
            fontWeight: 600,
            letterSpacing: 0.3,
          }}
        >
          {comingIn}
        </span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.ink3, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}
