# Persistent Rule: Quality, Aesthetics & Accessibility Standards

## Purpose & Scope
This rule mandates premium visual design, accessible human-computer interaction, and intuitive terminal user interfaces across all tools and web components produced by Agents United.

---

## 1. Terminal User Interface (TUI) Standards
- **Folder Tree Visualizations**: Present multi-item catalogs using standardized Unicode box-drawing characters (`├──`, `└──`, `│`, `│   `).
- **Two-Stage Progressive Drill-Downs**: Avoid massive unorganized select lists. Group options into domain categories before opening specialized sub-teams.
- **Consistent Visual Badges**: Use color-coded badges to indicate item types (`[Bundle]`, `[Agent]`, `[Skill]`, `[Workflow]`).
- **Explicit Confirmation Gates**: Require user confirmation before destructive actions or large-scale batch installations (e.g. installing an entire department).

---

## 2. Web & Mobile Accessibility Standards (WCAG 2.1 Level AA)
- **Semantic HTML5**: Always use appropriate semantic elements (`<main>`, `<nav>`, `<article>`, `<header>`, `<button>`) instead of nested `<div>` wrappers.
- **Contrast Ratios**: Maintain a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text and interactive components.
- **Keyboard Navigation**: Guarantee visible focus rings and logical tab ordering (`tabindex="0"` for interactive custom widgets).
- **Touch Target Ergonomics**: Ensure minimum interactive target sizes of 44x44 points (iOS) and 48x48 dp (Android).

---

## 3. Anti-Cliché Design Guidelines
Unless explicitly requested by the user, DO NOT use generic tropes:
- No purple fonts or violet accents on dark backgrounds.
- No unpadded containers or textureless surfaces.
- No floating badge pills with pulsing dots above main headlines.
- No icon-stuffed bento boxes without clear functional hierarchy.
