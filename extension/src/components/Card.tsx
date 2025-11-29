import type { PropsWithChildren, HTMLAttributes } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export const Card = ({ children, style, ...rest }: CardProps) => (
  <div
    {...rest}
    style={{
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)",
      padding: "24px",
      border: "1px solid #e8eaed",
      ...style,
    }}
  >
    {children}
  </div>
);


