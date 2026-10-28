/* Static-site shim: serve /api/* from pre-rendered JSON (GitHub Pages). */
(function () {
  var origFetch = window.fetch.bind(window);
  window.__STATIC_SNAPSHOT__ = true;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method = ((init && init.method) || "GET").toUpperCase();
    if (url.indexOf("/api/") === 0) {
      if (method !== "GET") {
        return Promise.resolve(new Response(JSON.stringify({ ok: true, static: true }), {
          status: 200, headers: { "Content-Type": "application/json" }
        }));
      }
      var rest = url.slice(5).split("?")[0].split("#")[0];
      return origFetch("api/" + rest + ".json", init);
    }
    return origFetch(input, init);
  };
})();
