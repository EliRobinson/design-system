import createMDX from '@next/mdx';

/* Turbopack requires MDX options to be serializable, so no function-valued
   remark/rehype plugins here — syntax highlighting happens in the `pre`
   component mapping (see mdx-components.tsx) instead. */
const withMDX = createMDX({});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
};

export default withMDX(nextConfig);
