import { useEffect, useState } from "react";
import { useUser } from "@clerk/react";
import { supabase } from "../lib/supabase";

export function usePremium(): { isPremium: boolean; loading: boolean } {
  const { user } = useUser();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      setIsPremium(false);
      setLoading(false);
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
        setIsPremium(error ? false : (data?.is_premium === true));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { isPremium, loading };
}
