"use client";

import * as React from "react";
import { Linkedin } from "lucide-react";
import { COLORS } from "@/lib/design/tokens";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { LinkedInEnrich } from "@/components/linkedin-enrich";

interface DealContact {
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  email: string;
  linkedinUrl: string | null;
}

export function DealLinkedinCard({ dealId }: { dealId: string }) {
  const [contacts, setContacts] = React.useState<DealContact[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/deals/${dealId}/linkedin`);
        const json = (await r.json()) as { contacts?: DealContact[] };
        if (!cancelled) setContacts(json.contacts ?? []);
      } catch {
        if (!cancelled) setContacts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  // Pas de contacts → pas de carte (rien à enrichir).
  if (!contacts || contacts.length === 0) return null;

  return (
    <Card padding={16} style={{ border: "1px solid #1d4ed8", boxShadow: "0 0 0 3px #1d4ed81a" }}>
      <SectionHeader title="LinkedIn" right={<LinkedinTag />} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {contacts.map((c, idx) => {
          const name = `${c.firstName} ${c.lastName}`.trim() || c.email;
          return (
            <div
              key={`${c.email}-${idx}`}
              style={{
                paddingBottom: idx < contacts.length - 1 ? 14 : 0,
                borderBottom: idx < contacts.length - 1 ? `1px solid ${COLORS.line}` : "none",
              }}
            >
              <LinkedInEnrich
                firstName={c.firstName}
                lastName={c.lastName}
                company={c.company}
                linkedinUrl={c.linkedinUrl}
                label={name}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function LinkedinTag() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#1d4ed8" }}>
      <Linkedin size={11} />
      <span style={{ fontSize: 10, fontWeight: 600 }}>LinkedIn</span>
    </span>
  );
}
