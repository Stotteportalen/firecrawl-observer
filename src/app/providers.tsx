'use client'

import { ReactNode } from "react"
import { SWRConfig } from "swr"
import { ToastProvider } from "@/hooks/use-toast"

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Request failed');
  return res.json();
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{
      fetcher,
      revalidateOnFocus: false,
      dedupingInterval: 2000,
    }}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </SWRConfig>
  )
}
