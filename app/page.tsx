import { isLoggedIn } from "@/lib/tataplay"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import HomeDashboard from "@/components/home-dashboard"

export default async function HomePage() {
  const loggedIn = await isLoggedIn()
  if (!loggedIn) {
    redirect("/login")
  }

  const headersList = await headers()
  const host = headersList.get("host") ?? "localhost:3000"
  const proto = headersList.get("x-forwarded-proto") ?? "http"
  const playlistUrl = `${proto}://${host}/api/playlist`

  return <HomeDashboard playlistUrl={playlistUrl} />
}
