import { useId, type SVGProps } from "react";

interface GridPatternProps extends SVGProps<SVGSVGElement> {
  width: number;
  height: number;
  x: number;
  y: number;
  squares?: [number, number][];
}

export function GridPattern({
  width,
  height,
  x,
  y,
  squares,
  className,
  ...props
}: GridPatternProps) {
  const id = useId();
  const patternId = `grid-pattern-${id}`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      {...props}
    >
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path
            d={`M ${width} 0 L 0 0 0 ${height}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      {squares?.map(([sx, sy], i) => (
        <rect
          key={i}
          x={sx * width + 1}
          y={sy * height + 1}
          width={width - 2}
          height={height - 2}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
