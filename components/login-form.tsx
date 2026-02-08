"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<"sid" | "otp">("sid")
  const [sid, setSid] = useState("")
  const [otp, setOtp] = useState("")
  const [encryptedRmn, setEncryptedRmn] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleGetOtp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_otp", sid }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message)
        setEncryptedRmn(data.encryptedRmn)
        setStep("otp")
      } else {
        setError(data.error)
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", sid, encryptedRmn, otp }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(data.message)
        setTimeout(() => router.push("/"), 1000)
      } else {
        setError(data.error)
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-foreground">TPLAY LOGIN</h1>
        </div>

        {message && (
          <div className="mb-6 rounded-lg bg-success/10 p-3 text-center text-sm text-success">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        {step === "sid" && (
          <>
            <div className="mb-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-center text-sm text-warning">
              <span className="font-semibold">Note:</span> Script works only with{" "}
              <strong>Active</strong> TATAPLAY account. Inactive accounts will not work.
            </div>

            <form onSubmit={handleGetOtp}>
              <div className="mb-6">
                <label htmlFor="sid" className="mb-2 block text-sm font-medium text-muted-foreground">
                  SID LOGIN:
                </label>
                <input
                  type="text"
                  id="sid"
                  value={sid}
                  onChange={(e) => setSid(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  maxLength={10}
                  required
                  placeholder="Enter your subscriber ID"
                  className="w-full rounded-lg border-2 border-border bg-secondary px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading || sid.length !== 10}
                className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending..." : "Get OTP"}
              </button>
            </form>
          </>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <div className="mb-6">
              <label htmlFor="otp" className="mb-2 block text-sm font-medium text-muted-foreground">
                Enter 6-digit OTP
              </label>
              <input
                type="text"
                id="otp"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
                placeholder="Enter OTP"
                className="w-full rounded-lg border-2 border-border bg-secondary px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("sid")
                setOtp("")
                setError("")
                setMessage("")
              }}
              className="mt-3 w-full rounded-lg bg-secondary px-4 py-3 font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              Back
            </button>
          </form>
        )}

        <div className="mt-8 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          Coded with love by{" "}
          <a
            href="https://t.me/ygx_world"
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary-foreground transition-colors hover:text-foreground"
          >
            YGX WORLD
          </a>{" "}
          team
        </div>
      </div>
    </div>
  )
}
