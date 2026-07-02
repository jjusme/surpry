import React from "react";
import { cn } from "../../utils/cn";

const assets = {
  icon: "/surpry-icon.png",
  logo: "/surpry-logo-nobg.png"
};

export function BrandAsset({
  variant = "logo",
  alt = "Surpry",
  className,
  ...props
}) {
  return (
    <img
      src={assets[variant] || assets.logo}
      alt={alt}
      className={cn("block object-contain", className)}
      {...props}
    />
  );
}
