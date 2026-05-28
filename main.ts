import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const WORKER_URL = Deno.env.get("WORKER_URL")!;
const API_KEY = Deno.env.get("API_KEY")!;

// Peta rasio ke lebar dan tinggi (dalam batas 1024px)
const ASPECT_RATIOS = {
  "1:1": { width: 1024, height: 1024 },
  "9:16": { width: 576, height: 1024 },
  "16:9": { width: 1024, height: 576 },
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Image Generator Blog</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
    textarea { width: 100%; height: 80px; }
    .ratio-options { margin: 0.5rem 0; }
    label { margin-right: 1rem; }
    button { padding: 0.5rem 1.5rem; margin-top: 0.5rem; cursor: pointer; }
    img { max-width: 100%; margin-top: 1rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    #loading { display: none; color: #666; }
    #error { color: red; }
    .ad-placeholder { margin: 2rem 0; padding: 1rem; background: #f9f9f9; border: 1px dashed #ccc; text-align: center; }
  </style>
</head>
<body>
  <h1>🎨 AI Image Generator Blog</h1>
  <p>Enter a prompt to generate an image:</p>
  <textarea id="prompt" placeholder="e.g., A cat wearing a wizard hat, digital art"></textarea>

  <div class="ratio-options">
    <strong>Aspect Ratio:</strong>
    <label><input type="radio" name="ratio" value="1:1" checked> Square (1:1)</label>
    <label><input type="radio" name="ratio" value="9:16"> Portrait (9:16)</label>
    <label><input type="radio" name="ratio" value="16:9"> Landscape (16:9)</label>
  </div>

  <button onclick="generate()">Generate</button>
  <div id="loading">⏳ Generating image...</div>
  <div id="error"></div>
  <img id="result" style="display:none" alt="Generated image" />

  <!-- Iklan: Ganti dengan kode iklan Anda nanti -->
  <div class="ad-placeholder">
    📢 Your Ad Here – Monetize with Monetag or AdSense
  </div>

  <script>
    async function generate() {
      const prompt = document.getElementById("prompt").value;
      const ratio = document.querySelector('input[name="ratio"]:checked').value;
      const loading = document.getElementById("loading");
      const errorDiv = document.getElementById("error");
      const img = document.getElementById("result");

      if (!prompt.trim()) {
        errorDiv.textContent = "Please enter a prompt.";
        return;
      }

      errorDiv.textContent = "";
      img.style.display = "none";
      loading.style.display = "block";

      try {
        const response = await fetch("/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, ratio }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "Generation failed" }));
          throw new Error(err.error || "Generation failed");
        }

        const blob = await response.blob();
        img.src = URL.createObjectURL(blob);
        img.style.display = "block";
      } catch (err) {
        errorDiv.textContent = "❌ " + err.message;
      } finally {
        loading.style.display = "none";
      }
    }
  </script>
</body>
</html>`;

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/") {
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (req.method === "POST" && url.pathname === "/generate") {
    try {
      const { prompt, ratio } = await req.json();
      if (!prompt) {
        return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
      }

      // Dapatkan dimensi sesuai rasio, default 1:1
      const dimensions = ASPECT_RATIOS[ratio] || ASPECT_RATIOS["1:1"];

      // Kirim ke Cloudflare Worker
      const workerResp = await fetch(WORKER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          width: dimensions.width,
          height: dimensions.height,
        }),
      });

      if (!workerResp.ok) {
        const errData = await workerResp.json().catch(() => null);
        return new Response(
          JSON.stringify({ error: errData?.error || "Worker error" }),
          { status: workerResp.status }
        );
      }

      return new Response(workerResp.body, {
        headers: { "Content-Type": "image/jpeg" },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Internal server error", details: err.message }),
        { status: 500 }
      );
    }
  }

  return new Response("Not Found", { status: 404 });
}

serve(handler);
