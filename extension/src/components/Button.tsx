import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const baseStyles: CSSProperties = {
  padding: "10px 16px",
  borderRadius: "8px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "opacity 0.15s ease",
  fontSize: "14px",
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: "#0b57d0",
    color: "#ffffff",
    border: "none",
  },
  secondary: {
    backgroundColor: "#f1f3f4",
    color: "#1f1f1f",
    border: "none",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "#0b57d0",
    border: "1px solid #0b57d0",
  },
};

export type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  }
>;

export const Button = ({
  children,
  variant = "primary",
  style,
  type,
  ...rest
}: ButtonProps) => (
  <button
    {...rest}
    type={type ?? "button"}
    style={{ ...baseStyles, ...variantStyles[variant], ...style }}
  >
    {children}
  </button>
);

