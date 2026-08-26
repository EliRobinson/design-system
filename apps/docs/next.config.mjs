import createMDX from '@next/mdx';

/* Turbopack requires MDX options to be serializable, so plugins are named by
   string rather than imported — the loader resolves them in its own worker.
   That still rules out function-valued plugins, which is why syntax
   highlighting happens in the `pre` component mapping (see mdx-components.tsx)
   rather than through rehype.

   remark-gfm is here because CommonMark has no tables: the endpoint table on
   /build-with-ai was rendering as a paragraph of literal pipes and dashes
   (#129), even though mdx-components.tsx has mapped `table` to the scroll
   wrapper all along. It takes no options, so the serializable form costs
   nothing. Nothing else in the MDX pages leans on GFM today — no task lists,
   no strikethrough, and the only bare URLs are inside code — so turning it on
   changes exactly the one block that was broken. */
const withMDX = createMDX({ options: { remarkPlugins: [['remark-gfm', {}]] } });

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
              "style-src 'self' 'unsafe-inline'; " +
              "font-src 'self' data:; img-src 'self' data: https:; connect-src 'self'",
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
              "style-src 'self' 'unsafe-inline'; " +
              "font-src 'self' data:; img-src 'self' data:",
          },
        ],
      },
    ];
  },
};

export default withMDX(nextConfig);
