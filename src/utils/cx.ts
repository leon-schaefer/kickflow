/**
 * Fügt Klassennamen zusammen und filtert Falsy-Werte — der Ersatz für RNs
 * `style={[base, cond && variant]}` (73 Fundstellen).
 *
 * Bewusst keine Dependency (clsx & Co.): gebraucht werden ausschließlich die
 * ~40 Fälle `[base, cond && variant]` und ~15 `[base, base2]`, also genau
 * diese Signatur. Objekt- und Array-Formen kommen im Repo nicht vor.
 *
 * Für ZUSTÄNDE ist das hier nicht das richtige Werkzeug: aktiv/ausgewählt/
 * deaktiviert laufen über `aria-pressed`, `disabled` bzw. `data-*` und
 * Attribut-Selektoren im CSS — das liefert die Barrierefreiheit mit, die
 * eine zweite Klasse nicht hat. `cx` ist für strukturelle Komposition
 * (`cx(s.row, s.wide)`).
 */
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  let out = '';
  for (const value of values) {
    if (!value) continue;
    out = out === '' ? value : `${out} ${value}`;
  }
  return out;
}
