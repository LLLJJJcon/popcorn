import Link from "next/link";

const navigation = [
  { href: "/home", label: "Home" },
  { href: "/saved", label: "Saved" },
  { href: "/practice", label: "Practice" },
  { href: "/vault", label: "Vault" },
  { href: "/progress", label: "Progress" },
] as const;

export default function AppLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <>
      <header>
        <nav aria-label="Primary navigation">
          <ul>
            {navigation.map((item) => (
              <li key={item.href}><Link href={item.href}>{item.label}</Link></li>
            ))}
          </ul>
        </nav>
      </header>
      {children}
    </>
  );
}
