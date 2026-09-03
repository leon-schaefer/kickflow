/**
 * Ohne dieses File hasht @expo/fingerprint auch app.json.version mit ein —
 * ein reiner Versions-Bump (1.0.2 → 1.0.3) würde den runtimeVersion-
 * Fingerprint ändern und OTA-Updates für alle bereits installierten Builds
 * stillschweigend kappen. buildNumber/versionCode liegen dank
 * appVersionSource: "remote" in eas.json ohnehin nicht in app.json, version
 * ist also rein kosmetisch und darf raus.
 *
 * ExpoConfigExtraSection: app.config.js schreibt den aktuellen git-Sha nach
 * extra.gitSha (nur zur Anzeige in der App, siehe more.tsx). Ohne diesen
 * Skip landet der Sha im Fingerprint-Hash — jeder neue Commit hätte dann
 * eine neue runtimeVersion zur Folge, und ein Update passt nie zum zuvor
 * gebauten Binary.
 *
 * PackageJsonScriptsAll ersetzt PackageJsonAndroidAndIosScriptsIfNotContainRun:
 * der engere Skip greift nur für die Einträge "android" und "ios", und selbst
 * die nur, solange sie kein "run" enthalten — hier enthalten sie es
 * ("expo run:ios"), er greift also faktisch nie. Jede andere Script-Änderung
 * landete damit im Hash: das Hinzufügen der preupdate:*-Hooks allein hat den
 * Fingerprint von 1f3de806 auf b177739f gedreht und damit die OTA-Kette für
 * Build 12 gekappt. npm-Scripts sind reines Tooling und beeinflussen das
 * Binary nicht, deshalb der weite Skip.
 *
 * Vorbehalt: damit merkt der Fingerprint auch eine Script-Änderung nicht, die
 * *doch* das Binary betrifft — ein postinstall, das native Files patcht, oder
 * ein eigener prebuild-Schritt. Das Projekt hat nichts davon; kommt so etwas
 * dazu, gehört dieser Skip zurückgenommen.
 */
module.exports = {
  sourceSkips: [
    'ExpoConfigVersions',
    'PackageJsonScriptsAll',
    'ExpoConfigExtraSection',
  ],
};
