// @ts-nocheck
// This file is used to suppress TypeScript errors for Deno imports in VSCode
// These imports work fine in Deno/Supabase Edge Functions runtime
// You can safely ignore the import errors in your editor

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js'
}

declare module 'https://deno.land/x/denomailer@1.6.0/mod.ts' {
  export interface SMTPConfig {
    connection: {
      hostname: string
      port: number
      tls: boolean
      auth: {
        username: string
        password: string
      }
    }
  }

  export interface EmailOptions {
    from: string
    to: string
    subject: string
    content: string
    html: string
  }

  export class SMTPClient {
    constructor(config: SMTPConfig)
    send(options: EmailOptions): Promise<void>
    close(): Promise<void>
  }
}

// Deno namespace
declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined
  }
}
