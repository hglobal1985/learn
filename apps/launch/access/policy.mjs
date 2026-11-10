/** Public-only visibility until the new versioned SSO contract is supplied. */
export function canViewPublic(video){
 return video?.status==='published'&&video?.access_mode==='public';
}
