/**
 * YouTube URL parsing utilities
 */

export interface YouTubeUrlInfo {
    type: 'video' | 'playlist'
    videoId?: string
    playlistId?: string
}

export function parseYouTubeUrl(url: string): YouTubeUrlInfo | null {
    try {
        const urlObj = new URL(url)
        const hostname = urlObj.hostname.replace('www.', '')

        // Check for playlist
        const listParam = urlObj.searchParams.get('list')
        if (listParam) {
            return {
                type: 'playlist',
                playlistId: listParam,
                videoId: urlObj.searchParams.get('v') || undefined,
            }
        }

        // Check for video
        if (hostname === 'youtube.com' || hostname === 'youtube-nocookie.com') {
            const videoId = urlObj.searchParams.get('v')
            if (videoId) {
                return { type: 'video', videoId }
            }
        }

        // Check for shortened URL
        if (hostname === 'youtu.be') {
            const videoId = urlObj.pathname.slice(1)
            if (videoId) {
                return { type: 'video', videoId }
            }
        }

        return null
    } catch {
        return null
    }
}

export function isPlaylist(url: string): boolean {
    const info = parseYouTubeUrl(url)
    return info?.type === 'playlist'
}

export function extractVideoId(url: string): string | null {
    const info = parseYouTubeUrl(url)
    return info?.videoId || null
}

export function extractPlaylistId(url: string): string | null {
    const info = parseYouTubeUrl(url)
    return info?.playlistId || null
}

export function isValidYouTubeUrl(url: string): boolean {
    return parseYouTubeUrl(url) !== null
}
