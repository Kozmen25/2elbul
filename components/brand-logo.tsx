import Link from "next/link";

type BrandLogoProps = {
  size?: "sm" | "md" | "lg";
  linked?: boolean;
  centered?: boolean;
};

const sizeClasses = {
  sm: {
    wrapper: "gap-2",
    mark: "size-8 rounded-[10px] text-base",
    wordmark: "text-lg",
  },
  md: {
    wrapper: "gap-2.5",
    mark: "size-10 rounded-xl text-xl",
    wordmark: "text-[22px]",
  },
  lg: {
    wrapper: "gap-3",
    mark: "size-12 rounded-[14px] text-2xl",
    wordmark: "text-3xl",
  },
};

export function BrandLogo({
  size = "md",
  linked = true,
  centered = false,
}: BrandLogoProps) {
  const classes = sizeClasses[size];
  const logo = (
    <>
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center bg-[#ff6b00] font-black leading-none tracking-[-0.05em] text-white shadow-[0_5px_16px_rgba(255,107,0,0.22)] ${classes.mark}`}
      >
        2
      </span>
      <span
        className={`whitespace-nowrap font-black leading-none tracking-[-0.055em] text-[#171717] ${classes.wordmark}`}
      >
        ElBul
      </span>
    </>
  );
  const className = `inline-flex items-center ${classes.wrapper} ${
    centered ? "justify-center" : ""
  }`;

  if (!linked) {
    return (
      <span className={className} aria-label="2ElBul">
        {logo}
      </span>
    );
  }

  return (
    <Link
      href="/"
      className={`${className} rounded-xl outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-[#ff6b00] focus-visible:ring-offset-4`}
      aria-label="2ElBul ana sayfa"
    >
      {logo}
    </Link>
  );
}
