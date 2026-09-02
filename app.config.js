const { execSync } = require('node:child_process');

function resolveGitSha() {
  const configuredSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (configuredSha) return configuredSha;

  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function shortGitSha(sha) {
  return /^[0-9a-f]{7,40}$/i.test(sha ?? '') ? sha.slice(0, 7).toLowerCase() : null;
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    gitSha: shortGitSha(resolveGitSha()),
  },
});