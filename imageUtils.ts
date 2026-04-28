import { supabase } from '../supabase';

export interface ConnectionStatus {
  ok: boolean;
  message: string;
  details: string;
  tables: Record<string, boolean>;
  latencyMs?: number;
  attemptedUrl?: string;
}

export const checkRegistryConnection = async (): Promise<ConnectionStatus> => {
    const startTime = Date.now();
    try {
        const { error } = await supabase.from('clients').select('id').limit(1);
        if (error) throw error;
        const latencyMs = Date.now() - startTime;
        return { 
          ok: true, 
          message: "Supabase Online", 
          details: "SANS Data Node is operational via Supabase.",
          tables: { 'clients': true },
          latencyMs,
          attemptedUrl: 'Supabase'
        };
    } catch (error: any) {
        return { 
          ok: false, 
          message: "Offline", 
          details: error.message || "Could not connect to Supabase.", 
          tables: {},
          attemptedUrl: 'Supabase'
        };
    }
};
