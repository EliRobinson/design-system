// @ts-check
// The variables git sets when it runs a hook. Left in a child's environment,
// they point its git calls at whatever repo that hook is for.

export const GIT_REPO_ENV = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX'];

/**
 * A copy of `env` without {@link GIT_REPO_ENV}, and without unset keys.
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, string>}
 */
export function withoutGitRepoEnv(env) {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([key, value]) => value !== undefined && !GIT_REPO_ENV.includes(key),
    ),
  );
}
