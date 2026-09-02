/**
 * Rohschemas für die Kickbase-v4-Antworten (kryptische Kurz-Keys, wie
 * Kickbase sie tatsächlich verschickt). Alle Objekte sind `looseObject` —
 * die API ist inoffiziell und kann jederzeit neue Felder ergänzen, ohne
 * dass wir das mitbekommen. Bekannte Felder sind zusätzlich `.optional()`,
 * wo die Doku keine Garantie gibt, damit ein fehlendes Feld nie den
 * kompletten Screen zum Absturz bringt (siehe mappers.ts für die Defaults).
 *
 * Quelle der Feldnamen: github.com/kevinskyba/kickbase-api-doc (inoffiziell).
 * TODO nach scripts/probe.ts: Statuscodes (st), Formationsstrings und die
 * Basierung von `lo` (0- oder 1-indexiert) gegen echte Antworten verifizieren.
 */
import { z } from 'zod';

export const rawLoginResponseSchema = z.looseObject({
  // Doku ist sich uneins ob der Access-Token "tkn" oder "token" heißt —
  // beide werden akzeptiert, siehe pickToken() in mappers.ts.
  tkn: z.string().optional(),
  token: z.string().optional(),
  rtkn: z.string().optional(),
  refreshToken: z.string().optional(),
  u: z
    .looseObject({
      id: z.union([z.string(), z.number()]).optional(),
      name: z.string().optional(),
    })
    .optional(),
  user: z
    .looseObject({
      id: z.union([z.string(), z.number()]).optional(),
      email: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
});
export type RawLoginResponse = z.infer<typeof rawLoginResponseSchema>;

export const rawLeagueSchema = z.looseObject({
  i: z.string(),
  n: z.string(),
  cpi: z.string().optional(),
  cpim: z.string().optional(),
  lim: z.string().optional(),
  b: z.number().optional(),
  un: z.number().optional(),
  lpc: z.number().optional(),
  adm: z.boolean().optional(),
  pl: z.number().optional(),
  tv: z.number().optional(),
});
export type RawLeague = z.infer<typeof rawLeagueSchema>;

export const rawLeaguesResponseSchema = z.looseObject({
  it: z.array(rawLeagueSchema).default([]),
});

/**
 * `GET /v4/leagues/{id}/settings/managers` — `us` ist die tatsächliche
 * Manager-Liste der Liga. Per scripts/probe.ts gegen zwei real unterschiedlich
 * große Ligen verifiziert (12 bzw. 2 Einträge) — siehe Kommentar an
 * getLeagueManagerCount() in endpoints.ts für die verworfenen Kandidaten
 * (`un`, `lpc`, `pl` auf /leagues/selection).
 */
export const rawLeagueManagersSchema = z.looseObject({
  us: z
    .array(
      z.looseObject({
        i: z.string().optional(),
        n: z.string().optional(),
      }),
    )
    .default([]),
});
export type RawLeagueManagers = z.infer<typeof rawLeagueManagersSchema>;

export const rawLineupPlayerSchema = z.looseObject({
  pi: z.string(),
  n: z.string().optional(),
  pos: z.number().optional(),
  lo: z.number().optional(),
  st: z.number().optional(),
  lst: z.number().optional(),
  mdst: z.number().optional(),
  tid: z.string().optional(),
  ap: z.number().optional(),
  mv: z.number().optional(),
  t1: z.string().optional(),
  t2: z.string().optional(),
  pim: z.string().optional(),
  t1im: z.string().optional(),
  t2im: z.string().optional(),
  ictp: z.boolean().optional(),
});
export type RawLineupPlayer = z.infer<typeof rawLineupPlayerSchema>;

export const rawLineupOverviewSchema = z.looseObject({
  mdln: z.union([z.string(), z.number()]).optional(),
  lis: z.string().nullable().optional(),
  // Trotz des Namens NICHT das Budget (= `30 Mio − teamValue`, siehe
  // toLineupData in mappers.ts) — absichtlich ungenutzt gelassen, nur hier
  // geparst, damit .looseObject es nicht als unbekanntes Feld verliert.
  b: z.number().optional(),
  t: z.string().optional(),
  lpc: z.number().optional(),
  clpc: z.number().optional(),
  lp: z.array(rawLineupPlayerSchema).default([]),
});
export type RawLineupOverview = z.infer<typeof rawLineupOverviewSchema>;

export const rawSquadPlayerSchema = z.looseObject({
  i: z.string(),
  n: z.string().optional(),
  pos: z.number().optional(),
  mv: z.number().optional(),
  mvt: z.number().optional(),
  mvgl: z.number().optional(),
  sdmvt: z.number().optional(),
  p: z.number().optional(),
  ap: z.number().optional(),
  st: z.number().optional(),
  stl: z.array(z.unknown()).optional(),
  lo: z.number().optional(),
  lst: z.number().optional(),
  tid: z.string().optional(),
  pim: z.string().optional(),
  iotm: z.boolean().optional(),
  ofc: z.number().optional(),
});
export type RawSquadPlayer = z.infer<typeof rawSquadPlayerSchema>;

export const rawSquadResponseSchema = z.looseObject({
  it: z.array(rawSquadPlayerSchema).default([]),
});

/**
 * Ein Gebot aus `ofs[]` — bei fremden Listings enthält das laut
 * scripts/.probe-output/market.json nur das eigene Gebot, nicht alle Gebote
 * anderer Manager.
 */
export const rawMarketOfferSchema = z.looseObject({
  u: z.string().optional(),
  unm: z.string().optional(),
  uop: z.number().optional(),
  uim: z.string().optional(),
});
export type RawMarketOffer = z.infer<typeof rawMarketOfferSchema>;

/**
 * `p`/`ap` fehlen laut scripts/probe.ts komplett bei Bot-Listings (freie
 * Spieler ohne Verkäufer/Saisoneinsatz) statt auf 0 zu stehen — deshalb
 * optional statt mit .default(0).
 */
export const rawMarketPlayerSchema = z.looseObject({
  i: z.string(),
  n: z.string().optional(),
  pos: z.number().optional(),
  tid: z.string().optional(),
  st: z.number().optional(),
  mv: z.number().optional(),
  mvt: z.number().optional(),
  p: z.number().optional(),
  ap: z.number().optional(),
  ofc: z.number().optional(),
  prc: z.number().optional(),
  dt: z.string().optional(),
  pim: z.string().optional(),
  u: z
    .looseObject({
      i: z.string().optional(),
      n: z.string().optional(),
    })
    .optional(),
  /** Restlaufzeit des Listings in Sekunden — nur bei Kickbase-Listings gesetzt (kein `u`). */
  exs: z.number().optional(),
  /** Mein eigener Gebotspreis, falls ich schon geboten habe. */
  uop: z.number().optional(),
  /**
   * Meine eigene User-ID, sobald ich ein Gebot habe — verdoppelt sich mit
   * `ofs[].u`. Zugleich die "Offer-ID" für den DELETE-Aufruf beim
   * Zurückziehen, siehe removeOffer in endpoints.ts.
   */
  uoid: z.string().optional(),
  ofs: z.array(rawMarketOfferSchema).optional(),
});
export type RawMarketPlayer = z.infer<typeof rawMarketPlayerSchema>;

export const rawMarketResponseSchema = z.looseObject({
  it: z.array(rawMarketPlayerSchema).default([]),
  /** Zeitpunkt des nächsten Marktwert-Updates (üblicherweise 22:00 Uhr) — bisher ungenutzt. */
  mvud: z.string().optional(),
});
export type RawMarketResponse = z.infer<typeof rawMarketResponseSchema>;

export const rawMatchdaySummarySchema = z.looseObject({
  day: z.number().optional(),
  md: z.string().optional(),
  t1: z.string().optional(),
  t2: z.string().optional(),
  t1g: z.number().optional(),
  t2g: z.number().optional(),
});

/**
 * Ein Spiel aus `/v4/competitions/{id}/matchdays` — `dt` ist der Anstoß.
 * `t1im`/`t2im` (Team-Logos) sind 1:1 aus scripts/.probe-output/matchdays.json
 * übernommen — dieselben Felder wie in `rawCompetitionTeamSchema.tim`.
 */
export const rawFixtureSchema = z.looseObject({
  mi: z.string().optional(),
  dt: z.string().optional(),
  st: z.number().optional(), // Bedeutung unverifiziert, siehe scripts/probe.ts
  t1: z.string().optional(),
  t2: z.string().optional(),
  t1g: z.number().optional(),
  t2g: z.number().optional(),
  t1im: z.string().optional(),
  t2im: z.string().optional(),
});
export type RawFixture = z.infer<typeof rawFixtureSchema>;

export const rawCompetitionMatchdaysSchema = z.looseObject({
  day: z.number().optional(),
  it: z
    .array(z.looseObject({ day: z.number().optional(), it: z.array(rawFixtureSchema).default([]) }))
    .default([]),
});
export type RawCompetitionMatchdays = z.infer<typeof rawCompetitionMatchdaysSchema>;

/** Teamliste der Competition-Tabelle — `/v4/competitions/{id}/table`. Liefert Namen (`tn`), die sonst nirgends verfügbar sind. */
export const rawCompetitionTeamSchema = z.looseObject({
  tid: z.string(),
  tn: z.string().optional(),
  tim: z.string().optional(),
});
export type RawCompetitionTeam = z.infer<typeof rawCompetitionTeamSchema>;

export const rawCompetitionTableSchema = z.looseObject({
  it: z.array(rawCompetitionTeamSchema).default([]),
});
export type RawCompetitionTable = z.infer<typeof rawCompetitionTableSchema>;

export const rawPlayerDetailSchema = z.looseObject({
  i: z.string(),
  fn: z.string().optional(),
  ln: z.string().optional(),
  shn: z.number().optional(),
  tid: z.string().optional(),
  tn: z.string().optional(),
  pos: z.number().optional(),
  g: z.number().optional(),
  a: z.number().optional(),
  tp: z.number().optional(),
  ap: z.number().optional(),
  sec: z.number().optional(),
  mv: z.number().optional(),
  cv: z.number().optional(),
  mvt: z.number().optional(),
  y: z.number().optional(),
  r: z.number().optional(),
  mdsum: z.array(rawMatchdaySummarySchema).optional(),
  pim: z.string().optional(),
  tim: z.string().optional(),
  st: z.number().optional(),
  // Achtung: Das Feld heißt "smdc", NICHT "smc" — verifiziert gegen
  // scripts/.probe-output/player-detail.json ("smdc": 1). Die Doku (und dieses
  // Schema bis 31.08.2026) behauptete "smc", das existiert in keiner Antwort.
  smdc: z.number().optional(),
  stl: z.array(z.unknown()).optional(),
});
export type RawPlayerDetail = z.infer<typeof rawPlayerDetailSchema>;

export const rawMarketValuePointSchema = z.looseObject({
  dt: z.number(),
  mv: z.number(),
});

export const rawMarketValueHistorySchema = z.looseObject({
  it: z.array(rawMarketValuePointSchema).default([]),
  lmv: z.number().optional(),
  hmv: z.number().optional(),
});
export type RawMarketValueHistory = z.infer<typeof rawMarketValueHistorySchema>;

export const rawMatchdayPerformanceSchema = z.looseObject({
  day: z.number().optional(),
  md: z.string().optional(),
  t1: z.string().optional(),
  t2: z.string().optional(),
  t1g: z.number().optional(),
  t2g: z.number().optional(),
  t1im: z.string().optional(),
  t2im: z.string().optional(),
  pt: z.string().optional(),
  // Achtung: "ap"/"tp" sind hier laut scripts/probe.ts die SAISON-Werte
  // (auf jedem Spieltag identisch) — die echten Spieltagspunkte stehen in "p".
  ap: z.number().optional(),
  tp: z.number().optional(),
  p: z.number().optional(),
  // Per scripts/probe.ts gegen echte Daten: "mp" ist ein String wie "90'"
  // oder "0'", keine Zahl — die Doku behauptete fälschlich einen number-Typ.
  mp: z.string().optional(),
  cur: z.boolean().optional(),
});

export const rawSeasonPerformanceSchema = z.looseObject({
  ti: z.string().optional(),
  n: z.string().optional(),
  ph: z.array(rawMatchdayPerformanceSchema).default([]),
});

export const rawPerformanceResponseSchema = z.looseObject({
  it: z.array(rawSeasonPerformanceSchema).default([]),
});
export type RawPerformanceResponse = z.infer<typeof rawPerformanceResponseSchema>;

/**
 * Ein Manager-Eintrag aus `GET /v4/leagues/{id}/ranking` — der Pfad selbst ist
 * bereits in scripts/probe.ts gegen einen echten Account verifiziert (dort nur
 * `us.length` gelesen). Die einzelnen Feldnamen stammen aus den inoffiziellen
 * v4-Spezifikationen (kevinskyba/simonsagstetter) samt echter Beispielantwort,
 * NICHT aus einem eigenen Probe-Lauf — deshalb strikt `.optional()`/Fallback
 * statt Vertrauen in Pflichtfelder. `lp` kann laut Doku `null`-Einträge für
 * leere Aufstellungs-Slots enthalten.
 */
export const rawLeagueRankingEntrySchema = z.looseObject({
  i: z.string().optional(),
  n: z.string().optional(),
  uim: z.string().optional(),
  adm: z.boolean().optional(),
  pa: z.boolean().optional(),
  sp: z.number().optional(),
  spl: z.number().optional(),
  mdp: z.number().optional(),
  mdpl: z.number().optional(),
  tv: z.number().optional(),
  lp: z.array(z.string().nullable()).optional(),
});
export type RawLeagueRankingEntry = z.infer<typeof rawLeagueRankingEntrySchema>;

export const rawLeagueRankingSchema = z.looseObject({
  us: z.array(rawLeagueRankingEntrySchema).default([]),
  sn: z.string().optional(),
  /**
   * Der Spieltag, auf den sich die Antwort bezieht — Gegenprobe zum
   * angefragten `?dayNumber=` (siehe getLeagueRanking). Optional, weil
   * unverifiziert ist, ob Kickbase das Feld in JEDER Antwort mitschickt;
   * fehlt es, kann die App die Zuordnung eben nicht prüfen.
   */
  day: z.number().optional(),
});
export type RawLeagueRanking = z.infer<typeof rawLeagueRankingSchema>;
