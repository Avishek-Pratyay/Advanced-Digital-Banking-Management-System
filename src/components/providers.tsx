"use client";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/store";
import { sessionLoaded, sessionLoading } from "@/store/slices/authSlice";
import { setTheme } from "@/store/slices/uiSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { Toaster, TopProgress } from "./ui/feedback";

function SessionSync() {
  const { data, status } = useSession();
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (status === "loading") dispatch(sessionLoading());
    else dispatch(sessionLoaded(data?.user ? { id: data.user.id, name: data.user.name ?? "", email: data.user.email ?? "", role: data.user.role } : null));
  }, [data, status, dispatch]);
  return null;
}

function ThemeSync() {
  const theme = useAppSelector((s) => s.ui.theme);
  const dispatch = useAppDispatch();
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vl-theme") as "light" | "dark" | "system" | null;
      if (saved) dispatch(setTheme(saved));
    } catch {}
  }, [dispatch]);
  useEffect(() => {
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    try {
      localStorage.setItem("vl-theme", theme);
    } catch {}
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const ref = useRef<AppStore>();
  if (!ref.current) ref.current = makeStore();
  return (
    <SessionProvider refetchOnWindowFocus>
      <Provider store={ref.current}>
        <SessionSync />
        <ThemeSync />
        <TopProgress />
        {children}
        <Toaster />
      </Provider>
    </SessionProvider>
  );
}
