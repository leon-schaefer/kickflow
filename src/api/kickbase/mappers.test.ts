import { describe, expect, it } from 'vitest';
import {
  imageUrl,
  mapMarketValueTrend,
  mapPosition,
  mapStatus,
  parseFormation,
  parseMatchdayLabel,
  toAuthSession,
  toLeagueSummary,
  toLineupData,
  toMarketPlayer,
  toMarketValueHistory,
  toMatchdaySchedule,
  toPlayerDetail,
  toSquadPlayer,
  toTeam,
} from './mappers';
import type {
  RawLeague,
  RawLineupOverview,
  RawLineupPlayer,
  RawMarketPlayer,
  RawSquadPlayer,
} from './schemas';
import { toFixtureView } from '@/utils/matchday';

describe('parseFormation', () => {
  it('parst eine normale Formation', () => {
    expect(parseFormation('4-2-4')).toEqual([4, 2, 4]);
  });
  it('liefert ein leeres Array bei fehlender/ungültiger Formation', () => {
    expect(parseFormation(undefined)).toEqual([]);
    expect(parseFormation('')).toEqual([]);
    expect(parseFormation('abc')).toEqual([]);
  });
});

describe('mapPosition', () => {
  it.each([
    [1, 'GK'],
    [2, 'DEF'],
    [3, 'MID'],
    [4, 'FWD'],
  ] as const)('mapped %i auf %s', (pos, expected) => {
    expect(mapPosition(pos)).toBe(expected);
  });
  it('fällt bei unbekanntem Code auf MID zurück statt zu crashen', () => {
    expect(mapPosition(undefined)).toBe('MID');
    expect(mapPosition(99)).toBe('MID');
  });
});

describe('mapStatus', () => {
  it('mappt die verifizierten Codes', () => {
    expect(mapStatus(0)).toBe('fit');
    expect(mapStatus(undefined)).toBe('fit');
    // Per scripts/probe.ts gegen einen echten Kader beobachtet.
    expect(mapStatus(2)).toBe('injured');
    // Nur laut (unverifizierter) Doku, nie real beobachtet — als Fallback belassen.
    expect(mapStatus(4)).toBe('injured');
  });
  it('fällt bei unbekanntem Code auf unknown zurück statt zu raten', () => {
    expect(mapStatus(128)).toBe('unknown');
    expect(mapStatus(7)).toBe('unknown');
  });
});

describe('mapMarketValueTrend', () => {
  it('mappt 1 auf up, alles andere defensiv', () => {
    expect(mapMarketValueTrend(1)).toBe('up');
    expect(mapMarketValueTrend(2)).toBe('down');
    expect(mapMarketValueTrend(undefined)).toBe('flat');
    expect(mapMarketValueTrend(0)).toBe('flat');
  });
});

describe('imageUrl', () => {
  it('präfixiert relative Pfade mit dem CDN-Host', () => {
    expect(imageUrl('content/file/abc.png')).toBe('https://kickbase.b-cdn.net/content/file/abc.png');
  });
  it('lässt absolute URLs unverändert', () => {
    expect(imageUrl('https://example.com/x.png')).toBe('https://example.com/x.png');
  });
  it('gibt null bei fehlendem Pfad zurück', () => {
    expect(imageUrl(undefined)).toBeNull();
    expect(imageUrl(null)).toBeNull();
  });
});

describe('toAuthSession', () => {
  it('akzeptiert die "tkn"-Variante', () => {
    const session = toAuthSession({ tkn: 'abc', rtkn: 'refresh', u: { id: '42', name: 'Max' } });
    expect(session).toEqual({ token: 'abc', refreshToken: 'refresh', userId: '42', userName: 'Max' });
  });
  it('akzeptiert die generische "token"/"user"-Variante', () => {
    const session = toAuthSession({ token: 'xyz', user: { id: 7, email: 'a@b.de' } });
    expect(session.token).toBe('xyz');
    expect(session.userId).toBe('7');
  });
  it('wirft, wenn gar kein Token gefunden wird', () => {
    expect(() => toAuthSession({})).toThrow();
  });
});

describe('toLeagueSummary', () => {
  // Beispiel 1:1 aus scripts/probe.ts gegen einen echten Account. `cpi` ist
  // trotz Doku-Namens ("Cover photo identifier") die Competition-ID.
  const raw: RawLeague = {
    i: '2609146',
    n: 'HaramLig',
    cpi: '1',
    lim: 'league/cover.jpe',
    b: 58818981,
    un: 538,
    lpc: 9,
    adm: false,
    pl: 3,
    tv: 238105120,
  };
  it('mappt alle Felder, inkl. competitionId und Cover-Bild aus lim', () => {
    expect(toLeagueSummary(raw)).toEqual({
      id: '2609146',
      name: 'HaramLig',
      coverImageUrl: 'https://kickbase.b-cdn.net/league/cover.jpe',
      budget: 58818981,
      teamValue: 238105120,
      memberCount: 538,
      playerLimit: 3,
      isAdmin: false,
      competitionId: '1',
    });
  });
  it('fällt für competitionId auf "1" (Bundesliga) zurück, wenn cpi fehlt', () => {
    expect(toLeagueSummary({ ...raw, cpi: undefined }).competitionId).toBe('1');
  });
});

describe('toTeam', () => {
  it('mappt Teamnamen und -logo aus der Competition-Tabelle', () => {
    expect(toTeam({ tid: '9', tn: 'Stuttgart', tim: 'content/file/logo.svg' })).toEqual({
      id: '9',
      name: 'Stuttgart',
      logoUrl: 'https://kickbase.b-cdn.net/content/file/logo.svg',
    });
  });
  it('fällt bei fehlendem Namen auf einen leeren String zurück statt zu crashen', () => {
    expect(toTeam({ tid: '9' })).toEqual({ id: '9', name: '', logoUrl: null });
  });
});

describe('toSquadPlayer + toLineupData (der zentrale Merge)', () => {
  // Beispiel 1:1 aus der Doku (GET /v4/leagues/{leagueId}/squad)
  const squadPlayer: RawSquadPlayer = {
    mvgl: -15145453,
    i: '118',
    n: 'Grifo',
    lo: 7,
    lst: 1,
    st: 0,
    stl: [],
    mdst: 0,
    pos: 3,
    mv: 10973197,
    mvt: 2,
    p: 1659,
    ap: 72,
    iotm: false,
    ofc: 0,
    tid: '5',
    sdmvt: -1080998,
    pim: 'content/file/7d6a4935195d414a9119e81aa398222a.png',
  };
  const benchPlayer: RawSquadPlayer = { i: '999', n: 'Bankspieler', pos: 1, mv: 500_000 };

  const lineupEntry: RawLineupPlayer = {
    pi: '118',
    n: 'Grifo',
    pos: 3,
    lo: 2,
    st: 0,
    tid: '5',
    ap: 72,
    mv: 10973197,
    t1: '5',
    t2: '9',
    t1im: 'content/file/home.svg',
    t2im: 'content/file/away.svg',
    ictp: true,
  };

  it('markiert einen Spieler in der Aufstellung korrekt', () => {
    const mapped = toSquadPlayer(squadPlayer, lineupEntry);
    expect(mapped.inLineup).toBe(true);
    expect(mapped.isCaptain).toBe(true);
    expect(mapped.lineupSlot).toBe(2);
    expect(mapped.position).toBe('MID');
    expect(mapped.marketValueTrend).toBe('down');
    expect(mapped.valueScoreAvg).toBeCloseTo(72 / 10.973197, 2);
    expect(mapped.valueScoreTotal).toBeCloseTo(1659 / 10.973197, 2);
    expect(mapped.nextMatch).toEqual({
      homeTeamId: '5',
      awayTeamId: '9',
      homeLogoUrl: 'https://kickbase.b-cdn.net/content/file/home.svg',
      awayLogoUrl: 'https://kickbase.b-cdn.net/content/file/away.svg',
    });
  });

  it('markiert einen Bankspieler korrekt (kein Lineup-Eintrag)', () => {
    const mapped = toSquadPlayer(benchPlayer, undefined);
    expect(mapped.inLineup).toBe(false);
    expect(mapped.lineupSlot).toBeNull();
    expect(mapped.isCaptain).toBe(false);
    expect(mapped.nextMatch).toBeNull();
  });

  it('toLineupData merged overview + squad zu einer konsistenten Antwort', () => {
    const overview: RawLineupOverview = {
      // Realformat laut scripts/probe.ts: "1 Match Day", keine reine Zahl.
      mdln: '5 Match Day',
      lis: '2026-09-01T15:00:00Z',
      // Realwert laut scripts/.probe-output: `30 Mio − teamValue`, NICHT das
      // Budget — absichtlich hier gesetzt, um zu belegen, dass toLineupData()
      // es ignoriert (siehe Assertion unten).
      b: -86_957_307,
      t: '4-2-4',
      lpc: 1,
      clpc: 1,
      lp: [lineupEntry],
    };
    const data = toLineupData(overview, [squadPlayer, benchPlayer]);

    expect(data.matchday).toBe(5);
    expect(data.formation).toBe('4-2-4');
    expect(data.formationRows).toEqual([4, 2, 4]);
    expect(data).not.toHaveProperty('budget');
    expect(data.players).toHaveLength(2);

    // Der eigentliche Zweck des Merges: Aufstellungs- und Kader-Screen
    // filtern/zeigen dieselben Objekte, nie zwei getrennte Wahrheiten.
    const inLineup = data.players.filter((p) => p.inLineup);
    expect(inLineup).toHaveLength(1);
    expect(inLineup[0]?.id).toBe('118');
    expect(data.lineupPlayerCount).toBe(1);

    // Teamwert wird aus den echten Kaderspielern berechnet, nicht geraten.
    expect(data.teamValue).toBe(squadPlayer.mv! + benchPlayer.mv!);
  });

  it('toLineupData bleibt auch bei leerem lpc/clpc konsistent (Fallback)', () => {
    const overview: RawLineupOverview = { t: '4-4-2', lp: [lineupEntry] };
    const data = toLineupData(overview, [squadPlayer]);
    expect(data.lineupPlayerCount).toBe(1); // Fallback auf tatsächliche Zählung
    expect(data.confirmedCount).toBe(0);
  });
});

describe('parseMatchdayLabel', () => {
  it.each([
    ['1 Match Day', 1],
    ['Match Day 2', 2],
    ['2. Spieltag', 2],
    ['', null],
    [undefined, null],
    [3, 3],
  ])('parst %p zu %p', (input, expected) => {
    expect(parseMatchdayLabel(input as string | number | undefined)).toBe(expected);
  });
});

describe('toMatchdaySchedule', () => {
  it('markiert einen Spieltag nur als "allPlayed", wenn ALLE Spiele ein Ergebnis haben', () => {
    const schedule = toMatchdaySchedule({
      day: 2,
      it: [
        {
          day: 1,
          it: [
            { dt: '2026-08-28T18:30:00Z', t1: '5', t2: '9', t1g: 4, t2g: 1 },
            // Ein Spiel des Spieltags hat noch kein Ergebnis (z.B. verlegt).
            { dt: '2026-08-29T18:30:00Z', t1: '3', t2: '7', t1g: undefined, t2g: undefined },
          ],
        },
        {
          day: 2,
          it: [{ dt: '2026-09-05T13:30:00Z', t1: '10', t2: '43' }],
        },
      ],
    });
    expect(schedule.currentDay).toBe(2);
    expect(schedule.matchdays).toEqual([
      { day: 1, firstKickoff: '2026-08-28T18:30:00Z', allPlayed: false },
      { day: 2, firstKickoff: '2026-09-05T13:30:00Z', allPlayed: false },
    ]);
  });

  it('verwirft Einträge ohne "day" statt sie als Spieltag 0 zu zählen', () => {
    const schedule = toMatchdaySchedule({ it: [{ it: [] }, { day: 3, it: [] }] });
    expect(schedule.matchdays).toEqual([{ day: 3, firstKickoff: null, allPlayed: false }]);
  });

  it('leitet den frühesten Anstoß als Deadline ab, unabhängig von der Reihenfolge in der Antwort', () => {
    const schedule = toMatchdaySchedule({
      it: [
        {
          day: 1,
          it: [
            { dt: '2026-08-30T13:30:00Z', t1: '5', t2: '9', t1g: 1, t2g: 1 },
            { dt: '2026-08-28T18:30:00Z', t1: '3', t2: '7', t1g: 2, t2g: 0 },
          ],
        },
      ],
    });
    expect(schedule.matchdays[0]).toEqual({ day: 1, firstKickoff: '2026-08-28T18:30:00Z', allPlayed: true });
  });
});

describe('toMarketValueHistory', () => {
  // Beispiel 1:1 aus der Doku (GET .../marketValue/{timeframe})
  it('mappt Punkte, Tief- und Höchstwert', () => {
    const result = toMarketValueHistory({
      it: [
        { dt: 20418, mv: 500_000 },
        { dt: 20419, mv: 500_000 },
      ],
      lmv: 480_000,
      hmv: 520_000,
    });
    expect(result).toEqual({
      points: [
        { date: 20418, value: 500_000 },
        { date: 20419, value: 500_000 },
      ],
      lowest: 480_000,
      highest: 520_000,
    });
  });
});

describe('toPlayerDetail', () => {
  it('setzt den vollen Namen aus Vor- und Nachname zusammen', () => {
    const detail = toPlayerDetail(
      {
        i: '118',
        fn: 'Vincenzo',
        ln: 'Grifo',
        tid: '5',
        tn: 'SC Freiburg',
        pos: 3,
        mv: 10_000_000,
      },
      { it: [] },
    );
    expect(detail.name).toBe('Vincenzo Grifo');
    expect(detail.performance).toEqual([]);
  });

  it('fällt bei fehlendem Namen auf "Unbekannt" zurück statt leer zu bleiben', () => {
    const detail = toPlayerDetail({ i: '1' }, { it: [] });
    expect(detail.name).toBe('Unbekannt');
  });

  it('mappt Saison-Performance inklusive Spieltagsdaten', () => {
    const detail = toPlayerDetail(
      { i: '1' },
      {
        it: [
          {
            ti: '2025/2026',
            n: 'Bundesliga',
            ph: [
              {
                day: 3,
                md: '2025-09-01T15:00:00Z',
                t1: '5',
                t2: '9',
                t1g: 2,
                t2g: 1,
                t1im: 'content/file/home.svg',
                t2im: 'content/file/away.svg',
                pt: '5',
                ap: 8,
                tp: 8,
                p: 34,
                mp: "90'",
                cur: false,
              },
              // Zukünftiger Spieltag: kein Ergebnis, keine Punkte — real so
              // von der API geliefert (siehe scripts/.probe-output/player-performance.json).
              { day: 4, md: '2025-09-08T15:00:00Z', t1: '9', t2: '3' },
            ],
          },
        ],
      },
    );
    expect(detail.performance).toHaveLength(1);
    const [played, upcoming] = detail.performance[0]?.matchdays ?? [];
    expect(played).toMatchObject({
      matchday: 3,
      homeGoals: 2,
      awayGoals: 1,
      // ap/tp bleiben die Saisonwerte, nicht die Spieltagspunkte.
      seasonAveragePoints: 8,
      seasonTotalPoints: 8,
      points: 34,
      hasResult: true,
      minutesPlayed: 90,
      homeLogoUrl: 'https://kickbase.b-cdn.net/content/file/home.svg',
      awayLogoUrl: 'https://kickbase.b-cdn.net/content/file/away.svg',
    });
    expect(upcoming).toMatchObject({
      matchday: 4,
      hasResult: false,
      points: 0,
    });
  });
});

describe('toFixtureView', () => {
  const teamNames = new Map([
    ['5', 'Freiburg'],
    ['9', 'Stuttgart'],
  ]);
  const homeMatchday = {
    matchday: 3,
    matchDate: null,
    homeTeamId: '5',
    awayTeamId: '9',
    homeGoals: 2,
    awayGoals: 1,
    homeLogoUrl: 'https://kickbase.b-cdn.net/home.svg',
    awayLogoUrl: 'https://kickbase.b-cdn.net/away.svg',
    playerTeamId: '5',
    hasResult: true,
    points: 34,
    seasonAveragePoints: 8,
    seasonTotalPoints: 8,
    minutesPlayed: 90,
    isCurrent: false,
  };

  it('erkennt ein Heimspiel und zählt Tore aus Spielersicht', () => {
    const view = toFixtureView(homeMatchday, '5', teamNames);
    expect(view).toMatchObject({
      isHome: true,
      opponentId: '9',
      opponentName: 'Stuttgart',
      opponentLogoUrl: 'https://kickbase.b-cdn.net/away.svg',
      ownGoals: 2,
      opponentGoals: 1,
      outcome: 'win',
    });
  });

  it('erkennt ein Auswärtsspiel und dreht Tore/Logo entsprechend um', () => {
    const view = toFixtureView({ ...homeMatchday, playerTeamId: '9' }, '9', teamNames);
    expect(view).toMatchObject({
      isHome: false,
      opponentId: '5',
      opponentName: 'Freiburg',
      opponentLogoUrl: 'https://kickbase.b-cdn.net/home.svg',
      ownGoals: 1,
      opponentGoals: 2,
      outcome: 'loss',
    });
  });

  it('fällt bei unbekanntem Gegner auf "Team {id}" zurück statt leer zu bleiben', () => {
    const view = toFixtureView({ ...homeMatchday, awayTeamId: '77' }, '5', new Map());
    expect(view.opponentName).toBe('Team 77');
  });

  it('nutzt den Fallback-Team-Id, wenn playerTeamId (ausnahmsweise) leer ist', () => {
    const view = toFixtureView({ ...homeMatchday, playerTeamId: '' }, '9', teamNames);
    expect(view.isHome).toBe(false);
  });

  it('erkennt ein Unentschieden', () => {
    const view = toFixtureView({ ...homeMatchday, homeGoals: 1, awayGoals: 1 }, '5', teamNames);
    expect(view.outcome).toBe('draw');
  });
});

describe('toMarketPlayer', () => {
  // Beispiel 1:1 aus scripts/probe.ts gegen einen echten Account (Manager-Listing).
  const managerListing: RawMarketPlayer = {
    i: '60',
    fn: 'Dominik',
    n: 'Kohr',
    tid: '18',
    pos: 2,
    st: 2,
    mvt: 2,
    mv: 10_639_170,
    p: 88,
    ap: 88,
    ofc: 0,
    u: { i: '1939211', n: 'Rudi Völler' },
    prc: 10_690_324,
    dt: '2026-08-29T19:33:12Z',
    pim: 'content/file/fc6cb9d67771484baa8cd7547280f6cd.png',
  };

  // Bot-Listing (freier Spieler ohne Verkäufer) — hat laut echter Antwort
  // KEIN "p"/"ap"-Feld, nicht einfach 0.
  const botListing: RawMarketPlayer = {
    i: '357',
    fn: 'Jens',
    n: 'Grahl',
    tid: '4',
    pos: 1,
    st: 0,
    mvt: 0,
    mv: 500_000,
    ofc: 0,
    prc: 500_000,
    dt: '2026-08-30T06:20:50Z',
    pim: 'content/file/e76a9805862d4c849883f4035d7912a7.png',
  };

  it('mappt ein Manager-Listing inkl. Verkäufer und Value-Scores', () => {
    const mapped = toMarketPlayer(managerListing);
    expect(mapped.isBotListing).toBe(false);
    expect(mapped.sellerName).toBe('Rudi Völler');
    expect(mapped.price).toBe(10_690_324);
    expect(mapped.status).toBe('injured'); // st: 2, siehe mapStatus
    expect(mapped.valueScoreAvg).toBeCloseTo(88 / 10.63917, 2);
  });

  it('mappt ein Bot-Listing ohne Verkäufer und ohne p/ap (0 statt Crash)', () => {
    const mapped = toMarketPlayer(botListing);
    expect(mapped.isBotListing).toBe(true);
    expect(mapped.sellerName).toBeNull();
    expect(mapped.totalPoints).toBe(0);
    expect(mapped.averagePoints).toBe(0);
    expect(mapped.valueScoreAvg).toBe(0);
    expect(mapped.valueScoreTotal).toBe(0);
  });

  it('fällt bei fehlendem prc auf den Marktwert zurück', () => {
    const mapped = toMarketPlayer({ ...botListing, prc: undefined });
    expect(mapped.price).toBe(mapped.marketValue);
  });

  // Bot-Listing mit eigenem Gebot, 1:1 aus scripts/.probe-output/market.json (Skhiri, i: '2718').
  const botListingWithOwnOffer: RawMarketPlayer = {
    i: '2718',
    fn: 'Ellyes',
    n: 'Skhiri',
    tid: '28',
    pos: 3,
    st: 0,
    mvt: 1,
    mv: 6_112_964,
    p: 48,
    ap: 48,
    ofc: 1,
    exs: 142_453,
    prc: 6_112_964,
    uop: 6_112_964,
    uoid: '4232017',
    ofs: [
      { u: '4232017', unm: 'Leon', uop: 6_112_964, uim: 'user/812d9d810c104cf8b6a396f784c4efe8.jpe' },
    ],
    dt: '2026-08-31T03:13:57Z',
    pim: 'content/file/1274d4acfc8845a789f74d858afe1168.png',
  };

  it('mappt ein Bot-Listing mit eigenem Gebot inkl. Restlaufzeit und Offer-ID', () => {
    const mapped = toMarketPlayer(botListingWithOwnOffer);
    expect(mapped.expiresInSeconds).toBe(142_453);
    expect(mapped.ownOfferPrice).toBe(6_112_964);
    expect(mapped.ownOfferId).toBe('4232017');
    expect(mapped.offers).toEqual([
      { userId: '4232017', userName: 'Leon', price: 6_112_964, userImageUrl: 'https://kickbase.b-cdn.net/user/812d9d810c104cf8b6a396f784c4efe8.jpe' },
    ]);
  });

  it('mappt ein Manager-Listing ohne Gebot mit leeren Gebotsfeldern (kein exs, kein uop)', () => {
    const mapped = toMarketPlayer(managerListing);
    expect(mapped.expiresInSeconds).toBeNull();
    expect(mapped.ownOfferPrice).toBeNull();
    expect(mapped.ownOfferId).toBeNull();
    expect(mapped.offers).toEqual([]);
  });
});
