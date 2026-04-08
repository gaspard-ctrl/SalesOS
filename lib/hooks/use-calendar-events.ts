import useSWR from "swr";
import type { CalendarEvent } from "@/lib/google-calendar";

interface CalendarResponse {
  events: CalendarEvent[];
  calendarConnected: boolean;
}

export function useCalendarEvents(days = 7) {
  const { data, error, isLoading } = useSWR<CalendarResponse>(
    `/api/calendar/events?days=${days}`
  );
  return {
    events: data?.events ?? [],
    calendarConnected: data?.calendarConnected ?? false,
    isLoading,
    error,
  };
}
