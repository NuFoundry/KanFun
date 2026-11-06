import type katexEngine from "katex";
import { useEffect, useRef, useState } from "react";

type Katex = typeof katexEngine;
let katex: Promise<Katex> | undefined;

/** KaTeX and its stylesheet (fonts included) load the first time a reply contains maths. */
function loadKatex() {
  katex ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(
    ([module]) => module.default,
  );
  return katex;
}

/**
 * A formula from a reply, drawn by KaTeX. Until KaTeX has loaded (or if it cannot) the LaTeX
 * shows as code. KaTeX writes into a span React leaves empty, so the two never fight over it;
 * `trust` stays off, so a formula cannot produce links, classes or styles of its own.
 */
export function MathFormula({ tex, display }: { tex: string; display: boolean }) {
  const target = useRef<HTMLSpanElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    let active = true;
    loadKatex()
      .then((engine) => {
        if (!active || !target.current) return;
        engine.render(tex, target.current, {
          displayMode: display,
          throwOnError: false,
          maxSize: 20,
          maxExpand: 500,
        });
        setDrawn(true);
      })
      // A chunk that fails to load leaves the LaTeX on screen as code.
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [tex, display]);

  return (
    <>
      <span
        ref={target}
        hidden={!drawn}
        className={display ? "my-3 block overflow-x-auto overflow-y-hidden py-1" : undefined}
        data-testid="math"
      />
      {!drawn && <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{tex}</code>}
    </>
  );
}
