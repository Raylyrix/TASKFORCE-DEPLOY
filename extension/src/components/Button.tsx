import type { ButtonHTMLAttributes, CSSProperties, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

const baseStyles: CSSProperties = {
  padding: "10px 20px",
  borderRadius: "8px",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.2s ease",
  fontSize: "14px",
  lineHeight: "1.5",
  border: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    backgroundColor: "#1a73e8",
    color: "#ffffff",
  },
  secondary: {
    backgroundColor: "#f1f3f4",
    color: "#202124",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "#1a73e8",
    border: "1px solid #dadce0",
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

