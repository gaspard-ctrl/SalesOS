"use client";

import * as React from "react";
import { TabBarPill } from "@/components/ui/tab-bar-pill";

export type ChatTabKey = "conversation" | "guides" | "connecteurs";

const TABS = [
  { key: "conversation", label: "Conversation" },
  { key: "guides", label: "Guides" },
  { key: "connecteurs", label: "Connecteurs" },
];

export function ChatTabs({
  active,
  onChange,
}: {
  active: ChatTabKey;
  onChange: (k: ChatTabKey) => void;
}) {
  return (
    <TabBarPill
      tabs={TABS}
      active={active}
      onChange={(k) => onChange(k as ChatTabKey)}
    />
  );
}
