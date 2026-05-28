import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const WORKER_URL = Deno.env.get("WORKER_URL") || "";
const API_KEY = Deno.env.get("API_KEY") || "";

const ASPECT_RATIOS = {
  "1:1": { width: 1024, height: 1024 },
  "9:16": { width: 576, height: 1024 },
  "16:9": { width: 1024, height: 576 },
};

const html = `<h1>AI Image Generator</h1>`;

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/") {
    return new Response(html, {
      headers: {
        "content-type": "text/html",
      },
    });
  }

  if (req.method === "POST" && url.pathname === "/generate") {
    try {
      if (!WORKER_URL || !API_KEY) {
        return new Response(
          JSON.stringify({
            error: "Missing environment variables",
          }),
          {
            status: 500,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }

      const { prompt, ratio } = await req.json();

      const dimensions =
        ASPECT_RATIOS[ratio as keyof typeof ASPECT_RATIOS] ||
        ASPECT_RATIOS["1:1"];

      const workerResp = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          width: dimensions.width,
          height: dimensions.height,
        }),
      });

      return new Response(workerResp.body, {
        headers: {
          "content-type": "image/jpeg",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          details: err instanceof Error ? err.message : String(err),
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }
  }

  return new Response("Not Found", {
    status: 404,
  });
}

serve(handler);
