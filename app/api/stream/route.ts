// GET /api/stream — SSE live intelligence feed
//
// Reader-only: the always-on streaming worker (worker/stream-worker.ts)
// is the single writer of live events into the shared store; this route
// tails the store over a short-lived SSE window. The browser EventSource
// reconnects automatically when the window closes, so the feed is
// continuous from the client's perspective while each serverless
// invocation stays within platform duration limits.
import { seedMockData } from '@/lib/ingestion';
import db from '@/lib/db';
import type { LiveEvent } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const WINDOW_MS = 24_000;
const POLL_MS = 3_000;

export async function GET(req: Request) {
  await seedMockData();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const seen = new Set<string>();
      let closed = false;

      const send = (event: LiveEvent) => {
        if (closed || seen.has(event.id)) return;
        seen.add(event.id);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { closed = true; }
      };

      // Push current feed first (oldest → newest so the client
      // renders in order), then tail for new arrivals
      const existing = await db.getLiveEvents(undefined, 15);
      for (const ev of [...existing].reverse()) send(ev);
      let since = existing[0]?.timestamp ?? Date.now() - 60_000;

      const deadline = Date.now() + WINDOW_MS;
      const interval = setInterval(async () => {
        if (closed) { clearInterval(interval); return; }
        try {
          const latest = await db.getLiveEvents(since, 20);
          for (const ev of [...latest].reverse()) send(ev);
          if (latest[0]) since = Math.max(since, latest[0].timestamp);
        } catch { /* transient read failure — next tick retries */ }

        if (Date.now() >= deadline) {
          clearInterval(interval);
          closed = true;
          try { controller.close(); } catch {}
        }
      }, POLL_MS);

      req.signal?.addEventListener('abort', () => {
        closed = true;
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
