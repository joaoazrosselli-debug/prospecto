// @ts-expect-error Vite imports the authored studio document as text.
import document from "../studio.html?raw";
export const dynamic = "force-dynamic";
export function GET() {
  return new Response(document, {headers: {"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
}
