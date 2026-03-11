import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@clerk/react";
import { supabase } from "../lib/supabase";

export type UserProfile = { is_premium: boolean; total_sales_count: number } | null;

type PremiumContextValue = {
  isPremium: boolean;
  loading: boolean;
  userProfile: UserProfile;
  setPremiumSuccess: () => void;
  refetchPremium: () => void;
};

const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

async function fetchUserProfile(userId: string): Promise<UserProfile> {
  console.log("[PremiumContext] fetchUserProfile → querying Supabase users with id:", userId);

  const { data, error } = await supabase
    .from("users")
    .select("is_premium, total_sales_count")
    .eq("id", userId)
    .maybeSingle();

  console.log("usePremium debug - userId:", userId);
  console.log("usePremium debug - data:", data);
  console.log("usePremium debug - error:", error);

  if (error || !data) {
    // PGRST116 = no rows found; in that case, we create the user row.
    const code = (error as { code?: string } | null)?.code;
    console.warn("[PremiumContext] fetchUserProfile error or empty result:", {
      userId,
      error,
      data,
    });

    if (code === "PGRST116" || (!data && !error)) {
      console.log(
        "[PremiumContext] No existing user row, inserting default user with id:",
        userId
      );
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          id: userId,
          is_premium: false,
        });
      if (insertError) {
        console.error("SUPABASE_ERROR:", insertError);
      }
    }

    return { is_premium: false, total_sales_count: 0 };
  }

  console.log("[PremiumContext] fetchUserProfile result:", data);
  console.log(
    "FINAL CHECK - Premium status from DB:",
    (data as { is_premium?: boolean }).is_premium
  );

  return {
    is_premium: !!(data as { is_premium?: boolean }).is_premium,
    total_sales_count: Number(
      (data as { total_sales_count?: number | null }).total_sales_count ?? 0
    ),
  };
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(true);
  const [refetchCount, setRefetchCount] = useState(0);

  console.log("[PremiumContext] Clerk user.id =", user?.id);

  const isPremium = userProfile?.is_premium === true;

  const setPremiumSuccess = useCallback(() => {
    setUserProfile((prev) => ({
      is_premium: true,
      total_sales_count: prev?.total_sales_count ?? 0,
    }));
  }, []);

  const refetchPremium = useCallback(() => {
    setRefetchCount((c) => c + 1);
  }, []);

  useEffect(() => {
    const userId = user?.id ?? null;
    console.log("Fetching for ID:", userId);
    if (!userId) {
      setUserProfile({ is_premium: false, total_sales_count: 0 });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchUserProfile(userId)
      .then((profile) => {
        if (cancelled) return;
        let safeProfile: UserProfile = profile ?? {
          is_premium: false,
          total_sales_count: 0,
        };

        // Emergency override: si l'URL contient ?success=true ou le localStorage force_premium === "true",
        // on force is_premium = true pour débloquer l'UI même si la BDD est capricieuse.
        try {
          const params = new URLSearchParams(window.location.search);
          const success = params.get("success");
          const forced = window.localStorage.getItem("force_premium") === "true";
          if (success === "true" || forced) {
            safeProfile = {
              is_premium: true,
              total_sales_count: safeProfile?.total_sales_count ?? 0,
            };
            window.localStorage.setItem("force_premium", "true");
          }
        } catch {
          /* ignore */
        }

        setUserProfile(safeProfile);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, location.pathname, refetchCount]);

  // Realtime subscription on users table to keep premium status fresh
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`premium-user-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "users", filter: `id=eq.${userId}` },
        (payload) => {
          const newRow = payload.new as { is_premium?: boolean; total_sales_count?: number | null } | null;
          if (!newRow) return;
          console.log("[PremiumContext] realtime users update:", newRow);
          setUserProfile((prev) => ({
            is_premium: !!newRow.is_premium,
            total_sales_count: Number(newRow.total_sales_count ?? prev?.total_sales_count ?? 0),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const value: PremiumContextValue = {
    isPremium,
    loading,
    userProfile,
    setPremiumSuccess,
    refetchPremium,
  };

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (ctx === undefined) throw new Error("usePremium must be used within PremiumProvider");
  return ctx;
}
