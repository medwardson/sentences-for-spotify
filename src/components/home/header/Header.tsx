import { Profile } from "@/components/home/profile/Profile";
import Image from "next/image";
import logo from "../../../../public/images/newLogo.svg";
import styles from "./Header.module.scss";

export const Header = () => (
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
        <Profile />
    </header>
);
