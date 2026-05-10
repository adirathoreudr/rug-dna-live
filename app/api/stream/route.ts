// GET /api/stream — SSE live intelligence feed (real GoldRush data)
import { seedMockData } from '@/lib/ingestion';
import db from '@/lib/db';
import { nanoid, timeAgo } from '@/lib/utils';
import { hasApiKey, getSolanaNewTokens, getNewDexPairs } from '@/lib/goldrush';
import { ingestProject } from '@/lib/ingestion';
import type { LiveEvent } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await seedMockData();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: LiveEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      // Push existing events first
      const existing = db.getLiveEvents(undefined, 15);
      for (const ev of existing) send(ev);

      // Poll for new events every 8s
      let ticks = 0;
      const interval = setInterval(async () => {
        ticks++;

        // Every tick: push latest db events
        const latest = db.getLiveEvents(undefined, 3);
        for (const ev of latest.slice(0, 2)) send(ev);

        // Every 3rd tick: scan for new launches (if API key present)
        if (ticks % 3 === 0 && hasApiKey()) {
          try {
            const [solanaPairs, ethPairs] = await Promise.all([
              getSolanaNewTokens(3),
              getNewDexPairs('eth-mainnet', 'uniswap_v3', 3),
            ]);

            for (const p of [...solanaPairs, ...ethPairs].slice(0, 2)) {
              const addr = p.token0_contract_address;
              if (!addr) continue;
              const chain = solanaPairs.includes(p) ? 'solana-mainnet' : 'eth-mainnet';

              // Fire discovery event immediately
              const discoveryEvent: LiveEvent = {
                id: nanoid(),
                projectId: 'discovery',
                tokenSymbol: p.token0_contract_ticker_symbol ?? addr.slice(0, 8),
                eventType: 'pair_created',
                severity: 'info',
                message: `New pair detected on ${chain}: $${p.token0_contract_ticker_symbol ?? addr.slice(0, 10)} — Analyzing...`,
                timestamp: Date.now(),
              };
              db.pushLiveEvent(discoveryEvent);
              send(discoveryEvent);

              // Ingest async (don't await — don't block stream)
              ingestProject(addr, chain as any).then(proj => {
                if (!proj) return;
                const ev: LiveEvent = {
                  id: nanoid(),
                  projectId: proj.id,
                  tokenSymbol: proj.tokenSymbol,
                  eventType: 'pair_created',
                  severity: proj.currentRiskScore > 70 ? 'critical' : proj.currentRiskScore > 40 ? 'warning' : 'info',
                  message: `$${proj.tokenSymbol} scored ${proj.currentRiskScore}/100 · ${proj.currentRiskLevel.toUpperCase()} · ${proj.holderCount} holders · ${chain}`,
                  timestamp: Date.now(),
                };
                db.pushLiveEvent(ev);
                send(ev);
              });
            }
          } catch {}
        }

        if (ticks >= 20) {
          clearInterval(interval);
          try { controller.close(); } catch {}
        }
      }, 8000);

      req.signal?.addEventListener('abort', () => {
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
