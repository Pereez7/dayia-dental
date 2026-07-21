/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_APP_URL?: string
  readonly VITE_ENABLE_DEMO_MODE?: string
  readonly VITE_DAYIA_BILLING_WHATSAPP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
