/**
 * Wachhund für die Rückkehr aus dem Hintergrund.
 *
 * ## Das Symptom
 *
 * Die installierte PWA lag eine Weile im Hintergrund. Danach passiert beim
 * Tippen auf die Tab-Leiste NICHTS — kein Wechsel, keine Meldung, kein
 * leerer Bildschirm. Scrollen geht noch, der Druckzustand der Tabs (`:active`)
 * wird auch noch gezeichnet. Nur navigieren kann man nicht mehr.
 *
 * ## Warum genau die Navigation ausfällt und sonst scheinbar alles lebt
 *
 * React hat zwei Wege, eine Zustandsänderung zu rendern, und nur einer davon
 * braucht die Aufgabenwarteschlange des Browsers:
 *
 *  - **Diskrete Ereignisse** (Tap auf einen Button, Tastendruck) laufen in der
 *    SyncLane und werden über `queueMicrotask` abgearbeitet — nachgelesen in
 *    react-dom (`scheduleMicrotask = queueMicrotask`). Microtasks laufen am
 *    Ende desselben Ticks, ohne Umweg über den Scheduler.
 *  - **Transitions** laufen über das Paket `scheduler`, und das benutzt im
 *    Browser einen EINZIGEN `MessageChannel`, der beim Laden des Moduls
 *    angelegt wird: `channel.port1.onmessage = performWorkUntilDeadline`,
 *    `schedulePerformWorkUntilDeadline = () => port.postMessage(null)`
 *    (scheduler/cjs/scheduler.production.js). Kommt diese Nachricht nicht an,
 *    arbeitet React seine Warteschlange nie ab.
 *
 * Und jede Navigation ist eine Transition: `RouterProvider` verpackt seine
 * State-Updates in `React.startTransition` (react-router/lib/components.js,
 * Standard seit v7). Wird dieser eine Kanal nach dem Auftauen der Seite nicht
 * mehr bedient, bricht damit GENAU die Navigation weg, während Buttons,
 * Eingaben und Scrollen weiterlaufen — die Asymmetrie aus dem Fehlerbericht.
 *
 * ## Was dieser Wächter tut
 *
 * WARUM der Kanal stillsteht, weiß er nicht und muss es nicht wissen — das
 * liegt in WebKit und ist von hier aus nicht nachmessbar. Er prüft nicht die
 * Ursache, sondern ob der Weg noch trägt, und probiert dafür dieselbe
 * Primitive aus, an der React hängt: nach einer längeren Pause im Hintergrund
 * schickt er eine Nachricht durch einen eigenen `MessageChannel`. Kommt sie
 * zurück, ist der Weg frei und alles bleibt still. Kommt sie NICHT zurück,
 * kann React nicht mehr rendern — und das erfährt der Nutzer beim nächsten
 * Tippen.
 *
 * Deshalb schlägt der Wächter auch erst beim nächsten Tap Alarm und nicht
 * nach einem Timeout:
 *
 *  - Ein Timer wäre der falsche Zeuge. Steckt der Kanal, sind Timer
 *    möglicherweise genauso still; und ist der Hauptthread nur eine Sekunde
 *    beschäftigt, hätte ein Timeout einen Fehlalarm ausgelöst.
 *  - Der Tap ist der Moment, in dem der Ausfall überhaupt weh tut. Vorher gibt
 *    es nichts zu melden.
 *  - Die Sonde wurde VOR dem Tap in die Warteschlange gelegt. Ist der Thread
 *    also bloß beschäftigt, ist sie zum Zeitpunkt des Taps längst
 *    durchgelaufen — der Fehlalarm fällt damit von selbst weg.
 *
 * Nachgeliefert wird die Nachricht doch noch? Dann räumt `onRecovered()` den
 * Hinweis wieder weg. Ein Neuladen löst ausschließlich der Nutzer aus, per
 * Tap auf den Hinweis — dieselbe Zusage wie beim Update-Banner
 * (src/components/UpdateBanner.tsx), und aus demselben Grund: ein
 * automatisches Reload könnte einen ungespeicherten Aufstellungs-Entwurf
 * wegwerfen.
 *
 * Der ganze Wächter hängt bewusst NEBEN React (plain DOM, aufgerufen in
 * main.tsx): er muss noch funktionieren, wenn React nicht mehr rendert.
 */

/** Nur die Teile von `document`, die der Wächter benutzt — Tests reichen Fakes herein. */
export interface ResumeGuardDocument {
  readonly visibilityState: string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/** Dito für `window`. */
export interface ResumeGuardWindow {
  addEventListener(type: string, listener: (event: never) => void, options?: unknown): void;
  removeEventListener(type: string, listener: (event: never) => void, options?: unknown): void;
}

export interface ResumeGuardOptions {
  doc?: ResumeGuardDocument;
  win?: ResumeGuardWindow;
  /**
   * So lange muss die App im Hintergrund gelegen haben, damit überhaupt
   * geprüft wird. Ein kurzer Wechsel zur Uhr friert nichts ein; und der
   * Wächter soll nicht bei jedem Blick aufs Benachrichtigungszentrum
   * anlaufen.
   */
  hiddenThresholdMs?: number;
  /**
   * So lange muss die Sonde mindestens unterwegs sein, damit ein Tap als
   * Beweis zählt. Deckt den theoretischen Fall ab, dass der Tap schneller
   * kommt als die erste Runde durch den Kanal.
   */
  minStallMs?: number;
  now?: () => number;
  /** Startet eine Runde durch den `MessageChannel`. */
  probe?: (onDrained: () => void) => void;
  /** Wird beim ersten Tap nach einer stehengebliebenen Sonde gerufen. */
  onStalled?: () => void;
  /** Wird gerufen, wenn eine stehengebliebene Sonde doch noch zurückkommt. */
  onRecovered?: () => void;
}

/** 60 s: kürzere Ausflüge friert iOS nicht ein. */
const HIDDEN_THRESHOLD_MS = 60_000;
/** 250 ms: schneller als das kann kein Finger nach der Rückkehr tippen. */
const MIN_STALL_MS = 250;

/**
 * Eine Runde durch einen eigenen `MessageChannel` — dieselbe Primitive, an
 * der React hängt (siehe Dateikopf). Der Kanal wird pro Sonde neu angelegt
 * und über die Closure am Leben gehalten, bis die Nachricht ankommt.
 */
function messageChannelProbe(onDrained: () => void): void {
  const channel = new MessageChannel();
  channel.port1.onmessage = () => {
    channel.port1.close();
    onDrained();
  };
  channel.port2.postMessage(0);
}

/**
 * Hängt die Listener und gibt die Abmeldung zurück. Ohne DOM (Logik-Tests,
 * SSR) ein No-Op.
 *
 * Die Trennung in zwei Funktionen ist keine Kosmetik: `attach` bekommt
 * `doc`/`win` als Pflichtparameter, und nur so gilt die Prüfung von oben auch
 * in den Closures darunter.
 */
export function startResumeGuard(options: ResumeGuardOptions = {}): () => void {
  const doc = options.doc ?? (globalThis as { document?: ResumeGuardDocument }).document;
  const win = options.win ?? (globalThis as { window?: ResumeGuardWindow }).window;
  if (!doc || !win) return () => {};
  return attach(doc, win, options);
}

function attach(
  doc: ResumeGuardDocument,
  win: ResumeGuardWindow,
  options: ResumeGuardOptions,
): () => void {
  const {
    hiddenThresholdMs = HIDDEN_THRESHOLD_MS,
    minStallMs = MIN_STALL_MS,
    now = () => Date.now(),
    probe = messageChannelProbe,
    onStalled = () => {},
    onRecovered = () => {},
  } = options;

  let hiddenAt: number | null = null;
  /** Wann die laufende Sonde losgeschickt wurde; null = keine offene Sonde. */
  let armedAt: number | null = null;
  /** Zählt die Sonden mit, damit eine alte die neue nicht abmeldet. */
  let armCount = 0;
  /** Wurde der Stillstand schon gemeldet? Nur dann gibt es etwas wegzuräumen. */
  let reported = false;

  function arm(force: boolean): void {
    if (!force && (hiddenAt === null || now() - hiddenAt < hiddenThresholdMs)) return;
    hiddenAt = null;
    armedAt = now();
    armCount += 1;
    const token = armCount;
    probe(() => {
      // Nur die eigene, noch offene Sonde abmelden: eine spätere Rückkehr in
      // den Vordergrund hat inzwischen eine neue losgeschickt.
      if (token !== armCount || armedAt === null) return;
      armedAt = null;
      if (!reported) return;
      reported = false;
      onRecovered();
    });
  }

  function onVisibilityChange(): void {
    if (doc.visibilityState === 'hidden') {
      hiddenAt ??= now();
      return;
    }
    arm(false);
  }

  /**
   * `freeze`/`resume` aus der Page-Lifecycle-API. `visibilitychange` kommt
   * davor und deckt den Fall schon ab — die beiden hängen trotzdem mit dran,
   * weil sie der eigentliche Beweis sind, dass der Browser die Seite
   * angehalten hat, und weil `resume` auch ohne erneutes
   * `visibilitychange` kommen kann.
   */
  function onFreeze(): void {
    hiddenAt ??= now();
  }

  function onResume(): void {
    arm(false);
  }

  /**
   * Aus dem Page Cache zurück (iOS legt die Seite dort ab). Hier ohne
   * Schwelle prüfen: dass die Seite ausgelagert war, steht schon im
   * `persisted`-Flag.
   */
  function onPageShow(event: { persisted?: boolean }): void {
    if (event.persisted) arm(true);
  }

  function onPointerDown(): void {
    if (armedAt === null || reported) return;
    if (now() - armedAt < minStallMs) return;
    reported = true;
    onStalled();
  }

  doc.addEventListener('visibilitychange', onVisibilityChange);
  doc.addEventListener('freeze', onFreeze);
  doc.addEventListener('resume', onResume);
  win.addEventListener('pageshow', onPageShow as (event: never) => void);
  // Capture, damit der Tap auch dann gesehen wird, wenn ihn jemand darunter
  // abfängt (`stopPropagation`) oder er in einem offenen Dialog landet.
  win.addEventListener('pointerdown', onPointerDown as (event: never) => void, {
    capture: true,
  });

  return () => {
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    doc.removeEventListener('freeze', onFreeze);
    doc.removeEventListener('resume', onResume);
    win.removeEventListener('pageshow', onPageShow as (event: never) => void);
    win.removeEventListener('pointerdown', onPointerDown as (event: never) => void, {
      capture: true,
    });
  };
}
