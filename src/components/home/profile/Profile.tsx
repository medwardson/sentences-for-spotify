import styles from "./Profile.module.scss";

import { useAppSelector } from "@/lib/hooks";
import { useState } from "react";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import { ListItemIcon, ListSubheader, Menu, MenuItem } from "@mui/material";
import Image from "next/image";

export const Profile = () => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const { displayName, profilePictureUrl } = useAppSelector(
        (state) => state.user.info
    );

    const handleClick = (event: React.MouseEvent<HTMLElement>) =>
        setAnchorEl(event.currentTarget);

    const handleClose = () => setAnchorEl(null);

    const logOut = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full navigation resets the store; clearing it client-side would let withAuth redirect to /loading first
        window.location.assign("/");
    };

    return (
        <div className={styles.userInfo}>
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
                <ListSubheader
                    sx={{ lineHeight: 2.5, bgcolor: "transparent" }}
                >
                    {displayName}
                </ListSubheader>
                <MenuItem dense onClick={logOut}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    Log out
                </MenuItem>
            </Menu>
        </div>
    );
};
