import { describe, expect, it } from 'vitest';
import { formatBuildId, isBuildId } from './buildId';

const NOW = Date.parse('2026-09-01T18:42:27.512Z');

describe('formatBuildId', () => {
  it('stellt den Build-Zeitstempel voran und hängt die verkürzte SHA an', () => {
    expect(formatBuildId(NOW, 'bc0c043ab1e910595181a5b467c1f21b7bd00000')).toBe(
      '20260901T184227Z-bc0c043',
    );
  });

  it('kommt ohne Git-Kontext aus', () => {
    expect(formatBuildId(NOW, null)).toBe('20260901T184227Z');
    expect(formatBuildId(NOW, '')).toBe('20260901T184227Z');
  });

  it('ignoriert eine SHA, die keine ist (leere/Platzhalter-Env auf Vercel)', () => {
    expect(formatBuildId(NOW, '   ')).toBe('20260901T184227Z');
    expect(formatBuildId(NOW, 'unknown')).toBe('20260901T184227Z');
  });

  // Der eigentliche Grund für den Zeitstempel: derselbe Commit, neu deployed
  // (Vercel-Rollback, Rebuild nach Env-Änderung) — mit reiner SHA wäre die
  // Build-ID identisch und offene Tabs bekämen kein Update-Signal.
  it('unterscheidet zwei Deploys desselben Commits', () => {
    const sha = 'bc0c043';
    const first = formatBuildId(NOW, sha);
    const second = formatBuildId(NOW + 60_000, sha);
    expect(second).not.toBe(first);
    // Sortierbar: der neuere Build ist auch lexikografisch der größere.
    expect(second > first).toBe(true);
  });

  it('erzeugt IDs, die isBuildId akzeptiert', () => {
    expect(isBuildId(formatBuildId(NOW, 'bc0c043'))).toBe(true);
    expect(isBuildId(formatBuildId(NOW, null))).toBe(true);
  });
});

describe('isBuildId', () => {
  it('weist alles zurück, was nicht wie eine Build-ID aussieht', () => {
    // Die reale Fehlerform: der SPA-Rewrite liefert index.html mit Status 200.
    expect(isBuildId('<!DOCTYPE html><html><head><title>kickflow</title>')).toBe(false);
    // Das alte Format (reine Commit-SHA) ist bewusst keine gültige Build-ID
    // mehr — ein Deploy im alten Format soll auffallen, nicht durchrutschen.
    expect(isBuildId('bc0c043ab1e910595181a5b467c1f21b7bd00000')).toBe(false);
    expect(isBuildId('')).toBe(false);
    expect(isBuildId(null)).toBe(false);
  });
});
