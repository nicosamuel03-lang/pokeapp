import { createContext, useContext } from "react";

export type AuthState = "loading" | "free" | "premium";

type SubscriptionContextValue = {
  authState: AuthState;
  isPremium: boolean;
  isLoading: boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({
  value,
  children,
}: {
  value: SubscriptionContextValue;
  children: React.ReactNode;
}) {
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  console.log("[RENDER] useSubscription:", "isPremium:", ctx.isPremium, "isLoading:", ctx.isLoading, new Date().toISOString());
  return ctx;
}

