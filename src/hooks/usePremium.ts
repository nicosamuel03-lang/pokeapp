import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@clerk/react";
import { supabase } from "../lib/supabase";

export function usePremium(): { isPremium: boolean; loading: boolean } {
  const { user } = useUser();
  const location = useLocation();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      setIsPremium(false);
      setLoading(false);
      try {
        window.localStorage.removeItem("pokevault_is_premium");
      } catch {
        /* ignore */
      }
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("users")
      .select("is_premium")
      .eq("id", userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        const next = error ? false : data?.is_premium === true;
        setIsPremium(next);
        try {
          window.localStorage.setItem(
            "pokevault_is_premium",
            next ? "true" : "false"
          );
        } catch {
          /* ignore */
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, location.pathname]);

  return { isPremium, loading };
}
