import { iconResponse } from "@/lib/icon-art";

const SIZES = { "192": 192, "512": 512, "maskable-512": 512 } as const;

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await ctx.params;
  const px = SIZES[size as keyof typeof SIZES];
  if (!px) return new Response("Not found", { status: 404 });
  return iconResponse(px, { maskable: size.startsWith("maskable") });
}
