import { Profile } from "@/components/home/profile/Profile";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logo from "../../../../public/images/newLogo.svg";
import styles from "./Header.module.scss";

const LINKS = [
    { href: "/home", label: "Home" },
    { href: "/stats", label: "Stats" },
];

export const Header = () => {
    const pathname = usePathname();

    return (
        <header className={`content-container ${styles.header}`}>
            <div className={styles.brand}>
                <Image
                    className={styles.logo}
                    src={logo}
                    alt="Sentences for Spotify logo"
                    priority
                />
                <h1 className="page-title">Sentences for Spotify</h1>
            </div>
            <nav className={styles.nav}>
                {LINKS.map(({ href, label }) => (
                    <Link
                        key={href}
                        href={href}
                        className={styles.link}
                        aria-current={pathname === href ? "page" : undefined}
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            <Profile />
        </header>
    );
};
