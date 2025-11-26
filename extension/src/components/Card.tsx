import type { PropsWithChildren, HTMLAttributes } from "react";

type CardProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export const Card = ({ children, style, ...rest }: CardProps) => (
  <div
    {...rest}
    style={{
      backgroundColor: "#ffffff",
      borderRadius: "16px",
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.12)",
      padding: "20px",
      border: "1px solid rgba(0,0,0,0.08)",
      ...style,
    }}
  >
    {children}
  </div>
);


