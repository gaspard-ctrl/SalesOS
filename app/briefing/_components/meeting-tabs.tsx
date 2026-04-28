"use client";

import * as React from "react";
import type { CalendarEvent } from "@/lib/google-calendar";
import { TabBarPill } from "@/components/ui/tab-bar-pill";
import {
  externalAttendees,
  eventTime,
  companyFromEmail,
  isToday,
} from "../_helpers";

export function MeetingTabs({
  events,
  selectedId,
  onSelect,
}: {
  events: CalendarEvent[];
  selectedId: string | null;
  onSelect: (e: CalendarEvent) => void;
}) {
  const todays = events.filter((e) => {
    if (!isToday(e.start)) return false;
    return externalAttendees(e).length > 0;
  });

  if (todays.length < 2) return null;

  const tabs = todays.map((e) => {
    const ext = externalAttendees(e);
    const time = eventTime(e.start);
    const company = ext[0] ? companyFromEmail(ext[0].email) : e.title;
    const cap = company.charAt(0).toUpperCase() + company.slice(1);
    return {
      key: e.id,
      label: time ? `${cap} · ${time}` : cap,
    };
  });

  const active = selectedId ?? tabs[0]?.key;

  return (
    <TabBarPill
      tabs={tabs}
      active={active ?? ""}
      onChange={(key) => {
        const ev = todays.find((e) => e.id === key);
        if (ev) onSelect(ev);
      }}
    />
  );
}
