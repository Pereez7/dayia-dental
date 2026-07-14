/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DAYIA_PLATFORM_CREATE_ENABLED?: string
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_APP_URL?: string
  readonly VITE_ENABLE_DEMO_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
