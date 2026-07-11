var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var MAX_MSG = 4e3;
var MAX_META = 200;
var PER_DAY = 5;
function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGIN || "").split(",");
  const ok = allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(corsHeaders, "corsHeaders");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env, request.headers.get("Origin") || "");
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const stub = env.INBOX.get(env.INBOX.idFromName("inbox"));
    if (url.pathname === "/send" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response("bad json", { status: 400, headers: cors });
      }
      const fakeOk = /* @__PURE__ */ __name(() => new Response(JSON.stringify({ ok: true }), { headers: cors }), "fakeOk");
      const origin = request.headers.get("Origin") || "";
      if (!(env.ALLOWED_ORIGIN || "").split(",").includes(origin)) return fakeOk();
      if (String(body.website || "") !== "") return fakeOk();
      if (typeof body.t === "number" && body.t >= 0 && body.t < 3e3) return fakeOk();
      const msg = String(body.message || "").trim();
      if (msg.length < 5 || msg.length > MAX_MSG) return new Response("message length", { status: 400, headers: cors });
      const ip = request.headers.get("CF-Connecting-IP") || "?";
      const ua = request.headers.get("User-Agent") || "?";
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|" + ua));
      const sender = [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
      const res = await stub.fetch("https://do/send", {
        method: "POST",
        body: JSON.stringify({
          name: String(body.name || "").slice(0, MAX_META),
          email: String(body.email || "").slice(0, MAX_META),
          topic: String(body.topic || "general").slice(0, 40),
          message: msg,
          sender,
          ts: Date.now()
        })
      });
      return new Response(await res.text(), { status: res.status, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/inbox" && request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      if (!env.INBOX_TOKEN || token !== env.INBOX_TOKEN) return new Response("nope", { status: 403 });
      return Response.redirect("https://trymstene.com/inbox/#token=" + encodeURIComponent(token), 302);
    }
    if (url.pathname === "/messages" && request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      if (!env.INBOX_TOKEN || token !== env.INBOX_TOKEN) return new Response("nope", { status: 403, headers: cors });
      const res = await stub.fetch("https://do/list");
      return new Response(await res.text(), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (url.pathname === "/delete" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response("bad json", { status: 400, headers: cors });
      }
      if (!env.INBOX_TOKEN || String(body.token || "") !== env.INBOX_TOKEN) return new Response("nope", { status: 403, headers: cors });
      const keys = Array.isArray(body.keys) ? body.keys.filter((k) => typeof k === "string" && k.startsWith("m:")).slice(0, 128) : [];
      const res = await stub.fetch("https://do/delete", { method: "POST", body: JSON.stringify({ keys }) });
      return new Response(await res.text(), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response("not found", { status: 404, headers: cors });
  }
};
var ContactInbox = class {
  static {
    __name(this, "ContactInbox");
  }
  constructor(state) {
    this.state = state;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/send") {
      const m = await request.json();
      const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
      const rlKey = "rl:" + m.sender + ":" + day;
      const used = await this.state.storage.get(rlKey) || 0;
      if (used >= PER_DAY) return new Response(JSON.stringify({ ok: false, err: "slow down" }), { status: 429 });
      await this.state.storage.put(rlKey, used + 1);
      await this.state.storage.put("m:" + String(m.ts).padStart(15, "0") + ":" + m.sender.slice(0, 4), m);
      return new Response(JSON.stringify({ ok: true }));
    }
    if (url.pathname === "/list") {
      const list = await this.state.storage.list({ prefix: "m:", reverse: true, limit: 200 });
      return new Response(JSON.stringify([...list.entries()].map(([key, m]) => ({ key, ...m }))), { headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/delete") {
      const { keys } = await request.json();
      let deleted = 0;
      if (Array.isArray(keys) && keys.length) deleted = await this.state.storage.delete(keys);
      return new Response(JSON.stringify({ ok: true, deleted }));
    }
    return new Response("not found", { status: 404 });
  }
};

// ../../../Users/trym/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../Users/trym/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-6Dfi7j/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../Users/trym/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-6Dfi7j/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  ContactInbox,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
