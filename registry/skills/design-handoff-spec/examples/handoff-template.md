# Handoff spec template

One spec per page or flow. Each section links to its frame identifier. Run the Definition of Ready first; if an item fails, return the handoff with the missing list.

## Definition of Ready

```text
[ ] frames exist for every state of every interactive element
[ ] the desktop and the narrowest breakpoint are both designed
[ ] all copy is final, or has a length limit
[ ] the tokens needed exist
[ ] the open questions are listed, each with an owner
MISSING: <the list, if any, returned to Jamileh and Kaan>
```

## The spec

```text
SCOPE        <page or flow>   LINKS <file link, frame identifiers>
SECTION      <name>   FRAME <identifier>
COMPONENTS   <existing | extended (which variant) | new (needs ui-component-spec)>
LAYOUT       desktop: <grid columns, gutter token, maximum content width, section padding tokens>
             narrow (<= <px>): <what stacks, in which order, padding tokens>
RESPONSIVE   <what reflows, stacks or hides and where it goes instead; the content order; which images swap>
             breakpoints: <the product's names and widths>
STATES       <component>: <default, loading (how long before an error), empty, error, success, disabled>
MOTION       <what it is for>: <duration, easing>; reduced motion: <no movement | a fade | an instant change>
CONTENT      <typed props from Kaan, maximum lengths, what happens beyond them>; images: <alt text, or decorative>
ACCESSIBILITY  headings and landmarks outline: <...>   (also Selin's SEO needs)
ASSETS       <files, formats, sources>
TEST IDS     <data-testid for every interactive element and key region>
EVENTS       <name { properties }>
OPEN         <question> (<owner: Jamileh | Kaan | Selin | Defne>)
REVIEW       Emre: which acceptance checks cannot be written yet
```

A pixel or hex value that matches no token is a defect in the design: it goes in OPEN as a token request to Jamileh and is never copied.
