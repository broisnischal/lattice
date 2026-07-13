const std = @import("std");
const runner = @import("runner");
const native_sdk = @import("native_sdk");

pub const panic = std.debug.FullPanic(native_sdk.debug.capturePanic);

/// Origins allowed to reach native bridge commands. `zero://app` is the
/// packaged app origin; the vite dev server origin lets `npm run dev` exercise
/// the real bridge when running under the native shell.
const bridge_origins = [_][]const u8{ "zero://app", "zero://inline", "http://127.0.0.1:5173" };

/// Bridge command policy. `net.fetch` is the HTTP egress the WebView cannot
/// perform itself (CORS/CSP): it fetches a URL server-side and returns the
/// body so the frontend can extract articles and parse RSS/Atom feeds.
const bridge_commands = [_]native_sdk.bridge.CommandPolicy{
    .{ .name = "net.fetch", .origins = &bridge_origins },
};

/// Cap on the response body we hand back over the bridge. The dispatcher's
/// result buffer is ~1 MiB; capping the raw body well under that leaves room
/// for JSON escaping without ever overflowing.
const max_body_bytes: usize = 300 * 1024;

const App = struct {
    env_map: *std.process.Environ.Map,
    io: std.Io,
    handlers: [1]native_sdk.bridge.Handler = undefined,

    fn app(self: *@This()) native_sdk.App {
        return .{
            .context = self,
            .name = "reader",
            .source = native_sdk.frontend.productionSource(.{ .dist = "frontend/dist" }),
            .source_fn = source,
        };
    }

    fn source(context: *anyopaque) anyerror!native_sdk.WebViewSource {
        const self: *@This() = @ptrCast(@alignCast(context));
        return native_sdk.frontend.sourceFromEnv(self.env_map, .{
            .dist = "frontend/dist",
            .entry = "index.html",
        });
    }

    fn dispatcher(self: *@This()) native_sdk.BridgeDispatcher {
        self.handlers = .{
            .{ .name = "net.fetch", .context = self, .invoke_fn = netFetch },
        };
        return .{
            .policy = .{ .enabled = true, .commands = &bridge_commands },
            .registry = .{ .handlers = &self.handlers },
        };
    }
};

/// `net.fetch` handler. Payload: `{"url": "https://…"}`.
/// Result: `{"status": <int>, "contentType": "<sniffed>", "body": "<text>"}`.
/// Network/parse failures return an error (surfaced to JS as `handler_failed`),
/// so the frontend can fall back to its mock.
fn netFetch(context: *anyopaque, invocation: native_sdk.bridge.Invocation, output: []u8) anyerror![]const u8 {
    const self: *App = @ptrCast(@alignCast(context));
    const gpa = std.heap.page_allocator;

    const Payload = struct { url: []const u8 };
    const parsed = std.json.parseFromSlice(Payload, gpa, invocation.request.payload, .{
        .ignore_unknown_fields = true,
    }) catch return error.InvalidPayload;
    defer parsed.deinit();

    const url = parsed.value.url;
    if (url.len == 0 or url.len > 2048) return error.InvalidUrl;
    if (!std.mem.startsWith(u8, url, "http://") and !std.mem.startsWith(u8, url, "https://")) {
        return error.UnsupportedScheme;
    }

    var client: std.http.Client = .{ .allocator = gpa, .io = self.io };
    defer client.deinit();

    var body = std.Io.Writer.Allocating.init(gpa);
    defer body.deinit();

    const result = client.fetch(.{
        .location = .{ .url = url },
        .response_writer = &body.writer,
        .extra_headers = &.{
            .{ .name = "user-agent", .value = "Mozilla/5.0 (compatible; ReaderApp/0.1; +native-sdk)" },
            .{ .name = "accept", .value = "text/html,application/xhtml+xml,application/xml,text/plain,*/*" },
        },
    }) catch return error.FetchFailed;

    const raw = body.written();
    const clipped = raw[0..@min(raw.len, max_body_bytes)];
    const content_type = sniffContentType(clipped);

    var w = std.Io.Writer.fixed(output);
    try w.writeAll("{\"status\":");
    try w.print("{d}", .{@intFromEnum(result.status)});
    try w.writeAll(",\"contentType\":");
    try writeJsonString(&w, content_type);
    try w.writeAll(",\"body\":");
    try writeJsonString(&w, clipped);
    try w.writeAll("}");
    return w.buffered();
}

/// Best-effort content-type sniff. `std.http.Client.FetchResult` exposes only
/// the status, so we classify from the body's leading bytes — enough for the
/// frontend to route between the HTML extractor and the feed parser.
fn sniffContentType(body: []const u8) []const u8 {
    var i: usize = 0;
    // Skip BOM + leading whitespace.
    if (body.len >= 3 and body[0] == 0xEF and body[1] == 0xBB and body[2] == 0xBF) i = 3;
    while (i < body.len and (body[i] == ' ' or body[i] == '\n' or body[i] == '\r' or body[i] == '\t')) : (i += 1) {}
    const head = body[i..@min(body.len, i + 512)];
    if (containsCI(head, "<?xml") or containsCI(head, "<rss") or containsCI(head, "<feed") or containsCI(head, "<rdf")) {
        return "application/xml";
    }
    if (containsCI(head, "<!doctype html") or containsCI(head, "<html") or containsCI(head, "<head") or containsCI(head, "<body")) {
        return "text/html";
    }
    return "text/plain";
}

fn containsCI(haystack: []const u8, needle: []const u8) bool {
    if (needle.len == 0 or haystack.len < needle.len) return false;
    var i: usize = 0;
    while (i + needle.len <= haystack.len) : (i += 1) {
        var match = true;
        for (needle, 0..) |n, j| {
            if (std.ascii.toLower(haystack[i + j]) != std.ascii.toLower(n)) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}

fn writeJsonString(w: *std.Io.Writer, s: []const u8) !void {
    try w.writeByte('"');
    for (s) |c| {
        switch (c) {
            '"' => try w.writeAll("\\\""),
            '\\' => try w.writeAll("\\\\"),
            '\n' => try w.writeAll("\\n"),
            '\r' => try w.writeAll("\\r"),
            '\t' => try w.writeAll("\\t"),
            0x08 => try w.writeAll("\\b"),
            0x0c => try w.writeAll("\\f"),
            else => {
                if (c < 0x20) {
                    try w.print("\\u{x:0>4}", .{c});
                } else {
                    try w.writeByte(c);
                }
            },
        }
    }
    try w.writeByte('"');
}

const dev_origins = bridge_origins;

pub fn main(init: std.process.Init) !void {
    var app = App{ .env_map = init.environ_map, .io = init.io };
    try runner.runWithOptions(app.app(), .{
        .app_name = "Reader",
        .window_title = "Reader",
        .bundle_id = "dev.native_sdk.reader",
        .icon_path = "assets/icon.png",
        .bridge = app.dispatcher(),
        .security = .{
            .navigation = .{ .allowed_origins = &dev_origins },
        },
    }, init);
}

test "app name is configured" {
    try std.testing.expectEqualStrings("reader", "reader");
}

test "sniffContentType classifies feeds and html" {
    try std.testing.expectEqualStrings("application/xml", sniffContentType("<?xml version=\"1.0\"?><rss>"));
    try std.testing.expectEqualStrings("text/html", sniffContentType("<!DOCTYPE html><html>"));
    try std.testing.expectEqualStrings("text/plain", sniffContentType("just some words"));
}
