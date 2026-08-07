export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__wordmark">
          Miltinson<span className="site-footer__dot">.</span>
        </p>
        <p className="site-footer__tagline">Practical tech, honestly built.</p>
        <nav aria-label="Footer" className="site-footer__links">
          <a href="https://github.com/EliRobinson/design-system" rel="noreferrer">
            GitHub
          </a>
          <a href="https://www.miltinsons.com/" rel="noreferrer">
            miltinsons.com
          </a>
          <a href="/llms.txt">llms.txt</a>
          <a href="/llms-full.txt">llms-full.txt</a>
        </nav>
        <p className="site-footer__meta">
          Built with @elirobinson/tokens and @elirobinson/react — the site is a consumer of the
          system it documents.
        </p>
      </div>
    </footer>
  );
}
