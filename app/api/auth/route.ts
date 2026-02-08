import { NextRequest, NextResponse } from "next/server"
import { isLoggedIn, generateOtp, verifyOtp, saveCreds } from "@/lib/tataplay"

export async function GET() {
  const loggedIn = await isLoggedIn()
  return NextResponse.json({ loggedIn })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body

  if (action === "get_otp") {
    const { sid } = body
    if (!sid || sid.length !== 10 || !/^\d{10}$/.test(sid)) {
      return NextResponse.json({ error: "SID must be exactly 10 digits." }, { status: 400 })
    }

    try {
      const response = await generateOtp(sid)
      if (response.code === 0) {
        return NextResponse.json({
          success: true,
          message: `OTP sent successfully to ${response.data.decryptedRMN}`,
          encryptedRmn: response.data.rmn ?? "",
        })
      }
      return NextResponse.json(
        { error: response.message ?? "Unknown error during OTP generation." },
        { status: 400 }
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Request failed"
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (action === "verify_otp") {
    const { sid, encryptedRmn, otp } = body
    if (!otp || !/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Please enter a valid 6-digit OTP." }, { status: 400 })
    }

    try {
      const response = await verifyOtp(sid, encryptedRmn, otp)
      if (response.code === 0) {
        await saveCreds(response)
        return NextResponse.json({ success: true, message: `Login successful for SID: ${sid}` })
      }
      return NextResponse.json(
        { error: response.message ?? "Unknown error during OTP verification." },
        { status: 400 }
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Request failed"
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
