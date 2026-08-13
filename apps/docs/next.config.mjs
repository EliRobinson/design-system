import createMDX from '@next/mdx';

/* Turbopack requires MDX options to be serializable, so no function-valued
   remark/rehype plugins here — syntax highlighting happens in the `pre`
   component mapping (see mdx-components.tsx) instead. */
const withMDX = createMDX({});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  /* CSP for the staged brand files only — never site-wide. The UI kits
     compile their JSX in the browser (unpkg's Babel + 'unsafe-eval'), which
     is an allowance scoped to exactly those files; everything else under
     /brand/ gets local-scripts-only. The two sources are disjoint because a
     response carrying both CSP headers is enforced as their intersection. */
  async headers() {
    return [
      {
        /* :path+ (one or more segments) keeps these rules on the staged
           files only — /brand/guidelines with no further segment is a Next
           page whose own inline bootstrap must not be blocked. */
        source: '/brand/ui_kits/:path+',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'",
          },
        ],
      },
      {
        source: '/brand/:dir(assets|guidelines|patterns|slides)/:path+',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self'; " +
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
              "font-src https://fonts.gstatic.com data:; img-src 'self' data:",
          },
        ],
      },
    ];
  },
};

export default withMDX(nextConfig);
