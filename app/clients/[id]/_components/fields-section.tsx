"use client";

import { COLORS } from "@/lib/design/tokens";
import { SECTION_DEFINITIONS, type ClientFields, type FieldDefinition } from "@/lib/clients/types";
import { FieldDisplay } from "./field-display";

// Affiche les 6 sections de fields (cf. SECTION_DEFINITIONS dans lib/clients/types.ts)
// dans l'ordre du plan §2. Read-only en batch 1 : pas d'édition inline,
// pas de bouton Re-enrich. C'est l'étape 4 du plan §7 qui ajoutera ça.

export function FieldsSection({
  fields,
  clientId,
  onUpdated,
}: {
  fields: Partial<ClientFields>;
  clientId?: string;
  onUpdated?: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {SECTION_DEFINITIONS.map((section) => {
        const sectionData = (fields[section.key] ?? {}) as Record<string, unknown>;
        return (
          <div
            key={section.key}
            style={{
              background: COLORS.bgCard,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${COLORS.line}`,
                background: COLORS.bgSoft,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink0 }}>{section.label}</h3>
            </div>
            <div style={{ padding: "0 16px" }}>
              {section.fields.map((fieldDef: FieldDefinition) => (
                <FieldDisplay
                  key={fieldDef.key}
                  definition={fieldDef}
                  field={sectionData[fieldDef.key] as Parameters<typeof FieldDisplay>[0]["field"]}
                  clientId={clientId}
                  sectionKey={section.key}
                  onUpdated={onUpdated}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
