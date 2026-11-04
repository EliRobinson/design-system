// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GIT_REPO_ENV, withoutGitRepoEnv } from './git-env.mjs';

describe('withoutGitRepoEnv', () => {
  it('drops the variables git sets when it runs a hook', () => {
    const env = Object.fromEntries([...GIT_REPO_ENV, 'PATH', 'HOME'].map((key) => [key, 'x']));
    expect(withoutGitRepoEnv(env)).toEqual({ PATH: 'x', HOME: 'x' });
  });

  it('does not change its input and skips undefined values', () => {
    const env = { GIT_DIR: '/x', KEEP: '1', GONE: undefined };
    expect(withoutGitRepoEnv(env)).toEqual({ KEEP: '1' });
    expect(env.GIT_DIR).toBe('/x');
  });
});
