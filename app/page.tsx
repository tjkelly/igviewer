"use client";

import { useEffect } from "react";
import LZString from "lz-string";

import JSZip from "jszip";
import { useMemo, useRef, useState } from "react";

type Item = {
  id: string;
  collection: string;
  title: string;
  url: string;
};

type ParsedExport = {
  collections: Record<string, Item[]>;
  allItems: Item[];
  warnings: string[];
};

export default function Page() {
  const [stage, setStage] = useState<"upload" | "pick" | "playlist">("upload");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [parsed, setParsed] = useState<ParsedExport | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<Item | null>(null);
    
  useEffect(() => {
    if (typeof window === "undefined") return;
  
    const params = new URLSearchParams(window.location.search);
    const data = params.get("data");
    if (!data) return;
  
    const payload = decodeShare(data);
    if (!payload) return;
  
    const nextParsed = payloadToParsed(payload);
    setParsed(nextParsed);
  
    const names = Object.keys(nextParsed.collections);
    const all = new Set(names);
    setSelectedCollections(all);
    setExpanded(new Set(names));
  
    const firstCol = names.sort((a, b) => a.localeCompare(b))[0];
    const firstItem = firstCol ? nextParsed.collections[firstCol]?.[0] : null;
    setActive(firstItem ?? null);
  
    setStage("playlist");
  }, []);

  // Step 2 search filter
  const [pickFilter, setPickFilter] = useState("");

  const collectionNames = useMemo(() => {
    if (!parsed) return [];
    return Object.keys(parsed.collections).sort((a, b) => a.localeCompare(b));
  }, [parsed]);

  const filteredCollectionNames = useMemo(() => {
    const q = pickFilter.trim().toLowerCase();
    if (!q) return collectionNames;
    return collectionNames.filter((n) => n.toLowerCase().includes(q));
  }, [pickFilter, collectionNames]);

  const selectedSidebarCollections = useMemo(() => {
    if (!parsed) return [];
    return collectionNames.filter((n) => selectedCollections.has(n));
  }, [parsed, collectionNames, selectedCollections]);

  async function handleZipUpload(file: File) {
    setStage("upload");
    setParsed(null);
    setSelectedCollections(new Set());
    setExpanded(new Set());
    setActive(null);
    setPickFilter("");

    const zip = await JSZip.loadAsync(file);
    const nextParsed = await parseInstagramExportZip(zip);

    setParsed(nextParsed);
    setSelectedCollections(new Set(Object.keys(nextParsed.collections)));
    setStage("pick");
  }

  function togglePick(name: string) {
    setSelectedCollections((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAll() {
    if (!parsed) return;
    setSelectedCollections(new Set(Object.keys(parsed.collections)));
  }

  function deselectAll() {
    setSelectedCollections(new Set());
  }

  function submitPicked() {
    const nextExpanded = new Set(selectedSidebarCollections);
    setExpanded(nextExpanded);

    if (parsed) {
      const firstCol = selectedSidebarCollections[0];
      const firstItem = firstCol ? parsed.collections[firstCol]?.[0] : null;
      setActive(firstItem ?? null);
    }

    setStage("playlist");
  }

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(selectedSidebarCollections));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  function goBack() {
    if (stage === "playlist") {
      setStage("pick");
      setExpanded(new Set());
    } else if (stage === "pick") {
      setStage("upload");
    }
  }

  const playerDisabled = stage !== "playlist";

  return (
    <main className="h-screen flex">
      {/* Sidebar */}
      <aside className="w-96 border-r bg-white p-4 overflow-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xl font-semibold">IG Playlist</div>

          {stage !== "upload" && (
            <button
              className="rounded border px-3 py-1.5 text-sm bg-white"
              onClick={goBack}
              title={stage === "playlist" ? "Back to Pick collections" : "Back to Upload"}
            >
              Back
            </button>
          )}
        </div>

        <div className="text-xs text-neutral-500 mb-4">
          <span className={stage === "upload" ? "font-semibold text-black" : ""}>1 Upload</span>
          <span className="mx-2">·</span>
          <span className={stage === "pick" ? "font-semibold text-black" : ""}>2 Pick collections</span>
          <span className="mx-2">·</span>
          <span className={stage === "playlist" ? "font-semibold text-black" : ""}>3 Watch</span>
        </div>

        {stage === "upload" && (
          <div className="border rounded-2xl p-4 bg-neutral-50">
            <div className="text-lg font-semibold mb-1">Step 1: Upload your Instagram export ZIP</div>
            <div className="text-sm text-neutral-600 mb-4">
              Export from Instagram as JSON, download the ZIP, then upload it here
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleZipUpload(f);
              }}
            />

            <button
              className="w-full rounded-xl bg-black text-white py-3 text-base font-semibold"
              onClick={() => fileRef.current?.click()}
            >
              Choose ZIP file
            </button>

            <div className="mt-3 text-xs text-neutral-500">Nothing is uploaded to a server. This runs locally.</div>
          </div>
        )}

        {stage !== "upload" && parsed && (
          <div className="mb-4 space-y-2">
            <div className="text-xs text-neutral-500">
              Loaded {parsed.allItems.length} items across {Object.keys(parsed.collections).length} collections
            </div>

            <button
              className="rounded border px-3 py-2 bg-white text-sm"
              onClick={() => {
                setStage("upload");
                setExpanded(new Set());
                setActive(null);
              }}
            >
              Upload a different ZIP
            </button>
          </div>
        )}

        {stage === "pick" && parsed && (
          <div className="h-[calc(100vh-140px)] flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">Step 2: Pick collections</div>
                <div className="text-sm text-neutral-600">Select which collections you want in the sidebar</div>
              </div>

              <div className="flex gap-2">
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={selectAll}>
                  Select all
                </button>
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={deselectAll}>
                  Deselect all
                </button>
              </div>
            </div>

            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Search collections…"
              value={pickFilter}
              onChange={(e) => setPickFilter(e.target.value)}
            />

            {filteredCollectionNames.length === 0 ? (
              <div className="text-sm text-neutral-500">No matches</div>
            ) : (
              <div className="mt-2 flex-1 overflow-auto pr-2">
                {filteredCollectionNames.map((name) => (
                  <label key={name} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCollections.has(name)}
                      onChange={() => togglePick(name)}
                    />
                    <span className="truncate">{name}</span>
                    <span className="ml-auto text-xs text-neutral-400">{parsed.collections[name]?.length ?? 0}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="sticky bottom-0 pt-3 bg-white">
              <button
                className="w-full rounded-xl bg-black text-white py-3 font-semibold"
                onClick={submitPicked}
                disabled={selectedCollections.size === 0}
                title={selectedCollections.size === 0 ? "Pick at least one collection" : ""}
              >
                Build playlists
              </button>
            
              {parsed.warnings.length > 0 && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  <div className="font-semibold mb-1">Notes</div>
                  <ul className="list-disc pl-4 space-y-1">
                    {parsed.warnings.slice(0, 6).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {parsed.warnings.length > 0 && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                <div className="font-semibold mb-1">Notes</div>
                <ul className="list-disc pl-4 space-y-1">
                  {parsed.warnings.slice(0, 10).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {stage === "playlist" && parsed && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-neutral-700">Playlists</div>
              <div className="flex gap-2">
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={expandAll}>
                  Expand all
                </button>
                <button className="rounded border px-2 py-1 text-xs bg-white" onClick={collapseAll}>
                  Collapse all
                </button>
              </div>
            </div>
            
           <div className="flex gap-2">
             <button
               className="flex-1 rounded border px-3 py-2 text-sm bg-white"
               onClick={async () => {
                 if (!parsed) return
                 const payload = buildSharePayload(parsed, selectedCollections)
                 const encoded = encodeShare(payload)
                 const url = `${window.location.origin}${window.location.pathname}?data=${encoded}`
                 await navigator.clipboard.writeText(url)
                 alert("Share link copied")
               }}
             >
               Copy share link
             </button>
           
             <button
               className="rounded border px-2 py-2 text-xs bg-white"
               onClick={() => {
                 window.history.replaceState({}, "", window.location.pathname)
                 location.reload()
               }}
             >
               Clear link
             </button>
           </div>

            {selectedSidebarCollections.map((name) => {
              const isOpen = expanded.has(name);
              const list = parsed.collections[name] ?? [];

              return (
                <div key={name} className="border rounded-lg">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                    onClick={() => toggleExpand(name)}
                  >
                    <div className="font-semibold text-sm truncate">{name}</div>
                    <div className="text-xs text-neutral-500 flex items-center gap-2">
                      <span>{list.length}</span>
                      <span>{isOpen ? "▾" : "▸"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t">
                      {list.map((it) => (
                        <button
                          key={it.id}
                          className={
                            "w-full text-left px-3 py-2 border-b last:border-b-0 " +
                            (active?.id === it.id ? "bg-neutral-100" : "bg-white")
                          }
                          onClick={() => setActive(it)}
                        >
                          <div className="text-sm font-medium truncate">{it.title}</div>
                          <div className="text-xs text-neutral-500 truncate">{it.url}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>

      {/* Player */}
      <section className={"flex-1 p-6 overflow-auto " + (playerDisabled ? "bg-neutral-100" : "bg-neutral-50")}>
        {playerDisabled ? (
          <div className="h-full flex items-center justify-center">
            <div className="max-w-lg w-full border rounded-2xl bg-white p-6 text-center">
              <div className="text-xl font-semibold mb-2">Start on the left</div>
              <div className="text-sm text-neutral-600">Upload your Instagram export ZIP to build playlists</div>
            </div>
          </div>
        ) : (
          <>
            <div className="text-sm text-neutral-600 mb-3 truncate">
              {active ? `${active.collection} · ${active.title}` : "No video selected"}
            </div>

            <div className="bg-white border rounded-xl p-4">
              {!active ? (
                <div className="text-neutral-500">Pick a video from the left</div>
              ) : (
                <>
                  <InstagramEmbed url={active.url} />
                  <div className="mt-3 text-xs text-neutral-500 break-all">{active.url}</div>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

/* Parsing + embed helpers */

async function parseInstagramExportZip(zip: JSZip): Promise<ParsedExport> {
  const warnings: string[] = [];

  const jsonNames = Object.keys(zip.files).filter((n) => n.toLowerCase().endsWith(".json"));
  if (jsonNames.length === 0) return { collections: {}, allItems: [], warnings: ["No .json files found in ZIP"] };

  const savedCollectionsPath =
    jsonNames.find((n) => /saved_collections\.json$/i.test(n)) || jsonNames.find((n) => /saved_collections/i.test(n));

  if (savedCollectionsPath) {
    try {
      const raw = await zip.file(savedCollectionsPath)!.async("string");
      const data = JSON.parse(raw);

      const map = parseSavedCollectionsJson(data) ?? {};

      if (Object.keys(map).length === 0) {
        warnings.push(
          "Found saved_collections.json but couldn’t detect your collection structure. Falling back to generic scan."
        );
      } else {
        const collections: Record<string, Item[]> = {};
        const allItems: Item[] = [];

        for (const cName of Object.keys(map).sort((a, b) => a.localeCompare(b))) {
          const urls = map[cName] ?? [];
          collections[cName] = urls.map((u, i) => {
            const it: Item = {
              id: `${cName}-${i}-${Math.random().toString(16).slice(2)}`,
              collection: cName,
              title: u,
              url: u,
            };
            allItems.push(it);
            return it;
          });
        }

        return { collections, allItems, warnings };
      }
    } catch (e: any) {
      warnings.push(
        "Failed to read saved_collections.json. Falling back to generic scan. " +
          (e?.message ? `(${e.message})` : `(${String(e)})`)
      );
    }
  }

  // Fallback: generic scan of all JSONs for IG links
  const items: Item[] = [];

  const prioritized = [
    ...jsonNames.filter((n) => /save|saved|collection|bookmark/i.test(n)),
    ...jsonNames.filter((n) => !/save|saved|collection|bookmark/i.test(n)),
  ];

  let hitCount = 0;

  for (const name of prioritized) {
    try {
      const raw = await zip.file(name)!.async("string");
      const data = JSON.parse(raw);
      const extracted = extractItemsFromUnknownJson(data, name);
      if (extracted.length) hitCount += extracted.length;
      items.push(...extracted);
    } catch {
      // ignore
    }
  }

  if (hitCount === 0) warnings.push("No instagram.com/p or instagram.com/reel links were found in the export ZIP.");

  const seen = new Set<string>();
  const deduped: Item[] = [];
  for (const it of items) {
    if (seen.has(it.url)) continue;
    seen.add(it.url);
    deduped.push(it);
  }

  const collections: Record<string, Item[]> = {};
  for (const it of deduped) {
    const c = it.collection || "Unsorted";
    if (!collections[c]) collections[c] = [];
    collections[c].push(it);
  }

  for (const c of Object.keys(collections)) collections[c].sort((a, b) => a.title.localeCompare(b.title));

  return { collections, allItems: deduped, warnings };
}

function parseSavedCollectionsJson(data: any): Record<string, string[]> {
  const list = Array.isArray(data?.saved_saved_collections)
    ? data.saved_saved_collections
    : Array.isArray(data)
    ? data
    : [];

  const results: Record<string, string[]> = {};
  let current = "Unsorted";

  const add = (collection: string, href: string) => {
    if (typeof href !== "string") return;
    const u = normalizeIg(coerceIgUrl(href));
    if (!u) return;
    if (!results[collection]) results[collection] = [];
    if (!results[collection].includes(u)) results[collection].push(u);
  };

  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;

    if (typeof (entry as any).title === "string" && (entry as any).title.toLowerCase() === "collection") {
      const name = (entry as any)?.string_map_data?.Name?.value;
      if (typeof name === "string" && name.trim()) current = name.trim();
      continue;
    }

    const href = (entry as any)?.string_map_data?.Name?.href;
    if (typeof href === "string" && href.includes("instagram.com/")) add(current, href);
  }

  if (results.Unsorted?.length === 0) delete results.Unsorted;
  return results;
}

function extractItemsFromUnknownJson(data: any, sourceName: string): Item[] {
  const out: Item[] = [];
  const nodes: any[] = [];

  const visit = (x: any) => {
    if (!x) return;
    if (typeof x === "string") return;
    if (Array.isArray(x)) {
      for (const v of x) visit(v);
      return;
    }
    if (typeof x === "object") {
      nodes.push(x);
      for (const k of Object.keys(x)) visit((x as any)[k]);
    }
  };
  visit(data);

  for (const obj of nodes) {
    const strings: string[] = [];
    for (const v of Object.values(obj)) {
      if (typeof v === "string") strings.push(v);
      if (Array.isArray(v)) for (const vv of v) if (typeof vv === "string") strings.push(vv);
    }

    for (const s of strings) {
      const url = extractFirstIgUrl(s);
      if (!url) continue;

      const collection = pickString(obj, ["collection", "collection_name", "folder", "name", "title"]) || "Unsorted";
      const title = pickString(obj, ["title", "name", "caption", "text"]) || `${sourceName.split("/").pop()}: ${url}`;

      out.push({
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        collection,
        title: cleanTitle(title),
        url: normalizeIg(url),
      });
    }
  }

  return out;
}

function pickString(obj: any, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function cleanTitle(s: string) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 140 ? t.slice(0, 140) + "…" : t;
}

function extractFirstIgUrl(s: string): string | null {
  const m = s.match(/https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[^ \n\r\t"]+/i);
  return m ? m[0] : null;
}

function normalizeIg(u: string) {
  let url = u.trim().split("?")[0];
  if (!url.endsWith("/")) url += "/";
  return url;
}

function coerceIgUrl(u: string): string {
  const s = (u || "").trim();
  if (!s) return s;
  if (s.startsWith("/")) return `https://www.instagram.com${s}`;
  if (s.startsWith("p/") || s.startsWith("reel/") || s.startsWith("tv/")) return `https://www.instagram.com/${s}`;
  return s;
}

function InstagramEmbed({ url }: { url: string }) {
  const info = parseIg(url);
  if (!info) return <div className="text-sm text-neutral-500">Invalid Instagram URL</div>;

  const src = `https://www.instagram.com/${info.type}/${info.code}/embed/`;

  return (
    <iframe
      key={src}
      src={src}
      className="w-full"
      style={{ height: 900, border: 0 }}
      scrolling="no"
      allow="encrypted-media; fullscreen"
      allowFullScreen
    />
  );
}


type SharePayload = {
  v: 1;
  name?: string;
  collections: Record<string, { title: string; url: string }[]>;
};

function buildSharePayload(
  parsed: ParsedExport,
  selected: Set<string>
): SharePayload {
  const collections: SharePayload["collections"] = {};
  for (const name of Object.keys(parsed.collections)) {
    if (!selected.has(name)) continue;
    collections[name] = (parsed.collections[name] ?? []).map((it) => ({
      title: it.title,
      url: it.url,
    }));
  }
  return { v: 1, collections };
}

function encodeShare(payload: SharePayload) {
  const json = JSON.stringify(payload);
  return LZString.compressToEncodedURIComponent(json);
}

function decodeShare(data: string): SharePayload | null {
  const json = LZString.decompressFromEncodedURIComponent(data);
  if (!json) return null;
  const payload = JSON.parse(json);
  if (!payload || payload.v !== 1 || !payload.collections) return null;
  return payload as SharePayload;
}

function payloadToParsed(payload: SharePayload): ParsedExport {
  const collections: Record<string, Item[]> = {};
  const allItems: Item[] = [];

  for (const [cName, list] of Object.entries(payload.collections)) {
    collections[cName] = (list ?? []).map((x, i) => {
      const it: Item = {
        id: `${cName}-${i}-${Math.random().toString(16).slice(2)}`,
        collection: cName,
        title: x.title || x.url,
        url: x.url,
      };
      allItems.push(it);
      return it;
    });
  }

  return { collections, allItems, warnings: [] };
}

function parseIg(u: string): { type: "p" | "reel" | "tv"; code: string } | null {
  const clean = u.trim().split("?")[0];
  const m = clean.match(/instagram\.com\/(p|reel|tv)\/([^\/]+)/i);
  if (!m) return null;
  return { type: m[1].toLowerCase() as any, code: m[2] };
}