//#region constants
import type {
    CreatorStatus,
    CreatorVideosResponse,
    FloatplaneSource,
    FP_Delivery,
    FP_DeliveryVariant,
    FP_Parent_Image,
    FP_Post,
    FP_Subscription,
    FP_VideoAttachment,
    Settings,
    State
} from "./types.js"

const PLATFORM = "Floatplane" as const
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0" as const

const PLATFORM_URL = "https://www.floatplane.com" as const
const BASE_API_URL = "https://www.floatplane.com/api" as const
const SUBSCRIPTIONS_URL = `${BASE_API_URL}/v3/user/subscriptions` as const
const POST_URL = `${BASE_API_URL}/v3/content/post` as const
const DELIVERY_URL = `${BASE_API_URL}/v3/delivery/info` as const
const LIST_URL = `${BASE_API_URL}/v3/content/creator/list` as const

const HARDCODED_ZERO = 0 as const
const HARDCODED_EMPTY_STRING = "" as const
const EMPTY_AUTHOR = new PlatformAuthorLink(new PlatformID(PLATFORM, "", plugin.config.id), "", "")

// this API reference makes everything super easy
// https://jman012.github.io/FloatplaneAPIDocs/SwaggerUI-full/

const local_http = http
// const local_utility = utility

// set missing constants
Type.Order.Chronological = "Latest releases"
Type.Order.Views = "Most played"
Type.Order.Favorites = "Most favorited"

let local_settings: Settings

/** State */
let local_state: State
//#endregion

//#region source methods
const local_source: FloatplaneSource = {
    enable,
    disable,
    saveState,
    getHome,
    isContentDetailsUrl,
    getContentDetails,
}
init_source(local_source)
function init_source<
    T extends { readonly [key: string]: string },
    S extends string,
    ChannelTypes extends FeedType,
    SearchTypes extends FeedType,
    ChannelSearchTypes extends FeedType
>(local_source: Source<T, S, ChannelTypes, SearchTypes, ChannelSearchTypes, Settings>) {
    for (const method_key of Object.keys(local_source)) {
        // @ts-expect-error assign to readonly constant source object
        source[method_key] = local_source[method_key]
    }
}
//#endregion

//#region enable
function enable(conf: SourceConfig, settings: Settings, saved_state?: string | null) {
    if (IS_TESTING) {
        log("IS_TESTING true")
        log("logging configuration")
        log(conf)
        log("logging settings")
        log(settings)
        log("logging savedState")
        log(saved_state)
    }
    local_settings = settings
    if (saved_state !== null && saved_state !== undefined) {
        const state: State = JSON.parse(saved_state)
        local_state = state
    } else {
        local_state = {}
    }

    console.log(USER_AGENT, HARDCODED_ZERO, HARDCODED_EMPTY_STRING, EMPTY_AUTHOR, local_settings, local_state)
}
//#endregion

function disable() {
    log("Floatplane log: disabling")
}

function saveState() {
    return JSON.stringify(local_state)
}

//#region home
function getHome(): ContentPager {
    const response: FP_Subscription[] = JSON.parse(local_http.GET(SUBSCRIPTIONS_URL, {}, false).body)

    const limit = 20
    const pager = new CreatorPager(response.map(c => c.creator), limit)
    return pager
}
function ToThumbnails(thumbs: FP_Parent_Image | null): Thumbnails {
    if (thumbs == null)
        return new Thumbnails([])

    return new Thumbnails([thumbs, ...thumbs.childImages].map(
        (t) => new Thumbnail(t.path, t.height)
    ))
}

function ToVideoEntry(blog: FP_Post): PlatformVideo | null {
    if (blog.metadata.hasVideo) {
        return new PlatformVideo({
            id: new PlatformID("Floatplane", blog.id, plugin.config.id),
            name: blog.title,
            thumbnails: ToThumbnails(blog.thumbnail),
            author: new PlatformAuthorLink(
                new PlatformID("Floatplane", blog.channel.creator + ":" + blog.channel.id, plugin.config.id),
                blog.channel.title,
                ChannelUrlFromBlog(blog),
                blog.channel.icon?.path || ""
            ),
            datetime: new Date(blog.releaseDate).getTime() / 1000,
            duration: blog.metadata.videoDuration,
            viewCount: blog.likes + blog.dislikes,          // Floatplane does not support a view count, so this is a proxy
            url: PLATFORM_URL + "/post/" + blog.id,
            shareUrl: PLATFORM_URL + "/post/" + blog.id,
            isLive: false                                   // TODO: Support live videos
        })
    }

    // TODO: Images
    // TODO: Audio
    // TODO: Gallery
    // throw new ScriptException("The following blog has no video: " + blog.id);
    return null
}
function ChannelUrlFromBlog(blog: FP_Post): string {
    return PLATFORM_URL + "/channel/" + blog.creator.urlname + "/home/" + blog.channel.urlname
}

class CreatorPager extends ContentPager {
    private readonly creators: { [creator: string]: CreatorStatus }
    constructor(creator_ids: string[], private readonly limit: number) {
        const url = new URL(LIST_URL)
        url.searchParams.set("limit", limit.toString())
        creator_ids.forEach((creator_id, n) => url.searchParams.set(`ids[${n}]`, creator_id))

        const response: CreatorVideosResponse = JSON.parse(local_http.GET(url.toString(), {}, false).body)

        const creators: { [creator: string]: CreatorStatus } = {}
        let has_more = false
        for (const data of response.lastElements) {
            creators[data.creatorId] = data
            has_more ||= data.moreFetchable
        }

        const results = response.blogPosts.map(ToVideoEntry).filter(x => x !== null)

        super(results, has_more)
        this.creators = creators
    }
    override nextPage(this: CreatorPager) {
        const url = new URL(LIST_URL)
        url.searchParams.set("limit", this.limit.toString())
        Object.values(this.creators).forEach((creator, n) => {
            url.searchParams.set(`ids[${n}]`, creator.creatorId)

            if (creator.blogPostId) {
                url.searchParams.set(`fetchAfter[${n}][creatorId]`, creator.creatorId)
                url.searchParams.set(`fetchAfter[${n}][blogPostId]`, creator.blogPostId)
                url.searchParams.set(`fetchAfter[${n}][moreFetchable]`, creator.moreFetchable.toString())
            }
        })

        const response: CreatorVideosResponse = JSON.parse(local_http.GET(url.toString(), {}, false).body)

        this.hasMore = false
        for (const data of response.lastElements) {
            this.creators[data.creatorId] = data
            this.hasMore ||= data.moreFetchable
        }

        this.results = response.blogPosts.map(ToVideoEntry).filter(x => x !== null)
        return this
    }
    override hasMorePagers(this: CreatorPager): boolean {
        return this.hasMore
    }
}
//#endregion

//#region 
function isContentDetailsUrl(url: string) {
    return /^https?:\/\/(www\.)?floatplane\.com\/post\/[\w\d]+$/.test(url)
}
function getContentDetails(url: string): PlatformContentDetails {
    const post_id: string = url.split("/").pop() as string

    const api_url = new URL(POST_URL)
    api_url.searchParams.set("id", post_id)

    const response: FP_Post = JSON.parse(local_http.GET(api_url.toString(), {}, false).body)

    if (response.metadata.hasVideo) {
        if (response.metadata.hasAudio || response.metadata.hasPicture || response.metadata.hasGallery) {
            bridge.toast("Mixed content not supported; only showing video")
        }
        const videos = ToGrayjayVideoSource(response.videoAttachments)
        console.log(videos)

        return new PlatformVideoDetails({
            id: new PlatformID(PLATFORM, post_id, plugin.config.id),
            name: response.title,
            description: response.text,
            thumbnails: ToThumbnails(response.thumbnail),
            author: new PlatformAuthorLink(
                new PlatformID(PLATFORM, response.channel.creator + ":" + response.channel.id, plugin.config.id),
                response.channel.title,
                ChannelUrlFromBlog(response),
                response.channel.icon?.path || ""
            ),
            datetime: new Date(response.releaseDate).getTime() / 1000,
            duration: response.metadata.videoDuration,
            viewCount: response.likes + response.dislikes, // TODO: implement view count
            url: PLATFORM_URL + "/post/" + response.id,
            shareUrl: PLATFORM_URL + "/post/" + response.id,
            isLive: false,
            video: videos,
            rating: new RatingLikesDislikes(response.likes, response.dislikes),
            subtitles: []
        })
    }

    if (response.metadata.hasAudio) {
        throw new ScriptException("Audio content not supported")
    }

    if (response.metadata.hasPicture) {
        throw new ScriptException("Picture content not supported")
    }

    if (response.metadata.hasGallery) {
        throw new ScriptException("Gallery content not supported")
    }

    throw new ScriptException("Content type not supported")
}

/** Returns the associated Grayjay stream object */
function ToGrayjayVideoStream(
    video_index: number,
    group_index: number,
    duration: number,
    origin: string,
    title: string,
    variant: FP_DeliveryVariant
): VideoUrlSource | HLSSource | DashSource {
    const letters: string = " abcdefghijklmnopqrstuvwxyz"
    const group_letter = letters[group_index % letters.length]

    switch (local_settings.stream_format) {
        case "flat":
            throw new ScriptException("Flat streams are not implemented (possibly encrypted)")
        /* return new VideoUrlSource({
            width: variant.meta.video?.width || -1,
            height: variant.meta.video?.height || -1,
            container: variant.meta.video?.mimeType || "",
            codec: variant.meta.video?.codec || "",
            bitrate: variant.meta.video?.bitrate.average || 0,
            duration: duration,
            url: origin + variant.url,
            name: `#${video_index}${group_letter}=${variant.label} - ${title}`
        }); */

        case "dash.m4s":
            throw new ScriptException("Dash streams are not implemented (no streams from Floatplane)")
        // fall through
        case "dash.mpegts":
            throw new ScriptException("Dash streams are not implemented (no streams from Floatplane)")
    }

    const source = new HLSSource({
        name: `#${video_index}${group_letter}=${variant.label} - ${title}`,
        url: origin + variant.url,
        duration: duration,
        priority: false
    })

    // const enc_key = FP.getHlsToken(origin + variant.url)
    // const executor = new FP.FP_HLS_Executor(origin + variant.url, enc_key)

    // source.getRequestExecutor = () => executor

    // source.getRequestExecutor = () => { return {
    //     urlPrefix: (origin + variant.url).split("/chunk.m3u8")[0] + "/",
    //     executeRequest: (url: string, headers: object) => {
    //         console.log(url);
    //         log(url);
    //         if(url.includes(".m3u8?")) {
    //             FP.pushToQueue(source);
    //             log(FP.segment_queue);
    //             return FP.segment_queue[0];
    //             // const resp = http.GET(url, { ...FP.FP_Headers, ...headers }, true);
    //             // if(!resp.isOk)
    //             //     throw new ScriptException("Failed to fetch HLS Playlist: " + resp.code);
    //             //
    //             // return resp.body;
    //         }
    //         throw new ScriptException("HLS URL: " + url);
    //     },
    //     getRequestExecutor: (url: string, headers: object) => {
    //         throw new ScriptException("HLS GET URL: " + url);
    //     }
    // }};
    return source
}

// function strToByteArr(str: string): Uint8Array {
//     const buf = new ArrayBuffer(str.length)
//     const bufView = new Uint8Array(buf)
//     for (let i = 0, strLen = str.length; i < strLen; i++) {
//         bufView[i] = str.charCodeAt(i)
//     }
//     return bufView
// }

/** Returns video streams from an [FP_Post] */
function ToGrayjayVideoSource(attachments: FP_VideoAttachment[]): VideoSourceDescriptor {
    const videos: IVideoSource[] = []
    const errors: string[] = []
    let video_index: number = 0

    for (const video of attachments) {
        video_index++

        if (!video.isAccessible) {
            errors.push(`Video ${video_index}:${video.id} is not accessible`)
            bridge.toast(`Video ${video_index}:${video.id} is not accessible`)
            continue
        }

        if (video.isProcessing) {
            errors.push(`Video ${video_index}:${video.id} is processing`)
            bridge.toast(`Video ${video_index}:${video.id} is processing`)
            continue
        }

        const url = new URL(DELIVERY_URL)
        url.searchParams.set("scenario", local_settings.stream_format == "flat" ? "download" : "onDemand")
        url.searchParams.set("entityId", video.id)
        url.searchParams.set("outputKind", local_settings.stream_format)

        const response: FP_Delivery = JSON.parse(local_http.GET(url.toString(), {}, false).body)

        let group_index: number = 0

        if (response.groups.length == 0) {
            errors.push(`Video ${video_index}:${video.id} has no groups`)
            bridge.toast(`Video ${video_index}:${video.id} has no groups`)
            continue
        }

        for (const group of response.groups) {
            group_index++
            if (group.variants.length == 0) {
                errors.push(`Video ${video_index}:${video.id}:${group_index} has no variants`)
                if (local_settings.log_level)
                    bridge.toast(`Video ${video_index}:${video.id}:${group_index} has no variants`)
                continue
            }

            for (const variant of group.variants) {
                if (variant.hidden) {
                    errors.push(`Video ${video_index}:${video.id}:${group_index}:${variant.name} is hidden`)
                    if (local_settings.log_level)
                        bridge.toast(`Video ${video_index}:${video.id}:${group_index}:${variant.name} is hidden`)
                    continue
                }

                if (!variant.enabled) {
                    errors.push(`Video ${video_index}:${video.id}:${group_index}:${variant.name} is disabled`)
                    if (local_settings.log_level)
                        bridge.toast(`Video ${video_index}:${video.id}:${group_index}:${variant.name} is disabled`)
                    continue
                }

                if (local_settings.log_level)
                    bridge.toast(`SUCCESS: Video ${video_index}:${video.id}:${group_index}:${variant.name}`)

                const origin = group.origins[0]
                if (origin === undefined) {
                    throw new ScriptException("unreachable")
                }

                videos.push(ToGrayjayVideoStream(
                    video_index, group_index,
                    video.duration,
                    origin.url,
                    video.title,
                    variant
                ))
            }
        }
    }

    if (videos.length == 0) {
        throw new ScriptException("The following errors occurred:\n- " + errors.join("\n- "))
    }

    log(videos)
    return new VideoSourceDescriptor(videos)
}
//#endregion

//#region utilities
/**
 * Converts seconds to the timestamp format used in WebVTT
 * @param seconds 
 * @returns 
 */
function milliseconds_to_WebVTT_timestamp(milliseconds: number) {
    return new Date(milliseconds).toISOString().substring(11, 23)
}
//#endregion

console.log(milliseconds_to_WebVTT_timestamp)
// export statements are removed during build step
// used for unit testing in script.test.ts
export { milliseconds_to_WebVTT_timestamp }
