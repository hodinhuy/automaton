/**
 * Automaton 3-Tier Web Pipeline: Web Search & Web Extract
 *
 * Tier 1: web_search - Fast, keyless or API-backed semantic discovery (DDG / Tavily / Brave)
 * Tier 2: web_extract - Clean structured Markdown extraction (Cheerio + Turndown)
 * Tier 3: browser_action - Escalate to Headless Chromium for SPAs, Cloudflare, interactions
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface ExtractResult {
  title?: string;
  url: string;
  content?: string;
  error?: string;
  escalateToBrowser?: boolean;
}

/**
 * Tier 1: Search the web via Tavily / Brave (if keys present) or DuckDuckGo (keyless fallback).
 */
export async function searchWeb(query: string, limit: number = 5): Promise<SearchResultItem[]> {
  const maxResults = Math.min(Math.max(limit, 1), 10);

  // 1. Tavily Search API (if configured)
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          max_results: maxResults,
          include_snippets: true,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = (await resp.json()) as any;
        if (Array.isArray(data.results)) {
          return data.results.slice(0, maxResults).map((r: any) => ({
            title: r.title || "",
            url: r.url || "",
            snippet: r.content || r.snippet || "",
          }));
        }
      }
    } catch (err) {
      // Fallback to DuckDuckGo
    }
  }

  // 2. Brave Search API (if configured)
  const braveKey = process.env.BRAVE_SEARCH_API_KEY || process.env.BRAVE_API_KEY;
  if (braveKey) {
    try {
      const resp = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
        {
          headers: {
            "Accept": "application/json",
            "X-Subscription-Token": braveKey,
          },
          signal: AbortSignal.timeout(10000),
        },
      );
      if (resp.ok) {
        const data = (await resp.json()) as any;
        if (data.web?.results && Array.isArray(data.web.results)) {
          return data.web.results.slice(0, maxResults).map((r: any) => ({
            title: r.title || "",
            url: r.url || "",
            snippet: r.description || "",
          }));
        }
      }
    } catch (err) {
      // Fallback to DuckDuckGo
    }
  }

  // 3. DuckDuckGo HTML (Keyless Out-of-the-box fallback)
  try {
    const results = await searchDuckDuckGoHtml(query, maxResults);
    if (results.length > 0) {
      return results;
    }
  } catch (err) {
    // Try DDG Lite fallback
  }

  // 4. DuckDuckGo Lite fallback
  return await searchDuckDuckGoLite(query, maxResults);
}

async function searchDuckDuckGoHtml(query: string, limit: number): Promise<SearchResultItem[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
    },
    signal: AbortSignal.timeout(12000),
  });

  const html = await resp.text();
  const $ = cheerio.load(html);
  const results: SearchResultItem[] = [];

  $(".result").each((_, el) => {
    if (results.length >= limit) return;
    const titleEl = $(el).find(".result__title .result__a");
    const snippetEl = $(el).find(".result__snippet");
    const title = titleEl.text().trim();
    let rawUrl = titleEl.attr("href") || "";

    if (rawUrl.includes("uddg=")) {
      try {
        const parsed = new URL("https://duckduckgo.com" + rawUrl);
        rawUrl = decodeURIComponent(parsed.searchParams.get("uddg") || rawUrl);
      } catch (e) {}
    }

    const snippet = snippetEl.text().trim();
    if (title && rawUrl && !rawUrl.includes("duckduckgo.com/y.js")) {
      results.push({ title, url: rawUrl, snippet });
    }
  });

  return results;
}

async function searchDuckDuckGoLite(query: string, limit: number): Promise<SearchResultItem[]> {
  const resp = await fetch("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    },
    body: `q=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(12000),
  });

  const html = await resp.text();
  const $ = cheerio.load(html);
  const results: SearchResultItem[] = [];

  $("table tr").each((_, el) => {
    if (results.length >= limit) return;
    const link = $(el).find(".result-link");
    if (link.length) {
      const title = link.text().trim();
      let rawUrl = link.attr("href") || "";
      if (rawUrl.includes("uddg=")) {
        try {
          const parsed = new URL("https://duckduckgo.com" + rawUrl);
          rawUrl = decodeURIComponent(parsed.searchParams.get("uddg") || rawUrl);
        } catch (e) {}
      }
      const snippet = $(el).next().find(".result-snippet").text().trim();
      if (title && rawUrl) {
        results.push({ title, url: rawUrl, snippet });
      }
    }
  });

  return results;
}

/**
 * Tier 2: Extract main article/page content as clean Markdown.
 * Strips script, style, navigation, footer, and ads.
 * Emits escalation recommendation if blocked by anti-bot or SPA is empty.
 */
export async function extractWeb(url: string, maxLength: number = 12000): Promise<ExtractResult> {
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (resp.status === 403 || resp.status === 503) {
      return {
        url,
        error: `Page returned HTTP ${resp.status} (anti-bot protection or Cloudflare). Escalate to 'browser_action' with action: 'extract' or 'navigate' to bypass.`,
        escalateToBrowser: true,
      };
    }

    if (!resp.ok) {
      return {
        url,
        error: `Failed to fetch URL: HTTP ${resp.status} ${resp.statusText}`,
      };
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    // Strip clutter tags
    $(
      "script, style, noscript, svg, nav, footer, header, iframe, link, meta, [role='navigation'], [role='banner'], [role='complementary'], .ad, .ads, .advertisement",
    ).remove();

    const title = $("title").text().trim() || $("h1").first().text().trim() || url;

    // Target primary article or body container
    const mainEl = $("main").length ? $("main") : $("article").length ? $("article") : $("body");

    const turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      hr: "---",
    });

    const markdown = turndown.turndown(mainEl.html() || "");
    const cleanMarkdown = markdown.replace(/\n{3,}/g, "\n\n").trim();

    if (cleanMarkdown.length < 150) {
      return {
        url,
        title,
        content: cleanMarkdown,
        error:
          "Extracted content is very short (<150 chars). The site may be a client-side Single Page Application (SPA, React/Vue) requiring JavaScript rendering. Escalate to 'browser_action'.",
        escalateToBrowser: true,
      };
    }

    const truncated =
      cleanMarkdown.length > maxLength
        ? cleanMarkdown.slice(0, maxLength) + `\n\n...[Content truncated, total length: ${cleanMarkdown.length} chars]`
        : cleanMarkdown;

    return {
      url,
      title,
      content: truncated,
    };
  } catch (err: any) {
    return {
      url,
      error: `web_extract failed: ${err.message}. If this is a connectivity or bot-block issue, try 'browser_action'.`,
      escalateToBrowser: true,
    };
  }
}
