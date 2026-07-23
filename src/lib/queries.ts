import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Account, Debt, BudgetCategory, Transaction, Goal, Reminder, Profile } from "./types";

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useAccounts(userId: string | undefined) {
  return useQuery({
    queryKey: ["accounts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });
}

export function useDebts(userId: string | undefined) {
  return useQuery({
    queryKey: ["debts", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("*").order("priority");
      if (error) throw error;
      return (data ?? []) as Debt[];
    },
  });
}

export function useBudget(userId: string | undefined) {
  return useQuery({
    queryKey: ["budget", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("budget_categories").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as BudgetCategory[];
    },
  });
}

export function useTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: ["transactions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions").select("*").order("occurred_on", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });
}

export function useGoals(userId: string | undefined) {
  return useQuery({
    queryKey: ["goals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
}

export function useReminders(userId: string | undefined) {
  return useQuery({
    queryKey: ["reminders", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("reminders").select("*").order("due_at");
      if (error) throw error;
      return (data ?? []) as Reminder[];
    },
  });
}

export function useAllData(userId: string | undefined) {
  const accounts = useAccounts(userId);
  const debts = useDebts(userId);
  const budget = useBudget(userId);
  const transactions = useTransactions(userId);
  const goals = useGoals(userId);
  const reminders = useReminders(userId);
  const loading = accounts.isLoading || debts.isLoading || budget.isLoading || transactions.isLoading || goals.isLoading || reminders.isLoading;
  return {
    loading,
    accounts: accounts.data ?? [],
    debts: debts.data ?? [],
    budget: budget.data ?? [],
    transactions: transactions.data ?? [],
    goals: goals.data ?? [],
    reminders: reminders.data ?? [],
  };
}