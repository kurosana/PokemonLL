import { useLayoutEffect, useRef } from "react";

function FitSingleLine({ text, className }: { text: string; className?: string }) {
  const outerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const fit = () => {
      inner.style.fontSize = "";
      let size = parseFloat(getComputedStyle(inner).fontSize);
      const min = Math.max(10, size * 0.52);
      inner.style.whiteSpace = "nowrap";
      const limit = outer.clientWidth;
      if (limit <= 0) return;
      let guard = 0;
      while (inner.scrollWidth > limit + 0.5 && size > min && guard++ < 100) {
        size -= 0.5;
        inner.style.fontSize = `${size}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [text]);

  return (
    <span ref={outerRef} className={className}>
      <span ref={innerRef} className="pokemon-label-fit-line-inner">{text}</span>
    </span>
  );
}

export function PokemonLabelFit({
  name,
  suffix,
  className,
  singleLine = false,
}: {
  name: string;
  suffix?: string | null;
  className?: string;
  /** 追記なしの1行表示（検索プレースホルダー等） */
  singleLine?: boolean;
}) {
  if (singleLine || !suffix) {
    return (
      <span className={`pokemon-label-fit${className ? ` ${className}` : ""}`}>
        <FitSingleLine text={name} className="pokemon-label-fit-line" />
      </span>
    );
  }

  return (
    <span className={`pokemon-label-fit is-stacked${className ? ` ${className}` : ""}`}>
      <FitSingleLine text={name} className="pokemon-label-fit-line pokemon-label-fit-name" />
      <FitSingleLine text={suffix} className="pokemon-label-fit-line pokemon-label-fit-suffix" />
    </span>
  );
}
