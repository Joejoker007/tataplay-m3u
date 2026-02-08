import { NextRequest, NextResponse } from "next/server"
import { isLoggedIn, getFetcherData } from "@/lib/tataplay"

export async function GET(request: NextRequest) {
  if (!(await isLoggedIn())) {
    return new NextResponse("Log in first.", { status: 403 })
  }

  const jsonData = await getFetcherData()
  const data = JSON.parse(jsonData)

  const proto = request.headers.get("x-forwarded-proto") ?? "http"
  const host = request.headers.get("host") ?? "localhost:3000"
  const baseMpdUrl = `${proto}://${host}/api/manifest`
  const baseWvUrl = `${proto}://${host}/api/widevine`

  const userAgent = request.headers.get("user-agent") ?? ""

  let headers: string
  let ctag: string | null

  if (userAgent.toLowerCase().includes("tivimate")) {
    headers =
      '|User-Agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.69.69.69 YGX/537.36"&Origin="https://watch.tataplay.com"&Referer="https://watch.tataplay.com/"'
    ctag = 'catchup-type="append" catchup-days="8" catchup-source="&begin={utc}&end={utcend}"'
  } else if (
    userAgent === "Mozilla/5.0 (Windows NT 10.0; rv:78.0) Gecko/20100101 Firefox/78.0"
  ) {
    headers =
      "%7CUser-Agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.69.69.69 YGX/537.36&Origin=https://watch.tataplay.com/&Referer=https://watch.tataplay.com/"
    ctag = null
  } else {
    headers =
      "|User-Agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.69.69.69 YGX/537.36&Origin=https://watch.tataplay.com&Referer=https://watch.tataplay.com/"
    ctag = 'catchup-type="append" catchup-days="8" catchup-source="&begin={utc}&end={utcend}"'
  }

  let m3uContent = '#EXTM3U x-tvg-url="https://avkb.short.gy/epg.xml.gz"\n#Script by @YGX_WORLD\n\n'

  for (const channel of data.data.channels) {
    const id = channel.id
    const name = channel.name
    const logo = channel.logo_url
    const genre = channel.primaryGenre
    const mpdUrl = `${baseMpdUrl}?id=${id}`
    const wvUrl = `${baseWvUrl}?id=${id}`

    m3uContent += `#KODIPROP:inputstream.adaptive.license_type=com.widevine.alpha\n`
    m3uContent += `#KODIPROP:inputstream.adaptive.license_key=${wvUrl}\n`
    m3uContent += `#KODIPROP:inputstream.adaptive.manifest_type=mpd\n`
    m3uContent += `#EXTINF:-1 tvg-id="ts${id}" ${ctag ?? ""} group-title="${genre}" tvg-logo="https://mediaready.videoready.tv/tatasky-epg/image/fetch/f_auto,fl_lossy,q_auto,h_250,w_250/${logo}",${name}\n`
    m3uContent += `${mpdUrl}${headers}\n\n`
  }

  return new NextResponse(m3uContent, {
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": 'attachment; filename="playlist.m3u"',
    },
  })
}
