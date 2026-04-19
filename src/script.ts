//#region constants
import {
  CreatorStatus,
  CreatorVideosResponse,
  SauceplusSource,
  Delivery,
  DeliveryVariant,
  ParentImage,
  Post,
  SubscriptionResponse,
  VideoAttachment,
  MediaType,
  Settings,
  State,
  StreamFormat,
  Creator,
  Channel,
  SauceplusComment,
} from "./types.js";

const PLATFORM = "Sauceplus";
const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36";

const PLATFORM_URL = "https://www.sauceplus.com";
const BASE_API_URL = "https://www.sauceplus.com/api";
const SUBSCRIPTIONS_URL = `${BASE_API_URL}/v3/user/subscriptions` as const;
const POST_URL = `${BASE_API_URL}/v3/content/post` as const;
const CHANNEL_URL = `${BASE_API_URL}/v3/creator/named` as const;
//const CHANNEL_VIDEO_URL = `${BASE_API_URL}/v3/content/creator` as const
const DELIVERY_URL = `${BASE_API_URL}/v3/delivery/info` as const;
const LIST_URL = `${BASE_API_URL}/v3/content/creator/list` as const;
const COMMENT_URL = `${BASE_API_URL}/v3/comment` as const;
const RELATED_URL = `${BASE_API_URL}/v3/content/related` as const;
const CREATOR_INFO_URL = `${BASE_API_URL}/v3/creator/info` as const;
const PROGRESS_URL = `${BASE_API_URL}/v3/content/progress` as const;
const CREATOR_SEARCH_URL = `${BASE_API_URL}/v3/creator/list` as const;
const CREATOR_CONTENT_URL = `${BASE_API_URL}/v3/content/creator` as const;
const POST_LIST_URL = `${BASE_API_URL}/v3/content/post/list` as const;

const HARDCODED_ZERO = 0;
const HARDCODED_EMPTY_STRING = "";
const EMPTY_AUTHOR = new PlatformAuthorLink(
  new PlatformID(PLATFORM, "", plugin.config.id),
  "",
  "",
);

// this Floatplane API reference is somewhat useful
// https://jamamp.github.io/FloatplaneAPIDocs/SwaggerUI/

const local_http = http;
// const local_utility = utility

let local_settings: Settings;

/** State */
let local_state: State;
//#endregion

//#region source methods
const local_source: SauceplusSource = {
  enable,
  disable,
  saveState,
  getHome,
  isContentDetailsUrl,
  getContentDetails,
  getChannel,
  isChannelUrl,
  getChannelContents,
  getComments,
  getContentRecommendations,
  getUserSubscriptions,
  getPlaybackTracker,
  searchChannels,
  searchSuggestions,
  search,
  searchChannelContents,
};
init_source(local_source);
function init_source<
  ChannelTypes extends never,
  SearchTypes extends never,
  ChannelSearchTypes extends never,
>(
  local_source: Source<
    never,
    never,
    never,
    never,
    ChannelTypes,
    SearchTypes,
    ChannelSearchTypes,
    Settings
  >,
) {
  for (const method_key of Object.keys(local_source)) {
    // @ts-expect-error assign to readonly constant source object
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    source[method_key] = local_source[method_key];
  }
}
//#endregion

//#region setup
function enable(
  conf: SourceConfig,
  settings: Settings,
  saved_state?: string | null,
) {
  if (IS_TESTING) {
    log("IS_TESTING true");
    log("logging configuration");
    log(conf);
    log("logging settings");
    log(settings);
    log("logging savedState");
    log(saved_state);
  }
  local_settings = settings;

  if (!bridge.isLoggedIn()) {
    throw new LoginRequiredException("login to watch sauceplus");
  }

  const client_id = local_http.getDefaultClient(true).clientId;
  if (client_id === undefined) {
    throw new ScriptException("missing client id");
  }

  if (saved_state !== null && saved_state !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const state: State = JSON.parse(saved_state);
    local_state = { ...state, client_id };
  } else {
    local_state = { client_id };
  }
}

function disable() {
  log("Sauceplus log: disabling");
}

function saveState() {
  return JSON.stringify(local_state);
}
//#endregion

//#region home
function getHome(): ContentPager {
  if (!bridge.isLoggedIn()) {
    throw new LoginRequiredException("Login to use sauceplus.");
  }
  return new PostListPager(20, 0);
}
class PostListPager extends ContentPager {
  constructor(
    private readonly limit: number,
    private readonly offset: number,
  ) {
    const body: Record<string, number> = { limit };
    if (offset > 0) body["fetchAfter"] = offset;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw: Post[] | CreatorVideosResponse = JSON.parse(
      local_http.POST(
        POST_LIST_URL,
        JSON.stringify(body),
        { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        true,
      ).body,
    );
    const posts: Post[] = Array.isArray(raw) ? raw : (raw.blogPosts ?? []);
    super(
      posts.map(create_platform_video).filter((x) => x !== null),
      posts.length === limit,
    );
  }
  override nextPage(this: PostListPager): PostListPager {
    return new PostListPager(this.limit, this.offset + this.limit);
  }
  override hasMorePagers(this: PostListPager): boolean {
    return this.hasMore;
  }
}

function create_thumbnails(thumbs: ParentImage | null): Thumbnails {
  if (thumbs == null) return new Thumbnails([]);

  return new Thumbnails(
    [thumbs, ...thumbs.childImages].map((t) => new Thumbnail(t.path, t.height)),
  );
}

function create_platform_video(blog: Post): PlatformVideo | null {
  if (blog.metadata.hasVideo) {
    return new PlatformVideo({
      id: new PlatformID("Sauceplus", blog.id, plugin.config.id),
      name: blog.title,
      thumbnails: create_thumbnails(blog.thumbnail),
      author: new PlatformAuthorLink(
        new PlatformID(
          "Sauceplus",
          blog.channel.creator + ":" + blog.channel.id,
          plugin.config.id,
        ),
        blog.channel.title,
        ChannelUrlFromBlog(blog),
        blog.channel.icon?.path ?? "",
      ),
      datetime: new Date(blog.releaseDate).getTime() / 1000,
      duration: blog.metadata.videoDuration,
      viewCount: 0,
      url: PLATFORM_URL + "/post/" + blog.id,
      shareUrl: PLATFORM_URL + "/post/" + blog.id,
      isLive: false,
    });
  }

  // TODO: Support live videos
  // TODO: Images
  // TODO: Audio
  // TODO: Gallery
  // throw new ScriptException("The following blog has no video: " + blog.id);
  return null;
}
function ChannelUrlFromBlog(blog: Post): string {
  return (
    PLATFORM_URL +
    "/channel/" +
    blog.creator.urlname +
    "/home/" +
    blog.channel.urlname
  );
}

class HomePager extends ContentPager {
  private readonly creators: Record<string, CreatorStatus>;
  constructor(
    creator_ids: string[],
    private readonly limit: number,
  ) {
    const url = new URL(LIST_URL);
    url.searchParams.set("limit", limit.toString());
    creator_ids.forEach((creator_id, index) => {
      url.searchParams.set(`ids[${index.toString()}]`, creator_id);
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const response: CreatorVideosResponse = JSON.parse(
      local_http.GET(url.toString(), {}, true).body,
    );

    const creators: Record<string, CreatorStatus> = {};
    let has_more = false;
    for (const data of response.lastElements) {
      creators[data.creatorId] = data;
      has_more ||= data.moreFetchable;
    }

    const results = response.blogPosts
      .map(create_platform_video)
      .filter((x) => x !== null);

    super(results, has_more);
    this.creators = creators;
  }
  override nextPage(this: HomePager) {
    const url = new URL(LIST_URL);
    url.searchParams.set("limit", this.limit.toString());
    Object.values(this.creators).forEach((creator, index) => {
      url.searchParams.set(`ids[${index.toString()}]`, creator.creatorId);

      if (creator.blogPostId) {
        url.searchParams.set(
          `fetchAfter[${index.toString()}][creatorId]`,
          creator.creatorId,
        );
        url.searchParams.set(
          `fetchAfter[${index.toString()}][blogPostId]`,
          creator.blogPostId,
        );
        url.searchParams.set(
          `fetchAfter[${index.toString()}][moreFetchable]`,
          creator.moreFetchable.toString(),
        );
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const response: CreatorVideosResponse = JSON.parse(
      local_http.GET(url.toString(), { "User-Agent": USER_AGENT }, true).body,
    );

    let has_more = false;
    for (const data of response.lastElements) {
      this.creators[data.creatorId] = data;
      has_more ||= data.moreFetchable;
    }

    this.hasMore = has_more;
    this.results = response.blogPosts
      .map(create_platform_video)
      .filter((x) => x !== null);
    return this;
  }
  override hasMorePagers(this: HomePager): boolean {
    return this.hasMore;
  }
}
//#endregion

//#region channel

function isChannelUrl(url: string) {
  return /^https?:\/\/(www\.)?sauceplus\.com\/channel\/[\w\d]+\/home\/([\w\d]+)$/.test(
    url,
  );
}

function getChannel(url: string): PlatformChannel {
  if (!bridge.isLoggedIn()) {
    throw new LoginRequiredException("login to watch sauceplus");
  }
  const match = /channel\/([\w\d]+)\/home\/([\w\d]+)/.exec(url);
  const creatorUrl: string | undefined = match?.[1];

  if (creatorUrl === undefined) {
    throw new ScriptException("unreachable");
  }

  const api_url = new URL(CHANNEL_URL);
  api_url.searchParams.set("creatorURL[0]", creatorUrl);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const response: [Creator & { channels: Channel[] }] = JSON.parse(
    local_http.GET(api_url.toString(), {}, true).body,
  );
  const creator = response[0];
  const defaultChan = creator.channels.find(
    (c) => c.id === creator.defaultChannel,
  );
  const chanUrlname =
    defaultChan?.urlname ?? creator.channels[0]?.urlname ?? "main";
  return new PlatformChannel({
    id: new PlatformID(PLATFORM, creator.id, plugin.config.id),
    name: creator.title,
    thumbnail: creator.icon?.path ?? "",
    url: PLATFORM_URL + "/channel/" + creator.urlname + "/home/" + chanUrlname,
    description: creator.description,
    banner: creator.cover?.path ?? "",
    //links: not a thing,
    //subscribers: null
  });
}

function getChannelContents(url: string): ContentPager {
  if (!bridge.isLoggedIn()) {
    throw new LoginRequiredException("login to watch sauceplus");
  }
  const match = /channel\/([\w\d]+)\/home\/([\w\d]+)/.exec(url);
  const creatorUrl: string | undefined = match?.[1];

  if (creatorUrl === undefined) {
    throw new ScriptException("unreachable");
  }

  const api_url = new URL(CHANNEL_URL);
  api_url.searchParams.set("creatorURL[0]", creatorUrl);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const response: [Creator] = JSON.parse(
    local_http.GET(api_url.toString(), {}, true).body,
  );

  const limit = 10;
  const pager = new HomePager([response[0].id], limit);
  return pager;
}

//#endregion

//#region content
function isContentDetailsUrl(url: string) {
  return /^https?:\/\/(www\.)?sauceplus\.com\/post\/[\w\d]+$/.test(url);
}
function getContentDetails(url: string): PlatformContentDetails {
  if (!bridge.isLoggedIn()) {
    throw new LoginRequiredException("login to watch sauceplus");
  }
  const post_id: string | undefined = url.split("/").pop();

  if (post_id === undefined) {
    throw new ScriptException("unreachable");
  }

  const api_url = new URL(POST_URL);
  api_url.searchParams.set("id", post_id);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const response: Post = JSON.parse(
    local_http.GET(api_url.toString(), {}, true).body,
  );

  if (response.metadata.hasVideo) {
    if (
      response.metadata.hasAudio ||
      response.metadata.hasPicture ||
      response.metadata.hasGallery
    ) {
      bridge.toast("Mixed content not supported; only showing video");
    }
    const videos = create_video_descriptor(response.videoAttachments);
    const pvd = new PlatformVideoDetails({
      id: new PlatformID(PLATFORM, post_id, plugin.config.id),
      name: response.title,
      description: response.text,
      thumbnails: create_thumbnails(response.thumbnail),
      author: new PlatformAuthorLink(
        new PlatformID(PLATFORM, response.channel.creator, plugin.config.id),
        response.channel.title,
        ChannelUrlFromBlog(response),
        response.channel.icon?.path ?? "",
      ),
      datetime: new Date(response.releaseDate).getTime() / 1000,
      duration: response.metadata.videoDuration,
      // TODO: implement view count
      viewCount: HARDCODED_ZERO,
      url: PLATFORM_URL + "/post/" + response.id,
      shareUrl: PLATFORM_URL + "/post/" + response.id,
      isLive: false,
      video: videos,
      rating: new RatingLikesDislikes(response.likes, response.dislikes),
      subtitles: [],
      getContentRecommendations: () => getContentRecommendations(url),
    });
    log(pvd);
    return pvd;
  }

  if (response.metadata.hasAudio) {
    throw new ScriptException("Audio content not supported");
  }

  if (response.metadata.hasPicture) {
    throw new ScriptException("Picture content not supported");
  }

  if (response.metadata.hasGallery) {
    throw new ScriptException("Gallery content not supported");
  }

  throw new ScriptException("Content type not supported");
}
function create_video_source(
  duration: number,
  origin: string,
  variant: DeliveryVariant,
  media_type: MediaType,
): VideoUrlSource | HLSSource {
  switch (media_type) {
    case "flat":
      return new VideoUrlSource({
        width: variant.meta.video.width,
        height: variant.meta.video.height,
        container: variant.meta.video.mimeType,
        codec: variant.meta.video.codecSimple,
        name: variant.label,
        bitrate: variant.meta.video.bitrate.average,
        duration,
        url: `${origin}${variant.url}`,
        requestModifier: {
          headers: {
            Referer: "https://www.sauceplus.com/",
            Origin: "https://www.sauceplus.com",
          },
          options: {
            applyAuthClient: local_state.client_id,
          },
        },
      });
    case "hls.fmp4":
      return new HLSSource({
        name: variant.label,
        url: `${origin}${variant.url}`,
        duration,
        priority: true,
        language: Language.UNKNOWN,
        requestModifier: {
          headers: {
            Referer: "https://www.sauceplus.com/",
            Origin: "https://www.sauceplus.com",
          },
          options: {
            applyAuthClient: local_state.client_id,
          },
        },
      });
    case "hls.mpegts":
      return new HLSSource({
        name: variant.label,
        url: `${origin}${variant.url}`,
        duration,
        priority: false,
        language: Language.UNKNOWN,
        requestModifier: {
          headers: {
            Referer: "https://www.sauceplus.com/",
            Origin: "https://www.sauceplus.com",
          },
          options: {
            applyAuthClient: local_state.client_id,
          },
        },
      });
    default:
      throw assert_exhaustive(media_type, "unreachable");
  }
}
function create_video_descriptor(
  attachments: VideoAttachment[],
): VideoSourceDescriptor {
  const media_type = get_format(local_settings.stream_format);
  return new VideoSourceDescriptor(
    attachments.flatMap((video) => {
      const url = new URL(DELIVERY_URL);
      url.searchParams.set("scenario", "onDemand");
      url.searchParams.set("entityId", video.id);
      url.searchParams.set("outputKind", media_type);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const response: Delivery = JSON.parse(
        local_http.GET(url.toString(), { accept: "application/json" }, true)
          .body,
      );
      return response.groups.flatMap((group) => {
        return group.variants.map((variant) => {
          const origin = group.origins[0];
          if (origin === undefined) {
            throw new ScriptException("unreachable");
          }

          return create_video_source(
            video.duration,
            origin.url,
            variant,
            media_type,
          );
        });
      });
    }),
  );
}
//#endregion

//#region recommendations
function getContentRecommendations(url: string): ContentPager {
  const post_id = url.split("/post/")[1];
  if (!post_id) return new ContentPager([], false);
  const req_url = new URL(RELATED_URL);
  req_url.searchParams.set("id", post_id);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const posts: Post[] = JSON.parse(
    local_http.GET(req_url.toString(), { "User-Agent": USER_AGENT }, true).body,
  );
  const results = posts.map(create_platform_video).filter((x) => x !== null);
  return new ContentPager(results, false);
}
//#endregion

//#region comments
function getComments(url: string): CommentPager {
  const post_id = url.split("/post/")[1];
  if (!post_id) throw new ScriptException("invalid post url: " + url);
  return new SauceplusCommentPager(post_id, url, 20, 0);
}

function sp_comment_to_platform(
  c: SauceplusComment,
  context_url: string,
): PlatformComment {
  const thumb = c.user.profileImage?.path ?? "";
  const replies = c.replies;
  return new PlatformComment({
    contextUrl: context_url,
    author: new PlatformAuthorLink(
      new PlatformID(PLATFORM, c.user.id, plugin.config.id),
      c.user.username,
      "",
      thumb,
    ),
    message: c.text,
    replyCount: c.totalReplies,
    date: Math.floor(new Date(c.postDate).getTime() / 1000),
    rating: new RatingLikesDislikes(c.likes, c.dislikes),
    getReplies: () =>
      new CommentPager(
        replies.map((r) => sp_comment_to_platform(r, context_url)),
        false,
      ),
  });
}

class SauceplusCommentPager extends CommentPager {
  private offset: number;
  constructor(
    private readonly post_id: string,
    private readonly context_url: string,
    private readonly limit: number,
    initial_offset: number,
  ) {
    const url = new URL(COMMENT_URL);
    url.searchParams.set("blogPost", post_id);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("sortBy", "createdAt");
    url.searchParams.set("sortDirection", "DESC");
    if (initial_offset > 0)
      url.searchParams.set("fetchAfter", initial_offset.toString());

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw: SauceplusComment[] = JSON.parse(
      local_http.GET(url.toString(), { "User-Agent": USER_AGENT }, true).body,
    );
    super(
      raw.map((c) => sp_comment_to_platform(c, context_url)),
      raw.length === limit,
    );
    this.offset = initial_offset + raw.length;
  }
  override nextPage(this: SauceplusCommentPager): SauceplusCommentPager {
    return new SauceplusCommentPager(
      this.post_id,
      this.context_url,
      this.limit,
      this.offset,
    );
  }
  override hasMorePagers(this: SauceplusCommentPager): boolean {
    return this.hasMore;
  }
}
//#endregion

//#region playback
class SauceplusPlaybackTracker extends PlaybackTracker {
  constructor(private readonly attachment_ids: string[]) {
    super(60_000);
  }
  override onInit(seconds: number): void {
    this.report(seconds);
  }
  override onProgress(seconds: number, _is_playing: boolean): void {
    this.report(seconds);
  }
  override onConcluded(): void {}
  private report(seconds: number): void {
    for (const id of this.attachment_ids) {
      local_http.POST(
        PROGRESS_URL,
        JSON.stringify({
          id,
          contentType: "video",
          progress: Math.floor(seconds),
        }),
        { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        true,
      );
    }
  }
}

function getPlaybackTracker(url: string): PlaybackTracker | null {
  const post_id = url.split("/post/")[1];
  if (!post_id) return null;
  const api_url = new URL(POST_URL);
  api_url.searchParams.set("id", post_id);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const response: Post = JSON.parse(
    local_http.GET(api_url.toString(), { "User-Agent": USER_AGENT }, true).body,
  );
  if (!response.metadata.hasVideo || response.videoAttachments.length === 0)
    return null;
  return new SauceplusPlaybackTracker(
    response.videoAttachments.map((v) => v.id),
  );
}
//#endregion

//#region search
function searchSuggestions(query: string): string[] {
  if (!bridge.isLoggedIn()) {
    throw new LoginRequiredException("login to search sauceplus");
  }
  const creator_url = new URL(CREATOR_SEARCH_URL);
  creator_url.searchParams.set("search", query);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const creators: Creator[] = JSON.parse(
    local_http.GET(creator_url.toString(), { "User-Agent": USER_AGENT }, true).body,
  );
  const creator_titles = creators.map((c) => c.title);
  const video_titles = creators.flatMap((creator) => {
    const content_url = new URL(CREATOR_CONTENT_URL);
    content_url.searchParams.set("id", creator.id);
    content_url.searchParams.set("search", query);
    content_url.searchParams.set("limit", "5");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw: CreatorVideosResponse | Post[] = JSON.parse(
      local_http.GET(content_url.toString(), { "User-Agent": USER_AGENT }, true).body,
    );
    const posts: Post[] = Array.isArray(raw) ? raw : (raw.blogPosts ?? []);
    return posts.map((p) => p.title);
  });
  return [...new Set([...creator_titles, ...video_titles])];
}

function search(query: string): ContentPager {
  if (!bridge.isLoggedIn()) {
    throw new LoginRequiredException("login to search sauceplus");
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const creators: Creator[] = JSON.parse(
    local_http.GET(CREATOR_SEARCH_URL, { "User-Agent": USER_AGENT }, true).body,
  );
  const allResults = creators.flatMap(
    (creator) => new SearchContentPager(creator.id, query, 20).results,
  );
  return new ContentPager(allResults, false);
}

function searchChannelContents(channelUrl: string, query: string): ContentPager {
  if (!bridge.isLoggedIn()) {
    throw new LoginRequiredException("login to search sauceplus");
  }
  const match = /channel\/([\w\d]+)\/home\/([\w\d]+)/.exec(channelUrl);
  const creatorUrl = match?.[1];
  if (!creatorUrl) throw new ScriptException("unreachable");

  const api_url = new URL(CHANNEL_URL);
  api_url.searchParams.set("creatorURL[0]", creatorUrl);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const response: [Creator] = JSON.parse(
    local_http.GET(api_url.toString(), {}, true).body,
  );
  return new SearchContentPager(response[0].id, query, 20);
}

class SearchContentPager extends ContentPager {
  constructor(creator_id: string, query: string, limit: number) {
    const url = new URL(CREATOR_CONTENT_URL);
    url.searchParams.set("id", creator_id);
    url.searchParams.set("search", query);
    url.searchParams.set("limit", limit.toString());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw: CreatorVideosResponse | Post[] = JSON.parse(
      local_http.GET(url.toString(), { "User-Agent": USER_AGENT }, true).body,
    );
    const posts: Post[] = Array.isArray(raw) ? raw : (raw.blogPosts ?? []);
    super(
      posts.map(create_platform_video).filter((x) => x !== null),
      false,
    );
  }
  override nextPage(): ContentPager { return this; }
  override hasMorePagers(): boolean { return false; }
}

function searchChannels(query: string): ChannelPager {
  return new CreatorSearchPager(query);
}

class CreatorSearchPager extends ChannelPager {
  constructor(query: string) {
    const url = new URL(CREATOR_SEARCH_URL);
    url.searchParams.set("search", query);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const results: (Creator & { channels: Channel[] })[] = JSON.parse(
      local_http.GET(url.toString(), { "User-Agent": USER_AGENT }, true).body,
    );
    super(
      results.map((creator) => {
        const defaultChan = creator.channels?.find(
          (c) => c.id === creator.defaultChannel,
        );
        const chanUrlname =
          defaultChan?.urlname ?? creator.channels?.[0]?.urlname ?? "main";
        return new PlatformChannel({
          id: new PlatformID(PLATFORM, creator.id, plugin.config.id),
          name: creator.title,
          thumbnail: creator.icon?.path ?? "",
          url:
            PLATFORM_URL +
            "/channel/" +
            creator.urlname +
            "/home/" +
            chanUrlname,
          description: creator.description,
          banner: creator.cover?.path ?? "",
        });
      }),
      false,
    );
  }
  override nextPage(): ChannelPager {
    return this;
  }
  override hasMorePagers(): boolean {
    return false;
  }
}
//#endregion

//#region subscriptions
function getUserSubscriptions(): string[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const subs: SubscriptionResponse[] = JSON.parse(
    local_http.GET(SUBSCRIPTIONS_URL, { "User-Agent": USER_AGENT }, true).body,
  );
  return subs.flatMap((sub) => {
    const info_url = new URL(CREATOR_INFO_URL);
    info_url.searchParams.set("id", sub.creator);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const creator: Creator & { channels: Channel[] } = JSON.parse(
      local_http.GET(info_url.toString(), { "User-Agent": USER_AGENT }, true)
        .body,
    );
    if (!creator.channels?.length) {
      const defaultChan = creator.defaultChannel;
      return [
        PLATFORM_URL + "/channel/" + creator.urlname + "/home/" + defaultChan,
      ];
    }
    return creator.channels.map(
      (chan) =>
        PLATFORM_URL + "/channel/" + creator.urlname + "/home/" + chan.urlname,
    );
  });
}
//#endregion

//#region utilities
/**
 * Converts seconds to the timestamp format used in WebVTT
 * @param seconds
 * @returns
 */
function milliseconds_to_WebVTT_timestamp(milliseconds: number) {
  return new Date(milliseconds).toISOString().substring(11, 23);
}
function get_format(setting: StreamFormat): MediaType {
  switch (setting) {
    case StreamFormat.HLS:
      return "hls.fmp4";
    case StreamFormat.LegacyHLS:
      return "hls.mpegts";
    case StreamFormat.FlatMP4:
      return "flat";
    default:
      throw assert_exhaustive(setting, "unreachable");
  }
}
function assert_exhaustive(value: never): void;
function assert_exhaustive(
  value: never,
  exception_message: string,
): ScriptException;
function assert_exhaustive(
  value: never,
  exception_message?: string,
): ScriptException | undefined {
  log(["Sauceplus log:", value]);
  if (exception_message !== undefined) {
    return new ScriptException(exception_message);
  }
  return;
}
//#endregion

console.log(
  milliseconds_to_WebVTT_timestamp,
  HARDCODED_EMPTY_STRING,
  EMPTY_AUTHOR,
);
// export statements are removed during build step
// used for unit testing in script.test.ts
export { milliseconds_to_WebVTT_timestamp };
