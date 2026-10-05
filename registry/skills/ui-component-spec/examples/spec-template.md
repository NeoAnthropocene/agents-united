# Component spec template

One file per component. Fill every field; none stays blank. A field you cannot fill is an open question with a named owner, and a rule the frames do not show is marked as an assumption.

```text
COMPONENT     <name>
PURPOSE       <one sentence>.  NOT FOR: <one sentence>
SOURCES       <the frame or file each rule came from, or "assumption">

ANATOMY       <part> (<token for colour>, <token for size or spacing>), one per part; no raw values

PROPS         export interface <Name>Props { ... }   required or optional, defaults, unions not free strings,
              ranges for lengths and counts; INVALID COMBINATIONS: <what the component does>
              Content arrives as typed props from the copy owner; none is hardcoded

STATES        <state>: <what changes (token)>; <what the user can still do>
              default, hover, focus-visible, active, disabled, loading, error, empty, selected (where they apply)
              NOT REACHABLE YET: <states to build before they are needed>

KEYBOARD      tab order: <...>   keys: <Space and Enter for a button; arrows inside a group>
              focus after open, close or error: <where>   focus indicator: at least 3 to 1 against its surroundings

SEMANTICS     native element: <button, not a div>   role and accessible name: <only if no native element>
              live region for status and error text: <...>   reduced-motion alternative: <...>

RESPONSIVE    narrow breakpoint: <what changes>   minimum touch target: 44 x 44 CSS pixels
              long content: <wrap or truncate with a tooltip, only when the content repeats elsewhere>   empty content: <...>

TEST IDS      data-testid on every interactive element: <ids>
EVENTS        <name> { <properties> }   agreed with <Jale | Ava> if they consume it

OPEN          <question> (<owner>)
HAND-OFFS     builder; Emre (test plan from the states table); Jamileh (a frame for every state); Kaan (content limits)
```
