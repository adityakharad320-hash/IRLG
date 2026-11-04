"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "../lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type RealtimeConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

interface UseMatchRealtimeOptions {
  matchId: string;
  accessToken: string | null;
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseMatchRealtimeResult {
  connectionState: RealtimeConnectionState;
  lastEventAt: Date | null;
  refreshNow: () => void;
}

/**
 * Custom hook to subscribe to real-time lobby updates for a match.
 * Treats Realtime strictly as a notification/refresh transport, never as the source of truth.
 * Ensures robust debounce, reconnection handling, and clean unsubscription.
 */
export function useMatchRealtime({
  matchId,
  accessToken,
  onRefresh,
  enabled = true,
  debounceMs = 250,
}: UseMatchRealtimeOptions): UseMatchRealtimeResult {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(() =>
    enabled && matchId ? "connecting" : "disconnected"
  );
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Debounced trigger to fetch authoritative state from backend
  const triggerRefresh = useCallback(() => {
    setLastEventAt(new Date());
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void onRefreshRef.current();
    }, debounceMs);
  }, [debounceMs]);

  const refreshNow = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setLastEventAt(new Date());
    void onRefreshRef.current();
  }, []);

  useEffect(() => {
    if (!enabled || !matchId) {
      return;
    }

    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let isSubscribed = false;

    // Handle browser network online / offline events
    const handleOnline = () => {
      setConnectionState("reconnecting");
      triggerRefresh();
    };

    const handleOffline = () => {
      setConnectionState("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    try {
      const channelName = `match_lobby:${matchId}`;
      channel = supabase.channel(channelName);

      // Listen to database changes for match status and settings
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `id=eq.${matchId}`,
        },
        () => {
          triggerRefresh();
        }
      );

      // Listen to database changes for match participants (joins, readiness)
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_participants",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          triggerRefresh();
        }
      );

      // Listen to broadcast notifications if backend or peer emits updates
      channel.on(
        "broadcast",
        { event: "lobby_update" },
        () => {
          triggerRefresh();
        }
      );

      // Subscribe and monitor channel connectivity state
      channel.subscribe((status, err) => {
        if (err) {
          console.warn(`[Realtime] Subscription error on ${channelName}:`, err);
          setConnectionState("error");
          return;
        }

        switch (status) {
          case "SUBSCRIBED":
            setConnectionState("connected");
            if (isSubscribed) {
              // Re-subscription event after reconnect -> refresh state
              triggerRefresh();
            }
            isSubscribed = true;
            break;
          case "TIMED_OUT":
            setConnectionState("reconnecting");
            break;
          case "CHANNEL_ERROR":
            setConnectionState("error");
            break;
          case "CLOSED":
            setConnectionState("disconnected");
            break;
          default:
            break;
        }
      });
    } catch (err) {
      console.error("[Realtime] Failed to initialize channel:", err);
      queueMicrotask(() => {
        setConnectionState("error");
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [matchId, accessToken, enabled, triggerRefresh]);

  return {
    connectionState,
    lastEventAt,
    refreshNow,
  };
}
