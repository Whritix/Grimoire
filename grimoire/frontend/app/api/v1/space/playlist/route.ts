/**
 * POST /api/v1/space/playlist
 * Fetch videos from YouTube playlist
 */

import { NextRequest, NextResponse } from 'next/server'
import logger from '@/lib/server/logger'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const playlistId = searchParams.get('playlistId')

        if (!playlistId) {
            return NextResponse.json(
                { error: 'playlistId is required' },
                { status: 400 }
            )
        }

        logger.info({ playlistId }, 'Fetching playlist')

        // Mock playlist data
        // TODO: Replace with real YouTube API call or Python backend
        const mockVideos = [
            {
                videoId: 'dQw4w9WgXcQ',
                title: 'Introduction to the Topic',
                description: 'Learn the fundamentals of this amazing subject',
                channelName: 'Learning Channel',
                thumbnail: null,
                duration: 620,
                uploadDate: new Date().toISOString(),
                keyTopics: ['basics', 'introduction'],
                chapters: [],
            },
            {
                videoId: 'jNQXAC9IVRw',
                title: 'Deep Dive - Part 1',
                description: 'Going deeper into advanced concepts',
                channelName: 'Learning Channel',
                thumbnail: null,
                duration: 1240,
                uploadDate: new Date().toISOString(),
                keyTopics: ['advanced', 'deep-dive'],
                chapters: [],
            },
            {
                videoId: '9bZkp7q19f0',
                title: 'Deep Dive - Part 2',
                description: 'Continuing with more advanced topics',
                channelName: 'Learning Channel',
                thumbnail: null,
                duration: 980,
                uploadDate: new Date().toISOString(),
                keyTopics: ['advanced', 'practice'],
                chapters: [],
            },
            {
                videoId: 'y6120QOlsfU',
                title: 'Practical Examples',
                description: 'Real-world applications and examples',
                channelName: 'Learning Channel',
                thumbnail: null,
                duration: 1560,
                uploadDate: new Date().toISOString(),
                keyTopics: ['practical', 'examples'],
                chapters: [],
            },
            {
                videoId: 'kJQP7kiw5Fk',
                title: 'Final Project',
                description: 'Build a complete project from scratch',
                channelName: 'Learning Channel',
                thumbnail: null,
                duration: 2100,
                uploadDate: new Date().toISOString(),
                keyTopics: ['project', 'hands-on'],
                chapters: [],
            },
        ]

        return NextResponse.json({
            playlistId,
            videos: mockVideos,
            metadata: {
                totalVideos: mockVideos.length,
                totalDuration: mockVideos.reduce((sum, v) => sum + v.duration, 0),
            },
        })
    } catch (error: any) {
        logger.error({ error }, 'Playlist fetch failed')
        return NextResponse.json(
            { error: error.message || 'Failed to fetch playlist' },
            { status: 500 }
        )
    }
}
