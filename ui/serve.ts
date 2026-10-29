const ROOT = `${import.meta.dir}/build`;
const PORT = Number(Bun.env.PORT ?? 3000);
const IMMUTABLE = "/_app/immutable/";

const fallback = Bun.file(`${ROOT}/index.html`);

function headersFor(pathname: string): HeadersInit {
  if (pathname.startsWith(IMMUTABLE)) {
    return { "Cache-Control": "public, max-age=31536000, immutable" };
  }
  return { "Cache-Control": "no-cache" };
}

Bun.serve({
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname.includes("..")) {
      return new Response("Bad Request", { status: 400 });
    }

    const file = Bun.file(`${ROOT}${pathname}`);
    if (await file.exists()) {
      return new Response(file, { headers: headersFor(pathname) });
    }

    return new Response(fallback, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  },
  idleTimeout: 30,
  port: PORT,
});
