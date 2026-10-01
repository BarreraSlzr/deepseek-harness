/**
 * Internet Friends brand mark sourced from https://internetfriends.xyz
 * `manifest.webmanifest` icons (`/icon-192.png`).
 */

/** Display options for the Internet Friends mark. */
export interface InternetFriendsLogoProps {
  /** Square edge in px; defaults to 24. */
  size?: number | undefined
  /** Extra class for layout placement. */
  className?: string | undefined
}

/** Public URL of the 192px mark from internetfriends.xyz. */
export const INTERNETFRIENDS_LOGO_SRC = '/icon-192.png'

/**
 * Render the Internet Friends brand mark.
 * @param props.size - square edge in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the mark image (aria-hidden decorative brand art).
 */
export function InternetFriendsLogo({ size = 24, className }: InternetFriendsLogoProps) {
  return (
    <img
      src={INTERNETFRIENDS_LOGO_SRC}
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}
