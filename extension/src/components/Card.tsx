import type { PropsWithChildren, HTMLAttributes } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export const Card = ({ children, style, ...rest }: CardProps) => (
  <div
    {...rest}
    style={{
      backgroundColor: "#ffffff",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)",
      padding: "24px",
      border: "1px solid #e8eaed",
      ...style,
    }}
  >
    {children}
  </div>
);


