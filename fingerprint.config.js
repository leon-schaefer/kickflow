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
 */
module.exports = {
  sourceSkips: [
    'ExpoConfigVersions',
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
    'ExpoConfigExtraSection',
  ],
};
