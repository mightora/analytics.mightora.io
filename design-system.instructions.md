---
name: design-system
applyTo: "src/**/*.{html,css,js}"
description: "Rules for UI styling, branding, logos, headers, footers, and design tokens of Mightora."
---

# Design & Branding System Guidelines

Follow these guidelines strictly when writing or modifying UI files (`.html`, `.css`, `.js`) in this project to preserve brand alignment and correct visual layouts.

## 1. Branding & Assets

### Logo Rules
- **Mightora Logo**: Always use the correct, full Mightora brand logo image. Do not use the square/profile `main-logo.png` logo or TechTweedie logo in any primary header position.
- **Header logo light / dark values**:
  - `logo-light="https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/mightoraIoLogo4-200x900.png"`
  - `logo-dark="https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/mightoraIoLogo4-200x900.png"`

### Shared UI Libraries
The site pulls in shared mightora assets from the `mightora/shared-ui` package via jsDelivr CDN at runtime:
1. Stylesheet: `https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/shared.css`
2. Elements bootstrap: `https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/components.js`

---

## 2. Shared Web Components

### A. Title/Header Element (`<mightora-header>`)
The header is built dynamically as a Web Component to keep consistency across various Mightora resources. It features a built-in interactive hamburger menu button for tablet/mobile screen widths automatically.
- Must have `site-name`, `site-url`, `logo-light`, `logo-dark` attributes defined.
- Example structure:
  ```html
  <mightora-header
    site-name="Feedback & Wall Platform"
    site-url="/"
    logo-light="https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/mightoraIoLogo4-200x900.png"
    logo-dark="https://raw.githubusercontent.com/mightora/mightora.io/main/static/images/mightoraIoLogo4-200x900.png"
    nav-links='[
      {"label":"Submit Feedback","url":"/feedback"},
      {"label":"View Walls","url":"/wall"},
      {"label":"Admin Dashboard","url":"/admin"},
      {"label":"Mightora.io ↗","url":"https://mightora.io","ext":true}
    ]'>
  </mightora-header>
  ```

### AA. Persistent Header and Quick Navigation (mandatory on scrolling tools)
**Keep the main navigation visible at the top of the viewport while users scroll.** This is a standing Mightora requirement for long-page static tools, not an optional visual enhancement.
- Use a sticky `<mightora-header>` as the primary navigation. Where a page has multiple sections, keep `<nav class="quick-jump-nav">` visible directly **beneath** the header. Detail documentation pages may also inject a dynamic `<nav class="connector-toc">` at the appropriate level.
- Apply `position: sticky`, with the primary header at `top: 0` and secondary navigation at the **actual rendered header height**, including changes at responsive breakpoints. Measure the height when a shared component or dynamic layout makes a fixed CSS offset unreliable.
- Maintain deliberate stacking (`z-index`) so the mobile hamburger menu, popovers, focus rings and dialogs are not hidden beneath the quick-navigation bar.
- Quick-navigation links must use structural hash targets that actually exist. Use `scroll-padding-top` and/or `scroll-margin-top` to keep targeted section headings and focused controls visible beneath *all* sticky navigation layers.
- On mobile, preserve the working Mightora hamburger menu and allow section shortcuts to scroll horizontally or move into an accessible, clearly labelled collapsible menu. Avoid horizontal overflow of the entire page; all links must remain keyboard accessible.
- Embedded/model-driven editions may use one compact sticky header rather than the public two-tier header. Offline editions retain equivalent navigation behaviour without network dependencies.
- Verify by scrolling long pages, following hash links, opening the mobile menu, resizing the browser, and navigating by keyboard; include automated regression checks for the sticky styles and correct navigation offsets.

### B. Title/Footer Element (`<mightora-footer>`)
We must use the `<mightora-footer>` web component instead of a raw static HTML footer. This ensures column lists and brand card buttons render dynamically.
- **Dependency**: The footer component requires the `js-yaml` parser library loaded *before* `components.js` in execution order.
- **Indentation Interception**: To circumvent a known remote indentation syntax error inside the CDM's `footer.yaml` file, an inline fetch monkey-patch has been added in the `<head>` of the entry document. Do not remove or alter this patch as it is required for `js-yaml` parsing.
- Example structure at the base of the page:
  ```html
  <mightora-footer>
    <div class="container">
      <div class="footer-bottom">
        <div class="footer-copy">
          Feedback Platform by <a href="https://mightora.io" target="_blank" rel="noopener noreferrer">Mightora</a>.
          Open source on <a href="https://github.com/mightora/feedback.mightora.io" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </div>
        <div class="footer-bottom-links">
          <span class="site-footer__note">Feedback Wall Services managed securely on Microsoft Azure.</span>
        </div>
      </div>
    </div>
  </mightora-footer>
  ```

### C. Biography / Author Section Element (`<mightora-author>`)
We must display the biographical block detailing the creator right above the footer element.
- **Static Fallback Pattern**: Since there is no dynamic JSON profile configurator inside the repository, the structural metadata is served as inline content inside the component, which relies on the component catch fallback logic.
- **Component HTML Definition**:
  ```html
  <mightora-author>
    <div class="author-section-overlay">
      <div class="author-section-inner">
        <div class="author-photos">
          <img src="https://techtweedie.github.io/images/author/ian-tweedie-sq2_hu_a380911c6f4726de.png" alt="Ian Tweedie" class="author-avatar" />
          <img src="https://raw.githubusercontent.com/TechTweedie/techtweedie.github.io/v2/assets/images/site/main-logo.png" alt="TechTweedie" class="author-blog-logo" />
        </div>
        <div class="author-text">
          <h2 class="author-heading">Built by TechTweedie</h2>
          <p class="author-bio">
            Feedback & Wall Platform is a free tool created by <strong>Ian Tweedie</strong> — also known online as <strong>TechTweedie</strong>. Ian is a technology consultant and developer based in North East England with a background in enterprise IT, cloud infrastructure, and developer tooling. He builds free, practical tools and writes about technology on his blog.
          </p>
          <div class="author-links">
            <a href="https://techtweedie.github.io" target="_blank" rel="noopener" class="author-link">
              <i class="fas fa-blog"></i> Blog
            </a>
            <a href="https://github.com/itweedie" target="_blank" rel="noopener" class="author-link">
              <i class="fab fa-github"></i> GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  </mightora-author>
  ```

---

## 3. Styling Codes & Tokens
- **Theme Variables**: Always complement variables defined by the main sheet. Base styles should utilize CSS Custom Properties defined inside `styles.css`.
- **Primary Colors**: Use `--fb-primary` and `--fb-accent` for feedback layouts.
- **Interactive Element Rules**: Hover/Active states must preserve high contrast rules.
- **Focus Indicators (Accessibility)**: Ensure keyboard navigability (focus states) uses:
  ```css
  :where(a, button, input, select, textarea, [tabindex]):focus-visible {
    outline: 3px solid var(--fb-accent);
    outline-offset: 2px;
  }
  ```

