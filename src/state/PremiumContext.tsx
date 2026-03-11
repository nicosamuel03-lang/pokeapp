import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@clerk/react";
import { supabase } from "../lib/supabase";

export type UserProfile = { is_premium: boolean } | null;

type PremiumContextValue = {
  isPremium: boolean;
  loading: boolean;
  userProfile: UserProfile;
  setPremiumSuccess: () => void;
  refetchPremium: () => void;
};

const PremiumContext = createContext<PremiumContextValue | undefined>(undefined);

async function fetchIsPremium(userId: string): Promise<boolean> {
  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", userId)
    .single();

  if (!profilesError && profilesData != null) return profilesData.is_premium === true;

  const tableMissing = profilesError?.message?.includes("does not exist") ?? false;
  if (tableMissing) {
    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("is_premium")
      .eq("id", userId)
      .single();
    if (!usersError && usersData != null) return usersData.is_premium === true;
  }

  return false;
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState<UserProfile>(null);
  const [loading, setLoading] = useState(true);
  const [refetchCount, setRefetchCount] = useState(0);

  const isPremium = userProfile?.is_premium === true;

  const setPremiumSuccess = useCallback(() => {
    setUserProfile({ is_premium: true });
    try {
      window.localStorage.setItem("pokevault_is_premium", "true");
    } catch {
      /* ignore */
    }
  }, []);

  const refetchPremium = useCallback(() => {
    setRefetchCount((c) => c + 1);
  }, []);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (!userId) {
      setUserProfile({ is_premium: false });
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

    fetchIsPremium(userId)
      .then((next) => {
        if (cancelled) return;
        setUserProfile({ is_premium: next });
        try {
          window.localStorage.setItem("pokevault_is_premium", next ? "true" : "false");
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
  }, [user?.id, location.pathname, refetchCount]);

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
