import { NextRequest, NextResponse } from "next/server"
import {
  isLoggedIn,
  getFetcherData,
  getHmac,
  fetchContent,
  fetchBinaryContent,
  extractKid,
} from "@/lib/tataplay"

export async function GET(request: NextRequest) {
  if (!(await isLoggedIn())) {
    return new NextResponse("Log in first.", { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id || !/^\d+$/.test(id)) {
    return new NextResponse("Invalid ID", { status: 400 })
  }

  let catchupRequest = false
  let beginFormatted = ""
  let endFormatted = ""
  const beginParam = searchParams.get("begin")
  const endParam = searchParams.get("end")

  if (beginParam && endParam) {
    catchupRequest = true
    const beginTs = parseInt(beginParam)
    const endTs = parseInt(endParam)
    beginFormatted = formatUTC(beginTs)
    endFormatted = formatUTC(endTs)
  }

  const fetcherData = JSON.parse(await getFetcherData())
  const channelData = fetcherData.data.channels.find(
    (ch: { id: string }) => ch.id === id
  )

  if (!channelData) {
    return new NextResponse("Data not found for channel", { status: 404 })
  }

  if (!channelData.is_catchup_available) {
    catchupRequest = false
  }

  let manifestUrl: string = channelData.manifest_url
  if (!manifestUrl.includes("bpaita")) {
    return NextResponse.redirect(manifestUrl)
  }

  const hmac = await getHmac(id)
  if (!hmac) {
    return new NextResponse("Error fetching HMAC", { status: 500 })
  }

  manifestUrl = manifestUrl.replace("bpaita", "bpaicatchupta")
  const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf("/"))
  manifestUrl += `?${hmac}`
  if (catchupRequest) {
    manifestUrl += `&begin=${beginFormatted}&end=${endFormatted}`
  }

  const originalMpdContent = await fetchContent(manifestUrl)
  if (!originalMpdContent) {
    return new NextResponse("Failed to fetch MPD", { status: 500 })
  }

  let mpdContent = originalMpdContent

  // Fix SegmentTemplate URLs
  mpdContent = mpdContent.replace(
    /<SegmentTemplate\s+.*?>/g,
    (match: string) => {
      let cleaned = match.replace(
        /(\$Number\$\.m4s|\$RepresentationID\$\.dash)[^"]*/g,
        "$1"
      )
      cleaned = cleaned
        .replace("$Number$.m4s", `$Number$.m4s?${hmac}`)
        .replace("$RepresentationID$.dash", `$RepresentationID$.dash?${hmac}`)
      return cleaned
    }
  )

  // Fix BaseURL
  mpdContent = mpdContent.replace(
    /<BaseURL>.*<\/BaseURL>/g,
    `<BaseURL>${baseUrl}/dash/</BaseURL>`
  )

  mpdContent = mpdContent.replace(
    "<!-- Created with Broadpeak BkS350 Origin Packager  (version=1.12.8-28913) -->",
    "<!-- Created by @YGX_WORLD  (version=5.3) -->"
  )

  // Add PSSH if missing
  if (!mpdContent.includes("pssh") && !mpdContent.includes("cenc:default_KID")) {
    const widevinePssh = await extractWidevinePsshFromMpd(
      mpdContent,
      baseUrl,
      catchupRequest
    )

    if (widevinePssh) {
      const newContent = `<!-- Common Encryption -->\n      <ContentProtection schemeIdUri="urn:mpeg:dash:mp4protection:2011" value="cenc" cenc:default_KID="${widevinePssh.kid}"/>`
      mpdContent = mpdContent.replace(
        '<ContentProtection value="cenc" schemeIdUri="urn:mpeg:dash:mp4protection:2011"/>',
        newContent
      )

      mpdContent = mpdContent.replace(
        /<ContentProtection\s+schemeIdUri="(urn:[^"]+)"\s+value="Widevine"\/>/g,
        (_match: string, uri: string) =>
          `<!--Widevine-->\n      <ContentProtection schemeIdUri="${uri}" value="Widevine">\n        <cenc:pssh>${widevinePssh.pssh}</cenc:pssh>\n      </ContentProtection>`
      )

      mpdContent = mpdContent.replace(
        'xmlns="urn:mpeg:dash:schema:mpd:2011"',
        'xmlns="urn:mpeg:dash:schema:mpd:2011" xmlns:cenc="urn:mpe:cenc:2013"'
      )
    }
  }

  return new NextResponse(mpdContent, {
    headers: {
      "Content-Type": "application/dash+xml",
      "Content-Disposition": 'attachment; filename="mpd_script_by_@ygx_world.mpd"',
    },
  })
}

function formatUTC(timestamp: number): string {
  const d = new Date(timestamp * 1000)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`
}

async function extractWidevinePsshFromMpd(
  content: string,
  baseUrl: string,
  catchupRequest: boolean
): Promise<{ pssh: string; kid: string } | null> {
  // Simple XML parsing for audio segments
  const adaptationSets = content.match(/<AdaptationSet[^>]*contentType="audio"[^>]*>[\s\S]*?<\/AdaptationSet>/g)
  if (!adaptationSets) return null

  for (const set of adaptationSets) {
    const representations = set.match(/<Representation[^>]*>[\s\S]*?<\/Representation>/g)
    if (!representations) continue

    for (const rep of representations) {
      const repIdMatch = rep.match(/id="([^"]*)"/)
      const repId = repIdMatch?.[1]
      if (!repId) continue

      const templateMatch = rep.match(/<SegmentTemplate[^>]*/)
      if (!templateMatch) continue

      const startNumberMatch = templateMatch[0].match(/startNumber="(\d+)"/)
      const startNumber = startNumberMatch ? parseInt(startNumberMatch[1]) : 0

      const timelineMatch = rep.match(/<S[^>]*r="(\d+)"/)
      const r = timelineMatch ? parseInt(timelineMatch[1]) : 0

      const mediaMatch = templateMatch[0].match(/media="([^"]*)"/)
      if (!mediaMatch) continue

      const num = catchupRequest ? startNumber : startNumber + r
      const media = mediaMatch[1]
        .replace("$RepresentationID$", repId)
        .replace("$Number$", num.toString())

      const url = `${baseUrl}/dash/${media}`
      const buf = await fetchBinaryContent(url)
      if (buf) {
        const hexContent = buf.toString("hex")
        return extractKid(hexContent)
      }
    }
  }
  return null
}
