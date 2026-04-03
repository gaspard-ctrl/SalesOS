"use client";

import { useState, useEffect } from "react";

interface GlobalAlertConfig {
  enabled: boolean;
  slack_channel: string;
  slack_channel_private: string;
  min_score: number;
}

export function AlertConfigAdmin({ initialConfig }: { initialConfig: GlobalAlertConfig | null }) {
  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? true);
  const [channel, setChannel] = useState(initialConfig?.slack_channel ?? "");
  const [channelPrivate, setChannelPrivate] = useState(initialConfig?.slack_channel_private ?? "");
  const [minScore, setMinScore] = useState(initialConfig?.min_score ?? 70);
  const [channels, setChannels] = useState<{ id: string; name: string; is_private: boolean }[]>([]);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/slack-channels")
      .then((r) => r.json())
      .then((data) => {
        setChannels(data.channels ?? []);
        setMembers(data.members ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingChannels(false));
  }, []);

  async function save(config: Partial<GlobalAlertConfig>) {
    const updated = { enabled, slack_channel: channel, slack_channel_private: channelPrivate, min_score: minScore, ...config };
    setEnabled(updated.enabled);
    setChannel(updated.slack_channel);
    setChannelPrivate(updated.slack_channel_private);
    setMinScore(updated.min_score);

    await fetch("/api/admin/guides?key=alert_config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: JSON.stringify(updated) }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium" style={{ color: "#555" }}>Alertes activées</p>
          <p className="text-[10px]" style={{ color: "#aaa" }}>Envoyer un digest Slack quand des signaux prioritaires sont détectés</p>
        </div>
        <button
          onClick={() => save({ enabled: !enabled })}
          className="relative w-10 h-5 rounded-full transition-colors"
          style={{ background: enabled ? "#16a34a" : "#e5e5e5" }}
        >
          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm" style={{ left: enabled ? "22px" : "2px" }} />
        </button>
      </div>

      {/* Canal partagé */}
      <div>
        <p className="text-xs font-medium mb-1.5" style={{ color: "#555" }}>Canal partagé</p>
        <p className="text-[10px] mb-1" style={{ color: "#aaa" }}>Canal visible par toute l&apos;équipe</p>
        {loadingChannels ? (
          <p className="text-[10px]" style={{ color: "#aaa" }}>Chargement…</p>
        ) : (
          <select
            value={channel}
            onChange={(e) => save({ slack_channel: e.target.value })}
            className="text-xs px-3 py-1.5 border rounded-lg outline-none w-full"
            style={{ borderColor: "#e5e5e5", color: "#555", background: "#fff" }}
          >
            <option value="">Aucun</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>#{ch.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Canal privé / DM */}
      <div>
        <p className="text-xs font-medium mb-1.5" style={{ color: "#555" }}>Canal privé / DM</p>
        <p className="text-[10px] mb-1" style={{ color: "#aaa" }}>Envoyer aussi les alertes à une personne ou dans un canal privé</p>
        {loadingChannels ? (
          <p className="text-[10px]" style={{ color: "#aaa" }}>Chargement…</p>
        ) : (
          <select
            value={channelPrivate}
            onChange={(e) => save({ slack_channel_private: e.target.value })}
            className="text-xs px-3 py-1.5 border rounded-lg outline-none w-full"
            style={{ borderColor: "#e5e5e5", color: "#555", background: "#fff" }}
          >
            <option value="">Aucun</option>
            <optgroup label="Personnes">
              {members.map((m) => (
                <option key={m.id} value={m.id}>💬 {m.name}</option>
              ))}
            </optgroup>
            <optgroup label="Canaux privés">
              {channels.filter((c) => c.is_private).map((ch) => (
                <option key={ch.id} value={ch.id}>🔒 #{ch.name}</option>
              ))}
            </optgroup>
          </select>
        )}
      </div>

      {/* Score minimum */}
      <div>
        <p className="text-xs font-medium mb-1.5" style={{ color: "#555" }}>Score minimum</p>
        <div className="flex items-center gap-3">
          {[50, 60, 70, 80].map((v) => (
            <button
              key={v}
              onClick={() => save({ min_score: v })}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: minScore === v ? "#111" : "#f5f5f5", color: minScore === v ? "#fff" : "#888" }}
            >
              {v}+
            </button>
          ))}
        </div>
      </div>

      {saved && <p className="text-xs" style={{ color: "#16a34a" }}>Enregistré</p>}
    </div>
  );
}
