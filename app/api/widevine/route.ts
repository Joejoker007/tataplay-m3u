import { NextRequest, NextResponse } from "next/server"
import { isLoggedIn, getFetcherData, generateJWT } from "@/lib/tataplay"

export async function GET(request: NextRequest) {
  if (!(await isLoggedIn())) {
    return new NextResponse("Log in first.", { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id || !/^\d+$/.test(id)) {
    return new NextResponse("Invalid ID", { status: 400 })
  }

  const fetcherData = JSON.parse(await getFetcherData())
  const channelData = fetcherData.data.channels.find(
    (ch: { id: string }) => ch.id === id
  )

  if (!channelData) {
    return new NextResponse("Data not found for channel id.", { status: 404 })
  }

  const licenseUrl: string | undefined = channelData.license_url
  if (!licenseUrl) {
    return new NextResponse("An error occurred.", { status: 500 })
  }

  try {
    const jwt = await generateJWT(id)
    if (jwt) {
      const finalUrl = `${licenseUrl}&ls_session=${jwt}`
      return NextResponse.redirect(finalUrl, 307)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "An error occurred."
    return new NextResponse(msg, { status: 500 })
  }

  return new NextResponse("An error occurred.", { status: 500 })
}
