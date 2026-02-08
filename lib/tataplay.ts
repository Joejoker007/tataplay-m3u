import { promises as fs } from "fs"
import path from "path"
import crypto from "crypto"

const CREDS_FILE = path.join(process.cwd(), "app-data", "creds.json")
const DATA_FILE = path.join(process.cwd(), "app-data", "data", "data.json")
const CACHE_DIR = path.join(process.cwd(), "app-data", "cache")

const DEVICE_DETAILS = JSON.stringify({
  pl: "web",
  os: "WINDOWS",
  lo: "en-us",
  app: "1.48.8",
  dn: "PC",
  bv: 116,
  bn: "OPERA",
  device_id: "7683d93848b0f472c508e38b1827038a",
  device_type: "WEB",
  device_platform: "PC",
  device_category: "open",
  manufacturer: "WINDOWS_OPERA_116",
  model: "PC",
  sname: "",
})

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0"

// --- Credentials ---

export async function isLoggedIn(): Promise<boolean> {
  try {
    await fs.access(CREDS_FILE)
    return true
  } catch {
    return false
  }
}

export async function saveCreds(data: Record<string, unknown>): Promise<void> {
  const dir = path.dirname(CREDS_FILE)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(CREDS_FILE, JSON.stringify(data))
}

export async function getCreds() {
  if (!(await isLoggedIn())) {
    throw new Error("Not logged in.")
  }
  const data = JSON.parse(await fs.readFile(CREDS_FILE, "utf-8"))
  return {
    accessToken: data.data.accessToken as string,
    sid: data.data.userDetails.sid as string,
    sname: data.data.userDetails.sName as string,
    profileId: data.data.userProfile.id as string,
  }
}

// --- Cache ---

async function cacheUpdate(utility: string, content: string, id: string, exp: number) {
  const cacheDir = path.join(CACHE_DIR, utility)
  await fs.mkdir(cacheDir, { recursive: true })
  const cacheFile = path.join(cacheDir, `${id}.json`)
  await fs.writeFile(cacheFile, JSON.stringify({ content, exp }))
}

async function cacheRetrieve(utility: string, id: string): Promise<string | false> {
  const cacheFile = path.join(CACHE_DIR, utility, `${id}.json`)
  try {
    const raw = await fs.readFile(cacheFile, "utf-8")
    const data = JSON.parse(raw)
    if (!data.content || !data.exp) return false
    if (Date.now() / 1000 > data.exp) {
      await fs.unlink(cacheFile).catch(() => {})
      return false
    }
    return data.content
  } catch {
    return false
  }
}

// --- API helpers ---

export async function generateOtp(sid: string) {
  const res = await fetch("https://tm.tapi.videoready.tv/login-service/pub/api/v2/generate/otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      "User-Agent": USER_AGENT,
      device_details: DEVICE_DETAILS,
      Referer: "https://watch.tataplay.com/",
      Origin: "https://watch.tataplay.com",
    },
    body: JSON.stringify({ sid, rmn: "" }),
  })
  return res.json()
}

export async function verifyOtp(sid: string, encryptedRmn: string, otp: string) {
  const res = await fetch("https://tm.tapi.videoready.tv/login-service/pub/api/v3/login/ott", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      "User-Agent": USER_AGENT,
      device_details: DEVICE_DETAILS,
      Referer: "https://watch.tataplay.com/",
      Origin: "https://watch.tataplay.com",
    },
    body: JSON.stringify({
      rmn: encryptedRmn,
      sid,
      authorization: otp,
      loginOption: "OTP",
    }),
  })
  return res.json()
}

// --- Fetcher Data ---

export async function getFetcherData(): Promise<string> {
  const dir = path.dirname(DATA_FILE)
  await fs.mkdir(dir, { recursive: true })

  const cacheTime = 86400 * 1000 // 24h in ms
  try {
    const stat = await fs.stat(DATA_FILE)
    if (Date.now() - stat.mtimeMs < cacheTime) {
      const cached = await fs.readFile(DATA_FILE, "utf-8")
      if (cached) return cached
    }
  } catch {
    // no cache
  }

  const res = await fetch("https://api.ygxworld.workers.dev/fetcher.json", {
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error("Error while fetching fetcher data.")
  const text = await res.text()
  await fs.writeFile(DATA_FILE, text)
  return text
}

// --- Fetch content helper ---

export async function fetchContent(url: string, headOnly = false): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: headOnly ? "HEAD" : "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.69.69.69 YGX/537.36",
        Origin: "https://watch.tataplay.com",
        Referer: "https://watch.tataplay.com/",
      },
      redirect: headOnly ? "manual" : "follow",
    })
    if (headOnly) {
      // We need the response headers as text like PHP does
      const headers = Array.from(res.headers.entries())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
      return headers
    }
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

export async function fetchBinaryContent(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.69.69.69 YGX/537.36",
        Origin: "https://watch.tataplay.com",
        Referer: "https://watch.tataplay.com/",
      },
    })
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

// --- Channel Details ---

async function channelDetails(id: string) {
  const creds = await getCreds()
  const url = `https://tm.tapi.videoready.tv/content-detail/pub/api/v6/channels/${id}?platform=WEB`
  const deviceDetails = JSON.stringify({
    pl: "web",
    os: "WINDOWS",
    lo: "en-us",
    app: "1.44.7",
    dn: "PC",
    bv: 129,
    bn: "CHROME",
    device_id: "",
    device_type: "WEB",
    device_platform: "PC",
    device_category: "open",
    manufacturer: "WINDOWS_CHROME_129",
    model: "PC",
    sname: creds.sname,
  })

  const res = await fetch(url, {
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization: `bearer ${creds.accessToken}`,
      "cache-control": "no-cache",
      device_details: deviceDetails,
      platform: "web",
      pragma: "no-cache",
      profileid: creds.profileId,
      Referer: "https://watch.tataplay.com/",
      Origin: "https://watch.tataplay.com",
      "User-Agent": USER_AGENT,
    },
  })

  if (!res.ok) throw new Error("Error fetching channel details.")
  const json = await res.json()
  const entitlements: string[] = json.data.detail.entitlements
  const specialId = "1000001274"
  const epids: { epid: string; bid: string }[] = []

  if (entitlements.includes(specialId)) {
    epids.push({ epid: "Subscription", bid: specialId })
  } else if (entitlements.length > 0) {
    epids.push({ epid: "Subscription", bid: entitlements[0] })
  }
  return epids
}

// --- JWT ---

function decodeJWT(jwt: string) {
  const parts = jwt.split(".")
  if (parts.length !== 3) return null
  const payload = Buffer.from(parts[1], "base64url").toString("utf-8")
  return JSON.parse(payload)
}

export async function generateJWT(channelId: string): Promise<string | null> {
  const cached = await cacheRetrieve("jwt", channelId)
  if (cached) return cached

  const epids = await channelDetails(channelId)
  const creds = await getCreds()
  const url = "https://tm.tapi.videoready.tv/auth-service/v3/sampling/token-service/token"

  const deviceDetails = JSON.stringify({
    pl: "web",
    os: "WINDOWS",
    lo: "en-us",
    app: "1.44.7",
    dn: "PC",
    bv: 129,
    bn: "CHROME",
    device_id: "7683d93848b0f472c508e38b1827038a",
    device_type: "WEB",
    device_platform: "PC",
    device_category: "open",
    manufacturer: "WINDOWS_CHROME_129",
    model: "PC",
    sname: creds.sname,
  })

  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
      authorization: `bearer ${creds.accessToken}`,
      "content-type": "application/json",
      device_details: deviceDetails,
      locale: "ENG",
      platform: "web",
      pragma: "no-cache",
      profileid: creds.profileId,
      "x-device-platform": "PC",
      "x-device-type": "WEB",
      "x-subscriber-id": creds.sid,
      "x-subscriber-name": creds.sname,
      Referer: "https://watch.tataplay.com/",
      Origin: "https://watch.tataplay.com",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      action: "stream",
      epids,
      samplingExpiry: "ucPtCl63EsD1qBrlIhY9nw==#v2",
    }),
  })

  const json = await res.json()
  if (json.code === 0 && json.data?.token) {
    const jwt = json.data.token
    const jwtData = decodeJWT(jwt)
    if (jwtData?.exp) {
      await cacheUpdate("jwt", jwt, channelId, jwtData.exp)
    }
    return jwt
  }
  throw new Error(json.message ?? "Unknown error generating JWT.")
}

// --- HMAC ---

export async function getHmac(id: string): Promise<string | null> {
  const cached = await cacheRetrieve("hmac", id)
  if (cached) return cached

  const creds = await getCreds()
  const deviceDetails = JSON.stringify({
    pl: "web",
    os: "WINDOWS",
    lo: "en-us",
    app: "1.44.7",
    dn: "PC",
    bv: 129,
    bn: "CHROME",
    device_id: "7683d93848b0f472c508e38b1827038a",
    device_type: "WEB",
    device_platform: "PC",
    device_category: "open",
    manufacturer: "WINDOWS_CHROME_129",
    model: "PC",
    sname: creds.sname,
  })

  const res = await fetch(
    `https://tm.tapi.videoready.tv/digital-feed-services/api/partner/cdn/player/details/LIVE/${id}`,
    {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9,en-IN;q=0.8",
        authorization: creds.accessToken,
        "content-type": "application/json",
        device_details: deviceDetails,
        kp: "false",
        locale: "ENG",
        origin: "https://watch.tataplay.com",
        platform: "web",
        profileid: creds.profileId,
        referer: "https://watch.tataplay.com/",
        "user-agent": USER_AGENT,
      },
    }
  )

  if (!res.ok) return null
  const json = await res.json()
  const encryptedToken: string = json.data.dashWidewinePlayUrl

  // AES-128-ECB decrypt
  const key = "aesEncryptionKey"
  const encData = Buffer.from(encryptedToken.split("#")[0], "base64")
  const decipher = crypto.createDecipheriv("aes-128-ecb", Buffer.from(key), null)
  decipher.setAutoPadding(true)
  const decrypted = Buffer.concat([decipher.update(encData), decipher.final()]).toString("utf-8")

  // Fetch headers to get hdntl
  const headerResponse = await fetchContent(decrypted, true)
  if (!headerResponse) return null

  const hdntlMatch = headerResponse.match(/hdntl=(.*?)(;|$|\n)/)
  const hdntl = hdntlMatch ? `hdntl=${hdntlMatch[1]}` : null
  if (!hdntl) return null

  const expMatch = hdntl.match(/exp=(\d+)/)
  const expTime = expMatch ? parseInt(expMatch[1]) : Math.floor(Date.now() / 1000) + 600

  await cacheUpdate("hmac", hdntl, id, expTime)
  return hdntl
}

// --- PSSH extraction ---

export function extractKid(hexContent: string): { pssh: string; kid: string } | null {
  const psshMarker = "70737368"
  const psshOffset = hexContent.indexOf(psshMarker)

  if (psshOffset !== -1) {
    const headerSizeHex = hexContent.substring(psshOffset - 8, psshOffset)
    const headerSize = parseInt(headerSizeHex, 16)
    const psshHex = hexContent.substring(psshOffset - 8, psshOffset - 8 + headerSize * 2)
    const kidHex = psshHex.substring(68, 68 + 32)
    const newPsshHex =
      "000000327073736800000000edef8ba979d64acea3c827dcd51d21ed000000121210" + kidHex
    const pssh = Buffer.from(newPsshHex, "hex").toString("base64")
    const kid = `${kidHex.substring(0, 8)}-${kidHex.substring(8, 12)}-${kidHex.substring(12, 16)}-${kidHex.substring(16, 20)}-${kidHex.substring(20)}`
    return { pssh, kid }
  }
  return null
}
