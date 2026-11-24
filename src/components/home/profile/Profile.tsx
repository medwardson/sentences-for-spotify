import styles from "./Profile.module.scss";

import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useState } from "react";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { ListItemIcon, Menu, MenuItem } from "@mui/material";
import { clearUserInfo } from "@/lib/store/userSlice";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import Image from "next/image";

export const Profile = () => {
    const dispatch = useAppDispatch();
    const router = useRouter();

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const { displayName, profilePictureUrl } = useAppSelector(
        (state) => state.user.info
    );

    const handleClick = (event: React.MouseEvent<HTMLElement>) =>
        setAnchorEl(event.currentTarget);

    const handleClose = () => setAnchorEl(null);

    const deleteCookie = () => {
        Cookies.remove("access_token");
        dispatch(clearUserInfo());
        router.push("/");
    };

    return (
        <div className={styles.userInfo}>
            <span className="hidden text-muted md:inline">Hi, {displayName}!</span>
            <button
                type="button"
                className={styles.avatarButton}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={handleClick}
            >
                {profilePictureUrl ? (
                    <Image
                        height={40}
                        width={40}
                        className={styles.pfp}
                        src={profilePictureUrl}
                        alt={`${displayName}'s profile picture`}
                        unoptimized
                    />
                ) : (
                    <AccountCircleIcon sx={{ fontSize: 40 }} />
                )}
            </button>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
                <MenuItem dense onClick={deleteCookie}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    Log out
                </MenuItem>
            </Menu>
        </div>
    );
};
