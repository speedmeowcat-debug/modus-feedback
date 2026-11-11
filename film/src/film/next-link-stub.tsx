// В ролике ссылки приложения не нужны: next/link заменяется обычным элементом <a>.
import type { AnchorHTMLAttributes } from "react";

export default function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: unknown }) {
  return <a href={typeof href === "string" ? href : undefined} {...rest} />;
}
