"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./app-shell.module.css";

const learningNavigation = [
  { href: "/home", label: "Home" },
  { href: "/saved", label: "Saved" },
  { href: "/practice", label: "Practice" },
  { href: "/vault", label: "Vault" },
  { href: "/progress", label: "Progress" },
] as const;

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation(): React.JSX.Element {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Primary navigation">
      <ul className={styles.navigationList}>
        {learningNavigation.map(({ href, label }) => (
          <li key={href}>
            <Link
              className={styles.navigationLink}
              href={href}
              aria-current={isActivePath(pathname, href) ? "page" : undefined}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        className={styles.settingsLink}
        href="/settings/model-gateway"
        aria-current={isActivePath(pathname, "/settings/model-gateway") ? "page" : undefined}
      >
        Settings
      </Link>
    </nav>
  );
}
