import { subscribe } from "../../../lib/realtime.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(data) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// 瀏覽器會以 EventSource 維持這條連線。資料真的寫入完成後才廣播，
// 所以收到通知的分頁重新讀取時一定能拿到完整、原子寫入的檔案內容。
export async function GET(request) {
  let stop = () => {};
  let keepAlive;

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepAlive);
        stop();
        try {
          controller.close();
        } catch {
          // 已由瀏覽器關閉的串流不需要再處理。
        }
      };

      stop = subscribe((change) => {
        if (!closed) controller.enqueue(sse(change));
      });
      controller.enqueue(sse({ type: "ready" }));
      keepAlive = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 20_000);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      clearInterval(keepAlive);
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
